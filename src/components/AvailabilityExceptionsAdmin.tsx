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
  History
} from 'lucide-react';
import type { 
  Professional, 
  AvailabilityException, 
  ScheduleScope, 
  AvailabilityExceptionType, 
  TimeInterval 
} from '../types.js';

interface AvailabilityExceptionsAdminProps {
  professionals?: Professional[];
  onRefreshData?: () => void;
}

const getTodayIso = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AvailabilityExceptionsAdmin: React.FC<AvailabilityExceptionsAdminProps> = ({
  professionals = [],
  onRefreshData
}) => {
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formFecha, setFormFecha] = useState<string>(getTodayIso());
  const [formAlcance, setFormAlcance] = useState<ScheduleScope>('local');
  const [formSelectedProfIds, setFormSelectedProfIds] = useState<string[]>([]);
  const [formTipo, setFormTipo] = useState<AvailabilityExceptionType>('horario_especial');
  const [formIntervalos, setFormIntervalos] = useState<TimeInterval[]>([
    { inicio: '09:00', fin: '20:00' }
  ]);
  const [formMotivo, setFormMotivo] = useState<string>('');

  // Coverage check assistant state
  const [coverageCheck, setCoverageCheck] = useState<{
    covered: boolean;
    missingIntervals?: TimeInterval[];
    reason?: string;
  } | null>(null);
  const [isCheckingCoverage, setIsCheckingCoverage] = useState<boolean>(false);
  const [isExtendingStudio, setIsExtendingStudio] = useState<boolean>(false);

  // Load exceptions
  const loadExceptions = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/excepciones-disponibilidad');
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

  useEffect(() => {
    loadExceptions();
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

  // Live Studio Coverage Checker when editing a professional exception
  useEffect(() => {
    if (!isFormOpen || formAlcance !== 'profesional' || formTipo === 'cerrado' || !formFecha) {
      setCoverageCheck(null);
      return;
    }

    // Verify if formIntervalos are non-empty and valid
    const validIntervals = formIntervalos.filter(i => i.inicio && i.fin && i.inicio < i.fin);
    if (validIntervals.length === 0) {
      setCoverageCheck(null);
      return;
    }

    let isMounted = true;
    setIsCheckingCoverage(true);

    const checkCoverage = async () => {
      try {
        const res = await fetch('/api/excepciones-disponibilidad/check-cobertura', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fecha: formFecha,
            profesionalIntervalos: validIntervals
          })
        });

        if (res.ok && isMounted) {
          const result = await res.json();
          setCoverageCheck(result);
        }
      } catch (err) {
        console.error('Error checking studio coverage:', err);
      } finally {
        if (isMounted) setIsCheckingCoverage(false);
      }
    };

    const timer = setTimeout(checkCoverage, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isFormOpen, formAlcance, formTipo, formFecha, formIntervalos]);

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

  // Auto-extend Studio Schedule Helper
  const handleAutoExtendStudio = async () => {
    if (!formFecha || !coverageCheck?.missingIntervals || coverageCheck.missingIntervals.length === 0) return;
    setIsExtendingStudio(true);
    try {
      const res = await fetch('/api/excepciones-disponibilidad/auto-extender-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: formFecha,
          requiredIntervals: formIntervalos,
          motivo: `Extensión automática del local para cubrir atención especial de profesionales (${formMotivo || 'Excepción especial'})`
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al extender el horario del local');
      }

      setSuccessMsg(`¡Horario del local extendido automáticamente para el ${formFecha}! Ahora cubre la jornada de los profesionales.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      setCoverageCheck({ covered: true });
      await loadExceptions();
    } catch (err: any) {
      console.error('Error auto-extending studio schedule:', err);
      setErrorMsg(err.message || 'No se pudo extender el horario del local automáticamente.');
    } finally {
      setIsExtendingStudio(false);
    }
  };

  // Submit Exception
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

      const res = await fetch('/api/excepciones-disponibilidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al registrar la excepción.');
      }

      setSuccessMsg(`¡Excepción de disponibilidad para el ${formFecha} registrada con éxito!`);
      setTimeout(() => setSuccessMsg(null), 5000);
      setIsFormOpen(false);
      setFormMotivo('');
      setFormSelectedProfIds([]);
      await loadExceptions();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Error creating availability exception:', err);
      setErrorMsg(err.message || 'Error al guardar la excepción de disponibilidad.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Exception
  const handleDeleteException = async (exc: AvailabilityException) => {
    if (exc.fecha < today) {
      setErrorMsg('No es posible eliminar o alterar excepciones que ya pertenecen al histórico.');
      return;
    }

    try {
      const res = await fetch(`/api/excepciones-disponibilidad/${exc.id}`, {
        method: 'DELETE'
      });
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

            {/* Asistente al extender horario del local */}
            {coverageCheck && !coverageCheck.covered && (
              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 text-amber-900 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-serif font-bold text-sm text-amber-950">
                      El horario seleccionado supera el horario de atención del local
                    </h5>
                    <p className="text-xs text-amber-800 mt-0.5">
                      {coverageCheck.reason || 'El horario habitual del salón para esa fecha no cubre todos los tramos configurados para las profesionales.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-amber-200/80">
                  <span className="text-[11px] text-amber-800">
                    ¿Deseás extender el horario del salón automáticamente para este día puntual?
                  </span>
                  <button
                    type="button"
                    disabled={isExtendingStudio}
                    onClick={handleAutoExtendStudio}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isExtendingStudio ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Extendiendo Salón...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Extender horario del local</span>
                      </>
                    )}
                  </button>
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
                    <span>Guardando...</span>
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
                        {exc.fecha}
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
                  <span className="font-mono font-bold text-stone-800">{exc.fecha}</span>
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
