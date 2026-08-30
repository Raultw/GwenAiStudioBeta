import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();
import type { 
  Service, 
  Appointment, 
  StudioConfig,
  Client,
  DuplicatePair,
  ClientStats,
  ClientAlert,
  ClientPreferences,
  ClientTipConfigItem,
  ClientWithFullProfile,
  User,
  UserRole,
  Professional,
  ProfessionalService,
  TimeInterval,
  DayOfWeekKey,
  WeekScheduleMap,
  ScheduleScope,
  ScheduleConfig,
  AvailabilityExceptionType,
  AvailabilityException,
  Promotion,
  PromotionUsage,
  ClientBenefit,
  ValidateDiscountResult,
  DiscountType,
  BenefitStatus,
  BenefitOrigin
} from '../types.js';
import type { NotificationLog } from './notifications/types.js';
import { 
  normalizeText, 
  normalizePersonName,
  normalizeBrandName,
  normalizePhone, 
  normalizeEmail, 
  evaluateClientMatch, 
  stringSimilarity 
} from './clientMatching.js';

// Default initial services
export const defaultServices: Service[] = [
  {
    id: "1",
    nombre: "Manicura Clásica & Rusa",
    slug: "manicura-clasica",
    categoria: "cuidado",
    descripcion: "Limpieza profunda combinada, repujado y corte prolijo de cutículas, limado y nutrición para manos impecables.",
    duracionMinutos: 45,
    precio: 14000,
    esPopular: false,
    icono: "💅",
    detalles: [
      "Técnica rusa combinada",
      "Nutrición profunda con aceites orgánicos",
      "Esmaltado tradicional o brillo protector",
      "Exfoliación suave de manos"
    ],
    activo: true
  },
  {
    id: "2",
    nombre: "Esmaltado Semipermanente",
    slug: "semipermanente",
    categoria: "esmaltado",
    descripcion: "Color brillante y de alta adherencia que se mantiene intacto por 2 a 3 semanas. Gran variedad de tonos de temporada.",
    duracionMinutos: 60,
    precio: 18000,
    esPopular: false,
    icono: "✨",
    detalles: [
      "Preparación rusa de cutículas",
      "Capa base niveladora fortalecedora",
      "Más de 80 tonos premium disponibles",
      "Top coat ultra brillante o mate satinado"
    ],
    activo: true
  },
  {
    id: "3",
    nombre: "Soft Gel System",
    slug: "soft-gel",
    categoria: "esculpidas",
    descripcion: "Extensiones ultralivianas de gel que cuidan tu uña natural con máxima resistencia y flexibilidad. El método estrella.",
    duracionMinutos: 90,
    precio: 26000,
    esPopular: true,
    icono: "🌸",
    detalles: [
      "Tip completo 100% soak-off gel",
      "Largo y forma a elección (Almond, Coffin, Square, Stiletto)",
      "Durabilidad de 3 a 4 semanas sin levantamientos",
      "Incluye esmaltado liso a elección"
    ],
    activo: true
  },
  {
    id: "4",
    nombre: "Kapping Gel Fortalecedor",
    slug: "kapping",
    categoria: "cuidado",
    descripcion: "Fino recubrimiento en gel o acrigel sobre la uña natural para evitar quiebres y permitir que crezca fuerte y sana.",
    duracionMinutos: 75,
    precio: 22000,
    esPopular: false,
    icono: "💎",
    detalles: [
      "Ideal para uñas frágiles, quebradizas o escamadas",
      "Nivelación y arquitectura perfecta",
      "Refuerzo estructural sin grosor excesivo",
      "Incluye esmaltado semipermanente"
    ],
    activo: true
  },
  {
    id: "5",
    nombre: "Nail Art & Diseños Exclusivos",
    slug: "nail-art",
    categoria: "arte",
    descripcion: "Creaciones artísticas a mano alzada, efectos chrome, foil dorado, degradados aura, flores y pedrería fina.",
    duracionMinutos: 90,
    precio: 25000,
    esPopular: true,
    icono: "🎨",
    detalles: [
      "Mano alzada personalizada",
      "Tendencias: Chrome, Glazed Donut, Aura, French 3D",
      "Aplicación de foil, microbrillos y cristalería",
      "Asesoramiento estético personalizado"
    ],
    activo: true
  },
  {
    id: "6",
    nombre: "Esculpidas en Polygel / Acrílico",
    slug: "esculpidas",
    categoria: "esculpidas",
    descripcion: "Construcción escultural con molde milimétrico para formas impecables, resistencia superior y máximo detalle.",
    duracionMinutos: 120,
    precio: 32000,
    esPopular: false,
    icono: "👑",
    detalles: [
      "Estructura personalizada con moldes",
      "Control de apex y curva C perfecta",
      "Máxima resistencia para uñas exigentes",
      "Incluye esmaltado semipermanente"
    ],
    activo: true
  },
  {
    id: "7",
    nombre: "Retiro Seguro & Tratamiento",
    slug: "retiro",
    categoria: "cuidado",
    descripcion: "Remoción profesional no invasiva mediante torno de precisión o método soak-off, preservando la placa ungueal.",
    duracionMinutos: 45,
    precio: 10000,
    esPopular: false,
    icono: "🔄",
    detalles: [
      "Retiro suave sin dañar las capas de la uña",
      "Tratamiento de queratina y calcio",
      "Pulido y sellado nutritivo",
      "Recomendado para descansos o cambio de técnica"
    ],
    activo: true
  }
];

export const defaultWeeklySchedule: WeekScheduleMap = {
  lunes: {
    abierto: true,
    intervalos: [{ inicio: "09:00", fin: "19:00" }]
  },
  martes: {
    abierto: true,
    intervalos: [{ inicio: "09:00", fin: "19:00" }]
  },
  miercoles: {
    abierto: true,
    intervalos: [{ inicio: "09:00", fin: "19:00" }]
  },
  jueves: {
    abierto: true,
    intervalos: [{ inicio: "09:00", fin: "19:00" }]
  },
  viernes: {
    abierto: true,
    intervalos: [{ inicio: "09:00", fin: "19:00" }]
  },
  sabado: {
    abierto: true,
    intervalos: [{ inicio: "09:00", fin: "17:00" }]
  },
  domingo: {
    abierto: false,
    intervalos: []
  }
};

export const defaultProfessional: Professional = {
  id: "prof-default-1",
  nombre: "Gwen",
  apellido: "Nails",
  email: "contacto@gwennails.com",
  telefono: "011-15682386",
  fotoUrl: "",
  colorAgenda: "#8E4455",
  titulo: "Master Nail Artist & Fundadora",
  activo: true,
  serviciosIds: defaultServices.map(s => s.id),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Password hashing helper (Salted Scrypt)
export function hashPassword(password: string, customSalt?: string): { hash: string; salt: string } {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch (err) {
    return false;
  }
}

const defaultAdminCreds = hashPassword("admin123", "a1b2c3d4e5f678901234567890abcdef");

export const defaultUserAdmin: User = {
  id: "user-admin-1",
  email: "admin@gwennails.com",
  passwordHash: defaultAdminCreds.hash,
  salt: defaultAdminCreds.salt,
  rol: "admin",
  profesionalId: "prof-default-1",
  activo: true,
  nombre: "Administrador Gwen",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const defaultStudioSchedule: ScheduleConfig = {
  id: "sched-local-default",
  alcance: "local",
  fechaVigencia: "2020-01-01",
  dias: defaultWeeklySchedule,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const defaultProfessionalSchedule: ScheduleConfig = {
  id: "sched-prof-default-1",
  alcance: "profesional",
  profesionalId: "prof-default-1",
  fechaVigencia: "2020-01-01",
  dias: defaultWeeklySchedule,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const defaultStudioConfig: StudioConfig = {
  nombreEstudio: "Gwen Nails Studio",
  subtitulo: "Donde tus manos cuentan tu historia",
  direccion: "Gorriti 5540, Palermo Hollywood, CABA",
  telefono: "011-15682386",
  whatsapp: "5491115682386",
  instagram: "gwennails",
  email: "contacto@gwennails.com",
  horariosPorDia: {
    lunes: { activo: true, apertura: "09:00", cierre: "19:00" },
    martes: { activo: true, apertura: "09:00", cierre: "19:00" },
    miercoles: { activo: true, apertura: "09:00", cierre: "19:00" },
    jueves: { activo: true, apertura: "09:00", cierre: "19:00" },
    viernes: { activo: true, apertura: "09:00", cierre: "19:00" },
    sabado: { activo: true, apertura: "09:00", cierre: "17:00" },
    domingo: { activo: false, apertura: "10:00", cierre: "14:00" }
  },
  intervaloMinutos: 30,
  bufferMinutos: 0,
  pinAdmin: "1234",
  diasInactividadCliente: 60,
  minTurnosRecurrente: 2
};

// Default initial promotions
export const defaultPromotions: Promotion[] = [
  {
    id: "promo-bienvenida-15",
    codigo: "BIENVENIDA15",
    nombre: "15% OFF Primera Visita",
    descripcion: "Descuento de bienvenida aplicable a todos los servicios para nuevas clientas.",
    activo: true,
    tipoDescuento: "porcentaje",
    valorDescuento: 15,
    fechaInicio: "2025-01-01",
    fechaVencimiento: null,
    limiteTotalUsos: null,
    limiteUsoPorCliente: 1,
    periodoReutilizacionDias: null,
    serviciosAplicables: ["todos"],
    montoMinimo: null,
    usosActuales: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "promo-softgel-3000",
    codigo: "SOFTGEL3000",
    nombre: "$3.000 OFF en Soft Gel System",
    descripcion: "Descuento de $3.000 aplicable al servicio estrella de extensiones Soft Gel.",
    activo: true,
    tipoDescuento: "monto_fijo",
    valorDescuento: 3000,
    fechaInicio: "2025-01-01",
    fechaVencimiento: null,
    limiteTotalUsos: 50,
    limiteUsoPorCliente: 2,
    periodoReutilizacionDias: 30,
    serviciosAplicables: ["3"],
    montoMinimo: 20000,
    usosActuales: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// In-Memory & Local File Fallback Engine
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "gwen_db.json");

interface FallbackDb {
  services: Service[];
  appointments: Appointment[];
  clients: Client[];
  clientAlerts: ClientAlert[];
  clientPreferences: ClientPreferences[];
  clientTipsConfig: ClientTipConfigItem[];
  config: StudioConfig;
  users: User[];
  professionals: Professional[];
  professionalServices: ProfessionalService[];
  schedules: ScheduleConfig[];
  availabilityExceptions: AvailabilityException[];
  notificationLogs: NotificationLog[];
  promotions: Promotion[];
  promotionUsages: PromotionUsage[];
  clientBenefits: ClientBenefit[];
}

const memoryDb: FallbackDb = {
  services: defaultServices,
  appointments: [],
  clients: [],
  clientAlerts: [],
  clientPreferences: [],
  clientTipsConfig: [],
  config: defaultStudioConfig,
  users: [defaultUserAdmin],
  professionals: [defaultProfessional],
  professionalServices: defaultServices.map(s => ({
    id: `ps-${defaultProfessional.id}-${s.id}`,
    profesionalId: defaultProfessional.id,
    servicioId: s.id,
    activo: true,
    createdAt: new Date().toISOString()
  })),
  schedules: [defaultStudioSchedule, defaultProfessionalSchedule],
  availabilityExceptions: [],
  notificationLogs: [],
  promotions: defaultPromotions,
  promotionUsages: [],
  clientBenefits: []
};

function loadLocalFileDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.services && Array.isArray(parsed.services)) {
        memoryDb.services = parsed.services;
      }
      if (parsed.appointments && Array.isArray(parsed.appointments)) {
        memoryDb.appointments = parsed.appointments;
      }
      if (parsed.clients && Array.isArray(parsed.clients)) {
        memoryDb.clients = parsed.clients;
      }
      if (parsed.clientAlerts && Array.isArray(parsed.clientAlerts)) {
        memoryDb.clientAlerts = parsed.clientAlerts;
      }
      if (parsed.clientPreferences && Array.isArray(parsed.clientPreferences)) {
        memoryDb.clientPreferences = parsed.clientPreferences;
      }
      if (parsed.clientTipsConfig && Array.isArray(parsed.clientTipsConfig)) {
        memoryDb.clientTipsConfig = parsed.clientTipsConfig;
      }
      if (parsed.users && Array.isArray(parsed.users) && parsed.users.length > 0) {
        memoryDb.users = parsed.users;
      }
      if (parsed.professionals && Array.isArray(parsed.professionals) && parsed.professionals.length > 0) {
        memoryDb.professionals = parsed.professionals;
      }
      if (parsed.professionalServices && Array.isArray(parsed.professionalServices)) {
        memoryDb.professionalServices = parsed.professionalServices;
      }
      if (parsed.schedules && Array.isArray(parsed.schedules) && parsed.schedules.length > 0) {
        memoryDb.schedules = parsed.schedules;
      }
      if (parsed.availabilityExceptions && Array.isArray(parsed.availabilityExceptions)) {
        memoryDb.availabilityExceptions = parsed.availabilityExceptions;
      }
      if (parsed.notificationLogs && Array.isArray(parsed.notificationLogs)) {
        memoryDb.notificationLogs = parsed.notificationLogs;
      }
      if (parsed.promotions && Array.isArray(parsed.promotions)) {
        memoryDb.promotions = parsed.promotions;
      }
      if (parsed.promotionUsages && Array.isArray(parsed.promotionUsages)) {
        memoryDb.promotionUsages = parsed.promotionUsages;
      }
      if (parsed.clientBenefits && Array.isArray(parsed.clientBenefits)) {
        memoryDb.clientBenefits = parsed.clientBenefits;
      }
      if (parsed.config) {
        memoryDb.config = { ...defaultStudioConfig, ...parsed.config };
      }
    } else {
      saveLocalFileDb();
    }
  } catch (err) {
    console.error("Local file DB fallback read error:", err);
  }
}

function saveLocalFileDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
  } catch (err) {
    console.error("Local file DB fallback write error:", err);
  }
}

// PostgreSQL Connection Pool Setup
let pgPool: Pool | null = null;
let isPostgresConnected = false;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (connectionString) {
  try {
    pgPool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    pgPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool:', err);
  }
}

/**
 * Initializes the database tables and default data if connected to PostgreSQL.
 * If not connected, initializes the local fallback database.
 */
export async function initDatabase() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!connectionString && isProd) {
    const errMsg = 'ERROR CRÍTICO: DATABASE_URL es obligatoria en entorno de producción. El fallback JSON no está permitido en producción.';
    console.error(errMsg);
    throw new Error(errMsg);
  }

  if (pgPool) {
    try {
      console.log('🐘 Connecting to PostgreSQL database...');
      const client = await pgPool.connect();
      try {
        // 1. Create Services Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS services (
            id VARCHAR(64) PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            categoria VARCHAR(64) NOT NULL,
            descripcion TEXT,
            duracion_minutos INTEGER NOT NULL,
            precio NUMERIC NOT NULL,
            es_popular BOOLEAN DEFAULT FALSE,
            icono VARCHAR(32),
            detalles JSONB DEFAULT '[]',
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `);

        // 2. Create Clients Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS clients (
            id VARCHAR(64) PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            apellido VARCHAR(255) NOT NULL,
            telefono VARCHAR(64) NOT NULL,
            telefono_normalizado VARCHAR(64) NOT NULL,
            email VARCHAR(255),
            email_normalizado VARCHAR(255),
            nombre_normalizado VARCHAR(255) NOT NULL,
            apellido_normalizado VARCHAR(255) NOT NULL,
            notas_admin TEXT,
            fecha_alta TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            fecha_ultima_visita VARCHAR(10),
            activo BOOLEAN DEFAULT TRUE,
            browser_id VARCHAR(128),
            posible_duplicado_de JSONB DEFAULT '[]',
            motivo_posible_duplicado TEXT,
            nivel_coincidencia_duplicado INTEGER,
            duplicado_revisado BOOLEAN DEFAULT FALSE,
            fusionado_con_id VARCHAR(64),
            fecha_fusion TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_clients_telefono_norm ON clients(telefono_normalizado);
          CREATE INDEX IF NOT EXISTS idx_clients_email_norm ON clients(email_normalizado);
          CREATE INDEX IF NOT EXISTS idx_clients_nombre_norm ON clients(nombre_normalizado);
          CREATE INDEX IF NOT EXISTS idx_clients_activo ON clients(activo);
        `);

        // 3. Create Appointments (Turnos) Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS appointments (
            id VARCHAR(64) PRIMARY KEY,
            cliente_id VARCHAR(64),
            codigo VARCHAR(64) NOT NULL UNIQUE,
            nombre VARCHAR(255) NOT NULL,
            apellido VARCHAR(255) NOT NULL,
            telefono VARCHAR(64) NOT NULL,
            email VARCHAR(255),
            servicio_id VARCHAR(64) NOT NULL,
            servicio_nombre VARCHAR(255) NOT NULL,
            duracion_minutos INTEGER NOT NULL,
            precio NUMERIC NOT NULL,
            fecha VARCHAR(10) NOT NULL,
            hora_inicio VARCHAR(10) NOT NULL,
            hora_fin VARCHAR(10) NOT NULL,
            observaciones TEXT,
            estado VARCHAR(32) DEFAULT 'pendiente',
            notas_admin TEXT,
            browser_id VARCHAR(128),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cliente_id VARCHAR(64);
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS browser_id VARCHAR(128);
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS profesional_id VARCHAR(64);
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS profesional_nombre VARCHAR(255);
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelado_en TIMESTAMP WITH TIME ZONE;
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelado_origen VARCHAR(64);
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelado_por VARCHAR(255);
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS descuento_tipo VARCHAR(32);
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS descuento_id VARCHAR(64);
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS descuento_codigo VARCHAR(64);
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS descuento_nombre VARCHAR(255);
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS descuento_porcentaje NUMERIC;
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS descuento_monto NUMERIC;
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS precio_original NUMERIC;
          ALTER TABLE appointments ADD COLUMN IF NOT EXISTS precio_final NUMERIC;

          CREATE INDEX IF NOT EXISTS idx_appointments_fecha ON appointments(fecha);
          CREATE INDEX IF NOT EXISTS idx_appointments_estado ON appointments(estado);
          CREATE INDEX IF NOT EXISTS idx_appointments_cliente_id ON appointments(cliente_id);
          CREATE INDEX IF NOT EXISTS idx_appointments_profesional_id ON appointments(profesional_id);
          CREATE INDEX IF NOT EXISTS idx_appointments_descuento ON appointments(descuento_id, descuento_codigo);
        `);

        // 4. Create Studio Config Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS studio_config (
            id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
            config JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `);

        // 5. Create Client Alerts Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS client_alerts (
            id VARCHAR(64) PRIMARY KEY,
            cliente_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            tipo VARCHAR(64) NOT NULL,
            descripcion TEXT NOT NULL,
            producto_servicio_relacionado VARCHAR(255),
            fecha VARCHAR(10) NOT NULL,
            severidad VARCHAR(32) NOT NULL DEFAULT 'moderada',
            activa BOOLEAN NOT NULL DEFAULT TRUE,
            observaciones TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_client_alerts_cliente_id ON client_alerts(cliente_id);
          CREATE INDEX IF NOT EXISTS idx_client_alerts_activa ON client_alerts(activa);
        `);

        // 6. Create Client Preferences Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS client_preferences (
            id VARCHAR(64) PRIMARY KEY,
            cliente_id VARCHAR(64) NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
            forma_unas VARCHAR(128),
            largo_habitual VARCHAR(128),
            estilo VARCHAR(128),
            colores_preferidos JSONB DEFAULT '[]',
            productos_preferidos TEXT,
            productos_evitar TEXT,
            observaciones_generales TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_client_preferences_cliente_id ON client_preferences(cliente_id);
        `);

        // 7. Create Client Tips Config Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS client_tips_config (
            id VARCHAR(64) PRIMARY KEY,
            cliente_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            mano VARCHAR(32) NOT NULL,
            dedo VARCHAR(32) NOT NULL,
            tamano_tip VARCHAR(32) NOT NULL,
            marca_modelo VARCHAR(128),
            observaciones TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_client_tips_cliente_id ON client_tips_config(cliente_id);
        `);

        // 8. Create Professionals Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS professionals (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64),
            nombre VARCHAR(255) NOT NULL,
            apellido VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            telefono VARCHAR(64),
            foto_url TEXT,
            color_agenda VARCHAR(32) DEFAULT '#8E4455',
            titulo VARCHAR(255),
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_professionals_activo ON professionals(activo);
        `);

        // 9. Create Users Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            salt VARCHAR(64) NOT NULL,
            rol VARCHAR(32) NOT NULL DEFAULT 'empleado',
            profesional_id VARCHAR(64) REFERENCES professionals(id) ON DELETE SET NULL,
            activo BOOLEAN DEFAULT TRUE,
            nombre VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
          CREATE INDEX IF NOT EXISTS idx_users_activo ON users(activo);
        `);

        // 10. Create Professional Services Table (Many-to-Many)
        await client.query(`
          CREATE TABLE IF NOT EXISTS professional_services (
            id VARCHAR(64) PRIMARY KEY,
            profesional_id VARCHAR(64) NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
            servicio_id VARCHAR(64) NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT unique_prof_service UNIQUE (profesional_id, servicio_id)
          );

          CREATE INDEX IF NOT EXISTS idx_prof_services_prof ON professional_services(profesional_id);
          CREATE INDEX IF NOT EXISTS idx_prof_services_serv ON professional_services(servicio_id);
        `);

        // 11. Create Weekly Schedules Table (With Versioning / fecha_vigencia)
        await client.query(`
          CREATE TABLE IF NOT EXISTS schedules (
            id VARCHAR(64) PRIMARY KEY,
            alcance VARCHAR(32) NOT NULL DEFAULT 'local',
            profesional_id VARCHAR(64),
            fecha_vigencia VARCHAR(10) NOT NULL DEFAULT '2020-01-01',
            dias JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_schedules_vigencia ON schedules(alcance, profesional_id, fecha_vigencia);
        `);

        // 12. Create Availability Exceptions Table ("Excepción de disponibilidad")
        await client.query(`
          CREATE TABLE IF NOT EXISTS availability_exceptions (
            id VARCHAR(64) PRIMARY KEY,
            alcance VARCHAR(32) NOT NULL DEFAULT 'local',
            profesional_id VARCHAR(64),
            fecha VARCHAR(10) NOT NULL,
            tipo VARCHAR(32) NOT NULL DEFAULT 'horario_especial',
            intervalos JSONB DEFAULT '[]',
            motivo TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_avail_exceptions_fecha ON availability_exceptions(fecha, alcance, profesional_id);
        `);

        // 13. Create Notification Logs Table (Decoupled Notification Service & Idempotency)
        await client.query(`
          CREATE TABLE IF NOT EXISTS notification_logs (
            id VARCHAR(64) PRIMARY KEY,
            appointment_id VARCHAR(64),
            channel VARCHAR(32) NOT NULL,
            recipient VARCHAR(255),
            notification_type VARCHAR(64) NOT NULL,
            status VARCHAR(32) NOT NULL,
            subject TEXT,
            message TEXT,
            idempotency_key VARCHAR(128) UNIQUE,
            error TEXT,
            sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            metadata JSONB
          );

          CREATE INDEX IF NOT EXISTS idx_notif_logs_apt ON notification_logs(appointment_id);
          CREATE INDEX IF NOT EXISTS idx_notif_logs_idempotency ON notification_logs(idempotency_key);
        `);

        // 14. Create Promotions Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS promotions (
            id VARCHAR(64) PRIMARY KEY,
            codigo VARCHAR(64) NOT NULL UNIQUE,
            nombre VARCHAR(255) NOT NULL,
            descripcion TEXT,
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            tipo_descuento VARCHAR(32) NOT NULL DEFAULT 'porcentaje',
            valor_descuento NUMERIC NOT NULL,
            fecha_inicio VARCHAR(10) NOT NULL,
            fecha_vencimiento VARCHAR(10),
            limite_total_usos INTEGER,
            limite_uso_por_cliente INTEGER,
            periodo_reutilizacion_dias INTEGER,
            servicios_aplicables JSONB NOT NULL DEFAULT '["todos"]',
            monto_minimo NUMERIC,
            usos_actuales INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_promotions_codigo ON promotions(codigo);
          CREATE INDEX IF NOT EXISTS idx_promotions_activo ON promotions(activo);
        `);

        // 15. Create Promotion Usages Table (Audit trail of every public promotion usage)
        await client.query(`
          CREATE TABLE IF NOT EXISTS promotion_usages (
            id VARCHAR(64) PRIMARY KEY,
            promocion_id VARCHAR(64) NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
            codigo VARCHAR(64) NOT NULL,
            cliente_id VARCHAR(64),
            cliente_telefono VARCHAR(64),
            cliente_email VARCHAR(255),
            turno_id VARCHAR(64),
            descuento_aplicado NUMERIC NOT NULL,
            precio_original NUMERIC NOT NULL,
            precio_final NUMERIC NOT NULL,
            fecha_uso TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_promo_usages_promo ON promotion_usages(promocion_id);
          CREATE INDEX IF NOT EXISTS idx_promo_usages_cliente ON promotion_usages(cliente_id);
          CREATE INDEX IF NOT EXISTS idx_promo_usages_tel ON promotion_usages(cliente_telefono);
        `);

        // 16. Create Client Benefits Table (Administrative benefits granted to individual clients)
        await client.query(`
          CREATE TABLE IF NOT EXISTS client_benefits (
            id VARCHAR(64) PRIMARY KEY,
            cliente_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            cliente_nombre VARCHAR(255),
            cliente_telefono VARCHAR(64),
            cliente_email VARCHAR(255),
            titulo VARCHAR(255) NOT NULL,
            descripcion TEXT,
            tipo_descuento VARCHAR(32) NOT NULL DEFAULT 'porcentaje',
            valor_descuento NUMERIC NOT NULL,
            origen VARCHAR(64) NOT NULL DEFAULT 'admin',
            origen_detalle TEXT,
            fecha_emision VARCHAR(10) NOT NULL,
            fecha_vencimiento VARCHAR(10),
            estado VARCHAR(32) NOT NULL DEFAULT 'disponible',
            turno_origen_id VARCHAR(64),
            turno_origen_codigo VARCHAR(64),
            turno_uso_id VARCHAR(64),
            turno_uso_codigo VARCHAR(64),
            usado_en TIMESTAMP WITH TIME ZONE,
            servicios_aplicables JSONB NOT NULL DEFAULT '["todos"]',
            monto_minimo NUMERIC,
            descuento_aplicado NUMERIC,
            otorgado_por VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_client_benefits_cliente ON client_benefits(cliente_id);
          CREATE INDEX IF NOT EXISTS idx_client_benefits_estado ON client_benefits(estado);
          CREATE INDEX IF NOT EXISTS idx_client_benefits_tel ON client_benefits(cliente_telefono);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_client_benefits_turno_origen ON client_benefits(turno_origen_id) WHERE turno_origen_id IS NOT NULL;
        `);

        // Seed initial promotions if empty
        const promoCountRes = await client.query('SELECT COUNT(*) FROM promotions');
        if (parseInt(promoCountRes.rows[0].count, 10) === 0) {
          console.log('🌱 Seeding initial promotions to PostgreSQL...');
          for (const p of defaultPromotions) {
            await client.query(`
              INSERT INTO promotions (
                id, codigo, nombre, descripcion, activo, tipo_descuento, valor_descuento,
                fecha_inicio, fecha_vencimiento, limite_total_usos, limite_uso_por_cliente,
                periodo_reutilizacion_dias, servicios_aplicables, monto_minimo, usos_actuales
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              ON CONFLICT (id) DO NOTHING;
            `, [
              p.id,
              p.codigo,
              p.nombre,
              p.descripcion || null,
              p.activo,
              p.tipoDescuento,
              p.valorDescuento,
              p.fechaInicio,
              p.fechaVencimiento || null,
              p.limiteTotalUsos || null,
              p.limiteUsoPorCliente || null,
              p.periodoReutilizacionDias || null,
              JSON.stringify(p.serviciosAplicables || ['todos']),
              p.montoMinimo || null,
              p.usosActuales || 0
            ]);
          }
        }

        // Seed initial services if empty
        const countRes = await client.query('SELECT COUNT(*) FROM services');
        if (parseInt(countRes.rows[0].count, 10) === 0) {
          console.log('🌱 Seeding initial nail studio services to PostgreSQL...');
          for (const s of defaultServices) {
            await client.query(`
              INSERT INTO services (id, nombre, slug, categoria, descripcion, duracion_minutos, precio, es_popular, icono, detalles, activo)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (id) DO NOTHING;
            `, [
              s.id,
              s.nombre,
              s.slug,
              s.categoria,
              s.descripcion,
              s.duracionMinutos,
              s.precio,
              s.esPopular,
              s.icono,
              JSON.stringify(s.detalles || []),
              s.activo
            ]);
          }
        }

        // Seed initial professionals if empty
        const profCount = await client.query('SELECT COUNT(*) FROM professionals');
        if (parseInt(profCount.rows[0].count, 10) === 0) {
          console.log('🌱 Seeding default professional to PostgreSQL...');
          await client.query(`
            INSERT INTO professionals (id, nombre, apellido, email, telefono, foto_url, color_agenda, titulo, activo, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
          `, [
            defaultProfessional.id,
            defaultProfessional.nombre,
            defaultProfessional.apellido,
            defaultProfessional.email || null,
            defaultProfessional.telefono || null,
            defaultProfessional.fotoUrl || null,
            defaultProfessional.colorAgenda,
            defaultProfessional.titulo || null,
            defaultProfessional.activo
          ]);
        }

        // Seed initial users if empty
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        if (parseInt(userCount.rows[0].count, 10) === 0) {
          console.log('🌱 Seeding default admin user to PostgreSQL...');
          await client.query(`
            INSERT INTO users (id, email, password_hash, salt, rol, profesional_id, activo, nombre, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
          `, [
            defaultUserAdmin.id,
            defaultUserAdmin.email,
            defaultUserAdmin.passwordHash,
            defaultUserAdmin.salt,
            defaultUserAdmin.rol,
            defaultUserAdmin.profesionalId || null,
            defaultUserAdmin.activo,
            defaultUserAdmin.nombre || null
          ]);
        }

        // Seed professional_services relations if empty
        const psCount = await client.query('SELECT COUNT(*) FROM professional_services');
        if (parseInt(psCount.rows[0].count, 10) === 0) {
          for (const s of defaultServices) {
            await client.query(`
              INSERT INTO professional_services (id, profesional_id, servicio_id, activo, created_at)
              VALUES ($1, $2, $3, $4, NOW())
              ON CONFLICT (profesional_id, servicio_id) DO NOTHING;
            `, [`ps-${defaultProfessional.id}-${s.id}`, defaultProfessional.id, s.id, true]);
          }
        }

        // Seed initial schedules if empty
        const schedCount = await client.query('SELECT COUNT(*) FROM schedules');
        if (parseInt(schedCount.rows[0].count, 10) === 0) {
          await client.query(`
            INSERT INTO schedules (id, alcance, profesional_id, fecha_vigencia, dias, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
          `, [defaultStudioSchedule.id, defaultStudioSchedule.alcance, null, defaultStudioSchedule.fechaVigencia, JSON.stringify(defaultStudioSchedule.dias)]);

          await client.query(`
            INSERT INTO schedules (id, alcance, profesional_id, fecha_vigencia, dias, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
          `, [defaultProfessionalSchedule.id, defaultProfessionalSchedule.alcance, defaultProfessionalSchedule.profesionalId || null, defaultProfessionalSchedule.fechaVigencia, JSON.stringify(defaultProfessionalSchedule.dias)]);
        }

        // Seed initial studio config if empty
        const configCount = await client.query('SELECT COUNT(*) FROM studio_config WHERE id = $1', ['default']);
        if (parseInt(configCount.rows[0].count, 10) === 0) {
          await client.query(`
            INSERT INTO studio_config (id, config)
            VALUES ($1, $2)
            ON CONFLICT (id) DO NOTHING;
          `, ['default', JSON.stringify(defaultStudioConfig)]);
        }

        isPostgresConnected = true;
        console.log('✅ PostgreSQL connected & schema verified successfully.');
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('❌ Could not connect to PostgreSQL:', err);
      if (isProd) {
        const errMsg = 'ERROR CRÍTICO EN PRODUCCIÓN: PostgreSQL no está disponible y el fallback JSON está prohibido en producción.';
        console.error(errMsg);
        throw new Error(errMsg);
      }
      console.warn('⚠️ Could not connect to PostgreSQL, falling back to local storage (Development mode):', err);
      isPostgresConnected = false;
      loadLocalFileDb();
    }
  } else {
    if (isProd) {
      const errMsg = 'ERROR CRÍTICO: No se pudo configurar el pool de PostgreSQL en producción.';
      console.error(errMsg);
      throw new Error(errMsg);
    }
    console.log('📁 No DATABASE_URL specified. Running with local filesystem storage.');
    loadLocalFileDb();
  }

  // Automatic backfill migration
  await backfillAppointmentsClients();
}

/**
 * Migration helper: inspects existing appointments and ensures each has
 * an associated Client entity and default Professional entity.
 */
async function backfillAppointmentsClients() {
  try {
    // Migrate legacy 'confirmado' or 'confirmed' status to 'pendiente'
    if (isPostgresConnected && pgPool) {
      await pgPool.query(`UPDATE appointments SET estado = 'pendiente' WHERE estado = 'confirmado' OR estado = 'confirmed'`);
    }

    const appointments = await getAppointments();
    if (!appointments || appointments.length === 0) return;

    let hasUpdates = false;
    for (const apt of appointments) {
      // Migrate in-memory legacy status
      if ((apt.estado as string) === 'confirmado' || (apt.estado as string) === 'confirmed') {
        apt.estado = 'pendiente';
        hasUpdates = true;
      }

      // Backfill missing professional
      if (!apt.profesionalId) {
        apt.profesionalId = defaultProfessional.id;
        apt.profesionalNombre = `${defaultProfessional.nombre} ${defaultProfessional.apellido}`;
        hasUpdates = true;
        if (isPostgresConnected && pgPool) {
          await pgPool.query('UPDATE appointments SET profesional_id = $1, profesional_nombre = $2 WHERE id = $3', [
            apt.profesionalId,
            apt.profesionalNombre,
            apt.id
          ]);
        }
      }

      if (!apt.clienteId) {
        const client = await findOrCreateClientForBooking({
          nombre: apt.nombre,
          apellido: apt.apellido,
          telefono: apt.telefono,
          email: apt.email,
          fecha: apt.fecha,
          browserId: apt.browserId
        });

        apt.clienteId = client.id;
        hasUpdates = true;

        if (isPostgresConnected && pgPool) {
          await pgPool.query('UPDATE appointments SET cliente_id = $1 WHERE id = $2', [client.id, apt.id]);
        }
      }
    }

    if (hasUpdates && !isPostgresConnected) {
      saveLocalFileDb();
    }
  } catch (err) {
    console.error('Error during backfillAppointmentsClients migration:', err);
  }
}

// ---------------------------------------------------------------------------
// CLIENT MANAGEMENT & MATCHING ENGINE (Dual PostgreSQL / Fallback)
// ---------------------------------------------------------------------------

export async function getClients(filter?: {
  search?: string;
  category?: 'todos' | 'recurrentes' | 'nuevos' | 'inactivos' | 'duplicados' | 'proximos';
  activeOnly?: boolean;
}): Promise<Client[]> {
  const activeOnly = filter?.activeOnly !== false;
  let rawClients: Client[] = [];

  if (isPostgresConnected && pgPool) {
    try {
      const conditions: string[] = [];
      const values: any[] = [];

      if (activeOnly) {
        conditions.push(`activo = true`);
      }

      if (filter?.search && filter.search.trim().length > 0) {
        const qClean = filter.search.trim().toLowerCase();
        const qNorm = normalizeText(filter.search.trim());
        const qPhone = filter.search.replace(/\D/g, '');

        values.push(`%${qClean}%`); // $1
        values.push(`%${qNorm}%`);  // $2
        
        if (qPhone.length >= 3) {
          values.push(`%${qPhone}%`); // $3
          conditions.push(`(
            LOWER(nombre) LIKE $1 OR
            LOWER(apellido) LIKE $1 OR
            LOWER(COALESCE(email, '')) LIKE $1 OR
            telefono LIKE $1 OR
            nombre_normalizado LIKE $2 OR
            apellido_normalizado LIKE $2 OR
            telefono_normalizado LIKE $3
          )`);
        } else {
          conditions.push(`(
            LOWER(nombre) LIKE $1 OR
            LOWER(apellido) LIKE $1 OR
            LOWER(COALESCE(email, '')) LIKE $1 OR
            telefono LIKE $1 OR
            nombre_normalizado LIKE $2 OR
            apellido_normalizado LIKE $2
          )`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM clients ${whereClause} ORDER BY created_at DESC`;
      const res = await pgPool.query(query, values);

      rawClients = res.rows.map(row => ({
        id: row.id,
        nombre: row.nombre,
        apellido: row.apellido,
        telefono: row.telefono,
        telefonoNormalizado: row.telefono_normalizado,
        email: row.email || undefined,
        emailNormalizado: row.email_normalizado || undefined,
        nombreNormalizado: row.nombre_normalizado,
        apellidoNormalizado: row.apellido_normalizado,
        notasAdmin: row.notas_admin || undefined,
        fechaAlta: row.fecha_alta ? new Date(row.fecha_alta).toISOString() : new Date().toISOString(),
        fechaUltimaVisita: row.fecha_ultima_visita || undefined,
        activo: Boolean(row.activo),
        browserId: row.browser_id || undefined,
        posibleDuplicadoDe: Array.isArray(row.posible_duplicado_de) ? row.posible_duplicado_de : (typeof row.posible_duplicado_de === 'string' ? JSON.parse(row.posible_duplicado_de) : []),
        motivoPosibleDuplicado: row.motivo_posible_duplicado || undefined,
        nivelCoincidenciaDuplicado: row.nivel_coincidencia_duplicado ? Number(row.nivel_coincidencia_duplicado) : undefined,
        duplicadoRevisado: Boolean(row.duplicado_revisado),
        fusionadoConId: row.fusionado_con_id || undefined,
        fechaFusion: row.fecha_fusion ? new Date(row.fecha_fusion).toISOString() : undefined
      }));
    } catch (err) {
      console.error('Error fetching clients from PostgreSQL:', err);
      rawClients = [...memoryDb.clients];
    }
  } else {
    rawClients = [...memoryDb.clients];
    if (activeOnly) {
      rawClients = rawClients.filter(c => c.activo !== false);
    }
  }

  const studioConfig = await getStudioConfig();
  const diasInactividad = studioConfig.diasInactividadCliente || 60;
  const minRecurrente = studioConfig.minTurnosRecurrente || 2;
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const inactivityDaysAgo = new Date(Date.now() - diasInactividad * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const allActiveAlerts = await getClientAlerts(undefined, true);
  const allAppointments = await getAppointments();

  const enrichedClients = rawClients.map(client => {
    const clientApts = allAppointments.filter(a =>
      a.clienteId === client.id ||
      (a.telefono && normalizePhone(a.telefono).nationalDigits === client.telefonoNormalizado)
    );

    const totalTurnos = clientApts.length;
    const totalGastado = clientApts.reduce((acc, a) => acc + (a.precio || 0), 0);

    const sortedApts = [...clientApts].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio));
    const primerTurnoFecha = sortedApts.length > 0 ? sortedApts[0].fecha : undefined;
    
    // Future appointments
    const upcomingApts = sortedApts.filter(a => a.fecha >= todayStr && a.estado !== 'cancelado');
    const nextApt = upcomingApts[0];

    // Past appointments
    const pastApts = sortedApts.filter(a => a.fecha <= todayStr);
    const lastVisit = pastApts.length > 0 ? pastApts[pastApts.length - 1].fecha : client.fechaUltimaVisita;

    const servicesCount: Record<string, number> = {};
    clientApts.forEach(a => {
      if (a.servicioNombre) {
        servicesCount[a.servicioNombre] = (servicesCount[a.servicioNombre] || 0) + 1;
      }
    });
    const serviciosHistorial = Object.entries(servicesCount)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const clientAlerts = allActiveAlerts.filter(al => al.clienteId === client.id);

    return {
      ...client,
      totalTurnos,
      totalGastado,
      primerTurnoFecha,
      fechaUltimaVisita: lastVisit,
      proximoTurno: nextApt ? nextApt.fecha : undefined,
      proximoTurnoHora: nextApt ? nextApt.horaInicio : undefined,
      proximoTurnoServicio: nextApt ? nextApt.servicioNombre : undefined,
      serviciosHistorial,
      alertasActivasCount: clientAlerts.length,
      alertasActivas: clientAlerts
    };
  });

  // Apply Category / Segment Filters
  let result = enrichedClients;
  if (filter?.category && filter.category !== 'todos') {
    if (filter.category === 'recurrentes') {
      result = result.filter(c => (c.totalTurnos || 0) >= minRecurrente);
    } else if (filter.category === 'nuevos') {
      result = result.filter(c => c.fechaAlta >= thirtyDaysAgo || (c.primerTurnoFecha && c.primerTurnoFecha >= thirtyDaysAgo));
    } else if (filter.category === 'inactivos') {
      result = result.filter(c => !c.fechaUltimaVisita || c.fechaUltimaVisita < inactivityDaysAgo);
    } else if (filter.category === 'proximos') {
      result = result.filter(c => Boolean(c.proximoTurno));
    } else if (filter.category === 'duplicados') {
      result = result.filter(c => Boolean(c.posibleDuplicadoDe && c.posibleDuplicadoDe.length > 0 && !c.duplicadoRevisado));
    }
  }

  if (filter?.search && filter.search.trim().length > 0 && (!isPostgresConnected || !pgPool)) {
    const q = filter.search.toLowerCase().trim();
    const qNorm = normalizeText(filter.search.trim());
    const qPhone = filter.search.replace(/\D/g, '');
    result = result.filter(c => {
      const matchName = c.nombre.toLowerCase().includes(q) || c.nombreNormalizado.includes(qNorm);
      const matchApellido = c.apellido.toLowerCase().includes(q) || c.apellidoNormalizado.includes(qNorm);
      const matchFullName = `${c.nombre.toLowerCase()} ${c.apellido.toLowerCase()}`.includes(q) ||
                            `${c.nombreNormalizado} ${c.apellidoNormalizado}`.includes(qNorm);
      const matchEmail = Boolean(c.email && c.email.toLowerCase().includes(q));
      const matchPhone = c.telefono.includes(q) || (qPhone.length >= 3 && c.telefonoNormalizado.includes(qPhone));
      const matchNotas = Boolean(c.notasAdmin && c.notasAdmin.toLowerCase().includes(q));
      return matchName || matchApellido || matchFullName || matchEmail || matchPhone || matchNotas;
    });
  }

  return result;
}

export async function getClientById(id: string): Promise<ClientWithFullProfile | null> {
  const clients = await getClients({ activeOnly: false });
  const client = clients.find(c => c.id === id);
  if (!client) return null;

  const allAppointments = await getAppointments();
  const clientApts = allAppointments
    .filter(a => a.clienteId === client.id || (a.telefono && normalizePhone(a.telefono).nationalDigits === client.telefonoNormalizado))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.horaInicio.localeCompare(a.horaInicio));

  const alerts = await getClientAlerts(client.id);
  const preferences = await getClientPreferences(client.id);
  const tipsConfig = await getClientTipsConfig(client.id);

  return {
    client,
    appointments: clientApts,
    alerts,
    preferences,
    tipsConfig
  };
}

export async function createClient(clientData: Partial<Client> & { nombre: string; apellido: string; telefono: string }): Promise<Client> {
  const id = clientData.id || crypto.randomUUID();
  const phoneNorm = normalizePhone(clientData.telefono);
  const emailNorm = normalizeEmail(clientData.email);
  const cleanNombre = normalizePersonName(clientData.nombre);
  const cleanApellido = normalizePersonName(clientData.apellido);

  const client: Client = {
    id,
    nombre: cleanNombre,
    apellido: cleanApellido,
    telefono: clientData.telefono.trim(),
    telefonoNormalizado: phoneNorm.nationalDigits,
    email: clientData.email ? emailNorm : undefined,
    emailNormalizado: emailNorm || undefined,
    nombreNormalizado: normalizeText(cleanNombre),
    apellidoNormalizado: normalizeText(cleanApellido),
    notasAdmin: clientData.notasAdmin || undefined,
    fechaAlta: clientData.fechaAlta || new Date().toISOString(),
    fechaUltimaVisita: clientData.fechaUltimaVisita || undefined,
    activo: clientData.activo !== undefined ? clientData.activo : true,
    browserId: clientData.browserId || undefined,
    posibleDuplicadoDe: clientData.posibleDuplicadoDe || [],
    motivoPosibleDuplicado: clientData.motivoPosibleDuplicado || undefined,
    nivelCoincidenciaDuplicado: clientData.nivelCoincidenciaDuplicado,
    duplicadoRevisado: Boolean(clientData.duplicadoRevisado)
  };

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO clients (
          id, nombre, apellido, telefono, telefono_normalizado, email, email_normalizado,
          nombre_normalizado, apellido_normalizado, notas_admin, fecha_alta, fecha_ultima_visita,
          activo, browser_id, posible_duplicado_de, motivo_posible_duplicado, nivel_coincidencia_duplicado,
          duplicado_revisado, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, NOW(), NOW()
        )
      `, [
        client.id,
        client.nombre,
        client.apellido,
        client.telefono,
        client.telefonoNormalizado,
        client.email || null,
        client.emailNormalizado || null,
        client.nombreNormalizado,
        client.apellidoNormalizado,
        client.notasAdmin || null,
        client.fechaAlta,
        client.fechaUltimaVisita || null,
        client.activo,
        client.browserId || null,
        JSON.stringify(client.posibleDuplicadoDe || []),
        client.motivoPosibleDuplicado || null,
        client.nivelCoincidenciaDuplicado || null,
        client.duplicadoRevisado
      ]);
      return client;
    } catch (err) {
      console.error('Error creating client in PostgreSQL:', err);
    }
  }

  memoryDb.clients.unshift(client);
  saveLocalFileDb();
  return client;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
  if (isPostgresConnected && pgPool) {
    try {
      const currentRes = await pgPool.query('SELECT * FROM clients WHERE id = $1', [id]);
      if (currentRes.rows.length === 0) return null;

      const curr = currentRes.rows[0];
      const newNombre = updates.nombre !== undefined ? normalizePersonName(updates.nombre) : curr.nombre;
      const newApellido = updates.apellido !== undefined ? normalizePersonName(updates.apellido) : curr.apellido;
      const newTelefono = updates.telefono !== undefined ? updates.telefono.trim() : curr.telefono;
      const newEmail = updates.email !== undefined ? normalizeEmail(updates.email) : curr.email;

      const phoneNorm = normalizePhone(newTelefono);
      const emailNorm = normalizeEmail(newEmail);

      await pgPool.query(`
        UPDATE clients
        SET nombre = $2,
            apellido = $3,
            telefono = $4,
            telefono_normalizado = $5,
            email = $6,
            email_normalizado = $7,
            nombre_normalizado = $8,
            apellido_normalizado = $9,
            notas_admin = COALESCE($10, notas_admin),
            fecha_ultima_visita = COALESCE($11, fecha_ultima_visita),
            activo = COALESCE($12, activo),
            posible_duplicado_de = COALESCE($13, posible_duplicado_de),
            motivo_posible_duplicado = COALESCE($14, motivo_posible_duplicado),
            nivel_coincidencia_duplicado = COALESCE($15, nivel_coincidencia_duplicado),
            duplicado_revisado = COALESCE($16, duplicado_revisado),
            updated_at = NOW()
        WHERE id = $1
      `, [
        id,
        newNombre,
        newApellido,
        newTelefono,
        phoneNorm.nationalDigits,
        newEmail || null,
        emailNorm || null,
        normalizeText(newNombre),
        normalizeText(newApellido),
        updates.notasAdmin !== undefined ? updates.notasAdmin : null,
        updates.fechaUltimaVisita || null,
        updates.activo !== undefined ? updates.activo : null,
        updates.posibleDuplicadoDe !== undefined ? JSON.stringify(updates.posibleDuplicadoDe) : null,
        updates.motivoPosibleDuplicado !== undefined ? updates.motivoPosibleDuplicado : null,
        updates.nivelCoincidenciaDuplicado !== undefined ? updates.nivelCoincidenciaDuplicado : null,
        updates.duplicadoRevisado !== undefined ? updates.duplicadoRevisado : null
      ]);

      const updatedRes = await pgPool.query('SELECT * FROM clients WHERE id = $1', [id]);
      const row = updatedRes.rows[0];
      return {
        id: row.id,
        nombre: row.nombre,
        apellido: row.apellido,
        telefono: row.telefono,
        telefonoNormalizado: row.telefono_normalizado,
        email: row.email || undefined,
        emailNormalizado: row.email_normalizado || undefined,
        nombreNormalizado: row.nombre_normalizado,
        apellidoNormalizado: row.apellido_normalizado,
        notasAdmin: row.notas_admin || undefined,
        fechaAlta: row.fecha_alta ? new Date(row.fecha_alta).toISOString() : new Date().toISOString(),
        fechaUltimaVisita: row.fecha_ultima_visita || undefined,
        activo: Boolean(row.activo),
        browserId: row.browser_id || undefined,
        posibleDuplicadoDe: Array.isArray(row.posible_duplicado_de) ? row.posible_duplicado_de : (typeof row.posible_duplicado_de === 'string' ? JSON.parse(row.posible_duplicado_de) : []),
        motivoPosibleDuplicado: row.motivo_posible_duplicado || undefined,
        nivelCoincidenciaDuplicado: row.nivel_coincidencia_duplicado ? Number(row.nivel_coincidencia_duplicado) : undefined,
        duplicadoRevisado: Boolean(row.duplicado_revisado)
      };
    } catch (err) {
      console.error('Error updating client in PostgreSQL:', err);
    }
  }

  const idx = memoryDb.clients.findIndex(c => c.id === id);
  if (idx === -1) return null;

  const current = memoryDb.clients[idx];
  const cleanNombre = updates.nombre !== undefined ? normalizePersonName(updates.nombre) : current.nombre;
  const cleanApellido = updates.apellido !== undefined ? normalizePersonName(updates.apellido) : current.apellido;
  const cleanEmail = updates.email !== undefined ? normalizeEmail(updates.email) : current.email;

  const updated: Client = {
    ...current,
    ...updates,
    nombre: cleanNombre,
    apellido: cleanApellido,
    email: cleanEmail || undefined,
    nombreNormalizado: normalizeText(cleanNombre),
    apellidoNormalizado: normalizeText(cleanApellido),
    telefonoNormalizado: updates.telefono ? normalizePhone(updates.telefono).nationalDigits : current.telefonoNormalizado,
    emailNormalizado: cleanEmail ? normalizeEmail(cleanEmail) : current.emailNormalizado
  };

  memoryDb.clients[idx] = updated;
  saveLocalFileDb();
  return updated;
}

export async function deleteClient(id: string): Promise<boolean> {
  const updated = await updateClient(id, { activo: false });
  return Boolean(updated);
}

/**
 * Intelligent Matching Engine for Incoming Booking Requests:
 * Evaluates candidate clients without forcing registration or logins.
 */
export async function findOrCreateClientForBooking(incoming: {
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string;
  fecha?: string;
  browserId?: string;
}): Promise<Client> {
  const existingClients = await getClients({ activeOnly: true });
  const matchResult = evaluateClientMatch(incoming, existingClients);

  if (matchResult.isMatch && matchResult.matchedClient) {
    const matched = matchResult.matchedClient;
    const updates: Partial<Client> = {};

    if (incoming.fecha && (!matched.fechaUltimaVisita || incoming.fecha > matched.fechaUltimaVisita)) {
      updates.fechaUltimaVisita = incoming.fecha;
    }
    if (incoming.email && !matched.email) {
      updates.email = incoming.email;
    }
    if (incoming.browserId && !matched.browserId) {
      updates.browserId = incoming.browserId;
    }

    if (Object.keys(updates).length > 0) {
      await updateClient(matched.id, updates);
    }

    return matched;
  }

  // Create new client record
  const newClientData: Partial<Client> & { nombre: string; apellido: string; telefono: string } = {
    id: crypto.randomUUID(),
    nombre: incoming.nombre,
    apellido: incoming.apellido,
    telefono: incoming.telefono,
    email: incoming.email,
    fechaAlta: new Date().toISOString(),
    fechaUltimaVisita: incoming.fecha || new Date().toISOString().split('T')[0],
    activo: true,
    browserId: incoming.browserId
  };

  if (matchResult.isPotentialDuplicate && matchResult.duplicateCandidate) {
    newClientData.posibleDuplicadoDe = [matchResult.duplicateCandidate.id];
    newClientData.motivoPosibleDuplicado = matchResult.duplicateReason;
    newClientData.nivelCoincidenciaDuplicado = matchResult.confidence;
    newClientData.duplicadoRevisado = false;

    // Link back to duplicate candidate for bidirectional visibility
    const candidateDuplicates = matchResult.duplicateCandidate.posibleDuplicadoDe || [];
    if (!candidateDuplicates.includes(newClientData.id!)) {
      await updateClient(matchResult.duplicateCandidate.id, {
        posibleDuplicadoDe: [...candidateDuplicates, newClientData.id!],
        motivoPosibleDuplicado: matchResult.duplicateReason,
        nivelCoincidenciaDuplicado: matchResult.confidence,
        duplicadoRevisado: false
      });
    }
  }

  return await createClient(newClientData);
}

/**
 * Retrieves all detected duplicate pairs with full comparison data.
 */
export async function getPotentialDuplicatePairs(): Promise<DuplicatePair[]> {
  const clients = await getClients({ activeOnly: true });
  const allAppointments = await getAppointments();
  const pairs: DuplicatePair[] = [];
  const processedPairKeys = new Set<string>();

  for (const clientA of clients) {
    if (!clientA.posibleDuplicadoDe || clientA.posibleDuplicadoDe.length === 0 || clientA.duplicadoRevisado) {
      // Also check on the fly for potential name similarities with different phones
      for (const clientB of clients) {
        if (clientA.id === clientB.id) continue;
        const pairKey = [clientA.id, clientB.id].sort().join('__');
        if (processedPairKeys.has(pairKey)) continue;

        const sameName = clientA.nombreNormalizado === clientB.nombreNormalizado && clientA.apellidoNormalizado === clientB.apellidoNormalizado;
        const sim = stringSimilarity(`${clientA.nombreNormalizado} ${clientA.apellidoNormalizado}`, `${clientB.nombreNormalizado} ${clientB.apellidoNormalizado}`);

        if ((sameName || sim >= 0.88) && clientA.telefonoNormalizado !== clientB.telefonoNormalizado) {
          processedPairKeys.add(pairKey);
          const turnosA = allAppointments.filter(a => a.clienteId === clientA.id || normalizePhone(a.telefono).nationalDigits === clientA.telefonoNormalizado);
          const turnosB = allAppointments.filter(a => a.clienteId === clientB.id || normalizePhone(a.telefono).nationalDigits === clientB.telefonoNormalizado);

          pairs.push({
            id: pairKey,
            clienteA: clientA,
            clienteB: clientB,
            confianza: sameName ? 80 : Math.round(sim * 100),
            motivo: sameName ? 'Mismo nombre y apellido pero números de teléfono diferentes' : `Nombres muy similares (${Math.round(sim * 100)}%) con teléfonos distintos`,
            turnosA,
            turnosB
          });
        }
      }
      continue;
    }

    for (const otherId of clientA.posibleDuplicadoDe) {
      const clientB = clients.find(c => c.id === otherId);
      if (!clientB) continue;

      const pairKey = [clientA.id, clientB.id].sort().join('__');
      if (processedPairKeys.has(pairKey)) continue;
      processedPairKeys.add(pairKey);

      const turnosA = allAppointments.filter(a => a.clienteId === clientA.id || normalizePhone(a.telefono).nationalDigits === clientA.telefonoNormalizado);
      const turnosB = allAppointments.filter(a => a.clienteId === clientB.id || normalizePhone(a.telefono).nationalDigits === clientB.telefonoNormalizado);

      pairs.push({
        id: pairKey,
        clienteA: clientA,
        clienteB: clientB,
        confianza: clientA.nivelCoincidenciaDuplicado || 75,
        motivo: clientA.motivoPosibleDuplicado || 'Coincidencia parcial de datos personales',
        turnosA,
        turnosB
      });
    }
  }

  return pairs;
}

/**
 * Merges secondary client into primary client:
 * 1. Reassigns all appointments from secondary to primary.
 * 2. Merges internal notes & contact details.
 * 3. Deactivates secondary client and marks fusion timestamp.
 */
export async function mergeClients(primaryId: string, secondaryId: string, adminNotes?: string): Promise<{ primary: Client; migratedAppointmentsCount: number }> {
  const clients = await getClients({ activeOnly: false });
  const primary = clients.find(c => c.id === primaryId);
  const secondary = clients.find(c => c.id === secondaryId);

  if (!primary || !secondary) {
    throw new Error('Uno o ambos clientes no existen para realizar la fusión');
  }

  // 1. Reassign all appointments
  const allAppointments = await getAppointments();
  const secondaryAppointments = allAppointments.filter(a =>
    a.clienteId === secondary.id ||
    (a.telefono && normalizePhone(a.telefono).nationalDigits === secondary.telefonoNormalizado)
  );

  let migratedCount = 0;
  for (const apt of secondaryAppointments) {
    await updateAppointment(apt.id, { clienteId: primary.id } as any);
    if (isPostgresConnected && pgPool) {
      await pgPool.query('UPDATE appointments SET cliente_id = $1 WHERE id = $2', [primary.id, apt.id]);
    }
    migratedCount++;
  }

  // 2. Merge internal notes
  const combinedNotesParts: string[] = [];
  if (primary.notasAdmin) combinedNotesParts.push(primary.notasAdmin);
  if (secondary.notasAdmin) combinedNotesParts.push(`[Nota previa cuenta fusionada]: ${secondary.notasAdmin}`);
  if (adminNotes) combinedNotesParts.push(`[Fusión realizada]: ${adminNotes}`);
  combinedNotesParts.push(`[Historial]: Fusión de cliente ${secondary.nombre} ${secondary.apellido} (Tel: ${secondary.telefono}) el ${new Date().toLocaleDateString('es-AR')}`);

  const mergedNotes = combinedNotesParts.join('\n\n');

  // 3. Update primary client
  const oldestAlta = primary.fechaAlta < secondary.fechaAlta ? primary.fechaAlta : secondary.fechaAlta;
  const latestVisita = (primary.fechaUltimaVisita && secondary.fechaUltimaVisita)
    ? (primary.fechaUltimaVisita > secondary.fechaUltimaVisita ? primary.fechaUltimaVisita : secondary.fechaUltimaVisita)
    : (primary.fechaUltimaVisita || secondary.fechaUltimaVisita);

  const updatedPrimary = await updateClient(primary.id, {
    email: primary.email || secondary.email,
    fechaAlta: oldestAlta,
    fechaUltimaVisita: latestVisita,
    notasAdmin: mergedNotes,
    posibleDuplicadoDe: (primary.posibleDuplicadoDe || []).filter(id => id !== secondary.id),
    duplicadoRevisado: true
  });

  // 4. Mark secondary client as merged and inactive
  if (isPostgresConnected && pgPool) {
    await pgPool.query(`
      UPDATE clients
      SET activo = false,
          fusionado_con_id = $2,
          fecha_fusion = NOW(),
          duplicado_revisado = true,
          updated_at = NOW()
      WHERE id = $1
    `, [secondary.id, primary.id]);
  } else {
    const secIdx = memoryDb.clients.findIndex(c => c.id === secondary.id);
    if (secIdx !== -1) {
      memoryDb.clients[secIdx].activo = false;
      memoryDb.clients[secIdx].fusionadoConId = primary.id;
      memoryDb.clients[secIdx].fechaFusion = new Date().toISOString();
      memoryDb.clients[secIdx].duplicadoRevisado = true;
      saveLocalFileDb();
    }
  }

  return {
    primary: updatedPrimary || primary,
    migratedAppointmentsCount: migratedCount
  };
}

/**
 * Dismisses a potential duplicate pair without merging.
 */
export async function dismissDuplicatePair(idA: string, idB: string): Promise<boolean> {
  const clients = await getClients({ activeOnly: true });
  const clientA = clients.find(c => c.id === idA);
  const clientB = clients.find(c => c.id === idB);

  if (clientA) {
    const updatedA = (clientA.posibleDuplicadoDe || []).filter(id => id !== idB);
    await updateClient(clientA.id, { posibleDuplicadoDe: updatedA, duplicadoRevisado: true });
  }
  if (clientB) {
    const updatedB = (clientB.posibleDuplicadoDe || []).filter(id => id !== idA);
    await updateClient(clientB.id, { posibleDuplicadoDe: updatedB, duplicadoRevisado: true });
  }

  return true;
}

/**
 * Calculates global statistics and KPIs for clients.
 */
export async function getClientStats(): Promise<ClientStats> {
  const clients = await getClients({ activeOnly: true });
  const duplicates = await getPotentialDuplicatePairs();
  const studioConfig = await getStudioConfig();
  const diasInactividad = studioConfig.diasInactividadCliente || 60;
  const minRecurrente = studioConfig.minTurnosRecurrente || 2;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const inactivityDaysAgo = new Date(Date.now() - diasInactividad * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const totalClientes = clients.length;
  const clientesNuevos = clients.filter(c => c.fechaAlta >= thirtyDaysAgo || (c.primerTurnoFecha && c.primerTurnoFecha >= thirtyDaysAgo)).length;
  const clientesRecurrentes = clients.filter(c => (c.totalTurnos || 0) >= minRecurrente).length;
  const clientesInactivos = clients.filter(c => !c.fechaUltimaVisita || c.fechaUltimaVisita < inactivityDaysAgo).length;
  const clientesConProximosTurnos = clients.filter(c => Boolean(c.proximoTurno)).length;

  return {
    totalClientes,
    clientesNuevos,
    clientesRecurrentes,
    clientesInactivos,
    clientesConProximosTurnos,
    duplicadosPendientes: duplicates.length
  };
}

// ---------------------------------------------------------------------------
// CLIENT ALERTS & ANTECEDENTES
// ---------------------------------------------------------------------------

export async function getClientAlerts(clienteId?: string, activeOnly = false): Promise<ClientAlert[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      if (clienteId) {
        values.push(clienteId);
        conditions.push(`cliente_id = $${values.length}`);
      }
      if (activeOnly) {
        conditions.push(`activa = true`);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM client_alerts ${where} ORDER BY created_at DESC`;
      const res = await pgPool.query(query, values);
      return res.rows.map(row => ({
        id: row.id,
        clienteId: row.cliente_id,
        tipo: row.tipo as any,
        descripcion: row.descripcion,
        productoServicioRelacionado: row.producto_servicio_relacionado || undefined,
        fecha: row.fecha,
        severidad: row.severidad as any,
        activa: Boolean(row.activa),
        observaciones: row.observaciones || undefined,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.error('Error fetching alerts from PostgreSQL:', err);
    }
  }

  let alerts = [...(memoryDb.clientAlerts || [])];
  if (clienteId) {
    alerts = alerts.filter(a => a.clienteId === clienteId);
  }
  if (activeOnly) {
    alerts = alerts.filter(a => a.activa !== false);
  }
  return alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createClientAlert(alertData: Omit<ClientAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<ClientAlert> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const alert: ClientAlert = {
    id,
    clienteId: alertData.clienteId,
    tipo: alertData.tipo,
    descripcion: alertData.descripcion.trim(),
    productoServicioRelacionado: alertData.productoServicioRelacionado?.trim() || undefined,
    fecha: alertData.fecha || now.split('T')[0],
    severidad: alertData.severidad || 'moderada',
    activa: alertData.activa !== undefined ? alertData.activa : true,
    observaciones: alertData.observaciones?.trim() || undefined,
    createdAt: now,
    updatedAt: now
  };

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO client_alerts (
          id, cliente_id, tipo, descripcion, producto_servicio_relacionado,
          fecha, severidad, activa, observaciones, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        alert.id,
        alert.clienteId,
        alert.tipo,
        alert.descripcion,
        alert.productoServicioRelacionado || null,
        alert.fecha,
        alert.severidad,
        alert.activa,
        alert.observaciones || null
      ]);
      return alert;
    } catch (err) {
      console.error('Error creating client alert in PostgreSQL:', err);
    }
  }

  if (!memoryDb.clientAlerts) memoryDb.clientAlerts = [];
  memoryDb.clientAlerts.unshift(alert);
  saveLocalFileDb();
  return alert;
}

export async function updateClientAlert(id: string, updates: Partial<ClientAlert>): Promise<ClientAlert | null> {
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM client_alerts WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;

      await pgPool.query(`
        UPDATE client_alerts
        SET tipo = COALESCE($2, tipo),
            descripcion = COALESCE($3, descripcion),
            producto_servicio_relacionado = COALESCE($4, producto_servicio_relacionado),
            fecha = COALESCE($5, fecha),
            severidad = COALESCE($6, severidad),
            activa = COALESCE($7, activa),
            observaciones = COALESCE($8, observaciones),
            updated_at = NOW()
        WHERE id = $1
      `, [
        id,
        updates.tipo || null,
        updates.descripcion !== undefined ? updates.descripcion.trim() : null,
        updates.productoServicioRelacionado !== undefined ? updates.productoServicioRelacionado : null,
        updates.fecha || null,
        updates.severidad || null,
        updates.activa !== undefined ? updates.activa : null,
        updates.observaciones !== undefined ? updates.observaciones : null
      ]);

      const updated = await pgPool.query('SELECT * FROM client_alerts WHERE id = $1', [id]);
      const row = updated.rows[0];
      return {
        id: row.id,
        clienteId: row.cliente_id,
        tipo: row.tipo as any,
        descripcion: row.descripcion,
        productoServicioRelacionado: row.producto_servicio_relacionado || undefined,
        fecha: row.fecha,
        severidad: row.severidad as any,
        activa: Boolean(row.activa),
        observaciones: row.observaciones || undefined,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString()
      };
    } catch (err) {
      console.error('Error updating alert in PostgreSQL:', err);
    }
  }

  if (!memoryDb.clientAlerts) memoryDb.clientAlerts = [];
  const alert = memoryDb.clientAlerts.find(a => a.id === id);
  if (!alert) return null;
  if (updates.tipo) alert.tipo = updates.tipo;
  if (updates.descripcion !== undefined) alert.descripcion = updates.descripcion.trim();
  if (updates.productoServicioRelacionado !== undefined) alert.productoServicioRelacionado = updates.productoServicioRelacionado;
  if (updates.fecha) alert.fecha = updates.fecha;
  if (updates.severidad) alert.severidad = updates.severidad;
  if (updates.activa !== undefined) alert.activa = updates.activa;
  if (updates.observaciones !== undefined) alert.observaciones = updates.observaciones;
  alert.updatedAt = new Date().toISOString();
  saveLocalFileDb();
  return alert;
}

export async function deleteClientAlert(id: string): Promise<boolean> {
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('DELETE FROM client_alerts WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('Error deleting client alert from PostgreSQL:', err);
    }
  }

  if (!memoryDb.clientAlerts) memoryDb.clientAlerts = [];
  const idx = memoryDb.clientAlerts.findIndex(a => a.id === id);
  if (idx === -1) return false;
  memoryDb.clientAlerts.splice(idx, 1);
  saveLocalFileDb();
  return true;
}

// ---------------------------------------------------------------------------
// CLIENT PREFERENCES
// ---------------------------------------------------------------------------

export async function getClientPreferences(clienteId: string): Promise<ClientPreferences | null> {
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM client_preferences WHERE cliente_id = $1', [clienteId]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          clienteId: row.cliente_id,
          formaUnas: row.forma_unas || undefined,
          largoHabitual: row.largo_habitual || undefined,
          estilo: row.estilo || undefined,
          coloresPreferidos: Array.isArray(row.colores_preferidos) ? row.colores_preferidos : (typeof row.colores_preferidos === 'string' ? JSON.parse(row.colores_preferidos) : []),
          productosPreferidos: row.productos_preferidos || undefined,
          productosEvitar: row.productos_evitar || undefined,
          observacionesGenerales: row.observaciones_generales || undefined,
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
        };
      }
      return null;
    } catch (err) {
      console.error('Error fetching client preferences from PostgreSQL:', err);
    }
  }

  if (!memoryDb.clientPreferences) memoryDb.clientPreferences = [];
  const found = memoryDb.clientPreferences.find(p => p.clienteId === clienteId);
  return found || null;
}

export async function saveClientPreferences(clienteId: string, prefs: Partial<ClientPreferences>): Promise<ClientPreferences> {
  const current = await getClientPreferences(clienteId);
  const now = new Date().toISOString();
  const id = current?.id || crypto.randomUUID();

  const record: ClientPreferences = {
    id,
    clienteId,
    formaUnas: prefs.formaUnas !== undefined ? prefs.formaUnas : current?.formaUnas,
    largoHabitual: prefs.largoHabitual !== undefined ? prefs.largoHabitual : current?.largoHabitual,
    estilo: prefs.estilo !== undefined ? prefs.estilo : current?.estilo,
    coloresPreferidos: prefs.coloresPreferidos !== undefined ? prefs.coloresPreferidos : (current?.coloresPreferidos || []),
    productosPreferidos: prefs.productosPreferidos !== undefined ? prefs.productosPreferidos : current?.productosPreferidos,
    productosEvitar: prefs.productosEvitar !== undefined ? prefs.productosEvitar : current?.productosEvitar,
    observacionesGenerales: prefs.observacionesGenerales !== undefined ? prefs.observacionesGenerales : current?.observacionesGenerales,
    updatedAt: now
  };

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO client_preferences (
          id, cliente_id, forma_unas, largo_habitual, estilo,
          colores_preferidos, productos_preferidos, productos_evitar,
          observaciones_generales, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (cliente_id) DO UPDATE SET
          forma_unas = EXCLUDED.forma_unas,
          largo_habitual = EXCLUDED.largo_habitual,
          estilo = EXCLUDED.estilo,
          colores_preferidos = EXCLUDED.colores_preferidos,
          productos_preferidos = EXCLUDED.productos_preferidos,
          productos_evitar = EXCLUDED.productos_evitar,
          observaciones_generales = EXCLUDED.observaciones_generales,
          updated_at = NOW();
      `, [
        record.id,
        record.clienteId,
        record.formaUnas || null,
        record.largoHabitual || null,
        record.estilo || null,
        JSON.stringify(record.coloresPreferidos || []),
        record.productosPreferidos || null,
        record.productosEvitar || null,
        record.observacionesGenerales || null
      ]);
      return record;
    } catch (err) {
      console.error('Error saving client preferences in PostgreSQL:', err);
    }
  }

  if (!memoryDb.clientPreferences) memoryDb.clientPreferences = [];
  const idx = memoryDb.clientPreferences.findIndex(p => p.clienteId === clienteId);
  if (idx !== -1) {
    memoryDb.clientPreferences[idx] = record;
  } else {
    memoryDb.clientPreferences.push(record);
  }
  saveLocalFileDb();
  return record;
}

// ---------------------------------------------------------------------------
// CLIENT TIPS CONFIG
// ---------------------------------------------------------------------------

export async function getClientTipsConfig(clienteId: string): Promise<ClientTipConfigItem[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM client_tips_config WHERE cliente_id = $1 ORDER BY mano ASC, dedo ASC', [clienteId]);
      return res.rows.map(row => ({
        id: row.id,
        clienteId: row.cliente_id,
        mano: row.mano as any,
        dedo: row.dedo as any,
        tamanoTip: row.tamano_tip,
        marcaModelo: row.marca_modelo || undefined,
        observaciones: row.observaciones || undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.error('Error fetching client tips config from PostgreSQL:', err);
    }
  }

  if (!memoryDb.clientTipsConfig) memoryDb.clientTipsConfig = [];
  return memoryDb.clientTipsConfig.filter(t => t.clienteId === clienteId);
}

export async function saveClientTipsConfig(clienteId: string, tips: ClientTipConfigItem[]): Promise<ClientTipConfigItem[]> {
  const now = new Date().toISOString();

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query('DELETE FROM client_tips_config WHERE cliente_id = $1', [clienteId]);
      for (const item of tips) {
        const id = item.id || crypto.randomUUID();
        await pgPool.query(`
          INSERT INTO client_tips_config (id, cliente_id, mano, dedo, tamano_tip, marca_modelo, observaciones, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `, [
          id,
          clienteId,
          item.mano,
          item.dedo,
          item.tamanoTip,
          item.marcaModelo || null,
          item.observaciones || null
        ]);
      }
      return await getClientTipsConfig(clienteId);
    } catch (err) {
      console.error('Error saving client tips config to PostgreSQL:', err);
    }
  }

  if (!memoryDb.clientTipsConfig) memoryDb.clientTipsConfig = [];
  memoryDb.clientTipsConfig = memoryDb.clientTipsConfig.filter(t => t.clienteId !== clienteId);
  const itemsToAdd = tips.map(t => ({
    ...t,
    id: t.id || crypto.randomUUID(),
    clienteId,
    updatedAt: now
  }));
  memoryDb.clientTipsConfig.push(...itemsToAdd);
  saveLocalFileDb();
  return itemsToAdd;
}

// ---------------------------------------------------------------------------
// CRUD OPERATIONS: SERVICES
// ---------------------------------------------------------------------------

export async function getServices(activeOnly = true): Promise<Service[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const query = activeOnly
        ? 'SELECT * FROM services WHERE activo = true ORDER BY id ASC'
        : 'SELECT * FROM services ORDER BY id ASC';
      const res = await pgPool.query(query);
      return res.rows.map(row => ({
        id: row.id,
        nombre: row.nombre,
        slug: row.slug,
        categoria: row.categoria,
        descripcion: row.descripcion || '',
        duracionMinutos: Number(row.duracion_minutos),
        precio: Number(row.precio),
        esPopular: Boolean(row.es_popular),
        icono: row.icono || '💅',
        detalles: Array.isArray(row.detalles) ? row.detalles : (typeof row.detalles === 'string' ? JSON.parse(row.detalles) : []),
        activo: Boolean(row.activo)
      }));
    } catch (err) {
      console.error('Error fetching services from PostgreSQL:', err);
    }
  }

  return activeOnly ? memoryDb.services.filter(s => s.activo) : memoryDb.services;
}

export async function createService(service: Service): Promise<Service> {
  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO services (id, nombre, slug, categoria, descripcion, duracion_minutos, precio, es_popular, icono, detalles, activo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        service.id,
        service.nombre,
        service.slug,
        service.categoria,
        service.descripcion,
        service.duracionMinutos,
        service.precio,
        service.esPopular,
        service.icono,
        JSON.stringify(service.detalles || []),
        service.activo
      ]);
      return service;
    } catch (err) {
      console.error('Error creating service in PostgreSQL:', err);
    }
  }

  memoryDb.services.push(service);
  saveLocalFileDb();
  return service;
}

export async function updateService(id: string, updates: Partial<Service>): Promise<Service | null> {
  if (isPostgresConnected && pgPool) {
    try {
      const currentRes = await pgPool.query('SELECT * FROM services WHERE id = $1', [id]);
      if (currentRes.rows.length === 0) return null;

      const curr = currentRes.rows[0];
      const updated: Service = {
        id,
        nombre: updates.nombre !== undefined ? updates.nombre : curr.nombre,
        slug: updates.slug !== undefined ? updates.slug : curr.slug,
        categoria: updates.categoria !== undefined ? updates.categoria : curr.categoria,
        descripcion: updates.descripcion !== undefined ? updates.descripcion : curr.descripcion,
        duracionMinutos: updates.duracionMinutos !== undefined ? Number(updates.duracionMinutos) : Number(curr.duracion_minutos),
        precio: updates.precio !== undefined ? Number(updates.precio) : Number(curr.precio),
        esPopular: updates.esPopular !== undefined ? Boolean(updates.esPopular) : Boolean(curr.es_popular),
        icono: updates.icono !== undefined ? updates.icono : curr.icono,
        detalles: updates.detalles !== undefined ? updates.detalles : (typeof curr.detalles === 'string' ? JSON.parse(curr.detalles) : curr.detalles),
        activo: updates.activo !== undefined ? Boolean(updates.activo) : Boolean(curr.activo)
      };

      await pgPool.query(`
        UPDATE services
        SET nombre = $2, slug = $3, categoria = $4, descripcion = $5,
            duracion_minutos = $6, precio = $7, es_popular = $8, icono = $9,
            detalles = $10, activo = $11, updated_at = NOW()
        WHERE id = $1
      `, [
        id,
        updated.nombre,
        updated.slug,
        updated.categoria,
        updated.descripcion,
        updated.duracionMinutos,
        updated.precio,
        updated.esPopular,
        updated.icono,
        JSON.stringify(updated.detalles || []),
        updated.activo
      ]);

      return updated;
    } catch (err) {
      console.error('Error updating service in PostgreSQL:', err);
    }
  }

  const idx = memoryDb.services.findIndex(s => s.id === id);
  if (idx === -1) return null;
  memoryDb.services[idx] = { ...memoryDb.services[idx], ...updates };
  saveLocalFileDb();
  return memoryDb.services[idx];
}

export async function deleteService(id: string): Promise<boolean> {
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('DELETE FROM services WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('Error deleting service from PostgreSQL:', err);
    }
  }

  const idx = memoryDb.services.findIndex(s => s.id === id);
  if (idx === -1) return false;
  memoryDb.services.splice(idx, 1);
  saveLocalFileDb();
  return true;
}

// ---------------------------------------------------------------------------
// CRUD OPERATIONS: APPOINTMENTS (TURNOS)
// ---------------------------------------------------------------------------

export async function getAppointments(filter?: {
  date?: string;
  from?: string;
  to?: string;
  status?: string;
  search?: string;
  clienteId?: string;
  profesionalId?: string;
}): Promise<Appointment[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const conditions: string[] = [];
      const values: any[] = [];

      if (filter?.date) {
        values.push(filter.date);
        conditions.push(`fecha = $${values.length}`);
      }
      if (filter?.from) {
        values.push(filter.from);
        conditions.push(`fecha >= $${values.length}`);
      }
      if (filter?.to) {
        values.push(filter.to);
        conditions.push(`fecha <= $${values.length}`);
      }
      if (filter?.status && filter.status !== 'todos') {
        values.push(filter.status);
        conditions.push(`estado = $${values.length}`);
      }
      if (filter?.clienteId) {
        values.push(filter.clienteId);
        conditions.push(`cliente_id = $${values.length}`);
      }
      if (filter?.profesionalId && filter.profesionalId !== 'todos') {
        values.push(filter.profesionalId);
        conditions.push(`profesional_id = $${values.length}`);
      }
      if (filter?.search) {
        values.push(`%${filter.search.toLowerCase()}%`);
        conditions.push(`(
          LOWER(nombre) LIKE $${values.length} OR
          LOWER(apellido) LIKE $${values.length} OR
          LOWER(telefono) LIKE $${values.length} OR
          LOWER(codigo) LIKE $${values.length} OR
          LOWER(servicio_nombre) LIKE $${values.length}
        )`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM appointments ${whereClause} ORDER BY fecha ASC, hora_inicio ASC`;
      
      const res = await pgPool.query(query, values);
      return res.rows.map(row => mapAppointmentRow(row));
    } catch (err) {
      console.error('Error fetching appointments from PostgreSQL:', err);
    }
  }

  // Fallback memory filtering
  let filtered = [...memoryDb.appointments];
  if (filter?.date) filtered = filtered.filter(a => a.fecha === filter.date);
  if (filter?.from) filtered = filtered.filter(a => a.fecha >= filter.from!);
  if (filter?.to) filtered = filtered.filter(a => a.fecha <= filter.to!);
  if (filter?.status && filter.status !== 'todos') filtered = filtered.filter(a => a.estado === filter.status);
  if (filter?.clienteId) filtered = filtered.filter(a => a.clienteId === filter.clienteId);
  if (filter?.profesionalId && filter.profesionalId !== 'todos') filtered = filtered.filter(a => a.profesionalId === filter.profesionalId);
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    filtered = filtered.filter(a =>
      a.nombre.toLowerCase().includes(q) ||
      a.apellido.toLowerCase().includes(q) ||
      a.telefono.toLowerCase().includes(q) ||
      a.codigo.toLowerCase().includes(q) ||
      a.servicioNombre.toLowerCase().includes(q)
    );
  }
  return filtered.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio));
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const cleanId = (id || '').trim();
  if (!cleanId) return null;

  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM appointments WHERE id = $1 OR codigo = $1 LIMIT 1', [cleanId]);
      if (res.rows.length > 0) {
        return mapAppointmentRow(res.rows[0]);
      }
      return null;
    } catch (err) {
      console.error('Error fetching appointment by ID from PostgreSQL:', err);
    }
  }

  const found = memoryDb.appointments.find(a => a.id === cleanId || a.codigo === cleanId);
  return found || null;
}

function mapAppointmentRow(row: any): Appointment {
  return {
    id: row.id,
    clienteId: row.cliente_id || undefined,
    profesionalId: row.profesional_id || undefined,
    profesionalNombre: row.profesional_nombre || undefined,
    codigo: row.codigo,
    nombre: row.nombre,
    apellido: row.apellido,
    telefono: row.telefono,
    email: row.email || undefined,
    servicioId: row.servicio_id,
    servicioNombre: row.servicio_nombre,
    duracionMinutos: Number(row.duracion_minutos),
    precio: Number(row.precio),
    fecha: row.fecha,
    horaInicio: row.hora_inicio,
    horaFin: row.hora_fin,
    observaciones: row.observaciones || undefined,
    estado: row.estado as any,
    notasAdmin: row.notas_admin || undefined,
    browserId: row.browser_id || undefined,
    descuentoTipo: row.descuento_tipo || undefined,
    descuentoId: row.descuento_id || undefined,
    descuentoCodigo: row.descuento_codigo || undefined,
    descuentoNombre: row.descuento_nombre || undefined,
    descuentoPorcentaje: row.descuento_porcentaje != null ? Number(row.descuento_porcentaje) : undefined,
    descuentoMonto: row.descuento_monto != null ? Number(row.descuento_monto) : undefined,
    precioOriginal: row.precio_original != null ? Number(row.precio_original) : Number(row.precio),
    precioFinal: row.precio_final != null ? Number(row.precio_final) : Number(row.precio),
    motivoCancelacion: row.motivo_cancelacion || undefined,
    canceladoEn: row.cancelado_en ? new Date(row.cancelado_en).toISOString() : undefined,
    canceladoOrigen: row.cancelado_origen || undefined,
    canceladoPor: row.cancelado_por || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function createAppointment(apt: Appointment): Promise<Appointment> {
  // Ensure client exists and link client_id
  if (!apt.clienteId) {
    const client = await findOrCreateClientForBooking({
      nombre: apt.nombre,
      apellido: apt.apellido,
      telefono: apt.telefono,
      email: apt.email,
      fecha: apt.fecha,
      browserId: apt.browserId
    });
    apt.clienteId = client.id;
  }

  // Determine base pricing defaults
  const originalPrice = Number(apt.precioOriginal ?? apt.precio);
  apt.precioOriginal = originalPrice;
  if (apt.precioFinal == null) {
    apt.precioFinal = originalPrice;
  }

  if (isPostgresConnected && pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // Concurrency check within transaction using table lock or explicit check for overlap
      if (apt.profesionalId) {
        const overlapRes = await client.query(`
          SELECT id FROM appointments
          WHERE profesional_id = $1 
            AND fecha = $2 
            AND estado != 'cancelado'
            AND NOT (hora_fin <= $3 OR hora_inicio >= $4)
          FOR UPDATE
        `, [apt.profesionalId, apt.fecha, apt.horaInicio, apt.horaFin]);

        if (overlapRes.rows.length > 0) {
          await client.query('ROLLBACK');
          throw new Error('El horario seleccionado ya ha sido reservado por otra solicitud simultánea. Por favor elegí otro horario.');
        }
      }

      // ---------------------------------------------------------------------
      // TRANSACTIONAL DISCOUNT / BENEFIT CONSUMPTION & RE-VALIDATION
      // ---------------------------------------------------------------------
      if (apt.descuentoCodigo || apt.descuentoTipo === 'promocion') {
        const promoCode = (apt.descuentoCodigo || '').trim().toUpperCase();
        const promoRes = await client.query(`
          SELECT * FROM promotions WHERE UPPER(codigo) = $1 FOR UPDATE
        `, [promoCode]);

        if (promoRes.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new Error(`El código promocional "${promoCode}" no existe.`);
        }

        const promo = promoRes.rows[0];
        if (!promo.activo) {
          await client.query('ROLLBACK');
          throw new Error(`La promoción "${promo.nombre}" ya no se encuentra activa.`);
        }

        const todayStr = apt.fecha || new Date().toISOString().split('T')[0];
        if (promo.fecha_inicio && todayStr < promo.fecha_inicio) {
          await client.query('ROLLBACK');
          throw new Error(`La promoción "${promo.nombre}" aún no está vigente (inicia el ${promo.fecha_inicio}).`);
        }
        if (promo.fecha_vencimiento && todayStr > promo.fecha_vencimiento) {
          await client.query('ROLLBACK');
          throw new Error(`La promoción "${promo.nombre}" ha vencido el ${promo.fecha_vencimiento}.`);
        }

        // Total usage limit check
        if (promo.limite_total_usos != null && promo.limite_total_usos > 0) {
          const totalUsageCount = Number(promo.usos_actuales || 0);
          if (totalUsageCount >= promo.limite_total_usos) {
            await client.query('ROLLBACK');
            throw new Error(`La promoción "${promo.nombre}" ha alcanzado el límite máximo de usos disponibles.`);
          }
        }

        // Applicable services check
        const applicableServices: string[] = typeof promo.servicios_aplicables === 'string'
          ? JSON.parse(promo.servicios_aplicables)
          : (promo.servicios_aplicables || ['todos']);
        if (applicableServices.length > 0 && !applicableServices.includes('todos')) {
          if (!applicableServices.includes(apt.servicioId)) {
            await client.query('ROLLBACK');
            throw new Error(`La promoción "${promo.nombre}" no aplica para el servicio seleccionado.`);
          }
        }

        // Minimum amount check
        if (promo.monto_minimo != null && promo.monto_minimo > 0) {
          if (originalPrice < Number(promo.monto_minimo)) {
            await client.query('ROLLBACK');
            throw new Error(`La promoción "${promo.nombre}" requiere un monto mínimo de $${Number(promo.monto_minimo).toLocaleString('es-AR')}.`);
          }
        }

        // Per-client usage limit & reuse period checks
        const phoneNorm = normalizePhone(apt.telefono);
        const cleanPhone = phoneNorm.canonical || phoneNorm.nationalDigits || apt.telefono;
        const cleanEmail = normalizeEmail(apt.email || '');
        const clientUsagesRes = await client.query(`
          SELECT * FROM promotion_usages
          WHERE promocion_id = $1 AND (
            ($2::varchar IS NOT NULL AND cliente_id = $2) OR
            ($3::varchar != '' AND cliente_telefono = $3) OR
            ($4::varchar != '' AND cliente_email = $4)
          )
          ORDER BY fecha_uso DESC
        `, [promo.id, apt.clienteId || null, cleanPhone, cleanEmail]);

        const clientUsages = clientUsagesRes.rows;

        // Reuse period in days check
        if (promo.periodo_reutilizacion_dias != null && promo.periodo_reutilizacion_dias > 0 && clientUsages.length > 0) {
          const lastUsage = clientUsages[0];
          const lastDate = new Date(lastUsage.fecha_uso).getTime();
          const nowMs = Date.now();
          const daysElapsed = (nowMs - lastDate) / (1000 * 60 * 60 * 24);
          if (daysElapsed < promo.periodo_reutilizacion_dias) {
            const reusableDate = new Date(lastDate + promo.periodo_reutilizacion_dias * 86400000);
            await client.query('ROLLBACK');
            throw new Error(`Ya has utilizado esta promoción. Podrás volver a utilizarla a partir del ${reusableDate.toLocaleDateString('es-AR')}.`);
          }
        }

        // Per-client limit check
        if (promo.limite_uso_por_cliente != null && promo.limite_uso_por_cliente > 0) {
          if (clientUsages.length >= promo.limite_uso_por_cliente) {
            await client.query('ROLLBACK');
            throw new Error(`Ya has alcanzado el límite de usos permitidos (${promo.limite_uso_por_cliente}) para esta promoción.`);
          }
        }

        // Calculate discount amount
        let calculatedDiscount = 0;
        const discountVal = Number(promo.valor_descuento);
        if (promo.tipo_descuento === 'porcentaje') {
          calculatedDiscount = Math.round(originalPrice * (discountVal / 100));
          apt.descuentoPorcentaje = discountVal;
        } else {
          calculatedDiscount = discountVal;
        }
        calculatedDiscount = Math.min(originalPrice, Math.max(0, calculatedDiscount));

        apt.descuentoTipo = 'promocion';
        apt.descuentoId = promo.id;
        apt.descuentoCodigo = promo.codigo;
        apt.descuentoNombre = promo.nombre;
        apt.descuentoMonto = calculatedDiscount;
        apt.precioFinal = Math.max(0, originalPrice - calculatedDiscount);

        // Record usage in promotion_usages
        const usageId = crypto.randomUUID();
        await client.query(`
          INSERT INTO promotion_usages (
            id, promocion_id, codigo, cliente_id, cliente_telefono, cliente_email,
            turno_id, descuento_aplicado, precio_original, precio_final, fecha_uso
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        `, [
          usageId,
          promo.id,
          promo.codigo,
          apt.clienteId || null,
          cleanPhone,
          cleanEmail || null,
          apt.id,
          calculatedDiscount,
          originalPrice,
          apt.precioFinal
        ]);

        // Increment promotion usage count
        await client.query(`
          UPDATE promotions SET usos_actuales = usos_actuales + 1, updated_at = NOW() WHERE id = $1
        `, [promo.id]);

      } else if (apt.descuentoId && apt.descuentoTipo === 'beneficio') {
        // Individual client benefit consumption
        const benefitRes = await client.query(`
          SELECT * FROM client_benefits WHERE id = $1 FOR UPDATE
        `, [apt.descuentoId]);

        if (benefitRes.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new Error('El beneficio seleccionado no existe.');
        }

        const benefit = benefitRes.rows[0];
        if (benefit.estado !== 'disponible') {
          await client.query('ROLLBACK');
          throw new Error(`Este beneficio ya no se encuentra disponible (estado: ${benefit.estado}).`);
        }

        // Verify client matching
        const phoneNorm = normalizePhone(apt.telefono);
        const cleanPhone = phoneNorm.canonical || phoneNorm.nationalDigits || apt.telefono;
        const benefitPhoneNorm = normalizePhone(benefit.cliente_telefono || '');
        const cleanBenefitPhone = benefitPhoneNorm.canonical || benefitPhoneNorm.nationalDigits || (benefit.cliente_telefono || '');
        if (apt.clienteId && benefit.cliente_id && apt.clienteId !== benefit.cliente_id && cleanPhone !== cleanBenefitPhone) {
          await client.query('ROLLBACK');
          throw new Error('El beneficio seleccionado pertenece a otra clienta.');
        }

        const todayStr = apt.fecha || new Date().toISOString().split('T')[0];
        if (benefit.fecha_vencimiento && todayStr > benefit.fecha_vencimiento) {
          await client.query('UPDATE client_benefits SET estado = \'vencido\', updated_at = NOW() WHERE id = $1', [benefit.id]);
          await client.query('ROLLBACK');
          throw new Error(`Este beneficio ha vencido el ${benefit.fecha_vencimiento}.`);
        }

        // Applicable services check
        const applicableServices: string[] = typeof benefit.servicios_aplicables === 'string'
          ? JSON.parse(benefit.servicios_aplicables)
          : (benefit.servicios_aplicables || ['todos']);
        if (applicableServices.length > 0 && !applicableServices.includes('todos')) {
          if (!applicableServices.includes(apt.servicioId)) {
            await client.query('ROLLBACK');
            throw new Error(`Este beneficio no aplica para el servicio seleccionado.`);
          }
        }

        // Minimum amount check
        if (benefit.monto_minimo != null && benefit.monto_minimo > 0) {
          if (originalPrice < Number(benefit.monto_minimo)) {
            await client.query('ROLLBACK');
            throw new Error(`Este beneficio requiere un monto mínimo de $${Number(benefit.monto_minimo).toLocaleString('es-AR')}.`);
          }
        }

        // Calculate discount
        let calculatedDiscount = 0;
        const discountVal = Number(benefit.valor_descuento);
        if (benefit.tipo_descuento === 'porcentaje') {
          calculatedDiscount = Math.round(originalPrice * (discountVal / 100));
          apt.descuentoPorcentaje = discountVal;
        } else {
          calculatedDiscount = discountVal;
        }
        calculatedDiscount = Math.min(originalPrice, Math.max(0, calculatedDiscount));

        apt.descuentoTipo = 'beneficio';
        apt.descuentoId = benefit.id;
        apt.descuentoNombre = benefit.titulo;
        apt.descuentoMonto = calculatedDiscount;
        apt.precioFinal = Math.max(0, originalPrice - calculatedDiscount);

        // Mark benefit as used atomically
        await client.query(`
          UPDATE client_benefits
          SET estado = 'usado',
              turno_uso_id = $1,
              turno_uso_codigo = $2,
              usado_en = NOW(),
              descuento_aplicado = $3,
              updated_at = NOW()
          WHERE id = $4
        `, [apt.id, apt.codigo, calculatedDiscount, benefit.id]);
      } else {
        // No discount
        apt.precioFinal = originalPrice;
        apt.descuentoMonto = 0;
      }

      await client.query(`
        INSERT INTO appointments (
          id, cliente_id, profesional_id, profesional_nombre, codigo, nombre, apellido, telefono, email,
          servicio_id, servicio_nombre, duracion_minutos, precio,
          fecha, hora_inicio, hora_fin, observaciones, estado,
          notas_admin, browser_id,
          descuento_tipo, descuento_id, descuento_codigo, descuento_nombre,
          descuento_porcentaje, descuento_monto, precio_original, precio_final,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20,
          $21, $22, $23, $24,
          $25, $26, $27, $28,
          NOW(), NOW()
        )
      `, [
        apt.id,
        apt.clienteId,
        apt.profesionalId || null,
        apt.profesionalNombre || null,
        apt.codigo,
        apt.nombre,
        apt.apellido,
        apt.telefono,
        apt.email || null,
        apt.servicioId,
        apt.servicioNombre,
        apt.duracionMinutos,
        apt.precioFinal, // Main precio stored is effective price
        apt.fecha,
        apt.horaInicio,
        apt.horaFin,
        apt.observaciones || null,
        apt.estado,
        apt.notasAdmin || null,
        apt.browserId || null,
        apt.descuentoTipo || null,
        apt.descuentoId || null,
        apt.descuentoCodigo || null,
        apt.descuentoNombre || null,
        apt.descuentoPorcentaje || null,
        apt.descuentoMonto || null,
        apt.precioOriginal || originalPrice,
        apt.precioFinal || originalPrice
      ]);

      await client.query('COMMIT');
      return apt;
    } catch (err: any) {
      try { await client.query('ROLLBACK'); } catch (rbErr) {}
      console.error('Error saving appointment to PostgreSQL (transaction/concurrency):', err);
      throw err;
    } finally {
      client.release();
    }
  }

  // Fallback in-memory check for double booking in development
  if (apt.profesionalId) {
    const existingOverlap = memoryDb.appointments.find(a =>
      a.profesionalId === apt.profesionalId &&
      a.fecha === apt.fecha &&
      a.estado !== 'cancelado' &&
      !(a.horaFin <= apt.horaInicio || a.horaInicio >= apt.horaFin)
    );
    if (existingOverlap) {
      throw new Error('El horario seleccionado ya ha sido reservado por otra solicitud simultánea. Por favor elegí otro horario.');
    }
  }

  // Fallback memory discount validation & consumption
  if (apt.descuentoCodigo || apt.descuentoTipo === 'promocion') {
    const promoCode = (apt.descuentoCodigo || '').trim().toUpperCase();
    const promo = memoryDb.promotions?.find(p => p.codigo.toUpperCase() === promoCode);
    if (!promo || !promo.activo) {
      throw new Error(`Código promocional "${promoCode}" inválido o inactivo.`);
    }

    const todayStr = apt.fecha || new Date().toISOString().split('T')[0];
    if (promo.fechaInicio && todayStr < promo.fechaInicio) {
      throw new Error(`Esta promoción aún no está vigente (comienza el ${promo.fechaInicio}).`);
    }
    if (promo.fechaVencimiento && todayStr > promo.fechaVencimiento) {
      throw new Error(`Esta promoción ha vencido el ${promo.fechaVencimiento}.`);
    }

    // Check total usage limit
    if (promo.limiteTotalUsos != null && promo.limiteTotalUsos > 0) {
      const currentUsages = promo.usosActuales || 0;
      if (currentUsages >= promo.limiteTotalUsos) {
        throw new Error(`Esta promoción ha alcanzado su límite total de usos disponibles (${promo.limiteTotalUsos}).`);
      }
    }

    // Check service applicability
    if (promo.serviciosAplicables && promo.serviciosAplicables.length > 0 && !promo.serviciosAplicables.includes('todos')) {
      if (!promo.serviciosAplicables.includes(apt.servicioId)) {
        throw new Error(`La promoción "${promo.nombre}" no aplica para el servicio seleccionado.`);
      }
    }

    // Check minimum amount
    if (promo.montoMinimo != null && promo.montoMinimo > 0) {
      if (originalPrice < promo.montoMinimo) {
        throw new Error(`La promoción "${promo.nombre}" requiere un monto mínimo de $${promo.montoMinimo.toLocaleString('es-AR')}.`);
      }
    }

    // Check per-client limits and reuse cooldown
    const phoneNorm = normalizePhone(apt.telefono);
    const cleanPhone = phoneNorm.canonical || phoneNorm.nationalDigits || apt.telefono;
    const cleanEmail = normalizeEmail(apt.email || '');

    const clientUsages = (memoryDb.promotionUsages || []).filter(u =>
      u.promocionId === promo.id && (
        (apt.clienteId && u.clienteId === apt.clienteId) ||
        (cleanPhone && u.clienteTelefono === cleanPhone) ||
        (cleanEmail && u.clienteEmail === cleanEmail)
      )
    ).sort((a, b) => b.fechaUso.localeCompare(a.fechaUso));

    if (promo.periodoReutilizacionDias != null && promo.periodoReutilizacionDias > 0 && clientUsages.length > 0) {
      const lastUsage = clientUsages[0];
      const lastDate = new Date(lastUsage.fechaUso).getTime();
      const nowMs = Date.now();
      const daysElapsed = (nowMs - lastDate) / (1000 * 60 * 60 * 24);
      if (daysElapsed < promo.periodoReutilizacionDias) {
        const reusableDate = new Date(lastDate + promo.periodoReutilizacionDias * 86400000);
        throw new Error(`Ya has utilizado esta promoción. Podrás volver a utilizarla a partir del ${reusableDate.toLocaleDateString('es-AR')}.`);
      }
    }

    if (promo.limiteUsoPorCliente != null && promo.limiteUsoPorCliente > 0) {
      if (clientUsages.length >= promo.limiteUsoPorCliente) {
        throw new Error(`Ya has alcanzado el límite de usos permitidos (${promo.limiteUsoPorCliente}) para esta promoción.`);
      }
    }

    let calculatedDiscount = 0;
    if (promo.tipoDescuento === 'porcentaje') {
      calculatedDiscount = Math.round(originalPrice * (promo.valorDescuento / 100));
      apt.descuentoPorcentaje = promo.valorDescuento;
    } else {
      calculatedDiscount = promo.valorDescuento;
    }
    calculatedDiscount = Math.min(originalPrice, Math.max(0, calculatedDiscount));
    apt.descuentoTipo = 'promocion';
    apt.descuentoId = promo.id;
    apt.descuentoCodigo = promo.codigo;
    apt.descuentoNombre = promo.nombre;
    apt.descuentoMonto = calculatedDiscount;
    apt.precioFinal = Math.max(0, originalPrice - calculatedDiscount);
    promo.usosActuales = (promo.usosActuales || 0) + 1;
    if (!memoryDb.promotionUsages) memoryDb.promotionUsages = [];
    memoryDb.promotionUsages.unshift({
      id: crypto.randomUUID(),
      promocionId: promo.id,
      codigo: promo.codigo,
      clienteId: apt.clienteId,
      clienteTelefono: cleanPhone,
      clienteEmail: cleanEmail,
      turnoId: apt.id,
      descuentoAplicado: calculatedDiscount,
      precioOriginal: originalPrice,
      precioFinal: apt.precioFinal,
      fechaUso: new Date().toISOString()
    });
  } else if (apt.descuentoId && apt.descuentoTipo === 'beneficio') {
    const benefit = memoryDb.clientBenefits?.find(b => b.id === apt.descuentoId);
    if (!benefit || benefit.estado !== 'disponible') {
      throw new Error('Beneficio no disponible o inválido.');
    }

    const todayStr = apt.fecha || new Date().toISOString().split('T')[0];
    if (benefit.fechaVencimiento && todayStr > benefit.fechaVencimiento) {
      benefit.estado = 'vencido';
      throw new Error(`Este beneficio ha vencido el ${benefit.fechaVencimiento}.`);
    }

    const phoneNorm = normalizePhone(apt.telefono);
    const cleanPhone = phoneNorm.canonical || phoneNorm.nationalDigits || apt.telefono;
    const benefitPhoneNorm = normalizePhone(benefit.clienteTelefono || '');
    const cleanBenefitPhone = benefitPhoneNorm.canonical || benefitPhoneNorm.nationalDigits || (benefit.clienteTelefono || '');
    if (apt.clienteId && benefit.clienteId && apt.clienteId !== benefit.clienteId && cleanPhone !== cleanBenefitPhone) {
      throw new Error('El beneficio seleccionado pertenece a otra clienta.');
    }

    if (benefit.serviciosAplicables && benefit.serviciosAplicables.length > 0 && !benefit.serviciosAplicables.includes('todos')) {
      if (!benefit.serviciosAplicables.includes(apt.servicioId)) {
        throw new Error('Este beneficio no aplica para el servicio seleccionado.');
      }
    }

    if (benefit.montoMinimo != null && benefit.montoMinimo > 0) {
      if (originalPrice < benefit.montoMinimo) {
        throw new Error(`Este beneficio requiere un monto mínimo de $${benefit.montoMinimo.toLocaleString('es-AR')}.`);
      }
    }

    let calculatedDiscount = 0;
    if (benefit.tipoDescuento === 'porcentaje') {
      calculatedDiscount = Math.round(originalPrice * (benefit.valorDescuento / 100));
      apt.descuentoPorcentaje = benefit.valorDescuento;
    } else {
      calculatedDiscount = benefit.valorDescuento;
    }
    calculatedDiscount = Math.min(originalPrice, Math.max(0, calculatedDiscount));
    apt.descuentoTipo = 'beneficio';
    apt.descuentoId = benefit.id;
    apt.descuentoNombre = benefit.titulo;
    apt.descuentoMonto = calculatedDiscount;
    apt.precioFinal = Math.max(0, originalPrice - calculatedDiscount);
    benefit.estado = 'usado';
    benefit.turnoUsoId = apt.id;
    benefit.turnoUsoCodigo = apt.codigo;
    benefit.usadoEn = new Date().toISOString();
    benefit.descuentoAplicado = calculatedDiscount;
  } else {
    apt.precioFinal = originalPrice;
    apt.descuentoMonto = 0;
  }

  memoryDb.appointments.unshift(apt);
  saveLocalFileDb();
  return apt;
}

export async function updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment | null> {
  const cleanId = (id || '').trim();
  let updatedApt: Appointment | null = null;

  if (isPostgresConnected && pgPool) {
    try {
      const currentRes = await pgPool.query('SELECT * FROM appointments WHERE id = $1 OR codigo = $1', [cleanId]);
      if (currentRes.rows.length > 0) {
        const curr = currentRes.rows[0];
        const targetId = curr.id;

        await pgPool.query(`
          UPDATE appointments
          SET estado = COALESCE($2, estado),
              notas_admin = COALESCE($3, notas_admin),
              fecha = COALESCE($4, fecha),
              hora_inicio = COALESCE($5, hora_inicio),
              hora_fin = COALESCE($6, hora_fin),
              cliente_id = COALESCE($7, cliente_id),
              profesional_id = COALESCE($8, profesional_id),
              profesional_nombre = COALESCE($9, profesional_nombre),
              motivo_cancelacion = CASE WHEN $2 = 'pendiente' THEN NULL ELSE COALESCE($10, motivo_cancelacion) END,
              cancelado_en = CASE WHEN $2 = 'pendiente' THEN NULL ELSE COALESCE($11, cancelado_en) END,
              cancelado_origen = CASE WHEN $2 = 'pendiente' THEN NULL ELSE COALESCE($12, cancelado_origen) END,
              cancelado_por = CASE WHEN $2 = 'pendiente' THEN NULL ELSE COALESCE($13, cancelado_por) END,
              updated_at = NOW()
          WHERE id = $1
        `, [
          targetId,
          updates.estado || null,
          updates.notasAdmin !== undefined ? updates.notasAdmin : null,
          updates.fecha || null,
          updates.horaInicio || null,
          updates.horaFin || null,
          updates.clienteId || null,
          updates.profesionalId || null,
          updates.profesionalNombre || null,
          updates.motivoCancelacion || null,
          updates.canceladoEn || null,
          updates.canceladoOrigen || null,
          updates.canceladoPor || null
        ]);

        const updatedRes = await pgPool.query('SELECT * FROM appointments WHERE id = $1', [targetId]);
        const row = updatedRes.rows[0];
        if (row) {
          updatedApt = mapAppointmentRow(row);
        }
      }
    } catch (err) {
      console.error('Error updating appointment in PostgreSQL:', err);
    }
  }

  // Also update memoryDb
  const apt = memoryDb.appointments.find(a => a.id === cleanId || a.codigo === cleanId);
  if (apt) {
    if (updates.estado) {
      apt.estado = updates.estado;
      if (updates.estado === 'pendiente') {
        apt.motivoCancelacion = undefined;
        apt.canceladoEn = undefined;
        apt.canceladoOrigen = undefined;
        apt.canceladoPor = undefined;
      }
    }
    if (updates.notasAdmin !== undefined) apt.notasAdmin = updates.notasAdmin;
    if (updates.fecha) apt.fecha = updates.fecha;
    if (updates.horaInicio) apt.horaInicio = updates.horaInicio;
    if (updates.horaFin) apt.horaFin = updates.horaFin;
    if (updates.clienteId) apt.clienteId = updates.clienteId;
    if (updates.profesionalId) apt.profesionalId = updates.profesionalId;
    if (updates.profesionalNombre) apt.profesionalNombre = updates.profesionalNombre;
    if (updates.motivoCancelacion !== undefined) apt.motivoCancelacion = updates.motivoCancelacion;
    if (updates.canceladoEn !== undefined) apt.canceladoEn = updates.canceladoEn;
    if (updates.canceladoOrigen !== undefined) apt.canceladoOrigen = updates.canceladoOrigen;
    if (updates.canceladoPor !== undefined) apt.canceladoPor = updates.canceladoPor;
    apt.updatedAt = new Date().toISOString();
    saveLocalFileDb();
    if (!updatedApt) {
      updatedApt = apt;
    }
  }

  return updatedApt;
}

export interface CancelAppointmentOptions {
  appointmentId: string;
  motivo?: string;
  origen?: 'agenda' | 'detalle_turno' | 'excepcion_disponibilidad' | 'admin' | 'cliente' | string;
  canceladoPor?: string;
}

export async function cancelAppointment(options: CancelAppointmentOptions): Promise<Appointment | null> {
  const cleanId = (options.appointmentId || '').trim();
  const motivo = (options.motivo || '').trim() || 'Cancelado por administración';
  const origen = (options.origen || 'admin').trim();
  const canceladoPor = (options.canceladoPor || 'Administración').trim();
  const canceladoEn = new Date().toISOString();

  let updatedApt: Appointment | null = null;

  if (isPostgresConnected && pgPool) {
    try {
      const currentRes = await pgPool.query('SELECT * FROM appointments WHERE id = $1 OR codigo = $1', [cleanId]);
      if (currentRes.rows.length > 0) {
        const curr = currentRes.rows[0];
        const targetId = curr.id;

        await pgPool.query(`
          UPDATE appointments
          SET estado = 'cancelado',
              motivo_cancelacion = $2,
              cancelado_en = $3,
              cancelado_origen = $4,
              cancelado_por = $5,
              updated_at = NOW()
          WHERE id = $1
        `, [
          targetId,
          motivo,
          canceladoEn,
          origen,
          canceladoPor
        ]);

        const updatedRes = await pgPool.query('SELECT * FROM appointments WHERE id = $1', [targetId]);
        const row = updatedRes.rows[0];
        if (row) {
          updatedApt = mapAppointmentRow(row);
        }
      }
    } catch (err) {
      console.error('Error cancelling appointment in PostgreSQL:', err);
    }
  }

  // Also update memoryDb
  const apt = memoryDb.appointments.find(a => a.id === cleanId || a.codigo === cleanId);
  if (apt) {
    apt.estado = 'cancelado';
    apt.motivoCancelacion = motivo;
    apt.canceladoEn = canceladoEn;
    apt.canceladoOrigen = origen;
    apt.canceladoPor = canceladoPor;
    apt.updatedAt = canceladoEn;
    saveLocalFileDb();
    if (!updatedApt) {
      updatedApt = apt;
    }
  }

  if (updatedApt) {
    try {
      const { notificationService } = await import('./notifications/notificationService.js');
      await notificationService.sendAppointmentCancellation(updatedApt, {
        motivo,
        origen,
        canceladoPor,
        idempotencyKey: `cancel-${updatedApt.id}-${updatedApt.canceladoEn}`
      });
    } catch (notifErr) {
      console.error('Error in notificationService.sendAppointmentCancellation:', notifErr);
    }
  }

  return updatedApt;
}

export async function deleteAppointment(id: string, motivo = 'Cancelado y archivado por administración', canceladoPor = 'Administración'): Promise<boolean> {
  const res = await cancelAppointment({
    appointmentId: id,
    motivo,
    origen: 'admin',
    canceladoPor
  });
  return res !== null;
}

// ---------------------------------------------------------------------------
// CRUD OPERATIONS: USERS & AUTHENTICATION
// ---------------------------------------------------------------------------

export async function getUsers(activeOnly = true): Promise<User[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const query = activeOnly
        ? 'SELECT id, email, rol, profesional_id, activo, nombre, created_at, updated_at FROM users WHERE activo = true ORDER BY created_at ASC'
        : 'SELECT id, email, rol, profesional_id, activo, nombre, created_at, updated_at FROM users ORDER BY created_at ASC';
      const res = await pgPool.query(query);
      return res.rows.map(row => ({
        id: row.id,
        email: row.email,
        rol: row.rol as UserRole,
        profesionalId: row.profesional_id || undefined,
        activo: Boolean(row.activo),
        nombre: row.nombre || undefined,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.error('Error fetching users from PostgreSQL:', err);
    }
  }

  return (activeOnly ? memoryDb.users.filter(u => u.activo) : memoryDb.users).map(u => ({
    id: u.id,
    email: u.email,
    rol: u.rol,
    profesionalId: u.profesionalId,
    activo: u.activo,
    nombre: u.nombre,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  }));
}

export async function getUserById(id: string): Promise<User | null> {
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          email: row.email,
          passwordHash: row.password_hash,
          salt: row.salt,
          rol: row.rol as UserRole,
          profesionalId: row.profesional_id || undefined,
          activo: Boolean(row.activo),
          nombre: row.nombre || undefined,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('Error fetching user by id from PostgreSQL:', err);
    }
  }

  const u = memoryDb.users.find(user => user.id === id);
  return u || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const normEmail = normalizeEmail(email);
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normEmail]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          email: row.email,
          passwordHash: row.password_hash,
          salt: row.salt,
          rol: row.rol as UserRole,
          profesionalId: row.profesional_id || undefined,
          activo: Boolean(row.activo),
          nombre: row.nombre || undefined,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('Error fetching user by email from PostgreSQL:', err);
    }
  }

  const u = memoryDb.users.find(user => normalizeEmail(user.email) === normEmail);
  return u || null;
}

export async function createUser(userData: {
  email: string;
  password?: string;
  rol: UserRole;
  profesionalId?: string;
  nombre?: string;
  activo?: boolean;
}): Promise<User> {
  const id = crypto.randomUUID();
  const email = normalizeEmail(userData.email);
  const { hash, salt } = hashPassword(userData.password || "password123");
  const now = new Date().toISOString();

  const user: User = {
    id,
    email,
    passwordHash: hash,
    salt,
    rol: userData.rol,
    profesionalId: userData.profesionalId,
    activo: userData.activo !== false,
    nombre: userData.nombre,
    createdAt: now,
    updatedAt: now
  };

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO users (id, email, password_hash, salt, rol, profesional_id, activo, nombre, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `, [
        user.id,
        user.email,
        user.passwordHash,
        user.salt,
        user.rol,
        user.profesionalId || null,
        user.activo,
        user.nombre || null
      ]);
    } catch (err) {
      console.error('Error creating user in PostgreSQL:', err);
    }
  }

  memoryDb.users.push(user);
  saveLocalFileDb();

  const { passwordHash: _, salt: __, ...safeUser } = user;
  return safeUser as User;
}

export async function updateUser(id: string, updates: Partial<User> & { password?: string }): Promise<User | null> {
  const now = new Date().toISOString();
  let hashUpdates: { passwordHash?: string; salt?: string } = {};

  if (updates.password) {
    const { hash, salt } = hashPassword(updates.password);
    hashUpdates = { passwordHash: hash, salt };
  }

  if (isPostgresConnected && pgPool) {
    try {
      const currentRes = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (currentRes.rows.length === 0) return null;
      const curr = currentRes.rows[0];

      await pgPool.query(`
        UPDATE users
        SET email = COALESCE($2, email),
            password_hash = COALESCE($3, password_hash),
            salt = COALESCE($4, salt),
            rol = COALESCE($5, rol),
            profesional_id = COALESCE($6, profesional_id),
            activo = COALESCE($7, activo),
            nombre = COALESCE($8, nombre),
            updated_at = NOW()
        WHERE id = $1
      `, [
        id,
        updates.email ? normalizeEmail(updates.email) : null,
        hashUpdates.passwordHash || null,
        hashUpdates.salt || null,
        updates.rol || null,
        updates.profesionalId !== undefined ? updates.profesionalId : null,
        updates.activo !== undefined ? updates.activo : null,
        updates.nombre !== undefined ? updates.nombre : null
      ]);
    } catch (err) {
      console.error('Error updating user in PostgreSQL:', err);
    }
  }

  const idx = memoryDb.users.findIndex(u => u.id === id);
  if (idx !== -1) {
    memoryDb.users[idx] = {
      ...memoryDb.users[idx],
      ...updates,
      ...hashUpdates,
      updatedAt: now
    };
    saveLocalFileDb();
  }

  return getUserById(id);
}

export async function deleteUser(id: string): Promise<boolean> {
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('DELETE FROM users WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('Error deleting user from PostgreSQL:', err);
    }
  }

  const idx = memoryDb.users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  memoryDb.users.splice(idx, 1);
  saveLocalFileDb();
  return true;
}

export async function authenticateUser(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  const user = await getUserByEmail(email);
  if (!user || !user.activo) {
    return { success: false, error: 'Usuario no encontrado o inactivo.' };
  }

  if (!user.passwordHash || !user.salt) {
    return { success: false, error: 'Credenciales inválidas.' };
  }

  const isValid = verifyPassword(password, user.salt, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Contraseña incorrecta.' };
  }

  const { passwordHash: _, salt: __, ...safeUser } = user;
  return { success: true, user: safeUser as User };
}

// ---------------------------------------------------------------------------
// CRUD OPERATIONS: PROFESSIONALS (PROFESIONALES / EMPLEADOS)
// ---------------------------------------------------------------------------

export async function getProfessionals(activeOnly = true): Promise<Professional[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const query = activeOnly
        ? 'SELECT * FROM professionals WHERE activo = true ORDER BY nombre ASC, apellido ASC'
        : 'SELECT * FROM professionals ORDER BY nombre ASC, apellido ASC';
      const res = await pgPool.query(query);
      
      const profs: Professional[] = [];
      for (const row of res.rows) {
        // Fetch enabled services for each professional
        const servRes = await pgPool.query(
          'SELECT servicio_id FROM professional_services WHERE profesional_id = $1 AND activo = true',
          [row.id]
        );
        profs.push({
          id: row.id,
          userId: row.user_id || undefined,
          nombre: row.nombre,
          apellido: row.apellido,
          email: row.email || undefined,
          telefono: row.telefono || undefined,
          fotoUrl: row.foto_url || undefined,
          colorAgenda: row.color_agenda || '#8E4455',
          titulo: row.titulo || undefined,
          activo: Boolean(row.activo),
          serviciosIds: servRes.rows.map(r => r.servicio_id),
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
        });
      }
      return profs;
    } catch (err) {
      console.error('Error fetching professionals from PostgreSQL:', err);
    }
  }

  const list = activeOnly ? memoryDb.professionals.filter(p => p.activo) : memoryDb.professionals;
  return list.map(p => {
    const servIds = (memoryDb.professionalServices || [])
      .filter(ps => ps.profesionalId === p.id && ps.activo)
      .map(ps => ps.servicioId);
    return {
      ...p,
      serviciosIds: servIds.length > 0 ? servIds : (p.serviciosIds || [])
    };
  });
}

export async function getProfessionalById(id: string): Promise<Professional | null> {
  const all = await getProfessionals(false);
  return all.find(p => p.id === id) || null;
}

export async function createProfessional(profData: Partial<Professional> & { nombre: string; apellido: string }): Promise<Professional> {
  const id = profData.id || `prof-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();

  const newProf: Professional = {
    id,
    userId: profData.userId,
    nombre: profData.nombre.trim(),
    apellido: profData.apellido.trim(),
    email: profData.email ? normalizeEmail(profData.email) : undefined,
    telefono: profData.telefono,
    fotoUrl: profData.fotoUrl,
    colorAgenda: profData.colorAgenda || '#8E4455',
    titulo: profData.titulo,
    activo: profData.activo !== false,
    serviciosIds: profData.serviciosIds || defaultServices.map(s => s.id),
    createdAt: now,
    updatedAt: now
  };

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO professionals (id, user_id, nombre, apellido, email, telefono, foto_url, color_agenda, titulo, activo, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `, [
        newProf.id,
        newProf.userId || null,
        newProf.nombre,
        newProf.apellido,
        newProf.email || null,
        newProf.telefono || null,
        newProf.fotoUrl || null,
        newProf.colorAgenda,
        newProf.titulo || null,
        newProf.activo
      ]);

      // Seed professional services
      if (newProf.serviciosIds && newProf.serviciosIds.length > 0) {
        for (const sId of newProf.serviciosIds) {
          await pgPool.query(`
            INSERT INTO professional_services (id, profesional_id, servicio_id, activo, created_at)
            VALUES ($1, $2, $3, true, NOW())
            ON CONFLICT (profesional_id, servicio_id) DO NOTHING
          `, [`ps-${newProf.id}-${sId}`, newProf.id, sId]);
        }
      }
    } catch (err) {
      console.error('Error creating professional in PostgreSQL:', err);
    }
  }

  memoryDb.professionals.push(newProf);
  if (newProf.serviciosIds) {
    for (const sId of newProf.serviciosIds) {
      memoryDb.professionalServices.push({
        id: `ps-${newProf.id}-${sId}`,
        profesionalId: newProf.id,
        servicioId: sId,
        activo: true,
        createdAt: now
      });
    }
  }
  saveLocalFileDb();

  return newProf;
}

export async function updateProfessional(id: string, updates: Partial<Professional>): Promise<Professional | null> {
  const now = new Date().toISOString();

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        UPDATE professionals
        SET nombre = COALESCE($2, nombre),
            apellido = COALESCE($3, apellido),
            email = COALESCE($4, email),
            telefono = COALESCE($5, telefono),
            foto_url = COALESCE($6, foto_url),
            color_agenda = COALESCE($7, color_agenda),
            titulo = COALESCE($8, titulo),
            activo = COALESCE($9, activo),
            user_id = COALESCE($10, user_id),
            updated_at = NOW()
        WHERE id = $1
      `, [
        id,
        updates.nombre !== undefined ? updates.nombre.trim() : null,
        updates.apellido !== undefined ? updates.apellido.trim() : null,
        updates.email !== undefined ? (updates.email ? normalizeEmail(updates.email) : null) : null,
        updates.telefono !== undefined ? updates.telefono : null,
        updates.fotoUrl !== undefined ? updates.fotoUrl : null,
        updates.colorAgenda !== undefined ? updates.colorAgenda : null,
        updates.titulo !== undefined ? updates.titulo : null,
        updates.activo !== undefined ? updates.activo : null,
        updates.userId !== undefined ? updates.userId : null
      ]);

      if (updates.serviciosIds) {
        await setProfessionalServices(id, updates.serviciosIds);
      }
    } catch (err) {
      console.error('Error updating professional in PostgreSQL:', err);
    }
  }

  const idx = memoryDb.professionals.findIndex(p => p.id === id);
  if (idx !== -1) {
    memoryDb.professionals[idx] = {
      ...memoryDb.professionals[idx],
      ...updates,
      updatedAt: now
    };
    if (updates.serviciosIds) {
      await setProfessionalServices(id, updates.serviciosIds);
    }
    saveLocalFileDb();
  }

  return getProfessionalById(id);
}

export async function deleteProfessional(id: string): Promise<boolean> {
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('DELETE FROM professionals WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('Error deleting professional from PostgreSQL:', err);
    }
  }

  const idx = memoryDb.professionals.findIndex(p => p.id === id);
  if (idx === -1) return false;
  memoryDb.professionals.splice(idx, 1);
  memoryDb.professionalServices = memoryDb.professionalServices.filter(ps => ps.profesionalId !== id);
  saveLocalFileDb();
  return true;
}

// ---------------------------------------------------------------------------
// PROFESSIONAL - SERVICES (MANY-TO-MANY RELATIONSHIP)
// ---------------------------------------------------------------------------

export async function getProfessionalServices(profesionalId?: string, servicioId?: string): Promise<ProfessionalService[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const conditions: string[] = ['activo = true'];
      const values: any[] = [];
      if (profesionalId) {
        values.push(profesionalId);
        conditions.push(`profesional_id = $${values.length}`);
      }
      if (servicioId) {
        values.push(servicioId);
        conditions.push(`servicio_id = $${values.length}`);
      }
      const res = await pgPool.query(`SELECT * FROM professional_services WHERE ${conditions.join(' AND ')}`, values);
      return res.rows.map(r => ({
        id: r.id,
        profesionalId: r.profesional_id,
        servicioId: r.servicio_id,
        activo: Boolean(r.activo),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.error('Error fetching professional services from PostgreSQL:', err);
    }
  }

  let list = memoryDb.professionalServices.filter(ps => ps.activo);
  if (profesionalId) list = list.filter(ps => ps.profesionalId === profesionalId);
  if (servicioId) list = list.filter(ps => ps.servicioId === servicioId);
  return list;
}

export async function setProfessionalServices(profesionalId: string, servicioIds: string[]): Promise<void> {
  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query('DELETE FROM professional_services WHERE profesional_id = $1', [profesionalId]);
      for (const sId of servicioIds) {
        await pgPool.query(`
          INSERT INTO professional_services (id, profesional_id, servicio_id, activo, created_at)
          VALUES ($1, $2, $3, true, NOW())
          ON CONFLICT (profesional_id, servicio_id) DO UPDATE SET activo = true
        `, [`ps-${profesionalId}-${sId}`, profesionalId, sId]);
      }
    } catch (err) {
      console.error('Error setting professional services in PostgreSQL:', err);
    }
  }

  memoryDb.professionalServices = memoryDb.professionalServices.filter(ps => ps.profesionalId !== profesionalId);
  for (const sId of servicioIds) {
    memoryDb.professionalServices.push({
      id: `ps-${profesionalId}-${sId}`,
      profesionalId,
      servicioId: sId,
      activo: true,
      createdAt: new Date().toISOString()
    });
  }
  saveLocalFileDb();
}

export async function setServiceProfessionals(servicioId: string, profesionalIds: string[]): Promise<void> {
  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query('DELETE FROM professional_services WHERE servicio_id = $1', [servicioId]);
      for (const pId of profesionalIds) {
        await pgPool.query(`
          INSERT INTO professional_services (id, profesional_id, servicio_id, activo, created_at)
          VALUES ($1, $2, $3, true, NOW())
          ON CONFLICT (profesional_id, servicio_id) DO UPDATE SET activo = true
        `, [`ps-${pId}-${servicioId}`, pId, servicioId]);
      }
    } catch (err) {
      console.error('Error setting service professionals in PostgreSQL:', err);
    }
  }

  memoryDb.professionalServices = memoryDb.professionalServices.filter(ps => ps.servicioId !== servicioId);
  for (const pId of profesionalIds) {
    memoryDb.professionalServices.push({
      id: `ps-${pId}-${servicioId}`,
      profesionalId: pId,
      servicioId,
      activo: true,
      createdAt: new Date().toISOString()
    });
  }
  saveLocalFileDb();
}

export async function getProfessionalsForService(servicioId: string): Promise<Professional[]> {
  const psList = await getProfessionalServices(undefined, servicioId);
  const profIds = psList.map(ps => ps.profesionalId);
  const allProfs = await getProfessionals(false);
  return allProfs.filter(p => profIds.includes(p.id));
}

export async function isProfessionalHabilitated(profesionalId: string, servicioId: string): Promise<boolean> {
  const psList = await getProfessionalServices(profesionalId, servicioId);
  return psList.length > 0;
}

// ---------------------------------------------------------------------------
// SCHEDULE CONFIGS & VERSIONING ("fechaVigencia")
// ---------------------------------------------------------------------------

export async function getSchedules(filter?: {
  alcance?: ScheduleScope;
  profesionalId?: string;
}): Promise<ScheduleConfig[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      if (filter?.alcance) {
        values.push(filter.alcance);
        conditions.push(`alcance = $${values.length}`);
      }
      if (filter?.profesionalId) {
        values.push(filter.profesionalId);
        conditions.push(`profesional_id = $${values.length}`);
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const res = await pgPool.query(`SELECT * FROM schedules ${whereClause} ORDER BY fecha_vigencia DESC`, values);
      return res.rows.map(row => ({
        id: row.id,
        alcance: row.alcance as ScheduleScope,
        profesionalId: row.profesional_id || undefined,
        fechaVigencia: row.fecha_vigencia,
        dias: typeof row.dias === 'string' ? JSON.parse(row.dias) : row.dias,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.error('Error fetching schedules from PostgreSQL:', err);
    }
  }

  let list = [...(memoryDb.schedules || [])];
  if (filter?.alcance) list = list.filter(s => s.alcance === filter.alcance);
  if (filter?.profesionalId) list = list.filter(s => s.profesionalId === filter.profesionalId);
  return list.sort((a, b) => b.fechaVigencia.localeCompare(a.fechaVigencia));
}

export async function getScheduleForDate(
  alcance: ScheduleScope,
  profesionalId?: string,
  fecha?: string
): Promise<ScheduleConfig | null> {
  const targetDate = fecha || new Date().toISOString().split('T')[0];

  if (isPostgresConnected && pgPool) {
    try {
      let query = '';
      let values: any[] = [];
      if (alcance === 'local') {
        query = `
          SELECT * FROM schedules 
          WHERE alcance = 'local' AND fecha_vigencia <= $1
          ORDER BY fecha_vigencia DESC 
          LIMIT 1
        `;
        values = [targetDate];
      } else {
        query = `
          SELECT * FROM schedules 
          WHERE alcance = 'profesional' AND profesional_id = $1 AND fecha_vigencia <= $2
          ORDER BY fecha_vigencia DESC 
          LIMIT 1
        `;
        values = [profesionalId, targetDate];
      }
      const res = await pgPool.query(query, values);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          alcance: row.alcance as ScheduleScope,
          profesionalId: row.profesional_id || undefined,
          fechaVigencia: row.fecha_vigencia,
          dias: typeof row.dias === 'string' ? JSON.parse(row.dias) : row.dias,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('Error fetching schedule for date from PostgreSQL:', err);
    }
  }

  const all = memoryDb.schedules || [];
  const candidates = all
    .filter(s => {
      if (s.alcance !== alcance) return false;
      if (alcance === 'profesional' && s.profesionalId !== profesionalId) return false;
      return s.fechaVigencia <= targetDate;
    })
    .sort((a, b) => b.fechaVigencia.localeCompare(a.fechaVigencia));

  return candidates.length > 0 ? candidates[0] : null;
}

export async function saveSchedule(scheduleData: {
  alcance: ScheduleScope;
  profesionalId?: string;
  fechaVigencia: string;
  dias: WeekScheduleMap;
}): Promise<ScheduleConfig> {
  const id = `sched-${scheduleData.alcance}-${scheduleData.profesionalId || 'local'}-${scheduleData.fechaVigencia}`;
  const now = new Date().toISOString();

  const newSchedule: ScheduleConfig = {
    id,
    alcance: scheduleData.alcance,
    profesionalId: scheduleData.profesionalId,
    fechaVigencia: scheduleData.fechaVigencia,
    dias: scheduleData.dias,
    createdAt: now,
    updatedAt: now
  };

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO schedules (id, alcance, profesional_id, fecha_vigencia, dias, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET dias = $5, updated_at = NOW();
      `, [
        newSchedule.id,
        newSchedule.alcance,
        newSchedule.profesionalId || null,
        newSchedule.fechaVigencia,
        JSON.stringify(newSchedule.dias)
      ]);
    } catch (err) {
      console.error('Error saving schedule to PostgreSQL:', err);
    }
  }

  if (!memoryDb.schedules) memoryDb.schedules = [];
  const idx = memoryDb.schedules.findIndex(s => s.id === id);
  if (idx !== -1) {
    memoryDb.schedules[idx] = newSchedule;
  } else {
    memoryDb.schedules.unshift(newSchedule);
  }
  saveLocalFileDb();

  return newSchedule;
}

export async function deleteSchedule(id: string): Promise<boolean> {
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('DELETE FROM schedules WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('Error deleting schedule from PostgreSQL:', err);
    }
  }

  if (!memoryDb.schedules) return false;
  const idx = memoryDb.schedules.findIndex(s => s.id === id);
  if (idx === -1) return false;
  memoryDb.schedules.splice(idx, 1);
  saveLocalFileDb();
  return true;
}

// ---------------------------------------------------------------------------
// AVAILABILITY EXCEPTIONS ("Excepción de disponibilidad")
// ---------------------------------------------------------------------------

export async function getAvailabilityExceptions(filter?: {
  fecha?: string;
  alcance?: ScheduleScope;
  profesionalId?: string;
}): Promise<AvailabilityException[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      if (filter?.fecha) {
        values.push(filter.fecha);
        conditions.push(`fecha = $${values.length}`);
      }
      if (filter?.alcance) {
        values.push(filter.alcance);
        conditions.push(`alcance = $${values.length}`);
      }
      if (filter?.profesionalId) {
        values.push(filter.profesionalId);
        conditions.push(`profesional_id = $${values.length}`);
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const res = await pgPool.query(`SELECT * FROM availability_exceptions ${whereClause} ORDER BY fecha DESC`, values);
      return res.rows.map(row => ({
        id: row.id,
        alcance: row.alcance as ScheduleScope,
        profesionalId: row.profesional_id || undefined,
        fecha: row.fecha,
        tipo: row.tipo as AvailabilityExceptionType,
        intervalos: typeof row.intervalos === 'string' ? JSON.parse(row.intervalos) : (row.intervalos || []),
        motivo: row.motivo || undefined,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.error('Error fetching availability exceptions from PostgreSQL:', err);
    }
  }

  let list = [...(memoryDb.availabilityExceptions || [])];
  if (filter?.fecha) list = list.filter(e => e.fecha === filter.fecha);
  if (filter?.alcance) list = list.filter(e => e.alcance === filter.alcance);
  if (filter?.profesionalId) list = list.filter(e => e.profesionalId === filter.profesionalId);
  return list;
}

export async function createAvailabilityException(excData: {
  alcance: ScheduleScope;
  profesionalId?: string;
  profesionalIds?: string[];
  fecha: string;
  tipo: AvailabilityExceptionType;
  intervalos?: TimeInterval[];
  motivo?: string;
}): Promise<AvailabilityException[]> {
  const createdList: AvailabilityException[] = [];
  const now = new Date().toISOString();

  // If alcance is profesional and multiple profesionalIds provided
  const targetProfIds: (string | undefined)[] = excData.alcance === 'profesional'
    ? (excData.profesionalIds && excData.profesionalIds.length > 0 ? excData.profesionalIds : [excData.profesionalId])
    : [undefined];

  for (const pId of targetProfIds) {
    const id = `exc-${excData.alcance}-${pId || 'local'}-${excData.fecha}-${Math.floor(Math.random() * 1000)}`;
    const newExc: AvailabilityException = {
      id,
      alcance: excData.alcance,
      profesionalId: pId,
      fecha: excData.fecha,
      tipo: excData.tipo,
      intervalos: excData.tipo === 'cerrado' ? [] : (excData.intervalos || []),
      motivo: excData.motivo,
      createdAt: now,
      updatedAt: now
    };

    if (isPostgresConnected && pgPool) {
      try {
        await pgPool.query(`
          INSERT INTO availability_exceptions (id, alcance, profesional_id, fecha, tipo, intervalos, motivo, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `, [
          newExc.id,
          newExc.alcance,
          newExc.profesionalId || null,
          newExc.fecha,
          newExc.tipo,
          JSON.stringify(newExc.intervalos),
          newExc.motivo || null
        ]);
      } catch (err) {
        console.error('Error creating availability exception in PostgreSQL:', err);
      }
    }

    if (!memoryDb.availabilityExceptions) memoryDb.availabilityExceptions = [];
    memoryDb.availabilityExceptions.unshift(newExc);
    createdList.push(newExc);
  }

  saveLocalFileDb();
  return createdList;
}

export async function deleteAvailabilityException(id: string): Promise<boolean> {
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('DELETE FROM availability_exceptions WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('Error deleting availability exception from PostgreSQL:', err);
    }
  }

  if (!memoryDb.availabilityExceptions) return false;
  const idx = memoryDb.availabilityExceptions.findIndex(e => e.id === id);
  if (idx === -1) return false;
  memoryDb.availabilityExceptions.splice(idx, 1);
  saveLocalFileDb();
  return true;
}

export async function extendStudioScheduleForDate(
  fecha: string,
  requiredIntervals: TimeInterval[],
  motivo = 'Apertura extendida por horarios de profesionales'
): Promise<AvailabilityException> {
  // Remove existing studio exceptions for this date
  const existing = await getAvailabilityExceptions({ fecha, alcance: 'local' });
  for (const exc of existing) {
    await deleteAvailabilityException(exc.id);
  }

  const created = await createAvailabilityException({
    alcance: 'local',
    fecha,
    tipo: 'horario_especial',
    intervalos: requiredIntervals,
    motivo
  });

  return created[0];
}

// ---------------------------------------------------------------------------
// STUDIO CONFIG
// ---------------------------------------------------------------------------

export async function getStudioConfig(): Promise<StudioConfig> {
  let conf: any = { ...defaultStudioConfig };
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('SELECT config FROM studio_config WHERE id = $1', ['default']);
      if (res.rows.length > 0) {
        conf = typeof res.rows[0].config === 'string' ? JSON.parse(res.rows[0].config) : res.rows[0].config;
      }
    } catch (err) {
      console.error('Error fetching config from PostgreSQL:', err);
      conf = memoryDb.config || defaultStudioConfig;
    }
  } else {
    conf = memoryDb.config || defaultStudioConfig;
  }

  // Migrate legacy blocks if present
  let needsConfigUpdate = false;
  if (conf.diasBloqueados && Array.isArray(conf.diasBloqueados) && conf.diasBloqueados.length > 0) {
    for (const fecha of conf.diasBloqueados) {
      try {
        const existing = await getAvailabilityExceptions({ fecha, alcance: 'local' });
        if (!existing.some(e => e.tipo === 'cerrado')) {
          await createAvailabilityException({
            alcance: 'local',
            fecha,
            tipo: 'cerrado',
            motivo: 'Día cerrado (migrado de legado)'
          });
        }
      } catch (e) {}
    }
    delete conf.diasBloqueados;
    needsConfigUpdate = true;
  }
  if (conf.bloqueosDetallados && Array.isArray(conf.bloqueosDetallados) && conf.bloqueosDetallados.length > 0) {
    for (const block of conf.bloqueosDetallados) {
      try {
        const existing = await getAvailabilityExceptions({ fecha: block.fecha, alcance: block.profesionalId ? 'profesional' : 'local', profesionalId: block.profesionalId });
        if (!existing.some(e => e.tipo === 'cerrado')) {
          await createAvailabilityException({
            alcance: block.profesionalId ? 'profesional' : 'local',
            profesionalId: block.profesionalId || undefined,
            fecha: block.fecha,
            tipo: block.tipo === 'dia_completo' ? 'cerrado' : 'horario_especial',
            intervalos: block.horaInicio && block.horaFin ? [{ inicio: block.horaInicio, fin: block.horaFin }] : [],
            motivo: block.motivo || 'Bloqueo (migrado de legado)'
          });
        }
      } catch (e) {}
    }
    delete conf.bloqueosDetallados;
    needsConfigUpdate = true;
  }
  if (conf.horariosBloqueados) {
    delete conf.horariosBloqueados;
    needsConfigUpdate = true;
  }

  if (needsConfigUpdate) {
    try {
      if (isPostgresConnected && pgPool) {
        await pgPool.query(`
          INSERT INTO studio_config (id, config, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (id) DO UPDATE SET config = $2, updated_at = NOW();
        `, ['default', JSON.stringify(conf)]);
      } else {
        memoryDb.config = { ...defaultStudioConfig, ...conf };
        saveLocalFileDb();
      }
    } catch (e) {}
  }

  return { ...defaultStudioConfig, ...conf };
}

export async function updateStudioConfig(updates: Partial<StudioConfig>): Promise<StudioConfig> {
  const current = await getStudioConfig();
  const merged: StudioConfig = { ...current, ...updates };

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO studio_config (id, config, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (id) DO UPDATE SET config = $2, updated_at = NOW();
      `, ['default', JSON.stringify(merged)]);
      return merged;
    } catch (err) {
      console.error('Error updating config in PostgreSQL:', err);
    }
  }

  memoryDb.config = merged;
  saveLocalFileDb();
  return memoryDb.config;
}

export function isDatabasePostgres(): boolean {
  return isPostgresConnected;
}

// ---------------------------------------------------------------------------
// NOTIFICATION LOGS & IDEMPOTENCY
// ---------------------------------------------------------------------------

export async function isNotificationAlreadySent(idempotencyKey: string, channel: string): Promise<boolean> {
  const cleanKey = (idempotencyKey || '').trim();
  if (!cleanKey) return false;

  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query(
        `SELECT id FROM notification_logs WHERE idempotency_key = $1 AND channel = $2 AND status = 'sent' LIMIT 1`,
        [cleanKey, channel]
      );
      if (res.rows.length > 0) return true;
    } catch (err) {
      console.error('Error checking notification idempotency in PostgreSQL:', err);
    }
  }

  const logs = memoryDb.notificationLogs || [];
  return logs.some(l => l.idempotencyKey === cleanKey && l.channel === channel && l.status === 'sent');
}

export async function createNotificationLog(log: NotificationLog): Promise<NotificationLog> {
  const now = log.sentAt || new Date().toISOString();
  const entry: NotificationLog = {
    ...log,
    sentAt: now
  };

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO notification_logs (
          id, appointment_id, channel, recipient, notification_type, status,
          subject, message, idempotency_key, error, sent_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (idempotency_key) DO UPDATE SET
          status = $6,
          sent_at = $11,
          error = $10,
          metadata = $12
      `, [
        entry.id,
        entry.appointmentId || null,
        entry.channel,
        entry.recipient || null,
        entry.notificationType,
        entry.status,
        entry.subject || null,
        entry.message || null,
        entry.idempotencyKey || null,
        entry.error || null,
        now,
        JSON.stringify(entry.metadata || {})
      ]);
    } catch (err) {
      console.error('Error persisting notification log to PostgreSQL:', err);
    }
  }

  if (!memoryDb.notificationLogs) memoryDb.notificationLogs = [];
  const existingIdx = entry.idempotencyKey
    ? memoryDb.notificationLogs.findIndex(l => l.idempotencyKey === entry.idempotencyKey && l.channel === entry.channel)
    : -1;
  if (existingIdx !== -1) {
    memoryDb.notificationLogs[existingIdx] = entry;
  } else {
    memoryDb.notificationLogs.unshift(entry);
  }
  saveLocalFileDb();

  return entry;
}

export async function getNotificationLogs(filter?: {
  appointmentId?: string;
  channel?: string;
  limit?: number;
}): Promise<NotificationLog[]> {
  const limit = Math.min(filter?.limit || 100, 200);

  if (isPostgresConnected && pgPool) {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      if (filter?.appointmentId) {
        values.push(filter.appointmentId);
        conditions.push(`appointment_id = $${values.length}`);
      }
      if (filter?.channel) {
        values.push(filter.channel);
        conditions.push(`channel = $${values.length}`);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      values.push(limit);
      const res = await pgPool.query(`SELECT * FROM notification_logs ${where} ORDER BY sent_at DESC LIMIT $${values.length}`, values);
      return res.rows.map(row => ({
        id: row.id,
        appointmentId: row.appointment_id || undefined,
        channel: row.channel,
        recipient: row.recipient || '',
        notificationType: row.notification_type,
        status: row.status,
        subject: row.subject || undefined,
        message: row.message || undefined,
        idempotencyKey: row.idempotency_key || undefined,
        error: row.error || undefined,
        sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : new Date().toISOString(),
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {})
      }));
    } catch (err) {
      console.error('Error getting notification logs from PostgreSQL:', err);
    }
  }

  let logs = [...(memoryDb.notificationLogs || [])];
  if (filter?.appointmentId) logs = logs.filter(l => l.appointmentId === filter.appointmentId);
  if (filter?.channel) logs = logs.filter(l => l.channel === filter.channel);
  return logs.slice(0, limit);
}

// ---------------------------------------------------------------------------
// ATOMIC TRANSACTION: AVAILABILITY EXCEPTION & CANCELLATIONS
// ---------------------------------------------------------------------------

export async function applyAvailabilityExceptionWithCancellations(payload: {
  alcance: ScheduleScope;
  profesionalId?: string;
  profesionalIds?: string[];
  fecha: string;
  tipo: AvailabilityExceptionType;
  intervalos?: TimeInterval[];
  motivo?: string;
  conflictAppointmentIds?: string[];
  cancelMotivo?: string;
  canceladoPor?: string;
}): Promise<{
  exceptions: AvailabilityException[];
  cancelledAppointments: Appointment[];
}> {
  const cancelMotivo = (payload.cancelMotivo || 'Cancelado por parte del salón, por excepción de horarios').trim();
  const canceladoPor = (payload.canceladoPor || 'Sistema / Excepción de horarios').trim();
  const now = new Date().toISOString();

  const targetProfIds: (string | undefined)[] = payload.alcance === 'profesional'
    ? (payload.profesionalIds && payload.profesionalIds.length > 0 ? payload.profesionalIds : [payload.profesionalId])
    : [undefined];

  const exceptionsToCreate: AvailabilityException[] = targetProfIds.map(pId => ({
    id: `exc-${payload.alcance}-${pId || 'local'}-${payload.fecha}-${Math.floor(Math.random() * 10000)}`,
    alcance: payload.alcance,
    profesionalId: pId,
    fecha: payload.fecha,
    tipo: payload.tipo,
    intervalos: payload.tipo === 'cerrado' ? [] : (payload.intervalos || []),
    motivo: payload.motivo,
    createdAt: now,
    updatedAt: now
  }));

  const conflictIds = (payload.conflictAppointmentIds || []).filter(Boolean);
  let updatedAppointments: Appointment[] = [];

  // Database Transaction execution (PostgreSQL)
  if (isPostgresConnected && pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // 1. Cancel conflicting appointments in atomic transaction
      if (conflictIds.length > 0) {
        await client.query(`
          UPDATE appointments
          SET estado = 'cancelado',
              motivo_cancelacion = $1,
              cancelado_en = $2,
              cancelado_origen = 'excepcion_disponibilidad',
              cancelado_por = $3,
              updated_at = NOW()
          WHERE id = ANY($4)
        `, [cancelMotivo, now, canceladoPor, conflictIds]);

        const updatedRes = await client.query(`
          SELECT * FROM appointments WHERE id = ANY($1)
        `, [conflictIds]);

        updatedAppointments = updatedRes.rows.map(mapAppointmentRow);
      }

      // 2. Insert availability exceptions in same transaction
      for (const exc of exceptionsToCreate) {
        await client.query(`
          INSERT INTO availability_exceptions (id, alcance, profesional_id, fecha, tipo, intervalos, motivo, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `, [
          exc.id,
          exc.alcance,
          exc.profesionalId || null,
          exc.fecha,
          exc.tipo,
          JSON.stringify(exc.intervalos),
          exc.motivo || null
        ]);
      }

      // Confirm / commit the transaction
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      console.error('Error executing availability exception transaction in PostgreSQL:', txErr);
      throw txErr;
    } finally {
      client.release();
    }
  }

  // Synchronize memoryDb
  if (conflictIds.length > 0) {
    const memoryUpdated: Appointment[] = [];
    for (const apt of memoryDb.appointments) {
      if (conflictIds.includes(apt.id)) {
        apt.estado = 'cancelado';
        apt.motivoCancelacion = cancelMotivo;
        apt.canceladoEn = now;
        apt.canceladoOrigen = 'excepcion_disponibilidad';
        apt.canceladoPor = canceladoPor;
        apt.updatedAt = now;
        memoryUpdated.push(apt);
      }
    }
    if (updatedAppointments.length === 0) {
      updatedAppointments = memoryUpdated;
    }
  }

  if (!memoryDb.availabilityExceptions) memoryDb.availabilityExceptions = [];
  for (const exc of exceptionsToCreate) {
    memoryDb.availabilityExceptions.unshift(exc);
  }
  saveLocalFileDb();

  return {
    exceptions: exceptionsToCreate,
    cancelledAppointments: updatedAppointments
  };
}

// ---------------------------------------------------------------------------
// CRUD OPERATIONS: PROMOCIONES (PUBLIC CODES & PROMOTIONS)
// ---------------------------------------------------------------------------

function mapPromotionRow(row: any): Promotion {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion || undefined,
    activo: Boolean(row.activo),
    tipoDescuento: row.tipo_descuento as DiscountType,
    valorDescuento: Number(row.valor_descuento),
    fechaInicio: row.fecha_inicio,
    fechaVencimiento: row.fecha_vencimiento || null,
    limiteTotalUsos: row.limite_total_usos != null ? Number(row.limite_total_usos) : null,
    limiteUsoPorCliente: row.limite_uso_por_cliente != null ? Number(row.limite_uso_por_cliente) : null,
    periodoReutilizacionDias: row.periodo_reutilizacion_dias != null ? Number(row.periodo_reutilizacion_dias) : null,
    serviciosAplicables: typeof row.servicios_aplicables === 'string' ? JSON.parse(row.servicios_aplicables) : (row.servicios_aplicables || ['todos']),
    montoMinimo: row.monto_minimo != null ? Number(row.monto_minimo) : null,
    usosActuales: Number(row.usos_actuales || 0),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

function mapPromotionUsageRow(row: any): PromotionUsage {
  return {
    id: row.id,
    promocionId: row.promocion_id,
    codigo: row.codigo,
    clienteId: row.cliente_id || undefined,
    clienteTelefono: row.cliente_telefono || undefined,
    clienteEmail: row.cliente_email || undefined,
    turnoId: row.turno_id || undefined,
    descuentoAplicado: Number(row.descuento_aplicado),
    precioOriginal: Number(row.precio_original),
    precioFinal: Number(row.precio_final),
    fechaUso: row.fecha_uso ? new Date(row.fecha_uso).toISOString() : new Date().toISOString()
  };
}

function mapClientBenefitRow(row: any): ClientBenefit {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNombre: row.cliente_nombre || undefined,
    clienteTelefono: row.cliente_telefono || undefined,
    clienteEmail: row.cliente_email || undefined,
    titulo: row.titulo,
    descripcion: row.descripcion || undefined,
    tipoDescuento: row.tipo_descuento as DiscountType,
    valorDescuento: Number(row.valor_descuento),
    origen: row.origen as BenefitOrigin,
    origenDetalle: row.origen_detalle || undefined,
    fechaEmision: row.fecha_emision,
    fechaVencimiento: row.fecha_vencimiento || null,
    estado: row.estado as BenefitStatus,
    turnoOrigenId: row.turno_origen_id || null,
    turnoOrigenCodigo: row.turno_origen_codigo || null,
    turnoUsoId: row.turno_uso_id || null,
    turnoUsoCodigo: row.turno_uso_codigo || null,
    usadoEn: row.usado_en ? new Date(row.usado_en).toISOString() : null,
    serviciosAplicables: typeof row.servicios_aplicables === 'string' ? JSON.parse(row.servicios_aplicables) : (row.servicios_aplicables || ['todos']),
    montoMinimo: row.monto_minimo != null ? Number(row.monto_minimo) : null,
    descuentoAplicado: row.descuento_aplicado != null ? Number(row.descuento_aplicado) : null,
    otorgadoPor: row.otorgado_por || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function getPromotions(includeInactive: boolean = true): Promise<Promotion[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const query = includeInactive
        ? 'SELECT * FROM promotions ORDER BY created_at DESC'
        : 'SELECT * FROM promotions WHERE activo = TRUE ORDER BY created_at DESC';
      const res = await pgPool.query(query);
      return res.rows.map(row => mapPromotionRow(row));
    } catch (err) {
      console.error('Error fetching promotions from PostgreSQL:', err);
    }
  }

  let list = memoryDb.promotions || [];
  if (!includeInactive) {
    list = list.filter(p => p.activo);
  }
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPromotionById(id: string): Promise<Promotion | null> {
  const cleanId = (id || '').trim();
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM promotions WHERE id = $1', [cleanId]);
      if (res.rows.length > 0) return mapPromotionRow(res.rows[0]);
    } catch (err) {
      console.error('Error fetching promotion by id from PostgreSQL:', err);
    }
  }
  return memoryDb.promotions?.find(p => p.id === cleanId) || null;
}

export async function getPromotionByCode(code: string): Promise<Promotion | null> {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) return null;

  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM promotions WHERE UPPER(codigo) = $1', [cleanCode]);
      if (res.rows.length > 0) return mapPromotionRow(res.rows[0]);
    } catch (err) {
      console.error('Error fetching promotion by code from PostgreSQL:', err);
    }
  }
  return memoryDb.promotions?.find(p => p.codigo.toUpperCase() === cleanCode) || null;
}

export async function createPromotion(promoData: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt' | 'usosActuales'>): Promise<Promotion> {
  const id = `promo-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const cleanCode = promoData.codigo.trim().toUpperCase();

  const newPromo: Promotion = {
    ...promoData,
    id,
    codigo: cleanCode,
    usosActuales: 0,
    serviciosAplicables: promoData.serviciosAplicables || ['todos'],
    createdAt: now,
    updatedAt: now
  };

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO promotions (
          id, codigo, nombre, descripcion, activo, tipo_descuento, valor_descuento,
          fecha_inicio, fecha_vencimiento, limite_total_usos, limite_uso_por_cliente,
          periodo_reutilizacion_dias, servicios_aplicables, monto_minimo, usos_actuales,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      `, [
        newPromo.id,
        newPromo.codigo,
        newPromo.nombre,
        newPromo.descripcion || null,
        newPromo.activo,
        newPromo.tipoDescuento,
        newPromo.valorDescuento,
        newPromo.fechaInicio,
        newPromo.fechaVencimiento || null,
        newPromo.limiteTotalUsos || null,
        newPromo.limiteUsoPorCliente || null,
        newPromo.periodoReutilizacionDias || null,
        JSON.stringify(newPromo.serviciosAplicables),
        newPromo.montoMinimo || null,
        0
      ]);
      return newPromo;
    } catch (err) {
      console.error('Error creating promotion in PostgreSQL:', err);
      throw err;
    }
  }

  if (!memoryDb.promotions) memoryDb.promotions = [];
  memoryDb.promotions.unshift(newPromo);
  saveLocalFileDb();
  return newPromo;
}

export async function updatePromotion(id: string, updates: Partial<Promotion>): Promise<Promotion | null> {
  const cleanId = (id || '').trim();
  const now = new Date().toISOString();

  if (updates.codigo) {
    updates.codigo = updates.codigo.trim().toUpperCase();
  }

  if (isPostgresConnected && pgPool) {
    try {
      const current = await getPromotionById(cleanId);
      if (!current) return null;

      const merged: Promotion = {
        ...current,
        ...updates,
        updatedAt: now
      };

      await pgPool.query(`
        UPDATE promotions
        SET codigo = $1,
            nombre = $2,
            descripcion = $3,
            activo = $4,
            tipo_descuento = $5,
            valor_descuento = $6,
            fecha_inicio = $7,
            fecha_vencimiento = $8,
            limite_total_usos = $9,
            limite_uso_por_cliente = $10,
            periodo_reutilizacion_dias = $11,
            servicios_aplicables = $12,
            monto_minimo = $13,
            updated_at = NOW()
        WHERE id = $14
      `, [
        merged.codigo,
        merged.nombre,
        merged.descripcion || null,
        merged.activo,
        merged.tipoDescuento,
        merged.valorDescuento,
        merged.fechaInicio,
        merged.fechaVencimiento || null,
        merged.limiteTotalUsos || null,
        merged.limiteUsoPorCliente || null,
        merged.periodoReutilizacionDias || null,
        JSON.stringify(merged.serviciosAplicables || ['todos']),
        merged.montoMinimo || null,
        cleanId
      ]);

      return merged;
    } catch (err) {
      console.error('Error updating promotion in PostgreSQL:', err);
      throw err;
    }
  }

  if (!memoryDb.promotions) memoryDb.promotions = [];
  const idx = memoryDb.promotions.findIndex(p => p.id === cleanId);
  if (idx === -1) return null;

  const merged = { ...memoryDb.promotions[idx], ...updates, updatedAt: now };
  memoryDb.promotions[idx] = merged;
  saveLocalFileDb();
  return merged;
}

export async function deletePromotion(id: string): Promise<boolean> {
  // Soft delete: deactivate to preserve historical integrity
  const updated = await updatePromotion(id, { activo: false });
  return updated !== null;
}

export async function getPromotionUsages(promocionId?: string, clienteId?: string): Promise<PromotionUsage[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      if (promocionId) {
        values.push(promocionId);
        conditions.push(`promocion_id = $${values.length}`);
      }
      if (clienteId) {
        values.push(clienteId);
        conditions.push(`cliente_id = $${values.length}`);
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const res = await pgPool.query(`SELECT * FROM promotion_usages ${whereClause} ORDER BY fecha_uso DESC`, values);
      return res.rows.map(row => mapPromotionUsageRow(row));
    } catch (err) {
      console.error('Error fetching promotion usages from PostgreSQL:', err);
    }
  }

  let list = memoryDb.promotionUsages || [];
  if (promocionId) list = list.filter(u => u.promocionId === promocionId);
  if (clienteId) list = list.filter(u => u.clienteId === clienteId);
  return [...list].sort((a, b) => b.fechaUso.localeCompare(a.fechaUso));
}

// ---------------------------------------------------------------------------
// VALIDATION: PUBLIC PROMOTION CODE
// ---------------------------------------------------------------------------

export async function validatePromotion(params: {
  codigo: string;
  servicioId: string;
  precio: number;
  clienteId?: string;
  telefono?: string;
  email?: string;
  fecha?: string;
}): Promise<ValidateDiscountResult> {
  const cleanCode = (params.codigo || '').trim().toUpperCase();
  if (!cleanCode) {
    return { valido: false, error: 'Por favor ingresá un código promocional.' };
  }

  const promo = await getPromotionByCode(cleanCode);
  if (!promo) {
    return { valido: false, error: `El código "${cleanCode}" no es válido o no existe.` };
  }

  if (!promo.activo) {
    return { valido: false, error: `La promoción "${promo.nombre}" se encuentra inactiva.` };
  }

  const todayStr = params.fecha || new Date().toISOString().split('T')[0];
  if (promo.fechaInicio && todayStr < promo.fechaInicio) {
    return { valido: false, error: `Esta promoción aún no está vigente (comienza el ${promo.fechaInicio}).` };
  }
  if (promo.fechaVencimiento && todayStr > promo.fechaVencimiento) {
    return { valido: false, error: `Esta promoción ha vencido el ${promo.fechaVencimiento}.` };
  }

  // Check total usage limit
  if (promo.limiteTotalUsos != null && promo.limiteTotalUsos > 0) {
    let currentUsages = promo.usosActuales || 0;
    if (isPostgresConnected && pgPool) {
      const countRes = await pgPool.query('SELECT COUNT(*) FROM promotion_usages WHERE promocion_id = $1', [promo.id]);
      currentUsages = parseInt(countRes.rows[0].count, 10);
    }
    if (currentUsages >= promo.limiteTotalUsos) {
      return { valido: false, error: `Esta promoción ha alcanzado su límite total de usos disponibles (${promo.limiteTotalUsos}).` };
    }
  }

  // Check service applicability
  if (promo.serviciosAplicables && promo.serviciosAplicables.length > 0 && !promo.serviciosAplicables.includes('todos')) {
    if (!promo.serviciosAplicables.includes(params.servicioId)) {
      return { valido: false, error: `Esta promoción no es válida para el servicio seleccionado.` };
    }
  }

  // Check minimum amount
  const basePrice = Number(params.precio || 0);
  if (promo.montoMinimo != null && promo.montoMinimo > 0) {
    if (basePrice < promo.montoMinimo) {
      return {
        valido: false,
        error: `Esta promoción requiere un monto mínimo de $${promo.montoMinimo.toLocaleString('es-AR')}. (Precio actual: $${basePrice.toLocaleString('es-AR')})`
      };
    }
  }

  // Check per-client limits and reuse period
  const phoneNormObj = normalizePhone(params.telefono || '');
  const cleanPhone = phoneNormObj.canonical || phoneNormObj.nationalDigits || '';
  const cleanEmail = normalizeEmail(params.email || '');

  if (params.clienteId || cleanPhone || cleanEmail) {
    let clientUsages: PromotionUsage[] = [];
    if (isPostgresConnected && pgPool) {
      const res = await pgPool.query(`
        SELECT * FROM promotion_usages
        WHERE promocion_id = $1 AND (
          ($2::varchar IS NOT NULL AND cliente_id = $2) OR
          ($3::varchar != '' AND cliente_telefono = $3) OR
          ($4::varchar != '' AND cliente_email = $4)
        )
        ORDER BY fecha_uso DESC
      `, [promo.id, params.clienteId || null, cleanPhone, cleanEmail]);
      clientUsages = res.rows.map(row => mapPromotionUsageRow(row));
    } else {
      clientUsages = (memoryDb.promotionUsages || []).filter(u =>
        u.promocionId === promo.id && (
          (params.clienteId && u.clienteId === params.clienteId) ||
          (cleanPhone && u.clienteTelefono === cleanPhone) ||
          (cleanEmail && u.clienteEmail === cleanEmail)
        )
      ).sort((a, b) => b.fechaUso.localeCompare(a.fechaUso));
    }

    // Reuse period in days check
    if (promo.periodoReutilizacionDias != null && promo.periodoReutilizacionDias > 0 && clientUsages.length > 0) {
      const lastUsage = clientUsages[0];
      const lastDate = new Date(lastUsage.fechaUso).getTime();
      const nowMs = Date.now();
      const daysElapsed = (nowMs - lastDate) / (1000 * 60 * 60 * 24);
      if (daysElapsed < promo.periodoReutilizacionDias) {
        const reusableDate = new Date(lastDate + promo.periodoReutilizacionDias * 86400000);
        return {
          valido: false,
          error: `Ya has utilizado esta promoción recientemente. Podrás volver a utilizarla a partir del ${reusableDate.toLocaleDateString('es-AR')}.`
        };
      }
    }

    // Per-client total limit check
    if (promo.limiteUsoPorCliente != null && promo.limiteUsoPorCliente > 0) {
      if (clientUsages.length >= promo.limiteUsoPorCliente) {
        return {
          valido: false,
          error: `Ya has alcanzado el límite de usos permitidos (${promo.limiteUsoPorCliente}) para tu cuenta en esta promoción.`
        };
      }
    }
  }

  // Calculate discount
  let montoDescontado = 0;
  if (promo.tipoDescuento === 'porcentaje') {
    montoDescontado = Math.round(basePrice * (promo.valorDescuento / 100));
  } else {
    montoDescontado = promo.valorDescuento;
  }
  montoDescontado = Math.min(basePrice, Math.max(0, montoDescontado));
  const precioFinal = Math.max(0, basePrice - montoDescontado);

  return {
    valido: true,
    tipo: 'promocion',
    descuentoId: promo.id,
    codigo: promo.codigo,
    titulo: promo.nombre,
    descripcion: promo.descripcion,
    tipoDescuento: promo.tipoDescuento,
    valorDescuento: promo.valorDescuento,
    montoDescontado,
    precioOriginal: basePrice,
    precioFinal
  };
}

// ---------------------------------------------------------------------------
// CRUD OPERATIONS: CLIENT BENEFITS (INDIVIDUAL ADMINISTRATIVE BENEFITS)
// ---------------------------------------------------------------------------

export async function getClientBenefits(params?: {
  clienteId?: string;
  estado?: BenefitStatus;
  search?: string;
}): Promise<ClientBenefit[]> {
  if (isPostgresConnected && pgPool) {
    try {
      const conditions: string[] = [];
      const values: any[] = [];

      if (params?.clienteId) {
        values.push(params.clienteId);
        conditions.push(`cliente_id = $${values.length}`);
      }
      if (params?.estado) {
        values.push(params.estado);
        conditions.push(`estado = $${values.length}`);
      }
      if (params?.search) {
        values.push(`%${params.search.toLowerCase()}%`);
        conditions.push(`(
          LOWER(titulo) LIKE $${values.length} OR
          LOWER(cliente_nombre) LIKE $${values.length} OR
          LOWER(cliente_telefono) LIKE $${values.length}
        )`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const res = await pgPool.query(`SELECT * FROM client_benefits ${whereClause} ORDER BY created_at DESC`, values);
      return res.rows.map(row => mapClientBenefitRow(row));
    } catch (err) {
      console.error('Error fetching client benefits from PostgreSQL:', err);
    }
  }

  let list = memoryDb.clientBenefits || [];
  if (params?.clienteId) list = list.filter(b => b.clienteId === params.clienteId);
  if (params?.estado) list = list.filter(b => b.estado === params.estado);
  if (params?.search) {
    const q = params.search.toLowerCase();
    list = list.filter(b =>
      b.titulo.toLowerCase().includes(q) ||
      (b.clienteNombre && b.clienteNombre.toLowerCase().includes(q)) ||
      (b.clienteTelefono && b.clienteTelefono.toLowerCase().includes(q))
    );
  }
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAvailableClientBenefits(params: {
  clienteId?: string;
  telefono?: string;
  email?: string;
  servicioId?: string;
  precio?: number;
}): Promise<ClientBenefit[]> {
  const cleanPhone = normalizePhone(params.telefono || '');
  const cleanEmail = normalizeEmail(params.email || '');
  const todayStr = new Date().toISOString().split('T')[0];

  let benefits: ClientBenefit[] = [];

  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query(`
        SELECT * FROM client_benefits
        WHERE estado = 'disponible' AND (
          ($1::varchar IS NOT NULL AND cliente_id = $1) OR
          ($2::varchar != '' AND cliente_telefono = $2) OR
          ($3::varchar != '' AND cliente_email = $3)
        )
        ORDER BY created_at DESC
      `, [params.clienteId || null, cleanPhone, cleanEmail]);
      benefits = res.rows.map(row => mapClientBenefitRow(row));
    } catch (err) {
      console.error('Error fetching available client benefits from PostgreSQL:', err);
    }
  } else {
    benefits = (memoryDb.clientBenefits || []).filter(b =>
      b.estado === 'disponible' && (
        (params.clienteId && b.clienteId === params.clienteId) ||
        (cleanPhone && b.clienteTelefono && normalizePhone(b.clienteTelefono) === cleanPhone) ||
        (cleanEmail && b.clienteEmail && normalizeEmail(b.clienteEmail) === cleanEmail)
      )
    );
  }

  // Filter out expired, and filter by service & min amount if provided
  const validBenefits: ClientBenefit[] = [];
  for (const b of benefits) {
    if (b.fechaVencimiento && todayStr > b.fechaVencimiento) {
      // Auto mark expired
      updateClientBenefit(b.id, { estado: 'vencido' }).catch(() => {});
      continue;
    }

    if (params.servicioId && b.serviciosAplicables && b.serviciosAplicables.length > 0 && !b.serviciosAplicables.includes('todos')) {
      if (!b.serviciosAplicables.includes(params.servicioId)) {
        continue;
      }
    }

    if (params.precio != null && b.montoMinimo != null && b.montoMinimo > 0) {
      if (params.precio < b.montoMinimo) {
        continue;
      }
    }

    validBenefits.push(b);
  }

  return validBenefits;
}

export async function createClientBenefit(benefitData: Omit<ClientBenefit, 'id' | 'createdAt' | 'updatedAt' | 'estado'>): Promise<ClientBenefit> {
  const id = `ben-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];

  // Fetch client details if not present
  let clientName = benefitData.clienteNombre;
  let clientPhone = benefitData.clienteTelefono;
  let clientEmail = benefitData.clienteEmail;

  if (benefitData.clienteId && (!clientName || !clientPhone)) {
    const clients = await getClients({ activeOnly: false });
    const client = clients.find(c => c.id === benefitData.clienteId);
    if (client) {
      clientName = `${client.nombre} ${client.apellido}`.trim();
      const pNorm = normalizePhone(client.telefono);
      clientPhone = pNorm.canonical || pNorm.nationalDigits || client.telefono;
      clientEmail = normalizeEmail(client.email || '');
    }
  }

  const phoneNorm = clientPhone ? normalizePhone(clientPhone) : null;
  const cleanPhoneStr = phoneNorm ? (phoneNorm.canonical || phoneNorm.nationalDigits || clientPhone) : undefined;
  const cleanEmailStr = clientEmail ? normalizeEmail(clientEmail) : undefined;

  const newBenefit: ClientBenefit = {
    ...benefitData,
    id,
    clienteNombre: clientName,
    clienteTelefono: cleanPhoneStr,
    clienteEmail: cleanEmailStr,
    fechaEmision: benefitData.fechaEmision || todayStr,
    estado: 'disponible',
    serviciosAplicables: benefitData.serviciosAplicables || ['todos'],
    createdAt: now,
    updatedAt: now
  };

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO client_benefits (
          id, cliente_id, cliente_nombre, cliente_telefono, cliente_email,
          titulo, descripcion, tipo_descuento, valor_descuento,
          origen, origen_detalle, fecha_emision, fecha_vencimiento,
          estado, turno_origen_id, turno_origen_codigo,
          servicios_aplicables, monto_minimo, otorgado_por,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19,
          NOW(), NOW()
        )
      `, [
        newBenefit.id,
        newBenefit.clienteId,
        newBenefit.clienteNombre || null,
        newBenefit.clienteTelefono || null,
        newBenefit.clienteEmail || null,
        newBenefit.titulo,
        newBenefit.descripcion || null,
        newBenefit.tipoDescuento,
        newBenefit.valorDescuento,
        newBenefit.origen,
        newBenefit.origenDetalle || null,
        newBenefit.fechaEmision,
        newBenefit.fechaVencimiento || null,
        newBenefit.estado,
        newBenefit.turnoOrigenId || null,
        newBenefit.turnoOrigenCodigo || null,
        JSON.stringify(newBenefit.serviciosAplicables),
        newBenefit.montoMinimo || null,
        newBenefit.otorgadoPor || null
      ]);
      return newBenefit;
    } catch (err) {
      console.error('Error creating client benefit in PostgreSQL:', err);
      throw err;
    }
  }

  if (!memoryDb.clientBenefits) memoryDb.clientBenefits = [];
  memoryDb.clientBenefits.unshift(newBenefit);
  saveLocalFileDb();
  return newBenefit;
}

export async function updateClientBenefit(id: string, updates: Partial<ClientBenefit>): Promise<ClientBenefit | null> {
  const cleanId = (id || '').trim();
  const now = new Date().toISOString();

  if (isPostgresConnected && pgPool) {
    try {
      const currentRes = await pgPool.query('SELECT * FROM client_benefits WHERE id = $1', [cleanId]);
      if (currentRes.rows.length === 0) return null;
      const current = mapClientBenefitRow(currentRes.rows[0]);

      const merged: ClientBenefit = {
        ...current,
        ...updates,
        updatedAt: now
      };

      await pgPool.query(`
        UPDATE client_benefits
        SET titulo = $1,
            descripcion = $2,
            tipo_descuento = $3,
            valor_descuento = $4,
            fecha_vencimiento = $5,
            estado = $6,
            turno_uso_id = $7,
            turno_uso_codigo = $8,
            usado_en = $9,
            descuento_aplicado = $10,
            servicios_aplicables = $11,
            monto_minimo = $12,
            updated_at = NOW()
        WHERE id = $13
      `, [
        merged.titulo,
        merged.descripcion || null,
        merged.tipoDescuento,
        merged.valorDescuento,
        merged.fechaVencimiento || null,
        merged.estado,
        merged.turnoUsoId || null,
        merged.turnoUsoCodigo || null,
        merged.usadoEn ? new Date(merged.usadoEn) : null,
        merged.descuentoAplicado || null,
        JSON.stringify(merged.serviciosAplicables || ['todos']),
        merged.montoMinimo || null,
        cleanId
      ]);

      return merged;
    } catch (err) {
      console.error('Error updating client benefit in PostgreSQL:', err);
      throw err;
    }
  }

  if (!memoryDb.clientBenefits) memoryDb.clientBenefits = [];
  const idx = memoryDb.clientBenefits.findIndex(b => b.id === cleanId);
  if (idx === -1) return null;

  const merged = { ...memoryDb.clientBenefits[idx], ...updates, updatedAt: now };
  memoryDb.clientBenefits[idx] = merged;
  saveLocalFileDb();
  return merged;
}

export async function validateClientBenefit(params: {
  beneficioId: string;
  servicioId: string;
  precio: number;
  clienteId?: string;
  telefono?: string;
  email?: string;
}): Promise<ValidateDiscountResult> {
  const cleanId = (params.beneficioId || '').trim();
  if (!cleanId) {
    return { valido: false, error: 'Beneficio no especificado.' };
  }

  let benefit: ClientBenefit | null = null;
  if (isPostgresConnected && pgPool) {
    const res = await pgPool.query('SELECT * FROM client_benefits WHERE id = $1', [cleanId]);
    if (res.rows.length > 0) benefit = mapClientBenefitRow(res.rows[0]);
  } else {
    benefit = memoryDb.clientBenefits?.find(b => b.id === cleanId) || null;
  }

  if (!benefit) {
    return { valido: false, error: 'El beneficio seleccionado no existe.' };
  }

  if (benefit.estado !== 'disponible') {
    return { valido: false, error: `Este beneficio ya no se encuentra disponible (estado: ${benefit.estado}).` };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  if (benefit.fechaVencimiento && todayStr > benefit.fechaVencimiento) {
    updateClientBenefit(benefit.id, { estado: 'vencido' }).catch(() => {});
    return { valido: false, error: `Este beneficio ha vencido el ${benefit.fechaVencimiento}.` };
  }

  // Check client matching
  const cleanPhone = normalizePhone(params.telefono || '');
  const benefitPhone = normalizePhone(benefit.clienteTelefono || '');
  if (params.clienteId && benefit.clienteId && params.clienteId !== benefit.clienteId && cleanPhone && benefitPhone && cleanPhone !== benefitPhone) {
    return { valido: false, error: 'Este beneficio pertenece a otra clienta.' };
  }

  // Check service applicability
  if (benefit.serviciosAplicables && benefit.serviciosAplicables.length > 0 && !benefit.serviciosAplicables.includes('todos')) {
    if (!benefit.serviciosAplicables.includes(params.servicioId)) {
      return { valido: false, error: 'Este beneficio no aplica para el servicio seleccionado.' };
    }
  }

  // Check minimum amount
  const basePrice = Number(params.precio || 0);
  if (benefit.montoMinimo != null && benefit.montoMinimo > 0) {
    if (basePrice < benefit.montoMinimo) {
      return {
        valido: false,
        error: `Este beneficio requiere un monto mínimo de $${benefit.montoMinimo.toLocaleString('es-AR')}.`
      };
    }
  }

  // Calculate discount
  let montoDescontado = 0;
  if (benefit.tipoDescuento === 'porcentaje') {
    montoDescontado = Math.round(basePrice * (benefit.valorDescuento / 100));
  } else {
    montoDescontado = benefit.valorDescuento;
  }
  montoDescontado = Math.min(basePrice, Math.max(0, montoDescontado));
  const precioFinal = Math.max(0, basePrice - montoDescontado);

  return {
    valido: true,
    tipo: 'beneficio',
    descuentoId: benefit.id,
    titulo: benefit.titulo,
    descripcion: benefit.descripcion,
    tipoDescuento: benefit.tipoDescuento,
    valorDescuento: benefit.valorDescuento,
    montoDescontado,
    precioOriginal: basePrice,
    precioFinal
  };
}

// ---------------------------------------------------------------------------
// COMPENSATION / EXCEPTION BENEFIT ISSUANCE
// ---------------------------------------------------------------------------

export async function grantCompensationBenefitForCancelledAppointment(params: {
  appointmentId: string;
  tipoDescuento: DiscountType;
  valorDescuento: number;
  diasValidez?: number | null;
  fechaVencimiento?: string | null;
  titulo?: string;
  descripcion?: string;
  serviciosAplicables?: string[];
  montoMinimo?: number | null;
  otorgadoPor?: string;
}): Promise<ClientBenefit> {
  const cleanAptId = (params.appointmentId || '').trim();
  const apt = await getAppointmentById(cleanAptId);
  if (!apt) {
    throw new Error('El turno indicado para compensación no existe.');
  }

  // Idempotency check: verify if a benefit for this cancelled appointment already exists
  if (isPostgresConnected && pgPool) {
    try {
      const existingRes = await pgPool.query(
        'SELECT * FROM client_benefits WHERE turno_origen_id = $1 LIMIT 1',
        [apt.id]
      );
      if (existingRes.rows.length > 0) {
        return mapClientBenefitRow(existingRes.rows[0]);
      }
    } catch (err) {
      console.error('Error checking existing compensation benefit in PostgreSQL:', err);
    }
  } else {
    const existing = (memoryDb.clientBenefits || []).find(b => b.turnoOrigenId === apt.id);
    if (existing) {
      return existing;
    }
  }

  let expDate = params.fechaVencimiento || null;
  if (!expDate && params.diasValidez && params.diasValidez > 0) {
    const d = new Date();
    d.setDate(d.getDate() + params.diasValidez);
    expDate = d.toISOString().split('T')[0];
  }

  const titulo = params.titulo || `Compensación por cancelación de turno (${apt.codigo})`;
  const descripcion = params.descripcion || `Beneficio de compensación otorgado por cancelación del turno ${apt.servicioNombre} del ${apt.fecha}`;

  try {
    return await createClientBenefit({
      clienteId: apt.clienteId || `cli-${apt.telefono}`,
      clienteNombre: `${apt.nombre} ${apt.apellido}`.trim(),
      clienteTelefono: apt.telefono,
      clienteEmail: apt.email || undefined,
      titulo,
      descripcion,
      tipoDescuento: params.tipoDescuento,
      valorDescuento: params.valorDescuento,
      origen: 'cancelacion_excepcion',
      origenDetalle: `Turno ${apt.codigo} cancelado por excepción de agenda`,
      fechaEmision: new Date().toISOString().split('T')[0],
      fechaVencimiento: expDate,
      turnoOrigenId: apt.id,
      turnoOrigenCodigo: apt.codigo,
      serviciosAplicables: params.serviciosAplicables || ['todos'],
      montoMinimo: params.montoMinimo || null,
      otorgadoPor: params.otorgadoPor || 'Administración'
    });
  } catch (err: any) {
    // If a concurrent request inserted a benefit with the same turno_origen_id (caught by UNIQUE index)
    if (isPostgresConnected && pgPool && (err?.code === '23505' || err?.message?.includes('unique') || err?.message?.includes('duplicate'))) {
      const existingRes = await pgPool.query(
        'SELECT * FROM client_benefits WHERE turno_origen_id = $1 LIMIT 1',
        [apt.id]
      );
      if (existingRes.rows.length > 0) {
        return mapClientBenefitRow(existingRes.rows[0]);
      }
    }
    throw err;
  }
}

