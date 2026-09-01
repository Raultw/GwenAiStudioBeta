import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  AlertTriangle,
  Heart,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  MessageCircle,
  History,
  Edit3,
  Save,
  DollarSign,
  ShieldAlert,
  Loader2,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { Appointment, AppointmentStatus, ClientWithFullProfile, ClientAlert, ClientPreferences, ClientTipConfigItem } from '../types';
import { 
  isoDateToAR, 
  formatDateLongAR, 
  formatDateTimeAR 
} from '../utils/dateUtils.js';

interface AppointmentDetailModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  allAppointments: Appointment[];
  onClose: () => void;
  onUpdateStatus: (id: string, newStatus: AppointmentStatus, cancelMeta?: { motivo?: string; origen?: string; canceladoPor?: string }) => Promise<void | any>;
  onDelete?: (appointment: Appointment) => Promise<void>;
  onSaveNotes?: (id: string, notes: string) => Promise<void>;
  onOpenClientFicha: (clientLookup: { id?: string; telefono?: string; nombre?: string; apellido?: string }) => void;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  isOpen,
  appointment,
  allAppointments,
  onClose,
  onUpdateStatus,
  onDelete,
  onSaveNotes,
  onOpenClientFicha
}) => {
  // Collapsible blocks state
  // 1. Alertas y antecedentes -> ABIERTO por defecto
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(true);
  // 2. Preferencias & estilo -> CERRADO por defecto
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  // 3. Tips & Softgel -> CERRADO por defecto
  const [isTipsOpen, setIsTipsOpen] = useState<boolean>(false);

  // Client full profile data (read-only)
  const [clientProfile, setClientProfile] = useState<ClientWithFullProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);

  // Editing internal admin notes for this appointment
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [adminNotesText, setAdminNotesText] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Cancellation reason state
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('Cancelación solicitada por la clienta');

  // In-modal confirmation dialog state (replaces iframe-blocked window.confirm)
  const [confirmAction, setConfirmAction] = useState<{
    status: AppointmentStatus;
    title: string;
    message: string;
    confirmBtnText: string;
    confirmBtnColor: string;
    requireReason?: boolean;
  } | null>(null);

  const formatClienteDesdeDate = (iso?: string) => {
    if (!iso) return '';
    return formatDateLongAR(iso);
  };

  const formatDateFriendly = (iso?: string) => {
    if (!iso) return '';
    return isoDateToAR(iso);
  };

  // Reset & load client data whenever the appointment changes
  useEffect(() => {
    if (!isOpen || !appointment) {
      setClientProfile(null);
      setIsEditingNotes(false);
      return;
    }

    setIsAlertsOpen(true);
    setIsPreferencesOpen(false);
    setIsTipsOpen(false);
    setAdminNotesText(appointment.notasAdmin || '');
    setIsEditingNotes(false);

    // Fetch full client details for read-only blocks
    const loadProfile = async () => {
      setIsLoadingProfile(true);
      try {
        if (appointment.clienteId) {
          const res = await fetch(`/api/clientes/${appointment.clienteId}`, { credentials: 'include' });
          if (res.ok) {
            const data: ClientWithFullProfile = await res.json();
            setClientProfile(data);
            return;
          }
        }

        // Fallback: lookup client by telephone or normalized digits
        const phoneParam = appointment.telefono ? encodeURIComponent(appointment.telefono) : '';
        const searchRes = await fetch(`/api/clientes?search=${phoneParam}`, { credentials: 'include' });
        if (searchRes.ok) {
          const clientsList = await searchRes.json();
          if (Array.isArray(clientsList) && clientsList.length > 0) {
            const firstClient = clientsList[0];
            const detailRes = await fetch(`/api/clientes/${firstClient.id}`, { credentials: 'include' });
            if (detailRes.ok) {
              const fullData: ClientWithFullProfile = await detailRes.json();
              setClientProfile(fullData);
              return;
            }
          }
        }
      } catch (err) {
        console.error('Error loading client profile in AppointmentDetailModal:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [isOpen, appointment]);

  // Brand selection for Tips & Softgel
  const [selectedTipBrand, setSelectedTipBrand] = useState<string>('');

  const availableTipBrands = useMemo(() => {
    if (!clientProfile?.tipsConfig || clientProfile.tipsConfig.length === 0) return [];
    const set = new Set<string>();
    clientProfile.tipsConfig.forEach(item => {
      const brand = (item.marcaModelo || '').trim();
      if (brand) {
        set.add(brand);
      } else {
        set.add('Estándar / Sin marca');
      }
    });
    return Array.from(set);
  }, [clientProfile?.tipsConfig]);

  useEffect(() => {
    if (availableTipBrands.length > 0) {
      if (!selectedTipBrand || !availableTipBrands.includes(selectedTipBrand)) {
        setSelectedTipBrand(availableTipBrands[0]);
      }
    } else {
      setSelectedTipBrand('');
    }
  }, [availableTipBrands, selectedTipBrand]);

  // Find chronologically previous COMPLETED appointment for this client
  const previousCompletedAppointment = useMemo(() => {
    if (!appointment) return null;

    const currentPhoneClean = (appointment.telefono || '').replace(/\D/g, '');
    const currentAptDateTime = `${appointment.fecha}T${appointment.horaInicio || '00:00'}`;

    // Filter appointments of the same client with completed status
    const clientCompletedApts = allAppointments.filter(apt => {
      if (apt.id === appointment.id) return false;

      const isCompleted = apt.estado === 'completado' || (apt.estado as string) === 'completed';
      if (!isCompleted) return false;

      const isSameClient =
        (appointment.clienteId && apt.clienteId && appointment.clienteId === apt.clienteId) ||
        (currentPhoneClean && (apt.telefono || '').replace(/\D/g, '') === currentPhoneClean);

      return isSameClient;
    });

    if (clientCompletedApts.length === 0) return null;

    // Filter appointments that occurred strictly before current appointment date/time
    const priorInTime = clientCompletedApts.filter(apt => {
      const aptDateTime = `${apt.fecha}T${apt.horaInicio || '00:00'}`;
      return aptDateTime < currentAptDateTime;
    });

    if (priorInTime.length > 0) {
      // Sort descending (most recent completed prior appointment first)
      priorInTime.sort((a, b) => {
        const dtA = `${a.fecha}T${a.horaInicio || '00:00'}`;
        const dtB = `${b.fecha}T${b.horaInicio || '00:00'}`;
        return dtB.localeCompare(dtA);
      });
      return priorInTime[0];
    }

    // Fallback: If no strictly earlier appointment, sort all completed ones descending
    clientCompletedApts.sort((a, b) => {
      const dtA = `${a.fecha}T${a.horaInicio || '00:00'}`;
      const dtB = `${b.fecha}T${b.horaInicio || '00:00'}`;
      return dtB.localeCompare(dtA);
    });

    return clientCompletedApts[0] || null;
  }, [appointment, allAppointments]);

  if (!isOpen || !appointment) return null;

  // Handle status update
  const handleStatusChange = async (newStatus: AppointmentStatus, cancelMeta?: { motivo?: string; origen?: string; canceladoPor?: string }) => {
    setActionLoading(true);
    try {
      await onUpdateStatus(appointment.id, newStatus, cancelMeta);
    } catch (err) {
      console.error('Error changing status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle saving notes
  const handleSaveAdminNotes = async () => {
    if (!onSaveNotes) return;
    setIsSavingNotes(true);
    try {
      await onSaveNotes(appointment.id, adminNotesText);
      setIsEditingNotes(false);
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Direct WhatsApp link
  const cleanPhone = (appointment.telefono || '').replace(/\D/g, '');
  const waUrl = `https://wa.me/${cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`}?text=${encodeURIComponent(
    `Hola ${appointment.nombre}, te contacto desde Gwen Nails respecto a tu turno del ${isoDateToAR(appointment.fecha)} a las ${appointment.horaInicio} hs.`
  )}`;

  // Status badge styling
  const statusConfig = {
    pendiente: {
      label: 'Pendiente',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
      dotClass: 'bg-amber-500'
    },
    completado: {
      label: 'Completado',
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-300',
      dotClass: 'bg-blue-600'
    },
    cancelado: {
      label: 'Cancelado',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 line-through opacity-80',
      dotClass: 'bg-rose-500'
    }
  }[appointment.estado] || {
    label: appointment.estado,
    badgeClass: 'bg-stone-50 text-stone-800 border-stone-300',
    dotClass: 'bg-stone-500'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#FAF7F2] w-full max-w-3xl rounded-3xl border border-[#E8DCD5] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-white px-6 py-4 border-b border-[#E8DCD5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#E8DCD5] flex items-center justify-center text-[#8E4455]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-[#241E1A]">
                  Detalle del Turno
                </h3>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusConfig.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-xs font-mono text-[#8C7A70]">
                Código: <span className="text-[#8E4455] font-semibold">{appointment.codigo}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  setConfirmAction({
                    status: 'eliminar' as any,
                    title: '¿Eliminar registro definitivamente?',
                    message: `¿Confirmás que deseás borrar definitivamente el turno ${appointment.codigo} de ${appointment.nombre} ${appointment.apellido}? Esta acción eliminará el registro de la base de datos de manera permanente e irreversible.`,
                    confirmBtnText: 'Sí, eliminar registro',
                    confirmBtnColor: 'bg-rose-600 hover:bg-rose-700'
                  });
                }}
                className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Eliminar este turno definitivamente"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-[#E8DCD5] text-[#5A4B43] flex items-center justify-center transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          
          {/* ================================================================= */}
          {/* SECCIÓN 1: TURNO ACTUAL */}
          {/* ================================================================= */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8DCD5] shadow-2xs space-y-4">
            
            {/* Header del Turno Actual: Cliente & Ficha */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F0E6DE]">
              <div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-[#8C7A70] block mb-0.5">
                  Clienta
                </span>
                <h4 className="font-serif text-xl font-bold text-[#241E1A] flex items-center gap-2">
                  <span>{appointment.nombre} {appointment.apellido}</span>
                </h4>

                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[#5A4B43]">
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-[#8C7A70]" />
                    {appointment.telefono}
                  </span>
                  {appointment.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-[#8C7A70]" />
                      {appointment.email}
                    </span>
                  )}
                  {clientProfile?.client.fechaAlta && (
                    <span className="flex items-center gap-1 font-medium text-[#8E4455] bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200" title="Fecha de alta del cliente">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Cliente desde {formatClienteDesdeDate(clientProfile.client.fechaAlta)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Botones de acción rápida: WhatsApp y Ver Ficha Completa */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  title="Contactar por WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => onOpenClientFicha({
                    id: appointment.clienteId,
                    telefono: appointment.telefono,
                    nombre: appointment.nombre,
                    apellido: appointment.apellido
                  })}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#8E4455] hover:bg-[#783645] shadow-xs transition-colors cursor-pointer"
                  title="Abrir ficha completa de la clienta"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver ficha completa</span>
                </button>
              </div>
            </div>

            {/* BLOQUE UNIFICADO: Servicio, Fecha, Hora, Monto y Anotaciones de la clienta */}
            <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E8DCD5] space-y-3">
              {/* Fila principal: Servicio, Duración, Fecha, Horario y Precio */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#E8DCD5]">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C7A70]">
                      Servicio:
                    </span>
                    <h5 className="font-serif text-base sm:text-lg font-bold text-[#241E1A] inline-flex items-center gap-1.5">
                      <span>💅 {appointment.servicioNombre}</span>
                    </h5>
                    <span className="text-xs font-medium text-[#7A6B62] bg-white px-2 py-0.5 rounded-md border border-[#E8DCD5]">
                      {appointment.duracionMinutos} min
                    </span>
                  </div>

                  {/* Fecha, Hora y Profesional del servicio juntos */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#8E4455] bg-rose-50/90 px-2.5 py-1 rounded-lg border border-rose-200/80">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{isoDateToAR(appointment.fecha)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#241E1A] bg-white px-2.5 py-1 rounded-lg border border-[#E8DCD5]">
                      <Clock className="w-3.5 h-3.5 text-[#8C7A70]" />
                      <span>{appointment.horaInicio} - {appointment.horaFin} hs</span>
                    </span>
                    {appointment.profesionalNombre && (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#5A4B43] bg-white px-2.5 py-1 rounded-lg border border-[#E8DCD5]">
                        <User className="w-3.5 h-3.5 text-[#8E4455]" />
                        <span>Atiende: {appointment.profesionalNombre}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Monto total con descuento si aplica */}
                <div className="bg-white px-3.5 py-2 rounded-xl border border-[#E8DCD5] shrink-0 self-start md:self-auto text-left md:text-right">
                  {appointment.descuentoMonto && appointment.descuentoMonto > 0 ? (
                    <div>
                      <span className="text-[10px] text-[#8C7A70] uppercase font-semibold block line-through">
                        ${(appointment.precioOriginal || appointment.precio).toLocaleString('es-AR')} ARS
                      </span>
                      <span className="text-[11px] text-emerald-700 font-semibold block">
                        🎟️ -${appointment.descuentoMonto.toLocaleString('es-AR')} ({appointment.descuentoNombre || appointment.descuentoCodigo || 'Descuento'})
                      </span>
                      <span className="font-serif font-bold text-base sm:text-lg text-[#8E4455] block">
                        ${(appointment.precioFinal != null ? appointment.precioFinal : appointment.precio).toLocaleString('es-AR')} ARS
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] text-[#8C7A70] uppercase font-semibold block">Monto total</span>
                      <span className="font-serif font-bold text-base sm:text-lg text-[#8E4455]">
                        ${appointment.precio.toLocaleString('es-AR')} ARS
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Anotaciones de la clienta sobre el servicio solicitado */}
              <div className="text-xs">
                <span className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1">
                  Anotaciones de la clienta sobre el servicio:
                </span>
                {appointment.observaciones && appointment.observaciones.trim().length > 0 ? (
                  <div className="text-xs text-[#241E1A] italic bg-white p-2.5 rounded-lg border border-[#E8DCD5]/80">
                    "{appointment.observaciones}"
                  </div>
                ) : (
                  <div className="text-xs text-[#7A6B62] italic bg-white/60 px-3 py-1.5 rounded-lg border border-[#E8DCD5]/60">
                    Sin observaciones adicionales informadas por la clienta al agendar este servicio.
                  </div>
                )}
              </div>
            </div>

              {/* Notas internas administrativas */}
            <div className="bg-[#FAF7F2] p-3.5 rounded-xl border border-[#E8DCD5]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#8E4455]" />
                  Notas internas exclusivas del estudio:
                </span>
                {!isEditingNotes && onSaveNotes && (
                  <button
                    type="button"
                    onClick={() => {
                      setAdminNotesText(appointment.notasAdmin || '');
                      setIsEditingNotes(true);
                    }}
                    className="text-xs text-[#8E4455] hover:underline font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{appointment.notasAdmin ? 'Modificar' : 'Agregar nota'}</span>
                  </button>
                )}
              </div>

              {isEditingNotes ? (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={adminNotesText}
                    onChange={(e) => setAdminNotesText(e.target.value)}
                    placeholder="Escribí notas privadas para este turno (ej. esmaltes utilizados, recomendaciones)..."
                    className="w-full text-xs p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes(false)}
                      disabled={isSavingNotes}
                      className="px-3 py-1.5 text-xs text-[#5A4B43] bg-white border border-[#D9C9BF] rounded-lg hover:bg-[#FAF7F2] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAdminNotes}
                      disabled={isSavingNotes}
                      className="px-3 py-1.5 text-xs text-white bg-[#8E4455] rounded-lg hover:bg-[#783645] flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      {isSavingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      <span>Guardar nota</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#5A4B43]">
                  {appointment.notasAdmin ? (
                    <span className="bg-white p-2.5 rounded-lg border border-[#E8DCD5] block text-[#241E1A]">
                      {appointment.notasAdmin}
                    </span>
                  ) : (
                    <span className="italic text-[#8C7A70]">Sin notas internas registradas.</span>
                  )}
                </p>
              )}
            </div>

            {/* Información de Cancelación (si el turno está cancelado) */}
            {appointment.estado === 'cancelado' && (
              <div className="bg-rose-50/90 rounded-xl p-4 border border-rose-200/90 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-900 font-semibold text-xs border-b border-rose-200/80 pb-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Registro de Cancelación del Turno</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-rose-900">
                  <div className="bg-white/80 p-2.5 rounded-lg border border-rose-100">
                    <span className="text-[#8C7A70] text-[10px] uppercase font-bold tracking-wider block mb-0.5">Motivo de Cancelación:</span>
                    <span className="font-semibold text-[#241E1A]">{appointment.motivoCancelacion || 'Cancelado por administración'}</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-lg border border-rose-100">
                    <span className="text-[#8C7A70] text-[10px] uppercase font-bold tracking-wider block mb-0.5">Fecha y Hora de Cancelación:</span>
                    <span className="font-medium text-[#241E1A]">
                      {appointment.canceladoEn ? formatDateTimeAR(appointment.canceladoEn) : 'No registrada'}
                    </span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-lg border border-rose-100">
                    <span className="text-[#8C7A70] text-[10px] uppercase font-bold tracking-wider block mb-0.5">Origen:</span>
                    <span className="font-medium text-[#241E1A]">
                      {appointment.canceladoOrigen === 'excepcion_disponibilidad'
                        ? 'Excepción de disponibilidad'
                        : appointment.canceladoOrigen === 'detalle_turno'
                        ? 'Detalle de turno'
                        : appointment.canceladoOrigen === 'agenda'
                        ? 'Agenda'
                        : appointment.canceladoOrigen || 'Administración'}
                    </span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-lg border border-rose-100">
                    <span className="text-[#8C7A70] text-[10px] uppercase font-bold tracking-wider block mb-0.5">Responsable:</span>
                    <span className="font-medium text-[#241E1A]">{appointment.canceladoPor || 'Administración'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECCIÓN 2: INFORMACIÓN DE LA CLIENTA (SOLO LECTURA - COLAPSABLES) */}
          {/* Ubicada ANTES de la información del turno anterior */}
          {/* ================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="font-serif text-base font-bold text-[#241E1A] flex items-center gap-2">
                <span>Información permanente de la clienta</span>
                <span className="text-[11px] font-sans font-normal text-[#8C7A70]">(Modo solo lectura)</span>
              </h4>
              <button
                type="button"
                onClick={() => onOpenClientFicha({
                  id: appointment.clienteId,
                  telefono: appointment.telefono,
                  nombre: appointment.nombre,
                  apellido: appointment.apellido
                })}
                className="text-xs text-[#8E4455] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Editar en ficha completa</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* BLOQUE 1: ⚠️ Alertas y antecedentes (Abierto por defecto) */}
            <div className="bg-white rounded-2xl border border-[#E8DCD5] shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAlertsOpen(prev => !prev)}
                className="w-full px-5 py-3.5 bg-rose-50/50 hover:bg-rose-50 flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 text-[#241E1A] font-semibold text-xs sm:text-sm">
                  <span className="text-base">⚠️</span>
                  <span>Alertas y antecedentes</span>
                  {clientProfile?.alerts && clientProfile.alerts.filter(a => a.activa).length > 0 && (
                    <span className="text-[11px] px-2 py-0.2 bg-rose-200 text-rose-900 rounded-full font-bold">
                      {clientProfile.alerts.filter(a => a.activa).length} activas
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[#8C7A70] text-xs">
                  <span>{isAlertsOpen ? 'Ocultar' : 'Ver'}</span>
                  {isAlertsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isAlertsOpen && (
                <div className="p-4 border-t border-[#F0E6DE] space-y-2.5 text-xs">
                  {isLoadingProfile ? (
                    <div className="flex items-center justify-center py-4 text-[#8C7A70] gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#8E4455]" />
                      <span>Cargando antecedentes...</span>
                    </div>
                  ) : clientProfile?.alerts && clientProfile.alerts.length > 0 ? (
                    <div className="space-y-2">
                      {clientProfile.alerts.map(alert => {
                        const sevClass = {
                          critica: 'bg-rose-100 text-rose-900 border-rose-300',
                          alta: 'bg-orange-100 text-orange-900 border-orange-300',
                          moderada: 'bg-amber-100 text-amber-900 border-amber-300',
                          leve: 'bg-stone-100 text-stone-900 border-stone-300'
                        }[alert.severidad] || 'bg-stone-100 text-stone-900';

                        return (
                          <div
                            key={alert.id}
                            className={`p-3 rounded-xl border ${alert.activa ? 'bg-white border-[#E8DCD5]' : 'bg-[#FAF7F2] opacity-60 border-[#E8DCD5]'}`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${sevClass}`}>
                                  {alert.severidad}
                                </span>
                                <span className="font-semibold text-[#241E1A] capitalize">
                                  {alert.tipo.replace('_', ' ')}
                                </span>
                                {!alert.activa && (
                                  <span className="text-[10px] text-[#8C7A70] italic">(Inactiva)</span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#8C7A70]">{isoDateToAR(alert.fecha)}</span>
                            </div>

                            <p className="text-xs text-[#241E1A] font-medium mt-1">
                              {alert.descripcion}
                            </p>

                            {alert.productoServicioRelacionado && (
                              <p className="text-[11px] text-[#5A4B43] mt-1">
                                <strong className="text-[#8C7A70]">Producto/Servicio:</strong> {alert.productoServicioRelacionado}
                              </p>
                            )}

                            {alert.observaciones && (
                              <p className="text-[11px] text-[#6E5D55] italic mt-1 bg-[#FAF7F2] p-1.5 rounded-md">
                                {alert.observaciones}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#7A6B62] italic py-1">
                      Sin alertas ni antecedentes registrados para esta clienta.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* BLOQUE 2: ♡ Preferencias & estilo (Cerrado por defecto) */}
            <div className="bg-white rounded-2xl border border-[#E8DCD5] shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setIsPreferencesOpen(prev => !prev)}
                className="w-full px-5 py-3.5 hover:bg-[#FAF7F2] flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 text-[#241E1A] font-semibold text-xs sm:text-sm">
                  <span className="text-base">♡</span>
                  <span>Preferencias & estilo</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#8C7A70] text-xs">
                  <span>{isPreferencesOpen ? 'Ocultar' : 'Ver'}</span>
                  {isPreferencesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isPreferencesOpen && (
                <div className="p-4 border-t border-[#F0E6DE] space-y-3 text-xs">
                  {isLoadingProfile ? (
                    <div className="flex items-center justify-center py-4 text-[#8C7A70] gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#8E4455]" />
                      <span>Cargando preferencias...</span>
                    </div>
                  ) : clientProfile?.preferences ? (
                    <div className="bg-[#FAF7F2] p-3.5 rounded-xl border border-[#E8DCD5]">
                      <ul className="divide-y divide-[#E8DCD5]/60 text-xs">
                        <li className="py-1.5 flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[#8C7A70] font-medium">• Forma habitual de uñas:</span>
                          <span className="font-semibold text-[#241E1A] text-right">
                            {clientProfile.preferences.formaUnas || 'No especificada'}
                          </span>
                        </li>

                        <li className="py-1.5 flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[#8C7A70] font-medium">• Largo habitual:</span>
                          <span className="font-semibold text-[#241E1A] text-right">
                            {clientProfile.preferences.largoHabitual || 'No especificado'}
                          </span>
                        </li>

                        <li className="py-1.5 flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[#8C7A70] font-medium">• Estilo preferido:</span>
                          <span className="font-semibold text-[#241E1A] text-right">
                            {clientProfile.preferences.estilo || 'No especificado'}
                          </span>
                        </li>

                        <li className="py-1.5 flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[#8C7A70] font-medium">• Colores preferidos:</span>
                          <div className="text-right">
                            {clientProfile.preferences.coloresPreferidos && clientProfile.preferences.coloresPreferidos.length > 0 ? (
                              <span className="font-medium text-[#241E1A]">
                                {clientProfile.preferences.coloresPreferidos.join(', ')}
                              </span>
                            ) : (
                              <span className="text-[#7A6B62] italic">Sin colores indicados</span>
                            )}
                          </div>
                        </li>

                        {clientProfile.preferences.productosPreferidos && (
                          <li className="py-1.5 flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-[#8C7A70] font-medium">• Productos preferidos:</span>
                            <span className="text-[#241E1A] text-right">
                              {clientProfile.preferences.productosPreferidos}
                            </span>
                          </li>
                        )}

                        {clientProfile.preferences.productosEvitar && (
                          <li className="py-1.5 flex flex-wrap items-baseline justify-between gap-2 bg-rose-50/70 -mx-1 px-1.5 rounded-md">
                            <span className="text-rose-700 font-semibold">• Productos a evitar:</span>
                            <span className="text-rose-800 font-bold text-right">
                              ⚠️ {clientProfile.preferences.productosEvitar}
                            </span>
                          </li>
                        )}

                        {clientProfile.preferences.observacionesGenerales && (
                          <li className="py-1.5 flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-[#8C7A70] font-medium">• Observaciones generales:</span>
                            <span className="text-[#5A4B43] italic text-right">
                              {clientProfile.preferences.observacionesGenerales}
                            </span>
                          </li>
                        )}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-[#7A6B62] italic py-1">
                      Sin preferencias de estilo registradas para esta clienta.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* BLOQUE 3: ✨ Tips & Softgel (Cerrado por defecto, con filtro de marca) */}
            <div className="bg-white rounded-2xl border border-[#E8DCD5] shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setIsTipsOpen(prev => !prev)}
                className="w-full px-5 py-3.5 hover:bg-[#FAF7F2] flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 text-[#241E1A] font-semibold text-xs sm:text-sm">
                  <span className="text-base">✨</span>
                  <span>Tips & Softgel</span>
                  {clientProfile?.tipsConfig && clientProfile.tipsConfig.length > 0 && (
                    <span className="text-[11px] px-2 py-0.2 bg-purple-100 text-purple-900 rounded-full font-bold">
                      {clientProfile.tipsConfig.length} medidas guardadas
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[#8C7A70] text-xs">
                  <span>{isTipsOpen ? 'Ocultar' : 'Ver'}</span>
                  {isTipsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isTipsOpen && (
                <div className="p-4 border-t border-[#F0E6DE] space-y-3.5 text-xs">
                  {isLoadingProfile ? (
                    <div className="flex items-center justify-center py-4 text-[#8C7A70] gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#8E4455]" />
                      <span>Cargando medidas de tips...</span>
                    </div>
                  ) : clientProfile?.tipsConfig && clientProfile.tipsConfig.length > 0 ? (
                    <div className="space-y-3.5">
                      {/* Selector / Lista de marcas de tips disponibles */}
                      {availableTipBrands.length > 1 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#FAF7F2] rounded-xl border border-[#E8DCD5]">
                          <label htmlFor="tip-brand-select" className="text-xs font-semibold text-[#5A4B43] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#8E4455]" />
                            <span>Seleccionar marca de Tips:</span>
                          </label>
                          <select
                            id="tip-brand-select"
                            value={selectedTipBrand}
                            onChange={(e) => setSelectedTipBrand(e.target.value)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-[#D9C9BF] text-[#8E4455] focus:outline-none focus:border-[#8E4455] cursor-pointer shadow-2xs"
                          >
                            {availableTipBrands.map(brand => (
                              <option key={brand} value={brand}>{brand}</option>
                            ))}
                          </select>
                        </div>
                      ) : availableTipBrands.length === 1 ? (
                        <div className="flex items-center justify-between p-2.5 bg-[#FAF7F2] rounded-xl border border-[#E8DCD5] text-xs">
                          <span className="text-[#8C7A70] font-medium flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#8E4455]" />
                            Marca configurada:
                          </span>
                          <span className="font-bold text-[#8E4455] bg-white px-2.5 py-0.5 rounded-md border border-rose-200">
                            {availableTipBrands[0]}
                          </span>
                        </div>
                      ) : null}

                      {/* Matrices de Manos (Izquierda y Derecha) para la marca seleccionada */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(['izquierda', 'derecha'] as const).map(hand => {
                          const handTips = clientProfile.tipsConfig.filter(t => {
                            const brand = (t.marcaModelo || '').trim() || 'Estándar / Sin marca';
                            return t.mano === hand && (!selectedTipBrand || brand === selectedTipBrand);
                          });

                          const fingerNames: Record<string, string> = {
                            pulgar: 'Pulgar',
                            indice: 'Índice',
                            medio: 'Mayor / Medio',
                            anular: 'Anular',
                            menique: 'Meñique'
                          };

                          return (
                            <div key={hand} className="bg-[#FAF7F2] p-3.5 rounded-xl border border-[#E8DCD5]">
                              <h5 className="font-semibold text-xs text-[#8E4455] capitalize mb-2.5 flex items-center justify-between pb-1.5 border-b border-[#E8DCD5]">
                                <span>Mano {hand}</span>
                                {selectedTipBrand && (
                                  <span className="text-[10px] font-normal text-[#8C7A70]">({selectedTipBrand})</span>
                                )}
                              </h5>
                              <div className="space-y-1.5">
                                {(['pulgar', 'indice', 'medio', 'anular', 'menique'] as const).map(finger => {
                                  const found = handTips.find(t => t.dedo === finger);
                                  return (
                                    <div key={finger} className="flex items-center justify-between text-xs py-1 border-b border-[#E8DCD5]/40 last:border-0">
                                      <span className="text-[#5A4B43]">{fingerNames[finger]}:</span>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-[#241E1A] bg-white px-2 py-0.5 rounded border border-[#E8DCD5]">
                                          {found?.tamanoTip ? `#${found.tamanoTip}` : '-'}
                                        </span>
                                        {found?.observaciones && (
                                          <span className="text-[10px] text-[#8C7A70] italic max-w-[120px] truncate" title={found.observaciones}>
                                            ({found.observaciones})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#7A6B62] italic py-1">
                      Sin medidas de tips registradas para esta clienta.
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* ================================================================= */}
          {/* SECCIÓN 3: TURNO ANTERIOR (Completado cronológicamente anterior) */}
          {/* Ubicada DESPUÉS de la información permanente de la clienta */}
          {/* ================================================================= */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8DCD5] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8E4455] flex items-center gap-2">
                <History className="w-4 h-4" />
                Turno anterior completado
              </span>
              {previousCompletedAppointment && (
                <span className="text-[11px] font-mono text-[#8C7A70]">
                  Cód: {previousCompletedAppointment.codigo}
                </span>
              )}
            </div>

            {previousCompletedAppointment ? (
              <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E8DCD5] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[#8C7A70] block mb-0.5">Fecha:</span>
                    <span className="font-medium text-[#241E1A] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#8E4455]" />
                      {isoDateToAR(previousCompletedAppointment.fecha)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8C7A70] block mb-0.5">Hora:</span>
                    <span className="font-medium text-[#241E1A] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#8C7A70]" />
                      {previousCompletedAppointment.horaInicio} hs
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8C7A70] block mb-0.5">Servicio realizado:</span>
                    <span className="font-semibold text-[#241E1A]">
                      💅 {previousCompletedAppointment.servicioNombre}
                    </span>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#E8DCD5] text-xs">
                  <span className="text-[#8C7A70] block mb-1 font-medium">
                    Anotaciones del cliente sobre el trabajo a realizar:
                  </span>
                  <div className="bg-white p-2.5 rounded-lg border border-[#E8DCD5]/80 text-[#241E1A]">
                    {previousCompletedAppointment.observaciones && previousCompletedAppointment.observaciones.trim().length > 0 ? (
                      <span className="italic">"{previousCompletedAppointment.observaciones}"</span>
                    ) : (
                      <span className="font-medium text-[#7A6B62]">No informó detalles</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E8DCD5] text-center text-xs text-[#7A6B62]">
                <p className="italic">No se registran turnos anteriores completados para esta clienta.</p>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer with Status Legend & Action Buttons (Replaces previous 'Cerrar' button) */}
        <div className="bg-white px-6 py-4 border-t border-[#E8DCD5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#7A6B62]">
            {appointment.estado === 'pendiente' && (
              <span className="text-amber-800 font-semibold flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                <span>⏳</span>
                <span>Este turno se encuentra pendiente de atención.</span>
              </span>
            )}
            {appointment.estado === 'completado' && (
              <span className="text-blue-800 font-semibold flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Turno completado y registrado en el historial de la clienta.</span>
              </span>
            )}
            {appointment.estado === 'cancelado' && (
              <span className="text-rose-800 font-semibold flex items-center gap-1.5 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Turno cancelado. El horario quedó liberado.</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {appointment.estado === 'pendiente' && (
              <>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    setCancelReasonInput('Cancelación solicitada por la clienta');
                    setConfirmAction({
                      status: 'cancelado',
                      title: '¿Cancelar este turno?',
                      message: `¿Confirmás que deseás cancelar el turno de ${appointment.nombre} ${appointment.apellido} (${appointment.codigo})? El horario quedará liberado en la agenda.`,
                      confirmBtnText: 'Sí, cancelar turno',
                      confirmBtnColor: 'bg-rose-600 hover:bg-rose-700',
                      requireReason: true
                    });
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Cancelar turno</span>
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleStatusChange('completado')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Completar turno</span>
                </button>
              </>
            )}

            {appointment.estado === 'completado' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  setConfirmAction({
                    status: 'pendiente',
                    title: '¿Volver turno a estado pendiente?',
                    message: `¿Confirmás que deseás volver el turno completado de ${appointment.nombre} ${appointment.apellido} (${appointment.codigo}) al estado PENDIENTE? El turno volverá a figurar como pendiente de atención en la agenda.`,
                    confirmBtnText: 'Sí, volver a pendiente',
                    confirmBtnColor: 'bg-[#8E4455] hover:bg-[#783645]'
                  });
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8E4455] bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Volver a pasar este turno a estado pendiente"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Volver a pasar a pendiente</span>
              </button>
            )}

            {appointment.estado === 'cancelado' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  setConfirmAction({
                    status: 'pendiente',
                    title: '¿Reactivar turno?',
                    message: `¿Confirmás que deseás reactivar el turno cancelado de ${appointment.nombre} ${appointment.apellido} (${appointment.codigo}) al estado PENDIENTE?`,
                    confirmBtnText: 'Sí, reactivar a pendiente',
                    confirmBtnColor: 'bg-[#8E4455] hover:bg-[#783645]'
                  });
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Reactivar este turno a estado pendiente"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Reactivar a pendiente</span>
              </button>
            )}
          </div>
        </div>

        {/* Confirmation Modal Overlay */}
        {confirmAction && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 rounded-3xl animate-fade-in">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-[#E8DCD5] shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${confirmAction.status === 'cancelado' || confirmAction.status === ('eliminar' as any) ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'} border flex items-center justify-center shrink-0`}>
                  {confirmAction.status === 'cancelado' || confirmAction.status === ('eliminar' as any) ? (
                    <XCircle className="w-5 h-5 text-rose-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <h4 className="font-serif text-base font-bold text-[#241E1A]">
                    {confirmAction.title}
                  </h4>
                </div>
              </div>
              
              <p className="text-xs text-[#5A4B43] leading-relaxed">
                {confirmAction.message}
              </p>

              {/* Motivo de cancelación si es cancelación */}
              {confirmAction.requireReason && (
                <div className="space-y-2 pt-1 border-t border-[#F0E6DE]">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Motivo de cancelación:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Cancelación solicitada por la clienta',
                      'Imprevisto en el salón',
                      'Reorganización de agenda',
                      'Cancelado por parte del salón, por excepción de horarios'
                    ].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCancelReasonInput(preset)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border text-left ${
                          cancelReasonInput === preset
                            ? 'bg-[#8E4455] text-white border-[#8E4455]'
                            : 'bg-[#FAF7F2] text-[#5A4B43] border-[#E8DCD5] hover:bg-[#E8DCD5]'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    value={cancelReasonInput}
                    onChange={(e) => setCancelReasonInput(e.target.value)}
                    placeholder="Escribí el motivo de cancelación..."
                    className="w-full p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455] resize-none mt-1"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0E6DE]">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setConfirmAction(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#7A6B62] hover:text-[#241E1A] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={async () => {
                    const nextSt = confirmAction.status;
                    const reason = cancelReasonInput.trim() || 'Cancelado por administración';
                    setConfirmAction(null);
                    if (nextSt === ('eliminar' as any)) {
                      if (onDelete) {
                        setActionLoading(true);
                        try {
                          await onDelete(appointment);
                          onClose();
                        } catch (err) {
                          console.error('Error deleting appointment:', err);
                        } finally {
                          setActionLoading(false);
                        }
                      }
                    } else if (nextSt === 'cancelado') {
                      await handleStatusChange('cancelado', {
                        motivo: reason,
                        origen: 'detalle_turno',
                        canceladoPor: 'Administración'
                      });
                    } else {
                      await handleStatusChange(nextSt);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${confirmAction.confirmBtnColor}`}
                >
                  {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{confirmAction.confirmBtnText}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
