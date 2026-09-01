import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Lock, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  AlertTriangle,
  MessageCircle, 
  Phone, 
  Search, 
  Plus, 
  DollarSign, 
  TrendingUp, 
  Settings, 
  Ban, 
  Trash2, 
  Edit3, 
  Check, 
  CheckCircle2,
  User, 
  FileText,
  Sparkles,
  RefreshCw,
  Users,
  Mail,
  RotateCcw,
  CalendarCheck,
  Loader2,
  Tag,
  Gift
} from 'lucide-react';
import type { 
  Appointment, 
  Service, 
  StudioConfig, 
  DashboardStats, 
  AppointmentStatus,
  TimeSlot,
  DayAvailability,
  Client,
  Professional
} from '../types.js';
import { ClientManagementAdmin } from './ClientManagementAdmin.js';
import { AppointmentDetailModal } from './AppointmentDetailModal.js';
import { ScheduleManagementAdmin } from './ScheduleManagementAdmin.js';
import { AvailabilityExceptionsAdmin } from './AvailabilityExceptionsAdmin.js';
import { ProfessionalManagementAdmin } from './ProfessionalManagementAdmin.js';
import { PromotionsManagementAdmin } from './PromotionsManagementAdmin.js';
import { ClientBenefitsAdmin } from './ClientBenefitsAdmin.js';
import { BenefitTemplatesAdmin } from './BenefitTemplatesAdmin.js';
import { 
  getBusinessDate, 
  isoDateToAR, 
  formatDateTimeAR 
} from '../utils/dateUtils.js';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshPublicData: () => void;
}

// Presets of icon motifs for services
const SERVICE_ICON_PRESETS = [
  { icon: '💅', label: 'Esmalte Clásico', desc: 'Manicura & Color' },
  { icon: '✨', label: 'Brillos & Glow', desc: 'Semipermanente / Destellos' },
  { icon: '🌸', label: 'Flor & Soft Gel', desc: 'Delicadeza y Tips Gel' },
  { icon: '💎', label: 'Diamante / Lujo', desc: 'Kapping & Refuerzo' },
  { icon: '🎨', label: 'Nail Art / Pincel', desc: 'Diseño a Mano Alzada' },
  { icon: '👑', label: 'Corona / Royal', desc: 'Esculpidas & Polygel' },
  { icon: '🪄', label: 'Efectos Mágicos', desc: 'Técnicas Especiales' },
  { icon: '🌿', label: 'Spa & Botánico', desc: 'Nutrición & Cuidado' },
  { icon: '🪞', label: 'Chrome & Espejo', desc: 'Glazed & Efecto Espejo' },
  { icon: '🦋', label: 'Mariposa / 3D', desc: 'Tendencia & Dijes' },
  { icon: '🌹', label: 'Rosa / Romance', desc: 'Elegancia y Acabado' },
  { icon: '💫', label: 'Destello / Shimmer', desc: 'Microbrillo & Aura' },
  { icon: '💖', label: 'Corazón / Pasión', desc: 'Rosa & Glamour' },
  { icon: '🤍', label: 'Blanco & Nude', desc: 'Minimal & Milky White' }
];

// Presets of common service features for fast 1-click addition
const SERVICE_FEATURE_PRESETS = [
  'Mano alzada personalizada',
  'Tendencias: Chrome, Glazed Donut, Aura, French 3D',
  'Aplicación de foil, microbrillos y cristalería',
  'Asesoramiento estético personalizado',
  'Limpieza combinada profunda y repujado de cutículas',
  'Nivelación y refuerzo estructural con gel constructor',
  'Esmaltado en gel con acabado ultrabrillo o mate',
  'Nutrición intensiva con aceites esenciales y crema botánica',
  'Duración prolongada de hasta 3 semanas sin saltarse',
  'Tips de soft gel completos sin limado agresivo',
  'Efecto cat eye magnético y destellos multicapa'
];

const getTodayDateString = () => {
  return getBusinessDate();
};

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  onRefreshPublicData
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState<'agenda' | 'clientes' | 'profesionales' | 'horarios' | 'excepciones' | 'nuevo' | 'servicios' | 'promociones' | 'plantillas-beneficios' | 'beneficios' | 'stats'>('agenda');
  const [clientLookupForFicha, setClientLookupForFicha] = useState<{ id?: string; telefono?: string; nombre?: string; apellido?: string } | null>(null);
  const [selectedAppointmentForDetail, setSelectedAppointmentForDetail] = useState<Appointment | null>(null);
  const [selectedProfForSchedule, setSelectedProfForSchedule] = useState<string | null>(null);

  const handleOpenClientFicha = (apt: Appointment) => {
    setClientLookupForFicha({
      id: apt.clienteId,
      telefono: apt.telefono,
      nombre: apt.nombre,
      apellido: apt.apellido
    });
    setActiveTab('clientes');
  };

  const handleOpenClientFichaFromDetail = (lookup: { id?: string; telefono?: string; nombre?: string; apellido?: string }) => {
    setSelectedAppointmentForDetail(null);
    setClientLookupForFicha(lookup);
    setActiveTab('clientes');
  };

  // Data states
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dbStatus, setDbStatus] = useState<{ postgresConnected: boolean; driver: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Filters for Agenda (default to current date and 'pendiente' status)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('pendiente');
  const [dateFilter, setDateFilter] = useState<string>(getTodayDateString());
  const [professionalFilter, setProfessionalFilter] = useState<string>('all');

  // Notes editing state
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');

  // Manual appointment form state
  const [manualForm, setManualForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    servicioId: '',
    profesionalId: '',
    fecha: getTodayDateString(),
    horaInicio: '',
    observaciones: '',
    notasAdmin: ''
  });
  const [selectedManualClient, setSelectedManualClient] = useState<Client | null>(null);
  const [manualAvailability, setManualAvailability] = useState<DayAvailability | null>(null);
  const [isLoadingManualAvailability, setIsLoadingManualAvailability] = useState<boolean>(false);
  const [manualAvailabilityError, setManualAvailabilityError] = useState<string | null>(null);
  const [customTimeInput, setCustomTimeInput] = useState<boolean>(false);
  const [clientSearchTerm, setClientSearchTerm] = useState<string>('');
  const [clientsSearchResults, setClientsSearchResults] = useState<Client[]>([]);
  const [isSearchingClients, setIsSearchingClients] = useState<boolean>(false);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);

  // In-UI Action confirmation states (replaces iframe-blocked window.confirm)
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [cancelModalReason, setCancelModalReason] = useState<string>('Cancelación solicitada por la clienta');
  const [isCancellingApt, setIsCancellingApt] = useState<boolean>(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [appointmentToRevert, setAppointmentToRevert] = useState<{
    apt: Appointment;
    id: string;
    nombre: string;
    apellido: string;
    codigo: string;
    newStatus: AppointmentStatus;
    isReactivating?: boolean;
  } | null>(null);
  const [adminToast, setAdminToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const showAdminToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAdminToast({ message, type });
    setTimeout(() => setAdminToast(null), 4000);
  };

  // Service edit/create state
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isCreatingService, setIsCreatingService] = useState<boolean>(false);
  const [serviceToDelete, setServiceToDelete] = useState<{ id: string; nombre: string } | null>(null);
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState<string | null>(null);
  const [customFeatureInput, setCustomFeatureInput] = useState<string>('');
  const [serviceProfScope, setServiceProfScope] = useState<'todos' | 'especificos'>('todos');
  const [serviceSelectedProfIds, setServiceSelectedProfIds] = useState<string[]>([]);
  const serviceFormRef = useRef<HTMLDivElement | null>(null);
  const [serviceForm, setServiceForm] = useState<{
    nombre: string;
    categoria: 'esculpidas' | 'esmaltado' | 'cuidado' | 'arte';
    descripcion: string;
    duracionMinutos: number;
    precio: number;
    esPopular: boolean;
    icono: string;
    detalles: string[];
    activo: boolean;
  }>({
    nombre: '',
    categoria: 'cuidado',
    descripcion: '',
    duracionMinutos: 60,
    precio: 20000,
    esPopular: false,
    icono: '💅',
    detalles: [],
    activo: true
  });

  const scrollToServiceForm = () => {
    setTimeout(() => {
      if (serviceFormRef.current) {
        serviceFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleOpenCreateService = () => {
    setIsCreatingService(true);
    setEditingService(null);
    setCustomFeatureInput('');
    setServiceForm({
      nombre: '',
      categoria: 'cuidado',
      descripcion: '',
      duracionMinutos: 60,
      precio: 20000,
      esPopular: false,
      icono: '💅',
      detalles: [],
      activo: true
    });
    setServiceProfScope('todos');
    setServiceSelectedProfIds(professionals.map(p => p.id));
    scrollToServiceForm();
  };

  const handleOpenEditService = async (srv: Service) => {
    setEditingService(srv);
    setIsCreatingService(false);
    setCustomFeatureInput('');
    setServiceForm({
      nombre: srv.nombre,
      categoria: srv.categoria,
      descripcion: srv.descripcion || '',
      duracionMinutos: srv.duracionMinutos,
      precio: srv.precio,
      esPopular: !!srv.esPopular,
      icono: srv.icono || '💅',
      detalles: Array.isArray(srv.detalles) ? [...srv.detalles] : [],
      activo: srv.activo
    });

    try {
      const res = await fetch(`/api/servicios/${srv.id}/profesionales`, { credentials: 'include' });
      if (res.ok) {
        const assigned: Professional[] = await res.json();
        const assignedIds = assigned.map(p => p.id);
        setServiceSelectedProfIds(assignedIds);
        if (assignedIds.length === 0 || assignedIds.length === professionals.length) {
          setServiceProfScope('todos');
        } else {
          setServiceProfScope('especificos');
        }
      } else {
        setServiceProfScope('todos');
        setServiceSelectedProfIds(professionals.map(p => p.id));
      }
    } catch {
      setServiceProfScope('todos');
      setServiceSelectedProfIds(professionals.map(p => p.id));
    }
    scrollToServiceForm();
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (res.ok) {
        setIsAuthenticated(true);
        setCurrentUser(data.user);
        loadAdminData();
      } else {
        setLoginError(data.error || 'Credenciales inválidas');
      }
    } catch (err) {
      setLoginError('Error de conexión con el servidor');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUsernameInput('');
    setPasswordInput('');
  };

  const handleAuthError = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [aptRes, srvRes, profRes, cfgRes, statsRes, dbRes] = await Promise.all([
        fetch('/api/turnos', { credentials: 'include' }),
        fetch('/api/servicios?all=true', { credentials: 'include' }),
        fetch('/api/profesionales?all=true', { credentials: 'include' }),
        fetch('/api/config', { credentials: 'include' }),
        fetch('/api/turnos/stats', { credentials: 'include' }),
        fetch('/api/db-status', { credentials: 'include' })
      ]);

      if (aptRes.status === 401 || srvRes.status === 401 || profRes.status === 401) {
        handleAuthError();
        return;
      }

      if (aptRes.ok) setAppointments(await aptRes.json());
      if (srvRes.ok) setServices(await srvRes.json());
      if (profRes.ok) setProfessionals(await profRes.json());
      if (cfgRes.ok) setConfig(await cfgRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (dbRes.ok) setDbStatus(await dbRes.json());
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setStatusFilter('pendiente');
      setDateFilter(getTodayDateString());
      setSearchQuery('');
      setIsCheckingAuth(true);
      // Check existing backend session cookie
      fetch('/api/auth/me', { credentials: 'include' })
        .then(async res => {
          if (res.ok) {
            const data = await res.json();
            if (data?.user) {
              setIsAuthenticated(true);
              setCurrentUser(data.user);
            } else {
              setIsAuthenticated(false);
              setCurrentUser(null);
            }
          } else {
            setIsAuthenticated(false);
            setCurrentUser(null);
          }
        })
        .catch(() => {
          setIsAuthenticated(false);
          setCurrentUser(null);
        })
        .finally(() => {
          setIsCheckingAuth(false);
        });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadAdminData();
    }
  }, [isOpen, isAuthenticated]);

  // Change Appointment Status
  const handleUpdateStatus = async (
    id: string,
    newStatus: AppointmentStatus,
    cancelMeta?: { motivo?: string; origen?: string; canceladoPor?: string }
  ) => {
    try {
      const cleanId = (id || '').trim();
      let res: Response;
      if (newStatus === 'cancelado') {
        res = await fetch(`/api/turnos/${encodeURIComponent(cleanId)}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            motivo: cancelMeta?.motivo || 'Cancelado por administración',
            origen: cancelMeta?.origen || 'agenda',
            canceladoPor: cancelMeta?.canceladoPor || 'Administración'
          })
        });
      } else {
        res = await fetch(`/api/turnos/${encodeURIComponent(cleanId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: newStatus })
        });
      }

      if (res.ok) {
        const updated = await res.json();
        setAppointments(prev => prev.map(a => (a.id === cleanId || a.codigo === cleanId) ? updated : a));
        setSelectedAppointmentForDetail(prev => (prev && (prev.id === cleanId || prev.codigo === cleanId)) ? updated : prev);
        showAdminToast(`Estado del turno actualizado a: ${newStatus.toUpperCase()}`);
        await loadAdminData();
        onRefreshPublicData();
        return updated;
      } else {
        const errData = await res.json().catch(() => ({}));
        showAdminToast(errData.error || 'No se pudo actualizar el estado del turno.', 'error');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      showAdminToast('Error de conexión al actualizar el estado.', 'error');
    }
  };

  // Save Admin Notes
  const handleSaveNotes = async (id: string) => {
    try {
      const res = await fetch(`/api/turnos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notasAdmin: tempNotes })
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments(prev => prev.map(a => a.id === id ? updated : a));
        setSelectedAppointmentForDetail(prev => prev && prev.id === id ? { ...prev, notasAdmin: tempNotes } : prev);
        setEditingNotesId(null);
      }
    } catch (err) {
      console.error('Error saving notes:', err);
    }
  };

  const handleSaveNotesDirect = async (id: string, notes: string) => {
    try {
      const res = await fetch(`/api/turnos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notasAdmin: notes })
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments(prev => prev.map(a => a.id === id ? updated : a));
        setSelectedAppointmentForDetail(prev => prev && prev.id === id ? { ...prev, notasAdmin: notes } : prev);
      }
    } catch (err) {
      console.error('Error saving notes directly:', err);
    }
  };

  // Client quick search for manual booking
  useEffect(() => {
    if (!clientSearchTerm || clientSearchTerm.trim().length < 2) {
      setClientsSearchResults([]);
      setIsSearchingClients(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingClients(true);
      try {
        const res = await fetch(`/api/clientes?search=${encodeURIComponent(clientSearchTerm.trim())}`);
        if (res.ok) {
          const list: Client[] = await res.json();
          setClientsSearchResults(Array.isArray(list) ? list.slice(0, 5) : []);
        }
      } catch (err) {
        console.error('Error searching clients for manual booking:', err);
      } finally {
        setIsSearchingClients(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [clientSearchTerm]);

  // Real-time availability check for manual booking (identical to client booking logic)
  useEffect(() => {
    if (activeTab !== 'nuevo' || !manualForm.fecha || !manualForm.servicioId) {
      return;
    }

    let isMounted = true;
    setIsLoadingManualAvailability(true);
    setManualAvailabilityError(null);

    const fetchAvailability = async () => {
      try {
        const profParam = manualForm.profesionalId ? `&professional_id=${encodeURIComponent(manualForm.profesionalId)}` : '';
        const res = await fetch(`/api/availability?date=${encodeURIComponent(manualForm.fecha)}&service_id=${encodeURIComponent(manualForm.servicioId)}${profParam}`);
        if (!res.ok) {
          throw new Error('No se pudo verificar la disponibilidad para esta fecha.');
        }
        const data: DayAvailability = await res.json();
        if (isMounted) {
          setManualAvailability(data);
          // If a slot was already chosen and is not valid in the new query, auto-adjust to first available
          if (!customTimeInput) {
            if (manualForm.horaInicio) {
              const slotAvailable = data.slots.some(s => s.hora === manualForm.horaInicio && s.disponible);
              if (!slotAvailable) {
                const firstFree = data.slots.find(s => s.disponible);
                setManualForm(prev => ({ ...prev, horaInicio: firstFree ? firstFree.hora : '' }));
              }
            } else {
              const firstFree = data.slots.find(s => s.disponible);
              if (firstFree) {
                setManualForm(prev => ({ ...prev, horaInicio: firstFree.hora }));
              }
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setManualAvailabilityError(err.message || 'Error al consultar disponibilidad.');
          setManualAvailability(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingManualAvailability(false);
        }
      }
    };

    fetchAvailability();

    return () => {
      isMounted = false;
    };
  }, [activeTab, manualForm.fecha, manualForm.servicioId, manualForm.profesionalId, customTimeInput]);

  // Calculated End Time for manual booking
  const calculatedManualEndTime = useMemo(() => {
    if (!manualForm.horaInicio || !manualForm.servicioId) return '';
    const srv = services.find(s => s.id === manualForm.servicioId);
    if (!srv) return '';
    const [h, m] = manualForm.horaInicio.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    const totalMinutes = h * 60 + m + srv.duracionMinutos;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }, [manualForm.horaInicio, manualForm.servicioId, services]);

  // Delete Appointment (definitively removes record from database and memory)
  const executeDeleteAppointment = async (apt: Appointment) => {
    try {
      const cleanId = (apt.id || apt.codigo || '').trim();
      const res = await fetch(`/api/turnos/${encodeURIComponent(cleanId)}`, { method: 'DELETE' });
      if (res.ok) {
        setAppointments(prev => prev.filter(a => a.id !== apt.id && a.codigo !== apt.codigo));
        if (selectedAppointmentForDetail?.id === apt.id || selectedAppointmentForDetail?.codigo === apt.codigo) {
          setSelectedAppointmentForDetail(null);
        }
        setAppointmentToDelete(null);
        showAdminToast(`El registro del turno (${apt.codigo}) fue eliminado definitivamente.`);
        await loadAdminData();
        onRefreshPublicData();
      } else {
        const data = await res.json().catch(() => ({}));
        showAdminToast(data.error || 'No se pudo eliminar el turno del servidor.', 'error');
      }
    } catch (err) {
      console.error('Error deleting appointment:', err);
      showAdminToast('Error de conexión al intentar eliminar el turno.', 'error');
    }
  };

  const executeRevertStatus = async (apt: Appointment, newStatus: AppointmentStatus) => {
    try {
      const cleanId = (apt.id || apt.codigo || '').trim();
      const res = await fetch(`/api/turnos/${encodeURIComponent(cleanId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: newStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments(prev => prev.map(a => (a.id === cleanId || a.codigo === cleanId) ? updated : a));
        if (selectedAppointmentForDetail?.id === cleanId || selectedAppointmentForDetail?.codigo === cleanId) {
          setSelectedAppointmentForDetail(updated);
        }
        setAppointmentToRevert(null);
        showAdminToast(`El turno de ${apt.nombre} ${apt.apellido} (${apt.codigo}) fue pasado a PENDIENTE.`);
        await loadAdminData();
        onRefreshPublicData();
      } else {
        const data = await res.json().catch(() => ({}));
        showAdminToast(data.error || 'No se pudo actualizar el estado del turno.', 'error');
      }
    } catch (err) {
      console.error('Error updating appointment status:', err);
      showAdminToast('Error de conexión al actualizar el estado.', 'error');
    }
  };

  const handleDeleteAppointment = (apt: Appointment) => {
    setAppointmentToDelete(apt);
  };

  // Create Manual Appointment
  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    setManualSuccess(null);

    if (!manualForm.nombre.trim() || !manualForm.telefono.trim() || !manualForm.servicioId || !manualForm.fecha || !manualForm.horaInicio) {
      setManualError('Por favor completá los campos obligatorios: Nombre, Teléfono, Servicio, Fecha y Hora.');
      return;
    }

    try {
      const res = await fetch('/api/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: manualForm.nombre.trim(),
          apellido: manualForm.apellido.trim() || 'Cliente',
          telefono: manualForm.telefono.trim(),
          email: manualForm.email.trim() || undefined,
          servicio_id: manualForm.servicioId,
          profesional_id: manualForm.profesionalId || undefined,
          fecha: manualForm.fecha,
          hora_inicio: manualForm.horaInicio,
          observaciones: manualForm.observaciones.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setManualError(data.error || 'No se pudo crear el turno.');
        return;
      }

      // If internal admin notes were supplied, save them directly
      if (manualForm.notasAdmin.trim() && data.turno?.id) {
        await fetch(`/api/turnos/${data.turno.id}/notas`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notasAdmin: manualForm.notasAdmin.trim() })
        }).catch(err => console.error('Error saving admin notes on manual creation:', err));
      }

      setManualSuccess(`¡Turno creado con éxito! Código asignado: ${data.turno?.codigo || ''}`);
      setSelectedManualClient(null);
      setClientSearchTerm('');
      setManualForm({
        nombre: '',
        apellido: '',
        telefono: '',
        email: '',
        servicioId: '',
        profesionalId: '',
        fecha: getTodayDateString(),
        horaInicio: '',
        observaciones: '',
        notasAdmin: ''
      });
      loadAdminData();
      onRefreshPublicData();
    } catch (err: any) {
      setManualError('Error al conectar con el servidor.');
    }
  };

  // Save Service (Create or Edit)
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService) {
        const res = await fetch(`/api/servicios/${editingService.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serviceForm)
        });
        if (res.ok) {
          const targetProfIds = serviceProfScope === 'todos'
            ? professionals.map(p => p.id)
            : serviceSelectedProfIds;

          await fetch(`/api/servicios/${editingService.id}/profesionales`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profesionalIds: targetProfIds })
          });

          setEditingService(null);
          setServiceSuccessMsg(`Servicio "${serviceForm.nombre}" actualizado con éxito.`);
          setTimeout(() => setServiceSuccessMsg(null), 4000);
          loadAdminData();
          onRefreshPublicData();
        }
      } else if (isCreatingService) {
        const res = await fetch('/api/servicios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serviceForm)
        });
        if (res.ok) {
          const newSrv = await res.json();
          const targetProfIds = serviceProfScope === 'todos'
            ? professionals.map(p => p.id)
            : serviceSelectedProfIds;

          if (newSrv?.id) {
            await fetch(`/api/servicios/${newSrv.id}/profesionales`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ profesionalIds: targetProfIds })
            });
          }

          setIsCreatingService(false);
          setServiceSuccessMsg(`Nuevo servicio "${serviceForm.nombre}" creado con éxito.`);
          setTimeout(() => setServiceSuccessMsg(null), 4000);
          loadAdminData();
          onRefreshPublicData();
        }
      }
    } catch (err) {
      console.error('Error saving service:', err);
    }
  };

  // Delete Service (Admin Modal Confirmation)
  const executeDeleteService = async () => {
    if (!serviceToDelete) return;
    const { id, nombre } = serviceToDelete;
    
    // Optimistic UI update so it immediately disappears
    const previousServices = [...services];
    setServices(prev => prev.filter(s => s.id !== id));
    if (editingService?.id === id) {
      setEditingService(null);
    }
    setServiceToDelete(null);

    try {
      const res = await fetch(`/api/servicios/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setServiceSuccessMsg(`Servicio "${nombre}" eliminado correctamente.`);
        setTimeout(() => setServiceSuccessMsg(null), 4000);
        loadAdminData();
        onRefreshPublicData();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'No se pudo eliminar el servicio del servidor.');
        setServices(previousServices);
      }
    } catch (err) {
      console.error('Error deleting service:', err);
      alert('Error de conexión al intentar eliminar el servicio.');
      setServices(previousServices);
    }
  };

  // WhatsApp quick text generator
  const getWhatsAppChatUrl = (apt: Appointment) => {
    const rawPhone = apt.telefono.replace(/[^0-9]/g, '');
    let cleanPhone = rawPhone;
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.slice(1);
    if (!cleanPhone.startsWith('549') && !cleanPhone.startsWith('54')) {
      cleanPhone = `549${cleanPhone}`;
    }
    const msg = encodeURIComponent(
      `¡Hola ${apt.nombre}! Te escribimos desde *Gwen Nails* ✨\n\n` +
      `Queríamos confirmarte tu turno para *${apt.servicioNombre}* el día *${isoDateToAR(apt.fecha)}* a las *${apt.horaInicio} hs*.\n` +
      `Estudio: Gorriti 5540, Palermo Hollywood.\n\n` +
      `¿Nos confirmás asistencia? ¡Muchas gracias!`
    );
    return `https://wa.me/${cleanPhone}?text=${msg}`;
  };

  // Filtered appointments list
  const filteredAppointments = appointments.filter(a => {
    if (statusFilter !== 'todos' && a.estado !== statusFilter) return false;
    if (dateFilter && a.fecha !== dateFilter) return false;
    if (professionalFilter !== 'all' && a.profesionalId !== professionalFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = a.nombre.toLowerCase().includes(q) || a.apellido.toLowerCase().includes(q);
      const matchPhone = a.telefono.includes(q);
      const matchCode = a.codigo.toLowerCase().includes(q);
      const matchSrv = a.servicioNombre.toLowerCase().includes(q);
      const matchProf = a.profesionalNombre?.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchCode && !matchSrv && !matchProf) return false;
    }
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-[#E8DCD5]">
        
        {/* Modal Header */}
        <div className="bg-[#241E1A] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#8E4455] text-white flex items-center justify-center font-bold text-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-lg sm:text-xl font-medium">
                Panel de Gestión · Gwen Nails
              </h3>
              <p className="text-[11px] text-[#C4B0A3]">Control de agenda, turnos, profesionales, servicios y horarios</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && dbStatus && (
              <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                dbStatus.postgresConnected 
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30' 
                  : 'bg-[#3A2F28] text-[#D9C9BF] border-[#5A4A3E]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.postgresConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                <span>{dbStatus.postgresConnected ? '🐘 PostgreSQL Conectado' : '📁 Almacenamiento Local'}</span>
              </div>
            )}
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-200 text-xs transition-colors cursor-pointer"
                title="Cerrar sesión"
              >
                Salir
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#E8DCC4] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Not Authenticated: Login Prompt or Initial Checking */}
        {isCheckingAuth ? (
          <div className="p-12 text-center max-w-md mx-auto my-auto w-full">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#8E4455] mb-3" />
            <p className="text-xs text-[#7A6B62]">Verificando sesión...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="p-8 sm:p-12 text-center max-w-md mx-auto my-auto w-full">
            <div className="w-16 h-16 rounded-full bg-[#FAF7F2] text-[#8E4455] border border-[#E8DCD5] flex items-center justify-center mx-auto mb-6">
              <Lock className="w-7 h-7" />
            </div>
            <h4 className="font-serif text-2xl font-medium text-[#241E1A] mb-2">
              Acceso Administrativo · Gwen Nails
            </h4>
            <p className="text-xs text-[#7A6B62] mb-6">
              Ingresá tu usuario y contraseña asignados para acceder al sistema.
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Usuario o Email</label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="admin o email@gwennails.com"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] text-sm focus:outline-none focus:border-[#8E4455]"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Contraseña</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] text-sm focus:outline-none focus:border-[#8E4455]"
                  required
                />
              </div>

              {loginError && (
                <p className="text-xs text-rose-600 font-medium text-center">{loginError}</p>
              )}

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-[#8E4455] text-white text-sm font-medium hover:bg-[#783645] transition-all cursor-pointer mt-2"
              >
                Iniciar Sesión
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Admin Dashboard */
          <div className="flex-1 flex flex-col overflow-hidden bg-[#FAF7F2]">
            
            {/* Tabs Bar */}
            <div className="bg-white border-b border-[#E8DCD5] px-6 flex items-center gap-1.5 overflow-x-auto shrink-0 py-2">
              <button
                onClick={() => setActiveTab('agenda')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'agenda'
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'text-[#5A4B43] hover:bg-[#FAF7F2]'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Agenda ({appointments.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('clientes')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'clientes'
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'text-[#5A4B43] hover:bg-[#FAF7F2]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Clientas</span>
              </button>

              <button
                onClick={() => setActiveTab('profesionales')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'profesionales'
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'text-[#5A4B43] hover:bg-[#FAF7F2]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Profesionales ({professionals.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('horarios')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'horarios'
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'text-[#5A4B43] hover:bg-[#FAF7F2]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Horarios</span>
              </button>

              <button
                onClick={() => setActiveTab('excepciones')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'excepciones'
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'text-[#5A4B43] hover:bg-[#FAF7F2]'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Excepciones</span>
              </button>

              <button
                onClick={() => setActiveTab('servicios')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'servicios'
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'text-[#5A4B43] hover:bg-[#FAF7F2]'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Servicios</span>
              </button>

              <button
                onClick={() => setActiveTab('promociones')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'promociones'
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'text-[#5A4B43] hover:bg-[#FAF7F2]'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Promociones</span>
              </button>

              <button
                onClick={() => setActiveTab('plantillas-beneficios')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'plantillas-beneficios'
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'text-[#5A4B43] hover:bg-[#FAF7F2]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tipos de Beneficio</span>
              </button>

              <button
                onClick={() => setActiveTab('beneficios')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'beneficios'
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'text-[#5A4B43] hover:bg-[#FAF7F2]'
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Beneficios</span>
              </button>

              <button
                onClick={() => setActiveTab('nuevo')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'nuevo'
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'text-[#5A4B43] hover:bg-[#FAF7F2]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Turno</span>
              </button>

              <button
                onClick={() => setActiveTab('stats')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'stats'
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'text-[#5A4B43] hover:bg-[#FAF7F2]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Métricas</span>
              </button>
            </div>

            {/* Tab Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              
              {/* TAB: CLIENTES & HISTORIAL UNIFICADO */}
              {activeTab === 'clientes' && (
                <ClientManagementAdmin 
                  services={services} 
                  onRefreshData={loadAdminData}
                  initialClientLookup={clientLookupForFicha}
                  onClearInitialClientLookup={() => setClientLookupForFicha(null)}
                  onOpenNewBookingWithClient={(client) => {
                    setManualForm(prev => ({
                      ...prev,
                      nombre: client.nombre,
                      apellido: client.apellido,
                      telefono: client.telefono,
                      email: client.email || '',
                      observaciones: '',
                      notasAdmin: ''
                    }));
                    setSelectedManualClient(client);
                    setManualError(null);
                    setManualSuccess(null);
                    setActiveTab('nuevo');
                  }}
                />
              )}

              {/* TAB: GESTIÓN DE PROFESIONALES */}
              {activeTab === 'profesionales' && (
                <ProfessionalManagementAdmin 
                  services={services}
                  appointments={appointments}
                  onRefreshData={loadAdminData}
                  onNavigateToSchedule={(profId) => {
                    setSelectedProfForSchedule(profId);
                    setActiveTab('horarios');
                  }}
                />
              )}

              {/* TAB: HORARIOS LOCAL Y PROFESIONALES */}
              {activeTab === 'horarios' && (
                <ScheduleManagementAdmin 
                  professionals={professionals} 
                  onRefreshData={loadAdminData} 
                  initialProfessionalId={selectedProfForSchedule}
                />
              )}

              {/* TAB: EXCEPCIONES Y VACACIONES */}
              {activeTab === 'excepciones' && (
                <AvailabilityExceptionsAdmin 
                  professionals={professionals} 
                  onRefreshData={loadAdminData} 
                />
              )}

              {/* TAB 1: AGENDA DE TURNOS */}
              {activeTab === 'agenda' && (
                <div className="space-y-4">
                  {/* Filters Header */}
                  <div className="bg-white p-4 rounded-2xl border border-[#E8DCD5] flex flex-wrap items-center justify-between gap-3">
                    
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 text-[#8C7A70] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por cliente, teléfono o código..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                      />
                    </div>

                    {/* Status filter pills */}
                    <div className="flex items-center gap-1">
                      {['todos', 'pendiente', 'completado', 'cancelado'].map(st => (
                        <button
                          key={st}
                          onClick={() => setStatusFilter(st)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                            statusFilter === st
                              ? 'bg-[#241E1A] text-white'
                              : 'bg-[#FAF7F2] text-[#5A4B43] hover:bg-[#E8DCD5]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    {/* Professional filter */}
                    {professionals.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#8C7A70]" />
                        <select
                          value={professionalFilter}
                          onChange={(e) => setProfessionalFilter(e.target.value)}
                          className="py-1.5 px-2.5 rounded-lg bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                        >
                          <option value="all">Todas las profesionales</option>
                          {professionals.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Date filter */}
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="py-1.5 px-2.5 rounded-lg bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none"
                      />
                      {dateFilter && (
                        <button
                          onClick={() => setDateFilter('')}
                          className="text-xs text-[#8E4455] hover:underline"
                        >
                          Ver todos
                        </button>
                      )}
                    </div>

                  </div>

                  {/* Appointments List */}
                  {filteredAppointments.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-[#E8DCD5]">
                      <CalendarIcon className="w-10 h-10 text-[#C4B0A3] mx-auto mb-3" />
                      <h4 className="font-serif text-lg text-[#241E1A]">No se encontraron turnos</h4>
                      <p className="text-xs text-[#7A6B62]">Probá cambiando los filtros o agregá un nuevo turno manual.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredAppointments.map((apt) => {
                        const isEditingThisNote = editingNotesId === apt.id;

                        const statusBadge = {
                          pendiente: 'bg-amber-50 text-amber-800 border-amber-300',
                          completado: 'bg-blue-50 text-blue-800 border-blue-300',
                          cancelado: 'bg-rose-50 text-rose-800 border-rose-300 line-through opacity-70'
                        }[apt.estado] || 'bg-stone-50 text-stone-800 border-stone-300';

                        return (
                          <div
                            key={apt.id}
                            className="bg-white rounded-2xl p-5 border border-[#E8DCD5] shadow-xs flex flex-col justify-between hover:border-[#8E4455]/40 transition-all cursor-default"
                          >
                            <div>
                              {/* Header Card */}
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedAppointmentForDetail(apt)}
                                      className="font-bold text-[#241E1A] text-base hover:text-[#8E4455] transition-colors cursor-pointer text-left flex items-center gap-1.5 group"
                                      title="Abrir detalle del turno"
                                    >
                                      <span>{apt.nombre} {apt.apellido}</span>
                                      <span className="text-[10px] text-[#8E4455] bg-rose-50 border border-rose-200/60 px-1.5 py-0.5 rounded-md font-medium opacity-80 group-hover:opacity-100 group-hover:bg-rose-100 transition-all">
                                        Detalle ↗
                                      </span>
                                    </button>
                                    <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                                      {apt.estado}
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-mono text-[#8C7A70]">
                                    Código: {apt.codigo}
                                  </span>
                                </div>

                                <div className="text-right">
                                  {apt.descuentoMonto && apt.descuentoMonto > 0 ? (
                                    <div>
                                      <span className="text-[10px] text-[#8C7A70] line-through block">
                                        ${(apt.precioOriginal || (apt.precio + apt.descuentoMonto)).toLocaleString('es-AR')}
                                      </span>
                                      <span className="font-serif font-bold text-[#8E4455] text-lg">
                                        ${apt.precio.toLocaleString('es-AR')}
                                      </span>
                                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md border border-emerald-200 block">
                                        {apt.descuentoCodigo ? `Cupón: ${apt.descuentoCodigo}` : 'Beneficio'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="font-serif font-bold text-[#8E4455] text-lg">
                                      ${apt.precio.toLocaleString('es-AR')}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Client Info & Quick Actions (Name, Phone, Email + Ficha & WhatsApp) */}
                              <div className="bg-[#FAF7F2]/80 p-3 rounded-xl border border-[#E8DCD5]/80 mb-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                    <span className="text-[#5A4B43] flex items-center gap-1">
                                      <Phone className="w-3.5 h-3.5 text-[#8C7A70] shrink-0" />
                                      <a 
                                        href={getWhatsAppChatUrl(apt)} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="font-mono hover:text-[#8E4455] transition-colors"
                                        title="Abrir chat de WhatsApp"
                                      >
                                        {apt.telefono}
                                      </a>
                                    </span>
                                    <span className="text-[#5A4B43] flex items-center gap-1 max-w-[220px] truncate" title={apt.email || 'Sin mail registrado'}>
                                      <Mail className="w-3.5 h-3.5 text-[#8C7A70] shrink-0" />
                                      <span className="truncate">{apt.email || 'Sin email'}</span>
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenClientFicha(apt)}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8E4455] bg-white px-2.5 py-1 rounded-full border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer shadow-2xs"
                                      title="Ver ficha de clienta"
                                    >
                                      <User className="w-3 h-3" />
                                      <span>Ficha</span>
                                    </button>
                                    <a
                                      href={getWhatsAppChatUrl(apt)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-white px-2.5 py-1 rounded-full border border-emerald-200 hover:bg-emerald-50 transition-colors shadow-2xs"
                                      title="Enviar mensaje por WhatsApp"
                                    >
                                      <MessageCircle className="w-3 h-3 fill-current" />
                                      <span>WhatsApp</span>
                                    </a>
                                  </div>
                                </div>
                              </div>

                              {/* Service & Time Info + Client Notes - Clickable for details */}
                              <div 
                                onClick={() => setSelectedAppointmentForDetail(apt)}
                                className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5] mb-3 space-y-2 text-xs hover:bg-[#F5EDE6] transition-colors cursor-pointer"
                                title="Click para ver detalle completo"
                              >
                                <div className="flex items-center justify-between text-[#241E1A]">
                                  <span className="font-semibold text-sm text-[#8E4455]">💅 {apt.servicioNombre}</span>
                                  <span className="text-[#7A6B62] text-[11px] font-medium bg-white px-2 py-0.5 rounded-md border border-[#E8DCD5]">{apt.duracionMinutos} min</span>
                                </div>
                                <div className="flex items-center justify-between text-[#5A4B43]">
                                  <span className="flex items-center gap-1 font-semibold text-[#8E4455]">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    {isoDateToAR(apt.fecha)}
                                  </span>
                                  <span className="flex items-center gap-1 font-semibold text-[#241E1A]">
                                    <Clock className="w-3.5 h-3.5" />
                                    {apt.horaInicio} - {apt.horaFin} hs
                                  </span>
                                </div>

                                {/* Observations / Client Note */}
                                {apt.observaciones && apt.observaciones.trim().length > 0 && (
                                  <div className="pt-2 border-t border-[#E8DCD5]/80 text-[11px] text-[#5A4B43]">
                                    <span className="font-semibold text-[#8E4455]">Nota de la clienta: </span>
                                    <span className="italic text-[#6E5D55]">"{apt.observaciones}"</span>
                                  </div>
                                )}

                                {/* Assigned Professional */}
                                {apt.profesionalNombre && (
                                  <div className="pt-2 border-t border-[#E8DCD5]/80 flex items-center justify-between text-[11px] text-[#5A4B43]">
                                    <span className="font-semibold text-[#8E4455] flex items-center gap-1">
                                      <User className="w-3 h-3 text-[#8E4455]" /> Profesional:
                                    </span>
                                    <span className="font-medium bg-white px-2 py-0.5 rounded-md border border-[#E8DCD5] text-[#241E1A]">
                                      {apt.profesionalNombre}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Internal Admin Notes */}
                              <div className="mb-3">
                                {isEditingThisNote ? (
                                  <div className="space-y-1.5">
                                    <textarea
                                      rows={2}
                                      value={tempNotes}
                                      onChange={(e) => setTempNotes(e.target.value)}
                                      placeholder="Nota privada interna para este turno..."
                                      className="w-full text-xs p-2 rounded-lg bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:outline-none"
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        onClick={() => setEditingNotesId(null)}
                                        className="text-[10px] text-[#7A6B62] px-2 py-1"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        onClick={() => handleSaveNotes(apt.id)}
                                        className="text-[10px] bg-[#8E4455] text-white px-2.5 py-1 rounded-md"
                                      >
                                        Guardar Nota
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between text-[11px] text-[#8C7A70] bg-[#FAF7F2]/50 p-2 rounded-lg">
                                    <span className="truncate mr-2">
                                      📝 {apt.notasAdmin ? apt.notasAdmin : 'Sin notas internas'}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setEditingNotesId(apt.id);
                                        setTempNotes(apt.notasAdmin || '');
                                      }}
                                      className="text-[#8E4455] hover:underline shrink-0 text-[10px] font-medium cursor-pointer"
                                    >
                                      Editar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions bar */}
                            <div className="pt-3 border-t border-[#F0E6DE] flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-1 text-xs">
                                <div className="flex items-center gap-1.5">
                                  {apt.estado === 'pendiente' ? (
                                    <>
                                      <button
                                        onClick={() => handleUpdateStatus(apt.id, 'completado')}
                                        className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-medium hover:bg-blue-200 text-[11px] transition-colors cursor-pointer"
                                        title="Marcar turno como completado"
                                      >
                                        Completar
                                      </button>
                                      <button
                                        onClick={() => {
                                          setCancelModalReason('Cancelación solicitada por la clienta');
                                          setAppointmentToCancel(apt);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-medium hover:bg-rose-200 text-[11px] transition-colors cursor-pointer"
                                        title="Cancelar este turno"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        onClick={() => setSelectedAppointmentForDetail(apt)}
                                        className="px-2 py-1 rounded-lg bg-[#FAF7F2] text-[#5A4B43] border border-[#E8DCD5] hover:bg-[#E8DCD5] font-medium text-[11px] transition-colors cursor-pointer"
                                      >
                                        Detalle
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => setSelectedAppointmentForDetail(apt)}
                                      className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] text-[#5A4B43] border border-[#E8DCD5] hover:bg-[#E8DCD5] font-medium text-[11px] transition-colors cursor-pointer"
                                    >
                                      Ver detalle
                                    </button>
                                  )}
                                </div>

                                {apt.estado !== 'pendiente' && (
                                  <button
                                    type="button"
                                    onClick={() => setAppointmentToDelete(apt)}
                                    className="p-1.5 text-[#C4B0A3] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Eliminar registro definitivamente"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              {/* Información visible de cancelación si el turno fue cancelado */}
                              {apt.estado === 'cancelado' && (
                                <div className="p-2 rounded-lg bg-rose-50/90 border border-rose-200 text-[11px] text-rose-900 space-y-0.5">
                                  <div className="font-semibold flex items-center gap-1 text-rose-800">
                                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    <span>Motivo: {apt.motivoCancelacion || 'Cancelado por administración'}</span>
                                  </div>
                                  {apt.canceladoEn && (
                                    <div className="text-[10px] text-rose-700/80">
                                      {formatDateTimeAR(apt.canceladoEn)}
                                      {apt.canceladoPor && ` · ${apt.canceladoPor}`}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Revert status action for completed or cancelled appointments */}
                              {apt.estado === 'completado' && (
                                <div className="flex items-center justify-start pt-1 border-t border-dashed border-[#F0E6DE]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAppointmentToRevert({
                                        apt,
                                        id: apt.id,
                                        nombre: apt.nombre,
                                        apellido: apt.apellido,
                                        codigo: apt.codigo,
                                        newStatus: 'pendiente',
                                        isReactivating: false
                                      });
                                    }}
                                    className="text-[11px] text-[#8E4455] hover:text-[#783645] hover:underline font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Volver a pasar este turno a estado pendiente"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Volver a pasar a pendiente</span>
                                  </button>
                                </div>
                              )}

                              {apt.estado === 'cancelado' && (
                                <div className="flex items-center justify-start pt-1 border-t border-dashed border-[#F0E6DE]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAppointmentToRevert({
                                        apt,
                                        id: apt.id,
                                        nombre: apt.nombre,
                                        apellido: apt.apellido,
                                        codigo: apt.codigo,
                                        newStatus: 'pendiente',
                                        isReactivating: true
                                      });
                                    }}
                                    className="text-[11px] text-amber-800 hover:text-amber-900 hover:underline font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Reactivar este turno a estado pendiente"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Reactivar a pendiente</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: NUEVO TURNO MANUAL */}
              {activeTab === 'nuevo' && (
                <div className="max-w-3xl mx-auto space-y-6">
                  <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8DCD5] shadow-xs">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#E8DCD5] flex items-center justify-center text-[#8E4455]">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-serif text-2xl font-medium text-[#241E1A]">
                          Cargar Turno Manualmente
                        </h4>
                        <p className="text-xs text-[#7A6B62]">
                          Agendá turnos para clientas presenciales o telefónicas verificando la disponibilidad real de horarios en el estudio.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleCreateManual} className="mt-6 space-y-6">
                      {/* Section 1: Client Selection */}
                      <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-[#E8DCD5] space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="font-serif font-bold text-sm text-[#241E1A] flex items-center gap-1.5">
                            <User className="w-4 h-4 text-[#8E4455]" />
                            <span>1. Datos de la Clienta</span>
                          </h5>
                          {selectedManualClient && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedManualClient(null);
                                setManualForm(prev => ({ ...prev, nombre: '', apellido: '', telefono: '', email: '' }));
                              }}
                              className="text-xs text-[#8E4455] hover:underline font-medium cursor-pointer"
                            >
                              Cambiar clienta
                            </button>
                          )}
                        </div>

                        {/* Search existing clients */}
                        {!selectedManualClient && (
                          <div className="relative">
                            <Search className="w-4 h-4 text-[#8C7A70] absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={clientSearchTerm}
                              onChange={(e) => setClientSearchTerm(e.target.value)}
                              placeholder="Buscar clienta existente (nombre, teléfono o email)..."
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            />
                            {isSearchingClients && (
                              <RefreshCw className="w-3.5 h-3.5 text-[#8E4455] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                            )}

                            {/* Client search results dropdown */}
                            {clientsSearchResults.length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-[#E8DCD5] shadow-lg z-20 overflow-hidden divide-y divide-[#F0E6DE]">
                                {clientsSearchResults.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedManualClient(c);
                                      setManualForm(prev => ({
                                        ...prev,
                                        nombre: c.nombre,
                                        apellido: c.apellido,
                                        telefono: c.telefono,
                                        email: c.email || ''
                                      }));
                                      setClientSearchTerm('');
                                      setClientsSearchResults([]);
                                    }}
                                    className="w-full text-left p-3 hover:bg-[#FAF7F2] flex items-center justify-between text-xs transition-colors cursor-pointer"
                                  >
                                    <div>
                                      <p className="font-bold text-[#241E1A]">{c.nombre} {c.apellido}</p>
                                      <p className="text-[11px] text-[#7A6B62] flex items-center gap-2">
                                        <span>📱 {c.telefono}</span>
                                        {c.email && <span>✉️ {c.email}</span>}
                                      </p>
                                    </div>
                                    <span className="text-[10px] font-semibold text-[#8E4455] bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                      Seleccionar
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* No results message */}
                            {!isSearchingClients && clientSearchTerm.trim().length >= 2 && clientsSearchResults.length === 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-[#E8DCD5] shadow-lg z-20 p-3 text-center text-xs text-[#7A6B62]">
                                No existe ninguna clienta que coincida con la búsqueda. Podés completar los campos debajo para registrarla.
                              </div>
                            )}
                          </div>
                        )}

                        {/* Client details fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-medium text-[#4A3E39] mb-1">Nombre *</label>
                            <input
                              type="text"
                              required
                              value={manualForm.nombre}
                              onChange={(e) => setManualForm({ ...manualForm, nombre: e.target.value })}
                              placeholder="Nombre de la clienta"
                              className="w-full p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-[#4A3E39] mb-1">Apellido</label>
                            <input
                              type="text"
                              value={manualForm.apellido}
                              onChange={(e) => setManualForm({ ...manualForm, apellido: e.target.value })}
                              placeholder="Apellido"
                              className="w-full p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-[#4A3E39] mb-1">Teléfono / WhatsApp *</label>
                            <input
                              type="tel"
                              required
                              value={manualForm.telefono}
                              onChange={(e) => setManualForm({ ...manualForm, telefono: e.target.value })}
                              placeholder="Ej: 11-4521-8899"
                              className="w-full p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-[#4A3E39] mb-1">Email</label>
                            <input
                              type="email"
                              value={manualForm.email}
                              onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                              placeholder="clienta@ejemplo.com"
                              className="w-full p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Service & Date */}
                      <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-[#E8DCD5] space-y-4">
                        <h5 className="font-serif font-bold text-sm text-[#241E1A] flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-[#8E4455]" />
                          <span>2. Servicio y Fecha</span>
                        </h5>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-medium text-[#4A3E39] mb-1">Servicio Solicitado *</label>
                            <select
                              required
                              value={manualForm.servicioId}
                              onChange={(e) => setManualForm({ ...manualForm, servicioId: e.target.value })}
                              className="w-full p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            >
                              <option value="">Seleccionar Servicio...</option>
                              {services.filter(s => s.activo !== false).map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.nombre} ({s.duracionMinutos} min - ${s.precio.toLocaleString('es-AR')})
                                </option>
                              ))}
                            </select>
                          </div>

                          {professionals.length > 0 && (
                            <div>
                              <label className="block text-[11px] font-medium text-[#4A3E39] mb-1">Profesional Asignada (Opcional)</label>
                              <select
                                value={manualForm.profesionalId}
                                onChange={(e) => setManualForm({ ...manualForm, profesionalId: e.target.value })}
                                className="w-full p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                              >
                                <option value="">Cualquiera disponible automáticamente</option>
                                {professionals.filter(p => p.activo !== false).map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.nombre} {p.especialidad ? `(${p.especialidad})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="block text-[11px] font-medium text-[#4A3E39] mb-1">Fecha del Turno *</label>
                            <input
                              type="date"
                              required
                              value={manualForm.fecha}
                              onChange={(e) => setManualForm({ ...manualForm, fecha: e.target.value })}
                              className="w-full p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            />
                            {/* Date shortcuts */}
                            <div className="flex gap-2 mt-1.5 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setManualForm(prev => ({ ...prev, fecha: getTodayDateString() }))}
                                className="text-[#8E4455] hover:underline font-medium"
                              >
                                Hoy
                              </button>
                              <span className="text-[#D9C9BF]">·</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const tomorrow = new Date();
                                  tomorrow.setDate(tomorrow.getDate() + 1);
                                  setManualForm(prev => ({ ...prev, fecha: getBusinessDate(tomorrow) }));
                                }}
                                className="text-[#8E4455] hover:underline font-medium"
                              >
                                Mañana
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Availability & Slot Selection */}
                      <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-[#E8DCD5] space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="font-serif font-bold text-sm text-[#241E1A] flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-[#8E4455]" />
                            <span>3. Horario Disponible (En tiempo real)</span>
                          </h5>
                          <button
                            type="button"
                            onClick={() => setCustomTimeInput(!customTimeInput)}
                            className="text-[11px] text-[#8E4455] hover:underline font-medium cursor-pointer"
                          >
                            {customTimeInput ? 'Ver selector de turnos' : 'Ingresar horario libre manual'}
                          </button>
                        </div>

                        {/* Availability Status / Messages */}
                        {!manualForm.servicioId || !manualForm.fecha ? (
                          <div className="p-4 bg-white rounded-xl border border-[#E8DCD5] text-center text-xs text-[#7A6B62]">
                            Seleccioná un servicio y una fecha para calcular los horarios disponibles en tiempo real.
                          </div>
                        ) : isLoadingManualAvailability ? (
                          <div className="p-6 bg-white rounded-xl border border-[#E8DCD5] text-center text-xs text-[#7A6B62] flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 text-[#8E4455] animate-spin" />
                            <span>Verificando disponibilidad en tiempo real...</span>
                          </div>
                        ) : manualAvailabilityError ? (
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                            {manualAvailabilityError}
                          </div>
                        ) : manualAvailability && !manualAvailability.abierto ? (
                          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800">
                            🔒 {manualAvailability.motivo || 'El estudio se encuentra cerrado en esta fecha.'}
                          </div>
                        ) : customTimeInput ? (
                          <div className="space-y-2">
                            <label className="block text-[11px] font-medium text-[#4A3E39]">Hora de inicio manual (HH:MM)</label>
                            <input
                              type="time"
                              required
                              value={manualForm.horaInicio}
                              onChange={(e) => setManualForm({ ...manualForm, horaInicio: e.target.value })}
                              className="w-full p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {manualAvailability && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[#7A6B62]">
                                  {manualAvailability.slotsDisponiblesCount} horarios libres encontrados
                                </span>
                                {manualForm.horaInicio && (
                                  <span className="font-semibold text-[#8E4455]">
                                    Turno: {manualForm.horaInicio} - {calculatedManualEndTime} hs
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Slots Grid */}
                            {manualAvailability && manualAvailability.slots.length > 0 ? (
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                {manualAvailability.slots.map((slot) => {
                                  const isSelected = manualForm.horaInicio === slot.hora;
                                  return (
                                    <button
                                      key={slot.hora}
                                      type="button"
                                      disabled={!slot.disponible}
                                      onClick={() => setManualForm(prev => ({ ...prev, horaInicio: slot.hora }))}
                                      title={slot.disponible ? `Seleccionar ${slot.hora} hs` : (slot.motivo || 'Horario no disponible')}
                                      className={`py-2 px-1 rounded-xl text-xs font-mono font-medium transition-all text-center cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#8E4455] text-white shadow-xs scale-102 ring-2 ring-[#8E4455]/30'
                                          : slot.disponible
                                          ? 'bg-white text-[#241E1A] border border-[#D9C9BF] hover:border-[#8E4455] hover:bg-rose-50/50'
                                          : 'bg-stone-100 text-[#A39288] border border-stone-200 line-through opacity-60 cursor-not-allowed'
                                      }`}
                                    >
                                      {slot.hora}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-[#7A6B62] italic bg-white p-3 rounded-xl border border-[#E8DCD5]">
                                No hay turnos configurados para esta fecha.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Section 4: Observations & Private Notes */}
                      <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-[#E8DCD5] space-y-3">
                        <h5 className="font-serif font-bold text-sm text-[#241E1A] flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-[#8E4455]" />
                          <span>4. Observaciones y Notas</span>
                        </h5>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-[#4A3E39] mb-1">
                              Observaciones de la Clienta
                            </label>
                            <input
                              type="text"
                              value={manualForm.observaciones}
                              onChange={(e) => setManualForm({ ...manualForm, observaciones: e.target.value })}
                              placeholder="Ej: Retiro previo, uñas cortas..."
                              className="w-full p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-[#4A3E39] mb-1">
                              Nota Interna del Estudio (Privada)
                            </label>
                            <input
                              type="text"
                              value={manualForm.notasAdmin}
                              onChange={(e) => setManualForm({ ...manualForm, notasAdmin: e.target.value })}
                              placeholder="Ej: Clienta referida por Camila..."
                              className="w-full p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Error & Success feedback */}
                      {manualError && (
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-700 font-medium">
                          {manualError}
                        </div>
                      )}
                      {manualSuccess && (
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800 space-y-2">
                          <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>{manualSuccess}</span>
                          </p>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setActiveTab('agenda')}
                              className="px-3 py-1 bg-emerald-700 text-white rounded-lg font-medium hover:bg-emerald-800 transition-colors text-[11px]"
                            >
                              Ver en la Agenda
                            </button>
                            <button
                              type="button"
                              onClick={() => setManualSuccess(null)}
                              className="px-3 py-1 bg-white text-emerald-800 border border-emerald-300 rounded-lg font-medium hover:bg-emerald-100 transition-colors text-[11px]"
                            >
                              Cargar otro turno
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Submit button */}
                      <button
                        type="submit"
                        disabled={isLoadingManualAvailability}
                        className="w-full py-3.5 rounded-2xl bg-[#8E4455] text-white text-sm font-semibold hover:bg-[#783645] transition-all cursor-pointer shadow-sm hover:shadow flex items-center justify-center gap-2"
                      >
                        <CalendarCheck className="w-4 h-4" />
                        <span>Guardar Turno en la Agenda</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 4: SERVICIOS Y PRECIOS */}
              {activeTab === 'servicios' && (
                <div className="space-y-6">
                  {serviceSuccessMsg && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-medium">{serviceSuccessMsg}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-serif text-2xl font-medium text-[#241E1A]">
                        Carta de Servicios y Valores
                      </h4>
                      <p className="text-xs text-[#7A6B62]">
                        Creá nuevos servicios, elegí su ícono, agregá características detalladas y actualizá precios en vivo.
                      </p>
                    </div>
                    <button
                      onClick={handleOpenCreateService}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#8E4455] text-white text-xs font-medium hover:bg-[#783645] transition-all cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Nuevo Servicio</span>
                    </button>
                  </div>

                  {/* Create / Edit Form Modal or Inline */}
                  {(isCreatingService || editingService) && (
                    <div ref={serviceFormRef} className="bg-white p-6 sm:p-7 rounded-3xl border-2 border-[#8E4455] shadow-lg scroll-mt-6">
                      <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#E8DCD5]">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#E8DCD5] flex items-center justify-center text-2xl shadow-xs">
                            {serviceForm.icono || '💅'}
                          </span>
                          <div>
                            <h5 className="font-serif text-lg font-medium text-[#241E1A]">
                              {editingService ? `Editar: ${editingService.nombre}` : 'Nuevo Servicio'}
                            </h5>
                            <span className="text-[11px] text-[#7A6B62]">
                              Completá los datos, seleccioná el ícono y personalizá las características.
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingService(false);
                            setEditingService(null);
                            setCustomFeatureInput('');
                          }}
                          className="p-1.5 rounded-xl text-[#7A6B62] hover:bg-[#FAF7F2]"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <form onSubmit={handleSaveService} className="space-y-5">
                        {/* Selector de Iconos / Motivos */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-semibold text-[#4A3E39]">
                              Seleccionar Ícono / Motivo del Servicio *
                            </label>
                            <span className="text-[11px] text-[#8E4455] font-medium">
                              Ícono actual: {serviceForm.icono}
                            </span>
                          </div>
                          
                          {/* Grid de motivos predefinidos */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-3">
                            {SERVICE_ICON_PRESETS.map((preset) => {
                              const isSelected = serviceForm.icono === preset.icon;
                              return (
                                <button
                                  key={preset.icon}
                                  type="button"
                                  onClick={() => setServiceForm({ ...serviceForm, icono: preset.icon })}
                                  className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#8E4455] text-white border-[#8E4455] shadow-sm scale-[1.02]'
                                      : 'bg-[#FAF7F2] text-[#4A3E39] border-[#E8DCD5] hover:border-[#8E4455]/50 hover:bg-white'
                                  }`}
                                >
                                  <span className="text-2xl leading-none">{preset.icon}</span>
                                  <span className={`text-[11px] font-medium leading-tight ${isSelected ? 'text-white' : 'text-[#241E1A]'}`}>
                                    {preset.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Personalizado opcional */}
                          <div className="flex items-center gap-3 bg-[#FAF7F2] p-2.5 rounded-xl border border-[#E8DCD5]">
                            <span className="text-xs text-[#7A6B62]">¿Querés otro emoji o símbolo?</span>
                            <input
                              type="text"
                              maxLength={4}
                              value={serviceForm.icono}
                              onChange={(e) => setServiceForm({ ...serviceForm, icono: e.target.value })}
                              placeholder="Ej: 💅"
                              className="w-16 p-1.5 text-center text-base rounded-lg bg-white border border-[#D9C9BF] text-[#241E1A]"
                            />
                            <span className="text-[11px] text-[#8C7A70]">Podés pegar cualquier emoji o motivo directamente.</span>
                          </div>
                        </div>

                        {/* Basic Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-[#4A3E39] mb-1">Nombre del Servicio *</label>
                            <input
                              type="text"
                              required
                              value={serviceForm.nombre}
                              onChange={(e) => setServiceForm({ ...serviceForm, nombre: e.target.value })}
                              placeholder="Ej: Kapping Gel con Nivelación Rusa"
                              className="w-full p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#4A3E39] mb-1">Categoría *</label>
                            <select
                              value={serviceForm.categoria}
                              onChange={(e) => setServiceForm({ ...serviceForm, categoria: e.target.value as any })}
                              className="w-full p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A]"
                            >
                              <option value="cuidado">Kapping & Cuidado</option>
                              <option value="esmaltado">Semipermanente</option>
                              <option value="esculpidas">Soft Gel & Esculpidas</option>
                              <option value="arte">Nail Art & Diseños</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#4A3E39] mb-1">Precio ($ ARS) *</label>
                            <input
                              type="number"
                              required
                              min={0}
                              step={500}
                              value={serviceForm.precio}
                              onChange={(e) => setServiceForm({ ...serviceForm, precio: Number(e.target.value) })}
                              className="w-full p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-[#4A3E39] mb-1">Duración (minutos) *</label>
                            <input
                              type="number"
                              required
                              step={15}
                              min={15}
                              max={240}
                              value={serviceForm.duracionMinutos}
                              onChange={(e) => setServiceForm({ ...serviceForm, duracionMinutos: Number(e.target.value) })}
                              className="w-full p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A]"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-[#4A3E39] mb-1">Descripción Breve</label>
                            <input
                              type="text"
                              value={serviceForm.descripcion}
                              onChange={(e) => setServiceForm({ ...serviceForm, descripcion: e.target.value })}
                              placeholder="Ej: Refuerzo en gel para uñas naturales que previene quiebres."
                              className="w-full p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A]"
                            />
                          </div>
                        </div>

                        {/* CARACTERÍSTICAS / DETALLES DEL SERVICIO */}
                        <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DCD5] space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="block text-xs font-semibold text-[#241E1A]">
                                Características del Servicio (Opcionales)
                              </label>
                              <p className="text-[11px] text-[#7A6B62]">
                                Se muestran con tilde verde en la tarjeta pública del servicio.
                              </p>
                            </div>
                            <span className="text-[11px] font-medium text-[#8E4455]">
                              {serviceForm.detalles.length} añadidas
                            </span>
                          </div>

                          {/* Lista de características actuales */}
                          {serviceForm.detalles.length > 0 && (
                            <div className="space-y-1.5">
                              {serviceForm.detalles.map((detalle, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-[#E8DCD5] text-xs text-[#241E1A]"
                                >
                                  <div className="flex items-center gap-2">
                                    <Check className="w-3.5 h-3.5 text-[#8E4455] shrink-0" />
                                    <span>{detalle}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...serviceForm.detalles];
                                      updated.splice(idx, 1);
                                      setServiceForm({ ...serviceForm, detalles: updated });
                                    }}
                                    className="p-1 rounded-lg text-[#8C7A70] hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    title="Quitar característica"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Campo para agregar característica personalizada */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={customFeatureInput}
                              onChange={(e) => setCustomFeatureInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (customFeatureInput.trim()) {
                                    setServiceForm({
                                      ...serviceForm,
                                      detalles: [...serviceForm.detalles, customFeatureInput.trim()]
                                    });
                                    setCustomFeatureInput('');
                                  }
                                }
                              }}
                              placeholder="Escribí una característica y hacé clic en Agregar..."
                              className="flex-1 p-2 rounded-xl bg-white border border-[#D9C9BF] text-xs text-[#241E1A]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (customFeatureInput.trim()) {
                                  setServiceForm({
                                    ...serviceForm,
                                    detalles: [...serviceForm.detalles, customFeatureInput.trim()]
                                  });
                                  setCustomFeatureInput('');
                                }
                              }}
                              className="px-3 py-2 rounded-xl bg-[#8E4455] text-white text-xs font-medium hover:bg-[#783645] transition-all cursor-pointer shrink-0"
                            >
                              + Agregar
                            </button>
                          </div>

                          {/* Presets de sugerencias rápidas */}
                          <div>
                            <span className="block text-[11px] text-[#8C7A70] mb-1.5">
                              Sugerencias rápidas (hacé clic para sumar):
                            </span>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                              {SERVICE_FEATURE_PRESETS.map((preset, idx) => {
                                const alreadyAdded = serviceForm.detalles.includes(preset);
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      if (alreadyAdded) {
                                        setServiceForm({
                                          ...serviceForm,
                                          detalles: serviceForm.detalles.filter(d => d !== preset)
                                        });
                                      } else {
                                        setServiceForm({
                                          ...serviceForm,
                                          detalles: [...serviceForm.detalles, preset]
                                        });
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer border text-left ${
                                      alreadyAdded
                                        ? 'bg-[#8E4455] text-white border-[#8E4455]'
                                        : 'bg-white text-[#5A4B43] border-[#E8DCD5] hover:border-[#8E4455]/50'
                                    }`}
                                  >
                                    {alreadyAdded ? '✓ ' : '+ '}
                                    {preset}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* ASIGNACIÓN DE PROFESIONALES HABILITADAS */}
                        <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DCD5] space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="block text-xs font-semibold text-[#241E1A]">
                                Profesionales Habilitadas para este Servicio
                              </label>
                              <p className="text-[11px] text-[#7A6B62]">
                                Definí si todas las profesionales realizan este tratamiento o únicamente profesionales específicas.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setServiceProfScope('todos');
                                setServiceSelectedProfIds(professionals.map(p => p.id));
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                                serviceProfScope === 'todos'
                                  ? 'bg-[#8E4455] text-white shadow-xs'
                                  : 'bg-white text-[#5A4B43] border border-[#E8DCD5]'
                              }`}
                            >
                              Todas las profesionales
                            </button>
                            <button
                              type="button"
                              onClick={() => setServiceProfScope('especificos')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                                serviceProfScope === 'especificos'
                                  ? 'bg-[#8E4455] text-white shadow-xs'
                                  : 'bg-white text-[#5A4B43] border border-[#E8DCD5]'
                              }`}
                            >
                              Seleccionar específicas ({serviceSelectedProfIds.length})
                            </button>
                          </div>

                          {serviceProfScope === 'especificos' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-[#E8DCD5]/60">
                              {professionals.map(p => {
                                const isChecked = serviceSelectedProfIds.includes(p.id);
                                return (
                                  <label
                                    key={p.id}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                      isChecked
                                        ? 'bg-rose-50/50 border-rose-300 text-[#8E4455]'
                                        : 'bg-white border-[#E8DCD5] text-[#5A4B43]'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setServiceSelectedProfIds(prev => [...prev, p.id]);
                                        } else {
                                          setServiceSelectedProfIds(prev => prev.filter(id => id !== p.id));
                                        }
                                      }}
                                      className="w-4 h-4 text-[#8E4455] rounded-md focus:ring-0"
                                    />
                                    <span className="font-medium">{p.nombre}</span>
                                    {p.especialidad && (
                                      <span className="text-[10px] text-[#8C7A70] truncate">({p.especialidad})</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-6 text-xs pt-1">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={serviceForm.esPopular}
                              onChange={(e) => setServiceForm({ ...serviceForm, esPopular: e.target.checked })}
                              className="w-4 h-4 text-[#8E4455] rounded-md focus:ring-0"
                            />
                            <span className="font-medium text-[#241E1A]">⭐ Destacar como "Más Elegido / Popular"</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={serviceForm.activo}
                              onChange={(e) => setServiceForm({ ...serviceForm, activo: e.target.checked })}
                              className="w-4 h-4 text-[#8E4455] rounded-md focus:ring-0"
                            />
                            <span className="font-medium text-[#241E1A]">✅ Visible para reservas públicas</span>
                          </label>
                        </div>

                        <div className="flex gap-2 justify-end pt-3 border-t border-[#E8DCD5]">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingService(false);
                              setEditingService(null);
                              setCustomFeatureInput('');
                            }}
                            className="px-4 py-2 rounded-xl text-xs text-[#5A4B43] hover:bg-[#FAF7F2] cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="px-6 py-2.5 rounded-xl bg-[#8E4455] text-white text-xs font-medium hover:bg-[#783645] transition-all cursor-pointer shadow-xs"
                          >
                            Guardar Servicio
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Services List Table */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map(srv => (
                      <div
                        key={srv.id}
                        className={`bg-white p-5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                          !srv.activo ? 'opacity-60 border-dashed border-[#D9C9BF]' : 'border-[#E8DCD5] shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-[#E8DCD5] flex items-center justify-center text-2xl shrink-0">
                            {srv.icono || '💅'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-serif font-medium text-base text-[#241E1A] truncate">
                                {srv.nombre}
                              </h5>
                              {srv.esPopular && (
                                <span className="text-[10px] bg-[#8E4455] text-white px-2 py-0.5 rounded-full font-bold">
                                  POPULAR
                                </span>
                              )}
                              {!srv.activo && (
                                <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                                  PAUSADO
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#7A6B62] mt-0.5">
                              {srv.duracionMinutos} min · <strong className="text-[#8E4455] font-semibold">${srv.precio.toLocaleString('es-AR')}</strong>
                            </p>
                            {srv.detalles && srv.detalles.length > 0 && (
                              <p className="text-[11px] text-[#8C7A70] truncate mt-1">
                                {srv.detalles.length} características incluidas
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleOpenEditService(srv)}
                            className="p-2 rounded-xl bg-[#FAF7F2] hover:bg-[#E8DCD5] text-[#5A4B43] transition-colors cursor-pointer"
                            title="Editar servicio"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setServiceToDelete({ id: srv.id, nombre: srv.nombre })}
                            className="p-2 rounded-xl text-[#C4B0A3] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Eliminar servicio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* MODAL CONFIRMACIÓN DE BORRADO DE SERVICIO */}
                  {serviceToDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
                      <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-[#E8DCD5] shadow-2xl space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
                          <Trash2 className="w-6 h-6" />
                        </div>
                        <div className="text-center space-y-1.5">
                          <h4 className="font-serif text-xl font-medium text-[#241E1A]">
                            ¿Eliminar servicio?
                          </h4>
                          <p className="text-xs text-[#7A6B62] leading-relaxed">
                            Estás a punto de eliminar <strong className="text-[#241E1A]">"{serviceToDelete.nombre}"</strong>. Esta acción quitará el servicio de la carta pública y no se puede deshacer.
                          </p>
                        </div>
                        <div className="flex gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => setServiceToDelete(null)}
                            className="flex-1 py-2.5 rounded-xl border border-[#D9C9BF] text-xs font-medium text-[#5A4B43] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={executeDeleteService}
                            className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition-colors cursor-pointer shadow-xs"
                          >
                            Sí, eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: PROMOCIONES */}
              {activeTab === 'promociones' && (
                <PromotionsManagementAdmin
                  services={services}
                  clients={[]}
                  onRefreshData={loadAdminData}
                  onAuthError={handleAuthError}
                />
              )}

              {/* TAB: PLANTILLAS DE BENEFICIOS (CATÁLOGO REUTILIZABLE) */}
              {activeTab === 'plantillas-beneficios' && (
                <BenefitTemplatesAdmin
                  services={services}
                  onAuthError={handleAuthError}
                />
              )}

              {/* TAB: BENEFICIOS INDIVIDUALES */}
              {activeTab === 'beneficios' && (
                <ClientBenefitsAdmin
                  services={services}
                  clients={[]}
                  onRefreshData={loadAdminData}
                  onAuthError={handleAuthError}
                />
              )}

              {/* TAB 5: MÉTRICAS */}
              {activeTab === 'stats' && stats && (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-[#E8DCD5]">
                      <span className="text-xs text-[#7A6B62] block mb-1">Turnos para Hoy</span>
                      <span className="font-serif text-3xl font-bold text-[#8E4455]">{stats.turnosHoy}</span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-[#E8DCD5]">
                      <span className="text-xs text-[#7A6B62] block mb-1">Turnos Pendientes</span>
                      <span className="font-serif text-3xl font-bold text-amber-600">{stats.turnosPendientes}</span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-[#E8DCD5]">
                      <span className="text-xs text-[#7A6B62] block mb-1">Completados Este Mes</span>
                      <span className="font-serif text-3xl font-bold text-emerald-600">{stats.turnosCompletadosMes}</span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-[#E8DCD5]">
                      <span className="text-xs text-[#7A6B62] block mb-1">Facturación Proyectada Mes</span>
                      <span className="font-serif text-3xl font-bold text-[#241E1A]">
                        ${stats.ingresosEstimadosMes.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  {/* Top Services ranking */}
                  <div className="bg-white p-6 rounded-3xl border border-[#E8DCD5]">
                    <h5 className="font-serif text-lg font-medium text-[#241E1A] mb-4">
                      Servicios Más Solicitados
                    </h5>
                    <div className="space-y-3">
                      {stats.serviciosMasPedidos.map((item, idx) => (
                        <div key={item.servicioId} className="flex items-center justify-between text-xs p-3 rounded-xl bg-[#FAF7F2]">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[#8E4455] w-5">#{idx + 1}</span>
                            <span className="font-medium text-[#241E1A]">{item.nombre}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className="text-[#7A6B62]">{item.cantidad} reservas</span>
                            <span className="font-bold text-[#241E1A]">${item.ingresos.toLocaleString('es-AR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Modal de Detalle del Turno */}
        <AppointmentDetailModal
          isOpen={!!selectedAppointmentForDetail}
          appointment={selectedAppointmentForDetail}
          allAppointments={appointments}
          onClose={() => setSelectedAppointmentForDetail(null)}
          onUpdateStatus={handleUpdateStatus}
          onDelete={executeDeleteAppointment}
          onSaveNotes={handleSaveNotesDirect}
          onOpenClientFicha={handleOpenClientFichaFromDetail}
        />

        {/* Modal de Cancelación de Turno (con motivo) */}
        {appointmentToCancel && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E8DCD5] shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                  <XCircle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h4 className="font-serif text-lg font-bold text-[#241E1A]">
                    ¿Cancelar este turno?
                  </h4>
                  <p className="text-xs text-[#7A6B62]">
                    Código: <span className="font-mono font-bold text-[#241E1A]">{appointmentToCancel.codigo}</span>
                  </p>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DCD5] text-xs text-[#5A4B43] space-y-1.5">
                <p>
                  Clienta: <strong className="text-[#241E1A]">{appointmentToCancel.nombre} {appointmentToCancel.apellido}</strong>
                </p>
                <p>
                  Servicio: <strong>{appointmentToCancel.servicioNombre}</strong>
                </p>
                <p>
                  Fecha y Hora: <strong>{isoDateToAR(appointmentToCancel.fecha)} a las {appointmentToCancel.horaInicio} hs</strong>
                </p>
                <p className="text-[#8E4455] font-medium pt-1">
                  ℹ️ El turno pasará a estado <strong>CANCELADO</strong>, se liberará el horario en la agenda y se enviará la notificación por email a la clienta.
                </p>
              </div>

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
                      onClick={() => setCancelModalReason(preset)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border text-left ${
                        cancelModalReason === preset
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
                  value={cancelModalReason}
                  onChange={(e) => setCancelModalReason(e.target.value)}
                  placeholder="Escribí el motivo de cancelación..."
                  className="w-full p-2.5 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455] resize-none mt-1"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isCancellingApt}
                  onClick={() => setAppointmentToCancel(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#7A6B62] hover:text-[#241E1A] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                >
                  Volver
                </button>
                <button
                  type="button"
                  disabled={isCancellingApt}
                  onClick={async () => {
                    if (!appointmentToCancel) return;
                    setIsCancellingApt(true);
                    try {
                      await handleUpdateStatus(appointmentToCancel.id, 'cancelado', {
                        motivo: cancelModalReason.trim() || 'Cancelado por administración',
                        origen: 'agenda',
                        canceladoPor: 'Administración'
                      });
                      setAppointmentToCancel(null);
                    } finally {
                      setIsCancellingApt(false);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isCancellingApt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Sí, cancelar turno</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmación de Eliminación de Turno */}
        {appointmentToDelete && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E8DCD5] shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h4 className="font-serif text-lg font-bold text-[#241E1A]">
                    ¿Eliminar registro definitivamente?
                  </h4>
                  <p className="text-xs text-[#7A6B62]">
                    Código: <span className="font-mono font-bold text-[#241E1A]">{appointmentToDelete.codigo}</span>
                  </p>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DCD5] text-xs text-[#5A4B43] space-y-1.5">
                <p>
                  Clienta: <strong className="text-[#241E1A]">{appointmentToDelete.nombre} {appointmentToDelete.apellido}</strong>
                </p>
                <p>
                  Servicio: <strong>{appointmentToDelete.servicioNombre}</strong>
                </p>
                <p>
                  Fecha y Hora: <strong>{isoDateToAR(appointmentToDelete.fecha)} a las {appointmentToDelete.horaInicio} hs</strong>
                </p>
                <p className="text-rose-700 font-semibold pt-1">
                  ⚠️ Esta acción borrará el registro de la base de datos de manera permanente e irreversible.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAppointmentToDelete(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#7A6B62] hover:text-[#241E1A] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => executeDeleteAppointment(appointmentToDelete)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sí, eliminar registro</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmación para Volver a Pendiente */}
        {appointmentToRevert && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E8DCD5] shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5 text-[#8E4455]" />
                </div>
                <div>
                  <h4 className="font-serif text-lg font-bold text-[#241E1A]">
                    {appointmentToRevert.isReactivating ? '¿Reactivar turno cancelado?' : '¿Volver turno a estado pendiente?'}
                  </h4>
                  <p className="text-xs text-[#7A6B62]">
                    Código: <span className="font-mono font-bold text-[#241E1A]">{appointmentToRevert.codigo}</span>
                  </p>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DCD5] text-xs text-[#5A4B43] space-y-1.5">
                <p>
                  Clienta: <strong className="text-[#241E1A]">{appointmentToRevert.nombre} {appointmentToRevert.apellido}</strong>
                </p>
                <p>
                  Estado actual: <strong className="capitalize">{appointmentToRevert.apt.estado}</strong>
                </p>
                <p className="text-[#8E4455] font-medium pt-1">
                  ℹ️ El turno volverá a figurar como <strong>PENDIENTE DE ATENCIÓN</strong> en la agenda del estudio.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAppointmentToRevert(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#7A6B62] hover:text-[#241E1A] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => executeRevertStatus(appointmentToRevert.apt, 'pendiente')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#8E4455] hover:bg-[#783645] shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sí, pasar a pendiente</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Feedback for Admin */}
        {adminToast && (
          <div className="fixed bottom-6 right-6 z-[150] bg-[#241E1A] text-white text-xs px-5 py-3.5 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-2.5 animate-bounce-short">
            <Sparkles className="w-4 h-4 text-[#C48B97]" />
            <span>{adminToast.message}</span>
          </div>
        )}

      </div>
    </div>
  );
};
