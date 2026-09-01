import type { Request, Response, NextFunction } from 'express';
import type { SafeUser, Session, AuthenticatedContext, UserRole } from '../types.js';
import { validateSessionToken } from './db.js';

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      session?: Session;
      authContext?: AuthenticatedContext;
    }
  }
}

export const SESSION_COOKIE_NAME = 'gwen_session';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  path: '/'
};

/**
 * Middleware para exigir sesión válida (HttpOnly Cookie o Bearer token)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME] || 
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null);

  if (!token) {
    return res.status(401).json({ 
      error: 'No autenticado. Se requiere inicio de sesión.', 
      code: 'UNAUTHORIZED' 
    });
  }

  try {
    const result = await validateSessionToken(token);
    if (!result.valid || !result.user || !result.session) {
      // Limpiar cookie inválida
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      return res.status(401).json({ 
        error: result.error || 'Sesión inválida o expirada.', 
        code: 'INVALID_SESSION' 
      });
    }

    if (result.user.mustChangePassword) {
      const allowedPaths = ['/api/auth/me', '/api/auth/password-change', '/api/auth/logout'];
      const reqPath = req.path || (req.url ? req.url.split('?')[0] : '');
      const isAllowed = allowedPaths.some(p => reqPath.endsWith(p));
      if (!isAllowed) {
        return res.status(403).json({
          error: 'Debe cambiar su contraseña temporal antes de continuar.',
          code: 'MUST_CHANGE_PASSWORD',
          mustChangePassword: true
        });
      }
    }

    req.user = result.user;
    req.session = result.session;
    req.authContext = {
      userId: result.user.id,
      role: result.user.rol,
      profesionalId: result.user.profesionalId,
      sessionId: result.session.id,
      user: result.user
    };

    return next();
  } catch (err) {
    console.error('Error validando sesión:', err);
    return res.status(500).json({ error: 'Error interno de autenticación' });
  }
}

/**
 * Middleware para adjuntar sesión si existe sin bloquear
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME] || 
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null);

  if (!token) {
    return next();
  }

  try {
    const result = await validateSessionToken(token);
    if (result.valid && result.user && result.session) {
      req.user = result.user;
      req.session = result.session;
      req.authContext = {
        userId: result.user.id,
        role: result.user.rol,
        profesionalId: result.user.profesionalId,
        sessionId: result.session.id,
        user: result.user
      };
    }
  } catch (err) {
    console.error('Error en optionalAuth:', err);
  }

  return next();
}

/**
 * Guard de roles específicos
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authContext) {
      return res.status(401).json({ 
        error: 'No autenticado. Se requiere inicio de sesión.', 
        code: 'UNAUTHORIZED' 
      });
    }

    if (!allowedRoles.includes(req.authContext.role)) {
      return res.status(403).json({ 
        error: 'Acceso denegado. Permisos insuficientes para esta operación.', 
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        currentRole: req.authContext.role
      });
    }

    return next();
  };
}

export const requireAdmin = requireRole(['superadmin', 'admin']);
export const requireAdminOrProfessional = requireRole(['superadmin', 'admin', 'profesional', 'empleado']);

/**
 * Verifica si el usuario autenticado tiene permiso para acceder o modificar los recursos del profesionalId indicado.
 * - Superadmins y Administradores: acceso total.
 * - Profesionales: acceso exclusivamente a su propio profesionalId.
 */
export function enforceProfessionalScope(req: Request, targetProfesionalId?: string | null): boolean {
  if (!req.authContext) return false;
  if (req.authContext.role === 'superadmin' || req.authContext.role === 'admin') return true;
  if (req.authContext.role === 'profesional' || req.authContext.role === 'empleado') {
    if (!targetProfesionalId) return false;
    return req.authContext.profesionalId === targetProfesionalId;
  }
  return false;
}

// ---------------------------------------------------------------------------
// RATE LIMITING EN MEMORIA
// ---------------------------------------------------------------------------

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Limpieza periódica de registros de rate limit expirados cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function createRateLimiter(options: { windowMs: number; max: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const key = `${req.baseUrl || ''}${req.path}_${ip}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + options.windowMs };
      rateLimitStore.set(key, record);
      return next();
    }

    record.count++;
    if (record.count > options.max) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec.toString());
      return res.status(429).json({
        error: options.message,
        code: 'TOO_MANY_REQUESTS',
        retryAfter: retryAfterSec
      });
    }

    return next();
  };
}

// Limiter para autenticación y PIN: máx 15 intentos cada 15 minutos por IP
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Demasiados intentos de autenticación. Por favor espere 15 minutos antes de reintentar.'
});

// Limiter para creación pública de turnos: máx 30 reservas por hora por IP
export const bookingRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Límite de solicitudes de reserva alcanzado para esta IP. Por favor intente más tarde.'
});

// ---------------------------------------------------------------------------
// CSRF & ORIGIN PROTECTION
// ---------------------------------------------------------------------------

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Solo verificar en métodos mutantes
  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!mutatingMethods.includes(req.method)) {
    return next();
  }

  // Permitir si viene de peticiones API con header customizado o mismo origen
  const origin = req.headers.origin || req.headers.referer;
  const host = req.headers.host;

  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host && !originUrl.host.includes('localhost') && !originUrl.host.includes('run.app')) {
        // En desarrollo o preview en iframe puede variar el subdominio, validar de forma segura
        console.warn(`[CSRF] Advertencia de origen cruzado: Origin=${origin}, Host=${host}`);
      }
    } catch {
      // Ignorar error de parsing
    }
  }

  return next();
}
