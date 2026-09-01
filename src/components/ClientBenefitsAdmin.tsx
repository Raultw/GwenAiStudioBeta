import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gift, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Ban, 
  RefreshCw, 
  Sparkles, 
  ShieldAlert, 
  DollarSign, 
  Percent, 
  Check, 
  X,
  FileText,
  History,
  RotateCcw,
  ArrowRight
} from 'lucide-react';
import type { 
  ClientBenefit, 
  Client, 
  Service, 
  DiscountType, 
  BenefitOrigin, 
  BenefitStatus 
} from '../types.js';
import { 
  getBusinessDate, 
  isoDateToAR, 
  formatDateAR, 
  formatDateTimeAR 
} from '../utils/dateUtils.js';

interface ClientBenefitsAdminProps {
  services: Service[];
  clients?: Client[];
  onRefreshData?: () => void;
  onAuthError?: () => void;
}

export const ClientBenefitsAdmin: React.FC<ClientBenefitsAdminProps> = ({
  services,
  clients = [],
  onRefreshData,
  onAuthError
}) => {
  // State: Data
  const [benefits, setBenefits] = useState<ClientBenefit[]>([]);
  const [internalClients, setInternalClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // State: Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');

  // State: Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBenefit, setEditingBenefit] = useState<ClientBenefit | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // State: Cancel / Deactivate Modal
  const [benefitToCancel, setBenefitToCancel] = useState<ClientBenefit | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Form State
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    clienteId: '',
    clienteNombre: '',
    clienteTelefono: '',
    clienteEmail: '',
    titulo: 'Beneficio Especial',
    descripcion: '',
    tipoDescuento: 'porcentaje' as DiscountType,
    valorDescuento: 20,
    origen: 'admin' as BenefitOrigin,
    origenDetalle: '',
    fechaEmision: getBusinessDate(),
    fechaVencimiento: '',
    serviciosAplicables: ['todos'] as string[],
    montoMinimo: '',
    otorgadoPor: 'Administración'
  });

  // Fetch Benefits from API
  const fetchBenefits = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/beneficios-cliente', {
        credentials: 'include'
      });
      if (res.status === 401) {
        onAuthError?.();
        return;
      }
      if (!res.ok) {
        throw new Error(`Error ${res.status}: no se pudieron cargar los beneficios.`);
      }
      const data: ClientBenefit[] = await res.json();
      setBenefits(data);
    } catch (err: any) {
      console.error('Error fetching client benefits:', err);
      setFetchError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Clients if not provided
  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clientes', {
        credentials: 'include'
      });
      if (res.status === 401) {
        onAuthError?.();
        return;
      }
      if (res.ok) {
        const data: Client[] = await res.json();
        setInternalClients(data);
      }
    } catch (err) {
      console.error('Error fetching clients for benefits admin:', err);
    }
  };

  useEffect(() => {
    fetchBenefits();
    if (!clients || clients.length === 0) {
      fetchClients();
    }
  }, []);

  const allClients = useMemo(() => {
    return clients && clients.length > 0 ? clients : internalClients;
  }, [clients, internalClients]);

  // Filtered Benefits
  const filteredBenefits = useMemo(() => {
    return benefits.filter(b => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (
        b.titulo.toLowerCase().includes(q) ||
        (b.clienteNombre && b.clienteNombre.toLowerCase().includes(q)) ||
        (b.clienteTelefono && b.clienteTelefono.includes(q)) ||
        (b.clienteEmail && b.clienteEmail.toLowerCase().includes(q)) ||
        (b.descripcion && b.descripcion.toLowerCase().includes(q)) ||
        (b.origenDetalle && b.origenDetalle.toLowerCase().includes(q)) ||
        (b.turnoOrigenCodigo && b.turnoOrigenCodigo.toLowerCase().includes(q)) ||
        (b.turnoUsoCodigo && b.turnoUsoCodigo.toLowerCase().includes(q))
      );

      // Status Filter
      const matchStatus = statusFilter === 'all' || b.estado === statusFilter;

      // Origin Filter
      let matchOrigin = true;
      if (originFilter !== 'all') {
        if (originFilter === 'compensacion') {
          matchOrigin = b.origen === 'compensacion' || b.origen === 'cancelacion_excepcion';
        } else if (originFilter === 'fidelidad') {
          matchOrigin = b.origen === 'fidelidad' || b.origen === 'fidelizacion';
        } else {
          matchOrigin = b.origen === originFilter;
        }
      }

      return matchSearch && matchStatus && matchOrigin;
    });
  }, [benefits, searchQuery, statusFilter, originFilter]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = benefits.length;
    const disponibles = benefits.filter(b => b.estado === 'disponible').length;
    const usados = benefits.filter(b => b.estado === 'usado').length;
    const vencidos = benefits.filter(b => b.estado === 'vencido').length;
    const cancelados = benefits.filter(b => b.estado === 'cancelado').length;
    const compensaciones = benefits.filter(b => b.origen === 'compensacion' || b.origen === 'cancelacion_excepcion').length;
    const administrativos = benefits.filter(b => b.origen !== 'compensacion' && b.origen !== 'cancelacion_excepcion').length;

    return { total, disponibles, usados, vencidos, cancelados, compensaciones, administrativos };
  }, [benefits]);

  // Clients autocomplete for modal
  const searchedClientsForModal = useMemo(() => {
    if (!clientSearchQuery.trim()) return allClients.slice(0, 8);
    const q = clientSearchQuery.toLowerCase().trim();
    return allClients.filter(c => 
      c.nombre.toLowerCase().includes(q) || 
      c.apellido.toLowerCase().includes(q) || 
      c.telefono.includes(q) || 
      (c.email && c.email.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [allClients, clientSearchQuery]);

  // Open Create / Edit Modal
  const handleOpenModal = (benefit?: ClientBenefit) => {
    setModalError(null);
    if (benefit) {
      setEditingBenefit(benefit);
      setFormData({
        clienteId: benefit.clienteId,
        clienteNombre: benefit.clienteNombre || '',
        clienteTelefono: benefit.clienteTelefono || '',
        clienteEmail: benefit.clienteEmail || '',
        titulo: benefit.titulo,
        descripcion: benefit.descripcion || '',
        tipoDescuento: benefit.tipoDescuento,
        valorDescuento: benefit.valorDescuento,
        origen: benefit.origen,
        origenDetalle: benefit.origenDetalle || '',
        fechaEmision: benefit.fechaEmision,
        fechaVencimiento: benefit.fechaVencimiento || '',
        serviciosAplicables: benefit.serviciosAplicables && benefit.serviciosAplicables.length > 0 ? benefit.serviciosAplicables : ['todos'],
        montoMinimo: benefit.montoMinimo != null ? String(benefit.montoMinimo) : '',
        otorgadoPor: benefit.otorgadoPor || 'Administración'
      });
      const matchingClient = allClients.find(c => c.id === benefit.clienteId);
      setSelectedClient(matchingClient || null);
      setClientSearchQuery(benefit.clienteNombre || '');
    } else {
      setEditingBenefit(null);
      setSelectedClient(null);
      setClientSearchQuery('');
      setFormData({
        clienteId: '',
        clienteNombre: '',
        clienteTelefono: '',
        clienteEmail: '',
        titulo: 'Beneficio Especial de Fidelidad',
        descripcion: '',
        tipoDescuento: 'porcentaje',
        valorDescuento: 20,
        origen: 'admin',
        origenDetalle: '',
        fechaEmision: getBusinessDate(),
        fechaVencimiento: '',
        serviciosAplicables: ['todos'],
        montoMinimo: '',
        otorgadoPor: 'Administración'
      });
    }
    setIsModalOpen(true);
  };

  // Submit Save Benefit
  const handleSaveBenefit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const client = selectedClient;
    if (!client && !formData.clienteId) {
      setModalError('Debés seleccionar una clienta a la cual otorgarle el beneficio.');
      return;
    }

    if (!formData.titulo.trim()) {
      setModalError('El título del beneficio es obligatorio.');
      return;
    }

    if (formData.valorDescuento <= 0) {
      setModalError('El valor de descuento debe ser mayor a 0.');
      return;
    }

    if (formData.tipoDescuento === 'porcentaje' && formData.valorDescuento > 100) {
      setModalError('El porcentaje no puede ser superior al 100%.');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        clienteId: client ? client.id : formData.clienteId,
        clienteNombre: client ? `${client.nombre} ${client.apellido}`.trim() : formData.clienteNombre,
        clienteTelefono: client ? client.telefono : formData.clienteTelefono,
        clienteEmail: client?.email || formData.clienteEmail || undefined,
        titulo: formData.titulo.trim(),
        descripcion: formData.descripcion.trim() || undefined,
        tipoDescuento: formData.tipoDescuento,
        valorDescuento: Number(formData.valorDescuento),
        origen: formData.origen,
        origenDetalle: formData.origenDetalle.trim() || undefined,
        fechaEmision: formData.fechaEmision,
        fechaVencimiento: formData.fechaVencimiento || null,
        serviciosAplicables: formData.serviciosAplicables.length > 0 ? formData.serviciosAplicables : ['todos'],
        montoMinimo: formData.montoMinimo ? Number(formData.montoMinimo) : null,
        otorgadoPor: formData.otorgadoPor || 'Administración'
      };

      const url = editingBenefit ? `/api/beneficios-cliente/${editingBenefit.id}` : '/api/beneficios-cliente';
      const method = editingBenefit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        onAuthError?.();
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setModalError(data.error || 'Error al guardar el beneficio.');
        return;
      }

      setIsModalOpen(false);
      await fetchBenefits();
      onRefreshData?.();
    } catch (err: any) {
      console.error('Error saving benefit:', err);
      setModalError('Error de comunicación con el servidor al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel / Deactivate Benefit (Soft state change)
  const handleConfirmCancelBenefit = async () => {
    if (!benefitToCancel) return;
    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/beneficios-cliente/${benefitToCancel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ estado: 'cancelado' })
      });

      if (res.status === 401) {
        onAuthError?.();
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setCancelError(data.error || 'Error al cancelar el beneficio.');
        return;
      }

      setBenefitToCancel(null);
      await fetchBenefits();
      onRefreshData?.();
    } catch (err: any) {
      console.error('Error cancelling benefit:', err);
      setCancelError('Error al comunicarse con el servidor para cancelar el beneficio.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Helper for quick validity presets
  const handleSetValidityDays = (days: number | null) => {
    if (days === null) {
      setFormData(prev => ({ ...prev, fechaVencimiento: '' }));
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    setFormData(prev => ({ ...prev, fechaVencimiento: getBusinessDate(d) }));
  };

  return (
    <div className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FAF7F2] p-4 sm:p-5 rounded-2xl border border-[#E8DCD5]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-[#8E4455]">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#241E1A]">
                Beneficios Individuales
              </h3>
              <p className="text-xs text-[#7A6B62] mt-0.5">
                Gestión de descuentos exclusivos asignados nominalmente a clientas (fidelidad, cortesías y compensaciones).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchBenefits}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-[#5A4B43] hover:text-[#241E1A] hover:bg-white text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="Recargar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#8E4455] text-white hover:bg-[#783645] text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Otorgar Beneficio</span>
          </button>
        </div>
      </div>

      {/* Metrics Quick Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-[#E8DCD5] shadow-2xs">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8C7A70] block">
            Total Registrados
          </span>
          <span className="text-lg font-bold text-[#241E1A] mt-0.5 block">
            {metrics.total}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 block">
            Disponibles
          </span>
          <span className="text-lg font-bold text-emerald-700 mt-0.5 block">
            {metrics.disponibles}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-100 bg-blue-50/20 shadow-2xs">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-700 block">
            Utilizados
          </span>
          <span className="text-lg font-bold text-blue-700 mt-0.5 block">
            {metrics.usados}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-100 bg-amber-50/20 shadow-2xs">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 block">
            Vencidos
          </span>
          <span className="text-lg font-bold text-amber-700 mt-0.5 block">
            {metrics.vencidos}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-rose-100 bg-rose-50/20 shadow-2xs">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8E4455] block">
            Compensaciones
          </span>
          <span className="text-lg font-bold text-[#8E4455] mt-0.5 block">
            {metrics.compensaciones}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E8DCD5] shadow-2xs">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8C7A70] block">
            Cancelados
          </span>
          <span className="text-lg font-bold text-[#8C7A70] mt-0.5 block">
            {metrics.cancelados}
          </span>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-white p-3 rounded-2xl border border-[#E8DCD5]">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-[#8C7A70] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre de clienta, teléfono, título o motivo..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] placeholder-[#A6978E] focus:outline-none focus:border-[#8E4455] focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#8C7A70]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-2.5 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
            >
              <option value="all">Todos los estados</option>
              <option value="disponible">Disponibles</option>
              <option value="usado">Utilizados</option>
              <option value="vencido">Vencidos</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>

          {/* Origin filter */}
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="py-1.5 px-2.5 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
          >
            <option value="all">Todos los orígenes</option>
            <option value="compensacion">Compensaciones por cancelación</option>
            <option value="admin">Administración / Cortesía</option>
            <option value="fidelidad">Fidelidad / Fidelización</option>
            <option value="cumpleanos">Cumpleaños</option>
            <option value="promocion_especial">Promoción Especial</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>

      {/* Feedback / Error banner */}
      {fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={fetchBenefits}
            className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 font-medium hover:bg-rose-200 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-[#8C7A70] bg-white rounded-2xl border border-[#E8DCD5]">
          <div className="w-7 h-7 border-2 border-[#8E4455] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-medium text-[#241E1A]">Cargando beneficios individuales...</p>
          <p className="text-[#8C7A70] mt-1">Consultando registros en base de datos</p>
        </div>
      ) : filteredBenefits.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#E8DCD5] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-[#8E4455]">
            <Gift className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-[#241E1A]">
            {searchQuery || statusFilter !== 'all' || originFilter !== 'all'
              ? 'No se encontraron beneficios con los filtros aplicados'
              : 'No hay beneficios individuales registrados'}
          </p>
          <p className="text-xs text-[#7A6B62] max-w-md mx-auto">
            {searchQuery || statusFilter !== 'all' || originFilter !== 'all'
              ? 'Intentá cambiar los términos de búsqueda o restablecer los filtros.'
              : 'Otorgá descuentos nominales a tus clientas por fidelidad, cumpleaños o compensaciones por cancelaciones de turnos.'}
          </p>
          {searchQuery || statusFilter !== 'all' || originFilter !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setOriginFilter('all');
              }}
              className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#5A4B43] hover:bg-white"
            >
              Restablecer filtros
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="px-4 py-2 rounded-xl bg-[#8E4455] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Otorgar Beneficio</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBenefits.map((benefit) => {
            const isCompensation = benefit.origen === 'compensacion' || benefit.origen === 'cancelacion_excepcion';
            const todayBusiness = getBusinessDate();
            const isExpired = benefit.fechaVencimiento && benefit.fechaVencimiento < todayBusiness;
            const canBeEdited = benefit.estado === 'disponible';
            const canBeCancelled = benefit.estado === 'disponible';

            return (
              <div
                key={benefit.id}
                className={`bg-white rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                  isCompensation
                    ? 'border-rose-200/80 bg-linear-to-b from-rose-50/20 to-white'
                    : 'border-[#E8DCD5]'
                } ${
                  benefit.estado === 'disponible' && !isExpired
                    ? 'shadow-xs hover:border-[#8E4455]/50'
                    : 'opacity-85'
                }`}
              >
                <div>
                  {/* Top Row: Client Badge & Status Tag */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-xs text-[#8E4455] bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 inline-flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{benefit.clienteNombre || 'Clienta'}</span>
                      </span>

                      {/* Origin Badge */}
                      {isCompensation ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          <span>Compensación</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FAF7F2] text-[#7A6B62] border border-[#E8DCD5]">
                          {benefit.origen === 'fidelidad' || benefit.origen === 'fidelizacion'
                            ? 'Fidelidad'
                            : benefit.origen === 'cumpleanos'
                            ? 'Cumpleaños'
                            : benefit.origen === 'promocion_especial'
                            ? 'Promoción VIP'
                            : 'Cortesía Admin'}
                        </span>
                      )}

                      {/* Status Badge */}
                      {benefit.estado === 'disponible' && !isExpired && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Disponible</span>
                        </span>
                      )}
                      {benefit.estado === 'usado' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Utilizado</span>
                        </span>
                      )}
                      {(benefit.estado === 'vencido' || (isExpired && benefit.estado === 'disponible')) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Vencido</span>
                        </span>
                      )}
                      {benefit.estado === 'cancelado' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 inline-flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          <span>Cancelado</span>
                        </span>
                      )}
                    </div>

                    {/* Discount Value */}
                    <div className="text-right flex-shrink-0">
                      <span className="text-lg font-bold text-[#8E4455] leading-none block">
                        {benefit.tipoDescuento === 'porcentaje'
                          ? `${benefit.valorDescuento}% OFF`
                          : `$${benefit.valorDescuento.toLocaleString('es-AR')} OFF`}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h4 className="font-serif text-base font-semibold text-[#241E1A]">
                    {benefit.titulo}
                  </h4>
                  {benefit.descripcion && (
                    <p className="text-xs text-[#7A6B62] mt-0.5 leading-relaxed">
                      {benefit.descripcion}
                    </p>
                  )}

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5] mt-3">
                    <div>
                      <span className="text-[#8C7A70] block">Contacto:</span>
                      <span className="font-medium text-[#241E1A] truncate block">
                        {benefit.clienteTelefono || benefit.clienteEmail || 'Sin datos'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[#8C7A70] block">Emisión:</span>
                      <span className="font-medium text-[#241E1A]">
                        {isoDateToAR(benefit.fechaEmision)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[#8C7A70] block">Vigencia:</span>
                      <span className="font-medium text-[#241E1A]">
                        {benefit.fechaVencimiento ? `Hasta ${isoDateToAR(benefit.fechaVencimiento)}` : 'Sin vencimiento'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[#8C7A70] block">Servicios:</span>
                      <span className="font-medium text-[#241E1A] truncate block">
                        {!benefit.serviciosAplicables || benefit.serviciosAplicables.includes('todos')
                          ? 'Todos los servicios'
                          : `${benefit.serviciosAplicables.length} específico(s)`}
                      </span>
                    </div>

                    {benefit.montoMinimo != null && benefit.montoMinimo > 0 && (
                      <div className="col-span-2">
                        <span className="text-[#8C7A70] inline">Monto mínimo de compra: </span>
                        <span className="font-medium text-[#241E1A]">
                          ${benefit.montoMinimo.toLocaleString('es-AR')}
                        </span>
                      </div>
                    )}

                    {/* Origin specifics */}
                    {isCompensation && (
                      <div className="col-span-2 pt-1.5 border-t border-[#E8DCD5]/60 text-amber-900">
                        <span className="font-medium block">
                          Turno origen: {benefit.turnoOrigenCodigo || benefit.turnoOrigenId || 'Cancelado'}
                        </span>
                        {benefit.origenDetalle && (
                          <span className="text-[10px] text-[#7A6B62] block mt-0.5">
                            Motivo: {benefit.origenDetalle}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Consumption specifics if used */}
                    {benefit.estado === 'usado' && (
                      <div className="col-span-2 pt-1.5 border-t border-blue-200 text-blue-900 bg-blue-50/50 p-2 rounded-lg">
                        <span className="font-semibold block">
                          Consumido en reserva: {benefit.turnoUsoCodigo || benefit.turnoUsoId || 'Confirmada'}
                        </span>
                        <span className="text-[10px] text-blue-800 block">
                          Fecha de uso: {benefit.usadoEn || benefit.fechaUso ? formatDateTimeAR(benefit.usadoEn || benefit.fechaUso) : 'Registrado'}
                        </span>
                        {benefit.descuentoAplicado != null && (
                          <span className="text-[10px] font-medium text-blue-900 block mt-0.5">
                            Monto descontado: ${benefit.descuentoAplicado.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Attribution & Administrative Actions */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#E8DCD5]">
                  <span className="text-[10px] text-[#8C7A70] truncate max-w-[180px]">
                    Otorgado por: <span className="font-medium text-[#5A4B43]">{benefit.otorgadoPor || 'Administración'}</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {canBeEdited && (
                      <button
                        type="button"
                        onClick={() => handleOpenModal(benefit)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C9BF] text-xs font-medium text-[#5A4B43] hover:text-[#241E1A] hover:bg-[#FAF7F2] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#8E4455]" />
                        <span>Editar</span>
                      </button>
                    )}

                    {canBeCancelled && (
                      <button
                        type="button"
                        onClick={() => setBenefitToCancel(benefit)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancelar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: OTORGAR / EDITAR BENEFICIO INDIVIDUAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#E8DCD5] animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-[#E8DCD5] bg-[#FAF7F2] rounded-t-3xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-[#8E4455]">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-serif text-lg font-semibold text-[#241E1A]">
                    {editingBenefit ? 'Editar Beneficio' : 'Otorgar Beneficio a Clienta'}
                  </h4>
                  <p className="text-[11px] text-[#7A6B62]">
                    {editingBenefit ? 'Modificá las condiciones del beneficio asignado' : 'Asigná un descuento exclusivo nominal'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white text-[#8C7A70] hover:text-[#241E1A] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveBenefit} className="overflow-y-auto p-5 space-y-4 flex-1">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Client Selection (if creating) */}
              {!editingBenefit ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Clienta Destinataria <span className="text-[#8E4455]">*</span>
                  </label>
                  {selectedClient ? (
                    <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-xs text-[#241E1A] block">
                          {selectedClient.nombre} {selectedClient.apellido}
                        </span>
                        <span className="text-[11px] text-[#7A6B62] block">
                          {selectedClient.telefono} {selectedClient.email ? `• ${selectedClient.email}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClient(null);
                          setClientSearchQuery('');
                        }}
                        className="text-xs text-[#8E4455] hover:underline font-medium"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 text-[#8C7A70] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={clientSearchQuery}
                          onChange={(e) => setClientSearchQuery(e.target.value)}
                          placeholder="Buscar clienta por nombre, apellido o teléfono..."
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] placeholder-[#A6978E] focus:outline-none focus:border-[#8E4455]"
                        />
                      </div>

                      {/* Dropdown Results */}
                      <div className="max-h-40 overflow-y-auto border border-[#E8DCD5] rounded-xl bg-white divide-y divide-[#FAF7F2]">
                        {searchedClientsForModal.length === 0 ? (
                          <div className="p-3 text-center text-xs text-[#8C7A70]">
                            No se encontraron clientas.
                          </div>
                        ) : (
                          searchedClientsForModal.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedClient(c);
                                setFormData(prev => ({
                                  ...prev,
                                  clienteId: c.id,
                                  clienteNombre: `${c.nombre} ${c.apellido}`.trim(),
                                  clienteTelefono: c.telefono,
                                  clienteEmail: c.email || ''
                                }));
                              }}
                              className="w-full text-left p-2.5 hover:bg-rose-50/50 transition-colors flex justify-between items-center text-xs"
                            >
                              <div>
                                <span className="font-semibold text-[#241E1A] block">
                                  {c.nombre} {c.apellido}
                                </span>
                                <span className="text-[10px] text-[#7A6B62]">
                                  {c.telefono} {c.email ? `| ${c.email}` : ''}
                                </span>
                              </div>
                              <span className="text-[10px] text-[#8E4455] font-medium">Seleccionar</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8DCD5]">
                  <span className="text-[10px] text-[#8C7A70] block">Clienta asignada:</span>
                  <span className="font-semibold text-xs text-[#241E1A] block">
                    {formData.clienteNombre} ({formData.clienteTelefono})
                  </span>
                </div>
              )}

              {/* Title & Origin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Título del Beneficio <span className="text-[#8E4455]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.titulo}
                    onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                    placeholder="Ej: 20% OFF por Fidelidad"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Origen / Categoría
                  </label>
                  <select
                    value={formData.origen}
                    onChange={(e) => setFormData(prev => ({ ...prev, origen: e.target.value as BenefitOrigin }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  >
                    <option value="admin">Cortesía Administrativa</option>
                    <option value="fidelidad">Fidelidad / Recurrente</option>
                    <option value="cumpleanos">Cumpleaños</option>
                    <option value="promocion_especial">Promoción Especial VIP</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#241E1A]">
                  Descripción o Motivo
                </label>
                <textarea
                  rows={2}
                  value={formData.descripcion}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Detalle interno o mensaje especial para la clienta..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455] resize-none"
                />
              </div>

              {/* Discount Type and Value */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Tipo de Descuento
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-[#FAF7F2] p-1 rounded-xl border border-[#D9C9BF]">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tipoDescuento: 'porcentaje' }))}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                        formData.tipoDescuento === 'porcentaje'
                          ? 'bg-[#8E4455] text-white shadow-2xs'
                          : 'text-[#5A4B43] hover:text-[#241E1A]'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" />
                      <span>%</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tipoDescuento: 'monto_fijo' }))}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                        formData.tipoDescuento === 'monto_fijo'
                          ? 'bg-[#8E4455] text-white shadow-2xs'
                          : 'text-[#5A4B43] hover:text-[#241E1A]'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>$ Fijo</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Valor del Descuento <span className="text-[#8E4455]">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={formData.tipoDescuento === 'porcentaje' ? 100 : 1000000}
                    required
                    value={formData.valorDescuento}
                    onChange={(e) => setFormData(prev => ({ ...prev, valorDescuento: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
              </div>

              {/* Validity & Expiration */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#241E1A]">
                      Fecha de Emisión
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.fechaEmision}
                      onChange={(e) => setFormData(prev => ({ ...prev, fechaEmision: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#241E1A]">
                      Fecha de Vencimiento (opcional)
                    </label>
                    <input
                      type="date"
                      value={formData.fechaVencimiento}
                      onChange={(e) => setFormData(prev => ({ ...prev, fechaVencimiento: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                    />
                  </div>
                </div>

                {/* Expiration Presets */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-[#8C7A70]">Preajustes:</span>
                  <button
                    type="button"
                    onClick={() => handleSetValidityDays(15)}
                    className="px-2 py-0.5 rounded-lg bg-[#FAF7F2] border border-[#D9C9BF] text-[#5A4B43] hover:bg-white"
                  >
                    15 días
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetValidityDays(30)}
                    className="px-2 py-0.5 rounded-lg bg-[#FAF7F2] border border-[#D9C9BF] text-[#5A4B43] hover:bg-white"
                  >
                    30 días
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetValidityDays(60)}
                    className="px-2 py-0.5 rounded-lg bg-[#FAF7F2] border border-[#D9C9BF] text-[#5A4B43] hover:bg-white"
                  >
                    60 días
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetValidityDays(null)}
                    className="px-2 py-0.5 rounded-lg bg-[#FAF7F2] border border-[#D9C9BF] text-[#5A4B43] hover:bg-white"
                  >
                    Sin vencimiento
                  </button>
                </div>
              </div>

              {/* Applicable Services */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Servicios Aplicables
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.serviciosAplicables.includes('todos')) {
                        setFormData(prev => ({ ...prev, serviciosAplicables: services.map(s => s.id) }));
                      } else {
                        setFormData(prev => ({ ...prev, serviciosAplicables: ['todos'] }));
                      }
                    }}
                    className="text-[11px] text-[#8E4455] hover:underline font-medium"
                  >
                    {formData.serviciosAplicables.includes('todos') ? 'Seleccionar específicos' : 'Aplicar a todos'}
                  </button>
                </div>

                {formData.serviciosAplicables.includes('todos') ? (
                  <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8DCD5] text-xs text-[#5A4B43] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Aplica a cualquier servicio disponible en el salón.</span>
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto p-2 bg-[#FAF7F2] rounded-xl border border-[#D9C9BF] space-y-1">
                    {services.map(svc => {
                      const isSelected = formData.serviciosAplicables.includes(svc.id);
                      return (
                        <label
                          key={svc.id}
                          className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                            isSelected ? 'bg-rose-50 text-[#8E4455] font-medium' : 'text-[#5A4B43] hover:bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  serviciosAplicables: [...prev.serviciosAplicables.filter(id => id !== 'todos'), svc.id]
                                }));
                              } else {
                                const remaining = formData.serviciosAplicables.filter(id => id !== svc.id);
                                setFormData(prev => ({
                                  ...prev,
                                  serviciosAplicables: remaining.length === 0 ? ['todos'] : remaining
                                }));
                              }
                            }}
                            className="rounded-sm text-[#8E4455] focus:ring-[#8E4455]"
                          />
                          <span>{svc.nombre}</span>
                          <span className="text-[10px] text-[#8C7A70] ml-auto">${svc.precio.toLocaleString('es-AR')}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Minimum Amount & Otorgado Por */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Monto Mínimo de Servicio ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.montoMinimo}
                    onChange={(e) => setFormData(prev => ({ ...prev, montoMinimo: e.target.value }))}
                    placeholder="Sin monto mínimo"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Otorgado Por
                  </label>
                  <input
                    type="text"
                    value={formData.otorgadoPor}
                    onChange={(e) => setFormData(prev => ({ ...prev, otorgadoPor: e.target.value }))}
                    placeholder="Administración"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8DCD5]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-[#D9C9BF] text-[#5A4B43] hover:bg-[#FAF7F2]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#8E4455] text-white hover:bg-[#783645] flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingBenefit ? 'Guardar Cambios' : 'Otorgar Beneficio'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CANCELAR BENEFICIO (SOFT-DELETE) */}
      {/* ========================================================================= */}
      {benefitToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-[#E8DCD5] space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif text-base font-semibold text-[#241E1A]">
                  Cancelar Beneficio
                </h4>
                <p className="text-xs text-[#7A6B62]">
                  Esta acción cambiará el estado a cancelado.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#E8DCD5] text-xs text-[#5A4B43] space-y-1">
              <p>
                <strong>Clienta:</strong> {benefitToCancel.clienteNombre}
              </p>
              <p>
                <strong>Beneficio:</strong> {benefitToCancel.titulo} (
                {benefitToCancel.tipoDescuento === 'porcentaje'
                  ? `${benefitToCancel.valorDescuento}% OFF`
                  : `$${benefitToCancel.valorDescuento} OFF`}
                )
              </p>
              <p className="text-[11px] text-[#8C7A70] pt-1 border-t border-[#E8DCD5]/60 mt-2">
                El registro no se eliminará de la base de datos para preservar la trazabilidad histórica.
              </p>
            </div>

            {cancelError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {cancelError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBenefitToCancel(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-xl border border-[#D9C9BF] text-[#5A4B43] hover:bg-[#FAF7F2]"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelBenefit}
                disabled={isCancelling}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-700 text-white hover:bg-rose-800 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isCancelling ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
