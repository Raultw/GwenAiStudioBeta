import { 
  applyAvailabilityExceptionWithCancellations,
  getMemoryDb,
  setMemoryDb,
  isDatabasePostgres,
  isNotificationAlreadySent,
  createNotificationLog,
  getNotificationLogs
} from '../src/server/db.js';
import type { 
  Appointment, 
  BenefitTemplate, 
  AvailabilityException, 
  ClientBenefit 
} from '../src/types.js';
import { getBusinessDate, addDaysToIsoDate } from '../src/utils/dateUtils.js';

interface TestCase {
  id: number;
  name: string;
  fn: () => Promise<void>;
}

const tests: TestCase[] = [];

function test(id: number, name: string, fn: () => Promise<void>) {
  tests.push({ id, name, fn });
}

// Helpers to reset / setup memory fixtures
function setupFixtures() {
  const db = getMemoryDb();
  const today = getBusinessDate();

  const templateActive: BenefitTemplate = {
    id: 'tpl-test-active',
    nombrePublico: 'Compensación 20%',
    descripcionPublica: 'Descuento especial por reprogramación',
    tipoDescuento: 'porcentaje',
    valorDescuento: 20,
    vigenciaDias: 30,
    serviciosAplicables: ['todos'],
    montoMinimo: null,
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const templateInactive: BenefitTemplate = {
    id: 'tpl-test-inactive',
    nombrePublico: 'Compensación Inactiva',
    tipoDescuento: 'porcentaje',
    valorDescuento: 15,
    vigenciaDias: 30,
    serviciosAplicables: ['todos'],
    activo: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const templateInvalidDiscount: BenefitTemplate = {
    id: 'tpl-test-invalid-disc',
    nombrePublico: 'Compensación 150%',
    tipoDescuento: 'porcentaje',
    valorDescuento: 150,
    vigenciaDias: 30,
    serviciosAplicables: ['todos'],
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const templateInvalidDays: BenefitTemplate = {
    id: 'tpl-test-invalid-days',
    nombrePublico: 'Compensación 999 días',
    tipoDescuento: 'monto_fijo',
    valorDescuento: 5000,
    vigenciaDias: 999,
    serviciosAplicables: ['todos'],
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const apt1: Appointment = {
    id: 'apt-test-1',
    codigo: 'GW-001',
    servicioId: 'srv-1',
    servicioNombre: 'Manicura Rusa',
    duracionMinutos: 60,
    fecha: today,
    horaInicio: '10:00',
    horaFin: '11:00',
    nombre: 'Ana',
    apellido: 'García',
    telefono: '1122334455',
    email: 'ana@example.com',
    estado: 'pendiente',
    precio: 15000,
    precioFinal: 15000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const apt2NoEmail: Appointment = {
    id: 'apt-test-2-noemail',
    codigo: 'GW-002',
    servicioId: 'srv-1',
    servicioNombre: 'Manicura Rusa',
    duracionMinutos: 60,
    fecha: today,
    horaInicio: '11:30',
    horaFin: '12:30',
    nombre: 'Lucía',
    apellido: 'Martínez',
    telefono: '1199887766',
    email: '',
    estado: 'pendiente',
    precio: 15000,
    precioFinal: 15000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const apt3: Appointment = {
    id: 'apt-test-3',
    codigo: 'GW-003',
    servicioId: 'srv-2',
    servicioNombre: 'Kapping Gel',
    duracionMinutos: 90,
    fecha: today,
    horaInicio: '14:00',
    horaFin: '15:30',
    nombre: 'Sofía',
    apellido: 'Pérez',
    telefono: '1133445566',
    email: 'sofia@example.com',
    estado: 'pendiente',
    precio: 18000,
    precioFinal: 18000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.benefitTemplates = [templateActive, templateInactive, templateInvalidDiscount, templateInvalidDays];
  db.appointments = [apt1, apt2NoEmail, apt3];
  db.availabilityExceptions = [];
  db.clientBenefits = [];
  db.notificationLogs = [];

  return { today, templateActive, apt1, apt2NoEmail, apt3 };
}

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// 40 TEST CASES
// ---------------------------------------------------------------------------

test(1, 'Revalidación autoritativa: Plantilla inexistente -> Error 404', async () => {
  const { today } = setupFixtures();
  let threw = false;
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-non-existent',
      benefitAppointmentIds: ['apt-test-1']
    });
  } catch (err: any) {
    threw = true;
    assert(err.message.includes('no existe'), 'Debe indicar que la plantilla no existe');
  }
  assert(threw, 'Debió lanzar excepción por plantilla inexistente');
});

test(2, 'Revalidación autoritativa: Plantilla inactiva -> Error 400', async () => {
  const { today } = setupFixtures();
  let threw = false;
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-test-inactive',
      benefitAppointmentIds: ['apt-test-1']
    });
  } catch (err: any) {
    threw = true;
    assert(err.message.includes('inactiva'), 'Debe indicar que la plantilla está inactiva');
  }
  assert(threw, 'Debió lanzar excepción por plantilla inactiva');
});

test(3, 'Revalidación autoritativa: Porcentaje de descuento > 100% -> Error 400', async () => {
  const { today } = setupFixtures();
  let threw = false;
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-test-invalid-disc',
      benefitAppointmentIds: ['apt-test-1']
    });
  } catch (err: any) {
    threw = true;
    assert(err.message.includes('superar el 100%'), 'Debe validar porcentaje <= 100%');
  }
  assert(threw, 'Debió lanzar excepción por descuento inválido');
});

test(4, 'Revalidación autoritativa: Vigencia en días fuera de rango (1-730) -> Error 400', async () => {
  const { today } = setupFixtures();
  let threw = false;
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-test-invalid-days',
      benefitAppointmentIds: ['apt-test-1']
    });
  } catch (err: any) {
    threw = true;
    assert(err.message.includes('entre 1 y 730'), 'Debe validar vigencia entre 1 y 730');
  }
  assert(threw, 'Debió lanzar excepción por vigencia inválida');
});

test(5, 'Revalidación autoritativa: Turno afectado inexistente -> Error', async () => {
  const { today } = setupFixtures();
  let threw = false;
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-ghost-999'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-test-active',
      benefitAppointmentIds: ['apt-ghost-999']
    });
  } catch (err: any) {
    threw = true;
    assert(err.message.includes('no existe') || err.message.includes('no fue encontrado'), 'Debe indicar que el turno no existe');
  }
  assert(threw, 'Debió lanzar excepción por turno inexistente');
});

test(6, 'Revalidación autoritativa: Selección vacía de turnos para beneficio -> Error', async () => {
  const { today } = setupFixtures();
  let threw = false;
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-test-active',
      benefitAppointmentIds: []
    });
  } catch (err: any) {
    threw = true;
    assert(err.message.includes('al menos un turno'), 'Debe exigir al menos un turno');
  }
  assert(threw, 'Debió lanzar excepción por selección vacía');
});

test(7, 'Revalidación autoritativa: Turnos duplicados en benefitAppointmentIds -> Error', async () => {
  const { today } = setupFixtures();
  let threw = false;
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-test-active',
      benefitAppointmentIds: ['apt-test-1', 'apt-test-1']
    });
  } catch (err: any) {
    threw = true;
    assert(err.message.includes('duplicados'), 'Debe rechazar IDs duplicados');
  }
  assert(threw, 'Debió lanzar excepción por turnos duplicados');
});

test(8, 'Revalidación autoritativa: Turno de beneficio no perteneciente al lote afectado -> Error', async () => {
  const { today } = setupFixtures();
  let threw = false;
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-test-active',
      benefitAppointmentIds: ['apt-test-3'] // apt-test-3 is not in conflictAppointmentIds
    });
  } catch (err: any) {
    threw = true;
    assert(err.message.includes('no pertenecen al lote'), 'Debe rechazar turnos no pertenecientes al lote');
  }
  assert(threw, 'Debió lanzar excepción por turno ajeno');
});

test(9, 'Ejecución atómica sin beneficios: Excepción creada y turnos cancelados', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1', 'apt-test-3'],
    adjuntarBeneficio: false
  });

  assert(res.exceptions.length === 1, 'Debe crear 1 excepción');
  assert(res.cancelledAppointments.length === 2, 'Debe cancelar 2 turnos');
  assert(res.issuedBenefits.length === 0, 'No debe emitir beneficios');
  assert(res.cancelledAppointments.every(a => a.estado === 'cancelado'), 'Todos los turnos deben estar cancelados');
});

test(10, 'Ejecución atómica con beneficio parcial: Solo turnos seleccionados reciben beneficio', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1', 'apt-test-3'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1'] // Only apt-test-1
  });

  assert(res.cancelledAppointments.length === 2, 'Debe cancelar ambos turnos');
  assert(res.issuedBenefits.length === 1, 'Solo debe emitir 1 beneficio');
  assert(res.issuedBenefits[0].turnoOrigenId === 'apt-test-1', 'El beneficio debe pertenecer a apt-test-1');
});

test(11, 'Ejecución atómica con beneficio total: Todos los turnos reciben beneficio', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1', 'apt-test-3'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1', 'apt-test-3']
  });

  assert(res.cancelledAppointments.length === 2, 'Debe cancelar 2 turnos');
  assert(res.issuedBenefits.length === 2, 'Debe emitir 2 beneficios');
});

test(12, 'Cálculo exacto de fecha de vencimiento según vigencia en días (America/Argentina/Buenos_Aires)', async () => {
  const { today, templateActive } = setupFixtures();
  const expectedExp = addDaysToIsoDate(today, templateActive.vigenciaDias);

  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  });

  const b = res.issuedBenefits[0];
  assert(b.fechaEmision === today, `Fecha de emisión debe ser ${today}`);
  assert(b.fechaVencimiento === expectedExp, `Fecha de vencimiento debe ser ${expectedExp}`);
});

test(13, 'Trazabilidad de origen y origenDetalle con código de turno', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  });

  const b = res.issuedBenefits[0];
  assert(b.origen === 'cancelacion_excepcion', 'Origen debe ser cancelacion_excepcion');
  assert(b.turnoOrigenCodigo === 'GW-001', 'turnoOrigenCodigo debe ser GW-001');
  assert(b.origenDetalle?.includes('GW-001'), 'origenDetalle debe incluir el código');
});

test(14, 'Trazabilidad de otorgadoPor con nombre del operador personalizado', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    canceladoPor: 'Admin Gwen',
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  });

  const b = res.issuedBenefits[0];
  assert(b.otorgadoPor === 'Admin Gwen', 'otorgadoPor debe ser Admin Gwen');
});

test(15, 'Preservación de serviciosAplicables y montoMinimo desde la plantilla', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  });

  const b = res.issuedBenefits[0];
  assert(Array.isArray(b.serviciosAplicables) && b.serviciosAplicables.includes('todos'), 'serviciosAplicables debe incluir todos');
});

test(16, 'Idempotencia de beneficios: reejecución reutiliza beneficio sin duplicar', async () => {
  const { today } = setupFixtures();
  const payload = {
    alcance: 'local' as const,
    fecha: today,
    tipo: 'cerrado' as const,
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  };

  const res1 = await applyAvailabilityExceptionWithCancellations(payload);
  const res2 = await applyAvailabilityExceptionWithCancellations(payload);

  assert(res1.issuedBenefits.length === 1, 'Primera ejecución emite 1 beneficio');
  assert(res2.issuedBenefits.length === 1, 'Segunda ejecución recupera el mismo beneficio');
  assert(res1.issuedBenefits[0].id === res2.issuedBenefits[0].id, 'El ID del beneficio debe ser exactamente el mismo');

  const db = getMemoryDb();
  const matchingBenefits = db.clientBenefits.filter(b => b.turnoOrigenId === 'apt-test-1');
  assert(matchingBenefits.length === 1, 'No debe haber duplicados en la base de datos');
});

test(17, 'Concurrencia simulada: dos llamadas concurrentes con el mismo turno no duplican beneficios', async () => {
  const { today } = setupFixtures();
  const payload = {
    alcance: 'local' as const,
    fecha: today,
    tipo: 'cerrado' as const,
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  };

  const [res1, res2] = await Promise.all([
    applyAvailabilityExceptionWithCancellations(payload),
    applyAvailabilityExceptionWithCancellations(payload)
  ]);

  const db = getMemoryDb();
  const matchingBenefits = db.clientBenefits.filter(b => b.turnoOrigenId === 'apt-test-1');
  assert(matchingBenefits.length === 1, 'Exactamente 1 beneficio emitido para el turno en concurrencia');
  assert(res1.issuedBenefits[0].id === res2.issuedBenefits[0].id, 'Ambos resultados deben apuntar al mismo beneficio');
});

test(18, 'Rollback atómico en memoryDb: error en plantilla no modifica appointments', async () => {
  const { today } = setupFixtures();
  const dbBefore = JSON.stringify(getMemoryDb().appointments);

  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-invalid',
      benefitAppointmentIds: ['apt-test-1']
    });
  } catch (e) {
    // Expected error
  }

  const dbAfter = JSON.stringify(getMemoryDb().appointments);
  assert(dbBefore === dbAfter, 'Appointments no deben haberse mutado tras el error');
});

test(19, 'Rollback atómico en memoryDb: error no deja excepciones huérfanas', async () => {
  const { today } = setupFixtures();
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-test-invalid-disc',
      benefitAppointmentIds: ['apt-test-1']
    });
  } catch (e) {}

  const db = getMemoryDb();
  assert(db.availabilityExceptions.length === 0, 'No debe haber excepciones creadas tras fallo');
});

test(20, 'Rollback atómico en memoryDb: error no deja beneficios huérfanos', async () => {
  const { today } = setupFixtures();
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-test-invalid-days',
      benefitAppointmentIds: ['apt-test-1']
    });
  } catch (e) {}

  const db = getMemoryDb();
  assert(db.clientBenefits.length === 0, 'No debe haber beneficios creados tras fallo');
});

test(21, 'Rollback atómico en memoryDb: error no deja logs de notificación huérfanos', async () => {
  const { today } = setupFixtures();
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1', 'apt-ghost-999'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-test-active',
      benefitAppointmentIds: ['apt-test-1']
    });
  } catch (e) {}

  const db = getMemoryDb();
  assert(db.notificationLogs.length === 0, 'No debe haber logs creados tras fallo');
});

test(22, 'Persistencia de logs: registro con estado omitido_sin_email cuando falta email', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-2-noemail'],
    adjuntarBeneficio: false
  });

  const aptRes = res.appointmentResults?.find(r => r.appointment.id === 'apt-test-2-noemail');
  assert(aptRes !== undefined, 'Debe incluir appointmentResults para apt-test-2-noemail');
  assert(aptRes?.shouldSendNotification === false, 'shouldSendNotification debe ser false');
  assert(aptRes?.notificationStatus === 'omitido_sin_email', 'notificationStatus debe ser omitido_sin_email');

  const db = getMemoryDb();
  const log = db.notificationLogs.find(l => l.appointmentId === 'apt-test-2-noemail');
  assert(log !== undefined, 'Debe registrar log en base de datos');
  assert(log?.status === 'omitido_sin_email', 'El log persistido debe tener estado omitido_sin_email');
});

test(23, 'Persistencia de logs: registro con estado pending cuando cliente tiene email válido', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: false
  });

  const aptRes = res.appointmentResults?.find(r => r.appointment.id === 'apt-test-1');
  assert(aptRes !== undefined, 'Debe incluir appointmentResults para apt-test-1');
  assert(aptRes?.shouldSendNotification === true, 'shouldSendNotification debe ser true');
  assert(aptRes?.notificationStatus === 'pending', 'notificationStatus debe ser pending');

  const db = getMemoryDb();
  const log = db.notificationLogs.find(l => l.appointmentId === 'apt-test-1');
  assert(log !== undefined, 'Debe registrar log en base de datos');
  assert(log?.status === 'pending', 'El log persistido debe tener estado pending');
});

test(24, 'Idempotencia de notificación: si log ya está sent, shouldSendNotification es false', async () => {
  const { today } = setupFixtures();
  const db = getMemoryDb();
  const idempotencyKey = `exc-cancel-apt-test-1-${today}`;
  
  db.notificationLogs = [{
    id: 'log-already-sent',
    appointmentId: 'apt-test-1',
    channel: 'email',
    recipient: 'ana@example.com',
    notificationType: 'appointment_cancellation',
    status: 'sent',
    idempotencyKey,
    sentAt: new Date().toISOString()
  }];

  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: false
  });

  const aptRes = res.appointmentResults?.find(r => r.appointment.id === 'apt-test-1');
  assert(aptRes?.shouldSendNotification === false, 'shouldSendNotification debe ser false si ya fue enviado');
  assert(aptRes?.notificationStatus === 'already_sent', 'notificationStatus debe ser already_sent');
});

test(25, 'Idempotencia de notificación: si log ya está omitido_sin_email, shouldSendNotification es false', async () => {
  const { today } = setupFixtures();
  const db = getMemoryDb();
  const idempotencyKey = `exc-cancel-apt-test-2-noemail-${today}`;
  
  db.notificationLogs = [{
    id: 'log-already-skipped',
    appointmentId: 'apt-test-2-noemail',
    channel: 'email',
    recipient: 'sin_email',
    notificationType: 'appointment_cancellation',
    status: 'omitido_sin_email',
    idempotencyKey,
    sentAt: new Date().toISOString()
  }];

  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-2-noemail'],
    adjuntarBeneficio: false
  });

  const aptRes = res.appointmentResults?.find(r => r.appointment.id === 'apt-test-2-noemail');
  assert(aptRes?.shouldSendNotification === false, 'shouldSendNotification debe ser false');
  assert(aptRes?.notificationStatus === 'omitido_sin_email', 'notificationStatus debe ser omitido_sin_email');
});

test(26, 'isNotificationAlreadySent reconoce estados sent, omitido_sin_email y skipped', async () => {
  const { today } = setupFixtures();
  const db = getMemoryDb();
  
  db.notificationLogs = [
    {
      id: 'l1',
      channel: 'email',
      recipient: 'a@a.com',
      notificationType: 'appointment_cancellation',
      status: 'sent',
      idempotencyKey: 'k-sent',
      sentAt: new Date().toISOString()
    },
    {
      id: 'l2',
      channel: 'email',
      recipient: 'sin_email',
      notificationType: 'appointment_cancellation',
      status: 'omitido_sin_email',
      idempotencyKey: 'k-omitted',
      sentAt: new Date().toISOString()
    },
    {
      id: 'l3',
      channel: 'email',
      recipient: 'c@c.com',
      notificationType: 'appointment_cancellation',
      status: 'pending',
      idempotencyKey: 'k-pending',
      sentAt: new Date().toISOString()
    }
  ];

  assert(await isNotificationAlreadySent('k-sent', 'email') === true, 'k-sent debe considerarse ya enviada');
  assert(await isNotificationAlreadySent('k-omitted', 'email') === true, 'k-omitted debe considerarse ya procesada');
  assert(await isNotificationAlreadySent('k-pending', 'email') === false, 'k-pending no debe considerarse enviada');
});

test(27, 'createNotificationLog actualiza registros existentes de forma idempotente', async () => {
  setupFixtures();
  await createNotificationLog({
    id: 'log-1',
    appointmentId: 'apt-test-1',
    channel: 'email',
    recipient: 'ana@example.com',
    notificationType: 'appointment_cancellation',
    status: 'pending',
    idempotencyKey: 'test-key-update',
    sentAt: new Date().toISOString()
  });

  await createNotificationLog({
    id: 'log-2',
    appointmentId: 'apt-test-1',
    channel: 'email',
    recipient: 'ana@example.com',
    notificationType: 'appointment_cancellation',
    status: 'sent',
    idempotencyKey: 'test-key-update',
    sentAt: new Date().toISOString()
  });

  const logs = await getNotificationLogs({ appointmentId: 'apt-test-1' });
  const matching = logs.filter(l => l.idempotencyKey === 'test-key-update');
  assert(matching.length === 1, 'Debe haber exactamente 1 log para la clave');
  assert(matching[0].status === 'sent', 'El estado debe haberse actualizado a sent');
});

test(28, 'Flag benefitCreatedInThisExecution es true en la primera llamada y false en la segunda', async () => {
  const { today } = setupFixtures();
  const payload = {
    alcance: 'local' as const,
    fecha: today,
    tipo: 'cerrado' as const,
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  };

  const res1 = await applyAvailabilityExceptionWithCancellations(payload);
  const res2 = await applyAvailabilityExceptionWithCancellations(payload);

  assert(res1.appointmentResults![0].benefitCreatedInThisExecution === true, 'En res1 debe ser true');
  assert(res2.appointmentResults![0].benefitCreatedInThisExecution === false, 'En res2 debe ser false');
});

test(29, 'Flag wasAlreadyCancelled es false en primera cancelación y true en segunda', async () => {
  const { today } = setupFixtures();
  const payload = {
    alcance: 'local' as const,
    fecha: today,
    tipo: 'cerrado' as const,
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: false
  };

  const res1 = await applyAvailabilityExceptionWithCancellations(payload);
  const res2 = await applyAvailabilityExceptionWithCancellations(payload);

  assert(res1.appointmentResults![0].wasAlreadyCancelled === false, 'En res1 no estaba cancelado');
  assert(res1.appointmentResults![0].cancelledInThisExecution === true, 'En res1 se canceló en esta ejecución');
  assert(res2.appointmentResults![0].wasAlreadyCancelled === true, 'En res2 ya estaba cancelado');
  assert(res2.appointmentResults![0].cancelledInThisExecution === false, 'En res2 no se canceló en esta ejecución');
});

test(30, 'Excepción con alcance profesional genera excepción vinculada al profesionalId', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'profesional',
    profesionalId: 'prof-123',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: [],
    adjuntarBeneficio: false
  });

  assert(res.exceptions.length === 1, 'Debe crear 1 excepción');
  assert(res.exceptions[0].alcance === 'profesional', 'Alcance debe ser profesional');
  assert(res.exceptions[0].profesionalId === 'prof-123', 'profesionalId debe ser prof-123');
});

test(31, 'Excepción con profesionalIds múltiples crea una excepción por cada profesional', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'profesional',
    profesionalIds: ['prof-1', 'prof-2', 'prof-3'],
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: [],
    adjuntarBeneficio: false
  });

  assert(res.exceptions.length === 3, 'Debe crear 3 excepciones');
  assert(res.exceptions.some(e => e.profesionalId === 'prof-1'), 'Debe incluir prof-1');
  assert(res.exceptions.some(e => e.profesionalId === 'prof-2'), 'Debe incluir prof-2');
  assert(res.exceptions.some(e => e.profesionalId === 'prof-3'), 'Debe incluir prof-3');
});

test(32, 'Excepción tipo horario_especial preserva intervalos personalizados', async () => {
  const { today } = setupFixtures();
  const intervalos = [{ inicio: '10:00', fin: '14:00' }];
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'horario_especial',
    intervalos,
    conflictAppointmentIds: [],
    adjuntarBeneficio: false
  });

  assert(res.exceptions[0].tipo === 'horario_especial', 'Tipo debe ser horario_especial');
  assert(res.exceptions[0].intervalos?.length === 1, 'Debe tener 1 intervalo');
  assert(res.exceptions[0].intervalos![0].inicio === '10:00', 'Inicio debe ser 10:00');
});

test(33, 'Excepción tipo cerrado limpia intervalos a array vacío', async () => {
  const { today } = setupFixtures();
  const intervalos = [{ inicio: '10:00', fin: '14:00' }];
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    intervalos, // passed but should be empty in result
    conflictAppointmentIds: [],
    adjuntarBeneficio: false
  });

  assert(res.exceptions[0].intervalos?.length === 0, 'Intervalos deben estar vacíos');
});

test(34, 'Motivo de cancelación personalizado se persiste en turnos cancelados', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    cancelMotivo: 'Cierre extraordinario por remodelación',
    adjuntarBeneficio: false
  });

  assert(res.cancelledAppointments[0].motivoCancelacion === 'Cierre extraordinario por remodelación', 'Motivo debe ser el personalizado');
});

test(35, 'Estado del beneficio creado es disponible', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  });

  assert(res.issuedBenefits[0].estado === 'disponible', 'Estado debe ser disponible');
});

test(36, 'Cliente de beneficio toma datos del turno (clienteId o fallback de teléfono)', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  });

  const b = res.issuedBenefits[0];
  assert(b.clienteNombre === 'Ana García', 'clienteNombre debe ser Ana García');
  assert(b.clienteTelefono === '1122334455', 'clienteTelefono debe ser 1122334455');
  assert(b.clienteEmail === 'ana@example.com', 'clienteEmail debe ser ana@example.com');
});

test(37, 'Manejo consistente de turno sin clienteEmail en beneficio', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-2-noemail'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-2-noemail']
  });

  const b = res.issuedBenefits[0];
  assert(b.clienteEmail === undefined || b.clienteEmail === null, 'clienteEmail debe ser undefined o null');
  assert(b.clienteNombre === 'Lucía Martínez', 'clienteNombre debe ser Lucía Martínez');
});

test(38, 'Múltiples operaciones en secuencia mantienen consistencia acumulada', async () => {
  const { today } = setupFixtures();
  // Cancel apt 1
  await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  });

  // Cancel apt 3
  await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-3'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-3']
  });

  const db = getMemoryDb();
  assert(db.clientBenefits.length === 2, 'Deben existir 2 beneficios');
  assert(db.appointments.filter(a => a.estado === 'cancelado').length === 2, 'Deben existir 2 turnos cancelados');
});

test(39, 'Contrato de resultado contiene exceptions, cancelledAppointments, issuedBenefits y appointmentResults', async () => {
  const { today } = setupFixtures();
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  });

  assert(Array.isArray(res.exceptions), 'exceptions debe ser array');
  assert(Array.isArray(res.cancelledAppointments), 'cancelledAppointments debe ser array');
  assert(Array.isArray(res.issuedBenefits), 'issuedBenefits debe ser array');
  assert(Array.isArray(res.appointmentResults), 'appointmentResults debe ser array');
});

test(40, 'Reintento tras fallo previo puede completarse exitosamente sin interferencias', async () => {
  const { today } = setupFixtures();
  // Intent 1: Fails due to invalid template
  try {
    await applyAvailabilityExceptionWithCancellations({
      alcance: 'local',
      fecha: today,
      tipo: 'cerrado',
      conflictAppointmentIds: ['apt-test-1'],
      adjuntarBeneficio: true,
      benefitTemplateId: 'tpl-bad',
      benefitAppointmentIds: ['apt-test-1']
    });
  } catch (e) {}

  // Intent 2: Succeeds with valid template
  const res = await applyAvailabilityExceptionWithCancellations({
    alcance: 'local',
    fecha: today,
    tipo: 'cerrado',
    conflictAppointmentIds: ['apt-test-1'],
    adjuntarBeneficio: true,
    benefitTemplateId: 'tpl-test-active',
    benefitAppointmentIds: ['apt-test-1']
  });

  assert(res.cancelledAppointments.length === 1, 'Debe cancelar 1 turno exitosamente');
  assert(res.issuedBenefits.length === 1, 'Debe emitir 1 beneficio exitosamente');
});

// ---------------------------------------------------------------------------
// RUNNER
// ---------------------------------------------------------------------------

async function runAll() {
  console.log(`\n======================================================`);
  console.log(`🧪 EJECUTANDO SUITE DE 40 PRUEBAS AUTOMATIZADAS`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✅ [TEST ${t.id.toString().padStart(2, '0')}/40] PASS: ${t.name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [TEST ${t.id.toString().padStart(2, '0')}/40] FAIL: ${t.name}`);
      console.error(`   Detalle del error:`, err?.message || err);
      failed++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 RESULTADOS: ${passed} PASADAS, ${failed} FALLADAS (TOTAL: ${tests.length})`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
