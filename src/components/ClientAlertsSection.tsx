import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  ShieldAlert, 
  AlertCircle, 
  Sparkles,
  Calendar,
  X,
  Check
} from 'lucide-react';
import type { ClientAlert, AlertType, AlertSeverity } from '../types.js';

interface ClientAlertsSectionProps {
  clientId: string;
  clientName: string;
  alerts: ClientAlert[];
  onAlertsUpdated: () => void;
  showToast: (msg: string) => void;
}

const PRESET_QUICK_ALERTS = [
  { tipo: 'alergia' as AlertType, desc: 'Alergia a Acrilatos / HEMA', sev: 'alta' as AlertSeverity, prod: 'Esmaltes estándar / Gel UV' },
  { tipo: 'sensibilidad' as AlertType, desc: 'Sensibilidad térmica en cabina UV/LED', sev: 'moderada' as AlertSeverity, prod: 'Cabina LED / Geles constructores' },
  { tipo: 'sensibilidad' as AlertType, desc: 'Cutículas hipersensibles / sangrado fácil', sev: 'moderada' as AlertSeverity, prod: 'Torno / Fresas diamantadas' },
  { tipo: 'producto_evitar' as AlertType, desc: 'Evitar Acetona Pura (dermatitis de contacto)', sev: 'moderada' as AlertSeverity, prod: 'Removedor con acetona' },
  { tipo: 'precaucion' as AlertType, desc: 'Uñas finas / Onicólisis en recuperación', sev: 'alta' as AlertSeverity, prod: 'Kapping suave / Sin limado agresivo' },
  { tipo: 'alergia' as AlertType, desc: 'Alergia al Látex / Guantes empolvados', sev: 'alta' as AlertSeverity, prod: 'Guantes de látex (usar nitrilo)' },
  { tipo: 'irritacion' as AlertType, desc: 'Irritación periungueal por polvillo de limado', sev: 'leve' as AlertSeverity, prod: 'Polvo de limado acrílico' }
];

const ALERT_TYPE_LABELS: Record<AlertType, { label: string; bg: string; text: string }> = {
  alergia: { label: 'Alergia Declarada', bg: 'bg-rose-100', text: 'text-rose-800' },
  sensibilidad: { label: 'Sensibilidad', bg: 'bg-amber-100', text: 'text-amber-800' },
  irritacion: { label: 'Irritación Observada', bg: 'bg-orange-100', text: 'text-orange-800' },
  producto_evitar: { label: 'Producto a Evitar', bg: 'bg-purple-100', text: 'text-purple-800' },
  procedimiento: { label: 'Procedimiento Problemático', bg: 'bg-blue-100', text: 'text-blue-800' },
  precaucion: { label: 'Precaución Técnica', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  otro: { label: 'Antecedente General', bg: 'bg-stone-100', text: 'text-stone-800' }
};

const SEVERITY_BADGES: Record<AlertSeverity, { label: string; border: string; bg: string; text: string; dot: string }> = {
  leve: { label: 'Leve', border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  moderada: { label: 'Moderada', border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500' },
  alta: { label: 'Alta', border: 'border-rose-300', bg: 'bg-rose-50', text: 'text-rose-800', dot: 'bg-rose-500' },
  critica: { label: 'Crítica / No Aplicar', border: 'border-red-400', bg: 'bg-red-100', text: 'text-red-900', dot: 'bg-red-600' }
};

export const ClientAlertsSection: React.FC<ClientAlertsSectionProps> = ({
  clientId,
  clientName,
  alerts,
  onAlertsUpdated,
  showToast
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    tipo: 'alergia' as AlertType,
    descripcion: '',
    productoServicioRelacionado: '',
    severidad: 'moderada' as AlertSeverity,
    fecha: new Date().toISOString().split('T')[0],
    activa: true,
    observaciones: ''
  });

  const resetForm = () => {
    setForm({
      tipo: 'alergia',
      descripcion: '',
      productoServicioRelacionado: '',
      severidad: 'moderada',
      fecha: new Date().toISOString().split('T')[0],
      activa: true,
      observaciones: ''
    });
    setEditingAlertId(null);
    setIsAdding(false);
  };

  const handleStartEdit = (alert: ClientAlert) => {
    setEditingAlertId(alert.id);
    setForm({
      tipo: alert.tipo,
      descripcion: alert.descripcion,
      productoServicioRelacionado: alert.productoServicioRelacionado || '',
      severidad: alert.severidad,
      fecha: alert.fecha,
      activa: alert.activa,
      observaciones: alert.observaciones || ''
    });
    setIsAdding(true);
  };

  const handleApplyPreset = (preset: typeof PRESET_QUICK_ALERTS[0]) => {
    setForm(prev => ({
      ...prev,
      tipo: preset.tipo,
      descripcion: preset.desc,
      severidad: preset.sev,
      productoServicioRelacionado: preset.prod
    }));
  };

  const handleSaveAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descripcion.trim()) {
      showToast('Ingresá una descripción clara para la alerta.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAlertId) {
        // Update
        const res = await fetch(`/api/clientes/${clientId}/alertas/${editingAlertId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        if (res.ok) {
          showToast('Alerta actualizada con éxito.');
          resetForm();
          onAlertsUpdated();
        } else {
          showToast('Error al actualizar la alerta.');
        }
      } else {
        // Create
        const res = await fetch(`/api/clientes/${clientId}/alertas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        if (res.ok) {
          showToast('Alerta registrada correctamente.');
          resetForm();
          onAlertsUpdated();
        } else {
          showToast('Error al registrar la alerta.');
        }
      }
    } catch (err) {
      console.error('Error saving alert:', err);
      showToast('Error de conexión al guardar alerta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (alert: ClientAlert) => {
    try {
      const res = await fetch(`/api/clientes/${clientId}/alertas/${alert.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: !alert.activa })
      });
      if (res.ok) {
        showToast(alert.activa ? 'Alerta marcada como inactiva / resuelta.' : 'Alerta activada.');
        onAlertsUpdated();
      }
    } catch (err) {
      console.error('Error toggling alert:', err);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!window.confirm('¿Confirmás eliminar este antecedente/alerta de la clienta?')) return;

    try {
      const res = await fetch(`/api/clientes/${clientId}/alertas/${alertId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Alerta eliminada.');
        onAlertsUpdated();
      }
    } catch (err) {
      console.error('Error deleting alert:', err);
    }
  };

  const activeAlerts = alerts.filter(a => a.activa);
  const inactiveAlerts = alerts.filter(a => !a.activa);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-50 to-amber-50 p-4 rounded-2xl border border-rose-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-700 flex items-center justify-center font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif text-sm font-bold text-[#241E1A] flex items-center gap-2">
              Alertas Sanitarias y Antecedentes
              {activeAlerts.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                  {activeAlerts.length} {activeAlerts.length === 1 ? 'activa' : 'activas'}
                </span>
              )}
            </h4>
            <p className="text-[11px] text-[#7A6B62]">
              Registro de alergias declaradas, sensibilidades y productos a evitar para una atención segura.
            </p>
          </div>
        </div>

        {!isAdding && (
          <button
            onClick={() => {
              resetForm();
              setIsAdding(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#8E4455] text-white text-xs font-semibold hover:bg-[#783746] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva Alerta
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {isAdding && (
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm animate-fade-in space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E8DCD5]">
            <h5 className="font-serif text-sm font-semibold text-[#241E1A] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              {editingAlertId ? 'Editar Alerta / Antecedente' : 'Registrar Nueva Alerta o Precaución'}
            </h5>
            <button onClick={resetForm} className="text-[#8C7A70] hover:text-[#241E1A]">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Presets */}
          {!editingAlertId && (
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8C7A70] block mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#8E4455]" />
                Atajos frecuentes (1 clic)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_QUICK_ALERTS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] hover:bg-rose-50 hover:border-rose-300 border border-[#E8DCD5] text-[11px] text-[#4A3E39] hover:text-rose-900 transition-colors text-left"
                  >
                    + {preset.desc}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSaveAlert} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Tipo de Registro *</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm(prev => ({ ...prev, tipo: e.target.value as AlertType }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                >
                  <option value="alergia">Alergia Declarada (Acrilatos, Látex, etc.)</option>
                  <option value="sensibilidad">Sensibilidad Térmica / Cutícula</option>
                  <option value="irritacion">Irritación Observada en Sesión Previa</option>
                  <option value="producto_evitar">Producto o Químico a Evitar</option>
                  <option value="procedimiento">Procedimiento Problemático</option>
                  <option value="precaucion">Precaución Técnica Especial</option>
                  <option value="otro">Otro Antecedente Relevante</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Nivel de Severidad / Riesgo *</label>
                <select
                  value={form.severidad}
                  onChange={(e) => setForm(prev => ({ ...prev, severidad: e.target.value as AlertSeverity }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                >
                  <option value="leve">Leve (Requiere cuidado básico)</option>
                  <option value="moderada">Moderada (Ajustar técnica o producto)</option>
                  <option value="alta">Alta (Riesgo de dermatitis / ardor severo)</option>
                  <option value="critica">Crítica / No Aplicar (Prohibición estricta)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A3E39] mb-1">Descripción de la Alerta o Reacción *</label>
              <input
                type="text"
                required
                value={form.descripcion}
                onChange={(e) => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Ej: Picazón intensa en bordes tras esmaltado semipermanente tradicional"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Producto o Servicio Relacionado (Opcional)</label>
                <input
                  type="text"
                  value={form.productoServicioRelacionado}
                  onChange={(e) => setForm(prev => ({ ...prev, productoServicioRelacionado: e.target.value }))}
                  placeholder="Ej: Base Rubber marca X, Primer ácido, etc."
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A3E39] mb-1">Fecha de Observación / Declaración</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm(prev => ({ ...prev, fecha: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A3E39] mb-1">Observaciones Profesionales / Indicaciones</label>
              <textarea
                rows={2}
                value={form.observaciones}
                onChange={(e) => setForm(prev => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Ej: Utilizar gel constructor HEMA-Free, bajar potencia de lámpara al 50% los primeros 30 seg..."
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455] resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#4A3E39]">
                <input
                  type="checkbox"
                  checked={form.activa}
                  onChange={(e) => setForm(prev => ({ ...prev, activa: e.target.checked }))}
                  className="rounded text-[#8E4455] focus:ring-[#8E4455] w-4 h-4"
                />
                <span>Alerta Activa (Visible en avisos de turno)</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3.5 py-1.5 rounded-xl border border-[#D9C9BF] text-xs text-[#5C4D44] hover:bg-[#FAF7F2]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-[#8E4455] text-white text-xs font-semibold hover:bg-[#783746] transition-colors flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Guardando...' : editingAlertId ? 'Actualizar Alerta' : 'Guardar Alerta'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Active Alerts List */}
      <div className="space-y-3">
        <h5 className="text-xs font-bold uppercase tracking-wider text-[#8C7A70]">
          Alertas Activas ({activeAlerts.length})
        </h5>

        {activeAlerts.length === 0 ? (
          <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-[#E8DCD5] text-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
            <h6 className="font-medium text-xs text-[#241E1A]">Sin alertas activas registradas</h6>
            <p className="text-[11px] text-[#7A6B62] mt-0.5">
              No hay alergias ni sensibilidades activas que impidan la aplicación de técnicas habituales.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeAlerts.map((alert) => {
              const sevConfig = SEVERITY_BADGES[alert.severidad] || SEVERITY_BADGES.moderada;
              const typeConfig = ALERT_TYPE_LABELS[alert.tipo] || ALERT_TYPE_LABELS.otro;

              return (
                <div
                  key={alert.id}
                  className={`bg-white rounded-2xl p-4 border ${sevConfig.border} shadow-xs space-y-2 relative transition-all`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${typeConfig.bg} ${typeConfig.text}`}>
                        {typeConfig.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${sevConfig.bg} ${sevConfig.text} ${sevConfig.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sevConfig.dot}`} />
                        Severidad {sevConfig.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleActive(alert)}
                        title="Desactivar alerta"
                        className="px-2 py-1 rounded-lg text-[10px] text-[#7A6B62] hover:bg-[#FAF7F2] hover:text-[#241E1A] transition-colors"
                      >
                        Desactivar
                      </button>
                      <button
                        onClick={() => handleStartEdit(alert)}
                        title="Editar"
                        className="p-1 rounded-lg text-[#7A6B62] hover:bg-[#FAF7F2] hover:text-[#8E4455] transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAlert(alert.id)}
                        title="Eliminar"
                        className="p-1 rounded-lg text-[#7A6B62] hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h6 className="font-semibold text-xs text-[#241E1A]">
                      {alert.descripcion}
                    </h6>
                    {alert.productoServicioRelacionado && (
                      <p className="text-[11px] text-[#8E4455] font-medium mt-0.5">
                        ⚠️ Producto/Técnica a evitar: <span className="underline">{alert.productoServicioRelacionado}</span>
                      </p>
                    )}
                    {alert.observaciones && (
                      <p className="text-[11px] text-[#5C4D44] bg-[#FAF7F2] p-2 rounded-xl mt-1.5">
                        📝 Indicación técnica: {alert.observaciones}
                      </p>
                    )}
                  </div>

                  <div className="text-[10px] text-[#8C7A70] flex items-center gap-1 font-mono pt-1">
                    <Calendar className="w-3 h-3" />
                    Registrado el {alert.fecha}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inactive / Resolved Alerts History */}
      {inactiveAlerts.length > 0 && (
        <div className="space-y-3 pt-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-[#8C7A70]">
            Historial de Antecedentes Inactivos / Resueltos ({inactiveAlerts.length})
          </h5>
          <div className="space-y-2">
            {inactiveAlerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-stone-50 p-3 rounded-xl border border-stone-200 opacity-75 hover:opacity-100 transition-opacity flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="line-through font-medium text-stone-600">{alert.descripcion}</span>
                  <span className="text-[10px] text-stone-400 block font-mono">Fecha: {alert.fecha}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(alert)}
                    className="text-[11px] font-semibold text-[#8E4455] hover:underline"
                  >
                    Reactivar
                  </button>
                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="text-stone-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
