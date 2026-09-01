import { ResendEmailNotificationProvider } from '../src/server/notifications/resendEmailProvider.js';
import { createEmailProvider } from '../src/server/notifications/emailProvider.js';
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
  appointmentId: 'apt-resend-test-1',
  codigo: 'GWEN-9999',
  clienteNombre: 'Valeria',
  clienteApellido: 'Gomez',
  clienteEmail: 'valeria.autorizada@gmail.com',
  clienteTelefono: '+5491144445555',
  servicioNombre: 'Kapping Gel + Esmaltado Semi',
  fecha: '2026-09-15',
  horaInicio: '15:00',
  horaFin: '16:30',
  motivoCancelacion: 'Excepción de agenda: reformas en el local',
  profesionalNombre: 'Gwen Nails',
  beneficio: {
    titulo: 'Compensación 20% OFF',
    tipoDescuento: 'porcentaje',
    valorDescuento: 20,
    fechaVencimiento: '2026-10-15',
    codigo: 'COMP-GWEN-9999'
  }
};

// ============================================================================
// RESEND PROVIDER UNIT TESTS
// ============================================================================

test(1, 'ResendProvider: Detecta isConfigured=false cuando no hay API KEY', async () => {
  const provider = new ResendEmailNotificationProvider({
    apiKey: '',
    fromEmail: 'onboarding@resend.dev',
    fromName: 'Gwen Nails'
  });

  if (provider.isConfigured()) {
    throw new Error('Debe retornar false si no tiene apiKey');
  }
});

test(2, 'ResendProvider: En deliveryEnv="test", bloquea envíos si RESEND_ENABLE_REAL_SEND_IN_TEST=false', async () => {
  const provider = new ResendEmailNotificationProvider({
    apiKey: 're_test_dummy_key',
    fromEmail: 'onboarding@resend.dev',
    fromName: 'Gwen Nails',
    deliveryEnv: 'test',
    enableRealSendInTest: false,
    allowedRecipients: ['valeria.autorizada@gmail.com']
  });

  const result = await provider.sendCancellation(sampleData, {
    idempotencyKey: 'idemp-guard-check-1'
  });

  if (result.success !== false || result.status !== 'failed') {
    throw new Error(`Esperado status='failed', obtenido: ${result.status}`);
  }
  if (!result.error?.includes('real_test_delivery_disabled')) {
    throw new Error(`Esperado error con 'real_test_delivery_disabled', obtenido: ${result.error}`);
  }
});

test(3, 'ResendProvider: En deliveryEnv="test", bloquea destinatarios fuera de la lista blanca autorizada', async () => {
  const provider = new ResendEmailNotificationProvider({
    apiKey: 're_test_dummy_key',
    fromEmail: 'onboarding@resend.dev',
    fromName: 'Gwen Nails',
    deliveryEnv: 'test',
    enableRealSendInTest: true,
    allowedRecipients: ['admin.autorizado@gmail.com'] // valeria.autorizada@gmail.com NOT in list
  });

  const result = await provider.sendCancellation(sampleData, {
    idempotencyKey: 'idemp-allowlist-check-1'
  });

  if (result.success !== false || result.status !== 'failed') {
    throw new Error(`Esperado status='failed', obtenido: ${result.status}`);
  }
  if (!result.error?.includes('test_recipient_not_allowed')) {
    throw new Error(`Esperado error 'test_recipient_not_allowed', obtenido: ${result.error}`);
  }
});

test(4, 'ResendProvider: Omite correctamente si el cliente no tiene email registrado', async () => {
  const provider = new ResendEmailNotificationProvider({
    apiKey: 're_test_dummy_key',
    fromEmail: 'onboarding@resend.dev',
    fromName: 'Gwen Nails'
  });

  const result = await provider.sendCancellation({
    ...sampleData,
    clienteEmail: ''
  });

  if (result.status !== 'omitido_sin_email' || result.success !== true) {
    throw new Error(`Esperado omitido_sin_email, obtenido: ${result.status}`);
  }
  if (result.sentAt !== undefined) {
    throw new Error('sentAt no debe asignarse cuando se omite sin email');
  }
});

test(5, 'ResendProvider: Simulación de llamada autorizada formatea asunto con prefijo [TEST Gwen Nails] y Disclaimer', async () => {
  let capturedPayload: any = null;

  // Creamos el proveedor con cliente mock inyectado para evitar llamada real a la red
  const provider = new ResendEmailNotificationProvider(
    {
      apiKey: 're_test_dummy_key',
      fromEmail: 'onboarding@resend.dev',
      fromName: 'Gwen Nails',
      deliveryEnv: 'test',
      enableRealSendInTest: true,
      allowedRecipients: ['valeria.autorizada@gmail.com'],
      subjectPrefix: '[TEST Gwen Nails]'
    },
    {
      emails: {
        send: async (payload: any) => {
          capturedPayload = payload;
          return {
            data: { id: 're_mock_msg_id_12345' },
            error: null
          };
        }
      }
    }
  );

  const result = await provider.sendCancellation(sampleData, {
    idempotencyKey: 'idemp-prefix-test-1'
  });

  if (!result.success || result.status !== 'sent') {
    throw new Error(`Envío debió ser exitoso. Error: ${result.error}`);
  }

  if (result.providerMessageId !== 're_mock_msg_id_12345') {
    throw new Error(`Esperado providerMessageId 're_mock_msg_id_12345', obtenido ${result.providerMessageId}`);
  }

  if (!capturedPayload) {
    throw new Error('No se capturó el payload de envío');
  }

  if (!capturedPayload.subject.startsWith('[TEST Gwen Nails]')) {
    throw new Error(`Asunto debe comenzar con '[TEST Gwen Nails]'. Asunto: ${capturedPayload.subject}`);
  }

  if (!capturedPayload.html.includes('entorno de pruebas') || !capturedPayload.text.includes('entorno de pruebas')) {
    throw new Error('Tanto el HTML como el texto plano deben contener el disclaimer de testing');
  }

  if (capturedPayload.headers?.['X-Idempotency-Key'] !== 'idemp-prefix-test-1') {
    throw new Error('El header X-Idempotency-Key debe contener la clave de idempotencia');
  }
});

test(6, 'ResendProvider: En producción (deliveryEnv="production"), no agrega prefijo de test ni disclaimer', async () => {
  let capturedPayload: any = null;

  const provider = new ResendEmailNotificationProvider(
    {
      apiKey: 're_prod_dummy_key',
      fromEmail: 'notificaciones@gwennails.com',
      fromName: 'Gwen Nails',
      deliveryEnv: 'production',
      enableRealSendInTest: false
    },
    {
      emails: {
        send: async (payload: any) => {
          capturedPayload = payload;
          return {
            data: { id: 're_prod_msg_id_99999' },
            error: null
          };
        }
      }
    }
  );

  const result = await provider.sendCancellation(sampleData, {
    idempotencyKey: 'idemp-prod-1'
  });

  if (!result.success || result.status !== 'sent') {
    throw new Error(`Envío de producción debió ser exitoso. Error: ${result.error}`);
  }

  if (capturedPayload.subject.includes('[TEST')) {
    throw new Error(`En producción no debe tener prefijo [TEST]. Asunto: ${capturedPayload.subject}`);
  }

  if (capturedPayload.html.includes('ENTORNO DE PRUEBAS / TESTING')) {
    throw new Error('En producción no debe incluirse el disclaimer de testing');
  }
});

test(7, 'ResendProvider: Manejo de errores de API de Resend sin filtrar secrets en logs ni excepciones', async () => {
  const provider = new ResendEmailNotificationProvider(
    {
      apiKey: 're_test_dummy_key',
      fromEmail: 'invalid@unverified-domain.com',
      fromName: 'Gwen Nails',
      deliveryEnv: 'test',
      enableRealSendInTest: true,
      allowedRecipients: ['valeria.autorizada@gmail.com']
    },
    {
      emails: {
        send: async () => {
          return {
            data: null,
            error: {
              name: 'validation_error',
              message: 'The domain unverified-domain.com is not verified. Please verify your domain in Resend.'
            }
          };
        }
      }
    }
  );

  const result = await provider.sendCancellation(sampleData, {
    idempotencyKey: 'idemp-api-error-1'
  });

  if (result.success !== false || result.status !== 'failed') {
    throw new Error(`Esperado status='failed', obtenido: ${result.status}`);
  }

  if (!result.error?.includes('dominio') && !result.error?.includes('verified')) {
    throw new Error(`Esperado mensaje descriptivo del error de dominio, obtenido: ${result.error}`);
  }
});

test(8, 'Factory createEmailProvider: En NODE_ENV="test" o EMAIL_PROVIDER_MODE="mock", siempre devuelve MockEmailNotificationProvider', async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalMode = process.env.EMAIL_PROVIDER_MODE;
  const originalKey = process.env.RESEND_API_KEY;

  try {
    process.env.NODE_ENV = 'test';
    process.env.RESEND_API_KEY = 're_12345';
    process.env.EMAIL_PROVIDER_MODE = 'resend';

    const provider = createEmailProvider();
    if (provider.channel !== 'email' || provider.constructor.name !== 'MockEmailNotificationProvider') {
      throw new Error(`En NODE_ENV="test", la factory debe retornar MockEmailNotificationProvider para proteger contra envíos accidentales. Retornó: ${provider.constructor.name}`);
    }
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.EMAIL_PROVIDER_MODE = originalMode;
    process.env.RESEND_API_KEY = originalKey;
  }
});

test(9, 'Factory createEmailProvider: Con EMAIL_PROVIDER_MODE="resend", retorna ResendEmailNotificationProvider fuera del entorno de test', async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalMode = process.env.EMAIL_PROVIDER_MODE;
  const originalKey = process.env.RESEND_API_KEY;

  try {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_PROVIDER_MODE = 'resend';
    process.env.RESEND_API_KEY = 're_12345';

    const provider = createEmailProvider();
    if (provider.constructor.name !== 'ResendEmailNotificationProvider') {
      throw new Error(`Esperado ResendEmailNotificationProvider, obtenido: ${provider.constructor.name}`);
    }
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.EMAIL_PROVIDER_MODE = originalMode;
    process.env.RESEND_API_KEY = originalKey;
  }
});

// ============================================================================
// TEST RUNNER
// ============================================================================

export async function runResendTests() {
  console.log(`\n--- Ejecutando ${tests.length} tests de Resend Email Provider ---`);
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ [TEST ${t.id}] ${t.name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [TEST ${t.id}] ${t.name}:`, err.message);
      failed++;
    }
  }

  console.log(`\nResumen: ${passed} pasados, ${failed} fallados de ${tests.length} totales.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes('resend_provider')) {
  runResendTests();
}
