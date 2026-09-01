import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Plus, 
  Search, 
  Check, 
  X, 
  Edit3, 
  Percent, 
  DollarSign, 
  Clock, 
  Tag, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  RefreshCw, 
  Scissors, 
  ToggleLeft, 
  ToggleRight,
  Info
} from 'lucide-react';
import type { BenefitTemplate, Service, DiscountType } from '../types';

interface BenefitTemplatesAdminProps {
  services?: Service[];
  onAuthError?: () => void;
}

export const BenefitTemplatesAdmin: React.FC<BenefitTemplatesAdminProps> = ({ services = [], onAuthError }) => {
  const [templates, setTemplates] = useState<BenefitTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'porcentaje' | 'monto_fijo'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<BenefitTemplate | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    nombrePublico: string;
    descripcionPublica: string;
    tipoDescuento: DiscountType;
    valorDescuento: string;
    vigenciaDias: string;
    serviciosScope: 'todos' | 'especificos';
    serviciosSeleccionados: string[];
    montoMinimo: string;
    activo: boolean;
  }>({
    nombrePublico: '',
    descripcionPublica: '',
    tipoDescuento: 'porcentaje',
    valorDescuento: '20',
    vigenciaDias: '30',
    serviciosScope: 'todos',
    serviciosSeleccionados: [],
    montoMinimo: '',
    activo: true
  });

  // Fetch templates from API
  const fetchTemplates = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/benefit-templates?all=true', { credentials: 'include' });
      if (res.status === 401) {
        onAuthError?.();
        throw new Error('Sesión expirada o no autorizada. Por favor inicie sesión nuevamente.');
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}: no se pudieron cargar las plantillas.`);
      }
      const data: BenefitTemplate[] = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching benefit templates:', err);
      setFetchError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(tpl => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (
        tpl.nombrePublico.toLowerCase().includes(q) ||
        (tpl.descripcionPublica && tpl.descripcionPublica.toLowerCase().includes(q))
      );

      // Status
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? tpl.activo : !tpl.activo);

      // Type
      const matchType = typeFilter === 'all' || tpl.tipoDescuento === typeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [templates, searchQuery, statusFilter, typeFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = templates.length;
    const active = templates.filter(t => t.activo).length;
    const inactive = total - active;
    const porcentaje = templates.filter(t => t.tipoDescuento === 'porcentaje').length;
    const montoFijo = templates.filter(t => t.tipoDescuento === 'monto_fijo').length;
    return { total, active, inactive, porcentaje, montoFijo };
  }, [templates]);

  // Toggle active status
  const handleToggleActive = async (tpl: BenefitTemplate) => {
    if (togglingId) return;
    setTogglingId(tpl.id);
    try {
      const res = await fetch(`/api/benefit-templates/${tpl.id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (res.status === 401) {
        onAuthError?.();
        throw new Error('Sesión expirada o no autorizada.');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al cambiar estado.');
      }
      const updated: BenefitTemplate = await res.json();
      setTemplates(prev => prev.map(item => item.id === updated.id ? updated : item));
      showToast(`Plantilla "${updated.nombrePublico}" ${updated.activo ? 'activada' : 'desactivada'}.`);
    } catch (err: any) {
      console.error('Error toggling template:', err);
      showToast(err.message || 'Error al cambiar estado', true);
    } finally {
      setTogglingId(null);
    }
  };

  const showToast = (msg: string, isErr: boolean = false) => {
    setSuccessToast(isErr ? `❌ ${msg}` : `✅ ${msg}`);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // Open Modal for Create or Edit
  const handleOpenModal = (tpl?: BenefitTemplate) => {
    setFormError(null);
    if (tpl) {
      setEditingTemplate(tpl);
      const isTodos = !tpl.serviciosAplicables || tpl.serviciosAplicables.includes('todos');
      setFormData({
        nombrePublico: tpl.nombrePublico,
        descripcionPublica: tpl.descripcionPublica || '',
        tipoDescuento: tpl.tipoDescuento,
        valorDescuento: String(tpl.valorDescuento),
        vigenciaDias: String(tpl.vigenciaDias),
        serviciosScope: isTodos ? 'todos' : 'especificos',
        serviciosSeleccionados: isTodos ? [] : tpl.serviciosAplicables,
        montoMinimo: tpl.montoMinimo != null ? String(tpl.montoMinimo) : '',
        activo: tpl.activo
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        nombrePublico: '',
        descripcionPublica: '',
        tipoDescuento: 'porcentaje',
        valorDescuento: '20',
        vigenciaDias: '30',
        serviciosScope: 'todos',
        serviciosSeleccionados: [],
        montoMinimo: '',
        activo: true
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingTemplate(null);
    setFormError(null);
  };

  // Handle Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validations
    const cleanNombre = formData.nombrePublico.trim();
    if (!cleanNombre) {
      setFormError('El nombre público es obligatorio.');
      return;
    }

    const numVal = Number(formData.valorDescuento);
    if (isNaN(numVal) || numVal <= 0) {
      setFormError('El valor del descuento debe ser un número mayor a cero.');
      return;
    }

    if (formData.tipoDescuento === 'porcentaje' && numVal > 100) {
      setFormError('El porcentaje de descuento no puede ser superior al 100%.');
      return;
    }

    const numVig = Number(formData.vigenciaDias);
    if (!Number.isInteger(numVig) || numVig <= 0 || numVig > 730) {
      setFormError('La vigencia debe ser un número entero entre 1 y 730 días (máximo 2 años).');
      return;
    }

    let finalServices = ['todos'];
    if (formData.serviciosScope === 'especificos') {
      if (formData.serviciosSeleccionados.length === 0) {
        setFormError('Debes seleccionar al menos un servicio aplicable o elegir "Aplica a todos los servicios".');
        return;
      }
      finalServices = formData.serviciosSeleccionados;
    }

    let finalMontoMinimo: number | null = null;
    if (formData.montoMinimo.trim() !== '') {
      const mm = Number(formData.montoMinimo);
      if (isNaN(mm) || mm < 0) {
        setFormError('El monto mínimo debe ser un número positivo.');
        return;
      }
      finalMontoMinimo = mm > 0 ? mm : null;
    }

    setIsSaving(true);
    try {
      const payload = {
        nombrePublico: cleanNombre,
        descripcionPublica: formData.descripcionPublica.trim() || undefined,
        tipoDescuento: formData.tipoDescuento,
        valorDescuento: numVal,
        vigenciaDias: numVig,
        serviciosAplicables: finalServices,
        montoMinimo: finalMontoMinimo,
        activo: formData.activo
      };

      if (editingTemplate) {
        // Update
        const res = await fetch(`/api/benefit-templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        if (res.status === 401) {
          onAuthError?.();
          throw new Error('Sesión expirada o no autorizada.');
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al actualizar plantilla.');
        }
        const updated: BenefitTemplate = await res.json();
        setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
        showToast(`Plantilla "${updated.nombrePublico}" actualizada.`);
      } else {
        // Create
        const res = await fetch('/api/benefit-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        if (res.status === 401) {
          onAuthError?.();
          throw new Error('Sesión expirada o no autorizada.');
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al crear plantilla.');
        }
        const created: BenefitTemplate = await res.json();
        setTemplates(prev => [created, ...prev]);
        showToast(`Plantilla "${created.nombrePublico}" creada con éxito.`);
      }

      setIsModalOpen(false);
      setEditingTemplate(null);
    } catch (err: any) {
      console.error('Error saving benefit template:', err);
      setFormError(err.message || 'Error al guardar la plantilla.');
    } finally {
      setIsSaving(false);
    }
  };

  const getServiceName = (sId: string) => {
    const s = services.find(srv => srv.id === sId);
    return s ? s.nombre : sId;
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-3.5 bg-neutral-900 text-white text-xs rounded-xl shadow-lg flex items-center justify-between transition-all animate-fade-in border border-neutral-700">
          <span>{successToast}</span>
          <button 
            type="button" 
            onClick={() => setSuccessToast(null)}
            className="text-neutral-400 hover:text-white ml-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] border border-[#E8DCD5] flex items-center justify-center text-[#8E4455]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#241E1A]">
                Catálogo de Tipos de Beneficio
              </h2>
              <p className="text-xs text-[#7A6B62] mt-0.5">
                Definición de plantillas estándar reutilizables para otorgar descuentos y compensaciones a clientas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchTemplates}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white border border-[#D9C9BF] text-[#5A4B43] hover:text-[#241E1A] hover:bg-neutral-50 text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="Recargar catálogo"
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
            <span>Nueva Plantilla</span>
          </button>
        </div>
      </div>

      {/* Notice info banner */}
      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold">Información del Catálogo:</span> Las plantillas configuran el modelo de descuento y su período de validez. La vigencia en días <span className="font-medium">comenzará a contar individualmente</span> a partir del día en que el beneficio sea asignado a una clienta.
        </div>
      </div>

      {/* Metrics Row (Only shown when data loaded successfully without error) */}
      {!fetchError && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-[#E8DCD5] shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8C7A70] block">
              Total Plantillas
            </span>
            <span className="text-lg font-bold text-[#241E1A] mt-0.5 block">
              {metrics.total}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 block">
              Activas
            </span>
            <span className="text-lg font-bold text-emerald-700 mt-0.5 block">
              {metrics.active}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/40 shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 block">
              Inactivas
            </span>
            <span className="text-lg font-bold text-neutral-600 mt-0.5 block">
              {metrics.inactive}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-purple-100 bg-purple-50/20 shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-purple-700 block">
              Porcentaje (%)
            </span>
            <span className="text-lg font-bold text-purple-700 mt-0.5 block">
              {metrics.porcentaje}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-blue-100 bg-blue-50/20 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-700 block">
              Monto Fijo ($)
            </span>
            <span className="text-lg font-bold text-blue-700 mt-0.5 block">
              {metrics.montoFijo}
            </span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E8DCD5] shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8988F]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o descripción de beneficio..."
            className="w-full pl-10 pr-4 py-2 bg-[#FAF7F2] border border-[#E8DCD5] rounded-xl text-xs text-[#241E1A] placeholder-[#A8988F] focus:outline-hidden focus:border-[#8E4455] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8988F] hover:text-[#241E1A]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DCD5] rounded-xl text-xs text-[#241E1A] focus:outline-hidden focus:border-[#8E4455]"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Solo activas</option>
            <option value="inactive">Solo inactivas</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-[#FAF7F2] border border-[#E8DCD5] rounded-xl text-xs text-[#241E1A] focus:outline-hidden focus:border-[#8E4455]"
          >
            <option value="all">Todos los tipos</option>
            <option value="porcentaje">Porcentaje (%)</option>
            <option value="monto_fijo">Monto Fijo ($)</option>
          </select>
        </div>
      </div>

      {/* Templates List */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-xl border border-[#E8DCD5] text-center shadow-2xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#8E4455] mb-2" />
          <p className="text-xs text-[#7A6B62]">Cargando catálogo de beneficios...</p>
        </div>
      ) : fetchError ? (
        <div className="bg-white p-8 rounded-xl border border-rose-200 text-center shadow-2xs">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
          <p className="text-sm font-semibold text-rose-800">Error al cargar plantillas</p>
          <p className="text-xs text-rose-600 mt-1 mb-4">{fetchError}</p>
          <button
            type="button"
            onClick={fetchTemplates}
            className="px-4 py-2 bg-[#8E4455] text-white rounded-xl text-xs hover:bg-[#783645] cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-[#E8DCD5] text-center shadow-2xs">
          <Sparkles className="w-10 h-10 mx-auto text-[#C8B8AE] mb-3" />
          <h3 className="text-sm font-semibold text-[#241E1A]">
            {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No se encontraron plantillas'
              : 'Todavía no existen tipos de beneficio'}
          </h3>
          <p className="text-xs text-[#7A6B62] mt-1 max-w-md mx-auto">
            {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No hay plantillas que coincidan con los filtros aplicados.'
              : 'Aún no has creado plantillas de beneficios. Crea la primera para comenzar.'}
          </p>
          {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
              className="mt-4 px-3.5 py-2 bg-[#FAF7F2] border border-[#D9C9BF] text-[#241E1A] rounded-xl text-xs hover:bg-[#E8DCD5] cursor-pointer"
            >
              Limpiar Filtros
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="mt-4 px-4 py-2 bg-[#8E4455] text-white rounded-xl text-xs hover:bg-[#783645] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Plantilla</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => {
            const isToggling = togglingId === tpl.id;
            const isTodos = !tpl.serviciosAplicables || tpl.serviciosAplicables.includes('todos');

            return (
              <div 
                key={tpl.id}
                className={`bg-white rounded-2xl border transition-all shadow-2xs flex flex-col justify-between overflow-hidden ${
                  tpl.activo 
                    ? 'border-[#E8DCD5] hover:border-[#C8B8AE]' 
                    : 'border-neutral-200 bg-neutral-50/50 opacity-80'
                }`}
              >
                {/* Card Top */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    {/* Badge Discount */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#E8DCD5] text-xs font-bold text-[#8E4455]">
                      {tpl.tipoDescuento === 'porcentaje' ? (
                        <>
                          <Percent className="w-3.5 h-3.5" />
                          <span>{tpl.valorDescuento}% OFF</span>
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>${tpl.valorDescuento.toLocaleString('es-AR')} OFF</span>
                        </>
                      )}
                    </div>

                    {/* Active State Badge */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(tpl)}
                      disabled={isToggling}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                        tpl.activo 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                          : 'bg-neutral-100 text-neutral-600 border border-neutral-200 hover:bg-neutral-200'
                      }`}
                      title={tpl.activo ? 'Click para desactivar' : 'Click para activar'}
                    >
                      {isToggling ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : tpl.activo ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <X className="w-3 h-3 text-neutral-400" />
                      )}
                      <span>{tpl.activo ? 'Activa' : 'Inactiva'}</span>
                    </button>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm font-bold text-[#241E1A] leading-snug">
                      {tpl.nombrePublico}
                    </h3>
                    {tpl.descripcionPublica && (
                      <p className="text-xs text-[#7A6B62] mt-1 line-clamp-2">
                        {tpl.descripcionPublica}
                      </p>
                    )}
                  </div>

                  {/* Badges / Properties */}
                  <div className="pt-2 border-t border-[#F2EAE5] space-y-2 text-xs text-[#5A4B43]">
                    {/* Validity */}
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#8E4455] shrink-0" />
                      <span>Vigencia estándar: <strong className="font-semibold text-[#241E1A]">{tpl.vigenciaDias} días</strong> desde asignación</span>
                    </div>

                    {/* Min Spend */}
                    {tpl.montoMinimo != null && tpl.montoMinimo > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#8E4455] shrink-0" />
                        <span>Monto mínimo de reserva: <strong className="font-semibold text-[#241E1A]">${tpl.montoMinimo.toLocaleString('es-AR')}</strong></span>
                      </div>
                    )}

                    {/* Applicable Services */}
                    <div className="flex items-start gap-1.5 pt-1">
                      <Scissors className="w-3.5 h-3.5 text-[#8E4455] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-[11px] text-[#7A6B62] block mb-1">Servicios aplicables:</span>
                        {isTodos ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#E8DCD5] text-[11px] font-medium text-[#5A4B43]">
                            Todos los servicios
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {tpl.serviciosAplicables.slice(0, 3).map(sId => (
                              <span 
                                key={sId}
                                className="inline-block px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#E8DCD5] text-[10px] font-medium text-[#5A4B43]"
                              >
                                {getServiceName(sId)}
                              </span>
                            ))}
                            {tpl.serviciosAplicables.length > 3 && (
                              <span className="inline-block px-1.5 py-0.5 rounded-md bg-neutral-100 text-[10px] text-neutral-600">
                                +{tpl.serviciosAplicables.length - 3} más
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-4 py-2.5 bg-[#FAF7F2]/60 border-t border-[#E8DCD5] flex items-center justify-between">
                  <span className="text-[10px] text-[#A8988F]">
                    ID: {tpl.id}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenModal(tpl)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#D9C9BF] text-[#241E1A] hover:bg-[#FAF7F2] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
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

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-[#E8DCD5] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E8DCD5] flex items-center justify-between bg-[#FAF7F2]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white border border-[#E8DCD5] flex items-center justify-center text-[#8E4455]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#241E1A]">
                    {editingTemplate ? 'Editar Plantilla de Beneficio' : 'Nueva Plantilla de Beneficio'}
                  </h3>
                  <p className="text-[11px] text-[#7A6B62]">
                    Catálogo administrativo de beneficios reutilizables
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSaving}
                className="text-[#8C7A70] hover:text-[#241E1A] p-1.5 rounded-lg hover:bg-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Nombre Público */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Nombre Público del Beneficio <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-[#8C7A70]">
                    {formData.nombrePublico.length} / 200
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={formData.nombrePublico}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombrePublico: e.target.value }))}
                  placeholder="Ej: 20% de descuento en tu próxima visita"
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8DCD5] rounded-xl text-xs text-[#241E1A] focus:outline-hidden focus:border-[#8E4455] transition-colors"
                />
                <p className="text-[11px] text-[#7A6B62] mt-1">
                  Este es el título que verá la clienta cuando se le asigne este beneficio.
                </p>
              </div>

              {/* Descripción Pública */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Descripción Pública <span className="text-[#A8988F] font-normal">(Opcional)</span>
                  </label>
                  <span className="text-[10px] text-[#8C7A70]">
                    {formData.descripcionPublica.length} / 500
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={formData.descripcionPublica}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcionPublica: e.target.value }))}
                  placeholder="Ej: Descuento de cortesía para cualquier servicio en nuestro salón."
                  className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#E8DCD5] rounded-xl text-xs text-[#241E1A] focus:outline-hidden focus:border-[#8E4455] transition-colors resize-none"
                />
              </div>

              {/* Tipo y Valor de Descuento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#241E1A] mb-1">
                    Tipo de Descuento <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#FAF7F2] border border-[#E8DCD5] rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tipoDescuento: 'porcentaje' }))}
                      className={`py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
                        formData.tipoDescuento === 'porcentaje'
                          ? 'bg-[#8E4455] text-white shadow-2xs'
                          : 'text-[#5A4B43] hover:text-[#241E1A]'
                      }`}
                    >
                      <Percent className="w-3 h-3" />
                      <span>Porcentaje</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tipoDescuento: 'monto_fijo' }))}
                      className={`py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
                        formData.tipoDescuento === 'monto_fijo'
                          ? 'bg-[#8E4455] text-white shadow-2xs'
                          : 'text-[#5A4B43] hover:text-[#241E1A]'
                      }`}
                    >
                      <DollarSign className="w-3 h-3" />
                      <span>Monto Fijo</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#241E1A] mb-1">
                    {formData.tipoDescuento === 'porcentaje' ? 'Porcentaje (%)' : 'Monto Fijo ($ ARS)'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      max={formData.tipoDescuento === 'porcentaje' ? '100' : undefined}
                      step={formData.tipoDescuento === 'porcentaje' ? '1' : '100'}
                      value={formData.valorDescuento}
                      onChange={(e) => setFormData(prev => ({ ...prev, valorDescuento: e.target.value }))}
                      className="w-full pl-8 pr-3.5 py-2 bg-[#FAF7F2] border border-[#E8DCD5] rounded-xl text-xs text-[#241E1A] focus:outline-hidden focus:border-[#8E4455] transition-colors"
                      placeholder={formData.tipoDescuento === 'porcentaje' ? '20' : '5000'}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8E4455]">
                      {formData.tipoDescuento === 'porcentaje' ? '%' : '$'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vigencia en días y Monto Mínimo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#241E1A] mb-1">
                    Vigencia (Días) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      max="730"
                      value={formData.vigenciaDias}
                      onChange={(e) => setFormData(prev => ({ ...prev, vigenciaDias: e.target.value }))}
                      className="w-full pl-8 pr-3.5 py-2 bg-[#FAF7F2] border border-[#E8DCD5] rounded-xl text-xs text-[#241E1A] focus:outline-hidden focus:border-[#8E4455] transition-colors"
                      placeholder="30"
                    />
                    <Clock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E4455]" />
                  </div>
                  <p className="text-[10px] text-[#7A6B62] mt-1">
                    Días de validez a partir de la emisión a la clienta.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#241E1A] mb-1">
                    Monto Mínimo de Turno <span className="text-[#A8988F] font-normal">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={formData.montoMinimo}
                      onChange={(e) => setFormData(prev => ({ ...prev, montoMinimo: e.target.value }))}
                      className="w-full pl-8 pr-3.5 py-2 bg-[#FAF7F2] border border-[#E8DCD5] rounded-xl text-xs text-[#241E1A] focus:outline-hidden focus:border-[#8E4455] transition-colors"
                      placeholder="Sin mínimo"
                    />
                    <DollarSign className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E4455]" />
                  </div>
                  <p className="text-[10px] text-[#7A6B62] mt-1">
                    Dejar vacío si aplica sin restricción de valor.
                  </p>
                </div>
              </div>

              {/* Servicios Aplicables */}
              <div className="space-y-2 pt-2 border-t border-[#F2EAE5]">
                <label className="block text-xs font-semibold text-[#241E1A]">
                  Servicios Aplicables
                </label>

                <div className="flex gap-4 text-xs">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="serviciosScope"
                      checked={formData.serviciosScope === 'todos'}
                      onChange={() => setFormData(prev => ({ ...prev, serviciosScope: 'todos', serviciosSeleccionados: [] }))}
                      className="text-[#8E4455] focus:ring-[#8E4455]"
                    />
                    <span className="text-[#241E1A]">Aplica a todos los servicios</span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="serviciosScope"
                      checked={formData.serviciosScope === 'especificos'}
                      onChange={() => setFormData(prev => ({ ...prev, serviciosScope: 'especificos' }))}
                      className="text-[#8E4455] focus:ring-[#8E4455]"
                    />
                    <span className="text-[#241E1A]">Servicios específicos</span>
                  </label>
                </div>

                {formData.serviciosScope === 'especificos' && (
                  <div className="p-3 bg-[#FAF7F2] border border-[#E8DCD5] rounded-xl max-h-36 overflow-y-auto space-y-1.5 mt-2">
                    {services.map(srv => {
                      const isChecked = formData.serviciosSeleccionados.includes(srv.id);
                      return (
                        <label key={srv.id} className="flex items-center gap-2 text-xs text-[#241E1A] cursor-pointer hover:bg-white/60 p-1 rounded-md">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFormData(prev => ({
                                ...prev,
                                serviciosSeleccionados: isChecked
                                  ? prev.serviciosSeleccionados.filter(id => id !== srv.id)
                                  : [...prev.serviciosSeleccionados, srv.id]
                              }));
                            }}
                            className="rounded text-[#8E4455] focus:ring-[#8E4455]"
                          />
                          <span className="flex-1">{srv.nombre}</span>
                          <span className="text-[10px] text-[#8C7A70]">${srv.precio.toLocaleString('es-AR')}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Activo / Inactivo Switch */}
              <div className="pt-2 border-t border-[#F2EAE5] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#241E1A] block">
                    Estado de la Plantilla
                  </span>
                  <span className="text-[11px] text-[#7A6B62]">
                    Permite o pausa la utilización de este tipo de beneficio para nuevas emisiones.
                  </span>
                </div>

                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-neutral-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8E4455]"></div>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-[#E8DCD5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl border border-[#D9C9BF] text-[#5A4B43] hover:text-[#241E1A] hover:bg-neutral-50 text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#8E4455] text-white hover:bg-[#783645] text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingTemplate ? 'Actualizar Plantilla' : 'Crear Plantilla'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
