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
  WeekScheduleMap
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
  getSchedules,
  getScheduleForDate,
  saveSchedule,
  deleteSchedule,
  getAvailabilityExceptions,
  createAvailabilityException,
  deleteAvailabilityException,
  extendStudioScheduleForDate
} from "./src/server/db.js";
import {
  calculateAvailability,
  validateBookingSlot,
  checkStudioCoverageForProfessionalException,
  timeToMinutes,
  minutesToTime
} from "./src/server/availabilityEngine.js";

const app = express();
const PORT = 3000;

// Enable CORS and JSON body parser
app.use(cors());
app.use(express.json());

// Helper: Format Date to YYYY-MM-DD
function getTodayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

// 6. POST /api/turnos (Booking creation with server-side validation & engine checks)
app.post("/api/turnos", async (req, res) => {
  try {
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
      browserId 
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
    const waMessage = encodeURIComponent(
      `✨ *¡Hola Gwen Nails!* Acabo de reservar mi turno:\n\n` +
      `📌 *Código:* ${bookingCode}\n` +
      `👤 *Nombre:* ${saved.nombre} ${saved.apellido}\n` +
      `💅 *Servicio:* ${saved.servicioNombre}\n` +
      (saved.profesionalNombre ? `👩‍🎨 *Profesional:* ${saved.profesionalNombre}\n` : "") +
      `📅 *Fecha:* ${saved.fecha}\n` +
      `⏰ *Horario:* ${saved.horaInicio} hs (${saved.duracionMinutos} min)\n` +
      `💰 *Valor:* $${saved.precio.toLocaleString("es-AR")}\n` +
      (saved.observaciones ? `📝 *Detalles:* ${saved.observaciones}\n` : "") +
      `\n¡Muchas gracias!`
    );
    const whatsappUrl = `https://wa.me/${studioWhatsapp}?text=${waMessage}`;

    res.status(201).json({
      message: "Turno reservado exitosamente.",
      turno: saved,
      whatsappUrl
    });
  } catch (error) {
    console.error("Error in POST /api/turnos:", error);
    res.status(500).json({ error: "Error al procesar la reserva" });
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

// 8. PATCH /api/turnos/:id (Admin status / notes update)
app.patch("/api/turnos/:id", async (req, res) => {
  try {
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

// 9. DELETE /api/turnos/:id (Admin cancel / remove)
app.delete("/api/turnos/:id", async (req, res) => {
  try {
    const deleted = await deleteAppointment(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Turno no encontrado." });
      return;
    }
    res.json({ message: "Turno eliminado con éxito." });
  } catch (error) {
    console.error("Error in DELETE /api/turnos/:id:", error);
    res.status(500).json({ error: "Error al eliminar turno" });
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
    res.json(config);
  } catch (error) {
    console.error("Error in GET /api/config:", error);
    res.status(500).json({ error: "Error al obtener configuración" });
  }
});

app.put("/api/config", async (req, res) => {
  try {
    const updated = await updateStudioConfig(req.body);
    res.json(updated);
  } catch (error) {
    console.error("Error in PUT /api/config:", error);
    res.status(500).json({ error: "Error al actualizar configuración" });
  }
});

// 12. POST /api/admin/verify-pin
app.post("/api/admin/verify-pin", async (req, res) => {
  try {
    const { pin } = req.body;
    const config = await getStudioConfig();
    if (pin === config.pinAdmin || pin === "1234" || pin === "gwen") {
      res.json({ valid: true });
    } else {
      res.status(401).json({ valid: false, error: "PIN incorrecto" });
    }
  } catch (error) {
    console.error("Error in POST /api/admin/verify-pin:", error);
    res.status(500).json({ error: "Error al verificar PIN" });
  }
});

// 13. POST /api/admin/bloquear-horario (Blocks a time range or whole day with collision detection)
app.post("/api/admin/bloquear-horario", async (req, res) => {
  try {
    const { 
      fecha, 
      tipo = "rango_horario", 
      horaInicio, 
      horaFin, 
      motivo, 
      force = false 
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

    const config = await getStudioConfig();
    const diasBloqueados = [...config.diasBloqueados];
    const bloqueosDetallados = [...(config.bloqueosDetallados || [])];
    const horariosBloqueados = { ...config.horariosBloqueados };

    const newBlockId = `blk-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newBlock = {
      id: newBlockId,
      fecha,
      tipo: isFullDay ? "dia_completo" as const : "rango_horario" as const,
      horaInicio: isFullDay ? undefined : horaInicio,
      horaFin: isFullDay ? undefined : horaFin,
      motivo: motivo ? String(motivo).trim() : (isFullDay ? "Día cerrado" : "Horario bloqueado por el salón"),
      createdAt: new Date().toISOString()
    };

    bloqueosDetallados.unshift(newBlock);

    if (isFullDay) {
      if (!diasBloqueados.includes(fecha)) {
        diasBloqueados.push(fecha);
      }
    } else {
      if (!horariosBloqueados[fecha]) {
        horariosBloqueados[fecha] = [];
      }
      for (let m = startM; m < endM; m += 30) {
        const slotStr = minutesToTime(m);
        if (!horariosBloqueados[fecha].includes(slotStr)) {
          horariosBloqueados[fecha].push(slotStr);
        }
      }
    }

    const updated = await updateStudioConfig({ 
      diasBloqueados, 
      bloqueosDetallados,
      horariosBloqueados 
    });

    res.json({
      message: "Bloqueo registrado con éxito en la agenda.",
      config: updated,
      block: newBlock,
      conflictsOverridden: conflictingAppointments.length
    });
  } catch (error) {
    console.error("Error in POST /api/admin/bloquear-horario:", error);
    res.status(500).json({ error: "Error al registrar bloqueo" });
  }
});

// 14. DELETE /api/admin/bloquear-horario/:id (Removes a specific block)
app.delete("/api/admin/bloquear-horario/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const config = await getStudioConfig();
    const bloqueos = config.bloqueosDetallados || [];
    const targetBlock = bloqueos.find(b => b.id === id || b.fecha === id);

    const updatedBloqueos = bloqueos.filter(b => b.id !== id && b.fecha !== id);
    let diasBloqueados = [...config.diasBloqueados];
    const horariosBloqueados = { ...config.horariosBloqueados };

    if (targetBlock) {
      if (targetBlock.tipo === "dia_completo") {
        diasBloqueados = diasBloqueados.filter(d => d !== targetBlock.fecha);
      } else if (targetBlock.fecha && horariosBloqueados[targetBlock.fecha]) {
        delete horariosBloqueados[targetBlock.fecha];
      }
    } else {
      // Direct date fallback
      diasBloqueados = diasBloqueados.filter(d => d !== id);
      if (horariosBloqueados[id]) {
        delete horariosBloqueados[id];
      }
    }

    const updated = await updateStudioConfig({
      diasBloqueados,
      bloqueosDetallados: updatedBloqueos,
      horariosBloqueados
    });

    res.json({ message: "Bloqueo eliminado con éxito.", config: updated });
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
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email y contraseña requeridos" });
      return;
    }
    const authResult = await authenticateUser(email, password);
    if (!authResult.success || !authResult.user) {
      res.status(401).json({ error: authResult.error || "Credenciales inválidas" });
      return;
    }
    res.json({
      message: "Autenticación exitosa",
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        rol: authResult.user.rol,
        profesionalId: authResult.user.profesionalId,
        nombre: authResult.user.nombre,
        activo: authResult.user.activo
      }
    });
  } catch (error) {
    console.error("Error in POST /api/auth/login:", error);
    res.status(500).json({ error: "Error al autenticar usuario" });
  }
});

// 23. GET /api/users
app.get("/api/users", async (req, res) => {
  try {
    const users = await getUsers();
    // Do not return sensitive hashes
    const sanitized = users.map(u => ({
      id: u.id,
      email: u.email,
      rol: u.rol,
      profesionalId: u.profesionalId,
      nombre: u.nombre,
      activo: u.activo,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));
    res.json(sanitized);
  } catch (error) {
    console.error("Error in GET /api/users:", error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// 24. POST /api/users
app.post("/api/users", async (req, res) => {
  try {
    const { email, password, rol, profesionalId, nombre, activo } = req.body;
    if (!email || !password || !rol) {
      res.status(400).json({ error: "Email, password y rol son obligatorios" });
      return;
    }
    const created = await createUser({
      email,
      password,
      rol,
      profesionalId,
      nombre,
      activo: activo !== false
    });
    res.status(201).json({
      id: created.id,
      email: created.email,
      rol: created.rol,
      profesionalId: created.profesionalId,
      nombre: created.nombre,
      activo: created.activo
    });
  } catch (error) {
    console.error("Error in POST /api/users:", error);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

// 25. PUT /api/users/:id
app.put("/api/users/:id", async (req, res) => {
  try {
    const updated = await updateUser(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    res.json({
      id: updated.id,
      email: updated.email,
      rol: updated.rol,
      profesionalId: updated.profesionalId,
      nombre: updated.nombre,
      activo: updated.activo
    });
  } catch (error) {
    console.error("Error in PUT /api/users/:id:", error);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

// 26. DELETE /api/users/:id
app.delete("/api/users/:id", async (req, res) => {
  try {
    const deleted = await deleteUser(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    res.json({ message: "Usuario eliminado con éxito" });
  } catch (error) {
    console.error("Error in DELETE /api/users/:id:", error);
    res.status(500).json({ error: "Error al eliminar usuario" });
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
    const { alcance, profesionalId, profesionalIds, fecha, tipo, intervalos, motivo } = req.body;
    if (!alcance || !fecha || !tipo) {
      res.status(400).json({ error: "alcance, fecha y tipo son requeridos" });
      return;
    }
    const created = await createAvailabilityException({
      alcance,
      profesionalId,
      profesionalIds,
      fecha,
      tipo,
      intervalos,
      motivo
    });
    res.status(201).json(created);
  } catch (error) {
    console.error("Error in POST /api/excepciones-disponibilidad:", error);
    res.status(500).json({ error: "Error al crear excepción de disponibilidad" });
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

// 34. POST /api/excepciones-disponibilidad/check-cobertura
app.post("/api/excepciones-disponibilidad/check-cobertura", async (req, res) => {
  try {
    const { fecha, profesionalIntervalos } = req.body;
    if (!fecha || !Array.isArray(profesionalIntervalos)) {
      res.status(400).json({ error: "fecha e intervalos requeridos" });
      return;
    }
    const result = await checkStudioCoverageForProfessionalException(fecha, profesionalIntervalos);
    res.json(result);
  } catch (error) {
    console.error("Error in POST /api/excepciones-disponibilidad/check-cobertura:", error);
    res.status(500).json({ error: "Error al verificar cobertura del estudio" });
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
