import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tag, 
  Gift, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  Users, 
  DollarSign, 
  Percent, 
  Clock, 
  FileText, 
  RefreshCw, 
  Filter, 
  Eye, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';
import type { 
  Promotion, 
  PromotionUsage, 
  ClientBenefit, 
  ClientBenefitStatus, 
  BenefitOrigin, 
  DiscountType, 
  Service, 
  Client 
} from '../types.js';
import { 
  getBusinessDate, 
  isoDateToAR, 
  formatDateAR, 
  formatDateTimeAR 
} from '../utils/dateUtils.js';

interface PromotionsManagementAdminProps {
  services: Service[];
  clients?: Client[];
  onRefreshData?: () => void;
  onAuthError?: () => void;
}

export const PromotionsManagementAdmin: React.FC<PromotionsManagementAdminProps> = ({
  services,
  clients = [],
  onRefreshData,
  onAuthError
}) => {
  const [subTab, setSubTab] = useState<'promociones' | 'beneficios' | 'historial_usos'>('promociones');

  // Internal Clients State
  const [internalClients, setInternalClients] = useState<Client[]>([]);

  // Promotions State
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState<boolean>(false);
  const [promoSearch, setPromoSearch] = useState<string>('');
  const [promoFilterStatus, setPromoFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Create / Edit Promotion Modal
  const [isPromoModalOpen, setIsPromoModalOpen] = useState<boolean>(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [promoForm, setPromoForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    activo: true,
    tipoDescuento: 'porcentaje' as DiscountType,
    valorDescuento: 15,
    fechaInicio: getBusinessDate(),
    fechaVencimiento: '',
    limiteTotalUsos: '',
    limiteUsoPorCliente: '1',
    periodoReutilizacionDias: '30',
    serviciosAplicables: ['todos'] as string[],
    montoMinimo: ''
  });
  const [promoModalError, setPromoModalError] = useState<string | null>(null);
  const [isSavingPromo, setIsSavingPromo] = useState<boolean>(false);

  // Client Benefits State
  const [benefits, setBenefits] = useState<ClientBenefit[]>([]);
  const [isLoadingBenefits, setIsLoadingBenefits] = useState<boolean>(false);
  const [benefitSearch, setBenefitSearch] = useState<string>('');
  const [benefitStatusFilter, setBenefitStatusFilter] = useState<string>('all');

  // Create / Edit Benefit Modal
  const [isBenefitModalOpen, setIsBenefitModalOpen] = useState<boolean>(false);
  const [editingBenefit, setEditingBenefit] = useState<ClientBenefit | null>(null);
  const [benefitForm, setBenefitForm] = useState({
    clienteId: '',
    clienteNombre: '',
    clienteTelefono: '',
    clienteEmail: '',
    titulo: '',
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
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [selectedClientForBenefit, setSelectedClientForBenefit] = useState<Client | null>(null);
  const [benefitModalError, setBenefitModalError] = useState<string | null>(null);
  const [isSavingBenefit, setIsSavingBenefit] = useState<boolean>(false);

  // Promotion Usages State
  const [usages, setUsages] = useState<PromotionUsage[]>([]);
  const [isLoadingUsages, setIsLoadingUsages] = useState<boolean>(false);
  const [selectedPromoForUsage, setSelectedPromoForUsage] = useState<string>('all');

  // Fetch Promotions
  const fetchPromotions = async () => {
    setIsLoadingPromotions(true);
    try {
      const res = await fetch('/api/promociones?all=true', {
        credentials: 'include'
      });
      if (res.status === 401) {
        onAuthError?.();
        return;
      }
      if (res.ok) {
        const data: Promotion[] = await res.json();
        setPromotions(data);
      }
    } catch (err) {
      console.error('Error fetching promotions:', err);
    } finally {
      setIsLoadingPromotions(false);
    }
  };

  // Fetch Benefits
  const fetchBenefits = async () => {
    setIsLoadingBenefits(true);
    try {
      const res = await fetch('/api/beneficios-cliente', {
        credentials: 'include'
      });
      if (res.status === 401) {
        onAuthError?.();
        return;
      }
      if (res.ok) {
        const data: ClientBenefit[] = await res.json();
        setBenefits(data);
      }
    } catch (err) {
      console.error('Error fetching client benefits:', err);
    } finally {
      setIsLoadingBenefits(false);
    }
  };

  // Fetch Usages
  const fetchUsages = async () => {
    setIsLoadingUsages(true);
    try {
      const query = selectedPromoForUsage !== 'all' ? `?promocionId=${selectedPromoForUsage}` : '';
      const res = await fetch(`/api/promociones-usos${query}`, {
        credentials: 'include'
      });
      if (res.status === 401) {
        onAuthError?.();
        return;
      }
      if (res.ok) {
        const data: PromotionUsage[] = await res.json();
        setUsages(data);
      }
    } catch (err) {
      console.error('Error fetching promotion usages:', err);
    } finally {
      setIsLoadingUsages(false);
    }
  };

  // Fetch Clients (if not provided externally)
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
        const data = await res.json();
        setInternalClients(data);
      }
    } catch (err) {
      console.error('Error fetching clients for promotions admin:', err);
    }
  };

  useEffect(() => {
    fetchPromotions();
    fetchBenefits();
    fetchUsages();
    if (clients.length === 0) {
      fetchClients();
    }
  }, []);

  useEffect(() => {
    if (subTab === 'historial_usos') {
      fetchUsages();
    }
  }, [subTab, selectedPromoForUsage]);

  // Filtered Promotions
  const filteredPromotions = useMemo(() => {
    return promotions.filter(p => {
      const matchSearch = p.codigo.toLowerCase().includes(promoSearch.toLowerCase()) ||
        p.nombre.toLowerCase().includes(promoSearch.toLowerCase()) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(promoSearch.toLowerCase()));
      
      const matchStatus = promoFilterStatus === 'all' 
        ? true 
        : promoFilterStatus === 'active' 
        ? p.activo 
        : !p.activo;

      return matchSearch && matchStatus;
    });
  }, [promotions, promoSearch, promoFilterStatus]);

  // Filtered Benefits
  const filteredBenefits = useMemo(() => {
    return benefits.filter(b => {
      const matchSearch = b.titulo.toLowerCase().includes(benefitSearch.toLowerCase()) ||
        (b.clienteNombre && b.clienteNombre.toLowerCase().includes(benefitSearch.toLowerCase())) ||
        (b.clienteTelefono && b.clienteTelefono.includes(benefitSearch)) ||
        (b.descripcion && b.descripcion.toLowerCase().includes(benefitSearch.toLowerCase()));
      
      const matchStatus = benefitStatusFilter === 'all' ? true : b.estado === benefitStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [benefits, benefitSearch, benefitStatusFilter]);

  // Handle Open Create/Edit Promo
  const handleOpenPromoModal = (promo?: Promotion) => {
    setPromoModalError(null);
    if (promo) {
      setEditingPromo(promo);
      setPromoForm({
        codigo: promo.codigo,
        nombre: promo.nombre,
        descripcion: promo.descripcion || '',
        activo: promo.activo,
        tipoDescuento: promo.tipoDescuento,
        valorDescuento: promo.valorDescuento,
        fechaInicio: promo.fechaInicio,
        fechaVencimiento: promo.fechaVencimiento || '',
        limiteTotalUsos: promo.limiteTotalUsos != null ? String(promo.limiteTotalUsos) : '',
        limiteUsoPorCliente: promo.limiteUsoPorCliente != null ? String(promo.limiteUsoPorCliente) : '',
        periodoReutilizacionDias: promo.periodoReutilizacionDias != null ? String(promo.periodoReutilizacionDias) : '',
        serviciosAplicables: promo.serviciosAplicables || ['todos'],
        montoMinimo: promo.montoMinimo != null ? String(promo.montoMinimo) : ''
      });
    } else {
      setEditingPromo(null);
      setPromoForm({
        codigo: '',
        nombre: '',
        descripcion: '',
        activo: true,
        tipoDescuento: 'porcentaje',
        valorDescuento: 15,
        fechaInicio: getBusinessDate(),
        fechaVencimiento: '',
        limiteTotalUsos: '',
        limiteUsoPorCliente: '1',
        periodoReutilizacionDias: '30',
        serviciosAplicables: ['todos'],
        montoMinimo: ''
      });
    }
    setIsPromoModalOpen(true);
  };

  // Save Promo
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoModalError(null);

    if (!promoForm.codigo.trim() || !promoForm.nombre.trim() || !promoForm.fechaInicio) {
      setPromoModalError('Código, nombre y fecha de inicio son campos obligatorios.');
      return;
    }

    if (promoForm.valorDescuento <= 0) {
      setPromoModalError('El valor de descuento debe ser mayor a 0.');
      return;
    }

    if (promoForm.tipoDescuento === 'porcentaje' && promoForm.valorDescuento > 100) {
      setPromoModalError('El porcentaje de descuento no puede ser superior al 100%.');
      return;
    }

    setIsSavingPromo(true);

    try {
      const payload = {
        codigo: promoForm.codigo.trim().toUpperCase(),
        nombre: promoForm.nombre.trim(),
        descripcion: promoForm.descripcion.trim() || undefined,
        activo: promoForm.activo,
        tipoDescuento: promoForm.tipoDescuento,
        valorDescuento: Number(promoForm.valorDescuento),
        fechaInicio: promoForm.fechaInicio,
        fechaVencimiento: promoForm.fechaVencimiento || null,
        limiteTotalUsos: promoForm.limiteTotalUsos ? Number(promoForm.limiteTotalUsos) : null,
        limiteUsoPorCliente: promoForm.limiteUsoPorCliente ? Number(promoForm.limiteUsoPorCliente) : null,
        periodoReutilizacionDias: promoForm.periodoReutilizacionDias ? Number(promoForm.periodoReutilizacionDias) : null,
        serviciosAplicables: promoForm.serviciosAplicables.length > 0 ? promoForm.serviciosAplicables : ['todos'],
        montoMinimo: promoForm.montoMinimo ? Number(promoForm.montoMinimo) : null
      };

      const url = editingPromo ? `/api/promociones/${editingPromo.id}` : '/api/promociones';
      const method = editingPromo ? 'PUT' : 'POST';

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
        setPromoModalError(data.error || 'Error al guardar la promoción.');
        return;
      }

      setIsPromoModalOpen(false);
      fetchPromotions();
      onRefreshData?.();
    } catch (err: any) {
      setPromoModalError('Error de comunicación con el servidor.');
    } finally {
      setIsSavingPromo(false);
    }
  };

  // Toggle Promo Active
  const handleTogglePromoActive = async (promo: Promotion) => {
    try {
      const res = await fetch(`/api/promociones/${promo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ activo: !promo.activo })
      });
      if (res.status === 401) {
        onAuthError?.();
        return;
      }
      if (res.ok) {
        fetchPromotions();
        onRefreshData?.();
      }
    } catch (err) {
      console.error('Error toggling promo status:', err);
    }
  };

  // Open Create/Edit Benefit Modal
  const handleOpenBenefitModal = (benefit?: ClientBenefit) => {
    setBenefitModalError(null);
    if (benefit) {
      setEditingBenefit(benefit);
      setBenefitForm({
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
        serviciosAplicables: benefit.serviciosAplicables || ['todos'],
        montoMinimo: benefit.montoMinimo != null ? String(benefit.montoMinimo) : '',
        otorgadoPor: benefit.otorgadoPor || 'Administración'
      });
      const matchingClient = clients.find(c => c.id === benefit.clienteId);
      setSelectedClientForBenefit(matchingClient || null);
    } else {
      setEditingBenefit(null);
      setSelectedClientForBenefit(null);
      setClientSearchQuery('');
      setBenefitForm({
        clienteId: '',
        clienteNombre: '',
        clienteTelefono: '',
        clienteEmail: '',
        titulo: 'Beneficio Especial',
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
    setIsBenefitModalOpen(true);
  };

  // Save Benefit
  const handleSaveBenefit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBenefitModalError(null);

    const client = selectedClientForBenefit;
    if (!client && !benefitForm.clienteId) {
      setBenefitModalError('Debés seleccionar una clienta a la cual otorgarle el beneficio.');
      return;
    }

    if (!benefitForm.titulo.trim() || benefitForm.valorDescuento <= 0) {
      setBenefitModalError('El título y un valor de descuento positivo son obligatorios.');
      return;
    }

    if (benefitForm.tipoDescuento === 'porcentaje' && benefitForm.valorDescuento > 100) {
      setBenefitModalError('El porcentaje no puede ser superior al 100%.');
      return;
    }

    setIsSavingBenefit(true);

    try {
      const payload = {
        clienteId: client ? client.id : benefitForm.clienteId,
        clienteNombre: client ? `${client.nombre} ${client.apellido}` : benefitForm.clienteNombre,
        clienteTelefono: client ? client.telefono : benefitForm.clienteTelefono,
        clienteEmail: client?.email || benefitForm.clienteEmail || undefined,
        titulo: benefitForm.titulo.trim(),
        descripcion: benefitForm.descripcion.trim() || undefined,
        tipoDescuento: benefitForm.tipoDescuento,
        valorDescuento: Number(benefitForm.valorDescuento),
        origen: benefitForm.origen,
        origenDetalle: benefitForm.origenDetalle.trim() || undefined,
        fechaEmision: benefitForm.fechaEmision,
        fechaVencimiento: benefitForm.fechaVencimiento || null,
        serviciosAplicables: benefitForm.serviciosAplicables.length > 0 ? benefitForm.serviciosAplicables : ['todos'],
        montoMinimo: benefitForm.montoMinimo ? Number(benefitForm.montoMinimo) : null,
        otorgadoPor: benefitForm.otorgadoPor || 'Administración'
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
        setBenefitModalError(data.error || 'Error al guardar el beneficio.');
        return;
      }

      setIsBenefitModalOpen(false);
      fetchBenefits();
      onRefreshData?.();
    } catch (err: any) {
      setBenefitModalError('Error de comunicación con el servidor.');
    } finally {
      setIsSavingBenefit(false);
    }
  };

  // Client search results for Benefit modal
  const effectiveClients = clients && clients.length > 0 ? clients : internalClients;
  const searchedClientsForModal = useMemo(() => {
    if (!clientSearchQuery.trim()) return effectiveClients.slice(0, 8);
    const q = clientSearchQuery.toLowerCase().trim();
    return effectiveClients.filter(c => 
      c.nombre.toLowerCase().includes(q) || 
      c.apellido.toLowerCase().includes(q) || 
      c.telefono.includes(q) || 
      (c.email && c.email.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [effectiveClients, clientSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header with Tab Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DCD5]">
        <div>
          <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#241E1A] flex items-center gap-2">
            <Tag className="w-6 h-6 text-[#8E4455]" />
            <span>Descuentos, Promociones y Beneficios</span>
          </h3>
          <p className="text-xs text-[#7A6B62] mt-0.5">
            Administrá códigos promocionales públicos y beneficios exclusivos por clienta.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#D9C9BF] shadow-xs">
          <button
            type="button"
            onClick={() => setSubTab('promociones')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'promociones'
                ? 'bg-[#8E4455] text-white shadow-xs'
                : 'text-[#5A4B43] hover:text-[#241E1A] hover:bg-[#FAF7F2]'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Promociones ({promotions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('beneficios')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'beneficios'
                ? 'bg-[#8E4455] text-white shadow-xs'
                : 'text-[#5A4B43] hover:text-[#241E1A] hover:bg-[#FAF7F2]'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Beneficios ({benefits.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('historial_usos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'historial_usos'
                ? 'bg-[#8E4455] text-white shadow-xs'
                : 'text-[#5A4B43] hover:text-[#241E1A] hover:bg-[#FAF7F2]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Historial de Usos ({usages.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: PROMOCIONES PÚBLICAS */}
      {/* ========================================================================= */}
      {subTab === 'promociones' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8C7A70] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={promoSearch}
                  onChange={(e) => setPromoSearch(e.target.value)}
                  placeholder="Buscar por código, nombre..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#D9C9BF] text-[#241E1A] placeholder-[#A6978E] focus:outline-none focus:border-[#8E4455]"
                />
              </div>

              <select
                value={promoFilterStatus}
                onChange={(e: any) => setPromoFilterStatus(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl bg-white border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
              >
                <option value="all">Todas</option>
                <option value="active">Activas</option>
                <option value="inactive">Inactivas</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchPromotions}
                className="p-2 rounded-xl bg-white border border-[#D9C9BF] text-[#5A4B43] hover:text-[#241E1A] hover:bg-[#FAF7F2] text-xs flex items-center gap-1 cursor-pointer"
                title="Actualizar"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingPromotions ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => handleOpenPromoModal()}
                className="px-4 py-2 rounded-xl bg-[#8E4455] text-white hover:bg-[#783645] text-xs font-medium flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Promoción</span>
              </button>
            </div>
          </div>

          {/* Promotions Table / Cards */}
          {isLoadingPromotions ? (
            <div className="p-12 text-center text-xs text-[#8C7A70] bg-white rounded-2xl border border-[#E8DCD5]">
              <div className="w-6 h-6 border-2 border-[#8E4455] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Cargando promociones...
            </div>
          ) : filteredPromotions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#E8DCD5] space-y-3">
              <Tag className="w-10 h-10 text-[#D9C9BF] mx-auto" />
              <p className="text-sm font-medium text-[#241E1A]">No hay promociones configuradas</p>
              <p className="text-xs text-[#7A6B62]">
                Creá tu primer código de descuento para que tus clientas lo usen al reservar online.
              </p>
              <button
                type="button"
                onClick={() => handleOpenPromoModal()}
                className="px-4 py-2 rounded-xl bg-[#8E4455] text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Crear Promoción</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPromotions.map((promo) => {
                const todayBusiness = getBusinessDate();
                const isExpired = promo.fechaVencimiento && promo.fechaVencimiento < todayBusiness;
                const isExhausted = promo.limiteTotalUsos != null && promo.usosActuales >= promo.limiteTotalUsos;

                return (
                  <div
                    key={promo.id}
                    className={`bg-white rounded-2xl p-5 border transition-all relative ${
                      !promo.activo || isExpired || isExhausted
                        ? 'border-[#E8DCD5] opacity-80'
                        : 'border-[#E8DCD5] hover:border-[#8E4455]/50 shadow-xs'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm tracking-wider px-2.5 py-0.5 rounded-lg bg-[#FAF7F2] border border-[#D9C9BF] text-[#8E4455]">
                            {promo.codigo}
                          </span>
                          {promo.activo && !isExpired && !isExhausted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Activa
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" /> Vencida
                            </span>
                          ) : isExhausted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3" /> Agotada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              Inactiva
                            </span>
                          )}
                        </div>
                        <h4 className="font-serif text-base font-semibold text-[#241E1A] mt-1.5">
                          {promo.nombre}
                        </h4>
                        {promo.descripcion && (
                          <p className="text-xs text-[#7A6B62] mt-0.5 line-clamp-2">
                            {promo.descripcion}
                          </p>
                        )}
                      </div>

                      {/* Discount value badge */}
                      <div className="text-right">
                        <span className="text-lg font-bold text-[#8E4455] block">
                          {promo.tipoDescuento === 'porcentaje'
                            ? `${promo.valorDescuento}% OFF`
                            : `$${promo.valorDescuento.toLocaleString('es-AR')} OFF`}
                        </span>
                        {promo.montoMinimo && (
                          <span className="text-[10px] text-[#8C7A70] block">
                            Min. ${promo.montoMinimo.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5] mb-4">
                      <div>
                        <span className="text-[#8C7A70] block">Vigencia:</span>
                        <span className="font-medium text-[#241E1A]">
                          {isoDateToAR(promo.fechaInicio)} al {promo.fechaVencimiento ? isoDateToAR(promo.fechaVencimiento) : 'Sin fin'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[#8C7A70] block">Usos registrados:</span>
                        <span className="font-medium text-[#241E1A]">
                          {promo.usosActuales} {promo.limiteTotalUsos != null ? `/ ${promo.limiteTotalUsos}` : 'usos'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[#8C7A70] block">Límite por clienta:</span>
                        <span className="font-medium text-[#241E1A]">
                          {promo.limiteUsoPorCliente != null ? `${promo.limiteUsoPorCliente} vez/veces` : 'Ilimitado'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[#8C7A70] block">Reutilización:</span>
                        <span className="font-medium text-[#241E1A]">
                          {promo.periodoReutilizacionDias != null ? `Cada ${promo.periodoReutilizacionDias} días` : 'Inmediata'}
                        </span>
                      </div>
                    </div>

                    {/* Services badge */}
                    <div className="mb-4">
                      <span className="text-[11px] text-[#8C7A70] block mb-1">Servicios aplicables:</span>
                      <div className="flex flex-wrap gap-1">
                        {promo.serviciosAplicables.includes('todos') ? (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-[#D9C9BF] text-[10px] text-[#241E1A] font-medium">
                            ✨ Todos los servicios del salón
                          </span>
                        ) : (
                          promo.serviciosAplicables.map(sId => {
                            const srv = services.find(s => s.id === sId);
                            return (
                              <span key={sId} className="px-2 py-0.5 rounded-md bg-white border border-[#D9C9BF] text-[10px] text-[#241E1A]">
                                {srv ? srv.nombre : sId}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#E8DCD5]">
                      <button
                        type="button"
                        onClick={() => handleTogglePromoActive(promo)}
                        className={`text-xs font-medium cursor-pointer ${
                          promo.activo ? 'text-amber-700 hover:underline' : 'text-emerald-700 hover:underline'
                        }`}
                      >
                        {promo.activo ? 'Desactivar' : 'Activar'}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenPromoModal(promo)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#D9C9BF] text-xs font-medium text-[#5A4B43] hover:text-[#241E1A] hover:bg-[#FAF7F2] flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#8E4455]" />
                          <span>Editar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: BENEFICIOS INDIVIDUALES DE CLIENTES */}
      {/* ========================================================================= */}
      {subTab === 'beneficios' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8C7A70] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={benefitSearch}
                  onChange={(e) => setBenefitSearch(e.target.value)}
                  placeholder="Buscar por clienta, teléfono, título..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#D9C9BF] text-[#241E1A] placeholder-[#A6978E] focus:outline-none focus:border-[#8E4455]"
                />
              </div>

              <select
                value={benefitStatusFilter}
                onChange={(e) => setBenefitStatusFilter(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl bg-white border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
              >
                <option value="all">Todos los estados</option>
                <option value="disponible">Disponibles</option>
                <option value="usado">Usados</option>
                <option value="vencido">Vencidos</option>
                <option value="cancelado">Cancelados</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchBenefits}
                className="p-2 rounded-xl bg-white border border-[#D9C9BF] text-[#5A4B43] hover:text-[#241E1A] hover:bg-[#FAF7F2] text-xs flex items-center gap-1 cursor-pointer"
                title="Actualizar"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingBenefits ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => handleOpenBenefitModal()}
                className="px-4 py-2 rounded-xl bg-[#8E4455] text-white hover:bg-[#783645] text-xs font-medium flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Otorgar Beneficio a Clienta</span>
              </button>
            </div>
          </div>

          {/* Benefits List */}
          {isLoadingBenefits ? (
            <div className="p-12 text-center text-xs text-[#8C7A70] bg-white rounded-2xl border border-[#E8DCD5]">
              <div className="w-6 h-6 border-2 border-[#8E4455] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Cargando beneficios...
            </div>
          ) : filteredBenefits.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#E8DCD5] space-y-3">
              <Gift className="w-10 h-10 text-[#D9C9BF] mx-auto" />
              <p className="text-sm font-medium text-[#241E1A]">No hay beneficios otorgados</p>
              <p className="text-xs text-[#7A6B62]">
                Podés premiar la fidelidad de una clienta o compensarla con un descuento exclusivo en su próxima reserva.
              </p>
              <button
                type="button"
                onClick={() => handleOpenBenefitModal()}
                className="px-4 py-2 rounded-xl bg-[#8E4455] text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Otorgar Beneficio</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBenefits.map((benefit) => {
                const todayBusiness = getBusinessDate();
                const isExpired = benefit.fechaVencimiento && benefit.fechaVencimiento < todayBusiness;
                return (
                  <div
                    key={benefit.id}
                    className={`bg-white rounded-2xl p-5 border transition-all ${
                      benefit.estado === 'disponible' && !isExpired
                        ? 'border-[#E8DCD5] hover:border-[#8E4455]/50 shadow-xs'
                        : 'border-[#E8DCD5] opacity-75'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#8E4455] bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                            {benefit.clienteNombre || 'Clienta'}
                          </span>
                          {benefit.estado === 'disponible' && !isExpired && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Disponible
                            </span>
                          )}
                          {benefit.estado === 'usado' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              Utilizado ({benefit.turnoUsoCodigo || 'Reserva'})
                            </span>
                          )}
                          {benefit.estado === 'vencido' || isExpired && benefit.estado === 'disponible' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              Vencido
                            </span>
                          )}
                          {benefit.estado === 'cancelado' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              Cancelado
                            </span>
                          )}
                        </div>
                        <h4 className="font-serif text-base font-semibold text-[#241E1A] mt-1.5">
                          {benefit.titulo}
                        </h4>
                        {benefit.descripcion && (
                          <p className="text-xs text-[#7A6B62] mt-0.5">
                            {benefit.descripcion}
                          </p>
                        )}
                      </div>

                      {/* Discount value */}
                      <div className="text-right">
                        <span className="text-lg font-bold text-[#8E4455] block">
                          {benefit.tipoDescuento === 'porcentaje'
                            ? `${benefit.valorDescuento}% OFF`
                            : `$${benefit.valorDescuento.toLocaleString('es-AR')} OFF`}
                        </span>
                        <span className="text-[10px] text-[#8C7A70] block">
                          Origen: {benefit.origen}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5] mb-4">
                      <div>
                        <span className="text-[#8C7A70] block">Teléfono de contacto:</span>
                        <span className="font-medium text-[#241E1A]">
                          {benefit.clienteTelefono || 'No especificado'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[#8C7A70] block">Fecha de emisión:</span>
                        <span className="font-medium text-[#241E1A]">
                          {isoDateToAR(benefit.fechaEmision)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[#8C7A70] block">Vencimiento:</span>
                        <span className="font-medium text-[#241E1A]">
                          {benefit.fechaVencimiento ? isoDateToAR(benefit.fechaVencimiento) : 'Sin vencimiento'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[#8C7A70] block">Otorgado por:</span>
                        <span className="font-medium text-[#241E1A]">
                          {benefit.otorgadoPor || 'Administración'}
                        </span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#E8DCD5]">
                      <span className="text-[11px] text-[#8C7A70]">
                        {benefit.turnoOrigenCodigo ? `Generado por turno ${benefit.turnoOrigenCodigo}` : 'Asignación manual'}
                      </span>

                      {benefit.estado === 'disponible' && (
                        <button
                          type="button"
                          onClick={() => handleOpenBenefitModal(benefit)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#D9C9BF] text-xs font-medium text-[#5A4B43] hover:text-[#241E1A] hover:bg-[#FAF7F2] flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#8E4455]" />
                          <span>Editar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: HISTORIAL DE USOS */}
      {/* ========================================================================= */}
      {subTab === 'historial_usos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <label className="text-xs font-medium text-[#4A3E39]">Filtrar por código:</label>
              <select
                value={selectedPromoForUsage}
                onChange={(e) => setSelectedPromoForUsage(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl bg-white border border-[#D9C9BF] text-[#241E1A] focus:outline-none focus:border-[#8E4455] flex-1"
              >
                <option value="all">Todas las promociones</option>
                {promotions.map(p => (
                  <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={fetchUsages}
              className="p-2 rounded-xl bg-white border border-[#D9C9BF] text-[#5A4B43] hover:text-[#241E1A] hover:bg-[#FAF7F2] text-xs flex items-center gap-1 self-end cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingUsages ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          {isLoadingUsages ? (
            <div className="p-12 text-center text-xs text-[#8C7A70] bg-white rounded-2xl border border-[#E8DCD5]">
              <div className="w-6 h-6 border-2 border-[#8E4455] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Cargando historial...
            </div>
          ) : usages.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#E8DCD5] space-y-2">
              <Clock className="w-10 h-10 text-[#D9C9BF] mx-auto" />
              <p className="text-sm font-medium text-[#241E1A]">No se registran usos de códigos promocionales</p>
              <p className="text-xs text-[#7A6B62]">
                Cuando las clientas confirmen turnos utilizando un código promocional, quedarán registrados aquí para auditoría.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DCD5] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#241E1A]">
                  <thead className="bg-[#FAF7F2] border-b border-[#E8DCD5] text-[11px] text-[#8C7A70] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Fecha & Hora</th>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Clienta</th>
                      <th className="py-3 px-4">Turno</th>
                      <th className="py-3 px-4 text-right">Descuento</th>
                      <th className="py-3 px-4 text-right">Precio Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8DCD5]">
                    {usages.map((u) => (
                      <tr key={u.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                        <td className="py-3 px-4 text-[#7A6B62]">
                          {formatDateTimeAR(u.fechaUso)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#8E4455]">
                          {u.codigoPromocion}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-[#241E1A] block">
                            {u.clienteNombre || 'Clienta'}
                          </span>
                          {u.clienteTelefono && (
                            <span className="text-[11px] text-[#8C7A70]">
                              {u.clienteTelefono}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#5A4B43]">
                          {u.turnoCodigo || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                          -${u.montoDescuento.toLocaleString('es-AR')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#241E1A]">
                          ${u.precioFinal.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREAR / EDITAR PROMOCIÓN */}
      {/* ========================================================================= */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#E8DCD5] shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[#E8DCD5]">
              <div>
                <h4 className="font-serif text-xl font-medium text-[#241E1A]">
                  {editingPromo ? 'Editar Promoción' : 'Nueva Promoción Pública'}
                </h4>
                <p className="text-xs text-[#7A6B62]">
                  Configurá el código, vigencia y reglas de uso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPromoModalOpen(false)}
                className="p-1 rounded-full text-[#8C7A70] hover:text-[#241E1A] hover:bg-[#FAF7F2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {promoModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{promoModalError}</span>
              </div>
            )}

            <form onSubmit={handleSavePromo} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                    Código Promocional *
                  </label>
                  <input
                    type="text"
                    required
                    value={promoForm.codigo}
                    onChange={(e) => setPromoForm({ ...promoForm, codigo: e.target.value.toUpperCase() })}
                    placeholder="Ej: PRIMAVERA20"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] font-mono font-bold text-[#8E4455] uppercase focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                    Nombre Descriptivo *
                  </label>
                  <input
                    type="text"
                    required
                    value={promoForm.nombre}
                    onChange={(e) => setPromoForm({ ...promoForm, nombre: e.target.value })}
                    placeholder="Ej: 20% OFF Nuevas Clientas"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  value={promoForm.descripcion}
                  onChange={(e) => setPromoForm({ ...promoForm, descripcion: e.target.value })}
                  placeholder="Ej: Válido para reservas realizadas durante este mes"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                    Tipo de Descuento
                  </label>
                  <select
                    value={promoForm.tipoDescuento}
                    onChange={(e: any) => setPromoForm({ ...promoForm, tipoDescuento: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  >
                    <option value="porcentaje">Porcentaje (%)</option>
                    <option value="monto_fijo">Monto Fijo ($ ARS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                    Valor del Descuento *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={promoForm.valorDescuento}
                    onChange={(e) => setPromoForm({ ...promoForm, valorDescuento: Number(e.target.value) })}
                    placeholder={promoForm.tipoDescuento === 'porcentaje' ? '20' : '3000'}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] font-semibold text-[#8E4455] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    required
                    value={promoForm.fechaInicio}
                    onChange={(e) => setPromoForm({ ...promoForm, fechaInicio: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                    Fecha de Vencimiento
                  </label>
                  <input
                    type="date"
                    value={promoForm.fechaVencimiento}
                    onChange={(e) => setPromoForm({ ...promoForm, fechaVencimiento: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1" title="Dejar vacío para ilimitado">
                    Límite Total
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={promoForm.limiteTotalUsos}
                    onChange={(e) => setPromoForm({ ...promoForm, limiteTotalUsos: e.target.value })}
                    placeholder="Ilimitado"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1" title="Límite por clienta">
                    Por Clienta
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={promoForm.limiteUsoPorCliente}
                    onChange={(e) => setPromoForm({ ...promoForm, limiteUsoPorCliente: e.target.value })}
                    placeholder="1"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1" title="Días para poder volver a utilizarla">
                    Reutilización (Días)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={promoForm.periodoReutilizacionDias}
                    onChange={(e) => setPromoForm({ ...promoForm, periodoReutilizacionDias: e.target.value })}
                    placeholder="30"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
              </div>

              {/* Minimum Amount */}
              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                  Monto Mínimo de Servicio (Opcional, en $ ARS)
                </label>
                <input
                  type="number"
                  min="0"
                  value={promoForm.montoMinimo}
                  onChange={(e) => setPromoForm({ ...promoForm, montoMinimo: e.target.value })}
                  placeholder="Ej: 10000 (dejar vacío si no aplica)"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                />
              </div>

              {/* Applicable Services */}
              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1.5">
                  Servicios Aplicables
                </label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 bg-[#FAF7F2] rounded-xl border border-[#D9C9BF]">
                  <label className="flex items-center gap-2 text-xs text-[#241E1A] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={promoForm.serviciosAplicables.includes('todos')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPromoForm({ ...promoForm, serviciosAplicables: ['todos'] });
                        } else {
                          setPromoForm({ ...promoForm, serviciosAplicables: [] });
                        }
                      }}
                      className="rounded text-[#8E4455]"
                    />
                    <span className="font-semibold">✨ Todos los servicios del salón</span>
                  </label>
                  {services.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-xs text-[#5A4B43] cursor-pointer pl-4">
                      <input
                        type="checkbox"
                        checked={promoForm.serviciosAplicables.includes(s.id) || promoForm.serviciosAplicables.includes('todos')}
                        disabled={promoForm.serviciosAplicables.includes('todos')}
                        onChange={(e) => {
                          let next = promoForm.serviciosAplicables.filter(id => id !== 'todos');
                          if (e.target.checked) {
                            next.push(s.id);
                          } else {
                            next = next.filter(id => id !== s.id);
                          }
                          setPromoForm({ ...promoForm, serviciosAplicables: next });
                        }}
                        className="rounded text-[#8E4455]"
                      />
                      <span>{s.nombre} (${s.precio.toLocaleString('es-AR')})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 bg-[#FAF7F2] rounded-xl border border-[#D9C9BF]">
                <span className="text-xs font-medium text-[#241E1A]">Estado de la Promoción</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promoForm.activo}
                    onChange={(e) => setPromoForm({ ...promoForm, activo: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8E4455]"></div>
                  <span className="ml-2 text-xs text-[#5A4B43]">
                    {promoForm.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E8DCD5]">
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#D9C9BF] text-xs font-medium text-[#5A4B43] hover:bg-[#FAF7F2] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPromo}
                  className="px-5 py-2 rounded-xl bg-[#8E4455] text-white text-xs font-medium hover:bg-[#783645] shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPromo && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{editingPromo ? 'Guardar Cambios' : 'Crear Promoción'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: OTORGAR / EDITAR BENEFICIO A CLIENTA */}
      {/* ========================================================================= */}
      {isBenefitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#E8DCD5] shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[#E8DCD5]">
              <div>
                <h4 className="font-serif text-xl font-medium text-[#241E1A]">
                  {editingBenefit ? 'Editar Beneficio de Clienta' : 'Otorgar Beneficio Individual'}
                </h4>
                <p className="text-xs text-[#7A6B62]">
                  Descuento exclusivo asociado directamente al perfil de la clienta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBenefitModalOpen(false)}
                className="p-1 rounded-full text-[#8C7A70] hover:text-[#241E1A] hover:bg-[#FAF7F2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {benefitModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{benefitModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveBenefit} className="space-y-4">
              {/* Select Client */}
              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                  Clienta Destinataria *
                </label>
                {selectedClientForBenefit ? (
                  <div className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs">
                    <div>
                      <span className="font-semibold text-[#8E4455] block">
                        {selectedClientForBenefit.nombre} {selectedClientForBenefit.apellido}
                      </span>
                      <span className="text-[#7A6B62]">
                        Tel: {selectedClientForBenefit.telefono} {selectedClientForBenefit.email ? `· ${selectedClientForBenefit.email}` : ''}
                      </span>
                    </div>
                    {!editingBenefit && (
                      <button
                        type="button"
                        onClick={() => setSelectedClientForBenefit(null)}
                        className="text-xs text-[#8E4455] hover:underline font-medium cursor-pointer"
                      >
                        Cambiar
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#8C7A70] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        placeholder="Buscar clienta por nombre o teléfono..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto divide-y divide-[#E8DCD5] border border-[#D9C9BF] rounded-xl bg-white">
                      {searchedClientsForModal.length === 0 ? (
                        <p className="p-3 text-xs text-[#8C7A70] text-center">No se encontraron clientas</p>
                      ) : (
                        searchedClientsForModal.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedClientForBenefit(c);
                              setBenefitForm(prev => ({
                                ...prev,
                                clienteId: c.id,
                                clienteNombre: `${c.nombre} ${c.apellido}`,
                                clienteTelefono: c.telefono,
                                clienteEmail: c.email || ''
                              }));
                            }}
                            className="w-full text-left p-2.5 hover:bg-[#FAF7F2] text-xs flex justify-between items-center transition-colors cursor-pointer"
                          >
                            <div>
                              <span className="font-semibold text-[#241E1A] block">{c.nombre} {c.apellido}</span>
                              <span className="text-[11px] text-[#7A6B62]">{c.telefono}</span>
                            </div>
                            <span className="text-[11px] text-[#8E4455] font-medium">Seleccionar →</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                  Título del Beneficio *
                </label>
                <input
                  type="text"
                  required
                  value={benefitForm.titulo}
                  onChange={(e) => setBenefitForm({ ...benefitForm, titulo: e.target.value })}
                  placeholder="Ej: 20% OFF por Reprogramación de Agenda"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                  Descripción o Motivo (Visible para la clienta al reservar)
                </label>
                <input
                  type="text"
                  value={benefitForm.descripcion}
                  onChange={(e) => setBenefitForm({ ...benefitForm, descripcion: e.target.value })}
                  placeholder="Ej: Te bonificamos este porcentaje en compensación por la excepción de horarios."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                />
              </div>

              {/* Discount Value & Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                    Tipo de Descuento
                  </label>
                  <select
                    value={benefitForm.tipoDescuento}
                    onChange={(e: any) => setBenefitForm({ ...benefitForm, tipoDescuento: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  >
                    <option value="porcentaje">Porcentaje (%)</option>
                    <option value="monto_fijo">Monto Fijo ($ ARS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                    Valor del Descuento *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={benefitForm.valorDescuento}
                    onChange={(e) => setBenefitForm({ ...benefitForm, valorDescuento: Number(e.target.value) })}
                    placeholder="20"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] font-semibold text-[#8E4455] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
              </div>

              {/* Origin & Expiration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                    Origen / Categoría
                  </label>
                  <select
                    value={benefitForm.origen}
                    onChange={(e: any) => setBenefitForm({ ...benefitForm, origen: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  >
                    <option value="admin">Administración</option>
                    <option value="compensacion">Compensación</option>
                    <option value="cancelacion_excepcion">Cancelación por Excepción</option>
                    <option value="fidelizacion">Fidelización</option>
                    <option value="cumpleanos">Cumpleaños</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A3E39] mb-1">
                    Fecha de Vencimiento
                  </label>
                  <input
                    type="date"
                    value={benefitForm.fechaVencimiento}
                    onChange={(e) => setBenefitForm({ ...benefitForm, fechaVencimiento: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] focus:bg-white focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E8DCD5]">
                <button
                  type="button"
                  onClick={() => setIsBenefitModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#D9C9BF] text-xs font-medium text-[#5A4B43] hover:bg-[#FAF7F2] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingBenefit}
                  className="px-5 py-2 rounded-xl bg-[#8E4455] text-white text-xs font-medium hover:bg-[#783645] shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingBenefit && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{editingBenefit ? 'Guardar Cambios' : 'Otorgar Beneficio'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
