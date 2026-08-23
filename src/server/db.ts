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
  AvailabilityException
} from '../types.js';
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
  diasBloqueados: [],
  horariosBloqueados: {},
  bloqueosDetallados: [],
  pinAdmin: "1234",
  diasInactividadCliente: 60
};

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
  availabilityExceptions: []
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

          CREATE INDEX IF NOT EXISTS idx_appointments_fecha ON appointments(fecha);
          CREATE INDEX IF NOT EXISTS idx_appointments_estado ON appointments(estado);
          CREATE INDEX IF NOT EXISTS idx_appointments_cliente_id ON appointments(cliente_id);
          CREATE INDEX IF NOT EXISTS idx_appointments_profesional_id ON appointments(profesional_id);
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
      console.error('⚠️ Could not connect to PostgreSQL, falling back to local storage:', err);
      isPostgresConnected = false;
      loadLocalFileDb();
    }
  } else {
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

      if (filter?.search) {
        const qNorm = normalizeText(filter.search);
        const qPhone = filter.search.replace(/\D/g, '');
        values.push(`%${filter.search.toLowerCase()}%`);
        values.push(`%${qNorm}%`);
        values.push(`%${qPhone}%`);
        
        conditions.push(`(
          LOWER(nombre) LIKE $1 OR
          LOWER(apellido) LIKE $1 OR
          LOWER(COALESCE(email, '')) LIKE $1 OR
          telefono LIKE $1 OR
          nombre_normalizado LIKE $2 OR
          apellido_normalizado LIKE $2 OR
          telefono_normalizado LIKE $3
        )`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM clients ${whereClause} ORDER BY created_at DESC`;
      const res = await pgPool.query(query, values.length > 0 ? [values[0], values[1], values[2]] : []);

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

  // Enrich with appointment stats
  const allAppointments = await getAppointments();
  const studioConfig = await getStudioConfig();
  const diasInactividad = studioConfig.diasInactividadCliente || 60;
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const inactivityDaysAgo = new Date(Date.now() - diasInactividad * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const allActiveAlerts = await getClientAlerts(undefined, true);

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
      result = result.filter(c => (c.totalTurnos || 0) >= 2);
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

  if (filter?.search && (!isPostgresConnected || !pgPool)) {
    const q = filter.search.toLowerCase();
    const qNorm = normalizeText(filter.search);
    result = result.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.apellido.toLowerCase().includes(q) ||
      c.telefono.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      c.nombreNormalizado.includes(qNorm) ||
      c.apellidoNormalizado.includes(qNorm) ||
      (c.notasAdmin && c.notasAdmin.toLowerCase().includes(q))
    );
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
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const inactivityDaysAgo = new Date(Date.now() - diasInactividad * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const totalClientes = clients.length;
  const clientesNuevos = clients.filter(c => c.fechaAlta >= thirtyDaysAgo || (c.primerTurnoFecha && c.primerTurnoFecha >= thirtyDaysAgo)).length;
  const clientesRecurrentes = clients.filter(c => (c.totalTurnos || 0) >= 2).length;
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
      return res.rows.map(row => ({
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
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
      }));
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

  if (isPostgresConnected && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO appointments (
          id, cliente_id, profesional_id, profesional_nombre, codigo, nombre, apellido, telefono, email,
          servicio_id, servicio_nombre, duracion_minutos, precio,
          fecha, hora_inicio, hora_fin, observaciones, estado,
          notas_admin, browser_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
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
        apt.precio,
        apt.fecha,
        apt.horaInicio,
        apt.horaFin,
        apt.observaciones || null,
        apt.estado,
        apt.notasAdmin || null,
        apt.browserId || null
      ]);
      return apt;
    } catch (err) {
      console.error('Error saving appointment to PostgreSQL:', err);
    }
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
          updates.profesionalNombre || null
        ]);

        const updatedRes = await pgPool.query('SELECT * FROM appointments WHERE id = $1', [targetId]);
        const row = updatedRes.rows[0];
        if (row) {
          updatedApt = {
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
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
          };
        }
      }
    } catch (err) {
      console.error('Error updating appointment in PostgreSQL:', err);
    }
  }

  // Also update memoryDb
  const apt = memoryDb.appointments.find(a => a.id === cleanId || a.codigo === cleanId);
  if (apt) {
    if (updates.estado) apt.estado = updates.estado;
    if (updates.notasAdmin !== undefined) apt.notasAdmin = updates.notasAdmin;
    if (updates.fecha) apt.fecha = updates.fecha;
    if (updates.horaInicio) apt.horaInicio = updates.horaInicio;
    if (updates.horaFin) apt.horaFin = updates.horaFin;
    if (updates.clienteId) apt.clienteId = updates.clienteId;
    if (updates.profesionalId) apt.profesionalId = updates.profesionalId;
    if (updates.profesionalNombre) apt.profesionalNombre = updates.profesionalNombre;
    apt.updatedAt = new Date().toISOString();
    saveLocalFileDb();
    if (!updatedApt) {
      updatedApt = apt;
    }
  }

  return updatedApt;
}

export async function deleteAppointment(id: string): Promise<boolean> {
  const cleanId = (id || '').trim();
  let deletedFromPg = false;
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('DELETE FROM appointments WHERE id = $1 OR codigo = $1', [cleanId]);
      deletedFromPg = (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('Error deleting appointment from PostgreSQL:', err);
    }
  }

  let deletedFromMem = false;
  const idx = memoryDb.appointments.findIndex(a => a.id === cleanId || a.codigo === cleanId);
  if (idx !== -1) {
    memoryDb.appointments.splice(idx, 1);
    saveLocalFileDb();
    deletedFromMem = true;
  }

  return deletedFromPg || deletedFromMem;
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
  if (isPostgresConnected && pgPool) {
    try {
      const res = await pgPool.query('SELECT config FROM studio_config WHERE id = $1', ['default']);
      if (res.rows.length > 0) {
        const conf = typeof res.rows[0].config === 'string' ? JSON.parse(res.rows[0].config) : res.rows[0].config;
        return { ...defaultStudioConfig, ...conf };
      }
    } catch (err) {
      console.error('Error fetching config from PostgreSQL:', err);
    }
  }

  return memoryDb.config;
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

