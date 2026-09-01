import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import type { 
  Service, 
  Appointment, 
  DayAvailability, 
  TimeSlot, 
  DashboardStats,
  ScheduleScope,
  AvailabilityExceptionType,
  TimeInterval,
  WeekScheduleMap,
  ClientBenefit,
  BenefitTemplate,
  UpdateBenefitResult
} from "./src/types.js";
import {
  initDatabase,
  getServices,
  createService,
  updateService,
  deleteService,
  getAppointments,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  deleteAppointment,
  getStudioConfig,
  updateStudioConfig,
  isDatabasePostgres,
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getPotentialDuplicatePairs,
  mergeClients,
  dismissDuplicatePair,
  getClientStats,
  findOrCreateClientForBooking,
  getClientAlerts,
  createClientAlert,
  updateClientAlert,
  deleteClientAlert,
  getClientPreferences,
  saveClientPreferences,
  getClientTipsConfig,
  saveClientTipsConfig,
  getProfessionals,
  getProfessionalById,
  createProfessional,
  updateProfessional,
  deleteProfessional,
  getProfessionalServices,
  setProfessionalServices,
  getProfessionalsForService,
  setServiceProfessionals,
  isProfessionalHabilitated,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  authenticateUser,
  adminResetPassword,
  getSchedules,
  getScheduleForDate,
  saveSchedule,
  deleteSchedule,
  getAvailabilityExceptions,
  createAvailabilityException,
  deleteAvailabilityException,
  extendStudioScheduleForDate,
  applyAvailabilityExceptionWithCancellations,
  getNotificationLogs,
  getPromotions,
  getPromotionById,
  getPromotionByCode,
  createPromotion,
  updatePromotion,
  deletePromotion,
  getPromotionUsages,
  validatePromotion,
  getClientBenefits,
  getAvailableClientBenefits,
  getClientBenefitById,
  normalizeBenefitOrigin,
  createClientBenefit,
  updateClientBenefit,
  validateClientBenefit,
  grantCompensationBenefitForCancelledAppointment,
  getBenefitTemplates,
  getBenefitTemplateById,
  createBenefitTemplate,
  updateBenefitTemplate,
  toggleBenefitTemplateActive,
  createSession,
  revokeSessionByToken,
  verifyPassword,
  validatePasswordPolicy,
  revokeAllUserSessions,
  createAuditLog
} from "./src/server/db.js";
import { getBusinessDate, isoDateToAR } from "./src/utils/dateUtils.js";
import { notificationService } from "./src/server/notifications/notificationService.js";
import {
  calculateAvailability,
  validateBookingSlot,
  checkStudioCoverageForProfessionalException,
  checkStudioCoverageForProfessionalWeeklySchedule,
  checkConflictingAppointmentsForException,
  timeToMinutes,
  minutesToTime
} from "./src/server/availabilityEngine.js";
import cookieParser from "cookie-parser";
import {
  requireAuth,
  requireAdmin,
  requireAdminOrProfessional,
  enforceProfessionalScope,
  authRateLimiter,
  bookingRateLimiter,
  csrfProtection,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS
} from "./src/server/authMiddleware.js";

const app = express();
const PORT = 3000;

app.set('trust proxy', 1);

// Security and Parsers Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);

// Security Headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Helper: Format Date to YYYY-MM-DD in Argentina business timezone
function getTodayIso(): string {
  return getBusinessDate();
}

const dayKeys = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const;
const dayNamesEs = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// ============================================================================
// REST API ROUTES
// ============================================================================

// 0. GET /api/db-status
app.get("/api/db-status", (req, res) => {
  res.json({
    status: "ok",
    postgresConnected: isDatabasePostgres(),
    driver: isDatabasePostgres() ? "PostgreSQL (Neon / Supabase / Render)" : "Local Storage (Fallback)"
  });
});

// 1. GET /api/servicios
app.get("/api/servicios", async (req, res) => {
  try {
    const activeOnly = req.query.all !== "true";
    const services = await getServices(activeOnly);
    res.json(services);
  } catch (error) {
    console.error("Error in GET /api/servicios:", error);
    res.status(500).json({ error: "Error al obtener servicios" });
  }
});

// 2. POST /api/servicios (Admin)
app.post("/api/servicios", async (req, res) => {
  try {
    const { nombre, slug, categoria, descripcion, duracionMinutos, precio, esPopular, icono, detalles, activo } = req.body;
    if (!nombre || !duracionMinutos || !precio) {
      res.status(400).json({ error: "Nombre, duración y precio son campos requeridos." });
      return;
    }
    const newService: Service = {
      id: `srv-${Date.now()}`,
      nombre: String(nombre).trim(),
      slug: slug || String(nombre).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      categoria: categoria || "cuidado",
      descripcion: descripcion || "",
      duracionMinutos: Number(duracionMinutos),
      precio: Number(precio),
      esPopular: Boolean(esPopular),
      icono: icono || "💅",
      detalles: Array.isArray(detalles) ? detalles : [],
      activo: activo !== false
    };
    const created = await createService(newService);
    res.status(201).json(created);
  } catch (error) {
    console.error("Error in POST /api/servicios:", error);
    res.status(500).json({ error: "Error al crear servicio" });
  }
});

// 3. PUT /api/servicios/:id (Admin)
app.put("/api/servicios/:id", async (req, res) => {
  try {
    const updated = await updateService(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Servicio no encontrado" });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error("Error in PUT /api/servicios/:id:", error);
    res.status(500).json({ error: "Error al actualizar servicio" });
  }
});

// 4. DELETE /api/servicios/:id (Admin)
app.delete("/api/servicios/:id", async (req, res) => {
  try {
    const deleted = await deleteService(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Servicio no encontrado" });
      return;
    }
    res.json({ message: "Servicio eliminado con éxito" });
  } catch (error) {
    console.error("Error in DELETE /api/servicios/:id:", error);
    res.status(500).json({ error: "Error al eliminar servicio" });
  }
});

// 5. GET /api/availability?date=YYYY-MM-DD&service_id=X&profesional_id=Y
app.get("/api/availability", async (req, res) => {
  try {
    const dateStr = String(req.query.date || req.query.fecha || "");
    const serviceId = String(req.query.service_id || req.query.servicio_id || "");
    const profesionalId = req.query.profesional_id ? String(req.query.profesional_id) : (req.query.profesionalId ? String(req.query.profesionalId) : undefined);

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      res.status(400).json({ error: "Fecha inválida. Use formato YYYY-MM-DD." });
      return;
    }

    const availabilityResponse = await calculateAvailability({
      fecha: dateStr,
      servicioId: serviceId,
      profesionalId
    });

    res.json(availabilityResponse);
  } catch (error: any) {
    console.error("Error in GET /api/availability:", error);
    res.status(500).json({ error: error.message || "Error al calcular disponibilidad" });
  }
});

// Helper for strict No-Stacking discount validation
export function checkDiscountNoStacking(body: any): { hasConflict: boolean; hasPromotion: boolean; hasClientBenefit: boolean; error?: string } {
  if (!body || typeof body !== "object") {
    return { hasConflict: false, hasPromotion: false, hasClientBenefit: false };
  }

  const promoCodeRaw = body.descuentoCodigo ?? body.descuento_codigo ?? body.codigoPromocion ?? body.codigo_promocion ?? body.codigoPromo ?? body.codigo_promo ?? body.promoCode ?? body.codigo;
  const promoIdRaw = body.promocionId ?? body.promocion_id ?? body.promotionId ?? body.promotion_id;
  const benefitIdRaw = body.clientBenefitId ?? body.client_benefit_id ?? body.beneficioId ?? body.beneficio_id ?? body.benefitId ?? body.benefit_id;
  
  const cleanPromoCode = typeof promoCodeRaw === 'string' ? promoCodeRaw.trim() : '';
  const cleanPromoId = typeof promoIdRaw === 'string' ? promoIdRaw.trim() : '';
  const cleanBenefitId = typeof benefitIdRaw === 'string' ? benefitIdRaw.trim() : '';
  const cleanDiscountId = typeof body.descuentoId === 'string' ? body.descuentoId.trim() : (typeof body.descuento_id === 'string' ? body.descuento_id.trim() : '');
  const tipo = body.descuentoTipo ? String(body.descuentoTipo).trim().toLowerCase() : (body.descuento_tipo ? String(body.descuento_tipo).trim().toLowerCase() : '');

  const hasExplicitPromo = cleanPromoCode.length > 0 || cleanPromoId.length > 0 || tipo === 'promocion';
  const hasExplicitBenefit = cleanBenefitId.length > 0 || tipo === 'beneficio';

  const hasPromotion = cleanPromoCode.length > 0 || cleanPromoId.length > 0 || (tipo === 'promocion' && cleanDiscountId.length > 0);
  let hasClientBenefit = cleanBenefitId.length > 0 || (tipo === 'beneficio' && cleanDiscountId.length > 0);

  if (cleanDiscountId.length > 0 && !hasPromotion && !hasClientBenefit && tipo !== 'promocion') {
    hasClientBenefit = true;
  }

  if (hasExplicitPromo && hasExplicitBenefit) {
    return {
      hasConflict: true,
      hasPromotion: true,
      hasClientBenefit: true,
      error: "No se puede aplicar una promoción y un beneficio individual en la misma reserva."
    };
  }

  if (hasPromotion && hasClientBenefit) {
    return {
      hasConflict: true,
      hasPromotion: true,
      hasClientBenefit: true,
      error: "No se puede aplicar una promoción y un beneficio individual en la misma reserva."
    };
  }

  if (cleanPromoCode.length > 0 && (cleanBenefitId.length > 0 || (cleanDiscountId.length > 0 && tipo === 'beneficio'))) {
    return {
      hasConflict: true,
      hasPromotion: true,
      hasClientBenefit: true,
      error: "No se puede aplicar una promoción y un beneficio individual en la misma reserva."
    };
  }

  return { hasConflict: false, hasPromotion, hasClientBenefit };
}

// 6. POST /api/turnos & POST /api/appointments (Booking creation with server-side validation & engine checks)
app.post(["/api/turnos", "/api/appointments"], async (req, res) => {
  try {
    // Explicit No-Stacking validation: reject requests attempting to apply both promotion and client benefit
    const discountConflictCheck = checkDiscountNoStacking(req.body);
    if (discountConflictCheck.hasConflict) {
      res.status(400).json({
        error: discountConflictCheck.error || "No se puede aplicar una promoción y un beneficio individual en la misma reserva."
      });
      return;
    }

    const { 
      nombre, 
      apellido, 
      telefono, 
      email, 
      servicio_id, 
      servicioId,
      fecha, 
      hora_inicio, 
      horaInicio,
      profesional_id,
      profesionalId,
      observaciones, 
      browserId,
      descuentoTipo,
      descuentoId,
      descuentoCodigo,
      descuento_tipo,
      descuento_id,
      descuento_codigo
    } = req.body;

    const sId = String(servicio_id || servicioId || "");
    const targetFecha = String(fecha || "");
    const targetHoraInicio = String(hora_inicio || horaInicio || "");
    const targetProfId = profesional_id || profesionalId ? String(profesional_id || profesionalId) : undefined;

    if (!nombre || !apellido || !telefono || !sId || !targetFecha || !targetHoraInicio) {
      res.status(400).json({ error: "Todos los campos obligatorios (nombre, apellido, teléfono, servicio, fecha y hora) deben ser completados." });
      return;
    }

    // Atomic Backend Validation against availability engine, working intervals, exceptions, buffers and collisions
    const validation = await validateBookingSlot({
      fecha: targetFecha,
      horaInicio: targetHoraInicio,
      servicioId: sId,
      profesionalId: targetProfId
    });

    if (!validation.valid) {
      res.status(409).json({
        error: validation.error || "El turno seleccionado no se encuentra disponible. Por favor elegí otro horario."
      });
      return;
    }

    const services = await getServices(false);
    const service = services.find(s => s.id === sId) || { id: sId, nombre: "Servicio", duracionMinutos: validation.duracionMinutos, precio: validation.precio };
    const studioConfig = await getStudioConfig();

    // Identify or create client silently in backend
    const client = await findOrCreateClientForBooking({
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      telefono: String(telefono).trim(),
      email: email ? String(email).trim() : undefined,
      fecha: targetFecha,
      browserId: browserId ? String(browserId).trim() : undefined
    });

    const codeNumber = Math.floor(1000 + Math.random() * 9000);
    const bookingCode = `GWEN-${codeNumber}`;

    const rawPromoCode = descuentoCodigo ?? descuento_codigo ?? req.body.codigoPromocion ?? req.body.codigo_promocion ?? req.body.codigoPromo ?? req.body.promoCode ?? (discountConflictCheck.hasPromotion ? req.body.codigo : undefined);
    const resolvedDescuentoCodigo = typeof rawPromoCode === 'string' && rawPromoCode.trim().length > 0 ? rawPromoCode.trim() : undefined;
    const rawDiscountId = descuentoId ?? descuento_id ?? req.body.clientBenefitId ?? req.body.client_benefit_id ?? req.body.beneficioId ?? req.body.beneficio_id ?? req.body.promocionId ?? req.body.promocion_id ?? req.body.promotionId;
    const resolvedDescuentoId = typeof rawDiscountId === 'string' && rawDiscountId.trim().length > 0 ? rawDiscountId.trim() : undefined;
    const resolvedDescuentoTipo = descuentoTipo || descuento_tipo || (resolvedDescuentoCodigo ? 'promocion' : (resolvedDescuentoId ? 'beneficio' : undefined));

    const newAppointment: Appointment = {
      id: `apt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      clienteId: client.id,
      profesionalId: validation.profesionalId,
      profesionalNombre: validation.profesionalNombre,
      codigo: bookingCode,
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      telefono: String(telefono).trim(),
      email: email ? String(email).trim() : undefined,
      servicioId: service.id,
      servicioNombre: service.nombre,
      duracionMinutos: validation.duracionMinutos,
      precio: validation.precio,
      precioOriginal: validation.precio,
      precioFinal: validation.precio,
      descuentoTipo: resolvedDescuentoTipo || undefined,
      descuentoId: resolvedDescuentoId || undefined,
      descuentoCodigo: resolvedDescuentoCodigo || undefined,
      fecha: targetFecha,
      horaInicio: targetHoraInicio,
      horaFin: validation.horaFin,
      observaciones: observaciones ? String(observaciones).trim() : undefined,
      estado: "pendiente",
      browserId: browserId ? String(browserId).trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await createAppointment(newAppointment);

    const studioWhatsapp = studioConfig.whatsapp.replace(/[^0-9]/g, "");
    const finalAmount = saved.precioFinal != null ? saved.precioFinal : saved.precio;
    const discountLine = saved.descuentoMonto && saved.descuentoMonto > 0
      ? `🎟️ *Descuento aplicado:* -$${saved.descuentoMonto.toLocaleString("es-AR")} (${saved.descuentoNombre || saved.descuentoCodigo || "Beneficio"})\n`
      : "";

    const waMessage = encodeURIComponent(
      `✨ *¡Hola Gwen Nails!* Acabo de reservar mi turno:\n\n` +
      `📌 *Código:* ${bookingCode}\n` +
      `👤 *Nombre:* ${saved.nombre} ${saved.apellido}\n` +
      `💅 *Servicio:* ${saved.servicioNombre}\n` +
      (saved.profesionalNombre ? `👩‍🎨 *Profesional:* ${saved.profesionalNombre}\n` : "") +
      `📅 *Fecha:* ${isoDateToAR(saved.fecha)}\n` +
      `⏰ *Horario:* ${saved.horaInicio} hs (${saved.duracionMinutos} min)\n` +
      discountLine +
      `💰 *Total a abonar:* $${finalAmount.toLocaleString("es-AR")}\n` +
      (saved.observaciones ? `📝 *Detalles:* ${saved.observaciones}\n` : "") +
      `\n¡Muchas gracias!`
    );
    const whatsappUrl = `https://wa.me/${studioWhatsapp}?text=${waMessage}`;

    res.status(201).json({
      message: "Turno reservado exitosamente.",
      turno: saved,
      whatsappUrl
    });
  } catch (error: any) {
    console.error("Error in POST /api/turnos:", error);
    const msg = error?.message || "Error al procesar la reserva";
    const msgLow = msg.toLowerCase();
    const isConflict = error?.code === '23505' ||
                         msgLow.includes("ya ha sido reservado") ||
                         msgLow.includes("concurrente") ||
                         msgLow.includes("simultánea") ||
                         msgLow.includes("simultanea") ||
                         msgLow.includes("ocupado") ||
                         msgLow.includes("solapamiento") ||
                         msgLow.includes("duplicate key") ||
                         msgLow.includes("idx_appointments_unique_slot");
    const isValidation = msgLow.includes("no se puede aplicar") ||
                         msgLow.includes("requiere un monto") ||
                         msgLow.includes("código promocional") ||
                         msgLow.includes("codigo promocional") ||
                         msgLow.includes("promoción") ||
                         msgLow.includes("promocion") ||
                         msgLow.includes("beneficio") ||
                         msgLow.includes("límite") ||
                         msgLow.includes("limite") ||
                         msgLow.includes("alcanzado") ||
                         msgLow.includes("vencido") ||
                         msgLow.includes("vigente") ||
                         msgLow.includes("utilizado") ||
                         msgLow.includes("obligatorios");
    const status = isConflict ? 409 : (isValidation ? 400 : 500);
    const userMessage = error?.code === '23505'
      ? "El horario seleccionado ya ha sido reservado por otra solicitud simultánea. Por favor elegí otro horario."
      : msg;
    res.status(status).json({ error: userMessage });
  }
});

// 7. GET /api/turnos (Admin query & list)
app.get("/api/turnos", async (req, res) => {
  try {
    const { date, status, search, from, to } = req.query;
    const appointments = await getAppointments({
      date: date ? String(date) : undefined,
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined
    });
    res.json(appointments);
  } catch (error) {
    console.error("Error in GET /api/turnos:", error);
    res.status(500).json({ error: "Error al obtener turnos" });
  }
});

// 8. POST /api/turnos/:id/cancel (Centralized cancellation endpoint)
app.post("/api/turnos/:id/cancel", async (req, res) => {
  try {
    const { motivo, origen, canceladoPor } = req.body || {};
    const cancelled = await cancelAppointment({
      appointmentId: req.params.id,
      motivo: motivo || "Cancelado por administración",
      origen: origen || "admin",
      canceladoPor: canceladoPor || "Administración"
    });
    if (!cancelled) {
      res.status(404).json({ error: "Turno no encontrado." });
      return;
    }
    res.json(cancelled);
  } catch (error) {
    console.error("Error in POST /api/turnos/:id/cancel:", error);
    res.status(500).json({ error: "Error al cancelar turno" });
  }
});

// 8b. PATCH /api/turnos/:id (Admin status / notes update)
app.patch("/api/turnos/:id", async (req, res) => {
  try {
    if (req.body?.estado === 'cancelado') {
      const cancelled = await cancelAppointment({
        appointmentId: req.params.id,
        motivo: req.body.motivoCancelacion || req.body.motivo || "Cancelado por administración",
        origen: req.body.canceladoOrigen || req.body.origen || "admin",
        canceladoPor: req.body.canceladoPor || "Administración"
      });
      if (!cancelled) {
        res.status(404).json({ error: "Turno no encontrado." });
        return;
      }
      res.json(cancelled);
      return;
    }

    const updated = await updateAppointment(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Turno no encontrado." });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error("Error in PATCH /api/turnos/:id:", error);
    res.status(500).json({ error: "Error al actualizar turno" });
  }
});

// 9. DELETE /api/turnos/:id (Admin cancel / archive without physical deletion)
app.delete("/api/turnos/:id", async (req, res) => {
  try {
    const cancelled = await cancelAppointment({
      appointmentId: req.params.id,
      motivo: req.body?.motivo || "Cancelado y archivado por administración",
      origen: req.body?.origen || "admin",
      canceladoPor: req.body?.canceladoPor || "Administración"
    });
    if (!cancelled) {
      res.status(404).json({ error: "Turno no encontrado." });
      return;
    }
    res.json({ message: "Turno cancelado con éxito.", appointment: cancelled });
  } catch (error) {
    console.error("Error in DELETE /api/turnos/:id:", error);
    res.status(500).json({ error: "Error al cancelar turno" });
  }
});

// 10. GET /api/turnos/stats (Analytics dashboard)
app.get("/api/turnos/stats", async (req, res) => {
  try {
    const today = getTodayIso();
    const currentMonthPrefix = today.slice(0, 7);

    const allAppointments = await getAppointments();

    const todayList = allAppointments.filter(a => a.fecha === today && a.estado !== "cancelado");
    const pendingCount = allAppointments.filter(a => a.estado === "pendiente").length;
    
    const thisMonthList = allAppointments.filter(a => a.fecha.startsWith(currentMonthPrefix) && a.estado !== "cancelado");
    const completedThisMonth = thisMonthList.filter(a => a.estado === "completado").length;
    const estimatedRevenue = thisMonthList.reduce((acc, curr) => acc + (curr.precio || 0), 0);

    const serviceCounter: Record<string, { nombre: string; count: number; revenue: number }> = {};
    allAppointments.forEach(a => {
      if (a.estado === "cancelado") return;
      if (!serviceCounter[a.servicioId]) {
        serviceCounter[a.servicioId] = {
          nombre: a.servicioNombre,
          count: 0,
          revenue: 0
        };
      }
      serviceCounter[a.servicioId].count++;
      serviceCounter[a.servicioId].revenue += a.precio;
    });

    const topServices = Object.entries(serviceCounter)
      .map(([servicioId, item]) => ({
        servicioId,
        nombre: item.nombre,
        cantidad: item.count,
        ingresos: item.revenue
      }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const upcoming = allAppointments
      .filter(a => a.fecha >= today && a.estado !== "cancelado")
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio))
      .slice(0, 8);

    const stats: DashboardStats = {
      turnosHoy: todayList.length,
      turnosPendientes: pendingCount,
      turnosCompletadosMes: completedThisMonth,
      ingresosEstimadosMes: estimatedRevenue,
      totalTurnos: allAppointments.length,
      serviciosMasPedidos: topServices,
      proximosTurnos: upcoming
    };

    res.json(stats);
  } catch (error) {
    console.error("Error in GET /api/turnos/stats:", error);
    res.status(500).json({ error: "Error al calcular estadísticas" });
  }
});

// ============================================================================
// CLIENT MANAGEMENT API ROUTES
// ============================================================================

// A. GET /api/clientes (List with search, category filtering & statistics)
app.get("/api/clientes", async (req, res) => {
  try {
    const { search, category, activeOnly } = req.query;
    const clients = await getClients({
      search: search ? String(search) : undefined,
      category: (category as any) || "todos",
      activeOnly: activeOnly !== "false"
    });
    res.json(clients);
  } catch (error) {
    console.error("Error in GET /api/clientes:", error);
    res.status(500).json({ error: "Error al obtener lista de clientes" });
  }
});

// B. GET /api/clientes/stats (KPI metrics)
app.get("/api/clientes/stats", async (req, res) => {
  try {
    const stats = await getClientStats();
    res.json(stats);
  } catch (error) {
    console.error("Error in GET /api/clientes/stats:", error);
    res.status(500).json({ error: "Error al calcular estadísticas de clientes" });
  }
});

// C. GET /api/clientes/duplicados (Potential duplicate pairs list)
app.get("/api/clientes/duplicados", async (req, res) => {
  try {
    const duplicates = await getPotentialDuplicatePairs();
    res.json(duplicates);
  } catch (error) {
    console.error("Error in GET /api/clientes/duplicados:", error);
    res.status(500).json({ error: "Error al detectar clientes duplicados" });
  }
});

// D. POST /api/clientes/fusionar (Merge two client profiles)
app.post("/api/clientes/fusionar", async (req, res) => {
  try {
    const { primaryId, secondaryId, adminNotes } = req.body;
    if (!primaryId || !secondaryId) {
      res.status(400).json({ error: "Debe especificar primaryId y secondaryId para fusionar." });
      return;
    }
    const result = await mergeClients(primaryId, secondaryId, adminNotes);
    res.json({
      message: "Clientes fusionados exitosamente.",
      ...result
    });
  } catch (error: any) {
    console.error("Error in POST /api/clientes/fusionar:", error);
    res.status(500).json({ error: error.message || "Error al fusionar clientes" });
  }
});

// E. POST /api/clientes/descartar-duplicado (Dismiss duplicate alert)
app.post("/api/clientes/descartar-duplicado", async (req, res) => {
  try {
    const { idA, idB } = req.body;
    if (!idA || !idB) {
      res.status(400).json({ error: "Se requieren idA e idB para descartar alerta." });
      return;
    }
    await dismissDuplicatePair(idA, idB);
    res.json({ message: "Alerta de duplicado descartada con éxito." });
  } catch (error) {
    console.error("Error in POST /api/clientes/descartar-duplicado:", error);
    res.status(500).json({ error: "Error al descartar alerta" });
  }
});

// F. GET /api/clientes/:id (Single client with full appointment history)
app.get("/api/clientes/:id", async (req, res) => {
  try {
    const clientData = await getClientById(req.params.id);
    if (!clientData) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    res.json(clientData);
  } catch (error) {
    console.error("Error in GET /api/clientes/:id:", error);
    res.status(500).json({ error: "Error al obtener ficha de cliente" });
  }
});

// G. POST /api/clientes (Manual client creation by admin)
app.post("/api/clientes", async (req, res) => {
  try {
    const { nombre, apellido, telefono, email, notasAdmin } = req.body;
    if (!nombre || !apellido || !telefono) {
      res.status(400).json({ error: "Nombre, apellido y teléfono son obligatorios." });
      return;
    }
    const created = await createClient({
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      telefono: String(telefono).trim(),
      email: email ? String(email).trim() : undefined,
      notasAdmin: notasAdmin ? String(notasAdmin).trim() : undefined
    });
    res.status(201).json(created);
  } catch (error) {
    console.error("Error in POST /api/clientes:", error);
    res.status(500).json({ error: "Error al registrar cliente" });
  }
});

// H. PUT /api/clientes/:id (Update client details or notes)
app.put("/api/clientes/:id", async (req, res) => {
  try {
    const updated = await updateClient(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error("Error in PUT /api/clientes/:id:", error);
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

// I. DELETE /api/clientes/:id (Soft delete / deactivate)
app.delete("/api/clientes/:id", async (req, res) => {
  try {
    const deleted = await deleteClient(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    res.json({ message: "Cliente desactivado con éxito." });
  } catch (error) {
    console.error("Error in DELETE /api/clientes/:id:", error);
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});

// J. CLIENT ALERTS API ROUTES
// GET /api/clientes/:id/alertas
app.get("/api/clientes/:id/alertas", async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const alerts = await getClientAlerts(req.params.id, activeOnly === "true");
    res.json(alerts);
  } catch (error) {
    console.error("Error in GET /api/clientes/:id/alertas:", error);
    res.status(500).json({ error: "Error al obtener alertas del cliente" });
  }
});

// POST /api/clientes/:id/alertas
app.post("/api/clientes/:id/alertas", async (req, res) => {
  try {
    const { tipo, descripcion, productoServicioRelacionado, fecha, severidad, activa, observaciones } = req.body;
    if (!tipo || !descripcion) {
      res.status(400).json({ error: "El tipo y la descripción de la alerta son obligatorios." });
      return;
    }
    const created = await createClientAlert({
      clienteId: req.params.id,
      tipo,
      descripcion,
      productoServicioRelacionado,
      fecha,
      severidad,
      activa,
      observaciones
    });
    res.status(201).json(created);
  } catch (error) {
    console.error("Error in POST /api/clientes/:id/alertas:", error);
    res.status(500).json({ error: "Error al registrar alerta del cliente" });
  }
});

// PUT /api/clientes/:id/alertas/:alertId
app.put("/api/clientes/:id/alertas/:alertId", async (req, res) => {
  try {
    const updated = await updateClientAlert(req.params.alertId, req.body);
    if (!updated) {
      res.status(404).json({ error: "Alerta no encontrada" });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error("Error in PUT /api/clientes/:id/alertas/:alertId:", error);
    res.status(500).json({ error: "Error al actualizar alerta del cliente" });
  }
});

// DELETE /api/clientes/:id/alertas/:alertId
app.delete("/api/clientes/:id/alertas/:alertId", async (req, res) => {
  try {
    const deleted = await deleteClientAlert(req.params.alertId);
    if (!deleted) {
      res.status(404).json({ error: "Alerta no encontrada" });
      return;
    }
    res.json({ message: "Alerta eliminada correctamente." });
  } catch (error) {
    console.error("Error in DELETE /api/clientes/:id/alertas/:alertId:", error);
    res.status(500).json({ error: "Error al eliminar alerta" });
  }
});

// K. CLIENT PREFERENCES API ROUTES
// GET /api/clientes/:id/preferencias
app.get("/api/clientes/:id/preferencias", async (req, res) => {
  try {
    const prefs = await getClientPreferences(req.params.id);
    res.json(prefs || {});
  } catch (error) {
    console.error("Error in GET /api/clientes/:id/preferencias:", error);
    res.status(500).json({ error: "Error al obtener preferencias del cliente" });
  }
});

// PUT /api/clientes/:id/preferencias
app.put("/api/clientes/:id/preferencias", async (req, res) => {
  try {
    const saved = await saveClientPreferences(req.params.id, req.body);
    res.json(saved);
  } catch (error) {
    console.error("Error in PUT /api/clientes/:id/preferencias:", error);
    res.status(500).json({ error: "Error al guardar preferencias del cliente" });
  }
});

// L. CLIENT TIPS CONFIG API ROUTES
// GET /api/clientes/:id/tips
app.get("/api/clientes/:id/tips", async (req, res) => {
  try {
    const tips = await getClientTipsConfig(req.params.id);
    res.json(tips);
  } catch (error) {
    console.error("Error in GET /api/clientes/:id/tips:", error);
    res.status(500).json({ error: "Error al obtener configuración de tips" });
  }
});

// PUT /api/clientes/:id/tips
app.put("/api/clientes/:id/tips", async (req, res) => {
  try {
    const tipsList = Array.isArray(req.body) ? req.body : (req.body.tips || []);
    const saved = await saveClientTipsConfig(req.params.id, tipsList);
    res.json(saved);
  } catch (error) {
    console.error("Error in PUT /api/clientes/:id/tips:", error);
    res.status(500).json({ error: "Error al guardar configuración de tips" });
  }
});

// 11. GET /api/config & PUT /api/config
app.get("/api/config", async (req, res) => {
  try {
    const config = await getStudioConfig();
    const { pinAdmin: _, ...safeConfig } = config as any;
    res.json(safeConfig);
  } catch (error) {
    console.error("Error in GET /api/config:", error);
    res.status(500).json({ error: "Error al obtener configuración" });
  }
});

app.put("/api/config", requireAdmin, async (req, res) => {
  try {
    const updated = await updateStudioConfig(req.body);
    const { pinAdmin: _, ...safeConfig } = updated as any;
    res.json(safeConfig);
  } catch (error) {
    console.error("Error in PUT /api/config:", error);
    res.status(500).json({ error: "Error al actualizar configuración" });
  }
});


// 13. POST /api/admin/bloquear-horario (Blocks a time range or whole day with collision detection -> unified as AvailabilityException)
app.post("/api/admin/bloquear-horario", async (req, res) => {
  try {
    const { 
      fecha, 
      tipo = "rango_horario", 
      horaInicio, 
      horaFin, 
      motivo, 
      force = false,
      profesionalId
    } = req.body;

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      res.status(400).json({ error: "Fecha requerida con formato YYYY-MM-DD." });
      return;
    }

    const isFullDay = tipo === "dia_completo" || (!horaInicio && !horaFin);
    let startM = 0;
    let endM = 24 * 60;

    if (!isFullDay) {
      if (!horaInicio || !horaFin) {
        res.status(400).json({ error: "Debe especificar hora de inicio y hora de fin para el bloqueo por rango." });
        return;
      }
      startM = timeToMinutes(horaInicio);
      endM = timeToMinutes(horaFin);
      if (startM >= endM) {
        res.status(400).json({ error: "La hora de fin debe ser posterior a la hora de inicio." });
        return;
      }
    }

    // Check for collisions with active client appointments
    const dayAppointments = await getAppointments({ date: fecha });
    const nonCancelled = dayAppointments.filter(a => a.estado !== "cancelado");

    const conflictingAppointments = nonCancelled.filter(apt => {
      if (profesionalId && apt.profesionalId && apt.profesionalId !== profesionalId) {
        return false;
      }
      if (isFullDay) return true;
      const aptStart = timeToMinutes(apt.horaInicio);
      const aptEnd = timeToMinutes(apt.horaFin);
      return Math.max(startM, aptStart) < Math.min(endM, aptEnd);
    });

    if (conflictingAppointments.length > 0 && !force) {
      res.status(409).json({
        conflict: true,
        error: `Atención: Hay ${conflictingAppointments.length} turno(s) ya reservado(s) en este horario.`,
        conflicts: conflictingAppointments.map(apt => ({
          id: apt.id,
          codigo: apt.codigo,
          nombre: `${apt.nombre} ${apt.apellido}`,
          telefono: apt.telefono,
          servicioNombre: apt.servicioNombre,
          fecha: apt.fecha,
          horaInicio: apt.horaInicio,
          horaFin: apt.horaFin,
          precio: apt.precio
        }))
      });
      return;
    }

    const alcance = profesionalId ? 'profesional' : 'local';
    const created = await createAvailabilityException({
      alcance,
      profesionalId: profesionalId || undefined,
      fecha,
      tipo: isFullDay ? 'cerrado' : 'horario_especial',
      intervalos: isFullDay ? [] : [{ inicio: horaInicio, fin: horaFin }],
      motivo: motivo ? String(motivo).trim() : (isFullDay ? "Día cerrado" : "Horario bloqueado por el salón")
    });

    res.json({
      message: "Bloqueo registrado con éxito como excepción de disponibilidad.",
      exception: created[0],
      conflictsOverridden: conflictingAppointments.length
    });
  } catch (error) {
    console.error("Error in POST /api/admin/bloquear-horario:", error);
    res.status(500).json({ error: "Error al registrar bloqueo" });
  }
});

// 14. DELETE /api/admin/bloquear-horario/:id (Removes a specific block/exception)
app.delete("/api/admin/bloquear-horario/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await deleteAvailabilityException(id);
    if (!success) {
      res.status(404).json({ error: "Bloqueo o excepción no encontrada." });
      return;
    }
    res.json({ message: "Bloqueo eliminado con éxito." });
  } catch (error) {
    console.error("Error in DELETE /api/admin/bloquear-horario/:id:", error);
    res.status(500).json({ error: "Error al eliminar bloqueo" });
  }
});

// ============================================================================
// PROFESIONALES Y USUARIOS
// ============================================================================

// 15. GET /api/profesionales
app.get("/api/profesionales", async (req, res) => {
  try {
    const activeOnly = req.query.active_only === "true" || req.query.activo === "true";
    const professionals = await getProfessionals(activeOnly);
    res.json(professionals);
  } catch (error) {
    console.error("Error in GET /api/profesionales:", error);
    res.status(500).json({ error: "Error al obtener profesionales" });
  }
});

// 16. GET /api/profesionales/:id
app.get("/api/profesionales/:id", async (req, res) => {
  try {
    const professional = await getProfessionalById(req.params.id);
    if (!professional) {
      res.status(404).json({ error: "Profesional no encontrado" });
      return;
    }
    res.json(professional);
  } catch (error) {
    console.error("Error in GET /api/profesionales/:id:", error);
    res.status(500).json({ error: "Error al obtener profesional" });
  }
});

// 17. POST /api/profesionales
app.post("/api/profesionales", async (req, res) => {
  try {
    const { nombre, apellido, email, telefono, fotoUrl, colorAgenda, titulo, activo, serviciosIds } = req.body;
    if (!nombre || !apellido) {
      res.status(400).json({ error: "Nombre y apellido son obligatorios" });
      return;
    }
    const created = await createProfessional({
      nombre,
      apellido,
      email,
      telefono,
      fotoUrl,
      colorAgenda,
      titulo,
      activo: activo !== false,
      serviciosIds: Array.isArray(serviciosIds) ? serviciosIds : []
    });
    res.status(201).json(created);
  } catch (error) {
    console.error("Error in POST /api/profesionales:", error);
    res.status(500).json({ error: "Error al crear profesional" });
  }
});

// 18. PUT /api/profesionales/:id
app.put("/api/profesionales/:id", async (req, res) => {
  try {
    const updated = await updateProfessional(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Profesional no encontrado" });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error("Error in PUT /api/profesionales/:id:", error);
    res.status(500).json({ error: "Error al actualizar profesional" });
  }
});

// 19. DELETE /api/profesionales/:id
app.delete("/api/profesionales/:id", async (req, res) => {
  try {
    const allAppointments = await getAppointments();
    const hasHistoricalAppointments = allAppointments.some(
      a => a.profesionalId === req.params.id
    );

    if (hasHistoricalAppointments) {
      res.status(400).json({ 
        error: "No se puede eliminar este profesional porque posee turnos históricos asociados. Por favor utilizá la opción de desactivación para mantener los registros intactos." 
      });
      return;
    }

    const deleted = await deleteProfessional(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Profesional no encontrado" });
      return;
    }
    res.json({ message: "Profesional eliminado con éxito" });
  } catch (error) {
    console.error("Error in DELETE /api/profesionales/:id:", error);
    res.status(500).json({ error: "Error al eliminar profesional" });
  }
});

// 20. GET /api/profesionales/:id/servicios
app.get("/api/profesionales/:id/servicios", async (req, res) => {
  try {
    const services = await getProfessionalServices(req.params.id);
    res.json(services);
  } catch (error) {
    console.error("Error in GET /api/profesionales/:id/servicios:", error);
    res.status(500).json({ error: "Error al obtener servicios del profesional" });
  }
});

// 21. PUT /api/profesionales/:id/servicios
app.put("/api/profesionales/:id/servicios", async (req, res) => {
  try {
    const { serviciosIds } = req.body;
    if (!Array.isArray(serviciosIds)) {
      res.status(400).json({ error: "serviciosIds debe ser un array" });
      return;
    }
    await setProfessionalServices(req.params.id, serviciosIds);
    res.json({ message: "Servicios del profesional actualizados con éxito", serviciosIds });
  } catch (error) {
    console.error("Error in PUT /api/profesionales/:id/servicios:", error);
    res.status(500).json({ error: "Error al actualizar servicios del profesional" });
  }
});

// 21b. GET /api/servicios/:id/profesionales
app.get("/api/servicios/:id/profesionales", async (req, res) => {
  try {
    const profs = await getProfessionalsForService(req.params.id);
    res.json(profs);
  } catch (error) {
    console.error("Error in GET /api/servicios/:id/profesionales:", error);
    res.status(500).json({ error: "Error al obtener profesionales del servicio" });
  }
});

// 21c. PUT /api/servicios/:id/profesionales
app.put("/api/servicios/:id/profesionales", async (req, res) => {
  try {
    const { profesionalIds } = req.body;
    if (!Array.isArray(profesionalIds)) {
      res.status(400).json({ error: "profesionalIds debe ser un array" });
      return;
    }
    await setServiceProfessionals(req.params.id, profesionalIds);
    res.json({ message: "Profesionales del servicio actualizados con éxito", profesionalIds });
  } catch (error) {
    console.error("Error in PUT /api/servicios/:id/profesionales:", error);
    res.status(500).json({ error: "Error al actualizar profesionales del servicio" });
  }
});

// 22. POST /api/auth/login
app.post("/api/auth/login", authRateLimiter, async (req, res) => {
  try {
    const { username, email, identifier, password } = req.body;
    const loginId = identifier || username || email;
    if (!loginId || !password) {
      res.status(400).json({ error: "Usuario/email y contraseña requeridos" });
      return;
    }
    const authResult = await authenticateUser(loginId, password);
    if (!authResult.success || !authResult.user) {
      res.status(401).json({ error: authResult.error || "Credenciales inválidas" });
      return;
    }

    const { session, rawToken } = await createSession(authResult.user.id);
    res.cookie(SESSION_COOKIE_NAME, rawToken, SESSION_COOKIE_OPTIONS);

    res.json({
      message: "Autenticación exitosa",
      user: authResult.user,
      sessionId: session.id
    });
  } catch (error) {
    console.error("Error in POST /api/auth/login:", error);
    res.status(500).json({ error: "Error al autenticar usuario" });
  }
});

// 22b. GET /api/auth/me
app.get("/api/auth/me", requireAuth, async (req, res) => {
  res.json({ user: req.user, session: req.session });
});

// 22c. POST /api/auth/password-change
app.post("/api/auth/password-change", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Contraseña actual y nueva contraseña requeridas" });
      return;
    }
    const userId = req.user!.id;
    const userFull = await getUserById(userId);
    if (!userFull || !userFull.passwordHash || !userFull.salt) {
      res.status(401).json({ error: "Usuario no válido" });
      return;
    }
    const isValidCurrent = verifyPassword(currentPassword, userFull.salt, userFull.passwordHash);
    if (!isValidCurrent) {
      res.status(400).json({ error: "La contraseña actual es incorrecta" });
      return;
    }

    const policyCheck = validatePasswordPolicy(newPassword);
    if (!policyCheck.valid) {
      res.status(400).json({ error: policyCheck.error });
      return;
    }

    await updateUser(userId, {
      password: newPassword,
      mustChangePassword: false
    });

    await revokeAllUserSessions(userId);

    await createAuditLog({
      actorId: userId,
      actorName: req.user!.nombre || req.user!.username,
      targetUserId: userId,
      evento: 'password_changed',
      metadata: { userId }
    });

    res.json({ success: true, message: "Contraseña actualizada con éxito." });
  } catch (error: any) {
    console.error("Error in POST /api/auth/password-change:", error);
    res.status(400).json({ error: error.message || "Error al actualizar contraseña" });
  }
});

// 22c. POST /api/auth/logout
app.post("/api/auth/logout", async (req, res) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME] || 
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null);
    
    if (token) {
      await revokeSessionByToken(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ success: true, message: "Sesión cerrada correctamente" });
  } catch (error) {
    console.error("Error in POST /api/auth/logout:", error);
    res.status(500).json({ error: "Error al cerrar sesión" });
  }
});

// 23. GET /api/users (Admin)
app.get("/api/users", requireAdmin, async (req, res) => {
  try {
    const users = await getUsers(false);
    const sanitized = users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      rol: u.rol,
      profesionalId: u.profesionalId,
      nombre: u.nombre,
      activo: u.activo,
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));
    res.json(sanitized);
  } catch (error) {
    console.error("Error in GET /api/users:", error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// 24. POST /api/users (Admin)
app.post("/api/users", requireAdmin, async (req, res) => {
  try {
    const { username, email, password, rol, profesionalId, nombre, activo, mustChangePassword } = req.body;
    if ((!username && !email) || !password || !rol) {
      res.status(400).json({ error: "Username o email, password y rol son obligatorios" });
      return;
    }
    const created = await createUser({
      username,
      email,
      password,
      rol,
      profesionalId,
      nombre,
      activo: activo !== false,
      mustChangePassword: !!mustChangePassword
    });
    res.status(201).json({
      id: created.id,
      username: created.username,
      email: created.email,
      rol: created.rol,
      profesionalId: created.profesionalId,
      nombre: created.nombre,
      activo: created.activo,
      mustChangePassword: created.mustChangePassword
    });
  } catch (error: any) {
    console.error("Error in POST /api/users:", error);
    res.status(500).json({ error: error.message || "Error al crear usuario" });
  }
});

// 25. PUT /api/users/:id (Admin)
app.put("/api/users/:id", requireAdmin, async (req, res) => {
  try {
    const updated = await updateUser(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    res.json({
      id: updated.id,
      username: updated.username,
      email: updated.email,
      rol: updated.rol,
      profesionalId: updated.profesionalId,
      nombre: updated.nombre,
      activo: updated.activo,
      mustChangePassword: updated.mustChangePassword
    });
  } catch (error: any) {
    console.error("Error in PUT /api/users/:id:", error);
    res.status(400).json({ error: error.message || "Error al actualizar usuario" });
  }
});

// 25b. POST /api/users/:id/reset-password (Admin)
app.post("/api/users/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      res.status(400).json({ error: "Nueva contraseña requerida" });
      return;
    }
    const actorId = req.user?.id;
    const actorName = req.user?.nombre || req.user?.username || 'Administrador';
    const updated = await adminResetPassword(req.params.id, newPassword, actorId, actorName);
    if (!updated) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    res.json({ success: true, message: "Contraseña restablecida con éxito por administración" });
  } catch (error: any) {
    console.error("Error in POST /api/users/:id/reset-password:", error);
    res.status(400).json({ error: error.message || "Error al restablecer contraseña" });
  }
});

// 26. DELETE /api/users/:id (Admin)
app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteUser(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    res.json({ message: "Usuario eliminado con éxito" });
  } catch (error: any) {
    console.error("Error in DELETE /api/users/:id:", error);
    res.status(400).json({ error: error.message || "Error al eliminar usuario" });
  }
});

// ============================================================================
// HORARIOS Y VIGENCIAS (Schedules)
// ============================================================================

// 27. GET /api/horarios
app.get("/api/horarios", async (req, res) => {
  try {
    const alcance = req.query.alcance as ScheduleScope | undefined;
    const profesionalId = req.query.profesionalId ? String(req.query.profesionalId) : undefined;
    const schedules = await getSchedules({ alcance, profesionalId });
    res.json(schedules);
  } catch (error) {
    console.error("Error in GET /api/horarios:", error);
    res.status(500).json({ error: "Error al obtener cronogramas" });
  }
});

// 28. GET /api/horarios/vigente
app.get("/api/horarios/vigente", async (req, res) => {
  try {
    const alcance = (req.query.alcance as ScheduleScope) || 'local';
    const profesionalId = req.query.profesionalId ? String(req.query.profesionalId) : undefined;
    const fecha = req.query.fecha ? String(req.query.fecha) : getTodayIso();
    const schedule = await getScheduleForDate(alcance, profesionalId, fecha);
    res.json(schedule);
  } catch (error) {
    console.error("Error in GET /api/horarios/vigente:", error);
    res.status(500).json({ error: "Error al obtener horario vigente" });
  }
});

// 29. POST /api/horarios
app.post("/api/horarios", async (req, res) => {
  try {
    const { alcance, profesionalId, fechaVigencia, dias } = req.body;
    if (!alcance || !fechaVigencia || !dias) {
      res.status(400).json({ error: "alcance, fechaVigencia y dias son requeridos" });
      return;
    }
    const saved = await saveSchedule({
      alcance,
      profesionalId,
      fechaVigencia,
      dias
    });
    res.json(saved);
  } catch (error) {
    console.error("Error in POST /api/horarios:", error);
    res.status(500).json({ error: "Error al guardar horario" });
  }
});

// 29.1 POST /api/horarios/check-cobertura (Verifies studio coverage for professional weekly schedule)
app.post("/api/horarios/check-cobertura", async (req, res) => {
  try {
    const { fechaVigencia, dias, profesionalId } = req.body;
    if (!fechaVigencia || !dias) {
      res.status(400).json({ error: "fechaVigencia y dias son requeridos" });
      return;
    }
    const checkResult = await checkStudioCoverageForProfessionalWeeklySchedule(
      fechaVigencia,
      dias,
      profesionalId
    );
    res.json(checkResult);
  } catch (error) {
    console.error("Error in POST /api/horarios/check-cobertura:", error);
    res.status(500).json({ error: "Error al verificar cobertura de horarios del salón" });
  }
});

// 30. DELETE /api/horarios/:id
app.delete("/api/horarios/:id", async (req, res) => {
  try {
    const deleted = await deleteSchedule(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Horario no encontrado" });
      return;
    }
    res.json({ message: "Horario eliminado con éxito" });
  } catch (error) {
    console.error("Error in DELETE /api/horarios/:id:", error);
    res.status(500).json({ error: "Error al eliminar horario" });
  }
});

// ============================================================================
// EXCEPCIONES DE DISPONIBILIDAD ("Excepciones de disponibilidad")
// ============================================================================

// 31. GET /api/excepciones-disponibilidad
app.get("/api/excepciones-disponibilidad", async (req, res) => {
  try {
    const fecha = req.query.fecha ? String(req.query.fecha) : undefined;
    const alcance = req.query.alcance as ScheduleScope | undefined;
    const profesionalId = req.query.profesionalId ? String(req.query.profesionalId) : undefined;
    const exceptions = await getAvailabilityExceptions({ fecha, alcance, profesionalId });
    res.json(exceptions);
  } catch (error) {
    console.error("Error in GET /api/excepciones-disponibilidad:", error);
    res.status(500).json({ error: "Error al obtener excepciones de disponibilidad" });
  }
});

// 32. POST /api/excepciones-disponibilidad
app.post("/api/excepciones-disponibilidad", async (req, res) => {
  try {
    const {
      alcance,
      profesionalId,
      profesionalIds,
      fecha,
      tipo,
      intervalos,
      motivo,
      forceCancelConflicts,
      adjuntarBeneficio,
      benefitTemplateId,
      benefitAppointmentIds,
      operationId
    } = req.body;

    if (!alcance || !fecha || !tipo) {
      res.status(400).json({ error: "alcance, fecha y tipo son requeridos" });
      return;
    }

    const conflicts = await checkConflictingAppointmentsForException({
      alcance,
      profesionalId,
      profesionalIds,
      fecha,
      tipo,
      intervalos
    });

    if (conflicts.length > 0 && !forceCancelConflicts) {
      res.status(409).json({
        error: "Existen turnos afectados por esta excepción de disponibilidad.",
        conflicts
      });
      return;
    }

    const conflictAppointmentIds = (conflicts.length > 0 && forceCancelConflicts)
      ? conflicts.map(c => c.id)
      : [];

    const cancelMotivo = 'Cancelado por parte del salón, por excepción de horarios';
    const canceladoPor = 'Sistema / Excepción de horarios';

    // 1. First correctly apply operation in database & confirm transaction
    const result = await applyAvailabilityExceptionWithCancellations({
      alcance,
      profesionalId,
      profesionalIds,
      fecha,
      tipo,
      intervalos,
      motivo,
      conflictAppointmentIds,
      cancelMotivo,
      canceladoPor,
      adjuntarBeneficio,
      benefitTemplateId,
      benefitAppointmentIds,
      operationId
    });

    const { exceptions, cancelledAppointments, issuedBenefits, appointmentResults } = result;

    // 2. AFTER transaction is confirmed in DB, send notifications based on transactional analysis
    if (appointmentResults && appointmentResults.length > 0) {
      for (const resItem of appointmentResults) {
        const apt = resItem.appointment;
        if (resItem.shouldSendNotification && apt.email) {
          try {
            const idempotencyKey = operationId ? `exc-cancel-${apt.id}-${fecha}-${operationId}` : `exc-cancel-${apt.id}-${fecha}`;
            const issuedBenefit = resItem.benefit || (issuedBenefits || []).find(b => b.turnoOrigenId === apt.id);
            const beneficioSnapshot = issuedBenefit ? {
              id: issuedBenefit.id,
              titulo: issuedBenefit.titulo,
              descripcion: issuedBenefit.descripcion,
              tipoDescuento: issuedBenefit.tipoDescuento,
              valorDescuento: issuedBenefit.valorDescuento,
              fechaVencimiento: issuedBenefit.fechaVencimiento,
              serviciosAplicables: issuedBenefit.serviciosAplicables,
              montoMinimo: issuedBenefit.montoMinimo
            } : undefined;

            await notificationService.sendAppointmentCancellation(apt, {
              motivo: cancelMotivo,
              origen: 'excepcion_disponibilidad',
              canceladoPor,
              idempotencyKey,
              beneficio: beneficioSnapshot
            });
          } catch (notifErr) {
            console.error(`Error sending cancellation email for appointment ${apt.id}:`, notifErr);
          }
        }
      }
    } else if (cancelledAppointments && cancelledAppointments.length > 0) {
      for (const apt of cancelledAppointments) {
        if (apt.email) {
          try {
            const idempotencyKey = operationId ? `exc-cancel-${apt.id}-${fecha}-${operationId}` : `exc-cancel-${apt.id}-${fecha}`;
            const issuedBenefit = (issuedBenefits || []).find(b => b.turnoOrigenId === apt.id);
            const beneficioSnapshot = issuedBenefit ? {
              id: issuedBenefit.id,
              titulo: issuedBenefit.titulo,
              descripcion: issuedBenefit.descripcion,
              tipoDescuento: issuedBenefit.tipoDescuento,
              valorDescuento: issuedBenefit.valorDescuento,
              fechaVencimiento: issuedBenefit.fechaVencimiento,
              serviciosAplicables: issuedBenefit.serviciosAplicables,
              montoMinimo: issuedBenefit.montoMinimo
            } : undefined;

            await notificationService.sendAppointmentCancellation(apt, {
              motivo: cancelMotivo,
              origen: 'excepcion_disponibilidad',
              canceladoPor,
              idempotencyKey,
              beneficio: beneficioSnapshot
            });
          } catch (notifErr) {
            console.error(`Error sending cancellation email for appointment ${apt.id}:`, notifErr);
          }
        }
      }
    }

    res.status(201).json({
      exceptions,
      cancelledCount: cancelledAppointments.length,
      issuedBenefitsCount: (issuedBenefits || []).length,
      issuedBenefits: issuedBenefits || []
    });
  } catch (error: any) {
    console.error("Error in POST /api/excepciones-disponibilidad:", error);
    const msg = error?.message || "Error al crear excepción de disponibilidad";
    let statusCode = 400;
    if (msg.includes('no existe') || msg.includes('no fue encontrado')) {
      statusCode = 404;
    } else if (msg.includes('Existen turnos afectados')) {
      statusCode = 409;
    }
    res.status(statusCode).json({ error: msg });
  }
});

// 32b. GET /api/notifications/logs
app.get("/api/notifications/logs", async (req, res) => {
  try {
    const { appointmentId, channel, limit } = req.query;
    const logs = await getNotificationLogs({
      appointmentId: appointmentId ? String(appointmentId) : undefined,
      channel: channel ? String(channel) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 50
    });
    res.json(logs);
  } catch (error) {
    console.error("Error in GET /api/notifications/logs:", error);
    res.status(500).json({ error: "Error al obtener historial de notificaciones" });
  }
});

// 33. DELETE /api/excepciones-disponibilidad/:id
app.delete("/api/excepciones-disponibilidad/:id", async (req, res) => {
  try {
    const deleted = await deleteAvailabilityException(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Excepción no encontrada" });
      return;
    }
    res.json({ message: "Excepción eliminada con éxito" });
  } catch (error) {
    console.error("Error in DELETE /api/excepciones-disponibilidad/:id:", error);
    res.status(500).json({ error: "Error al eliminar excepción" });
  }
});

// 34. POST /api/excepciones-disponibilidad/check-conflictos
app.post("/api/excepciones-disponibilidad/check-conflictos", async (req, res) => {
  try {
    const { alcance, profesionalId, profesionalIds, fecha, tipo, intervalos } = req.body;
    if (!alcance || !fecha || !tipo) {
      res.status(400).json({ error: "alcance, fecha y tipo son requeridos" });
      return;
    }
    const conflicts = await checkConflictingAppointmentsForException({
      alcance,
      profesionalId,
      profesionalIds,
      fecha,
      tipo,
      intervalos
    });
    res.json({ conflicts, hasConflicts: conflicts.length > 0 });
  } catch (error) {
    console.error("Error in POST /api/excepciones-disponibilidad/check-conflictos:", error);
    res.status(500).json({ error: "Error al verificar conflictos de turnos" });
  }
});

// 34b. POST /api/excepciones-disponibilidad/check-cobertura
app.post("/api/excepciones-disponibilidad/check-cobertura", async (req, res) => {
  try {
    const { fecha, profesionalIntervalos } = req.body;
    if (!fecha || typeof fecha !== "string" || !Array.isArray(profesionalIntervalos)) {
      res.status(400).json({ error: "fecha (string) y profesionalIntervalos (array) son requeridos" });
      return;
    }
    const result = await checkStudioCoverageForProfessionalException(fecha, profesionalIntervalos);
    res.json(result);
  } catch (error) {
    console.error("Error in POST /api/excepciones-disponibilidad/check-cobertura:", error);
    res.status(500).json({ error: "Error al verificar cobertura de la excepción" });
  }
});

// 35. POST /api/excepciones-disponibilidad/auto-extender-local
app.post("/api/excepciones-disponibilidad/auto-extender-local", async (req, res) => {
  try {
    const { fecha, requiredIntervals, motivo } = req.body;
    if (!fecha || !Array.isArray(requiredIntervals)) {
      res.status(400).json({ error: "fecha e intervalos requeridos" });
      return;
    }
    const exception = await extendStudioScheduleForDate(fecha, requiredIntervals, motivo);
    res.json({ message: "Horario del salón extendido con éxito", exception });
  } catch (error) {
    console.error("Error in POST /api/excepciones-disponibilidad/auto-extender-local:", error);
    res.status(500).json({ error: "Error al extender horario del salón" });
  }
});

// ============================================================================
// PROMOTIONS & CLIENT BENEFITS REST API ROUTES
// ============================================================================

// 36. GET /api/promociones
app.get("/api/promociones", async (req, res) => {
  try {
    const includeInactive = req.query.all === "true";
    const promotions = await getPromotions(includeInactive);
    res.json(promotions);
  } catch (error) {
    console.error("Error in GET /api/promociones:", error);
    res.status(500).json({ error: "Error al obtener promociones" });
  }
});

// 37. GET /api/promociones/:id
app.get("/api/promociones/:id", async (req, res) => {
  try {
    const promo = await getPromotionById(req.params.id);
    if (!promo) {
      res.status(404).json({ error: "Promoción no encontrada" });
      return;
    }
    res.json(promo);
  } catch (error) {
    console.error("Error in GET /api/promociones/:id:", error);
    res.status(500).json({ error: "Error al obtener promoción" });
  }
});

// 38. POST /api/promociones
app.post("/api/promociones", async (req, res) => {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      activo,
      tipoDescuento,
      valorDescuento,
      fechaInicio,
      fechaVencimiento,
      limiteTotalUsos,
      limiteUsoPorCliente,
      periodoReutilizacionDias,
      serviciosAplicables,
      montoMinimo
    } = req.body;

    if (!codigo || !nombre || valorDescuento == null || !fechaInicio) {
      res.status(400).json({ error: "Código, nombre, valor de descuento y fecha de inicio son requeridos." });
      return;
    }

    const cleanCode = String(codigo).trim().toUpperCase();
    const existing = await getPromotionByCode(cleanCode);
    if (existing) {
      res.status(400).json({ error: `Ya existe una promoción con el código "${cleanCode}".` });
      return;
    }

    const created = await createPromotion({
      codigo: cleanCode,
      nombre: String(nombre).trim(),
      descripcion: descripcion ? String(descripcion).trim() : undefined,
      activo: activo !== false,
      tipoDescuento: tipoDescuento === "monto_fijo" ? "monto_fijo" : "porcentaje",
      valorDescuento: Number(valorDescuento),
      fechaInicio: String(fechaInicio),
      fechaVencimiento: fechaVencimiento ? String(fechaVencimiento) : null,
      limiteTotalUsos: limiteTotalUsos != null && limiteTotalUsos !== "" ? Number(limiteTotalUsos) : null,
      limiteUsoPorCliente: limiteUsoPorCliente != null && limiteUsoPorCliente !== "" ? Number(limiteUsoPorCliente) : null,
      periodoReutilizacionDias: periodoReutilizacionDias != null && periodoReutilizacionDias !== "" ? Number(periodoReutilizacionDias) : null,
      serviciosAplicables: Array.isArray(serviciosAplicables) && serviciosAplicables.length > 0 ? serviciosAplicables : ["todos"],
      montoMinimo: montoMinimo != null && montoMinimo !== "" ? Number(montoMinimo) : null
    });

    res.status(201).json(created);
  } catch (error: any) {
    console.error("Error in POST /api/promociones:", error);
    res.status(500).json({ error: error.message || "Error al crear promoción" });
  }
});

// 39. PUT /api/promociones/:id
app.put("/api/promociones/:id", async (req, res) => {
  try {
    const updated = await updatePromotion(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Promoción no encontrada" });
      return;
    }
    res.json(updated);
  } catch (error: any) {
    console.error("Error in PUT /api/promociones/:id:", error);
    res.status(500).json({ error: error.message || "Error al actualizar promoción" });
  }
});

// 40. DELETE /api/promociones/:id (Soft-delete / deactivate)
app.delete("/api/promociones/:id", async (req, res) => {
  try {
    const success = await deletePromotion(req.params.id);
    if (!success) {
      res.status(404).json({ error: "Promoción no encontrada" });
      return;
    }
    res.json({ message: "Promoción desactivada correctamente" });
  } catch (error) {
    console.error("Error in DELETE /api/promociones/:id:", error);
    res.status(500).json({ error: "Error al desactivar promoción" });
  }
});

// 41. POST /api/promociones/validar (Validation endpoint with clear error reporting)
app.post("/api/promociones/validar", async (req, res) => {
  try {
    const { codigo, servicioId, precio, clienteId, telefono, email, fecha } = req.body;
    if (!codigo) {
      res.status(400).json({ valido: false, error: "Por favor ingresá un código promocional." });
      return;
    }
    const result = await validatePromotion({
      codigo: String(codigo),
      servicioId: String(servicioId || ""),
      precio: Number(precio || 0),
      clienteId: clienteId ? String(clienteId) : undefined,
      telefono: telefono ? String(telefono) : undefined,
      email: email ? String(email) : undefined,
      fecha: fecha ? String(fecha) : undefined
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error in POST /api/promociones/validar:", error);
    res.status(500).json({ valido: false, error: error.message || "Error al validar código promocional" });
  }
});

// 42. GET /api/promociones-usos
app.get("/api/promociones-usos", async (req, res) => {
  try {
    const { promocionId, clienteId } = req.query;
    const usages = await getPromotionUsages(
      promocionId ? String(promocionId) : undefined,
      clienteId ? String(clienteId) : undefined
    );
    res.json(usages);
  } catch (error) {
    console.error("Error in GET /api/promociones-usos:", error);
    res.status(500).json({ error: "Error al obtener historial de usos de promociones" });
  }
});

// 43. GET /api/beneficios-cliente
app.get("/api/beneficios-cliente", async (req, res) => {
  try {
    const { clienteId, estado, search } = req.query;
    const benefits = await getClientBenefits({
      clienteId: clienteId ? String(clienteId) : undefined,
      estado: estado ? (String(estado) as any) : undefined,
      search: search ? String(search) : undefined
    });
    res.json(benefits);
  } catch (error) {
    console.error("Error in GET /api/beneficios-cliente:", error);
    res.status(500).json({ error: "Error al obtener beneficios de clientes" });
  }
});

// 44. GET /api/beneficios-cliente/disponibles (For identified client in booking flow)
app.get("/api/beneficios-cliente/disponibles", async (req, res) => {
  try {
    const { clienteId, telefono, email, servicioId, precio } = req.query;
    const available = await getAvailableClientBenefits({
      clienteId: clienteId ? String(clienteId) : undefined,
      telefono: telefono ? String(telefono) : undefined,
      email: email ? String(email) : undefined,
      servicioId: servicioId ? String(servicioId) : undefined,
      precio: precio ? Number(precio) : undefined
    });
    res.json(available);
  } catch (error) {
    console.error("Error in GET /api/beneficios-cliente/disponibles:", error);
    res.status(500).json({ error: "Error al consultar beneficios disponibles" });
  }
});

// 44b. GET /api/beneficios-cliente/:id
app.get("/api/beneficios-cliente/:id", async (req, res) => {
  try {
    const benefit = await getClientBenefitById(req.params.id);
    if (!benefit) {
      res.status(404).json({ error: "Beneficio no encontrado" });
      return;
    }
    res.json(benefit);
  } catch (error) {
    console.error("Error in GET /api/beneficios-cliente/:id:", error);
    res.status(500).json({ error: "Error al consultar beneficio" });
  }
});

// 45. POST /api/beneficios-cliente (Admin creates a benefit for client)
app.post("/api/beneficios-cliente", async (req, res) => {
  try {
    const {
      clienteId,
      clienteNombre,
      clienteTelefono,
      clienteEmail,
      titulo,
      descripcion,
      tipoDescuento,
      valorDescuento,
      origen,
      origenDetalle,
      fechaEmision,
      fechaVencimiento,
      turnoOrigenId,
      turnoOrigenCodigo,
      serviciosAplicables,
      montoMinimo,
      otorgadoPor
    } = req.body;

    if (!clienteId || !titulo || valorDescuento == null) {
      res.status(400).json({ error: "Cliente, título y valor del descuento son requeridos." });
      return;
    }

    const created = await createClientBenefit({
      clienteId: String(clienteId),
      clienteNombre: clienteNombre ? String(clienteNombre).trim() : undefined,
      clienteTelefono: clienteTelefono ? String(clienteTelefono).trim() : undefined,
      clienteEmail: clienteEmail ? String(clienteEmail).trim() : undefined,
      titulo: String(titulo).trim(),
      descripcion: descripcion ? String(descripcion).trim() : undefined,
      tipoDescuento: tipoDescuento === "monto_fijo" ? "monto_fijo" : "porcentaje",
      valorDescuento: Number(valorDescuento),
      origen: normalizeBenefitOrigin(origen),
      origenDetalle: origenDetalle ? String(origenDetalle).trim() : undefined,
      fechaEmision: fechaEmision ? String(fechaEmision) : getBusinessDate(),
      fechaVencimiento: fechaVencimiento ? String(fechaVencimiento) : null,
      turnoOrigenId: turnoOrigenId ? String(turnoOrigenId) : null,
      turnoOrigenCodigo: turnoOrigenCodigo ? String(turnoOrigenCodigo) : null,
      serviciosAplicables: Array.isArray(serviciosAplicables) && serviciosAplicables.length > 0 ? serviciosAplicables : ["todos"],
      montoMinimo: montoMinimo != null && montoMinimo !== "" ? Number(montoMinimo) : null,
      otorgadoPor: otorgadoPor ? String(otorgadoPor).trim() : "Administración"
    });

    res.status(201).json(created);
  } catch (error: any) {
    console.error("Error in POST /api/beneficios-cliente:", error);
    res.status(500).json({ error: error.message || "Error al crear beneficio" });
  }
});

// 46. PUT /api/beneficios-cliente/:id
app.put("/api/beneficios-cliente/:id", async (req, res) => {
  try {
    const benefitId = String(req.params.id || '').trim();
    if (!benefitId) {
      res.status(400).json({ error: "ID de beneficio requerido." });
      return;
    }

    // Construir whitelist explícita de campos administrativos permitidos
    const allowedUpdates: Partial<ClientBenefit> = {};

    if (req.body.titulo !== undefined) {
      const titleStr = String(req.body.titulo).trim();
      if (!titleStr) {
        res.status(400).json({ error: "El título no puede estar vacío." });
        return;
      }
      allowedUpdates.titulo = titleStr;
    }

    if (req.body.descripcion !== undefined) {
      allowedUpdates.descripcion = req.body.descripcion ? String(req.body.descripcion).trim() : undefined;
    }

    if (req.body.tipoDescuento !== undefined) {
      if (req.body.tipoDescuento !== "monto_fijo" && req.body.tipoDescuento !== "porcentaje") {
        res.status(400).json({ error: "Tipo de descuento inválido (debe ser 'porcentaje' o 'monto_fijo')." });
        return;
      }
      allowedUpdates.tipoDescuento = req.body.tipoDescuento;
    }

    if (req.body.valorDescuento !== undefined) {
      const val = Number(req.body.valorDescuento);
      if (isNaN(val) || !isFinite(val) || val <= 0) {
        res.status(400).json({ error: "El valor de descuento debe ser un número válido mayor a 0." });
        return;
      }
      if (req.body.tipoDescuento === "porcentaje" && val > 100) {
        res.status(400).json({ error: "El porcentaje no puede ser mayor al 100%." });
        return;
      }
      allowedUpdates.valorDescuento = val;
    }

    if (req.body.fechaVencimiento !== undefined) {
      if (req.body.fechaVencimiento) {
        const d = new Date(req.body.fechaVencimiento);
        if (isNaN(d.getTime())) {
          res.status(400).json({ error: "Fecha de vencimiento inválida." });
          return;
        }
        allowedUpdates.fechaVencimiento = String(req.body.fechaVencimiento);
      } else {
        allowedUpdates.fechaVencimiento = null;
      }
    }

    if (req.body.serviciosAplicables !== undefined) {
      allowedUpdates.serviciosAplicables = Array.isArray(req.body.serviciosAplicables) && req.body.serviciosAplicables.length > 0
        ? req.body.serviciosAplicables.map((s: any) => String(s).trim())
        : ["todos"];
    }

    if (req.body.montoMinimo !== undefined) {
      if (req.body.montoMinimo != null && req.body.montoMinimo !== "") {
        const mm = Number(req.body.montoMinimo);
        if (isNaN(mm) || !isFinite(mm) || mm < 0) {
          res.status(400).json({ error: "El monto mínimo debe ser un número positivo." });
          return;
        }
        allowedUpdates.montoMinimo = mm;
      } else {
        allowedUpdates.montoMinimo = null;
      }
    }

    if (req.body.otorgadoPor !== undefined) {
      allowedUpdates.otorgadoPor = req.body.otorgadoPor ? String(req.body.otorgadoPor).trim() : undefined;
    }

    // Transición de estado: únicamente se permite pasar de 'disponible' a 'cancelado'
    if (req.body.estado !== undefined) {
      if (req.body.estado === 'cancelado') {
        allowedUpdates.estado = 'cancelado';
      } else if (req.body.estado !== 'disponible') {
        res.status(409).json({
          error: `Transición de estado a '${req.body.estado}' no permitida administrativamente.`
        });
        return;
      }
    }

    // Ejecutar actualización atómica condicionada en backend
    const result: UpdateBenefitResult = await updateClientBenefit(benefitId, allowedUpdates);

    if (result.success === false) {
      const { reason } = result;
      if (reason === 'not_found') {
        res.status(404).json({ error: "Beneficio no encontrado." });
        return;
      }
      if (reason === 'already_used') {
        res.status(409).json({ error: "Un beneficio utilizado no puede ser editado, cancelado ni reactivado." });
        return;
      }
      if (reason === 'already_cancelled') {
        res.status(409).json({ error: "Un beneficio cancelado no puede ser editado ni reactivado." });
        return;
      }
      res.status(409).json({ error: "El beneficio ya no se encuentra disponible para ser modificado o cancelado." });
      return;
    }

    res.json(result.benefit);
  } catch (error: any) {
    console.error("Error in PUT /api/beneficios-cliente/:id:", error);
    res.status(500).json({ error: error.message || "Error al actualizar beneficio" });
  }
});

// 47. POST /api/beneficios-cliente/validar
app.post("/api/beneficios-cliente/validar", async (req, res) => {
  try {
    const { beneficioId, servicioId, precio, clienteId, telefono, email } = req.body;
    if (!beneficioId) {
      res.status(400).json({ valido: false, error: "ID de beneficio requerido." });
      return;
    }
    const result = await validateClientBenefit({
      beneficioId: String(beneficioId),
      servicioId: String(servicioId || ""),
      precio: Number(precio || 0),
      clienteId: clienteId ? String(clienteId) : undefined,
      telefono: telefono ? String(telefono) : undefined,
      email: email ? String(email) : undefined
    });
    res.json(result);
  } catch (error: any) {
    console.error("Error in POST /api/beneficios-cliente/validar:", error);
    res.status(500).json({ valido: false, error: error.message || "Error al validar beneficio" });
  }
});

// 48. POST /api/beneficios-cliente/otorgar-compensacion
app.post("/api/beneficios-cliente/otorgar-compensacion", async (req, res) => {
  try {
    const {
      appointmentId,
      tipoDescuento,
      valorDescuento,
      diasValidez,
      fechaVencimiento,
      titulo,
      descripcion,
      serviciosAplicables,
      montoMinimo,
      otorgadoPor
    } = req.body;

    if (!appointmentId || valorDescuento == null) {
      res.status(400).json({ error: "appointmentId y valorDescuento son obligatorios." });
      return;
    }

    const benefit = await grantCompensationBenefitForCancelledAppointment({
      appointmentId: String(appointmentId),
      tipoDescuento: tipoDescuento === "monto_fijo" ? "monto_fijo" : "porcentaje",
      valorDescuento: Number(valorDescuento),
      diasValidez: diasValidez != null && diasValidez !== "" ? Number(diasValidez) : null,
      fechaVencimiento: fechaVencimiento ? String(fechaVencimiento) : null,
      titulo: titulo ? String(titulo).trim() : undefined,
      descripcion: descripcion ? String(descripcion).trim() : undefined,
      serviciosAplicables: Array.isArray(serviciosAplicables) && serviciosAplicables.length > 0 ? serviciosAplicables : ["todos"],
      montoMinimo: montoMinimo != null && montoMinimo !== "" ? Number(montoMinimo) : null,
      otorgadoPor: otorgadoPor ? String(otorgadoPor).trim() : "Administración"
    });

    res.status(201).json(benefit);
  } catch (error: any) {
    console.error("Error in POST /api/beneficios-cliente/otorgar-compensacion:", error);
    res.status(500).json({ error: error.message || "Error al otorgar compensación" });
  }
});

// ============================================================================
// BENEFIT TEMPLATES REST API ROUTES (CATÁLOGO ADMINISTRATIVO REUTILIZABLE)
// ============================================================================

// 49. GET /api/benefit-templates (List all or active templates)
app.get("/api/benefit-templates", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { activo, all, search } = req.query;
    const activoFilter = all === "true" ? undefined : (activo !== undefined ? activo === "true" : undefined);
    const templates = await getBenefitTemplates({
      activo: activoFilter,
      search: search ? String(search) : undefined
    });
    res.json(templates);
  } catch (error) {
    console.error("Error in GET /api/benefit-templates:", error);
    res.status(500).json({ error: "Error al obtener plantillas de beneficios" });
  }
});

// 50. GET /api/benefit-templates/:id (Get template details)
app.get("/api/benefit-templates/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const template = await getBenefitTemplateById(req.params.id);
    if (!template) {
      res.status(404).json({ error: "Plantilla de beneficio no encontrada" });
      return;
    }
    res.json(template);
  } catch (error) {
    console.error("Error in GET /api/benefit-templates/:id:", error);
    res.status(500).json({ error: "Error al obtener plantilla de beneficio" });
  }
});

// 51. POST /api/benefit-templates (Create new benefit template)
app.post("/api/benefit-templates", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      nombrePublico,
      descripcionPublica,
      tipoDescuento,
      valorDescuento,
      vigenciaDias,
      serviciosAplicables,
      montoMinimo,
      activo
    } = req.body;

    // Validación y sanitización estricta
    if (!nombrePublico || typeof nombrePublico !== "string" || !nombrePublico.trim()) {
      res.status(400).json({ error: "El nombre público del beneficio es obligatorio." });
      return;
    }

    const cleanNombre = nombrePublico.replace(/<[^>]*>?/gm, '').trim();
    if (!cleanNombre) {
      res.status(400).json({ error: "El nombre público no puede contener caracteres inválidos." });
      return;
    }
    if (cleanNombre.length > 200) {
      res.status(400).json({ error: "El nombre público no puede exceder los 200 caracteres." });
      return;
    }

    let cleanDescripcion: string | undefined = undefined;
    if (descripcionPublica !== undefined && descripcionPublica !== null && String(descripcionPublica).trim() !== "") {
      cleanDescripcion = String(descripcionPublica).replace(/<[^>]*>?/gm, '').trim();
      if (cleanDescripcion.length > 500) {
        res.status(400).json({ error: "La descripción pública no puede exceder los 500 caracteres." });
        return;
      }
    }

    if (tipoDescuento !== "porcentaje" && tipoDescuento !== "monto_fijo") {
      res.status(400).json({ error: "El tipo de descuento debe ser 'porcentaje' o 'monto_fijo'." });
      return;
    }

    const numValor = Number(valorDescuento);
    if (isNaN(numValor) || !isFinite(numValor) || numValor <= 0) {
      res.status(400).json({ error: "El valor del descuento debe ser un número mayor a cero." });
      return;
    }

    if (tipoDescuento === "porcentaje" && numValor > 100) {
      res.status(400).json({ error: "El porcentaje de descuento no puede ser mayor al 100%." });
      return;
    }

    const numVigencia = Number(vigenciaDias);
    if (!Number.isInteger(numVigencia) || numVigencia <= 0 || numVigencia > 730) {
      res.status(400).json({ error: "La vigencia en días debe ser un número entero entre 1 y 730 días (2 años)." });
      return;
    }

    // Validar servicios aplicables
    let validatedServices: string[] = ["todos"];
    if (Array.isArray(serviciosAplicables) && serviciosAplicables.length > 0) {
      if (!serviciosAplicables.includes("todos")) {
        const allServices = await getServices(true);
        const validServiceIds = new Set(allServices.map(s => s.id));
        const cleanIds: string[] = [];
        for (const sId of serviciosAplicables) {
          const strId = String(sId).trim();
          if (!validServiceIds.has(strId)) {
            res.status(400).json({ error: `El servicio ID "${strId}" especificado no existe.` });
            return;
          }
          if (!cleanIds.includes(strId)) {
            cleanIds.push(strId);
          }
        }
        validatedServices = cleanIds.length > 0 ? cleanIds : ["todos"];
      }
    }

    let cleanMontoMinimo: number | null = null;
    if (montoMinimo != null && montoMinimo !== "") {
      const numMm = Number(montoMinimo);
      if (isNaN(numMm) || !isFinite(numMm) || numMm < 0) {
        res.status(400).json({ error: "El monto mínimo debe ser un número válido positivo o cero." });
        return;
      }
      cleanMontoMinimo = numMm > 0 ? numMm : null;
    }

    const created = await createBenefitTemplate({
      nombrePublico: cleanNombre,
      descripcionPublica: cleanDescripcion,
      tipoDescuento,
      valorDescuento: numValor,
      vigenciaDias: numVigencia,
      serviciosAplicables: validatedServices,
      montoMinimo: cleanMontoMinimo,
      activo: activo !== false
    });

    res.status(201).json(created);
  } catch (error: any) {
    console.error("Error in POST /api/benefit-templates:", error);
    res.status(500).json({ error: error.message || "Error al crear plantilla de beneficio" });
  }
});

// 52. PUT /api/benefit-templates/:id (Update benefit template)
app.put("/api/benefit-templates/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const templateId = String(req.params.id || "").trim();
    const existing = await getBenefitTemplateById(templateId);
    if (!existing) {
      res.status(404).json({ error: "Plantilla de beneficio no encontrada." });
      return;
    }

    const allowedUpdates: Partial<BenefitTemplate> = {};

    if (req.body.nombrePublico !== undefined) {
      const cleanNombre = String(req.body.nombrePublico).replace(/<[^>]*>?/gm, '').trim();
      if (!cleanNombre) {
        res.status(400).json({ error: "El nombre público no puede estar vacío." });
        return;
      }
      if (cleanNombre.length > 200) {
        res.status(400).json({ error: "El nombre público no puede exceder los 200 caracteres." });
        return;
      }
      allowedUpdates.nombrePublico = cleanNombre;
    }

    if (req.body.descripcionPublica !== undefined) {
      if (req.body.descripcionPublica != null && String(req.body.descripcionPublica).trim() !== "") {
        const cleanDesc = String(req.body.descripcionPublica).replace(/<[^>]*>?/gm, '').trim();
        if (cleanDesc.length > 500) {
          res.status(400).json({ error: "La descripción no puede exceder los 500 caracteres." });
          return;
        }
        allowedUpdates.descripcionPublica = cleanDesc;
      } else {
        allowedUpdates.descripcionPublica = undefined;
      }
    }

    const targetTipo = req.body.tipoDescuento !== undefined ? req.body.tipoDescuento : existing.tipoDescuento;
    if (req.body.tipoDescuento !== undefined) {
      if (req.body.tipoDescuento !== "porcentaje" && req.body.tipoDescuento !== "monto_fijo") {
        res.status(400).json({ error: "El tipo de descuento debe ser 'porcentaje' o 'monto_fijo'." });
        return;
      }
      allowedUpdates.tipoDescuento = req.body.tipoDescuento;
    }

    if (req.body.valorDescuento !== undefined) {
      const numVal = Number(req.body.valorDescuento);
      if (isNaN(numVal) || !isFinite(numVal) || numVal <= 0) {
        res.status(400).json({ error: "El valor del descuento debe ser un número mayor a 0." });
        return;
      }
      if (targetTipo === "porcentaje" && numVal > 100) {
        res.status(400).json({ error: "El porcentaje de descuento no puede ser mayor al 100%." });
        return;
      }
      allowedUpdates.valorDescuento = numVal;
    } else if (req.body.tipoDescuento === "porcentaje" && existing.valorDescuento > 100) {
      res.status(400).json({ error: "El valor de descuento actual excede el 100% para porcentaje." });
      return;
    }

    if (req.body.vigenciaDias !== undefined) {
      const numVig = Number(req.body.vigenciaDias);
      if (!Number.isInteger(numVig) || numVig <= 0 || numVig > 730) {
        res.status(400).json({ error: "La vigencia en días debe ser un número entero entre 1 y 730 días." });
        return;
      }
      allowedUpdates.vigenciaDias = numVig;
    }

    if (req.body.serviciosAplicables !== undefined) {
      if (Array.isArray(req.body.serviciosAplicables) && req.body.serviciosAplicables.length > 0 && !req.body.serviciosAplicables.includes("todos")) {
        const allServices = await getServices(true);
        const validServiceIds = new Set(allServices.map(s => s.id));
        const cleanIds: string[] = [];
        for (const sId of req.body.serviciosAplicables) {
          const strId = String(sId).trim();
          if (!validServiceIds.has(strId)) {
            res.status(400).json({ error: `El servicio ID "${strId}" especificado no existe.` });
            return;
          }
          if (!cleanIds.includes(strId)) {
            cleanIds.push(strId);
          }
        }
        allowedUpdates.serviciosAplicables = cleanIds.length > 0 ? cleanIds : ["todos"];
      } else {
        allowedUpdates.serviciosAplicables = ["todos"];
      }
    }

    if (req.body.montoMinimo !== undefined) {
      if (req.body.montoMinimo != null && req.body.montoMinimo !== "") {
        const numMm = Number(req.body.montoMinimo);
        if (isNaN(numMm) || !isFinite(numMm) || numMm < 0) {
          res.status(400).json({ error: "El monto mínimo debe ser un número positivo o cero." });
          return;
        }
        allowedUpdates.montoMinimo = numMm > 0 ? numMm : null;
      } else {
        allowedUpdates.montoMinimo = null;
      }
    }

    if (req.body.activo !== undefined) {
      allowedUpdates.activo = Boolean(req.body.activo);
    }

    const updated = await updateBenefitTemplate(templateId, allowedUpdates);
    res.json(updated);
  } catch (error: any) {
    console.error("Error in PUT /api/benefit-templates/:id:", error);
    res.status(500).json({ error: error.message || "Error al actualizar plantilla de beneficio" });
  }
});

// 53. PATCH /api/benefit-templates/:id/toggle (Toggle active status)
app.patch("/api/benefit-templates/:id/toggle", requireAuth, requireAdmin, async (req, res) => {
  try {
    const templateId = String(req.params.id || "").trim();
    const updated = await toggleBenefitTemplateActive(templateId);
    if (!updated) {
      res.status(404).json({ error: "Plantilla de beneficio no encontrada." });
      return;
    }
    res.json(updated);
  } catch (error: any) {
    console.error("Error in PATCH /api/benefit-templates/:id/toggle:", error);
    res.status(500).json({ error: error.message || "Error al cambiar estado de plantilla" });
  }
});


// ============================================================================
// VITE MIDDLEWARE SETUP FOR DEV & PROD
// ============================================================================
async function startServer() {
  // Initialize Database (PostgreSQL if DATABASE_URL provided, else local fallback)
  await initDatabase();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✨ Gwen Nails Server running on http://localhost:${PORT}`);
  });
}

startServer();
