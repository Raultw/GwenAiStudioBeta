import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Calendar, 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  MessageCircle, 
  Edit3, 
  Trash2, 
  ArrowRight, 
  GitMerge, 
  Sparkles, 
  RefreshCw, 
  UserCheck, 
  UserPlus, 
  History, 
  X, 
  Check, 
  Tag, 
  CalendarPlus,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  AlertCircle,
  ShieldAlert,
  Heart,
  Sliders,
  Settings,
  Scissors,
  Lock
} from 'lucide-react';
import type { 
  Client, 
  DuplicatePair, 
  ClientStats, 
  Appointment, 
  Service,
  ClientAlert,
  ClientPreferences,
  ClientTipConfigItem,
  ClientWithFullProfile
} from '../types.js';
import { ClientAlertsSection } from './ClientAlertsSection.js';
import { ClientPreferencesSection } from './ClientPreferencesSection.js';
import { ClientTipsSection } from './ClientTipsSection.js';
import { 
  isoDateToAR, 
  formatDateLongAR 
} from '../utils/dateUtils.js';

interface ClientManagementAdminProps {
  services: Service[];
  onRefreshData?: () => void;
  onOpenNewBookingWithClient?: (client: Client) => void;
  initialClientLookup?: { id?: string; telefono?: string; nombre?: string; apellido?: string } | null;
  onClearInitialClientLookup?: () => void;
  hideDirectory?: boolean;
}

export const ClientManagementAdmin: React.FC<ClientManagementAdminProps> = ({
  services,
  onRefreshData,
  onOpenNewBookingWithClient,
  initialClientLookup,
  onClearInitialClientLookup,
  hideDirectory = false
}) => {
  // State
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [duplicatePairs, setDuplicatePairs] = useState<DuplicatePair[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Inactivity threshold configuration
  const [inactivityDays, setInactivityDays] = useState<number>(60);
  const [isEditingInactivity, setIsEditingInactivity] = useState<boolean>(false);
  const [tempInactivityInput, setTempInactivityInput] = useState<number>(60);
  const [isSavingInactivity, setIsSavingInactivity] = useState<boolean>(false);

  // Recurrent threshold configuration
  const [minRecurrentAppointments, setMinRecurrentAppointments] = useState<number>(2);
  const [isEditingRecurrent, setIsEditingRecurrent] = useState<boolean>(false);
  const [tempRecurrentInput, setTempRecurrentInput] = useState<number>(2);
  const [isSavingRecurrent, setIsSavingRecurrent] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'todos' | 'recurrentes' | 'nuevos' | 'inactivos' | 'proximos' | 'duplicados'>('todos');

  // Client Directory Pagination (10 per page max)
  const [clientPage, setClientPage] = useState<number>(1);
  const CLIENTS_PER_PAGE = 10;

  // Selected Client for Details / History Drawer
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAppointments, setClientAppointments] = useState<Appointment[]>([]);
  const [clientAlerts, setClientAlerts] = useState<ClientAlert[]>([]);
  const [clientPreferences, setClientPreferences] = useState<ClientPreferences | null>(null);
  const [clientTipsConfig, setClientTipsConfig] = useState<ClientTipConfigItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [drawerActiveTab, setDrawerActiveTab] = useState<'resumen' | 'alertas' | 'preferencias' | 'tips'>('resumen');

  // Full History Modal & Pagination
  const [showFullHistoryModal, setShowFullHistoryModal] = useState<boolean>(false);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const HISTORY_PAGE_SIZE = 10;

  // Edit / Notes Modal
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    notasAdmin: ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Manual New Client Modal
  const [isCreatingClient, setIsCreatingClient] = useState<boolean>(false);
  const [newClientForm, setNewClientForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    notasAdmin: ''
  });
  const [isSavingNew, setIsSavingNew] = useState<boolean>(false);

  // Duplicate Resolution Modal
  const [activeDuplicatePair, setActiveDuplicatePair] = useState<DuplicatePair | null>(null);
  const [primaryClientId, setPrimaryClientId] = useState<string>('');
  const [mergeNotes, setMergeNotes] = useState<string>('');
  const [isMerging, setIsMerging] = useState<boolean>(false);

  // Success / feedback banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch all clients, stats, and duplicates
  const loadClientData = async () => {
    setIsLoading(true);
    try {
      const [clientsRes, statsRes, dupesRes, configRes] = await Promise.all([
        fetch(`/api/clientes?category=${categoryFilter}&search=${encodeURIComponent(searchQuery)}`, { credentials: 'include' }),
        fetch('/api/clientes/stats', { credentials: 'include' }),
        fetch('/api/clientes/duplicados', { credentials: 'include' }),
        fetch('/api/config', { credentials: 'include' })
      ]);

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (dupesRes.ok) {
        const dupesData = await dupesRes.json();
        setDuplicatePairs(dupesData);
      }
      if (configRes.ok) {
        const configData = await configRes.json();
        const days = configData.diasInactividadCliente || 60;
        const minRecur = configData.minTurnosRecurrente || 2;
        setInactivityDays(days);
        setTempInactivityInput(days);
        setMinRecurrentAppointments(minRecur);
        setTempRecurrentInput(minRecur);
      }
    } catch (err) {
      console.error('Error loading client data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClientData();
  }, [categoryFilter]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadClientData();
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination on filter or search change
  useEffect(() => {
    setClientPage(1);
  }, [categoryFilter, searchQuery]);

  // Filter clients strictly with search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.trim().toLowerCase();
    const qNorm = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const qDigits = searchQuery.replace(/\D/g, '');
    return clients.filter(c => {
      const nom = (c.nombre || '').toLowerCase();
      const ape = (c.apellido || '').toLowerCase();
      const full = `${nom} ${ape}`;
      const nomNorm = (c.nombreNormalizado || '').toLowerCase();
      const apeNorm = (c.apellidoNormalizado || '').toLowerCase();
      const fullNorm = `${nomNorm} ${apeNorm}`;
      const tel = (c.telefono || '').toLowerCase();
      const telNorm = (c.telefonoNormalizado || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const notas = (c.notasAdmin || '').toLowerCase();

      return (
        nom.includes(q) ||
        ape.includes(q) ||
        full.includes(q) ||
        nomNorm.includes(qNorm) ||
        apeNorm.includes(qNorm) ||
        fullNorm.includes(qNorm) ||
        tel.includes(q) ||
        (qDigits.length >= 3 && telNorm.includes(qDigits)) ||
        email.includes(q) ||
        notas.includes(q)
      );
    });
  }, [clients, searchQuery]);

  const totalClientPages = Math.ceil(filteredClients.length / CLIENTS_PER_PAGE) || 1;
  const paginatedClients = useMemo(() => {
    const startIdx = (clientPage - 1) * CLIENTS_PER_PAGE;
    return filteredClients.slice(startIdx, startIdx + CLIENTS_PER_PAGE);
  }, [filteredClients, clientPage]);

  // Handle Initial Client Lookup when navigating directly from Turnos list
  useEffect(() => {
    if (!initialClientLookup) return;
    
    const lookupAndOpen = async () => {
      let found: Client | undefined;
      if (initialClientLookup.id) {
        found = clients.find(c => c.id === initialClientLookup.id);
      }
      if (!found && initialClientLookup.telefono) {
        const normTel = initialClientLookup.telefono.replace(/[^0-9]/g, '');
        found = clients.find(c => c.telefonoNormalizado.includes(normTel) || normTel.includes(c.telefonoNormalizado));
      }
      if (!found && initialClientLookup.nombre) {
        const normNom = `${initialClientLookup.nombre} ${initialClientLookup.apellido || ''}`.toLowerCase().trim();
        found = clients.find(c => `${c.nombre} ${c.apellido}`.toLowerCase().includes(normNom));
      }

      if (found) {
        handleOpenClientDetails(found);
        if (onClearInitialClientLookup) onClearInitialClientLookup();
      } else if (initialClientLookup.id) {
        try {
          const res = await fetch(`/api/clientes/${initialClientLookup.id}`, { credentials: 'include' });
          if (res.ok) {
            const data: ClientWithFullProfile = await res.json();
            if (data.client) {
              handleOpenClientDetails(data.client);
              if (onClearInitialClientLookup) onClearInitialClientLookup();
            }
          }
        } catch (err) {
          console.error('Error fetching client by ID in lookup:', err);
        }
      }
    };

    lookupAndOpen();
  }, [initialClientLookup, clients]);

  // Save Inactivity Days Threshold
  const handleSaveInactivityDays = async () => {
    if (tempInactivityInput < 1 || tempInactivityInput > 365) {
      showToast('Por favor ingresá un número de días válido entre 1 y 365.');
      return;
    }

    setIsSavingInactivity(true);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ diasInactividadCliente: Number(tempInactivityInput) })
      });

      if (res.ok) {
        setInactivityDays(Number(tempInactivityInput));
        setIsEditingInactivity(false);
        showToast(`Criterio de inactividad actualizado a ${tempInactivityInput} días.`);
        loadClientData();
      } else {
        showToast('Error al actualizar criterio de inactividad.');
      }
    } catch (err) {
      console.error('Error saving inactivity days:', err);
      showToast('Error de conexión.');
    } finally {
      setIsSavingInactivity(false);
    }
  };

  // Save Recurrent Min Appointments Threshold
  const handleSaveRecurrentMin = async () => {
    if (tempRecurrentInput < 1 || tempRecurrentInput > 50) {
      showToast('Por favor ingresá un valor válido entre 1 y 50.');
      return;
    }

    setIsSavingRecurrent(true);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ minTurnosRecurrente: Number(tempRecurrentInput) })
      });

      if (res.ok) {
        setMinRecurrentAppointments(Number(tempRecurrentInput));
        setIsEditingRecurrent(false);
        showToast(`Criterio de recurrentes actualizado a ${tempRecurrentInput} o más turnos.`);
        loadClientData();
      } else {
        showToast('Error al actualizar criterio de recurrentes.');
      }
    } catch (err) {
      console.error('Error saving minRecurrentAppointments:', err);
      showToast('Error de conexión.');
    } finally {
      setIsSavingRecurrent(false);
    }
  };

  const isClientInactive = (client: Client): boolean => {
    if (!client.fechaUltimaVisita) return true;
    const diff = (Date.now() - new Date(client.fechaUltimaVisita).getTime()) / (1000 * 60 * 60 * 24);
    return diff >= inactivityDays;
  };

  // Open Client Details Drawer & fetch full history, alerts, prefs & tips
  const handleOpenClientDetails = async (client: Client, initialTab: 'resumen' | 'alertas' | 'preferencias' | 'tips' = 'resumen') => {
    setSelectedClient(client);
    setDrawerActiveTab(initialTab);
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/clientes/${client.id}`, { credentials: 'include' });
      if (res.ok) {
        const data: ClientWithFullProfile = await res.json();
        setSelectedClient(data.client);
        setClientAppointments(data.appointments || []);
        setClientAlerts(data.alerts || []);
        setClientPreferences(data.preferences || null);
        setClientTipsConfig(data.tipsConfig || []);
      }
    } catch (err) {
      console.error('Error fetching client details:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleRefreshCurrentClientProfile = async () => {
    if (!selectedClient) return;
    try {
      const res = await fetch(`/api/clientes/${selectedClient.id}`, { credentials: 'include' });
      if (res.ok) {
        const data: ClientWithFullProfile = await res.json();
        setSelectedClient(data.client);
        setClientAppointments(data.appointments || []);
        setClientAlerts(data.alerts || []);
        setClientPreferences(data.preferences || null);
        setClientTipsConfig(data.tipsConfig || []);
      }
    } catch (err) {
      console.error('Error refreshing client profile:', err);
    }
  };

  // Normalization helper
  const normalizePerson = (str: string = ''): string => {
    return String(str || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ');
  };

  // Appointments sorted descending (newest first)
  const sortedAppointments = useMemo(() => {
    return [...clientAppointments].sort((a, b) => {
      const dateDiff = (b.fecha || '').localeCompare(a.fecha || '');
      if (dateDiff !== 0) return dateDiff;
      return (b.horaInicio || '').localeCompare(a.horaInicio || '');
    });
  }, [clientAppointments]);

  const totalHistoryPages = Math.ceil(sortedAppointments.length / HISTORY_PAGE_SIZE) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return sortedAppointments.slice(start, start + HISTORY_PAGE_SIZE);
  }, [sortedAppointments, historyPage]);

  // Open Edit Client Modal
  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setEditForm({
      nombre: client.nombre,
      apellido: client.apellido,
      telefono: client.telefono,
      email: client.email || '',
      notasAdmin: client.notasAdmin || ''
    });
  };

  // Save Edit Client
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    const payload = {
      ...editForm,
      nombre: normalizePerson(editForm.nombre),
      apellido: normalizePerson(editForm.apellido),
      email: editForm.email ? String(editForm.email).trim().toLowerCase() : ''
    };

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/clientes/${editingClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Datos de clienta actualizados con éxito.');
        setEditingClient(null);
        loadClientData();
        if (selectedClient && selectedClient.id === editingClient.id) {
          handleOpenClientDetails({ ...selectedClient, ...payload });
        }
      } else {
        const err = await res.json();
        showToast(err.error || 'Error al actualizar');
      }
    } catch (err) {
      console.error('Error updating client:', err);
      showToast('Error al conectar con el servidor.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Save New Manual Client
  const handleSaveNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...newClientForm,
      nombre: normalizePerson(newClientForm.nombre),
      apellido: normalizePerson(newClientForm.apellido),
      email: newClientForm.email ? String(newClientForm.email).trim().toLowerCase() : ''
    };

    setIsSavingNew(true);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const created = await res.json();
        showToast(`Clienta ${created.nombre} ${created.apellido} registrada correctamente.`);
        setIsCreatingClient(false);
        setNewClientForm({
          nombre: '',
          apellido: '',
          telefono: '',
          email: '',
          notasAdmin: ''
        });
        loadClientData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Error al crear clienta');
      }
    } catch (err) {
      console.error('Error creating client:', err);
      showToast('Error al conectar con el servidor.');
    } finally {
      setIsSavingNew(false);
    }
  };

  // Open Duplicate Merge Modal
  const handleOpenDuplicateMerge = (pair: DuplicatePair) => {
    setActiveDuplicatePair(pair);
    // Suggest the client with more appointments as primary
    const countA = pair.turnosA?.length || pair.clienteA.totalTurnos || 0;
    const countB = pair.turnosB?.length || pair.clienteB.totalTurnos || 0;
    setPrimaryClientId(countA >= countB ? pair.clienteA.id : pair.clienteB.id);
    setMergeNotes('');
  };

  // Confirm Merge
  const handleConfirmMerge = async () => {
    if (!activeDuplicatePair || !primaryClientId) return;
    const secondaryId = primaryClientId === activeDuplicatePair.clienteA.id
      ? activeDuplicatePair.clienteB.id
      : activeDuplicatePair.clienteA.id;

    setIsMerging(true);
    try {
      const res = await fetch('/api/clientes/fusionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          primaryId: primaryClientId,
          secondaryId,
          adminNotes: mergeNotes || undefined
        })
      });

      if (res.ok) {
        showToast('¡Perfiles fusionados e historial unificado exitosamente!');
        setActiveDuplicatePair(null);
        loadClientData();
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Error al fusionar');
      }
    } catch (err) {
      console.error('Error merging clients:', err);
      showToast('Error al conectar con el servidor.');
    } finally {
      setIsMerging(false);
    }
  };

  // Dismiss Duplicate Alert
  const handleDismissDuplicate = async (pair: DuplicatePair) => {
    try {
      const res = await fetch('/api/clientes/descartar-duplicado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          idA: pair.clienteA.id,
          idB: pair.clienteB.id
        })
      });

      if (res.ok) {
        showToast('Alerta de duplicado descartada.');
        loadClientData();
      }
    } catch (err) {
      console.error('Error dismissing duplicate:', err);
    }
  };

  // Helpers
  const formatClienteDesdeDate = (iso?: string) => {
    if (!iso) return 'Fecha no registrada';
    return formatDateLongAR(iso);
  };

  const formatDateFriendly = (iso?: string) => {
    if (!iso) return 'Sin visitas';
    return isoDateToAR(iso);
  };

  const getInitials = (nombre: string, apellido: string) => {
    return `${nombre.charAt(0) || ''}${apellido.charAt(0) || ''}`.toUpperCase();
  };

  const activeAlertsCountInDrawer = clientAlerts.filter(a => a.activa).length;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Toast Feedback - High z-index to always stay above modals & drawers */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] bg-[#241E1A] text-white text-xs px-4 py-3 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-2 animate-bounce-short">
          <Sparkles className="w-4 h-4 text-[#C48B97]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Directory UI (hidden when hideDirectory is true, e.g. when opening ficha from Agenda) */}
      {!hideDirectory && (
        <>
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#FAF7F2] to-white p-6 rounded-3xl border border-[#E8DCD5] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-9 h-9 rounded-xl bg-[#8E4455] text-white flex items-center justify-center shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl font-bold text-[#241E1A]">
                  Directorio Unificado de Clientas
                </h3>
              </div>
          <p className="text-xs text-[#7A6B62] max-w-xl">
            Historial de turnos, alertas sanitarias, preferencias estéticas y talles de Soft Gel asociados automáticamente a cada persona.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreatingClient(true)}
            className="px-4 py-2.5 rounded-2xl bg-[#8E4455] text-white text-xs font-semibold hover:bg-[#783746] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Registrar Clienta</span>
          </button>

          <button
            onClick={loadClientData}
            title="Refrescar base de clientes"
            className="p-2.5 rounded-2xl bg-[#FAF7F2] hover:bg-[#E8DCD5] text-[#5C4D44] border border-[#D9C9BF] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards & Inactivity Threshold Setting */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-[#E8DCD5]">
          <div className="flex items-center justify-between text-[#8C7A70] text-xs font-medium mb-1">
            <span>Total Clientas</span>
            <Users className="w-4 h-4 text-[#8E4455]" />
          </div>
          <p className="text-2xl font-serif font-bold text-[#241E1A]">
            {stats ? stats.totalClientes : '...'}
          </p>
          <span className="text-[10px] text-[#7A6B62]">Perfiles únicos</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8DCD5] relative group">
          <div className="flex items-center justify-between text-[#8C7A70] text-xs font-medium mb-1">
            <span>Recurrentes</span>
            <div className="flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <button
                onClick={() => setIsEditingRecurrent(!isEditingRecurrent)}
                title="Editar umbral de turnos para recurrentes"
                className="text-[#8C7A70] hover:text-[#8E4455] p-0.5 rounded transition-colors"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          </div>
          <p className="text-2xl font-serif font-bold text-emerald-700">
            {stats ? stats.clientesRecurrentes : '...'}
          </p>
          {!isEditingRecurrent ? (
            <div className="flex items-center justify-between text-[10px] text-emerald-700 mt-0.5">
              <span>{`${minRecurrentAppointments} o más turnos`}</span>
              <button
                onClick={() => setIsEditingRecurrent(true)}
                className="underline text-[10px] text-[#8E4455] font-semibold hover:text-[#783746]"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="mt-1 space-y-1 bg-[#FAF7F2] p-2 rounded-xl border border-[#E8DCD5] animate-fade-in">
              <span className="text-[9px] uppercase font-bold text-[#8C7A70] block">Mínimo turnos:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={tempRecurrentInput}
                  onChange={(e) => setTempRecurrentInput(Number(e.target.value))}
                  className="w-14 px-1.5 py-0.5 text-xs font-bold text-[#241E1A] bg-white border border-[#D9C9BF] rounded-md focus:outline-none focus:border-[#8E4455]"
                />
                <button
                  onClick={handleSaveRecurrentMin}
                  disabled={isSavingRecurrent}
                  className="px-2 py-0.5 bg-[#8E4455] text-white text-[10px] font-bold rounded-md hover:bg-[#783746]"
                >
                  OK
                </button>
                <button
                  onClick={() => {
                    setIsEditingRecurrent(false);
                    setTempRecurrentInput(minRecurrentAppointments);
                  }}
                  className="px-1.5 py-0.5 text-[#7A6B62] text-[10px] hover:text-[#241E1A]"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8DCD5]">
          <div className="flex items-center justify-between text-[#8C7A70] text-xs font-medium mb-1">
            <span>Nuevas (30d)</span>
            <UserCheck className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-serif font-bold text-[#241E1A]">
            {stats ? stats.clientesNuevos : '...'}
          </p>
          <span className="text-[10px] text-[#7A6B62]">Primer atención</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8DCD5]">
          <div className="flex items-center justify-between text-[#8C7A70] text-xs font-medium mb-1">
            <span>Con Próximo Turno</span>
            <Calendar className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-serif font-bold text-[#241E1A]">
            {stats ? stats.clientesConProximosTurnos : '...'}
          </p>
          <span className="text-[10px] text-[#7A6B62]">Turnos agendados</span>
        </div>

        {/* Inactivity KPI with Configurable Days Editor */}
        <div className="bg-white p-4 rounded-2xl border border-[#E8DCD5] relative group">
          <div className="flex items-center justify-between text-[#8C7A70] text-xs font-medium mb-1">
            <span>Inactivas</span>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-rose-400" />
              <button
                onClick={() => setIsEditingInactivity(!isEditingInactivity)}
                title="Editar umbral de días de inactividad"
                className="text-[#8C7A70] hover:text-[#8E4455] p-0.5 rounded transition-colors"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <p className="text-2xl font-serif font-bold text-[#241E1A]">
            {stats ? stats.clientesInactivos : '...'}
          </p>

          {!isEditingInactivity ? (
            <div className="flex items-center justify-between text-[10px] text-rose-600 mt-0.5">
              <span>{`>${inactivityDays}d sin visitar`}</span>
              <button
                onClick={() => setIsEditingInactivity(true)}
                className="underline text-[10px] text-[#8E4455] font-semibold hover:text-[#783746]"
              >
                Cambiar días
              </button>
            </div>
          ) : (
            <div className="mt-1 space-y-1 bg-[#FAF7F2] p-2 rounded-xl border border-[#E8DCD5] animate-fade-in">
              <span className="text-[9px] uppercase font-bold text-[#8C7A70] block">Días de inactividad:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={tempInactivityInput}
                  onChange={(e) => setTempInactivityInput(Number(e.target.value))}
                  className="w-14 px-1.5 py-0.5 text-xs font-bold text-[#241E1A] bg-white border border-[#D9C9BF] rounded-md focus:outline-none focus:border-[#8E4455]"
                />
                <button
                  onClick={handleSaveInactivityDays}
                  disabled={isSavingInactivity}
                  className="px-2 py-0.5 bg-[#8E4455] text-white text-[10px] font-bold rounded-md hover:bg-[#783746]"
                >
                  OK
                </button>
                <button
                  onClick={() => {
                    setTempInactivityInput(inactivityDays);
                    setIsEditingInactivity(false);
                  }}
                  className="text-[10px] text-[#7A6B62] hover:text-[#241E1A] px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`p-4 rounded-2xl border transition-all ${
          (stats?.duplicadosPendientes || 0) > 0 
            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20' 
            : 'bg-white border-[#E8DCD5]'
        }`}>
          <div className="flex items-center justify-between text-amber-700 text-xs font-medium mb-1">
            <span>Duplicados</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-amber-900">
            {stats ? stats.duplicadosPendientes : '...'}
          </p>
          <button 
            onClick={() => setCategoryFilter('duplicados')}
            className="text-[10px] font-semibold text-amber-700 hover:underline flex items-center gap-0.5"
          >
            Revisar alertas →
          </button>
        </div>

      </div>

      {/* Duplicate Alert Banner if pending */}
      {duplicatePairs.length > 0 && categoryFilter !== 'duplicados' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-900">
                Se detectaron {duplicatePairs.length} posibles perfiles duplicados
              </h4>
              <p className="text-xs text-amber-700">
                Personas con nombres idénticos o teléfonos similares que podrían ser la misma clienta.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCategoryFilter('duplicados')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            Ver y Fusionar ({duplicatePairs.length})
          </button>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E8DCD5] flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8C7A70] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, apellido, teléfono, email o nota privada..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs sm:text-sm text-[#241E1A] placeholder-[#A6978E] focus:outline-none focus:border-[#8E4455] focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C7A70] hover:text-[#241E1A]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'todos', label: 'Todos', count: stats?.totalClientes },
            { id: 'recurrentes', label: 'Recurrentes', count: stats?.clientesRecurrentes },
            { id: 'nuevos', label: 'Nuevos', count: stats?.clientesNuevos },
            { id: 'inactivos', label: `Inactivos (>${inactivityDays}d)`, count: stats?.clientesInactivos },
            { id: 'proximos', label: 'Con Turno', count: stats?.clientesConProximosTurnos },
            { id: 'duplicados', label: 'Duplicados', count: stats?.duplicadosPendientes }
          ].map((cat) => {
            const isActive = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#8E4455] text-white shadow-xs'
                    : 'bg-[#FAF7F2] text-[#5C4D44] border border-[#E8DCD5] hover:bg-white hover:text-[#241E1A]'
                }`}
              >
                <span>{cat.label}</span>
                {cat.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#E8DCD5] text-[#4A3E39]'
                  }`}>
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Content Area */}
      {categoryFilter === 'duplicados' ? (
        /* ================= DUPLICATE COMPARISON VIEW ================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-serif text-lg font-medium text-[#241E1A] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Comparativa de Posibles Duplicados ({duplicatePairs.length})
            </h4>
            <button
              onClick={() => setCategoryFilter('todos')}
              className="text-xs text-[#8E4455] font-semibold hover:underline cursor-pointer"
            >
              Volver a todas las clientas
            </button>
          </div>

          {duplicatePairs.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-[#E8DCD5] text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h5 className="font-medium text-[#241E1A] text-sm">¡Base de clientes impecable!</h5>
              <p className="text-xs text-[#7A6B62] mt-1 max-w-sm mx-auto">
                No hay coincidencias dudosas pendientes de revisión. El motor de normalización mantiene los historiales limpios.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicatePairs.map((pair) => (
                <div 
                  key={pair.id}
                  className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden"
                >
                  <div className="bg-amber-50/80 px-5 py-3 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-800 text-[11px] font-bold">
                        {pair.confianza}% Coincidencia
                      </span>
                      <span className="text-xs text-amber-900 font-medium">
                        {pair.motivo}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDismissDuplicate(pair)}
                        className="px-3 py-1 text-xs text-[#7A6B62] hover:text-[#241E1A] hover:bg-white rounded-lg border border-[#D9C9BF] transition-colors cursor-pointer"
                      >
                        Son diferentes
                      </button>
                      <button
                        onClick={() => handleOpenDuplicateMerge(pair)}
                        className="px-3.5 py-1 text-xs font-semibold bg-[#8E4455] text-white hover:bg-[#783746] rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        Fusionar perfiles
                      </button>
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-[#E8DCD5]">
                    
                    {/* Perfil A */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#D9C9BF] flex items-center justify-center font-serif font-bold text-[#8E4455]">
                            {getInitials(pair.clienteA.nombre, pair.clienteA.apellido)}
                          </div>
                          <div>
                            <h5 className="font-serif font-semibold text-[#241E1A]">
                              {pair.clienteA.nombre} {pair.clienteA.apellido}
                            </h5>
                            <p className="text-[11px] text-[#7A6B62]">
                              Alta: {formatDateFriendly(pair.clienteA.fechaAlta)}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-[#8E4455] bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                          {pair.turnosA?.length || pair.clienteA.totalTurnos || 0} turnos
                        </span>
                      </div>

                      <div className="text-xs space-y-1.5 text-[#5C4D44] bg-[#FAF7F2] p-3 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-[#8C7A70]" />
                          <span className="font-mono font-medium">{pair.clienteA.telefono}</span>
                        </div>
                        {pair.clienteA.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-[#8C7A70]" />
                            <span>{pair.clienteA.email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-[#8C7A70]" />
                          <span>Última visita: {formatDateFriendly(pair.clienteA.fechaUltimaVisita)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Perfil B */}
                    <div className="space-y-3 pt-4 md:pt-0 md:pl-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#D9C9BF] flex items-center justify-center font-serif font-bold text-[#8E4455]">
                            {getInitials(pair.clienteB.nombre, pair.clienteB.apellido)}
                          </div>
                          <div>
                            <h5 className="font-serif font-semibold text-[#241E1A]">
                              {pair.clienteB.nombre} {pair.clienteB.apellido}
                            </h5>
                            <p className="text-[11px] text-[#7A6B62]">
                              Alta: {formatDateFriendly(pair.clienteB.fechaAlta)}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-[#8E4455] bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                          {pair.turnosB?.length || pair.clienteB.totalTurnos || 0} turnos
                        </span>
                      </div>

                      <div className="text-xs space-y-1.5 text-[#5C4D44] bg-[#FAF7F2] p-3 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-[#8C7A70]" />
                          <span className="font-mono font-medium">{pair.clienteB.telefono}</span>
                        </div>
                        {pair.clienteB.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-[#8C7A70]" />
                            <span>{pair.clienteB.email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-[#8C7A70]" />
                          <span>Última visita: {formatDateFriendly(pair.clienteB.fechaUltimaVisita)}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ================= CLIENT LIST TABLE & CARDS ================= */
        <div className="bg-white rounded-2xl border border-[#E8DCD5] shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-[#7A6B62]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#8E4455] mb-2" />
              <p className="text-sm">Buscando clientas...</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-[#D9C9BF] mx-auto mb-3" />
              <h4 className="font-serif font-medium text-[#241E1A] text-base">
                {searchQuery.trim() ? 'No existe ninguna clienta que coincida con la búsqueda' : 'No se encontraron clientas'}
              </h4>
              <p className="text-xs text-[#7A6B62] mt-1 max-w-sm mx-auto">
                {searchQuery.trim()
                  ? `No hay registros coincidentes para "${searchQuery.trim()}".`
                  : 'No hay coincidencias para la categoría seleccionada.'}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-[#E8DCD5]">
                {paginatedClients.map((client) => {
                  const isRecurrent = (client.totalTurnos || 0) >= minRecurrentAppointments;
                  const hasUpcoming = Boolean(client.proximoTurno);
                  const hasDuplicateWarning = Boolean(client.posibleDuplicadoDe && client.posibleDuplicadoDe.length > 0 && !client.duplicadoRevisado);
                  const hasActiveAlerts = (client.alertasActivasCount || 0) > 0;

                  return (
                    <div
                      key={client.id}
                      className="p-4 sm:p-5 hover:bg-[#FAF7F2]/60 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      {/* Left: Avatar & Info */}
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#8E4455]/15 to-[#8E4455]/5 border border-[#8E4455]/20 flex items-center justify-center font-serif font-bold text-[#8E4455] shrink-0 text-sm">
                          {getInitials(client.nombre, client.apellido)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 
                              onClick={() => handleOpenClientDetails(client)}
                              className="font-serif text-base font-semibold text-[#241E1A] hover:text-[#8E4455] cursor-pointer transition-colors"
                            >
                              {client.nombre} {client.apellido}
                            </h4>

                            {/* Badges */}
                            {isRecurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                ⭐ Recurrente ({client.totalTurnos})
                              </span>
                            )}
                            {!isRecurrent && (client.totalTurnos || 0) === 1 && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-200">
                                1 Turno
                              </span>
                            )}
                            {(client.totalTurnos || 0) === 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-medium">
                                Nueva
                              </span>
                            )}
                            {hasActiveAlerts && (
                              <span 
                                onClick={() => handleOpenClientDetails(client, 'alertas')}
                                className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-300 flex items-center gap-1 cursor-pointer hover:bg-rose-200 transition-colors"
                                title="Ver alertas sanitarias"
                              >
                                <ShieldAlert className="w-3 h-3 text-rose-600" />
                                Alerta Activa ({client.alertasActivasCount})
                              </span>
                            )}
                            {hasUpcoming && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-semibold border border-purple-200 flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />
                                Próx: {formatDateFriendly(client.proximoTurno)} ({client.proximoTurnoHora} hs)
                              </span>
                            )}
                            {hasDuplicateWarning && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300 flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Duda Duplicado
                              </span>
                            )}
                          </div>

                          {/* Contact details */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[#7A6B62]">
                            <a 
                              href={`https://wa.me/${client.telefonoNormalizado || client.telefono.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 hover:text-emerald-700 font-mono font-medium"
                            >
                              <Phone className="w-3 h-3 text-[#8C7A70]" />
                              <span>{client.telefono}</span>
                            </a>

                            {client.email && (
                              <span className="inline-flex items-center gap-1 text-[#8C7A70]">
                                <Mail className="w-3 h-3" />
                                <span className="truncate max-w-[180px]">{client.email}</span>
                              </span>
                            )}

                            <span className="inline-flex items-center gap-1 text-[#8C7A70]">
                              <Clock className="w-3 h-3" />
                              <span>Última visita: {formatDateFriendly(client.fechaUltimaVisita)}</span>
                            </span>
                          </div>

                          {/* Admin note snippet */}
                          {client.notasAdmin && (
                            <p className="text-[11px] text-amber-900 bg-amber-50/70 px-2 py-0.5 rounded-md mt-1.5 line-clamp-1 border border-amber-200/50">
                              📝 {client.notasAdmin}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Metrics & Actions */}
                      <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#FAF7F2]">
                        <div className="text-left lg:text-right">
                          <div className="text-xs font-bold text-[#8E4455]">
                            ${(client.totalGastado || 0).toLocaleString('es-AR')}
                          </div>
                          <div className="text-[10px] text-[#8C7A70]">
                            {client.totalTurnos || 0} turnos totales
                          </div>
                        </div>

                        {/* Agendar turno button */}
                        {onOpenNewBookingWithClient && (
                          <button
                            onClick={() => onOpenNewBookingWithClient(client)}
                            className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                            title="Agendar nuevo turno para esta clienta"
                          >
                            <CalendarPlus className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit button */}
                        <button
                          onClick={() => handleOpenEdit(client)}
                          className="p-2 rounded-xl bg-[#FAF7F2] text-[#4A3E39] border border-[#D9C9BF] hover:bg-white transition-colors"
                          title="Editar datos de clienta"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Full Profile Details Button */}
                        <button
                          onClick={() => handleOpenClientDetails(client)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#8E4455] hover:text-white text-[#4A3E39] border border-[#D9C9BF] text-xs font-medium transition-all cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Ficha Completa</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls (Max 10 per page) */}
              {clients.length > 0 && (
                <div className="p-4 bg-[#FAF7F2]/80 border-t border-[#E8DCD5] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="text-[#7A6B62] font-medium">
                    Mostrando <span className="font-bold text-[#241E1A]">{(clientPage - 1) * CLIENTS_PER_PAGE + 1}</span> a <span className="font-bold text-[#241E1A]">{Math.min(clientPage * CLIENTS_PER_PAGE, clients.length)}</span> de <span className="font-bold text-[#241E1A]">{clients.length}</span> clientas
                  </div>

                  {totalClientPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={clientPage === 1}
                        onClick={() => setClientPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-xl border border-[#D9C9BF] bg-white text-[#241E1A] font-medium hover:bg-[#F0E6DE] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Anterior</span>
                      </button>

                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalClientPages }, (_, i) => i + 1).map((pageNum) => {
                          if (
                            pageNum === 1 || 
                            pageNum === totalClientPages || 
                            (pageNum >= clientPage - 1 && pageNum <= clientPage + 1)
                          ) {
                            return (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setClientPage(pageNum)}
                                className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  clientPage === pageNum
                                    ? 'bg-[#8E4455] text-white shadow-xs'
                                    : 'bg-white text-[#5A4B43] border border-[#E8DCD5] hover:bg-[#F0E6DE]'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          }
                          if (
                            (pageNum === 2 && clientPage > 3) || 
                            (pageNum === totalClientPages - 1 && clientPage < totalClientPages - 2)
                          ) {
                            return <span key={pageNum} className="text-[#A8988F] px-0.5">...</span>;
                          }
                          return null;
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={clientPage === totalClientPages}
                        onClick={() => setClientPage(p => Math.min(totalClientPages, p + 1))}
                        className="px-3 py-1.5 rounded-xl border border-[#D9C9BF] bg-white text-[#241E1A] font-medium hover:bg-[#F0E6DE] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <span>Siguiente</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
        </>
      )}

      {/* ================= MODAL: CLIENT FULL DETAILS DRAWER ================= */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[#E8DCD5] shadow-2xl animate-fade-in">
            
            {/* Drawer Header */}
            <div className="bg-gradient-to-r from-[#FAF7F2] to-white p-6 border-b border-[#E8DCD5] flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#8E4455] text-white flex items-center justify-center font-serif font-bold text-lg shadow-xs shrink-0">
                  {getInitials(selectedClient.nombre, selectedClient.apellido)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-xl font-bold text-[#241E1A]">
                      {selectedClient.nombre} {selectedClient.apellido}
                    </h3>
                    {(selectedClient.totalTurnos || 0) >= minRecurrentAppointments && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Recurrente
                      </span>
                    )}
                    {activeAlertsCountInDrawer > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1 border border-rose-300">
                        <ShieldAlert className="w-3 h-3" />
                        {activeAlertsCountInDrawer} {activeAlertsCountInDrawer === 1 ? 'Alerta activa' : 'Alertas activas'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#7A6B62] mt-0.5">
                    Cliente desde <span className="font-medium text-[#241E1A]">{formatClienteDesdeDate(selectedClient.fechaAlta)}</span> • ID: <span className="font-mono text-[10px]">{selectedClient.id.slice(0, 8)}...</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedClient(null)}
                className="p-2 rounded-xl text-[#7A6B62] hover:bg-[#E8DCD5]/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented Navigation Tabs */}
            <div className="bg-[#FAF7F2] px-6 py-2.5 border-b border-[#E8DCD5] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              <button
                type="button"
                onClick={() => setDrawerActiveTab('resumen')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                  drawerActiveTab === 'resumen'
                    ? 'bg-white text-[#8E4455] border-[#D9C9BF] shadow-xs font-bold'
                    : 'text-[#7A6B62] border-transparent hover:text-[#241E1A] hover:bg-white/60'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Resumen & Turnos ({clientAppointments.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerActiveTab('alertas')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                  drawerActiveTab === 'alertas'
                    ? 'bg-white text-rose-700 border-rose-300 shadow-xs font-bold'
                    : 'text-[#7A6B62] border-transparent hover:text-rose-800 hover:bg-white/60'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>Alertas & Antecedentes</span>
                {activeAlertsCountInDrawer > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold ml-0.5">
                    {activeAlertsCountInDrawer}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setDrawerActiveTab('preferencias')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                  drawerActiveTab === 'preferencias'
                    ? 'bg-white text-[#8E4455] border-[#D9C9BF] shadow-xs font-bold'
                    : 'text-[#7A6B62] border-transparent hover:text-[#241E1A] hover:bg-white/60'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Preferencias & Estilo</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerActiveTab('tips')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                  drawerActiveTab === 'tips'
                    ? 'bg-white text-[#8E4455] border-[#D9C9BF] shadow-xs font-bold'
                    : 'text-[#7A6B62] border-transparent hover:text-[#241E1A] hover:bg-white/60'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Tips & Soft Gel</span>
              </button>
            </div>

            {/* Drawer Body Tabs */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* TAB 1: RESUMEN Y TURNOS */}
              {drawerActiveTab === 'resumen' && (
                <div className="space-y-6">
                  {/* Top Overview Banner - Normalizado idéntico a Alertas */}
                  <div className="bg-gradient-to-r from-rose-50/70 via-[#FAF7F2] to-amber-50/70 p-4 rounded-2xl border border-[#E8DCD5] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#8E4455]/15 text-[#8E4455] flex items-center justify-center font-serif font-bold text-sm">
                        {getInitials(selectedClient.nombre, selectedClient.apellido)}
                      </div>
                      <div>
                        <h4 className="font-serif text-sm font-bold text-[#241E1A] flex items-center gap-2">
                          {selectedClient.nombre} {selectedClient.apellido}
                          {isClientInactive(selectedClient) ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Inactiva ({inactivityDays}+ días)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Activa
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-[#7A6B62]">
                          Ficha integral de historial de turnos, contacto y notas internas del salón.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(selectedClient)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-[#D9C9BF] text-xs font-semibold text-[#4A3E39] hover:bg-[#FAF7F2] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#8E4455]" />
                        <span>Editar Datos</span>
                      </button>

                      {onOpenNewBookingWithClient && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenNewBookingWithClient(selectedClient);
                            setSelectedClient(null);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#8E4455] text-white text-xs font-semibold hover:bg-[#783746] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          <span>Nuevo Turno</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5]">
                      <span className="text-[10px] text-[#8C7A70] uppercase font-semibold block">Teléfono</span>
                      <span className="font-mono text-xs font-semibold text-[#241E1A]">{selectedClient.telefono}</span>
                    </div>
                    <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5]">
                      <span className="text-[10px] text-[#8C7A70] uppercase font-semibold block">Email</span>
                      <span className="text-xs font-medium text-[#241E1A] truncate block">{selectedClient.email || 'No registrado'}</span>
                    </div>
                    <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5]">
                      <span className="text-[10px] text-[#8C7A70] uppercase font-semibold block">Total Invertido</span>
                      <span className="text-xs font-bold text-[#8E4455]">${(selectedClient.totalGastado || 0).toLocaleString('es-AR')}</span>
                    </div>
                    <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5]">
                      <span className="text-[10px] text-[#8C7A70] uppercase font-semibold block">Visitas</span>
                      <span className="text-xs font-bold text-[#241E1A]">{clientAppointments.length} turnos</span>
                    </div>
                  </div>

                  {/* Active Alerts Banner if any */}
                  {activeAlertsCountInDrawer > 0 && (
                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                        <div>
                          <h5 className="font-bold text-xs text-rose-950">
                            Atención: {activeAlertsCountInDrawer} {activeAlertsCountInDrawer === 1 ? 'alerta activa registrada' : 'alertas activas registradas'}
                          </h5>
                          <p className="text-[11px] text-rose-800">
                            Revisá la pestaña de alertas antes de seleccionar productos químicos o técnicas agresivas.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDrawerActiveTab('alertas')}
                        className="px-3 py-1 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 shrink-0"
                      >
                        Ver Alertas
                      </button>
                    </div>
                  )}

                  {/* Private Notes Section */}
                  <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                        Notas Privadas del Salón
                      </h4>
                      <button
                        onClick={() => {
                          handleOpenEdit(selectedClient);
                        }}
                        className="text-[11px] font-semibold text-amber-800 hover:underline cursor-pointer"
                      >
                        Editar nota
                      </button>
                    </div>
                    <p className="text-xs text-amber-950 whitespace-pre-line leading-relaxed">
                      {selectedClient.notasAdmin || 'Sin notas registradas para esta clienta. Podés agregar gustos, preferencias o detalles de cutículas.'}
                    </p>
                  </div>

                  {/* Last Service Performed & Full History Trigger */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-serif text-base font-semibold text-[#241E1A] flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-[#8E4455]" />
                        Último Servicio Realizado
                      </h4>
                      <div className="flex items-center gap-2">
                        {sortedAppointments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryPage(1);
                              setShowFullHistoryModal(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#8E4455] border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>Ver historial completo ({sortedAppointments.length})</span>
                          </button>
                        )}
                        {onOpenNewBookingWithClient && (
                          <button
                            onClick={() => {
                              onOpenNewBookingWithClient(selectedClient);
                              setSelectedClient(null);
                            }}
                            className="text-xs font-semibold text-[#8E4455] hover:underline flex items-center gap-1 cursor-pointer pl-1"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            Agendar turno
                          </button>
                        )}
                      </div>
                    </div>

                    {isLoadingHistory ? (
                      <div className="p-8 text-center text-[#7A6B62]">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#8E4455] mb-2" />
                        <p className="text-xs">Cargando turnos...</p>
                      </div>
                    ) : sortedAppointments.length === 0 ? (
                      <div className="p-6 bg-[#FAF7F2] rounded-2xl border border-[#E8DCD5] text-center text-xs text-[#7A6B62]">
                        No se registran turnos en el sistema para esta clienta.
                      </div>
                    ) : (
                      <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DCD5] space-y-3">
                        {(() => {
                          const lastApt = sortedAppointments[0];
                          return (
                            <div className="bg-white p-4 rounded-xl border border-[#E8DCD5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-serif font-bold text-sm text-[#241E1A]">{lastApt.servicioNombre}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    lastApt.estado === 'completado' ? 'bg-blue-100 text-blue-800' :
                                    lastApt.estado === 'cancelado' ? 'bg-rose-100 text-rose-800' :
                                    'bg-amber-100 text-amber-800'
                                  }`}>
                                    {lastApt.estado}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[#7A6B62] mt-1.5 text-xs">
                                  <span className="flex items-center gap-1 font-mono font-medium">
                                    <Calendar className="w-3.5 h-3.5 text-[#8E4455]" />
                                    {formatDateFriendly(lastApt.fecha)} - {lastApt.horaInicio} hs
                                  </span>
                                  <span className="font-mono text-[#8C7A70]">Cód: {lastApt.codigo}</span>
                                </div>
                                {lastApt.observaciones && (
                                  <p className="text-xs text-[#5C4D44] mt-2 italic bg-[#FAF7F2] p-2.5 rounded-lg border border-[#E8DCD5]/60">
                                    <span className="font-semibold text-[#8C7A70] not-italic">Nota clienta: </span>
                                    "{lastApt.observaciones}"
                                  </p>
                                )}
                                {lastApt.notasAdmin && (
                                  <p className="text-xs text-amber-950 mt-2 bg-amber-50/90 p-2.5 rounded-lg border border-amber-200/80 flex items-start gap-1.5 shadow-2xs">
                                    <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                                    <span>
                                      <strong className="text-amber-900 font-semibold">Nota privada del salón: </strong>
                                      {lastApt.notasAdmin}
                                    </span>
                                  </p>
                                )}
                              </div>

                              <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#FAF7F2]">
                                <span className="font-bold text-base text-[#8E4455] block">${lastApt.precio.toLocaleString('es-AR')}</span>
                                <span className="text-[11px] text-[#8C7A70]">{lastApt.duracionMinutos} min</span>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="text-[#7A6B62]">
                            Mostrando el último servicio atendido.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryPage(1);
                              setShowFullHistoryModal(true);
                            }}
                            className="text-[#8E4455] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Ver todos los {sortedAppointments.length} servicios</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: ALERTAS Y ANTECEDENTES */}
              {drawerActiveTab === 'alertas' && (
                <ClientAlertsSection
                  clientId={selectedClient.id}
                  clientName={`${selectedClient.nombre} ${selectedClient.apellido}`}
                  alerts={clientAlerts}
                  onAlertsUpdated={handleRefreshCurrentClientProfile}
                  showToast={showToast}
                />
              )}

              {/* TAB 3: PREFERENCIAS Y ESTILO */}
              {drawerActiveTab === 'preferencias' && (
                <ClientPreferencesSection
                  clientId={selectedClient.id}
                  preferences={clientPreferences}
                  onPreferencesUpdated={handleRefreshCurrentClientProfile}
                  showToast={showToast}
                />
              )}

              {/* TAB 4: TIPS Y SOFT GEL */}
              {drawerActiveTab === 'tips' && (
                <ClientTipsSection
                  clientId={selectedClient.id}
                  tipsConfig={clientTipsConfig}
                  onTipsUpdated={handleRefreshCurrentClientProfile}
                  showToast={showToast}
                />
              )}

            </div>

            {/* Drawer Footer */}
            <div className="bg-[#FAF7F2] p-4 border-t border-[#E8DCD5] flex items-center justify-between">
              <a
                href={`https://wa.me/${selectedClient.telefonoNormalizado || selectedClient.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${selectedClient.nombre}! Te escribimos de Gwen Nails.`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Contactar por WhatsApp
              </a>

              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 rounded-xl border border-[#D9C9BF] text-[#4A3E39] hover:bg-white text-xs font-medium transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT CLIENT / NOTES ================= */}
      {editingClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#E8DCD5] shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-serif text-lg font-bold text-[#241E1A]">
                Editar Datos de Clienta
              </h4>
              <button onClick={() => setEditingClient(null)} className="text-[#8C7A70] hover:text-[#241E1A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={editForm.nombre}
                    onChange={(e) => setEditForm(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">Apellido</label>
                  <input
                    type="text"
                    required
                    value={editForm.apellido}
                    onChange={(e) => setEditForm(prev => ({ ...prev, apellido: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Teléfono / WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={editForm.telefono}
                  onChange={(e) => setEditForm(prev => ({ ...prev, telefono: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Email (Opcional)</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Notas Privadas / Observaciones</label>
                <textarea
                  rows={3}
                  value={editForm.notasAdmin}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notasAdmin: e.target.value }))}
                  placeholder="Ej: Prefiere tonos pastel, cutículas sensibles, café con edulcorante..."
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 rounded-xl border border-[#D9C9BF] text-xs text-[#4A3E39] hover:bg-[#FAF7F2] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl bg-[#8E4455] text-white text-xs font-semibold hover:bg-[#783746] transition-colors cursor-pointer"
                >
                  {isSavingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: MANUAL NEW CLIENT ================= */}
      {isCreatingClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#E8DCD5] shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-serif text-lg font-bold text-[#241E1A] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#8E4455]" />
                Registrar Nueva Clienta
              </h4>
              <button onClick={() => setIsCreatingClient(false)} className="text-[#8C7A70] hover:text-[#241E1A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={newClientForm.nombre}
                    onChange={(e) => setNewClientForm(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Ej: Luciana"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">Apellido *</label>
                  <input
                    type="text"
                    required
                    value={newClientForm.apellido}
                    onChange={(e) => setNewClientForm(prev => ({ ...prev, apellido: e.target.value }))}
                    placeholder="Ej: Gómez"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Teléfono / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  value={newClientForm.telefono}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, telefono: e.target.value }))}
                  placeholder="Ej: 011-15682386"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Email (Opcional)</label>
                <input
                  type="email"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="luciana@correo.com"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Notas Privadas Iniciales</label>
                <textarea
                  rows={2}
                  value={newClientForm.notasAdmin}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, notasAdmin: e.target.value }))}
                  placeholder="Observaciones iniciales..."
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingClient(false)}
                  className="px-4 py-2 rounded-xl border border-[#D9C9BF] text-xs text-[#4A3E39] hover:bg-[#FAF7F2] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNew}
                  className="px-4 py-2 rounded-xl bg-[#8E4455] text-white text-xs font-semibold hover:bg-[#783746] transition-colors cursor-pointer"
                >
                  {isSavingNew ? 'Registrando...' : 'Registrar Clienta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DUPLICATE MERGE RESOLUTION ================= */}
      {activeDuplicatePair && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border border-[#E8DCD5] shadow-2xl animate-fade-in space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8DCD5]">
              <h4 className="font-serif text-lg font-bold text-[#241E1A] flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-[#8E4455]" />
                Fusionar Perfiles Duplicados
              </h4>
              <button onClick={() => setActiveDuplicatePair(null)} className="text-[#8C7A70] hover:text-[#241E1A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#5C4D44]">
              Seleccioná cuál de los dos perfiles se mantendrá como el <strong>Perfil Principal</strong>. Todos los turnos pasados y futuros del perfil secundario se transferirán automáticamente al principal.
            </p>

            {/* Selection Radios */}
            <div className="space-y-3">
              {/* Option A */}
              <label 
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between cursor-pointer ${
                  primaryClientId === activeDuplicatePair.clienteA.id 
                    ? 'bg-rose-50/50 border-[#8E4455] ring-2 ring-[#8E4455]/20' 
                    : 'bg-[#FAF7F2] border-[#E8DCD5] hover:bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="primaryClient"
                    checked={primaryClientId === activeDuplicatePair.clienteA.id}
                    onChange={() => setPrimaryClientId(activeDuplicatePair.clienteA.id)}
                    className="mt-1 text-[#8E4455] focus:ring-[#8E4455]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#241E1A]">
                        {activeDuplicatePair.clienteA.nombre} {activeDuplicatePair.clienteA.apellido}
                      </span>
                      <span className="text-[10px] font-mono text-[#8C7A70]">ID: {activeDuplicatePair.clienteA.id.slice(0, 8)}</span>
                    </div>
                    <div className="text-xs text-[#7A6B62] mt-0.5 space-y-0.5">
                      <div>Tel: <span className="font-mono font-medium">{activeDuplicatePair.clienteA.telefono}</span></div>
                      {activeDuplicatePair.clienteA.email && <div>Email: {activeDuplicatePair.clienteA.email}</div>}
                      <div>Turnos asociados: <strong>{activeDuplicatePair.turnosA?.length || activeDuplicatePair.clienteA.totalTurnos || 0}</strong></div>
                    </div>
                  </div>
                </div>
                {primaryClientId === activeDuplicatePair.clienteA.id && (
                  <span className="px-2 py-0.5 rounded-full bg-[#8E4455] text-white text-[10px] font-bold">
                    Principal
                  </span>
                )}
              </label>

              {/* Option B */}
              <label 
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between cursor-pointer ${
                  primaryClientId === activeDuplicatePair.clienteB.id 
                    ? 'bg-rose-50/50 border-[#8E4455] ring-2 ring-[#8E4455]/20' 
                    : 'bg-[#FAF7F2] border-[#E8DCD5] hover:bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="primaryClient"
                    checked={primaryClientId === activeDuplicatePair.clienteB.id}
                    onChange={() => setPrimaryClientId(activeDuplicatePair.clienteB.id)}
                    className="mt-1 text-[#8E4455] focus:ring-[#8E4455]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#241E1A]">
                        {activeDuplicatePair.clienteB.nombre} {activeDuplicatePair.clienteB.apellido}
                      </span>
                      <span className="text-[10px] font-mono text-[#8C7A70]">ID: {activeDuplicatePair.clienteB.id.slice(0, 8)}</span>
                    </div>
                    <div className="text-xs text-[#7A6B62] mt-0.5 space-y-0.5">
                      <div>Tel: <span className="font-mono font-medium">{activeDuplicatePair.clienteB.telefono}</span></div>
                      {activeDuplicatePair.clienteB.email && <div>Email: {activeDuplicatePair.clienteB.email}</div>}
                      <div>Turnos asociados: <strong>{activeDuplicatePair.turnosB?.length || activeDuplicatePair.clienteB.totalTurnos || 0}</strong></div>
                    </div>
                  </div>
                </div>
                {primaryClientId === activeDuplicatePair.clienteB.id && (
                  <span className="px-2 py-0.5 rounded-full bg-[#8E4455] text-white text-[10px] font-bold">
                    Principal
                  </span>
                )}
              </label>
            </div>

            {/* Merge Notes */}
            <div>
              <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                Nota de Fusión (Opcional)
              </label>
              <input
                type="text"
                value={mergeNotes}
                onChange={(e) => setMergeNotes(e.target.value)}
                placeholder="Ej: Cambio de número de teléfono declarado por la clienta"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveDuplicatePair(null)}
                className="px-4 py-2 rounded-xl border border-[#D9C9BF] text-xs text-[#4A3E39] hover:bg-[#FAF7F2] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={isMerging}
                className="px-4 py-2 rounded-xl bg-[#8E4455] text-white text-xs font-semibold hover:bg-[#783746] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <GitMerge className="w-3.5 h-3.5" />
                {isMerging ? 'Fusionando...' : 'Confirmar y Unificar Historial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: HISTORIAL COMPLETO PAGINADO ================= */}
      {showFullHistoryModal && selectedClient && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[#E8DCD5] shadow-2xl animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FAF7F2] to-white p-5 border-b border-[#E8DCD5] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#8E4455] text-white flex items-center justify-center font-serif font-bold shadow-xs">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#241E1A] flex items-center gap-2">
                    Historial Completo de Turnos
                    <span className="text-xs font-mono font-semibold bg-rose-50 text-[#8E4455] px-2.5 py-0.5 rounded-full border border-rose-200">
                      {sortedAppointments.length} servicios
                    </span>
                  </h3>
                  <p className="text-xs text-[#7A6B62]">
                    Clienta: <strong className="text-[#241E1A]">{selectedClient.nombre} {selectedClient.apellido}</strong> (ordenado del más reciente al más antiguo)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFullHistoryModal(false)}
                className="p-2 rounded-xl text-[#8C7A70] hover:text-[#241E1A] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: List of Appointments */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3 bg-[#FAF7F2]/40">
              {paginatedHistory.length === 0 ? (
                <div className="p-10 text-center text-xs text-[#7A6B62] bg-white rounded-2xl border border-[#E8DCD5]">
                  No hay turnos registrados en este historial.
                </div>
              ) : (
                paginatedHistory.map((apt, index) => (
                  <div
                    key={apt.id || index}
                    className="bg-white p-4 rounded-2xl border border-[#E8DCD5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs hover:border-[#8E4455]/30 transition-all"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-serif font-bold text-sm text-[#241E1A]">{apt.servicioNombre}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          apt.estado === 'completado' ? 'bg-blue-100 text-blue-800' :
                          apt.estado === 'cancelado' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {apt.estado}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[#7A6B62] mt-1.5 text-xs">
                        <span className="flex items-center gap-1 font-mono font-medium">
                          <Calendar className="w-3.5 h-3.5 text-[#8E4455]" />
                          {formatDateFriendly(apt.fecha)} - {apt.horaInicio} hs
                        </span>
                        <span className="font-mono text-[#8C7A70]">Cód: {apt.codigo}</span>
                      </div>
                      {apt.observaciones && (
                        <p className="text-xs text-[#5C4D44] mt-2 italic bg-[#FAF7F2] p-2.5 rounded-lg border border-[#E8DCD5]/60">
                          <span className="font-semibold text-[#8C7A70] not-italic">Nota clienta: </span>
                          "{apt.observaciones}"
                        </p>
                      )}
                      {apt.notasAdmin && (
                        <p className="text-xs text-amber-950 mt-2 bg-amber-50/90 p-2.5 rounded-lg border border-amber-200/80 flex items-start gap-1.5 shadow-2xs">
                          <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-amber-900 font-semibold">Nota privada del salón: </strong>
                            {apt.notasAdmin}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#FAF7F2]">
                      <span className="font-bold text-base text-[#8E4455] block">${apt.precio.toLocaleString('es-AR')}</span>
                      <span className="text-[11px] text-[#8C7A70]">{apt.duracionMinutos} min</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer: Pagination Controls in Bottom-Right */}
            <div className="p-4 bg-white border-t border-[#E8DCD5] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-[#7A6B62]">
                Mostrando {(historyPage - 1) * 10 + 1} - {Math.min(historyPage * 10, sortedAppointments.length)} de {sortedAppointments.length} turnos
              </span>

              {/* Pagination Selector */}
              {totalHistoryPages > 1 ? (
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="p-2 rounded-xl border border-[#D9C9BF] text-[#4A3E39] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setHistoryPage(p)}
                      className={`w-8 h-8 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                        historyPage === p
                          ? 'bg-[#8E4455] text-white shadow-xs font-bold'
                          : 'bg-[#FAF7F2] text-[#4A3E39] hover:bg-[#E8DCD5]/60 border border-[#D9C9BF]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                    disabled={historyPage === totalHistoryPages}
                    className="p-2 rounded-xl border border-[#D9C9BF] text-[#4A3E39] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                    title="Página siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowFullHistoryModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#E8DCD5] text-[#4A3E39] border border-[#D9C9BF] font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
