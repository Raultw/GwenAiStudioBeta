import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  User,
  Store,
  ChevronRight,
  Info,
  CalendarCheck,
  ArrowRight
} from 'lucide-react';
import type { 
  Professional, 
  ScheduleConfig, 
  ScheduleScope, 
  TimeInterval, 
  WeekScheduleMap, 
  DayOfWeekKey,
  DayScheduleIntervals 
} from '../types.js';
import { 
  getBusinessDate, 
  isoDateToAR 
} from '../utils/dateUtils.js';

interface ScheduleManagementAdminProps {
  professionals?: Professional[];
  onRefreshData?: () => void;
  initialProfessionalId?: string | null;
}

interface WeeklyCoverageConflictItem {
  dayKey: DayOfWeekKey;
  dayLabel: string;
  isStudioClosed: boolean;
  studioIntervals: TimeInterval[];
  profIntervals: TimeInterval[];
  uncoveredIntervals: TimeInterval[];
  requiredStudioIntervals: TimeInterval[];
  studioDesc: string;
  profDesc: string;
}

interface WeeklyCoverageConflictModalData {
  fechaVigencia: string;
  profName: string;
  conflicts: WeeklyCoverageConflictItem[];
  extendedStudioWeekDays: WeekScheduleMap;
}

const DAYS_ORDER: { key: DayOfWeekKey; label: string }[] = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' }
];

const DEFAULT_LOCAL_SCHEDULE: WeekScheduleMap = {
  lunes: { abierto: true, intervalos: [{ inicio: '09:00', fin: '19:00' }] },
  martes: { abierto: true, intervalos: [{ inicio: '09:00', fin: '19:00' }] },
  miercoles: { abierto: true, intervalos: [{ inicio: '09:00', fin: '19:00' }] },
  jueves: { abierto: true, intervalos: [{ inicio: '09:00', fin: '19:00' }] },
  viernes: { abierto: true, intervalos: [{ inicio: '09:00', fin: '20:00' }] },
  sabado: { abierto: true, intervalos: [{ inicio: '09:00', fin: '20:00' }] },
  domingo: { abierto: false, intervalos: [] }
};

const getTodayIso = () => {
  return getBusinessDate();
};

export const ScheduleManagementAdmin: React.FC<ScheduleManagementAdminProps> = ({
  professionals = [],
  onRefreshData,
  initialProfessionalId
}) => {
  const [activeScope, setActiveScope] = useState<ScheduleScope>(initialProfessionalId ? 'profesional' : 'local');
  const [selectedProfId, setSelectedProfId] = useState<string>(
    initialProfessionalId || ((professionals && professionals.length > 0) ? professionals[0].id : '')
  );

  const [schedulesList, setSchedulesList] = useState<ScheduleConfig[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Coverage conflict modal state
  const [coverageModalData, setCoverageModalData] = useState<WeeklyCoverageConflictModalData | null>(null);
  const [isExtendingStudio, setIsExtendingStudio] = useState<boolean>(false);

  // Current editing schedule state
  const [fechaVigencia, setFechaVigencia] = useState<string>(getTodayIso());
  const [weekDays, setWeekDays] = useState<WeekScheduleMap>(DEFAULT_LOCAL_SCHEDULE);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  useEffect(() => {
    if (initialProfessionalId) {
      setActiveScope('profesional');
      setSelectedProfId(initialProfessionalId);
    }
  }, [initialProfessionalId]);

  // Load all schedules from server
  const loadSchedules = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/horarios', { credentials: 'include' });
      if (res.ok) {
        const data: ScheduleConfig[] = await res.json();
        setSchedulesList(data);
      }
    } catch (err) {
      console.error('Error loading schedules:', err);
      setErrorMsg('Error al cargar cronogramas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  // When scope or selected professional changes, find currently active or latest schedule
  useEffect(() => {
    const relevant = schedulesList.filter(s => {
      if (activeScope === 'local') return s.alcance === 'local';
      return s.alcance === 'profesional' && s.profesionalId === selectedProfId;
    });

    if (relevant.length > 0) {
      // Pick the one with the newest fechaVigencia
      const sorted = [...relevant].sort((a, b) => b.fechaVigencia.localeCompare(a.fechaVigencia));
      const active = sorted[0];
      setWeekDays(JSON.parse(JSON.stringify(active.dias)));
      // Always default to today's date for new modifications
      setFechaVigencia(getTodayIso());
      setEditingScheduleId(active.id);
    } else {
      // Default template
      if (activeScope === 'local') {
        setWeekDays(JSON.parse(JSON.stringify(DEFAULT_LOCAL_SCHEDULE)));
      } else {
        // Professional default: copy local or 09:00 - 18:00
        setWeekDays({
          lunes: { abierto: true, intervalos: [{ inicio: '09:00', fin: '18:00' }] },
          martes: { abierto: true, intervalos: [{ inicio: '09:00', fin: '18:00' }] },
          miercoles: { abierto: true, intervalos: [{ inicio: '09:00', fin: '18:00' }] },
          jueves: { abierto: true, intervalos: [{ inicio: '09:00', fin: '18:00' }] },
          viernes: { abierto: true, intervalos: [{ inicio: '09:00', fin: '19:00' }] },
          sabado: { abierto: true, intervalos: [{ inicio: '09:00', fin: '18:00' }] },
          domingo: { abierto: false, intervalos: [] }
        });
      }
      setFechaVigencia(getTodayIso());
      setEditingScheduleId(null);
    }
  }, [activeScope, selectedProfId, schedulesList]);

  // Day toggle
  const handleToggleDay = (dayKey: DayOfWeekKey) => {
    setWeekDays(prev => {
      const current = prev[dayKey];
      const nextAbierto = !current.abierto;
      return {
        ...prev,
        [dayKey]: {
          abierto: nextAbierto,
          intervalos: nextAbierto && (!current.intervalos || current.intervalos.length === 0)
            ? [{ inicio: '09:00', fin: '19:00' }]
            : current.intervalos
        }
      };
    });
  };

  // Add interval to a day
  const handleAddInterval = (dayKey: DayOfWeekKey) => {
    setWeekDays(prev => {
      const current = prev[dayKey];
      const intervals = [...(current.intervalos || [])];
      let newStart = '15:00';
      let newEnd = '19:00';
      if (intervals.length > 0) {
        const last = intervals[intervals.length - 1];
        const [lh, lm] = last.fin.split(':').map(Number);
        const nextH = Math.min(22, (lh || 14) + 1);
        newStart = `${String(nextH).padStart(2, '0')}:00`;
        newEnd = `${String(Math.min(23, nextH + 4)).padStart(2, '0')}:00`;
      }
      intervals.push({ inicio: newStart, fin: newEnd });
      return {
        ...prev,
        [dayKey]: {
          abierto: true,
          intervalos: intervals
        }
      };
    });
  };

  // Remove interval
  const handleRemoveInterval = (dayKey: DayOfWeekKey, index: number) => {
    setWeekDays(prev => {
      const current = prev[dayKey];
      const newIntervals = current.intervalos.filter((_, i) => i !== index);
      return {
        ...prev,
        [dayKey]: {
          abierto: newIntervals.length > 0,
          intervalos: newIntervals
        }
      };
    });
  };

  // Update interval time
  const handleUpdateInterval = (
    dayKey: DayOfWeekKey,
    index: number,
    field: 'inicio' | 'fin',
    value: string
  ) => {
    setWeekDays(prev => {
      const current = prev[dayKey];
      const intervals = current.intervalos.map((int, i) => {
        if (i !== index) return int;
        return { ...int, [field]: value };
      });
      return {
        ...prev,
        [dayKey]: {
          ...current,
          intervalos: intervals
        }
      };
    });
  };

  // Apply Quick Preset to a Day
  const handleApplyPreset = (dayKey: DayOfWeekKey, preset: 'corrido' | 'cortado' | 'sabado_medio' | 'cerrado') => {
    setWeekDays(prev => {
      if (preset === 'cerrado') {
        return { ...prev, [dayKey]: { abierto: false, intervalos: [] } };
      }
      if (preset === 'corrido') {
        return { ...prev, [dayKey]: { abierto: true, intervalos: [{ inicio: '09:00', fin: '19:00' }] } };
      }
      if (preset === 'cortado') {
        return {
          ...prev,
          [dayKey]: {
            abierto: true,
            intervalos: [
              { inicio: '09:00', fin: '13:00' },
              { inicio: '15:00', fin: '19:00' }
            ]
          }
        };
      }
      if (preset === 'sabado_medio') {
        return { ...prev, [dayKey]: { abierto: true, intervalos: [{ inicio: '09:00', fin: '14:00' }] } };
      }
      return prev;
    });
  };

  // Save Schedule
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate intervals
    for (const d of DAYS_ORDER) {
      const dayConf = weekDays[d.key];
      if (dayConf.abierto) {
        if (!dayConf.intervalos || dayConf.intervalos.length === 0) {
          setErrorMsg(`El día ${d.label} está marcado como abierto pero no tiene intervalos configurados.`);
          return;
        }
        for (let i = 0; i < dayConf.intervalos.length; i++) {
          const int = dayConf.intervalos[i];
          if (!int.inicio || !int.fin) {
            setErrorMsg(`El día ${d.label} tiene intervalos con horarios incompletos.`);
            return;
          }
          if (int.inicio >= int.fin) {
            setErrorMsg(`En ${d.label}, la hora de inicio (${int.inicio}) debe ser menor a la hora de fin (${int.fin}).`);
            return;
          }
        }
      }
    }

    if (!fechaVigencia) {
      setErrorMsg('Indicá la fecha de vigencia desde la cual aplica este cronograma.');
      return;
    }

    setIsSaving(true);
    try {
      // If saving professional schedule, check if it exceeds the studio schedule
      if (activeScope === 'profesional') {
        const checkRes = await fetch('/api/horarios/check-cobertura', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fechaVigencia,
            dias: weekDays,
            profesionalId: selectedProfId
          })
        });

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.hasConflict && checkData.conflicts && checkData.conflicts.length > 0) {
            setIsSaving(false);
            setCoverageModalData({
              fechaVigencia,
              profName: selectedProfessional?.nombre || 'la profesional',
              conflicts: checkData.conflicts,
              extendedStudioWeekDays: checkData.extendedStudioWeekDays
            });
            return;
          }
        }
      }

      const payload = {
        alcance: activeScope,
        profesionalId: activeScope === 'profesional' ? selectedProfId : undefined,
        fechaVigencia,
        dias: weekDays
      };

      const res = await fetch('/api/horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al guardar el cronograma.');
      }

      const saved: ScheduleConfig = await res.json();
      setSuccessMsg(
        activeScope === 'local'
          ? `¡Horario del local guardado con éxito! Vigente a partir del ${isoDateToAR(saved.fechaVigencia)}.`
          : `¡Horario de ${selectedProfessional?.nombre || 'la profesional'} guardado con éxito! Vigente a partir del ${isoDateToAR(saved.fechaVigencia)}.`
      );
      setTimeout(() => setSuccessMsg(null), 5000);
      await loadSchedules();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Error saving schedule:', err);
      setErrorMsg(err.message || 'Error al guardar el cronograma.');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm extending studio schedule and saving both
  const handleConfirmExtendStudioAndSave = async () => {
    if (!coverageModalData) return;
    setIsExtendingStudio(true);
    setErrorMsg(null);
    try {
      // 1. Extend Studio Weekly Schedule from fechaVigencia onwards
      const studioPayload = {
        alcance: 'local',
        fechaVigencia: coverageModalData.fechaVigencia,
        dias: coverageModalData.extendedStudioWeekDays
      };
      const studioRes = await fetch('/api/horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(studioPayload)
      });
      if (!studioRes.ok) {
        const errData = await studioRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al extender el cronograma del salón.');
      }

      // 2. Save Professional Weekly Schedule from fechaVigencia onwards
      const profPayload = {
        alcance: 'profesional',
        profesionalId: selectedProfId,
        fechaVigencia: coverageModalData.fechaVigencia,
        dias: weekDays
      };
      const profRes = await fetch('/api/horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(profPayload)
      });
      if (!profRes.ok) {
        const errData = await profRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al guardar el cronograma de la profesional.');
      }

      setSuccessMsg(
        `¡Horario del salón extendido y cronograma de ${coverageModalData.profName} guardado con éxito a partir del ${isoDateToAR(coverageModalData.fechaVigencia)}!`
      );
      setTimeout(() => setSuccessMsg(null), 6000);
      setCoverageModalData(null);
      await loadSchedules();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Error extending studio and saving prof schedule:', err);
      setErrorMsg(err.message || 'Error al extender el cronograma del salón.');
    } finally {
      setIsExtendingStudio(false);
    }
  };

  const handleCancelCoverageModal = () => {
    setCoverageModalData(null);
    setIsSaving(false);
  };

  const selectedProfessional = useMemo(() => {
    return professionals.find(p => p.id === selectedProfId);
  }, [professionals, selectedProfId]);

  return (
    <div className="space-y-6">
      {/* STUDIO COVERAGE CONFLICT WARNING MODAL */}
      {coverageModalData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-[#E8DCD5] shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start gap-3.5 pb-3 border-b border-[#E8DCD5]">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-lg text-[#241E1A]">
                  Conflicto con los Horarios del Salón
                </h4>
                <p className="text-xs text-[#7A6B62] mt-0.5">
                  El cronograma de <strong>{coverageModalData.profName}</strong> excede la atención del local a partir del <strong>{isoDateToAR(coverageModalData.fechaVigencia)}</strong>.
                </p>
              </div>
            </div>

            {/* Modal Body: Conflicts Breakdown */}
            <div className="space-y-3.5 text-xs text-[#5A4B43]">
              <p className="leading-relaxed">
                Para que la profesional pueda atender en estos horarios, el salón debe estar abierto y disponible durante esos tramos.
              </p>

              {/* List of Conflicted Days */}
              <div className="space-y-2">
                <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Días y tramos que superan la atención del salón:</span>
                </p>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {coverageModalData.conflicts.map((conf, idx) => (
                    <div
                      key={idx}
                      className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-serif font-bold text-[#241E1A]">
                        <span>{conf.dayLabel}</span>
                        <span className="text-[10px] font-sans font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                          {conf.isStudioClosed ? 'Salón Cerrado' : 'Supera Apertura'}
                        </span>
                      </div>

                      <div className="text-[11px] text-[#5A4B43] space-y-0.5">
                        <p>
                          <strong>🏢 Salón actual:</strong> {conf.studioDesc}
                        </p>
                        <p>
                          <strong>👩‍🎨 {coverageModalData.profName}:</strong> {conf.profDesc}
                        </p>
                      </div>

                      <div className="pt-1 flex flex-wrap gap-1">
                        {conf.uncoveredIntervals.map((int, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-mono font-semibold bg-white text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md"
                          >
                            Excede: {int.inicio} a {int.fin} hs
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Solution hint */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Al extender, se actualizará también el cronograma semanal del salón a partir del <strong>{isoDateToAR(coverageModalData.fechaVigencia)}</strong> cubriendo estos horarios.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-[#E8DCD5]">
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

      {/* Header card */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DCD5] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-[#E8DCD5] flex items-center justify-center text-[#8E4455] shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E4455]">
                  Configuración Avanzada
                </span>
                <span className="text-xs text-[#7A6B62] bg-[#FAF7F2] px-2 py-0.5 rounded-full border border-[#E8DCD5]">
                  Vigencias & Multitramo
                </span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#241E1A]">
                Horarios de Atención
              </h3>
              <p className="text-xs text-[#7A6B62] mt-0.5">
                Configurá cronogramas semanales multitramo (horario corrido o cortado) para el salón y cada profesional.
              </p>
            </div>
          </div>

          {/* Scope selector tabs */}
          <div className="flex items-center bg-[#FAF7F2] p-1.5 rounded-2xl border border-[#E8DCD5]">
            <button
              type="button"
              onClick={() => setActiveScope('local')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeScope === 'local'
                  ? 'bg-[#8E4455] text-white shadow-xs'
                  : 'text-[#5A4B43] hover:text-[#241E1A]'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>1. Horario del Local</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveScope('profesional')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeScope === 'profesional'
                  ? 'bg-[#8E4455] text-white shadow-xs'
                  : 'text-[#5A4B43] hover:text-[#241E1A]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>2. Horario de Profesionales</span>
            </button>
          </div>
        </div>

        {/* Scope context banner */}
        <div className="mt-6 pt-5 border-t border-[#E8DCD5]/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {activeScope === 'local' ? (
            <div className="flex items-center gap-2.5 text-xs text-[#5A4B43]">
              <Info className="w-4 h-4 text-[#8E4455] shrink-0" />
              <span>
                Estás configurando el <strong>horario general del salón</strong>. Define la ventana máxima de apertura en la que el local recibe clientas.
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 w-full">
              <span className="text-xs font-semibold text-[#241E1A]">Seleccionar Profesional:</span>
              <div className="flex flex-wrap gap-2">
                {professionals.map(prof => (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => setSelectedProfId(prof.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 border transition-all cursor-pointer ${
                      selectedProfId === prof.id
                        ? 'bg-[#8E4455] text-white border-[#8E4455] shadow-xs'
                        : 'bg-white text-[#5A4B43] border-[#E8DCD5] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: prof.colorAgenda || '#8E4455' }}
                    />
                    <span>{prof.nombre} {prof.apellido}</span>
                    {!prof.activo && (
                      <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded">Inactiva</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Effective date and guidance */}
        <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-[#E8DCD5] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-serif font-bold text-sm text-[#241E1A] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#8E4455]" />
              <span>Fecha de Entrada en Vigencia</span>
            </h4>
            <p className="text-xs text-[#7A6B62] max-w-xl">
              Este cambio entrará en vigor a partir de la fecha seleccionada. 
              <strong> Los turnos y cronogramas anteriores a esta fecha se conservarán intactos sin alterar históricos.</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-[#5A4B43]">Aplica desde:</span>
            <input
              type="date"
              value={fechaVigencia}
              onChange={(e) => setFechaVigencia(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white border border-[#D9C9BF] text-xs font-semibold text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
              required
            />
            <button
              type="button"
              onClick={() => setFechaVigencia(getTodayIso())}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#E8DCD5] border border-[#D9C9BF] text-xs font-medium text-[#5A4B43] transition-colors cursor-pointer"
              title="Establecer fecha de hoy"
            >
              Hoy
            </button>
          </div>
        </div>

        {/* Days editor grid */}
        <div className="space-y-3.5">
          {DAYS_ORDER.map(({ key, label }) => {
            const dayConfig: DayScheduleIntervals = weekDays[key] || { abierto: false, intervalos: [] };
            const isAbierto = dayConfig.abierto;

            return (
              <div
                key={key}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isAbierto
                    ? 'bg-white border-[#E8DCD5] shadow-xs'
                    : 'bg-[#FAF7F2]/60 border-[#E8DCD5]/60 opacity-80'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Day header & toggle */}
                  <div className="flex items-center justify-between lg:justify-start gap-4 min-w-[200px]">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleDay(key)}
                        className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                          isAbierto ? 'bg-[#8E4455]' : 'bg-[#D9C9BF]'
                        }`}
                        title={isAbierto ? 'Hacer clic para cerrar este día' : 'Hacer clic para abrir este día'}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                            isAbierto ? 'left-5' : 'left-1'
                          }`}
                        />
                      </button>
                      <div>
                        <h5 className="font-serif font-bold text-base text-[#241E1A]">
                          {label}
                        </h5>
                        <span className={`text-[11px] font-semibold ${isAbierto ? 'text-emerald-700' : 'text-stone-500'}`}>
                          {isAbierto ? 'Abierto para atención' : 'Cerrado / No laborable'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Presets for day */}
                    {isAbierto && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(key, 'corrido')}
                          className="text-[10px] bg-[#FAF7F2] hover:bg-[#E8DCD5] text-[#5A4B43] px-2 py-1 rounded-md border border-[#E8DCD5] transition-colors cursor-pointer"
                          title="09:00 a 19:00 hs"
                        >
                          Corrido (9-19)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(key, 'cortado')}
                          className="text-[10px] bg-[#FAF7F2] hover:bg-[#E8DCD5] text-[#5A4B43] px-2 py-1 rounded-md border border-[#E8DCD5] transition-colors cursor-pointer"
                          title="9-13 y 15-19 hs"
                        >
                          Cortado (9-13 / 15-19)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Intervals list */}
                  {isAbierto ? (
                    <div className="flex-1 flex flex-wrap items-center gap-3">
                      {dayConfig.intervalos.map((interval, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-[#FAF7F2] px-3 py-2 rounded-xl border border-[#E8DCD5]"
                        >
                          <span className="text-[11px] text-[#8C7A70] font-mono">Tramo {idx + 1}:</span>
                          <input
                            type="time"
                            value={interval.inicio}
                            onChange={(e) => handleUpdateInterval(key, idx, 'inicio', e.target.value)}
                            className="bg-white border border-[#D9C9BF] rounded-lg px-2 py-1 text-xs font-semibold text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            required
                          />
                          <span className="text-xs text-[#8C7A70] font-bold">a</span>
                          <input
                            type="time"
                            value={interval.fin}
                            onChange={(e) => handleUpdateInterval(key, idx, 'fin', e.target.value)}
                            className="bg-white border border-[#D9C9BF] rounded-lg px-2 py-1 text-xs font-semibold text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                            required
                          />
                          {dayConfig.intervalos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveInterval(key, idx)}
                              className="p-1 text-stone-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer ml-1"
                              title="Eliminar este tramo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Add new interval button */}
                      <button
                        type="button"
                        onClick={() => handleAddInterval(key)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#8E4455] bg-[#FAF7F2] hover:bg-rose-50 px-3 py-2 rounded-xl border border-dashed border-[#8E4455]/40 transition-colors cursor-pointer"
                        title="Agregar otro tramo (para horario cortado)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar tramo</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-[#8C7A70] italic">
                      No se programan citas en este día.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feedback messages */}
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

        {/* Actions bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8DCD5]">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 rounded-2xl bg-[#8E4455] hover:bg-[#783645] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Guardando Cronograma...</span>
              </>
            ) : (
              <>
                <CalendarCheck className="w-4 h-4" />
                <span>Guardar Cronograma {activeScope === 'local' ? 'del Local' : `de ${selectedProfessional?.nombre || 'Profesional'}`}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
