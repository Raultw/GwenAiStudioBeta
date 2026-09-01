import { GmailSmtpEmailNotificationProvider } from '../src/server/notifications/gmailSmtpEmailProvider.js';
import { createEmailProvider } from '../src/server/notifications/emailProvider.js';
import { ResendEmailNotificationProvider } from '../src/server/notifications/resendEmailProvider.js';
import { CancellationNotificationData } from '../src/server/notifications/types.js';

interface TestCase {
  id: number;
  name: string;
  fn: () => Promise<void>;
}

const tests: TestCase[] = [];

function test(id: number, name: string, fn: () => Promise<void>) {
  tests.push({ id, name, fn });
}

const sampleData: CancellationNotificationData = {
  appointmentId: 'apt-gmail-test-1',
  codigo: 'GWEN-8888',
  clienteNombre: 'Camila',
  clienteApellido: 'Rios',
  clienteEmail: 'camila.test@gmail.com',
  clienteTelefono: '+5491133334444',
  servicioNombre: 'Esmaltado Semipermanente',
  fecha: '2026-09-20',
  horaInicio: '10:00',
  horaFin: '11:00',
  motivoCancelacion: 'Mantenimiento de salón',
  profesionalNombre: 'Gwen Nails'
};

// Mock transporter factory for testing
function createMockTransporter(shouldFail: boolean = false, failErrorName: string = '', messageId: string = '<msg-id-gmail-123@smtp.gmail.com>') {
  return {
    sendMail: async (mailOptions: any) => {
      if (shouldFail) {
        const err: any = new Error(failErrorName || 'SMTP Connection failed');
        if (failErrorName.includes('invalid login')) {
          err.code = 'EAUTH';
          err.message = 'Invalid login: 535-5.7.8 Username and Password not accepted.';
        } else if (failErrorName.includes('timeout')) {
          err.code = 'ETIMEDOUT';
          err.message = 'Connection timeout';
        }
        throw err;
      }
      return {
        messageId,
        envelope: { from: mailOptions.from, to: mailOptions.to },
        accepted: [mailOptions.to],
        rejected: [],
        response: '250 2.0.0 OK'
      };
    }
  };
}

// ============================================================================
// GMAIL SMTP PROVIDER UNIT & INTEGRATION TESTS
// ============================================================================

test(1, 'GmailSmtpProvider: Selección a través de EMAIL_PROVIDER_MODE=gmail_smtp en dev/test', async () => {
  const origMode = process.env.EMAIL_PROVIDER_MODE;
  const origNodeEnv = process.env.NODE_ENV;
  try {
    process.env.EMAIL_PROVIDER_MODE = 'gmail_smtp';
    process.env.NODE_ENV = 'development';
    const provider = createEmailProvider();
    if (!(provider instanceof GmailSmtpEmailNotificationProvider)) {
      throw new Error(`Esperado GmailSmtpEmailNotificationProvider, obtenido: ${provider.constructor.name}`);
    }
  } finally {
    process.env.EMAIL_PROVIDER_MODE = origMode;
    process.env.NODE_ENV = origNodeEnv;
  }
});

test(2, 'GmailSmtpProvider: Rechazo y error controlado en entorno de producción', async () => {
  const origMode = process.env.EMAIL_PROVIDER_MODE;
  const origNodeEnv = process.env.NODE_ENV;
  try {
    process.env.EMAIL_PROVIDER_MODE = 'gmail_smtp';
    process.env.NODE_ENV = 'production';
    let errorCaught = false;
    try {
      createEmailProvider();
    } catch (err: any) {
      if (err.message.includes('gmail_smtp_not_allowed_in_production')) {
        errorCaught = true;
      }
    }
    if (!errorCaught) {
      throw new Error('Debería haber lanzado error al intentar usar gmail_smtp en producción');
    }
  } finally {
    process.env.EMAIL_PROVIDER_MODE = origMode;
    process.env.NODE_ENV = origNodeEnv;
  }
});

test(3, 'GmailSmtpProvider: Usuario faltante (isConfigured=false)', async () => {
  const provider = new GmailSmtpEmailNotificationProvider({
    user: '',
    pass: 'dummy-app-pass'
  });
  if (provider.isConfigured()) {
    throw new Error('isConfigured debe retornar false si falta el usuario');
  }
});

test(4, 'GmailSmtpProvider: Contraseña de aplicación faltante (isConfigured=false)', async () => {
  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: ''
  });
  if (provider.isConfigured()) {
    throw new Error('isConfigured debe retornar false si falta la contraseña');
  }
});

test(5, 'GmailSmtpProvider: Entrega real deshabilitada en test (GMAIL_ENABLE_REAL_SEND_IN_TEST=false)', async () => {
  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    deliveryEnv: 'test',
    enableRealSendInTest: false,
    allowedRecipients: ['camila.test@gmail.com']
  }, createMockTransporter());

  const result = await provider.sendCancellation(sampleData);
  if (result.success !== false || result.status !== 'failed' || result.error !== 'real_test_delivery_disabled') {
    throw new Error(`Esperado error 'real_test_delivery_disabled', obtenido: ${result.error}`);
  }
});

test(6, 'GmailSmtpProvider: Destinatario fuera de allowlist', async () => {
  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['otro.destinatario@gmail.com'] // camila.test@gmail.com not in list
  }, createMockTransporter());

  const result = await provider.sendCancellation(sampleData);
  if (result.success !== false || result.status !== 'failed' || result.error !== 'test_recipient_not_allowed') {
    throw new Error(`Esperado error 'test_recipient_not_allowed', obtenido: ${result.error}`);
  }
});

test(7, 'GmailSmtpProvider: Destinatario autorizado en allowlist', async () => {
  let invoked = false;
  const mockTransporter = {
    sendMail: async (opts: any) => {
      invoked = true;
      return { messageId: '<success-gmail-123@smtp.gmail.com>' };
    }
  };

  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['camila.test@gmail.com']
  }, mockTransporter);

  const result = await provider.sendCancellation(sampleData);
  if (!result.success || result.status !== 'sent' || !invoked) {
    throw new Error(`Esperado envío exitoso, obtenido: ${result.status}, invoked: ${invoked}`);
  }
});

test(8, 'GmailSmtpProvider: Normalización de allowlist (minúsculas, espacios, duplicados)', async () => {
  const rawList = '  CAMILA.TEST@GMAIL.COM ,  otro@gmail.com , camila.test@gmail.com ';
  const parsed = GmailSmtpEmailNotificationProvider.parseAllowedRecipients(rawList);
  if (parsed.size !== 2 || !parsed.has('camila.test@gmail.com') || !parsed.has('otro@gmail.com')) {
    throw new Error(`Allowlist mal normalizada: ${Array.from(parsed)}`);
  }
});

test(9, 'GmailSmtpProvider: Remitente igual al usuario autenticado (Gwen Nails <user>)', async () => {
  let capturedOptions: any = null;
  const mockTransporter = {
    sendMail: async (opts: any) => {
      capturedOptions = opts;
      return { messageId: '<id-123@smtp.gmail.com>' };
    }
  };

  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    fromName: 'Gwen Nails',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['camila.test@gmail.com']
  }, mockTransporter);

  await provider.sendCancellation(sampleData);
  if (!capturedOptions.from.includes('gwen.nails.notif@gmail.com') || !capturedOptions.from.includes('Gwen Nails')) {
    throw new Error(`Remitente incorrecto: ${capturedOptions.from}`);
  }
});

test(10, 'GmailSmtpProvider: Prefijo de testing antepuesto en el asunto', async () => {
  let capturedSubject = '';
  const mockTransporter = {
    sendMail: async (opts: any) => {
      capturedSubject = opts.subject;
      return { messageId: '<id-123@smtp.gmail.com>' };
    }
  };

  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    subjectPrefix: '[TEST Gwen Nails]',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['camila.test@gmail.com']
  }, mockTransporter);

  await provider.sendCancellation(sampleData);
  if (!capturedSubject.startsWith('[TEST Gwen Nails]')) {
    throw new Error(`El asunto no tiene el prefijo esperado: ${capturedSubject}`);
  }
});

test(11, 'GmailSmtpProvider: Leyenda de testing incorporada en texto plano y HTML', async () => {
  let capturedText = '';
  let capturedHtml = '';
  const mockTransporter = {
    sendMail: async (opts: any) => {
      capturedText = opts.text;
      capturedHtml = opts.html;
      return { messageId: '<id-123@smtp.gmail.com>' };
    }
  };

  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['camila.test@gmail.com']
  }, mockTransporter);

  await provider.sendCancellation(sampleData);
  const disclaimer = 'Este mensaje fue generado desde el entorno de pruebas de Gwen Nails.';
  if (!capturedText.includes(disclaimer) || !capturedHtml.includes(disclaimer)) {
    throw new Error('La leyenda de pruebas no fue encontrada en text o html');
  }
});

test(12, 'GmailSmtpProvider: sendMail invocado exactamente una vez', async () => {
  let callCount = 0;
  const mockTransporter = {
    sendMail: async () => {
      callCount++;
      return { messageId: '<msg-1@smtp.gmail.com>' };
    }
  };

  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['camila.test@gmail.com']
  }, mockTransporter);

  await provider.sendCancellation(sampleData);
  if (callCount !== 1) {
    throw new Error(`sendMail fue invocado ${callCount} veces (esperado 1)`);
  }
});

test(13, 'GmailSmtpProvider: messageId del transporter se persiste como providerMessageId', async () => {
  const expectedMsgId = '<unique-gmail-id-999@smtp.gmail.com>';
  const mockTransporter = createMockTransporter(false, '', expectedMsgId);

  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['camila.test@gmail.com']
  }, mockTransporter);

  const result = await provider.sendCancellation(sampleData);
  if (result.providerMessageId !== expectedMsgId) {
    throw new Error(`Esperado providerMessageId=${expectedMsgId}, obtenido: ${result.providerMessageId}`);
  }
});

test(14, 'GmailSmtpProvider: Error de autenticación sanitizado (smtp_authentication_error)', async () => {
  const mockTransporter = createMockTransporter(true, 'invalid login');
  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['camila.test@gmail.com']
  }, mockTransporter);

  const result = await provider.sendCancellation(sampleData);
  if (result.success !== false || !result.error?.includes('smtp_authentication_error')) {
    throw new Error(`Esperado error 'smtp_authentication_error', obtenido: ${result.error}`);
  }
});

test(15, 'GmailSmtpProvider: Timeout sanitizado (smtp_timeout)', async () => {
  const mockTransporter = createMockTransporter(true, 'timeout ETIMEDOUT');
  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['camila.test@gmail.com']
  }, mockTransporter);

  const result = await provider.sendCancellation(sampleData);
  if (result.success !== false || !result.error?.includes('smtp_timeout')) {
    throw new Error(`Esperado error 'smtp_timeout', obtenido: ${result.error}`);
  }
});

test(16, 'GmailSmtpProvider: Fallo SMTP genérico manejado correctamente', async () => {
  const mockTransporter = createMockTransporter(true, 'SMTP server unavailable');
  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['camila.test@gmail.com']
  }, mockTransporter);

  const result = await provider.sendCancellation(sampleData);
  if (result.success !== false || !result.error) {
    throw new Error(`Esperado fallo controlado, obtenido: ${JSON.stringify(result)}`);
  }
});

test(17, 'GmailSmtpProvider: Privacidad y enmascaramiento de email en logs', async () => {
  const masked = GmailSmtpEmailNotificationProvider.maskEmail('gwen.nails.notif@gmail.com');
  if (masked.includes('notif') || !masked.includes('@gmail.com') || !masked.includes('gw***')) {
    throw new Error(`Enmascaramiento incorrecto: ${masked}`);
  }
});

test(18, 'GmailSmtpProvider: Sin email retorna omitido_sin_email y no invoca transporte', async () => {
  let invoked = false;
  const mockTransporter = {
    sendMail: async () => {
      invoked = true;
      return { messageId: 'msg' };
    }
  };

  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['camila.test@gmail.com']
  }, mockTransporter);

  const emptyData = { ...sampleData, clienteEmail: '' };
  const result = await provider.sendCancellation(emptyData);
  if (result.status !== 'omitido_sin_email' || invoked) {
    throw new Error(`Esperado omitido_sin_email y sin transporte invocado`);
  }
});

test(19, 'GmailSmtpProvider: sendTestEmail soporta despacho smoke test correctamente', async () => {
  const mockTransporter = createMockTransporter(false, '', '<test-smoke-id@smtp.gmail.com>');
  const provider = new GmailSmtpEmailNotificationProvider({
    user: 'gwen.nails.notif@gmail.com',
    pass: 'dummy-pass',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['camila.test@gmail.com']
  }, mockTransporter);

  const res = await provider.sendTestEmail('camila.test@gmail.com', '[TEST] Smoke', '<p>Html</p>', 'Text');
  if (!res.success || res.status !== 'sent' || res.providerMessageId !== '<test-smoke-id@smtp.gmail.com>') {
    throw new Error(`Fallo en sendTestEmail: ${JSON.stringify(res)}`);
  }
});

test(20, 'Resend provider continúa funcionando sin regresiones', async () => {
  const resendProvider = new ResendEmailNotificationProvider({
    apiKey: '',
    deliveryEnv: 'test'
  });
  if (resendProvider.channel !== 'email') {
    throw new Error('Resend provider broken');
  }
});

// ============================================================================
// TEST RUNNER
// ============================================================================
async function runAllTests() {
  console.log('======================================================');
  console.log(`🧪 EJECUTANDO SUITE DE ${tests.length} PRUEBAS DE GMAIL SMTP`);
  console.log('======================================================');

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✅ [TEST ${String(t.id).padStart(2, '0')}/${tests.length}] PASS: ${t.name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [TEST ${String(t.id).padStart(2, '0')}/${tests.length}] FAIL: ${t.name}`);
      console.error(`   Error: ${err?.message || err}`);
      failed++;
    }
  }

  console.log('======================================================');
  console.log(`📊 RESULTADOS GMAIL SMTP: ${passed} PASADAS, ${failed} FALLADAS (TOTAL: ${tests.length})`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
