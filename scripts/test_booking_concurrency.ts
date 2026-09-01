import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('INICIANDO SUITE DE PRUEBAS DE CONCURRENCIA Y NO-STACKING');
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${msg}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      failedCount++;
    }
  }

  // 0. Setup: Verificar estado del servidor y datos base
  const servicesRes = await fetch(`${BASE_URL}/api/servicios`);
  const services = (await servicesRes.json()) as any[];
  const testService = services[0];
  console.log(`Servicio de prueba: ${testService.nombre} (ID: ${testService.id}, Precio: $${testService.precio})`);

  const profsRes = await fetch(`${BASE_URL}/api/profesionales`);
  const professionals = (await profsRes.json()) as any[];
  const testProf = professionals[0];
  console.log(`Profesional de prueba: ${testProf.nombre} ${testProf.apellido} (ID: ${testProf.id})\n`);

  async function getSlots(dateStr: string): Promise<string[]> {
    const availRes = await fetch(`${BASE_URL}/api/availability?date=${dateStr}&service_id=${testService.id}&profesional_id=${testProf.id}`);
    if (availRes.ok) {
      const avail = (await availRes.json()) as any;
      if (avail.abierto && avail.slots) {
        return avail.slots.filter((s: any) => s.disponible).map((s: any) => s.hora || s.horaInicio);
      }
    }
    return ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
  }

  // =========================================================================
  // BLOQUE 1: PRUEBAS DE NO-STACKING Y RECHAZO EXPLÍCITO (HTTP 400)
  // =========================================================================
  console.log('----------------------------------------------------------------');
  console.log('BLOQUE 1: VALIDACIÓN EXPLICITA DE NO-STACKING (RECHAZO HTTP 400)');
  console.log('----------------------------------------------------------------');

  const testPromoCode = `TEST_STACK_${Date.now()}`;
  const createPromoRes = await fetch(`${BASE_URL}/api/promociones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigo: testPromoCode,
      nombre: 'Promo Test No Stacking',
      tipoDescuento: 'porcentaje',
      valorDescuento: 20,
      fechaInicio: '2020-01-01',
      activo: true,
      serviciosAplicables: ['todos']
    })
  });
  const createdPromo = (await createPromoRes.json()) as any;
  assert(createPromoRes.status === 201, `Promo creada para tests: ${testPromoCode}`);

  const testClientPhone = `1199${Math.floor(100000 + Math.random() * 900000)}`;
  const createClientRes = await fetch(`${BASE_URL}/api/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'Valeria',
      apellido: 'NoStacking',
      telefono: testClientPhone
    })
  });
  const createdClient = (await createClientRes.json()) as any;

  const createBenefitRes = await fetch(`${BASE_URL}/api/beneficios-cliente`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteId: createdClient.id,
      titulo: 'Beneficio No Stacking 15%',
      tipoDescuento: 'porcentaje',
      valorDescuento: 15,
      origen: 'admin',
      fechaEmision: '2026-01-01'
    })
  });
  const createdBenefit = (await createBenefitRes.json()) as any;
  assert(createBenefitRes.status === 201, `Beneficio creado para tests (ID: ${createdBenefit.id})`);

  const date1 = '2026-10-06';
  const slots1 = await getSlots(date1);

  // Caso 1: descuentoCodigo + clientBenefitId
  const stackPayload1 = {
    nombre: 'Valeria',
    apellido: 'NoStacking',
    telefono: testClientPhone,
    servicio_id: testService.id,
    profesional_id: testProf.id,
    fecha: date1,
    hora_inicio: slots1[0] || '10:00',
    descuentoCodigo: testPromoCode,
    clientBenefitId: createdBenefit.id
  };
  const res1 = await fetch(`${BASE_URL}/api/turnos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stackPayload1)
  });
  const data1 = (await res1.json()) as any;
  assert(res1.status === 400, `Caso 1 (descuentoCodigo + clientBenefitId) -> HTTP 400 (obtenido ${res1.status})`);
  assert(data1.error?.includes('No se puede aplicar una promoción y un beneficio individual'), `Caso 1 error correcto: "${data1.error}"`);

  // Caso 2: descuentoCodigo + descuentoId con descuentoTipo: 'beneficio'
  const stackPayload2 = {
    nombre: 'Valeria',
    apellido: 'NoStacking',
    telefono: testClientPhone,
    servicio_id: testService.id,
    profesional_id: testProf.id,
    fecha: date1,
    hora_inicio: slots1[0] || '10:00',
    descuentoCodigo: testPromoCode,
    descuentoId: createdBenefit.id,
    descuentoTipo: 'beneficio'
  };
  const res2 = await fetch(`${BASE_URL}/api/turnos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stackPayload2)
  });
  assert(res2.status === 400, `Caso 2 (descuentoCodigo + descuentoId/beneficio) -> HTTP 400 (obtenido ${res2.status})`);

  // Caso 3: promocionId + beneficioId
  const stackPayload3 = {
    nombre: 'Valeria',
    apellido: 'NoStacking',
    telefono: testClientPhone,
    servicio_id: testService.id,
    profesional_id: testProf.id,
    fecha: date1,
    hora_inicio: slots1[0] || '10:00',
    promocionId: createdPromo.id,
    beneficioId: createdBenefit.id
  };
  const res3 = await fetch(`${BASE_URL}/api/turnos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stackPayload3)
  });
  assert(res3.status === 400, `Caso 3 (promocionId + beneficioId) -> HTTP 400`);

  // Caso 4: descuentoCodigo válido + beneficio inválido/inexistente
  const stackPayload4 = {
    nombre: 'Valeria',
    apellido: 'NoStacking',
    telefono: testClientPhone,
    servicio_id: testService.id,
    profesional_id: testProf.id,
    fecha: date1,
    hora_inicio: slots1[0] || '10:00',
    descuentoCodigo: testPromoCode,
    clientBenefitId: 'ben-inexistente-9999'
  };
  const res4 = await fetch(`${BASE_URL}/api/turnos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stackPayload4)
  });
  assert(res4.status === 400, `Caso 4 (promo válida + beneficio inexistente) -> HTTP 400 rechazo por stacking`);

  // Caso 5: descuentoCodigo inválido + beneficio válido
  const stackPayload5 = {
    nombre: 'Valeria',
    apellido: 'NoStacking',
    telefono: testClientPhone,
    servicio_id: testService.id,
    profesional_id: testProf.id,
    fecha: date1,
    hora_inicio: slots1[0] || '10:00',
    descuentoCodigo: 'PROMO_INEXISTENTE_XYZ',
    clientBenefitId: createdBenefit.id
  };
  const res5 = await fetch(`${BASE_URL}/api/turnos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stackPayload5)
  });
  assert(res5.status === 400, `Caso 5 (promo inexistente + beneficio válido) -> HTTP 400 rechazo por stacking`);

  // Caso 6: descuentoCodigo con espacios "   " + beneficio válido -> DEBE ACEPTARSE como solo beneficio
  const freshSlots1 = await getSlots(date1);
  const validSlotFor6 = freshSlots1[0] || '10:00';
  const stackPayload6 = {
    nombre: 'Valeria',
    apellido: 'NoStacking',
    telefono: testClientPhone,
    servicio_id: testService.id,
    profesional_id: testProf.id,
    fecha: date1,
    hora_inicio: validSlotFor6,
    descuentoCodigo: '   ',
    descuentoId: createdBenefit.id,
    descuentoTipo: 'beneficio'
  };
  const check6 = await fetch(`${BASE_URL}/api/turnos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stackPayload6)
  });
  const data6 = (await check6.json()) as any;
  assert(check6.status === 201, `Caso 6 (descuentoCodigo: '   ' + beneficio válido) -> Aceptado HTTP 201 (obtenido ${check6.status})`);
  assert(data6.turno?.descuentoTipo === 'beneficio', `Caso 6 turno creado con descuentoTipo: 'beneficio'`);

  // Verificar estado del beneficio tras uso legítimo
  const checkBenefitUsedRes = await fetch(`${BASE_URL}/api/beneficios-cliente/${createdBenefit.id}`);
  const benefitAfterUse = (await checkBenefitUsedRes.json()) as any;
  assert(benefitAfterUse.estado === 'usado', `Beneficio quedó en estado 'usado' tras uso legítimo`);

  // Verificar que la promoción NO fue consumida
  const checkPromoRes = await fetch(`${BASE_URL}/api/promociones/${createdPromo.id}`);
  const promoAfter = (await checkPromoRes.json()) as any;
  assert(promoAfter.usosActuales === 0, `Promoción no consumida (usosActuales: ${promoAfter.usosActuales})`);

  console.log('\n================================================================');
  console.log('BLOQUE 2: PRUEBAS DINÁMICAS DE CONCURRENCIA (PROMISE.ALL)');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST A: Último uso disponible de promoción (Límite total = 1)
  // -------------------------------------------------------------------------
  console.log('--- CONCURRENCY TEST A: Límite total de usos = 1 (2 requests simultáneos) ---');
  const promoLimit1Code = `LIMIT1_${Date.now()}`;
  await fetch(`${BASE_URL}/api/promociones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigo: promoLimit1Code,
      nombre: 'Promo 1 Solo Uso Total',
      tipoDescuento: 'porcentaje',
      valorDescuento: 25,
      fechaInicio: '2020-01-01',
      limiteTotalUsos: 1,
      activo: true,
      serviciosAplicables: ['todos']
    })
  });

  const dateA = '2026-10-07';
  const slotsA = await getSlots(dateA);
  const [resA1, resA2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Cliente A1',
        apellido: 'Test',
        telefono: '1144001101',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateA,
        hora_inicio: slotsA[0] || '10:00',
        descuentoCodigo: promoLimit1Code
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Cliente A2',
        apellido: 'Test',
        telefono: '1144001102',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateA,
        hora_inicio: slotsA[1] || '11:00',
        descuentoCodigo: promoLimit1Code
      })
    })
  ]);

  const statusesA = [resA1.status, resA2.status];
  const successCountA = statusesA.filter(s => s === 201).length;
  const failCountA = statusesA.filter(s => s === 400 || s === 409).length;

  assert(successCountA === 1, `Exactamente 1 solicitud tuvo éxito (201). Obtenido: ${successCountA}`);
  assert(failCountA === 1, `Exactamente 1 solicitud fue rechazada por límite alcanzado (400/409). Obtenido: ${failCountA}`);

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST B: Límite por cliente = 1 (2 requests simultáneos de la misma clienta)
  // -------------------------------------------------------------------------
  console.log('\n--- CONCURRENCY TEST B: Límite por cliente = 1 (2 requests simultáneos de misma clienta) ---');
  const promoPerClientCode = `PERCLIENT_${Date.now()}`;
  await fetch(`${BASE_URL}/api/promociones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigo: promoPerClientCode,
      nombre: 'Promo 1 Uso Por Cliente',
      tipoDescuento: 'monto_fijo',
      valorDescuento: 2000,
      fechaInicio: '2020-01-01',
      limiteUsoPorCliente: 1,
      limiteTotalUsos: 10,
      activo: true,
      serviciosAplicables: ['todos']
    })
  });

  const sameClientPhone = `1188${Math.floor(100000 + Math.random() * 900000)}`;
  await fetch(`${BASE_URL}/api/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'Lucia',
      apellido: 'SameClient',
      telefono: sameClientPhone
    })
  });

  const dateB = '2026-10-08';
  const slotsB = await getSlots(dateB);

  const [resB1, resB2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Lucia',
        apellido: 'SameClient',
        telefono: sameClientPhone,
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateB,
        hora_inicio: slotsB[0] || '10:00',
        descuentoCodigo: promoPerClientCode
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Lucia',
        apellido: 'SameClient',
        telefono: sameClientPhone,
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateB,
        hora_inicio: slotsB[1] || '11:00',
        descuentoCodigo: promoPerClientCode
      })
    })
  ]);

  const statusesB = [resB1.status, resB2.status];
  const successCountB = statusesB.filter(s => s === 201).length;
  const failCountB = statusesB.filter(s => s === 400 || s === 409).length;

  assert(successCountB === 1, `Exactamente 1 solicitud tuvo éxito (201). Obtenido: ${successCountB}`);
  assert(failCountB === 1, `Exactamente 1 solicitud fue rechazada por límite por clienta (400/409). Obtenido: ${failCountB}`);

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST C: Reclamación concurrente del mismo beneficio individual
  // -------------------------------------------------------------------------
  console.log('\n--- CONCURRENCY TEST C: Mismo beneficio individual (2 requests simultáneos) ---');
  const clientCPhone = `1177${Math.floor(100000 + Math.random() * 900000)}`;
  const clientCRes = await fetch(`${BASE_URL}/api/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'Camila',
      apellido: 'BeneficioTest',
      telefono: clientCPhone
    })
  });
  const clientC = (await clientCRes.json()) as any;

  const benCRes = await fetch(`${BASE_URL}/api/beneficios-cliente`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteId: clientC.id,
      titulo: 'Compensación Única 20%',
      tipoDescuento: 'porcentaje',
      valorDescuento: 20,
      origen: 'compensacion',
      fechaEmision: '2026-01-01'
    })
  });
  const benC = (await benCRes.json()) as any;

  const dateC = '2026-10-09';
  const slotsC = await getSlots(dateC);
  const [resC1, resC2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Camila',
        apellido: 'BeneficioTest',
        telefono: clientCPhone,
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateC,
        hora_inicio: slotsC[0] || '10:00',
        descuentoTipo: 'beneficio',
        descuentoId: benC.id
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Camila',
        apellido: 'BeneficioTest',
        telefono: clientCPhone,
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateC,
        hora_inicio: slotsC[1] || '11:00',
        descuentoTipo: 'beneficio',
        descuentoId: benC.id
      })
    })
  ]);

  const statusesC = [resC1.status, resC2.status];
  const successCountC = statusesC.filter(s => s === 201).length;
  const failCountC = statusesC.filter(s => s === 400 || s === 409).length;

  assert(successCountC === 1, `Exactamente 1 solicitud consumió el beneficio (201). Obtenido: ${successCountC}`);
  assert(failCountC === 1, `Exactamente 1 solicitud fue rechazada porque ya no estaba disponible (400/409). Obtenido: ${failCountC}`);

  const checkBenC = (await (await fetch(`${BASE_URL}/api/beneficios-cliente/${benC.id}`)).json()) as any;
  assert(checkBenC.estado === 'usado', `Beneficio quedó en estado 'usado' tras consumo concurrente`);

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST D: Colisión de turno en el mismo horario y profesional (HTTP 409)
  // -------------------------------------------------------------------------
  console.log('\n--- CONCURRENCY TEST D: Colisión de turno mismo horario/profesional (2 requests simultáneos) ---');
  const dateD = '2026-10-13';
  const slotsD = await getSlots(dateD);
  const targetSlotD = slotsD[0] || '10:00';

  const [resD1, resD2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Clienta D1',
        apellido: 'Test',
        telefono: '1133001101',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateD,
        hora_inicio: targetSlotD
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Clienta D2',
        apellido: 'Test',
        telefono: '1133001102',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateD,
        hora_inicio: targetSlotD
      })
    })
  ]);

  const statusesD = [resD1.status, resD2.status];
  const successCountD = statusesD.filter(s => s === 201).length;
  const conflictCountD = statusesD.filter(s => s === 409).length;

  assert(successCountD === 1, `Exactamente 1 turno creado en el slot (201). Obtenido: ${successCountD}`);
  assert(conflictCountD === 1, `Exactamente 1 solicitud rechazada por conflicto de horario (409). Obtenido: ${conflictCountD}`);

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST E: Intento concurrente de combinar promoción y beneficio (No-Stacking)
  // -------------------------------------------------------------------------
  console.log('\n--- CONCURRENCY TEST E: Ataque concurrente No-Stacking (2 requests con payload stacked) ---');
  const dateE = '2026-10-14';
  const slotsE = await getSlots(dateE);

  const [resE1, resE2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Hacker E1',
        apellido: 'Test',
        telefono: '1122001101',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateE,
        hora_inicio: slotsE[0] || '10:00',
        descuentoCodigo: promoLimit1Code,
        clientBenefitId: 'ben-qualquiera'
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Hacker E2',
        apellido: 'Test',
        telefono: '1122001102',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateE,
        hora_inicio: slotsE[1] || '11:00',
        descuentoCodigo: promoLimit1Code,
        clientBenefitId: 'ben-qualquiera'
      })
    })
  ]);

  assert(resE1.status === 400 && resE2.status === 400, `Ambas solicitudes de stacking concurrente rechazadas con HTTP 400 (${resE1.status}, ${resE2.status})`);

  // -------------------------------------------------------------------------
  // CONCURRENCY SCENARIOS (CASOS 1 A 12 DE CONCURRENCIA Y SOLAPAMIENTO)
  // -------------------------------------------------------------------------
  console.log('\n--- CASO 1: Inicio idéntico (10:00–11:00 vs 10:00–11:00) ---');
  const dateC1 = '2026-12-01'; // Martes (Abierto)
  const [resC1_1, resC1_2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C1 User A',
        apellido: 'Test',
        telefono: '1144001001',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateC1,
        hora_inicio: '10:00'
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C1 User B',
        apellido: 'Test',
        telefono: '1144001002',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateC1,
        hora_inicio: '10:00'
      })
    })
  ]);
  const statusesC1 = [resC1_1.status, resC1_2.status];
  assert(statusesC1.filter(s => s === 201).length === 1, `Caso 1: Exactamente 1 exitoso (201). Obtenido: ${statusesC1.join(', ')}`);
  assert(statusesC1.filter(s => s === 409).length === 1, `Caso 1: Exactamente 1 rechazado por conflicto (409)`);

  console.log('\n--- CASO 2: Inicio diferente con solapamiento parcial (10:00–11:00 vs 10:30–11:30) ---');
  const dateC2 = '2026-12-02'; // Miércoles (Abierto)
  const [resC2_1, resC2_2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C2 User A',
        apellido: 'Test',
        telefono: '1144002001',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateC2,
        hora_inicio: '10:00'
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C2 User B',
        apellido: 'Test',
        telefono: '1144002002',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateC2,
        hora_inicio: '10:30'
      })
    })
  ]);
  const statusesC2 = [resC2_1.status, resC2_2.status];
  assert(statusesC2.filter(s => s === 201).length === 1, `Caso 2: Exactamente 1 turno persistido (201) en solapamiento parcial`);
  assert(statusesC2.filter(s => s === 409).length === 1, `Caso 2: Exactamente 1 solicitud rechazada con HTTP 409`);

  console.log('\n--- CASO 3: Contención inversa (10:30–11:30 vs 10:00–11:00) ---');
  const dateC3 = '2026-12-03'; // Jueves (Abierto)
  const [resC3_1, resC3_2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C3 User A (10:30)',
        apellido: 'Test',
        telefono: '1144003001',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateC3,
        hora_inicio: '10:30'
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C3 User B (10:00)',
        apellido: 'Test',
        telefono: '1144003002',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateC3,
        hora_inicio: '10:00'
      })
    })
  ]);
  const statusesC3 = [resC3_1.status, resC3_2.status];
  assert(statusesC3.filter(s => s === 201).length === 1, `Caso 3: Contención inversa segura (1 éxito 201)`);
  assert(statusesC3.filter(s => s === 409).length === 1, `Caso 3: Contención inversa rechaza la solapada (1 conflicto 409)`);

  console.log('\n--- CASO 4: Un turno contiene al otro (Servicio largo 120min 10:00–12:00 vs 10:30–11:30) ---');
  const esculpidaService = services.find(s => s.duracionMinutos >= 90) || testService;
  const dateC4 = '2026-12-04'; // Viernes (Abierto)
  const [resC4_1, resC4_2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C4 Long Service',
        apellido: 'Test',
        telefono: '1144004001',
        servicio_id: esculpidaService.id,
        profesional_id: testProf.id,
        fecha: dateC4,
        hora_inicio: '10:00'
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C4 Contained Service',
        apellido: 'Test',
        telefono: '1144004002',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateC4,
        hora_inicio: '10:30'
      })
    })
  ]);
  const statusesC4 = [resC4_1.status, resC4_2.status];
  assert(statusesC4.filter(s => s === 201).length === 1, `Caso 4: Un turno contiene al otro -> Solo 1 persistido`);
  assert(statusesC4.filter(s => s === 409).length === 1, `Caso 4: Turno contenido o continente concurrentemente rechazado`);

  console.log('\n--- CASO 5: Solapamiento por extremo (Servicio 90min 10:00–11:30 vs Servicio 60min 11:00–12:00) ---');
  const dateC5 = '2026-12-07'; // Lunes (Abierto)
  const [resC5_1, resC5_2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C5 Long Service',
        apellido: 'Test',
        telefono: '1144005001',
        servicio_id: esculpidaService.id,
        profesional_id: testProf.id,
        fecha: dateC5,
        hora_inicio: '10:00'
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C5 End Overlap',
        apellido: 'Test',
        telefono: '1144005002',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateC5,
        hora_inicio: '11:00'
      })
    })
  ]);
  const statusesC5 = [resC5_1.status, resC5_2.status];
  assert(statusesC5.filter(s => s === 201).length === 1, `Caso 5: Solapamiento extremo -> Solo 1 persistido`);
  assert(statusesC5.filter(s => s === 409).length === 1, `Caso 5: Solapamiento extremo -> 1 conflicto 409`);

  console.log('\n--- CASO 6: Límite exacto permitido (10:00–11:00 vs 11:00–12:00 sin buffer) ---');
  const dateC6 = '2026-12-08'; // Martes (Abierto)
  const resC6_1 = await fetch(`${BASE_URL}/api/turnos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'C6 Slot 1',
      apellido: 'Test',
      telefono: '1144006001',
      servicio_id: testService.id,
      profesional_id: testProf.id,
      fecha: dateC6,
      hora_inicio: '10:00'
    })
  });
  const resC6_2 = await fetch(`${BASE_URL}/api/turnos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'C6 Slot 2',
      apellido: 'Test',
      telefono: '1144006002',
      servicio_id: testService.id,
      profesional_id: testProf.id,
      fecha: dateC6,
      hora_inicio: '11:00'
    })
  });
  assert(resC6_1.status === 201 && resC6_2.status === 201, `Caso 6: Contacto exacto contiguo permitido (ambos 201)`);

  console.log('\n--- CASO 9: Profesionales diferentes en el mismo horario ---');
  if (professionals.length >= 2) {
    const prof2 = professionals[1];
    const dateC9 = '2026-12-09';
    const [resC9_1, resC9_2] = await Promise.all([
      fetch(`${BASE_URL}/api/turnos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: 'C9 Prof 1',
          apellido: 'Test',
          telefono: '1144009001',
          servicio_id: testService.id,
          profesional_id: testProf.id,
          fecha: dateC9,
          hora_inicio: '10:00'
        })
      }),
      fetch(`${BASE_URL}/api/turnos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: 'C9 Prof 2',
          apellido: 'Test',
          telefono: '1144009002',
          servicio_id: testService.id,
          profesional_id: prof2.id,
          fecha: dateC9,
          hora_inicio: '10:00'
        })
      })
    ]);
    assert(resC9_1.status === 201 && resC9_2.status === 201, `Caso 9: Profesionales diferentes concurrentes en el mismo horario (ambos 201)`);
  } else {
    console.log('  ℹ️ Caso 9 omitido: solo 1 profesional disponible');
  }

  console.log('\n--- CASO 10: Fechas diferentes en el mismo horario y profesional ---');
  const [resC10_1, resC10_2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C10 Date 1',
        apellido: 'Test',
        telefono: '1144010001',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: '2026-12-10',
        hora_inicio: '10:00'
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C10 Date 2',
        apellido: 'Test',
        telefono: '1144010002',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: '2026-12-11',
        hora_inicio: '10:00'
      })
    })
  ]);
  assert(resC10_1.status === 201 && resC10_2.status === 201, `Caso 10: Fechas diferentes concurrentes sin bloqueo cruzado (ambos 201)`);

  console.log('\n--- CASO 11: Turno cancelado previo no bloquea nuevo turno ---');
  const dateC11 = '2026-12-14'; // Lunes (Abierto)
  const createForCancelRes = await fetch(`${BASE_URL}/api/turnos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'To Be Cancelled',
      apellido: 'Test',
      telefono: '1144011001',
      servicio_id: testService.id,
      profesional_id: testProf.id,
      fecha: dateC11,
      hora_inicio: '10:00'
    })
  });
  const createdForCancel = (await createForCancelRes.json()) as any;
  assert(createForCancelRes.status === 201, `Turno para cancelar creado exitosamente (201)`);

  // Cancel the appointment using POST /api/turnos/:id/cancel
  const cancelRes = await fetch(`${BASE_URL}/api/turnos/${createdForCancel.turno.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo: 'Cancelado para test' })
  });
  assert(cancelRes.status === 200, `Turno cancelado exitosamente`);

  const resC11_new = await fetch(`${BASE_URL}/api/turnos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'New User Reoccupying',
      apellido: 'Test',
      telefono: '1144011002',
      servicio_id: testService.id,
      profesional_id: testProf.id,
      fecha: dateC11,
      hora_inicio: '10:00'
    })
  });
  assert(resC11_new.status === 201, `Caso 11: Turno cancelado previo permite nueva reserva en el mismo horario (201)`);

  console.log('\n--- CASO 12: Tres solicitudes simultáneas solapadas (10:00, 10:30, 11:00) ---');
  const dateC12 = '2026-12-15'; // Martes (Abierto)
  const [resC12_1, resC12_2, resC12_3] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C12 User 1 (120min)',
        apellido: 'Test',
        telefono: '1144012001',
        servicio_id: esculpidaService.id, // 10:00 - 12:00
        profesional_id: testProf.id,
        fecha: dateC12,
        hora_inicio: '10:00'
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C12 User 2 (60min)',
        apellido: 'Test',
        telefono: '1144012002',
        servicio_id: testService.id, // 10:30 - 11:30
        profesional_id: testProf.id,
        fecha: dateC12,
        hora_inicio: '10:30'
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'C12 User 3 (60min)',
        apellido: 'Test',
        telefono: '1144012003',
        servicio_id: testService.id, // 11:00 - 12:00
        profesional_id: testProf.id,
        fecha: dateC12,
        hora_inicio: '11:00'
      })
    })
  ]);
  const statusesC12 = [resC12_1.status, resC12_2.status, resC12_3.status];
  assert(statusesC12.filter(s => s === 201).length >= 1 && statusesC12.filter(s => s === 201).length <= 2, `Caso 12: Solo el conjunto compatible se persiste. Estados: ${statusesC12.join(', ')}`);
  assert(statusesC12.filter(s => s === 409).length >= 1, `Caso 12: Las solicitudes en conflicto solapado reciben HTTP 409`);

  console.log('\n--- CASO ROLLBACK CON DESCUENTO EN COLISIÓN PARCIAL ---');
  const promoRollbackCode = `ROLLBACK_PROMO_${Date.now()}`;
  await fetch(`${BASE_URL}/api/promociones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigo: promoRollbackCode,
      nombre: 'Promo Rollback Test',
      tipoDescuento: 'porcentaje',
      valorDescuento: 20,
      fechaInicio: '2020-01-01',
      limiteTotalUsos: 10,
      activo: true,
      serviciosAplicables: ['todos']
    })
  });

  const dateRollback = '2026-12-16'; // Miércoles (Abierto)
  const [resRb1, resRb2] = await Promise.all([
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Winner User',
        apellido: 'Test',
        telefono: '1144014001',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateRollback,
        hora_inicio: '10:00'
      })
    }),
    fetch(`${BASE_URL}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Loser User with Promo',
        apellido: 'Test',
        telefono: '1144014002',
        servicio_id: testService.id,
        profesional_id: testProf.id,
        fecha: dateRollback,
        hora_inicio: '10:30',
        descuentoCodigo: promoRollbackCode
      })
    })
  ]);

  const allPromos = (await (await fetch(`${BASE_URL}/api/promociones`)).json()) as any[];
  const promoAfterConflict = allPromos.find(p => p.codigo === promoRollbackCode);
  if (resRb2.status === 409) {
    assert(promoAfterConflict.usosActuales === 0, `Rollback exitoso: Solicitud perdedora (409) NO consumió el cupón (usosActuales: 0)`);
  } else if (resRb1.status === 409) {
    // resRb2 won and used 1
    assert(promoAfterConflict.usosActuales === 1, `Rollback verificado: Ganó solicitud con promo (usosActuales: 1)`);
  }

  console.log('\n================================================================');
  console.log(`RESUMEN FINAL DE PRUEBAS: ${passedCount} PASADAS, ${failedCount} FALLADAS`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Error fatal durante la ejecución de pruebas:', err);
  process.exit(1);
});
