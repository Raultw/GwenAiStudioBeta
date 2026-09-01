import { 
  acquireNotificationLock,
  createNotificationLog,
  getNotificationLogs,
  isNotificationAlreadySent,
  getMemoryDb,
  setMemoryDb,
  applyAvailabilityExceptionWithCancellations
} from '../src/server/db.js';
import { NotificationService } from '../src/server/notifications/notificationService.js';
import { MockEmailNotificationProvider } from '../src/server/notifications/mockEmailProvider.js';
import { SmtpEmailNotificationProvider } from '../src/server/notifications/smtpEmailProvider.js';
import { createEmailProvider, EmailNotificationProvider } from '../src/server/notifications/emailProvider.js';
import type { Appointment, BenefitTemplate } from '../src/types.js';
import { getBusinessDate } from '../src/utils/dateUtils.js';

interface TestCase {
  id: number;
  name: string;
  fn: () => Promise<void>;
}

const tests: TestCase[] = [];

function test(id: number, name: string, fn: () => Promise<void>) {
  tests.push({ id, name, fn });
}

function resetDb() {
  const db = getMemoryDb();
  db.notificationLogs = [];
  db.appointments = [];
  db.clientBenefits = [];
  db.benefitTemplates = [];
  db.availabilityExceptions = [];
  setMemoryDb(db);
}

// ============================================================================
// TESTS
// ============================================================================

test(1, 'acquireNotificationLock: Dos workers concurrentes compitiendo por el mismo evento pending -> exactamente UN ganador', async () => {
  resetDb();
  const key = 'test-concurrent-race-1';
  
  await createNotificationLog({
    id: 'log-race-1',
    appointmentId: 'apt-race-1',
    channel: 'email',
    recipient: 'cliente@test.com',
    notificationType: 'appointment_cancellation',
    status: 'pending',
    idempotencyKey: key,
    maxAttempts: 3
  });

  // Ejecutar dos adquisiciones concurrentes
  const [worker1Result, worker2Result] = await Promise.all([
    acquireNotificationLock(key, 'email', 30),
    acquireNotificationLock(key, 'email', 30)
  ]);

  const winnerCount = (worker1Result ? 1 : 0) + (worker2Result ? 1 : 0);
  if (winnerCount !== 1) {
    throw new Error(`Esperado exactamente 1 ganador, pero hubieron ${winnerCount} ganadores.`);
  }

  const winner = worker1Result || worker2Result;
  if (!winner || winner.status !== 'processing' || winner.attemptCount !== 1) {
    throw new Error(`El ganador debe tener status='processing' y attemptCount=1.`);
  }
  if (!winner.leaseExpiresAt) {
    throw new Error('El ganador debe tener leaseExpiresAt establecido.');
  }
});

test(2, 'acquireNotificationLock: Segundo intento secuencial mientras el lease está activo -> retorna null', async () => {
  resetDb();
  const key = 'test-lease-active-2';

  await createNotificationLog({
    id: 'log-lease-2',
    appointmentId: 'apt-lease-2',
    channel: 'email',
    recipient: 'cliente@test.com',
    notificationType: 'appointment_cancellation',
    status: 'pending',
    idempotencyKey: key,
    maxAttempts: 3
  });

  const firstAcquisition = await acquireNotificationLock(key, 'email', 60);
  if (!firstAcquisition) throw new Error('Primer worker debió adquirir el lease');

  const secondAcquisition = await acquireNotificationLock(key, 'email', 60);
  if (secondAcquisition !== null) {
    throw new Error(`Segundo worker no debió adquirir un lease vigente. Retornó: ${JSON.stringify(secondAcquisition)}`);
  }
});

test(3, 'acquireNotificationLock: Recuperación de lease vencido (lease_expires_at < now)', async () => {
  resetDb();
  const key = 'test-lease-expired-3';
  const pastDate = new Date(Date.now() - 10000).toISOString(); // Hace 10 segundos

  await createNotificationLog({
    id: 'log-expired-3',
    appointmentId: 'apt-expired-3',
    channel: 'email',
    recipient: 'cliente@test.com',
    notificationType: 'appointment_cancellation',
    status: 'processing',
    idempotencyKey: key,
    leaseExpiresAt: pastDate,
    processingStartedAt: pastDate,
    attemptCount: 1,
    maxAttempts: 3
  });

  const recovered = await acquireNotificationLock(key, 'email', 30);
  if (!recovered) {
    throw new Error('Worker debió poder recuperar el evento con lease vencido');
  }
  if (recovered.status !== 'processing' || recovered.attemptCount !== 2) {
    throw new Error(`Esperado status='processing' y attemptCount=2, obtenido attemptCount=${recovered.attemptCount}`);
  }
});

test(4, 'acquireNotificationLock: Máximo de intentos alcanzado (attemptCount >= maxAttempts) -> no es elegible', async () => {
  resetDb();
  const key = 'test-max-attempts-4';

  await createNotificationLog({
    id: 'log-max-4',
    appointmentId: 'apt-max-4',
    channel: 'email',
    recipient: 'cliente@test.com',
    notificationType: 'appointment_cancellation',
    status: 'failed',
    idempotencyKey: key,
    attemptCount: 3,
    maxAttempts: 3
  });

  const attempt = await acquireNotificationLock(key, 'email', 30);
  if (attempt !== null) {
    throw new Error(`No debe adquirirse lock si se alcanzó el límite de intentos. Retornó: ${JSON.stringify(attempt)}`);
  }
});

test(5, 'acquireNotificationLock: Backoff exponencial respeta next_attempt_at en el futuro', async () => {
  resetDb();
  const key = 'test-backoff-future-5';
  const futureDate = new Date(Date.now() + 60000).toISOString(); // 1 minuto en el futuro

  await createNotificationLog({
    id: 'log-backoff-5',
    appointmentId: 'apt-backoff-5',
    channel: 'email',
    recipient: 'cliente@test.com',
    notificationType: 'appointment_cancellation',
    status: 'failed',
    idempotencyKey: key,
    attemptCount: 1,
    maxAttempts: 3,
    nextAttemptAt: futureDate
  });

  // Intentar adquirir mientras está en período de backoff
  const lock = await acquireNotificationLock(key, 'email', 30);
  if (lock !== null) {
    throw new Error(`No debe adquirirse lock si next_attempt_at está en el futuro. Retornó: ${JSON.stringify(lock)}`);
  }
});

test(6, 'MockEmailNotificationProvider: Registra envíos en memoria y no ejecuta llamadas de red reales', async () => {
  const mockProvider = new MockEmailNotificationProvider();
  mockProvider.clearSentEmails();

  const data = {
    appointmentId: 'apt-mock-6',
    codigo: 'GW-MOCK-6',
    clienteNombre: 'Camila',
    clienteEmail: 'camila@example.com',
    servicioNombre: 'Semipermanente',
    fecha: '2026-09-01',
    horaInicio: '14:00',
    horaFin: '15:00',
    motivoCancelacion: 'Capacitación'
  };

  const result = await mockProvider.sendCancellation(data, { idempotencyKey: 'key-mock-6' });
  if (!result.success || result.status !== 'sent') {
    throw new Error(`Mock provider debió retornar success=true y status='sent'. Obtuvo: ${JSON.stringify(result)}`);
  }
  if (!result.sentAt) {
    throw new Error('result.sentAt debe existir cuando status=sent');
  }
  if (mockProvider.sentEmails.length !== 1) {
    throw new Error(`Esperado 1 email registrado en mockProvider, encontrados ${mockProvider.sentEmails.length}`);
  }
  if (mockProvider.sentEmails[0].recipient !== 'camila@example.com') {
    throw new Error(`Destinatario no coincide: ${mockProvider.sentEmails[0].recipient}`);
  }
});

test(7, 'MockEmailNotificationProvider: Simulación de fallo no asigna sentAt', async () => {
  const mockProvider = new MockEmailNotificationProvider();
  mockProvider.clearSentEmails();
  mockProvider.setShouldFailNext(true, 'SMTP timeout test');

  const data = {
    appointmentId: 'apt-mock-7',
    codigo: 'GW-MOCK-7',
    clienteNombre: 'Lucía',
    clienteEmail: 'lucia@example.com',
    servicioNombre: 'Kapping',
    fecha: '2026-09-01',
    horaInicio: '16:00',
    horaFin: '17:00',
    motivoCancelacion: 'Imprevisto'
  };

  const result = await mockProvider.sendCancellation(data, { idempotencyKey: 'key-mock-7' });
  if (result.success || result.status !== 'failed') {
    throw new Error(`Esperado success=false y status='failed', obtenido: ${JSON.stringify(result)}`);
  }
  if (result.sentAt !== undefined) {
    throw new Error(`sentAt debe ser undefined en envíos fallidos. Obtenido: ${result.sentAt}`);
  }
  if (mockProvider.sentEmails.length !== 0) {
    throw new Error('No debe registrarse email enviado si falló el transporte');
  }
});

test(8, 'SmtpEmailNotificationProvider: Valida configuración e informa isConfigured correctamente', async () => {
  const unconfiguredProvider = new SmtpEmailNotificationProvider({ host: '', user: '' });
  if (unconfiguredProvider.isConfigured()) {
    throw new Error('Provider sin host ni user no debe estar configurado');
  }

  const configuredProvider = new SmtpEmailNotificationProvider({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'test@gwennails.com',
    pass: 'secret',
    from: 'Gwen Nails <test@gwennails.com>'
  });
  if (!configuredProvider.isConfigured()) {
    throw new Error('Provider con host y user debe estar configurado');
  }
});

test(9, 'createEmailProvider Factory: Selecciona Mock en testing/dev y Smtp cuando se especifica', async () => {
  process.env.EMAIL_PROVIDER_MODE = 'mock';
  const mockProv = createEmailProvider();
  if (!(mockProv instanceof MockEmailNotificationProvider)) {
    throw new Error('Factory debió instanciar MockEmailNotificationProvider con EMAIL_PROVIDER_MODE=mock');
  }

  process.env.EMAIL_PROVIDER_MODE = 'smtp';
  const smtpProv = createEmailProvider();
  if (!(smtpProv instanceof SmtpEmailNotificationProvider)) {
    throw new Error('Factory debió instanciar SmtpEmailNotificationProvider con EMAIL_PROVIDER_MODE=smtp');
  }

  // Restore
  process.env.EMAIL_PROVIDER_MODE = 'mock';
});

test(10, 'NotificationService con Mock Provider: Despacho e Idempotencia end-to-end con verificación de logs', async () => {
  resetDb();
  const mockProvider = new MockEmailNotificationProvider();
  const service = new NotificationService([mockProvider]);

  const apt: Appointment = {
    id: 'apt-service-10',
    codigo: 'GW-10',
    clienteId: 'cli-10',
    servicioId: 'srv-1',
    fecha: '2026-09-02',
    horaInicio: '10:00',
    horaFin: '11:00',
    precio: 10000,
    duracionMinutos: 60,
    estado: 'cancelado',
    nombre: 'Valentina',
    apellido: 'Gómez',
    email: 'valentina@example.com',
    telefono: '1123456789',
    servicioNombre: 'Manicura Rusa',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const results1 = await service.sendAppointmentCancellation(apt, {
    motivo: 'Salón cerrado por reformas',
    idempotencyKey: 'idemp-key-10'
  });

  if (results1.length !== 1 || results1[0].status !== 'sent') {
    throw new Error(`Primer envío debió ser 'sent'. Resultado: ${JSON.stringify(results1)}`);
  }
  if (!results1[0].sentAt) {
    throw new Error('sentAt debe estar definido en resultado exitoso');
  }

  // Segundo envío concurrente/secuencial con la misma clave de idempotencia
  const results2 = await service.sendAppointmentCancellation(apt, {
    motivo: 'Salón cerrado por reformas',
    idempotencyKey: 'idemp-key-10'
  });

  if (results2.length !== 1 || results2[0].status !== 'skipped') {
    throw new Error(`Segundo envío debió ser 'skipped'. Resultado: ${JSON.stringify(results2)}`);
  }

  // Verificar que el log persistido tenga sentAt y status=sent
  const logs = await getNotificationLogs({ appointmentId: 'apt-service-10' });
  if (logs.length !== 1) {
    throw new Error(`Esperado exactamente 1 log, encontrados ${logs.length}`);
  }
  if (logs[0].status !== 'sent' || !logs[0].sentAt) {
    throw new Error(`Log debe tener status='sent' y sentAt válido. Obtenido: ${JSON.stringify(logs[0])}`);
  }
  if (mockProvider.sentEmails.length !== 1) {
    throw new Error(`Se debió enviar exactamente 1 email por el proveedor mock, pero hubieron ${mockProvider.sentEmails.length}`);
  }
});

// ============================================================================
// TEST RUNNER
// ============================================================================

export async function runAllTests() {
  console.log(`\n--- Ejecutando ${tests.length} tests de Notificaciones, Concurrencia y Lease ---`);
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

if (process.argv[1] && process.argv[1].includes('notifications_concurrency_lease')) {
  runAllTests();
}
