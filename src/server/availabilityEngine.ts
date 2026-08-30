import type {
  Service,
  Appointment,
  StudioConfig,
  DayAvailability,
  TimeSlot,
  TimeInterval,
  ScheduleConfig,
  AvailabilityException,
  Professional,
  AvailableProfessionalSummary,
  WeekScheduleMap,
  DayOfWeekKey,
  ScheduleScope,
  AvailabilityExceptionType
} from '../types.js';
import {
  getServices,
  getStudioConfig,
  getAppointments,
  getProfessionals,
  getProfessionalsForService,
  isProfessionalHabilitated,
  getScheduleForDate,
  getAvailabilityExceptions,
  defaultWeeklySchedule
} from './db.js';

// Utility: convert HH:mm to minutes from midnight
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

// Utility: convert minutes from midnight to HH:mm
export function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, minutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const dayKeys = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const;
const dayNamesEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Normalizes and merges overlapping or contiguous time intervals.
 */
export function normalizeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (!intervals || intervals.length === 0) return [];

  const minuteRanges = intervals
    .map(i => ({ start: timeToMinutes(i.inicio), end: timeToMinutes(i.fin) }))
    .filter(r => r.start < r.end)
    .sort((a, b) => a.start - b.start);

  if (minuteRanges.length === 0) return [];

  const merged: Array<{ start: number; end: number }> = [minuteRanges[0]];

  for (let i = 1; i < minuteRanges.length; i++) {
    const current = minuteRanges[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged.map(m => ({
    inicio: minutesToTime(m.start),
    fin: minutesToTime(m.end)
  }));
}

/**
 * Finds which portions of the requested intervals are NOT covered by the available intervals.
 */
export function findUncoveredIntervals(
  requested: TimeInterval[],
  available: TimeInterval[]
): TimeInterval[] {
  const normReq = normalizeIntervals(requested);
  const normAvail = normalizeIntervals(available);
  if (normReq.length === 0) return [];
  if (normAvail.length === 0) return normReq;

  const uncovered: Array<{ start: number; end: number }> = [];

  for (const req of normReq) {
    let reqSegments: Array<{ start: number; end: number }> = [
      { start: timeToMinutes(req.inicio), end: timeToMinutes(req.fin) }
    ];

    for (const avail of normAvail) {
      const aStart = timeToMinutes(avail.inicio);
      const aEnd = timeToMinutes(avail.fin);
      const newSegments: Array<{ start: number; end: number }> = [];

      for (const seg of reqSegments) {
        if (seg.end <= aStart || seg.start >= aEnd) {
          newSegments.push(seg);
        } else {
          if (seg.start < aStart) {
            newSegments.push({ start: seg.start, end: aStart });
          }
          if (seg.end > aEnd) {
            newSegments.push({ start: aEnd, end: seg.end });
          }
        }
      }
      reqSegments = newSegments;
    }

    uncovered.push(...reqSegments);
  }

  const merged = uncovered.filter(u => u.start < u.end).sort((a, b) => a.start - b.start);
  return merged.map(m => ({
    inicio: minutesToTime(m.start),
    fin: minutesToTime(m.end)
  }));
}

/**
 * Calculates the geometric intersection between two sets of time intervals.
 * (e.g. Studio open intervals intersected with Professional working intervals).
 */
export function intersectIntervals(
  setA: TimeInterval[],
  setB: TimeInterval[]
): TimeInterval[] {
  const result: TimeInterval[] = [];

  for (const a of setA) {
    const aStart = timeToMinutes(a.inicio);
    const aEnd = timeToMinutes(a.fin);

    for (const b of setB) {
      const bStart = timeToMinutes(b.inicio);
      const bEnd = timeToMinutes(b.fin);

      const overlapStart = Math.max(aStart, bStart);
      const overlapEnd = Math.min(aEnd, bEnd);

      if (overlapStart < overlapEnd) {
        result.push({
          inicio: minutesToTime(overlapStart),
          fin: minutesToTime(overlapEnd)
        });
      }
    }
  }

  return normalizeIntervals(result);
}

/**
 * Returns the effective schedule of the studio/local for a specific date,
 * respecting:
 * 1. Studio Availability Exceptions (if any exception exists for that date).
 * 2. Versioned Weekly Schedule active at that date.
 * 3. Studio detailed full-day blocks / legacy blocked days.
 */
export async function getEffectiveStudioSchedule(dateStr: string): Promise<{
  abierto: boolean;
  intervalos: TimeInterval[];
  motivo?: string;
  isException: boolean;
}> {
  // Check Studio Availability Exceptions for date
  const exceptions = await getAvailabilityExceptions({ fecha: dateStr, alcance: 'local' });
  if (exceptions.length > 0) {
    const exc = exceptions[0];
    if (exc.tipo === 'cerrado') {
      return {
        abierto: false,
        intervalos: [],
        motivo: exc.motivo || 'Cerrado por excepción de disponibilidad del local.',
        isException: true
      };
    } else {
      return {
        abierto: true,
        intervalos: normalizeIntervals(exc.intervalos || []),
        motivo: exc.motivo,
        isException: true
      };
    }
  }



  // Calculate day of week
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const dayOfWeekIndex = targetDate.getDay();
  const dayKey = dayKeys[dayOfWeekIndex];

  // Retrieve versioned schedule for studio at target date
  const versionedSchedule = await getScheduleForDate('local', undefined, dateStr);
  if (versionedSchedule && versionedSchedule.dias && versionedSchedule.dias[dayKey]) {
    const dayConfig = versionedSchedule.dias[dayKey];
    if (!dayConfig.abierto || !dayConfig.intervalos || dayConfig.intervalos.length === 0) {
      return {
        abierto: false,
        intervalos: [],
        motivo: 'Cerrado según cronograma semanal del local.',
        isException: false
      };
    }
    return {
      abierto: true,
      intervalos: normalizeIntervals(dayConfig.intervalos),
      isException: false
    };
  }

  // Fallback to StudioConfig horariosPorDia (single interval legacy mapping)
  const studioConfig = await getStudioConfig();
  const legacyDay = studioConfig.horariosPorDia[dayKey];
  if (!legacyDay || !legacyDay.activo) {
    return {
      abierto: false,
      intervalos: [],
      motivo: 'Cerrado según cronograma del salón.',
      isException: false
    };
  }

  return {
    abierto: true,
    intervalos: [{ inicio: legacyDay.apertura, fin: legacyDay.cierre }],
    isException: false
  };
}

/**
 * Returns the effective schedule of a professional for a specific date,
 * respecting:
 * 1. Professional Availability Exceptions for that date.
 * 2. Versioned Weekly Schedule for that professional at that date.
 * 3. Fallback to studio schedule if professional has no custom weekly schedule.
 */
export async function getEffectiveProfessionalSchedule(
  profesionalId: string,
  dateStr: string
): Promise<{
  abierto: boolean;
  intervalos: TimeInterval[];
  motivo?: string;
  isException: boolean;
}> {
  // Check Professional Availability Exceptions for date
  const exceptions = await getAvailabilityExceptions({ fecha: dateStr, alcance: 'profesional', profesionalId });
  if (exceptions.length > 0) {
    const exc = exceptions[0];
    if (exc.tipo === 'cerrado') {
      return {
        abierto: false,
        intervalos: [],
        motivo: exc.motivo || 'Profesional no disponible en esta fecha.',
        isException: true
      };
    } else {
      return {
        abierto: true,
        intervalos: normalizeIntervals(exc.intervalos || []),
        motivo: exc.motivo,
        isException: true
      };
    }
  }



  // Calculate day of week
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const dayOfWeekIndex = targetDate.getDay();
  const dayKey = dayKeys[dayOfWeekIndex];

  // Retrieve versioned schedule for professional at target date
  const versionedSchedule = await getScheduleForDate('profesional', profesionalId, dateStr);
  if (versionedSchedule && versionedSchedule.dias && versionedSchedule.dias[dayKey]) {
    const dayConfig = versionedSchedule.dias[dayKey];
    if (!dayConfig.abierto || !dayConfig.intervalos || dayConfig.intervalos.length === 0) {
      return {
        abierto: false,
        intervalos: [],
        motivo: 'Día libre del profesional según su cronograma habitual.',
        isException: false
      };
    }
    return {
      abierto: true,
      intervalos: normalizeIntervals(dayConfig.intervalos),
      isException: false
    };
  }

  // Fallback: Default to effective studio schedule
  const studioEffective = await getEffectiveStudioSchedule(dateStr);
  return {
    abierto: studioEffective.abierto,
    intervalos: studioEffective.intervalos,
    motivo: studioEffective.motivo,
    isException: false
  };
}

/**
 * Checks whether a proposed professional availability exception exceeds
 * the effective studio schedule for that date.
 */
export async function checkStudioCoverageForProfessionalException(
  dateStr: string,
  profIntervalos: TimeInterval[]
): Promise<{
  exceedsStudio: boolean;
  isStudioClosed: boolean;
  studioEffectiveIntervals: TimeInterval[];
  requiredStudioIntervals: TimeInterval[];
  uncoveredIntervals: TimeInterval[];
  warningMessage?: string;
  studioScheduleDescription: string;
  professionalScheduleDescription: string;
}> {
  const studioSched = await getEffectiveStudioSchedule(dateStr);
  const normalizedProf = normalizeIntervals(profIntervalos);

  const profDesc = normalizedProf.length > 0 
    ? normalizedProf.map(i => `${i.inicio} a ${i.fin} hs`).join(', ') 
    : 'Sin tramos definidos';

  if (normalizedProf.length === 0) {
    return {
      exceedsStudio: false,
      isStudioClosed: !studioSched.abierto,
      studioEffectiveIntervals: studioSched.intervalos,
      requiredStudioIntervals: studioSched.intervalos,
      uncoveredIntervals: [],
      studioScheduleDescription: studioSched.abierto && studioSched.intervalos.length > 0
        ? studioSched.intervalos.map(i => `${i.inicio} a ${i.fin} hs`).join(', ')
        : 'Cerrado',
      professionalScheduleDescription: profDesc
    };
  }

  if (!studioSched.abierto || studioSched.intervalos.length === 0) {
    return {
      exceedsStudio: true,
      isStudioClosed: true,
      studioEffectiveIntervals: [],
      requiredStudioIntervals: normalizedProf,
      uncoveredIntervals: normalizedProf,
      warningMessage: `El local figura CERRADO para la fecha ${dateStr}.`,
      studioScheduleDescription: studioSched.motivo || 'Salón cerrado (no abre según cronograma o excepción)',
      professionalScheduleDescription: profDesc
    };
  }

  const studioDesc = studioSched.intervalos.map(i => `${i.inicio} a ${i.fin} hs`).join(', ');
  const uncovered = findUncoveredIntervals(normalizedProf, studioSched.intervalos);
  const exceeds = uncovered.length > 0;
  const combined = normalizeIntervals([...studioSched.intervalos, ...normalizedProf]);

  return {
    exceedsStudio: exceeds,
    isStudioClosed: false,
    studioEffectiveIntervals: studioSched.intervalos,
    requiredStudioIntervals: combined,
    uncoveredIntervals: uncovered,
    warningMessage: exceeds
      ? `El horario configurado para los profesionales excede los tramos de apertura del salón (${studioDesc}) para el ${dateStr}.`
      : undefined,
    studioScheduleDescription: studioDesc,
    professionalScheduleDescription: profDesc
  };
}

/**
 * Checks whether a proposed professional weekly schedule exceeds
 * the effective studio weekly schedule active from `fechaVigencia` onwards.
 */
export async function checkStudioCoverageForProfessionalWeeklySchedule(
  fechaVigencia: string,
  profWeekDays: WeekScheduleMap,
  profesionalId?: string
): Promise<{
  hasConflict: boolean;
  conflicts: Array<{
    dayKey: DayOfWeekKey;
    dayLabel: string;
    isStudioClosed: boolean;
    studioIntervals: TimeInterval[];
    profIntervals: TimeInterval[];
    uncoveredIntervals: TimeInterval[];
    requiredStudioIntervals: TimeInterval[];
    studioDesc: string;
    profDesc: string;
  }>;
  extendedStudioWeekDays: WeekScheduleMap;
  effectiveFechaVigencia: string;
}> {
  // Get active Studio Schedule for fechaVigencia
  const localSchedule = await getScheduleForDate('local', undefined, fechaVigencia);
  const studioDays: WeekScheduleMap = localSchedule?.dias || defaultWeeklySchedule;

  const conflicts: Array<{
    dayKey: DayOfWeekKey;
    dayLabel: string;
    isStudioClosed: boolean;
    studioIntervals: TimeInterval[];
    profIntervals: TimeInterval[];
    uncoveredIntervals: TimeInterval[];
    requiredStudioIntervals: TimeInterval[];
    studioDesc: string;
    profDesc: string;
  }> = [];

  const extendedStudioWeekDays: WeekScheduleMap = JSON.parse(JSON.stringify(studioDays));

  const daysMeta: { key: DayOfWeekKey; label: string }[] = [
    { key: 'lunes', label: 'Lunes' },
    { key: 'martes', label: 'Martes' },
    { key: 'miercoles', label: 'Miércoles' },
    { key: 'jueves', label: 'Jueves' },
    { key: 'viernes', label: 'Viernes' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' }
  ];

  for (const dm of daysMeta) {
    const profDay = profWeekDays[dm.key];
    const studioDay = studioDays[dm.key];

    if (profDay && profDay.abierto && profDay.intervalos && profDay.intervalos.length > 0) {
      const normProf = normalizeIntervals(profDay.intervalos);
      const profDesc = normProf.map(i => `${i.inicio} a ${i.fin} hs`).join(', ');

      if (!studioDay || !studioDay.abierto || !studioDay.intervalos || studioDay.intervalos.length === 0) {
        // Salon is completely closed on this day
        conflicts.push({
          dayKey: dm.key,
          dayLabel: dm.label,
          isStudioClosed: true,
          studioIntervals: [],
          profIntervals: normProf,
          uncoveredIntervals: normProf,
          requiredStudioIntervals: normProf,
          studioDesc: 'Cerrado',
          profDesc
        });
        extendedStudioWeekDays[dm.key] = {
          abierto: true,
          intervalos: normProf
        };
      } else {
        const normStudio = normalizeIntervals(studioDay.intervalos);
        const uncovered = findUncoveredIntervals(normProf, normStudio);

        if (uncovered.length > 0) {
          const combined = normalizeIntervals([...normStudio, ...normProf]);
          const studioDesc = normStudio.map(i => `${i.inicio} a ${i.fin} hs`).join(', ');
          conflicts.push({
            dayKey: dm.key,
            dayLabel: dm.label,
            isStudioClosed: false,
            studioIntervals: normStudio,
            profIntervals: normProf,
            uncoveredIntervals: uncovered,
            requiredStudioIntervals: combined,
            studioDesc,
            profDesc
          });
          extendedStudioWeekDays[dm.key] = {
            abierto: true,
            intervalos: combined
          };
        }
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    extendedStudioWeekDays,
    effectiveFechaVigencia: fechaVigencia
  };
}

/**
 * Core engine: Calculates available time slots for a given date, service,
 * and optional professional.
 */
export async function calculateAvailability(params: {
  fecha: string;
  servicioId: string;
  profesionalId?: string;
}): Promise<DayAvailability> {
  const { fecha, servicioId, profesionalId } = params;

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('Fecha inválida. Formato requerido: YYYY-MM-DD');
  }

  const [year, month, day] = fecha.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const dayOfWeekIndex = targetDate.getDay();
  const dayName = dayNamesEs[dayOfWeekIndex];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isPast = targetDate < todayStart;
  const isToday = targetDate.getTime() === todayStart.getTime();

  // 1. Get Service details
  const allServices = await getServices(false);
  const service = allServices.find(s => s.id === servicioId) || allServices[0];
  const serviceDuration = service ? service.duracionMinutos : 60;

  const studioConfig = await getStudioConfig();
  const intervalMinutes = studioConfig.intervaloMinutos || 30;
  const bufferMinutos = studioConfig.bufferMinutos || 0;

  const response: DayAvailability = {
    fecha,
    diaSemana: dayOfWeekIndex,
    nombreDia: dayName,
    abierto: false,
    duracionServicioSolicitado: serviceDuration,
    profesionalSolicitadoId: profesionalId,
    slots: [],
    slotsDisponiblesCount: 0
  };

  if (isPast) {
    response.abierto = false;
    response.motivo = 'La fecha seleccionada ya ha transcurrido.';
    return response;
  }

  // 2. Get Effective Studio Schedule
  const studioSchedule = await getEffectiveStudioSchedule(fecha);
  if (!studioSchedule.abierto || studioSchedule.intervalos.length === 0) {
    response.abierto = false;
    response.motivo = studioSchedule.motivo || 'El local permanecerá cerrado en esta fecha.';
    return response;
  }

  response.abierto = true;
  const earliestApertura = studioSchedule.intervalos[0].inicio;
  const latestCierre = studioSchedule.intervalos[studioSchedule.intervalos.length - 1].fin;
  response.horarioAtencion = {
    apertura: earliestApertura,
    cierre: latestCierre,
    tramos: studioSchedule.intervalos
  };

  // 3. Determine Candidate Professionals
  let candidateProfessionals: Professional[] = [];
  const allProfessionals = await getProfessionals(true);

  if (profesionalId && profesionalId !== 'todos' && profesionalId !== 'cualquiera') {
    const selected = allProfessionals.find(p => p.id === profesionalId);
    if (!selected) {
      response.abierto = false;
      response.motivo = 'El profesional seleccionado no se encuentra activo o no existe.';
      return response;
    }
    // Verify professional habilitation for this service
    const isHabilitated = await isProfessionalHabilitated(selected.id, service.id);
    if (!isHabilitated) {
      response.abierto = false;
      response.motivo = `${selected.nombre} no realiza el servicio "${service.nombre}".`;
      return response;
    }
    candidateProfessionals = [selected];
  } else {
    // Get all professionals habilitated for this service
    const habilitated = await getProfessionalsForService(service.id);
    candidateProfessionals = habilitated.filter(p => p.activo);
    if (candidateProfessionals.length === 0) {
      // Fallback if no specific relation seeded yet: take all active professionals
      candidateProfessionals = allProfessionals;
    }
  }

  if (candidateProfessionals.length === 0) {
    response.abierto = false;
    response.motivo = 'No hay profesionales habilitados disponibles para este servicio.';
    return response;
  }

  // 4. Fetch existing appointments for the day
  const dayAppointments = await getAppointments({ date: fecha });
  const activeAppointments = dayAppointments.filter(a => a.estado !== 'cancelado');

  // 6. Precompute effective intervals and appointment lists for each professional
  interface ProfContext {
    professional: Professional;
    workingIntervals: TimeInterval[]; // Intersected with studio intervals
    appointments: Appointment[];
    blocks: Array<{ startM: number; endM: number; motivo?: string }>;
  }

  const profContexts: ProfContext[] = [];

  for (const prof of candidateProfessionals) {
    const profSched = await getEffectiveProfessionalSchedule(prof.id, fecha);
    if (!profSched.abierto || profSched.intervalos.length === 0) {
      continue;
    }

    // Intersect Studio intervals with Professional intervals
    const effectiveWorking = intersectIntervals(studioSchedule.intervalos, profSched.intervalos);
    if (effectiveWorking.length === 0) {
      continue;
    }

    // Professional appointments (including legacy appointments without profesionalId if single professional)
    const profApts = activeAppointments.filter(a => {
      if (a.profesionalId) {
        return a.profesionalId === prof.id;
      }
      // If legacy appointment has no profesionalId, assign to candidate if single candidate
      return candidateProfessionals.length === 1;
    });

    profContexts.push({
      professional: prof,
      workingIntervals: effectiveWorking,
      appointments: profApts,
      blocks: []
    });
  }

  if (profContexts.length === 0) {
    response.abierto = false;
    response.motivo = 'No hay profesionales con horario disponible en esta fecha.';
    return response;
  }

  // 7. Discretize potential slots across studio opening bounds
  const earliestStudioM = Math.min(...studioSchedule.intervalos.map(i => timeToMinutes(i.inicio)));
  const latestStudioM = Math.max(...studioSchedule.intervalos.map(i => timeToMinutes(i.fin)));

  const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
  const slots: TimeSlot[] = [];
  let availableCount = 0;

  for (let startM = earliestStudioM; startM + serviceDuration <= latestStudioM; startM += intervalMinutes) {
    const endM = startM + serviceDuration;
    const totalOccupiedEndM = endM + bufferMinutos;
    const slotTimeStr = minutesToTime(startM);

    // Rule: Past time check for today
    if (isToday && startM <= currentMinutesToday + 15) {
      slots.push({
        hora: slotTimeStr,
        disponible: false,
        motivo: 'Horario pasado'
      });
      continue;
    }



    // Evaluate which professionals are available for this slot
    const freeProfessionals: AvailableProfessionalSummary[] = [];

    for (const ctx of profContexts) {
      // 1. Must fit completely inside one of the professional's effective working intervals
      const fitsInAnInterval = ctx.workingIntervals.some(interval => {
        const iStart = timeToMinutes(interval.inicio);
        const iEnd = timeToMinutes(interval.fin);
        return iStart <= startM && totalOccupiedEndM <= iEnd;
      });

      if (!fitsInAnInterval) {
        continue;
      }

      // 2. Must not collide with any detailed block
      const hasBlockCollision = ctx.blocks.some(b => {
        return Math.max(startM, b.startM) < Math.min(totalOccupiedEndM, b.endM);
      });

      if (hasBlockCollision) {
        continue;
      }

      // 3. Must not collide with existing appointments of this professional (including buffer)
      const hasAptCollision = ctx.appointments.some(apt => {
        const aptStart = timeToMinutes(apt.horaInicio);
        const aptEnd = timeToMinutes(apt.horaFin) + bufferMinutos;
        return Math.max(startM, aptStart) < Math.min(totalOccupiedEndM, aptEnd);
      });

      if (hasAptCollision) {
        continue;
      }

      freeProfessionals.push({
        id: ctx.professional.id,
        nombre: ctx.professional.nombre,
        apellido: ctx.professional.apellido,
        colorAgenda: ctx.professional.colorAgenda
      });
    }

    if (freeProfessionals.length > 0) {
      slots.push({
        hora: slotTimeStr,
        disponible: true,
        profesionalesDisponibles: freeProfessionals,
        profesionalAsignadoId: freeProfessionals[0]?.id
      });
      availableCount++;
    } else {
      // Determine most representative reason
      let motivo = 'Fuera del horario de atención';
      const isInsideStudio = studioSchedule.intervalos.some(i => {
        const sStart = timeToMinutes(i.inicio);
        const sEnd = timeToMinutes(i.fin);
        return sStart <= startM && endM <= sEnd;
      });

      if (isInsideStudio) {
        motivo = 'Turno ya ocupado';
      }

      slots.push({
        hora: slotTimeStr,
        disponible: false,
        motivo
      });
    }
  }

  response.slots = slots;
  response.slotsDisponiblesCount = availableCount;

  return response;
}

/**
 * Validates a booking request atomically on the backend against all business rules:
 * - Professional exists and active
 * - Service exists and active
 * - Professional is habilitated for the service
 * - Date is in future / valid
 * - Effective local & professional schedule covers the full appointment duration + buffer
 * - No collisions with existing appointments or blocks
 */
export async function validateBookingSlot(params: {
  fecha: string;
  horaInicio: string;
  servicioId: string;
  profesionalId?: string;
  excludeAppointmentId?: string;
}): Promise<{
  valid: boolean;
  error?: string;
  profesionalId: string;
  profesionalNombre: string;
  duracionMinutos: number;
  horaFin: string;
  precio: number;
}> {
  const { fecha, horaInicio, servicioId, profesionalId, excludeAppointmentId } = params;

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { valid: false, error: 'Fecha inválida. Formato requerido: YYYY-MM-DD', profesionalId: '', profesionalNombre: '', duracionMinutos: 0, horaFin: '', precio: 0 };
  }

  if (!horaInicio || !/^\d{2}:\d{2}$/.test(horaInicio)) {
    return { valid: false, error: 'Hora de inicio inválida. Formato requerido: HH:mm', profesionalId: '', profesionalNombre: '', duracionMinutos: 0, horaFin: '', precio: 0 };
  }

  // 1. Validate Service
  const allServices = await getServices(false);
  const service = allServices.find(s => s.id === servicioId && s.activo);
  if (!service) {
    return { valid: false, error: 'El servicio seleccionado no existe o no se encuentra activo.', profesionalId: '', profesionalNombre: '', duracionMinutos: 0, horaFin: '', precio: 0 };
  }

  const serviceDuration = service.duracionMinutos;
  const startM = timeToMinutes(horaInicio);
  const endM = startM + serviceDuration;
  const horaFin = minutesToTime(endM);

  const studioConfig = await getStudioConfig();
  const bufferMinutos = studioConfig.bufferMinutos || 0;
  const totalOccupiedEndM = endM + bufferMinutos;

  // 2. Validate Professional(s)
  const allProfessionals = await getProfessionals(true);
  let targetProfessionals: Professional[] = [];

  if (profesionalId && profesionalId !== 'todos' && profesionalId !== 'cualquiera') {
    const prof = allProfessionals.find(p => p.id === profesionalId);
    if (!prof) {
      return { valid: false, error: 'El profesional seleccionado no existe o no se encuentra activo.', profesionalId: '', profesionalNombre: '', duracionMinutos: 0, horaFin: '', precio: 0 };
    }
    const isHabilitated = await isProfessionalHabilitated(prof.id, service.id);
    if (!isHabilitated) {
      return { valid: false, error: `${prof.nombre} no realiza el servicio "${service.nombre}".`, profesionalId: '', profesionalNombre: '', duracionMinutos: 0, horaFin: '', precio: 0 };
    }
    targetProfessionals = [prof];
  } else {
    // Any habilitated professional
    const habilitated = await getProfessionalsForService(service.id);
    targetProfessionals = habilitated.filter(p => p.activo);
    if (targetProfessionals.length === 0) {
      targetProfessionals = allProfessionals;
    }
  }

  if (targetProfessionals.length === 0) {
    return { valid: false, error: 'No hay profesionales disponibles para realizar este servicio.', profesionalId: '', profesionalNombre: '', duracionMinutos: 0, horaFin: '', precio: 0 };
  }

  // 3. Studio schedule validation
  const studioSchedule = await getEffectiveStudioSchedule(fecha);
  if (!studioSchedule.abierto || studioSchedule.intervalos.length === 0) {
    return { valid: false, error: studioSchedule.motivo || 'El local permanecerá cerrado en esa fecha.', profesionalId: '', profesionalNombre: '', duracionMinutos: 0, horaFin: '', precio: 0 };
  }



  const dayAppointments = await getAppointments({ date: fecha });
  const nonCancelled = dayAppointments.filter(a => a.estado !== 'cancelado' && a.id !== excludeAppointmentId);

  // 5. Try each candidate professional until finding a free one
  for (const prof of targetProfessionals) {
    const profSched = await getEffectiveProfessionalSchedule(prof.id, fecha);
    if (!profSched.abierto || profSched.intervalos.length === 0) {
      continue;
    }

    const effectiveIntervals = intersectIntervals(studioSchedule.intervalos, profSched.intervalos);
    const fitsInterval = effectiveIntervals.some(i => {
      const iStart = timeToMinutes(i.inicio);
      const iEnd = timeToMinutes(i.fin);
      return iStart <= startM && totalOccupiedEndM <= iEnd;
    });

    if (!fitsInterval) {
      continue;
    }



    // Check appointment collisions
    const aptCollision = nonCancelled.some(apt => {
      if (apt.profesionalId && apt.profesionalId !== prof.id) {
        return false;
      }
      const aptStart = timeToMinutes(apt.horaInicio);
      const aptEnd = timeToMinutes(apt.horaFin) + bufferMinutos;
      return Math.max(startM, aptStart) < Math.min(totalOccupiedEndM, aptEnd);
    });

    if (!aptCollision) {
      return {
        valid: true,
        profesionalId: prof.id,
        profesionalNombre: `${prof.nombre} ${prof.apellido}`.trim(),
        duracionMinutos: serviceDuration,
        horaFin,
        precio: service.precio
      };
    }
  }

  return {
    valid: false,
    error: 'El horario seleccionado acaba de ser reservado o no tiene disponibilidad en el cronograma. Por favor elegí otro horario.',
    profesionalId: '',
    profesionalNombre: '',
    duracionMinutos: 0,
    horaFin: '',
    precio: 0
  };
}

export async function checkConflictingAppointmentsForException(payload: {
  alcance: ScheduleScope;
  profesionalId?: string;
  profesionalIds?: string[];
  fecha: string;
  tipo: AvailabilityExceptionType;
  intervalos?: TimeInterval[];
}): Promise<Appointment[]> {
  const dayAppointments = await getAppointments({ date: payload.fecha });
  const activeApts = dayAppointments.filter(a => a.estado !== 'cancelado');
  const conflicts: Appointment[] = [];

  const targetProfIds = new Set<string>();
  if (payload.alcance === 'profesional') {
    if (payload.profesionalId) targetProfIds.add(payload.profesionalId);
    if (Array.isArray(payload.profesionalIds)) {
      payload.profesionalIds.forEach(id => targetProfIds.add(id));
    }
  }

  for (const apt of activeApts) {
    if (payload.alcance === 'profesional') {
      if (!apt.profesionalId || !targetProfIds.has(apt.profesionalId)) {
        continue;
      }
    }

    if (payload.tipo === 'cerrado') {
      conflicts.push(apt);
    } else if (payload.tipo === 'horario_especial') {
      const intervals = payload.intervalos || [];
      const aptStartM = timeToMinutes(apt.horaInicio);
      const aptEndM = timeToMinutes(apt.horaFin);

      const isCovered = intervals.some(inv => {
        const invStartM = timeToMinutes(inv.inicio);
        const invEndM = timeToMinutes(inv.fin);
        return aptStartM >= invStartM && aptEndM <= invEndM;
      });

      if (!isCovered) {
        conflicts.push(apt);
      }
    }
  }

  return conflicts;
}

