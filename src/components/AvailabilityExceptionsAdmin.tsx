import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
  Store,
  RefreshCw,
  Info,
  CalendarCheck,
  Ban,
  ArrowRight,
  History,
  Gift,
  Tag,
  Percent,
  Check
} from 'lucide-react';
import type { 
  Professional, 
  AvailabilityException, 
  ScheduleScope, 
  AvailabilityExceptionType, 
  TimeInterval,
  BenefitTemplate
} from '../types.js';
import { 
  getBusinessDate, 
  isoDateToAR, 
  formatDateWithWeekdayAR,
  addDaysToIsoDate
} from '../utils/dateUtils.js';

interface AvailabilityExceptionsAdminProps {
  professionals?: Professional[];
  onRefreshData?: () => void;
  onAuthError?: () => void;
}

interface CoverageModalData {
  fecha: string;
  isStudioClosed: boolean;
  profNames: string[];
  profIntervalos: TimeInterval[];
  studioIntervals: TimeInterval[];
  uncoveredIntervals: TimeInterval[];
  requiredStudioIntervals: TimeInterval[];
  studioDesc: string;
  profDesc: string;
}

interface ConflictModalData {
  fecha: string;
  conflicts: any[];
  payload: any;
}

const getTodayIso = () => {
  return getBusinessDate();
};

const formatDateFriendly = (isoDate: string) => {
  return formatDateWithWeekdayAR(isoDate);
};

export const AvailabilityExceptionsAdmin: React.FC<AvailabilityExceptionsAdminProps> = ({
  professionals = [],
  onRefreshData,
  onAuthError
}) => {
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isExtendingStudio, setIsExtendingStudio] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formFecha, setFormFecha] = useState<string>(getTodayIso());
  const [formAlcance, setFormAlcance] = useState<ScheduleScope>('local');
  const [formSelectedProfIds, setFormSelectedProfIds] = useState<string[]>([]);
  const [formTipo, setFormTipo] = useState<AvailabilityExceptionType>('horario_especial');
  const [formIntervalos, setFormIntervalos] = useState<TimeInterval[]>([
    { inicio: '09:00', fin: '19:00' }
  ]);
  const [formMotivo, setFormMotivo] = useState<string>('');

  // Cartel / Modal state when professional exception exceeds studio schedule
  const [coverageModalData, setCoverageModalData] = useState<CoverageModalData | null>(null);
  const [conflictModalData, setConflictModalData] = useState<ConflictModalData | null>(null);
  const [isCancellingConflicts, setIsCancellingConflicts] = useState<boolean>(false);

  // Compensation Benefit State for Conflicting Appointments
  const [benefitTemplates, setBenefitTemplates] = useState<BenefitTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(false);
  const [attachBenefit, setAttachBenefit] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<string[]>([]);

  // Load exceptions
  const loadExceptions = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/excepciones-disponibilidad', { credentials: 'include' });
      if (res.status === 401) {
        onAuthError?.();
        return;
      }
      if (res.ok) {
        const list: AvailabilityException[] = await res.json();
        setExceptions(list);
      }
    } catch (err) {
      console.error('Error loading availability exceptions:', err);
      setErrorMsg('Error al cargar excepciones de disponibilidad.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load active benefit templates
  const loadBenefitTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await fetch('/api/benefit-templates', { credentials: 'include' });
      if (res.status === 401) {
        onAuthError?.();
        return;
      }
      if (res.ok) {
        const list: BenefitTemplate[] = await res.json();
        const activeList = list.filter(t => t.activo);
        setBenefitTemplates(activeList);
        if (activeList.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(activeList[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading benefit templates:', err);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadExceptions();
    loadBenefitTemplates();
  }, []);

  // Split into future/today vs past historical exceptions
  const today = getTodayIso();
  const { upcomingExceptions, pastExceptions } = useMemo(() => {
    const upcoming: AvailabilityException[] = [];
    const past: AvailabilityException[] = [];

    exceptions.forEach(exc => {
      if (exc.fecha >= today) {
        upcoming.push(exc);
      } else {
        past.push(exc);
      }
    });

    upcoming.sort((a, b) => a.fecha.localeCompare(b.fecha));
    past.sort((a, b) => b.fecha.localeCompare(a.fecha));

    return { upcomingExceptions: upcoming, pastExceptions: past };
  }, [exceptions, today]);

  // Interval handlers
  const handleAddInterval = () => {
    setFormIntervalos(prev => {
      const last = prev[prev.length - 1];
      const nextStart = last ? last.fin : '15:00';
      const [h, m] = nextStart.split(':').map(Number);
      const endH = Math.min(23, (h || 15) + 4);
      return [...prev, { inicio: nextStart, fin: `${String(endH).padStart(2, '0')}:00` }];
    });
  };

  const handleRemoveInterval = (index: number) => {
    setFormIntervalos(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateInterval = (index: number, field: 'inicio' | 'fin', value: string) => {
    setFormIntervalos(prev => prev.map((int, i) => i === index ? { ...int, [field]: value } : int));
  };

  // Toggle professional in multiple selection
  const handleToggleProf = (profId: string) => {
    setFormSelectedProfIds(prev => 
      prev.includes(profId) ? prev.filter(id => id !== profId) : [...prev, profId]
    );
  };

  const handleSelectAllProfs = () => {
    setFormSelectedProfIds(professionals.map(p => p.id));
  };

  const handleClearProfs = () => {
    setFormSelectedProfIds([]);
  };

  // Internal Save Execution
  const executeSaveException = async (forceCancel = false) => {
    const payloadToUse = conflictModalData ? conflictModalData.payload : {
      alcance: formAlcance,
      profesionalId: formAlcance === 'profesional' && formSelectedProfIds.length === 1 ? formSelectedProfIds[0] : undefined,
      profesionalIds: formAlcance === 'profesional' ? formSelectedProfIds : undefined,
      fecha: formFecha,
      tipo: formTipo,
      intervalos: formTipo === 'horario_especial' ? formIntervalos : [],
      motivo: formMotivo.trim() || undefined
    };

    const res = await fetch('/api/excepciones-disponibilidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...payloadToUse,
        forceCancelConflicts: forceCancel,
        adjuntarBeneficio: forceCancel ? attachBenefit : false,
        benefitTemplateId: forceCancel && attachBenefit ? selectedTemplateId : undefined,
        benefitAppointmentIds: forceCancel && attachBenefit ? selectedAppointmentIds : undefined
      })
    });

    if (res.status === 401) {
      onAuthError?.();
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Error al registrar la excepción.');
    }

    const data = await res.json().catch(() => ({}));
    const cancelledCount = data.cancelledCount || 0;
    const issuedBenefitsCount = data.issuedBenefitsCount || 0;

    let msg = `¡Excepción de disponibilidad para el ${isoDateToAR(formFecha)} guardada con éxito!`;
    if (cancelledCount > 0) {
      msg = `¡Excepción guardada! Se cancelaron ${cancelledCount} turno(s) afectado(s) correctamente.`;
      if (issuedBenefitsCount > 0) {
        msg += ` Se otorgaron ${issuedBenefitsCount} beneficio(s) de compensación.`;
      }
    }

    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 6000);
    setIsFormOpen(false);
    setFormMotivo('');
    setFormSelectedProfIds([]);
    setConflictModalData(null);
    setAttachBenefit(false);
    setSelectedAppointmentIds([]);
    await loadExceptions();
    if (onRefreshData) onRefreshData();
  };

  const handleConfirmConflictModal = async () => {
    if (attachBenefit) {
      if (!selectedTemplateId) {
        setErrorMsg('Seleccioná una plantilla de beneficio para otorgar la compensación.');
        return;
      }
      if (selectedAppointmentIds.length === 0) {
        setErrorMsg('Seleccioná al menos un turno para recibir el beneficio o desactivá la compensación.');
        return;
      }
    }

    setIsCancellingConflicts(true);
    setErrorMsg(null);
    try {
      await executeSaveException(true);
    } catch (err: any) {
      console.error('Error confirming conflict modal:', err);
      setErrorMsg(err.message || 'No se pudo aplicar la excepción y cancelar los turnos.');
    } finally {
      setIsCancellingConflicts(false);
    }
  };

  const handleCancelConflictModal = () => {
    setConflictModalData(null);
    setAttachBenefit(false);
    setSelectedAppointmentIds([]);
  };

  // Submit Exception Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!formFecha) {
      setErrorMsg('Seleccioná la fecha de la excepción.');
      return;
    }

    if (formAlcance === 'profesional' && formSelectedProfIds.length === 0) {
      setErrorMsg('Seleccioná al menos un profesional para esta excepción.');
      return;
    }

    if (formTipo === 'horario_especial') {
      if (formIntervalos.length === 0) {
        setErrorMsg('Agregá al menos un intervalo de horario especial.');
        return;
      }
      for (const int of formIntervalos) {
        if (!int.inicio || !int.fin) {
          setErrorMsg('Completá los horarios de inicio y fin de cada intervalo.');
          return;
        }
        if (int.inicio >= int.fin) {
          setErrorMsg(`La hora de inicio (${int.inicio}) debe ser menor que la hora de fin (${int.fin}).`);
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        alcance: formAlcance,
        profesionalId: formAlcance === 'profesional' && formSelectedProfIds.length === 1 ? formSelectedProfIds[0] : undefined,
        profesionalIds: formAlcance === 'profesional' ? formSelectedProfIds : undefined,
        fecha: formFecha,
        tipo: formTipo,
        intervalos: formTipo === 'horario_especial' ? formIntervalos : [],
        motivo: formMotivo.trim() || undefined
      };

      // 1. Check for conflicting appointments
      const checkConflictsRes = await fetch('/api/excepciones-disponibilidad/check-conflictos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (checkConflictsRes.status === 401) {
        onAuthError?.();
        return;
      }

      if (checkConflictsRes.ok) {
        const conflictData = await checkConflictsRes.json();
        if (conflictData.hasConflicts && conflictData.conflicts.length > 0) {
          setConflictModalData({
            fecha: formFecha,
            conflicts: conflictData.conflicts,
            payload
          });
          setSelectedAppointmentIds(conflictData.conflicts.map((c: any) => c.id));
          setAttachBenefit(false);
          if (benefitTemplates.length > 0) {
            setSelectedTemplateId(benefitTemplates[0].id);
          } else {
            loadBenefitTemplates();
          }
          setIsSubmitting(false);
          return;
        }
      }

      // If configuring special hours for professionals, check coverage against studio schedule
      if (formAlcance === 'profesional' && formTipo === 'horario_especial') {
        const checkRes = await fetch('/api/excepciones-disponibilidad/check-cobertura', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fecha: formFecha,
            profesionalIntervalos: formIntervalos
          })
        });

        if (checkRes.status === 401) {
          onAuthError?.();
          return;
        }

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.exceedsStudio) {
            const selectedNames = professionals
              .filter(p => formSelectedProfIds.includes(p.id))
              .map(p => `${p.nombre} ${p.apellido}`);

            setCoverageModalData({
              fecha: formFecha,
              isStudioClosed: checkData.isStudioClosed,
              profNames: selectedNames,
              profIntervalos: formIntervalos,
              studioIntervals: checkData.studioEffectiveIntervals || [],
              uncoveredIntervals: checkData.uncoveredIntervals || [],
              requiredStudioIntervals: checkData.requiredStudioIntervals || formIntervalos,
              studioDesc: checkData.studioScheduleDescription || 'Cerrado',
              profDesc: checkData.professionalScheduleDescription || ''
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

      await executeSaveException(false);
    } catch (err: any) {
      console.error('Error creating availability exception:', err);
      setErrorMsg(err.message || 'Error al guardar la excepción de disponibilidad.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modal Action: Auto extend studio and save professional exception together
  const handleConfirmExtendStudioAndSave = async () => {
    if (!coverageModalData) return;
    setIsExtendingStudio(true);
    setErrorMsg(null);

    try {
      // 1. Extend Studio Schedule as an exception for this date
      const extRes = await fetch('/api/excepciones-disponibilidad/auto-extender-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fecha: coverageModalData.fecha,
          requiredIntervals: coverageModalData.requiredStudioIntervals,
          motivo: `Apertura extendida del salón para cubrir atención de profesionales (${formMotivo || 'Excepción especial'})`
        })
      });

      if (extRes.status === 401) {
        onAuthError?.();
        return;
      }

      if (!extRes.ok) {
        const data = await extRes.json().catch(() => ({}));
        throw new Error(data.error || 'Error al extender el horario del salón.');
      }

      // 2. Save the Professional Exception
      await executeSaveException();

      // 3. Close modal and show compound success message
      setCoverageModalData(null);
      setSuccessMsg(`¡Horario del salón extendido y excepción de disponibilidad guardada con éxito para el ${isoDateToAR(coverageModalData.fecha)}!`);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error('Error extending studio and saving professional exception:', err);
      setErrorMsg(err.message || 'No se pudo completar la operación.');
    } finally {
      setIsExtendingStudio(false);
    }
  };

  // Modal Action: Cancel without applying any changes
  const handleCancelCoverageModal = () => {
    setCoverageModalData(null);
  };

  // Delete Exception
  const handleDeleteException = async (exc: AvailabilityException) => {
    if (exc.fecha < today) {
      setErrorMsg('No es posible eliminar o alterar excepciones que ya pertenecen al histórico.');
      return;
    }

    try {
      const res = await fetch(`/api/excepciones-disponibilidad/${exc.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.status === 401) {
        onAuthError?.();
        return;
      }
      if (res.ok) {
        setSuccessMsg('Excepción eliminada con éxito.');
        setTimeout(() => setSuccessMsg(null), 4000);
        await loadExceptions();
        if (onRefreshData) onRefreshData();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || 'No se pudo eliminar la excepción.');
      }
    } catch (err) {
      console.error('Error deleting exception:', err);
      setErrorMsg('Error de conexión al eliminar la excepción.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DCD5] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-[#E8DCD5] flex items-center justify-center text-[#8E4455] shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E4455]">
                  Gestión de Fechas Específicas
                </span>
                <span className="text-xs text-[#7A6B62] bg-[#FAF7F2] px-2 py-0.5 rounded-full border border-[#E8DCD5]">
                  Aislado por Fecha
                </span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#241E1A]">
                Excepciones de disponibilidad
              </h3>
              <p className="text-xs text-[#7A6B62] mt-0.5">
                Definí fechas puntuales con horarios especiales o cierres sin alterar el cronograma semanal habitual ni el historial.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsFormOpen(prev => !prev);
              setErrorMsg(null);
            }}
            className="px-5 py-2.5 rounded-2xl bg-[#8E4455] hover:bg-[#783645] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isFormOpen ? 'Cerrar Formulario' : 'Nueva Excepción de Disponibilidad'}</span>
          </button>
        </div>
      </div>

      {/* Global feedback messages */}
      {errorMsg && (
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* CREATE FORM */}
      {isFormOpen && (
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DCD5] shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#E8DCD5]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#8E4455]" />
              <h4 className="font-serif font-bold text-lg text-[#241E1A]">
                Configurar Nueva Excepción de Disponibilidad
              </h4>
            </div>
            <span className="text-[11px] text-[#7A6B62] bg-[#FAF7F2] px-2.5 py-1 rounded-full border border-[#E8DCD5]">
              Afecta exclusivamente a la fecha indicada
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Fecha */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#241E1A]">
                  1. Fecha de la Excepción:
                </label>
                <input
                  type="date"
                  value={formFecha}
                  min={today}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs font-semibold text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  required
                />
                <p className="text-[11px] text-[#7A6B62]">
                  La regla aplicará únicamente en esta fecha calendario sin alterar los demás días.
                </p>
              </div>

              {/* Alcance */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#241E1A]">
                  2. Alcance de la Excepción:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormAlcance('local');
                      setFormSelectedProfIds([]);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      formAlcance === 'local'
                        ? 'bg-[#8E4455] text-white border-[#8E4455] shadow-xs'
                        : 'bg-[#FAF7F2] text-[#5A4B43] border-[#E8DCD5] hover:bg-[#E8DCD5]'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Salón Completo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAlcance('profesional')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      formAlcance === 'profesional'
                        ? 'bg-[#8E4455] text-white border-[#8E4455] shadow-xs'
                        : 'bg-[#FAF7F2] text-[#5A4B43] border-[#E8DCD5] hover:bg-[#E8DCD5]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Profesionales</span>
                  </button>
                </div>
              </div>
            </div>

            {/* If Alcance === 'profesional', show multi-select list */}
            {formAlcance === 'profesional' && (
              <div className="bg-[#FAF7F2] p-4 sm:p-5 rounded-2xl border border-[#E8DCD5] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#8E4455]" />
                    <span className="text-xs font-semibold text-[#241E1A]">
                      Selección Múltiple de Profesionales ({formSelectedProfIds.length} seleccionadas):
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllProfs}
                      className="text-[10px] text-[#8E4455] hover:underline font-medium cursor-pointer"
                    >
                      Seleccionar todas
                    </button>
                    <span className="text-stone-300">·</span>
                    <button
                      type="button"
                      onClick={handleClearProfs}
                      className="text-[10px] text-stone-500 hover:underline font-medium cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {professionals.map(prof => {
                    const isSelected = formSelectedProfIds.includes(prof.id);
                    return (
                      <button
                        key={prof.id}
                        type="button"
                        onClick={() => handleToggleProf(prof.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-[#8E4455] shadow-xs ring-1 ring-[#8E4455]'
                            : 'bg-white/60 border-[#E8DCD5] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: prof.colorAgenda || '#8E4455' }}
                          />
                          <div className="truncate">
                            <p className="text-xs font-semibold text-[#241E1A] truncate">
                              {prof.nombre} {prof.apellido}
                            </p>
                            <p className="text-[10px] text-[#7A6B62] truncate">
                              {prof.titulo || 'Profesional'}
                            </p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                          isSelected ? 'bg-[#8E4455] text-white border-[#8E4455]' : 'border-[#D9C9BF]'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tipo de excepción */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#241E1A]">
                3. Tipo de Excepción:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormTipo('horario_especial')}
                  className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                    formTipo === 'horario_especial'
                      ? 'bg-white border-[#8E4455] shadow-xs ring-1 ring-[#8E4455]'
                      : 'bg-[#FAF7F2] border-[#E8DCD5] hover:bg-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#8E4455] flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#241E1A]">
                      Horario Especial / Jornada Extendida
                    </p>
                    <p className="text-[11px] text-[#7A6B62] mt-0.5">
                      Define uno o varios tramos específicos para atender en esta fecha (ej: 09:00 a 20:00 hs).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormTipo('cerrado')}
                  className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                    formTipo === 'cerrado'
                      ? 'bg-white border-rose-600 shadow-xs ring-1 ring-rose-600'
                      : 'bg-[#FAF7F2] border-[#E8DCD5] hover:bg-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <Ban className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#241E1A]">
                      Cerrado / No Disponible
                    </p>
                    <p className="text-[11px] text-[#7A6B62] mt-0.5">
                      Bloquea la fecha completa por feriado, capacitación, mantenimiento o ausencia del profesional.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Intervals if Horario Especial */}
            {formTipo === 'horario_especial' && (
              <div className="bg-[#FAF7F2] p-4 sm:p-5 rounded-2xl border border-[#E8DCD5] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#241E1A] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#8E4455]" />
                    <span>Tramos de Horario Especial para esta fecha:</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddInterval}
                    className="text-xs font-semibold text-[#8E4455] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar otro tramo</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formIntervalos.map((interval, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-[#E8DCD5]">
                      <span className="text-xs font-mono text-[#8C7A70] shrink-0">Tramo {idx + 1}:</span>
                      <input
                        type="time"
                        value={interval.inicio}
                        onChange={(e) => handleUpdateInterval(idx, 'inicio', e.target.value)}
                        className="px-2 py-1 rounded-lg bg-[#FAF7F2] border border-[#D9C9BF] text-xs font-semibold text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                        required
                      />
                      <span className="text-xs text-[#8C7A70] font-bold">a</span>
                      <input
                        type="time"
                        value={interval.fin}
                        onChange={(e) => handleUpdateInterval(idx, 'fin', e.target.value)}
                        className="px-2 py-1 rounded-lg bg-[#FAF7F2] border border-[#D9C9BF] text-xs font-semibold text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                        required
                      />
                      {formIntervalos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveInterval(idx)}
                          className="p-1 text-stone-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer ml-auto"
                          title="Eliminar tramo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Motivo */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#241E1A]">
                4. Motivo o Descripción (Opcional):
              </label>
              <input
                type="text"
                value={formMotivo}
                onChange={(e) => setFormMotivo(e.target.value)}
                placeholder="Ej: Feriado Nacional, Capacitación Soft Gel, Horario extendido previa Navidad..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
              />
            </div>

            {/* Submit button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8DCD5]">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#5A4B43] hover:bg-[#FAF7F2] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-[#8E4455] hover:bg-[#783645] text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verificando y Guardando...</span>
                  </>
                ) : (
                  <>
                    <CalendarCheck className="w-4 h-4" />
                    <span>Guardar Excepción de Disponibilidad</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL / CARTEL: ADVERTENCIA DE HORARIO EXCEDIDO DEL SALÓN */}
      {coverageModalData && (
        <div
          id="modal-cobertura-salon"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl border border-[#E8DCD5] shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-lg text-[#241E1A] leading-snug">
                  El horario seleccionado supera el horario del salón
                </h3>
                <p className="text-xs text-[#7A6B62]">
                  Para que las profesionales atiendan en este día y horario, el salón también necesita registrar una excepción de apertura.
                </p>
              </div>
            </div>

            {/* Details Box */}
            <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DCD5] space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[#E8DCD5]/70">
                <span className="text-[#7A6B62] font-medium">Fecha:</span>
                <span className="font-semibold text-[#241E1A] capitalize">
                  {formatDateFriendly(coverageModalData.fecha)}
                </span>
              </div>

              {coverageModalData.profNames.length > 0 && (
                <div className="flex items-start justify-between py-1 border-b border-[#E8DCD5]/70">
                  <span className="text-[#7A6B62] font-medium shrink-0">Profesionales:</span>
                  <span className="font-semibold text-[#241E1A] text-right">
                    {coverageModalData.profNames.join(', ')}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between py-1 border-b border-[#E8DCD5]/70">
                <span className="text-[#7A6B62] font-medium shrink-0">Horario de profesionales:</span>
                <span className="font-mono font-semibold text-[#8E4455] text-right">
                  {coverageModalData.profDesc}
                </span>
              </div>

              <div className="flex items-start justify-between py-1 border-b border-[#E8DCD5]/70">
                <span className="text-[#7A6B62] font-medium shrink-0">Horario actual del salón:</span>
                <span className="font-mono font-semibold text-[#241E1A] text-right">
                  {coverageModalData.studioDesc}
                </span>
              </div>

              {/* Exceeded Intervals List */}
              <div className="pt-1">
                <p className="font-semibold text-amber-900 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Días y horarios que se exceden (Lista):</span>
                </p>
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 space-y-1.5">
                  {coverageModalData.isStudioClosed ? (
                    <div className="flex items-center gap-2 text-amber-950 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                      <span>El salón figura cerrado todo el día ({isoDateToAR(coverageModalData.fecha)})</span>
                    </div>
                  ) : coverageModalData.uncoveredIntervals.length > 0 ? (
                    coverageModalData.uncoveredIntervals.map((int, i) => (
                      <div key={i} className="flex items-center justify-between text-amber-950">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                          <span className="font-mono font-bold">{int.inicio} a {int.fin} hs</span>
                        </div>
                        <span className="text-[11px] text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md font-medium">
                          Supera atención del salón
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 text-amber-950">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                      <span>Los tramos solicitados no coinciden con la apertura del salón.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Solution hint */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-emerald-900 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Al extender, se creará también una excepción de disponibilidad para el salón de{' '}
                  <strong>
                    {coverageModalData.requiredStudioIntervals.map(i => `${i.inicio} a ${i.fin} hs`).join(', ')}
                  </strong>{' '}
                  en esa fecha puntual.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isExtendingStudio}
                onClick={handleCancelCoverageModal}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#D9C9BF] text-xs font-semibold text-[#5A4B43] hover:bg-[#FAF7F2] transition-colors cursor-pointer disabled:opacity-50 text-center"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isExtendingStudio}
                onClick={handleConfirmExtendStudioAndSave}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#8E4455] hover:bg-[#783645] text-white text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExtendingStudio ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Extendiendo salón y guardando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Extender disponibilidad del salón y guardar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFLICT WARNING MODAL FOR RESTRICTIVE EXCEPTIONS */}
      {conflictModalData && (() => {
        const selectedTemplate = benefitTemplates.find(t => t.id === selectedTemplateId);
        const calculatedExpiryIso = selectedTemplate ? addDaysToIsoDate(getBusinessDate(), selectedTemplate.vigenciaDias) : '';
        const calculatedExpiryFormatted = calculatedExpiryIso ? isoDateToAR(calculatedExpiryIso) : '';
        const allConflictIds = conflictModalData.conflicts.map((c: any) => c.id);
        const isAllSelected = allConflictIds.length > 0 && allConflictIds.every((id: string) => selectedAppointmentIds.includes(id));

        const toggleAppointmentBenefit = (aptId: string) => {
          setSelectedAppointmentIds(prev => 
            prev.includes(aptId) ? prev.filter(id => id !== aptId) : [...prev, aptId]
          );
        };

        const handleSelectAllAppointmentBenefits = () => {
          setSelectedAppointmentIds(allConflictIds);
        };

        const handleDeselectAllAppointmentBenefits = () => {
          setSelectedAppointmentIds([]);
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#E8DCD5] space-y-6 animate-in fade-in zoom-in-95 duration-200 my-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-700">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif font-bold text-xl text-[#241E1A]">
                    Turnos afectados detectados
                  </h3>
                  <p className="text-sm text-[#7A6B62]">
                    La excepción restrictiva para el <strong className="text-[#241E1A]">{formatDateFriendly(conflictModalData.fecha)}</strong> cancelará los siguientes turnos confirmados:
                  </p>
                </div>
              </div>

              {/* List grouped by professional */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#5A4B43]">
                    Listado de turnos ({conflictModalData.conflicts.length})
                  </span>
                  {attachBenefit && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={isAllSelected ? handleDeselectAllAppointmentBenefits : handleSelectAllAppointmentBenefits}
                        className="text-[#8E4455] hover:underline font-semibold cursor-pointer"
                      >
                        {isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                      <span className="text-[#7A6B62]">
                        ({selectedAppointmentIds.length} seleccionados para compensar)
                      </span>
                    </div>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-3 pr-1 border border-[#E8DCD5] rounded-2xl p-3 bg-[#FAF7F2]/50">
                  {Object.entries(
                    conflictModalData.conflicts.reduce((acc: Record<string, any[]>, apt: any) => {
                      const profName = apt.profesionalNombre || professionals.find(p => p.id === apt.profesionalId)?.nombre || 'Salón / Sin asignar';
                      if (!acc[profName]) acc[profName] = [];
                      acc[profName].push(apt);
                      return acc;
                    }, {})
                  ).map(([profName, apts]: [string, any[]]) => (
                    <div key={profName} className="bg-white p-3.5 rounded-xl border border-[#E8DCD5] space-y-2.5">
                      <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-[#8E4455] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {profName} ({apts.length} {apts.length === 1 ? 'turno' : 'turnos'})
                      </h4>
                      <div className="space-y-2">
                        {apts.map((apt: any) => {
                          const isBenefitSelected = selectedAppointmentIds.includes(apt.id);
                          return (
                            <div 
                              key={apt.id} 
                              className={`p-2.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                                attachBenefit && isBenefitSelected
                                  ? 'bg-rose-50/40 border-rose-200'
                                  : 'bg-[#FAF7F2] border-[#E8DCD5]'
                              }`}
                            >
                              <div className="flex items-start sm:items-center gap-2.5">
                                {attachBenefit && (
                                  <input
                                    type="checkbox"
                                    id={`apt-benefit-${apt.id}`}
                                    checked={isBenefitSelected}
                                    onChange={() => toggleAppointmentBenefit(apt.id)}
                                    className="mt-0.5 sm:mt-0 w-4 h-4 rounded border-[#D9C9BF] text-[#8E4455] focus:ring-[#8E4455] cursor-pointer"
                                  />
                                )}
                                <div className="space-y-0.5">
                                  <label 
                                    htmlFor={`apt-benefit-${apt.id}`}
                                    className="font-semibold text-[#241E1A] cursor-pointer flex items-center gap-1.5"
                                  >
                                    <span>{apt.nombre} {apt.apellido}</span>
                                    <span className="font-mono text-[10px] text-[#7A6B62]">({apt.codigo})</span>
                                  </label>
                                  <p className="text-[11px] text-[#7A6B62]">
                                    Servicio: <strong className="text-[#241E1A]">{apt.servicioNombre}</strong>
                                    {apt.email ? ` · ✉️ ${apt.email}` : ' · ⚠️ Sin email'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {attachBenefit && isBenefitSelected && (
                                  <span className="text-[10px] bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1">
                                    <Gift className="w-3 h-3" />
                                    Compensar
                                  </span>
                                )}
                                <div className="flex items-center gap-1.5 font-mono font-bold text-[#8E4455] bg-rose-50/80 px-2.5 py-1 rounded-lg border border-rose-100">
                                  <Clock className="w-3 h-3" />
                                  <span>{apt.horaInicio} - {apt.horaFin} hs</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* COMPENSATION BENEFIT SECTION */}
              <div className="bg-[#FAF7F2] p-4 sm:p-5 rounded-2xl border border-[#E8DCD5] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-[#8E4455] flex items-center justify-center font-bold">
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#241E1A]">
                        Beneficio de compensación
                      </h4>
                      <p className="text-[11px] text-[#7A6B62]">
                        Otorgar un beneficio del catálogo a las clientas afectadas
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attachBenefit}
                      onChange={(e) => setAttachBenefit(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8E4455]"></div>
                  </label>
                </div>

                {attachBenefit && (
                  <div className="pt-3 border-t border-[#E8DCD5] space-y-3">
                    {isLoadingTemplates ? (
                      <div className="py-4 text-center text-xs text-[#7A6B62] flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8E4455]" />
                        <span>Cargando catálogo de beneficios...</span>
                      </div>
                    ) : benefitTemplates.length === 0 ? (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">No hay plantillas de beneficios activas disponibles.</p>
                          <p className="text-[11px] text-amber-800">
                            Creá plantillas en la pestaña “Plantillas de Beneficios” para utilizarlas como compensación.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-[#241E1A]">
                            Seleccionar plantilla de compensación *
                          </label>
                          <select
                            value={selectedTemplateId}
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                            className="w-full bg-white border border-[#D9C9BF] rounded-xl px-3 py-2 text-xs text-[#241E1A] focus:ring-2 focus:ring-[#8E4455] focus:outline-hidden cursor-pointer"
                          >
                            {benefitTemplates.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.nombrePublico} — {t.tipoDescuento === 'porcentaje' ? `${t.valorDescuento}% OFF` : `$${t.valorDescuento.toLocaleString('es-AR')} OFF`} ({t.vigenciaDias} días de vigencia)
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedTemplate && (
                          <div className="p-3 bg-white rounded-xl border border-[#E8DCD5] space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#241E1A] flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-[#8E4455]" />
                                {selectedTemplate.nombrePublico}
                              </span>
                              <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full text-[11px] border border-rose-200">
                                {selectedTemplate.tipoDescuento === 'porcentaje'
                                  ? `${selectedTemplate.valorDescuento}% OFF`
                                  : `$${selectedTemplate.valorDescuento.toLocaleString('es-AR')} OFF`}
                              </span>
                            </div>

                            {selectedTemplate.descripcionPublica && (
                              <p className="text-[11px] text-[#7A6B62] italic">
                                "{selectedTemplate.descripcionPublica}"
                              </p>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-100 text-[11px] text-[#5A4B43]">
                              <div>
                                <strong>Vigencia calculada: </strong>
                                <span className="font-medium text-[#241E1A]">
                                  {selectedTemplate.vigenciaDias} días (Vence el {calculatedExpiryFormatted})
                                </span>
                              </div>
                              <div>
                                <strong>Servicios: </strong>
                                <span className="font-medium text-[#241E1A]">
                                  {selectedTemplate.serviciosAplicables.includes('todos') ? 'Todos los servicios' : 'Servicios específicos'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Warning details box */}
              <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <Ban className="w-4 h-4 text-rose-700" />
                  Al confirmar esta excepción:
                </p>
                <ul className="list-disc list-inside space-y-1 text-rose-800/90 pl-1">
                  <li>Los turnos afectados serán <strong>cancelados automáticamente</strong>.</li>
                  <li>Se registrará el motivo: <span className="italic font-medium">“Cancelado por parte del salón, por excepción de horarios”</span>.</li>
                  {attachBenefit && (
                    <li>
                      Se otorgará el beneficio seleccionado a los <strong>{selectedAppointmentIds.length} turno(s) marcados</strong>, quedando disponible en su cuenta.
                    </li>
                  )}
                  <li>Se enviará una notificación por email con el detalle de la cancelación{attachBenefit ? ' y el beneficio adjunto' : ''} a las clientas con correo registrado.</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelConflictModal}
                  disabled={isCancellingConflicts}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#E8DCD5] text-xs font-medium text-[#7A6B62] hover:bg-[#FAF7F2] transition-all cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmConflictModal}
                  disabled={isCancellingConflicts || (attachBenefit && (!selectedTemplateId || selectedAppointmentIds.length === 0))}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isCancellingConflicts ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Cancelando turnos y aplicando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {attachBenefit && selectedAppointmentIds.length > 0
                          ? `Confirmar cancelación y emitir ${selectedAppointmentIds.length} beneficio(s)`
                          : 'Confirmar y cancelar turnos afectados'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* UPCOMING & ACTIVE EXCEPTIONS */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DCD5] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E8DCD5]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#8E4455]" />
            <h4 className="font-serif font-bold text-lg text-[#241E1A]">
              Excepciones Activas y Próximas ({upcomingExceptions.length})
            </h4>
          </div>
          <span className="text-xs text-[#7A6B62]">
            Vigentes hoy o programadas para fechas futuras
          </span>
        </div>

        {upcomingExceptions.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#8C7A70] italic">
            No hay excepciones de disponibilidad programadas para fechas futuras. El salón y las profesionales atenderán según su cronograma habitual.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {upcomingExceptions.map(exc => {
              const profNames = exc.profesionalIds && exc.profesionalIds.length > 0
                ? professionals.filter(p => exc.profesionalIds?.includes(p.id)).map(p => p.nombre).join(', ')
                : (exc.profesionalId ? professionals.find(p => p.id === exc.profesionalId)?.nombre : null);

              const isCerrado = exc.tipo === 'cerrado';

              return (
                <div
                  key={exc.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    isCerrado
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-[#FAF7F2] border-[#E8DCD5]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-serif font-bold text-sm text-[#241E1A] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#8E4455]" />
                        {isoDateToAR(exc.fecha)}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isCerrado
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}>
                        {isCerrado ? 'Cerrado' : 'Horario Especial'}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="text-[#5A4B43]">
                        <strong>Alcance: </strong>
                        {exc.alcance === 'local' ? '🏢 Salón Completo' : `👩‍🎨 ${profNames || 'Profesionales seleccionadas'}`}
                      </p>

                      {!isCerrado && exc.intervalos && exc.intervalos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {exc.intervalos.map((int, i) => (
                            <span
                              key={i}
                              className="text-[11px] font-mono font-semibold bg-white text-[#8E4455] px-2 py-0.5 rounded-md border border-[#E8DCD5]"
                            >
                              {int.inicio} - {int.fin} hs
                            </span>
                          ))}
                        </div>
                      )}

                      {exc.motivo && (
                        <p className="text-[11px] text-[#7A6B62] italic pt-1 border-t border-[#E8DCD5]/60">
                          "{exc.motivo}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t border-[#E8DCD5]/60">
                    <button
                      type="button"
                      onClick={() => handleDeleteException(exc)}
                      className="text-xs text-rose-700 hover:text-rose-900 font-medium flex items-center gap-1 cursor-pointer"
                      title="Eliminar excepción"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PAST / HISTORICAL EXCEPTIONS */}
      {pastExceptions.length > 0 && (
        <div className="bg-stone-50 p-6 sm:p-7 rounded-3xl border border-stone-200 shadow-xs space-y-4 opacity-90">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-stone-600" />
              <h4 className="font-serif font-bold text-base text-stone-800">
                Historial de Excepciones Pasadas ({pastExceptions.length})
              </h4>
            </div>
            <span className="text-[11px] text-stone-500 bg-white px-2.5 py-0.5 rounded-full border border-stone-200">
              Registros Históricos (Solo lectura)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pastExceptions.slice(0, 6).map(exc => (
              <div
                key={exc.id}
                className="p-3.5 rounded-xl bg-white border border-stone-200 text-xs text-stone-600 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-stone-800">{isoDateToAR(exc.fecha)}</span>
                  <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-semibold">
                    {exc.tipo === 'cerrado' ? 'Cerrado' : 'Horario Especial'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500">
                  {exc.alcance === 'local' ? 'Salón Completo' : 'Profesionales'}
                  {exc.motivo ? ` · "${exc.motivo}"` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
