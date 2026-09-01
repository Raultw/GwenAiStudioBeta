export type AppointmentStatus = 'pendiente' | 'completado' | 'cancelado';

export interface Client {
  id: string; // UUID
  nombre: string;
  apellido: string;
  telefono: string;
  telefonoNormalizado: string; // Canonical clean digits (e.g. 1112345678)
  email?: string;
  emailNormalizado?: string;
  nombreNormalizado: string;
  apellidoNormalizado: string;
  notasAdmin?: string; // Observaciones internas exclusivas del administrador
  fechaAlta: string; // ISO date
  fechaUltimaVisita?: string; // YYYY-MM-DD
  activo: boolean;
  browserId?: string; // Identificador técnico complementario anónimo
  
  // Auditoría calculada / enriquecida
  totalTurnos?: number;
  totalGastado?: number;
  primerTurnoFecha?: string;
  proximoTurno?: string; // YYYY-MM-DD
  proximoTurnoHora?: string; // HH:mm
  proximoTurnoServicio?: string;
  serviciosHistorial?: string[]; // Lista de nombres de servicios solicitados
  
  // Detección de posibles duplicados
  posibleDuplicadoDe?: string[]; // IDs de otros clientes similares
  motivoPosibleDuplicado?: string;
  nivelCoincidenciaDuplicado?: number; // 0-100
  duplicadoRevisado?: boolean;
  fusionadoConId?: string; // ID del cliente principal en caso de fusión
  fechaFusion?: string;

  // Alertas activas computadas
  alertasActivasCount?: number;
  alertasActivas?: ClientAlert[];
}

export type AlertSeverity = 'leve' | 'moderada' | 'alta' | 'critica';
export type AlertType = 'alergia' | 'sensibilidad' | 'irritacion' | 'producto_evitar' | 'procedimiento' | 'precaucion' | 'otro';

export interface ClientAlert {
  id: string; // UUID
  clienteId: string; // Foreign Key -> Client.id
  tipo: AlertType;
  descripcion: string;
  productoServicioRelacionado?: string;
  fecha: string; // YYYY-MM-DD
  severidad: AlertSeverity;
  activa: boolean;
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPreferences {
  id: string; // UUID
  clienteId: string; // Foreign Key -> Client.id
  formaUnas?: string;
  largoHabitual?: string;
  estilo?: string;
  coloresPreferidos?: string[];
  productosPreferidos?: string;
  productosEvitar?: string;
  observacionesGenerales?: string;
  updatedAt: string;
}

export type HandKey = 'izquierda' | 'derecha';
export type FingerKey = 'pulgar' | 'indice' | 'medio' | 'anular' | 'menique';

export interface ClientTipConfigItem {
  id?: string;
  clienteId: string;
  mano: HandKey;
  dedo: FingerKey;
  tamanoTip: string; // e.g. "0".."9" o medida
  marcaModelo?: string; // e.g. "Aprés Gel-X", "Soft Gel Curves", "Victoria Vynn"
  observaciones?: string;
  updatedAt?: string;
}

export interface ClientWithFullProfile {
  client: Client;
  appointments: Appointment[];
  alerts: ClientAlert[];
  preferences: ClientPreferences | null;
  tipsConfig: ClientTipConfigItem[];
}

export interface DuplicatePair {
  id: string; // Identificador del par de duplicados
  clienteA: Client;
  clienteB: Client;
  confianza: number; // Porcentaje 0-100
  motivo: string;
  turnosA: Appointment[];
  turnosB: Appointment[];
}

export interface ClientStats {
  totalClientes: number;
  clientesNuevos: number; // Primer turno en últimos 30 días
  clientesRecurrentes: number; // 2 o más turnos
  clientesInactivos: number; // Sin turnos en últimos 60 días
  clientesConProximosTurnos: number;
  duplicadosPendientes: number;
}

export interface Service {
  id: string;
  nombre: string;
  slug: string;
  categoria: 'esculpidas' | 'esmaltado' | 'cuidado' | 'arte';
  descripcion: string;
  duracionMinutos: number;
  precio: number;
  esPopular?: boolean;
  icono: string; // emoji or icon identifier
  detalles: string[];
  activo: boolean;
}

// ---------------------------------------------------------------------------
// USUARIOS Y PROFESIONALES
// ---------------------------------------------------------------------------

export type UserRole = 'superadmin' | 'admin' | 'professional' | 'profesional' | 'empleado';

export interface User {
  id: string; // UUID
  username?: string;
  email?: string;
  passwordHash?: string; // Nunca transmitido en respuestas públicas
  salt?: string;
  rol: UserRole;
  profesionalId?: string; // Relación con entidad Professional si aplica
  activo: boolean;
  nombre?: string;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorId?: string;
  actorName?: string;
  targetUserId?: string;
  evento: string;
  fecha: string;
  origen?: string;
  metadata?: Record<string, any>;
}

export type SafeUser = Omit<User, 'passwordHash' | 'salt'>;

export interface Session {
  id: string; // UUID
  tokenHash: string; // SHA-256 hash del token opaco
  userId: string;
  expiresAt: string; // ISO date
  createdAt: string; // ISO date
  revokedAt?: string | null;
  lastActivityAt?: string;
}

export interface AuthenticatedContext {
  userId: string;
  role: UserRole;
  profesionalId?: string;
  sessionId: string;
  user: SafeUser;
}

export interface Professional {
  id: string; // UUID
  userId?: string; // Relación inversa con User
  nombre: string;
  apellido: string;
  email?: string;
  telefono?: string;
  fotoUrl?: string;
  colorAgenda?: string; // Hex color para visualización en agenda (e.g. #8E4455)
  titulo?: string; // e.g. "Master Nail Artist & Fundadora"
  activo: boolean;
  serviciosIds?: string[]; // IDs de servicios habilitados
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalService {
  id: string;
  profesionalId: string;
  servicioId: string;
  activo: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// HORARIOS, TRAMOS Y VIGENCIAS
// ---------------------------------------------------------------------------

export interface TimeInterval {
  inicio: string; // "09:00" (HH:mm)
  fin: string;    // "13:00" (HH:mm)
}

export type DayOfWeekKey = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

export interface DayScheduleIntervals {
  abierto: boolean;
  intervalos: TimeInterval[]; // Múltiples tramos por día (e.g. 09:00-13:00 y 15:00-19:00)
}

export type WeekScheduleMap = Record<DayOfWeekKey, DayScheduleIntervals>;

export type ScheduleScope = 'local' | 'profesional';

export interface ScheduleConfig {
  id: string; // UUID
  alcance: ScheduleScope;
  profesionalId?: string; // null para horario del local
  fechaVigencia: string; // YYYY-MM-DD (Fecha desde la que aplica esta configuración)
  dias: WeekScheduleMap;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// EXCEPCIONES DE DISPONIBILIDAD
// ---------------------------------------------------------------------------

export type AvailabilityExceptionType = 'cerrado' | 'horario_especial';

export interface AvailabilityException {
  id: string; // UUID
  alcance: ScheduleScope; // 'local' o 'profesional'
  profesionalId?: string; // Si alcance es profesional
  profesionalIds?: string[]; // Para creación múltiple
  fecha: string; // YYYY-MM-DD
  tipo: AvailabilityExceptionType; // 'cerrado' o 'horario_especial'
  intervalos: TimeInterval[]; // Tramos específicos para esa fecha si es horario_especial
  motivo?: string; // e.g. "Feriado", "Capacitación", "Turno extendido", etc.
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  clienteId?: string; // Relación con entidad Cliente (UUID)
  profesionalId?: string; // Relación con profesional asignado
  profesionalNombre?: string; // Snapshot histórico del profesional
  codigo: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string;
  servicioId: string;
  servicioNombre: string;
  duracionMinutos: number;
  precio: number;
  fecha: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
  horaFin: string; // HH:mm
  observaciones?: string;
  estado: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
  notasAdmin?: string;
  browserId?: string;
  alertasCliente?: ClientAlert[]; // Alertas activas de la clienta asociadas al turno

  // Descuentos y beneficios aplicados
  descuentoTipo?: 'promocion' | 'beneficio' | null;
  descuentoId?: string; // ID de Promotion o ClientBenefit
  descuentoCodigo?: string; // Código de promoción si aplica
  descuentoNombre?: string; // Nombre descriptivo de la promo o beneficio
  descuentoPorcentaje?: number;
  descuentoMonto?: number; // Monto descontado ($)
  precioOriginal?: number; // Precio antes del descuento
  precioFinal?: number; // Precio a cobrar tras aplicar descuento

  // Auditoría centralizada de cancelación
  motivoCancelacion?: string;
  canceladoEn?: string; // ISO date-time
  canceladoOrigen?: 'agenda' | 'detalle_turno' | 'excepcion_disponibilidad' | 'admin' | 'cliente' | string;
  canceladoPor?: string; // Usuario / Admin responsable
}

// ---------------------------------------------------------------------------
// PROMOCIONES Y BENEFICIOS
// ---------------------------------------------------------------------------

export type DiscountType = 'porcentaje' | 'monto_fijo';
export type BenefitStatus = 'disponible' | 'usado' | 'vencido' | 'cancelado';
export type ClientBenefitStatus = BenefitStatus;
export type BenefitOrigin = 'admin' | 'compensacion' | 'cancelacion_excepcion' | 'fidelidad' | 'fidelizacion' | 'cumpleanos' | 'promocion_especial' | 'otro';

/**
 * Plantilla de Beneficio Reutilizable (Catálogo Administrativo).
 * Define un tipo o modelo de beneficio estándar que luego podrá ser asignado a clientas.
 * No representa una asignación individual, sino una regla reutilizable.
 */
export interface BenefitTemplate {
  id: string; // UUID o ID único
  nombrePublico: string; // e.g. "20% de descuento en tu próxima visita"
  descripcionPublica?: string; // Explicación breve visible para la clienta
  tipoDescuento: DiscountType; // 'porcentaje' | 'monto_fijo'
  valorDescuento: number; // Porcentaje (0 < val <= 100) o Monto fijo en ARS (> 0)
  vigenciaDias: number; // Cantidad de días de validez desde el momento de emisión
  serviciosAplicables: string[]; // ['todos'] o array de servicioIds específicos
  montoMinimo?: number | null; // null si no aplica monto mínimo
  activo: boolean; // Si está disponible para nuevas asignaciones
  createdAt: string; // ISO date-time
  updatedAt: string; // ISO date-time
}

export interface Promotion {
  id: string; // UUID
  codigo: string; // e.g. "VERANO20", uppercase
  nombre: string; // e.g. "Promo Verano 20% OFF"
  descripcion?: string;
  activo: boolean;
  tipoDescuento: DiscountType; // 'porcentaje' | 'monto_fijo'
  valorDescuento: number; // e.g. 20 (para 20%) o 2500 (para $2500)
  fechaInicio: string; // YYYY-MM-DD
  fechaVencimiento?: string | null; // YYYY-MM-DD o null si no vence
  limiteTotalUsos?: number | null; // null = ilimitado
  limiteUsoPorCliente?: number | null; // null = ilimitado (ej: 1 vez por cliente)
  periodoReutilizacionDias?: number | null; // null = sin restricción, ej: 30 días para reutilizar
  serviciosAplicables: string[]; // ['todos'] o array de servicioIds ['serv-1', 'serv-2']
  montoMinimo?: number | null; // null = sin monto mínimo
  usosActuales: number; // Contador acumulado de usos
  createdAt: string;
  updatedAt: string;
}

export interface PromotionUsage {
  id: string; // UUID
  promocionId: string;
  codigo?: string;
  codigoPromocion?: string;
  clienteId?: string;
  clienteNombre?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  turnoId?: string;
  turnoCodigo?: string;
  descuentoAplicado: number;
  montoDescuento?: number;
  precioOriginal: number;
  precioFinal: number;
  fechaUso: string; // ISO date-time
}

export interface ClientBenefit {
  id: string; // UUID
  clienteId: string; // FK -> Client.id
  clienteNombre?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  templateId?: string | null; // Trazabilidad opcional hacia BenefitTemplate de origen (Snapshot histórico)
  titulo: string; // e.g. "15% de Compensación por Demora"
  descripcion?: string;
  tipoDescuento: DiscountType;
  valorDescuento: number;
  origen: BenefitOrigin;
  origenDetalle?: string;
  fechaEmision: string; // YYYY-MM-DD
  fechaVencimiento?: string | null; // YYYY-MM-DD
  estado: BenefitStatus; // 'disponible' | 'usado' | 'vencido' | 'cancelado'
  turnoOrigenId?: string | null; // Turno que originó el beneficio
  turnoOrigenCodigo?: string | null;
  turnoUsoId?: string | null; // Turno en que se consumió el beneficio
  turnoUsoCodigo?: string | null;
  usadoEn?: string | null; // ISO date-time
  fechaUso?: string | null; // alias
  serviciosAplicables: string[]; // default ['todos']
  montoMinimo?: number | null;
  descuentoAplicado?: number | null;
  otorgadoPor?: string;
  createdAt: string;
  updatedAt: string;
}

export type UpdateBenefitResult = 
  | { success: true; benefit: ClientBenefit }
  | { success: false; reason: 'not_found' | 'already_used' | 'already_cancelled' | 'not_available' };

export interface ValidateDiscountResult {
  valido: boolean;
  tipo?: 'promocion' | 'beneficio';
  descuentoId?: string;
  codigo?: string;
  titulo?: string;
  nombre?: string;
  descripcion?: string;
  tipoDescuento?: DiscountType;
  valorDescuento?: number;
  montoDescontado?: number;
  montoDescuento?: number;
  precioOriginal?: number;
  precioFinal?: number;
  error?: string;
}

export interface AvailableProfessionalSummary {
  id: string;
  nombre: string;
  apellido: string;
  colorAgenda?: string;
}

export interface TimeSlot {
  hora: string; // "09:00"
  disponible: boolean;
  motivo?: string; // "Turno ocupado", "Fuera de horario", "Bloqueado", etc.
  profesionalesDisponibles?: AvailableProfessionalSummary[];
  profesionalAsignadoId?: string;
}

export interface DayAvailability {
  fecha: string;
  diaSemana: number; // 0=Domingo, 1=Lunes, ...
  nombreDia: string;
  abierto: boolean;
  motivo?: string;
  horarioAtencion?: {
    apertura: string;
    cierre: string;
    tramos?: TimeInterval[];
  };
  duracionServicioSolicitado: number;
  profesionalSolicitadoId?: string;
  slots: TimeSlot[];
  slotsDisponiblesCount: number;
}

export interface DayScheduleConfig {
  activo: boolean;
  apertura: string; // "09:00"
  cierre: string; // "19:00"
}

export interface StudioConfig {
  nombreEstudio: string;
  subtitulo: string;
  direccion: string;
  telefono: string;
  whatsapp: string;
  instagram: string;
  email: string;
  horariosPorDia: {
    lunes: DayScheduleConfig;
    martes: DayScheduleConfig;
    miercoles: DayScheduleConfig;
    jueves: DayScheduleConfig;
    viernes: DayScheduleConfig;
    sabado: DayScheduleConfig;
    domingo: DayScheduleConfig;
  };
  intervaloMinutos: number; // e.g. 30
  bufferMinutos: number; // e.g. 0 or 15
  pinAdmin: string;
  diasInactividadCliente?: number; // Días sin visitas para considerar cliente inactivo (default: 60)
  minTurnosRecurrente?: number; // Cantidad mínima de turnos para considerar cliente recurrente (default: 2)
}

export interface DashboardStats {
  turnosHoy: number;
  turnosPendientes: number;
  turnosCompletadosMes: number;
  ingresosEstimadosMes: number;
  totalTurnos: number;
  serviciosMasPedidos: Array<{
    servicioId: string;
    nombre: string;
    cantidad: number;
    ingresos: number;
  }>;
  proximosTurnos: Appointment[];
}

export interface AppointmentCancellationResult {
  appointment: Appointment;
  wasAlreadyCancelled: boolean;
  cancelledInThisExecution: boolean;
  benefit: ClientBenefit | null;
  benefitCreatedInThisExecution: boolean;
  shouldSendNotification: boolean;
  notificationStatus: 'pending' | 'omitido_sin_email' | 'already_sent' | 'skipped';
}

export interface ApplyAvailabilityExceptionResult {
  exceptions: AvailabilityException[];
  cancelledAppointments: Appointment[];
  issuedBenefits: ClientBenefit[];
  appointmentResults?: AppointmentCancellationResult[];
}

