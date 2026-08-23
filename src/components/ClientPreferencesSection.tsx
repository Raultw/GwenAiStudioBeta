import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Heart, 
  Check, 
  Plus, 
  X, 
  Save, 
  Palette, 
  Scissors, 
  ShieldAlert, 
  FileText,
  Edit3,
  ThumbsUp,
  Ban,
  Tag
} from 'lucide-react';
import type { ClientPreferences } from '../types.js';

interface ClientPreferencesSectionProps {
  clientId: string;
  preferences: ClientPreferences | null;
  onPreferencesUpdated: () => void;
  showToast: (msg: string) => void;
}

const NAIL_SHAPES = [
  { id: 'Almendra', label: 'Almendra', icon: '🌰' },
  { id: 'Cuadrada', label: 'Cuadrada', icon: '⬛' },
  { id: 'Coffin / Ballerina', label: 'Coffin', icon: '🩰' },
  { id: 'Stiletto', label: 'Stiletto', icon: '🗡️' },
  { id: 'Oval', label: 'Ovalada', icon: '🥚' },
  { id: 'Redonda', label: 'Redonda', icon: '⚪' },
  { id: 'Squoval', label: 'Squoval', icon: '◽' }
];

const NAIL_LENGTHS = [
  { id: 'Corto / Al ras', label: 'Corto (al ras)' },
  { id: 'Medio (Nº 1-2)', label: 'Medio (Nº 1-2)' },
  { id: 'Largo (Nº 3-4)', label: 'Largo (Nº 3-4)' },
  { id: 'Extra Largo (XL / 5+)', label: 'Extra Largo (XL)' }
];

const NAIL_STYLES = [
  { id: 'Minimalista / Clean Girl', label: 'Clean Girl & Nude' },
  { id: 'Francesita / Micro French', label: 'Francesita / Micro French' },
  { id: 'Glazed Donut / Chrome', label: 'Glazed Donut & Chrome' },
  { id: 'Nail Art a Mano Alzada', label: 'Nail Art a Mano Alzada' },
  { id: 'Liso Monocromático Intenso', label: 'Liso Monocromático' },
  { id: 'Baby Boomer / Degradé', label: 'Baby Boomer / Degradé' },
  { id: '3D & Joyas / Dijes', label: '3D & Cristalería' }
];

const POPULAR_COLORS = [
  { name: 'Vía Láctea / Milky', hex: '#F5F2EB' },
  { name: 'Nude Rosé', hex: '#E8C5B8' },
  { name: 'Cherry Red / Borgoña', hex: '#6B1124' },
  { name: 'Rojo Carmesí', hex: '#B81424' },
  { name: 'Chocolate / Café', hex: '#4A2E1B' },
  { name: 'Rosa Pastel', hex: '#F7C6D9' },
  { name: 'Negro Profundo', hex: '#1C1917' },
  { name: 'Blanco Puro', hex: '#FFFFFF' },
  { name: 'Verde Matcha', hex: '#8A9A5B' },
  { name: 'Azul Noche', hex: '#1B2A4A' },
  { name: 'Dorado / Shimmer', hex: '#D4AF37' },
  { name: 'Lila Lavanda', hex: '#D8B4E2' }
];

export const ClientPreferencesSection: React.FC<ClientPreferencesSectionProps> = ({
  clientId,
  preferences,
  onPreferencesUpdated,
  showToast
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [customColorInput, setCustomColorInput] = useState<string>('');

  const [form, setForm] = useState<{
    formaUnas: string;
    largoHabitual: string;
    estilo: string;
    coloresPreferidos: string[];
    productosPreferidos: string;
    productosEvitar: string;
    observacionesGenerales: string;
  }>({
    formaUnas: '',
    largoHabitual: '',
    estilo: '',
    coloresPreferidos: [],
    productosPreferidos: '',
    productosEvitar: '',
    observacionesGenerales: ''
  });

  const hasAnyPreference = Boolean(
    preferences && (
      preferences.formaUnas ||
      preferences.largoHabitual ||
      preferences.estilo ||
      (preferences.coloresPreferidos && preferences.coloresPreferidos.length > 0) ||
      preferences.productosPreferidos ||
      preferences.productosEvitar ||
      preferences.observacionesGenerales
    )
  );

  useEffect(() => {
    if (preferences) {
      setForm({
        formaUnas: preferences.formaUnas || '',
        largoHabitual: preferences.largoHabitual || '',
        estilo: preferences.estilo || '',
        coloresPreferidos: preferences.coloresPreferidos || [],
        productosPreferidos: preferences.productosPreferidos || '',
        productosEvitar: preferences.productosEvitar || '',
        observacionesGenerales: preferences.observacionesGenerales || ''
      });
      // If client has data, default to clean summary view
      setIsEditing(!hasAnyPreference);
    } else {
      setForm({
        formaUnas: '',
        largoHabitual: '',
        estilo: '',
        coloresPreferidos: [],
        productosPreferidos: '',
        productosEvitar: '',
        observacionesGenerales: ''
      });
      setIsEditing(true);
    }
  }, [preferences, hasAnyPreference]);

  const handleToggleColor = (colorName: string) => {
    setForm(prev => {
      const exists = prev.coloresPreferidos.includes(colorName);
      if (exists) {
        return { ...prev, coloresPreferidos: prev.coloresPreferidos.filter(c => c !== colorName) };
      } else {
        return { ...prev, coloresPreferidos: [...prev.coloresPreferidos, colorName] };
      }
    });
  };

  const handleAddCustomColor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customColorInput.trim()) return;
    const color = customColorInput.trim();
    if (!form.coloresPreferidos.includes(color)) {
      setForm(prev => ({ ...prev, coloresPreferidos: [...prev.coloresPreferidos, color] }));
    }
    setCustomColorInput('');
  };

  const handleRemoveColor = (colorName: string) => {
    setForm(prev => ({
      ...prev,
      coloresPreferidos: prev.coloresPreferidos.filter(c => c !== colorName)
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/clientes/${clientId}/preferencias`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        showToast('Preferencias estéticas guardadas con éxito.');
        setIsEditing(false);
        onPreferencesUpdated();
      } else {
        showToast('Error al guardar preferencias.');
      }
    } catch (err) {
      console.error('Error saving client preferences:', err);
      showToast('Error de conexión al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedShapeObj = NAIL_SHAPES.find(s => s.id === form.formaUnas);

  return (
    <div className="space-y-6">
      {/* Header Banner - Normalizado idéntico a Alertas */}
      <div className="bg-gradient-to-r from-rose-50/70 to-purple-50/70 p-4 rounded-2xl border border-rose-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8E4455]/15 text-[#8E4455] flex items-center justify-center font-bold">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif text-sm font-bold text-[#241E1A] flex items-center gap-2">
              Preferencias & Estilo Habitual
              {hasAnyPreference && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Configurado
                </span>
              )}
            </h4>
            <p className="text-[11px] text-[#7A6B62]">
              Ficha visual resumida con formas, largos y paletas predilectas de la clienta.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(prev => !prev)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
            isEditing 
              ? 'bg-[#FAF7F2] text-[#4A3E39] border border-[#D9C9BF] hover:bg-white' 
              : 'bg-[#8E4455] text-white hover:bg-[#783746]'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>{isEditing ? 'Ver Resumen' : 'Editar Preferencias'}</span>
        </button>
      </div>

      {/* ================= RESUMEN RÁPIDO Y LINEAL (DE UN VISTAZO) ================= */}
      {!isEditing && (
        <div className="bg-white rounded-2xl border border-[#E8DCD5] p-5 shadow-xs space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-[#FAF7F2]">
            <h5 className="font-serif text-xs font-bold uppercase tracking-wider text-[#8E4455] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              Resumen Técnico para la Atención
            </h5>
            <span className="text-[10px] text-[#8C7A70]">Información lista para usar en mesa</span>
          </div>

          {!hasAnyPreference ? (
            <div className="p-6 text-center bg-[#FAF7F2] rounded-xl border border-dashed border-[#D9C9BF]">
              <Heart className="w-8 h-8 text-[#D9C9BF] mx-auto mb-2" />
              <p className="text-xs font-medium text-[#5C4D44]">Aún no hay preferencias registradas para esta clienta.</p>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-[#8E4455] text-white text-xs font-semibold hover:bg-[#783746] transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Cargar Preferencias Ahora
              </button>
            </div>
          ) : (
            <div className="space-y-3.5 text-xs text-[#241E1A]">
              {/* Line 1: Forma, Largo y Estilo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5]">
                  <span className="text-[10px] uppercase font-bold text-[#8C7A70] flex items-center gap-1 mb-1">
                    <Scissors className="w-3 h-3 text-[#8E4455]" />
                    Forma de Uña
                  </span>
                  <div className="font-semibold text-sm text-[#241E1A] flex items-center gap-1.5">
                    {selectedShapeObj?.icon || '💅'} {form.formaUnas || 'No especificada'}
                  </div>
                </div>

                <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5]">
                  <span className="text-[10px] uppercase font-bold text-[#8C7A70] flex items-center gap-1 mb-1">
                    <Sparkles className="w-3 h-3 text-[#8E4455]" />
                    Largo Habitual
                  </span>
                  <div className="font-semibold text-sm text-[#241E1A]">
                    {form.largoHabitual || 'No especificado'}
                  </div>
                </div>

                <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5]">
                  <span className="text-[10px] uppercase font-bold text-[#8C7A70] flex items-center gap-1 mb-1">
                    <Palette className="w-3 h-3 text-[#8E4455]" />
                    Estilo / Técnica
                  </span>
                  <div className="font-semibold text-sm text-[#241E1A] truncate">
                    {form.estilo || 'No especificado'}
                  </div>
                </div>
              </div>

              {/* Line 2: Paleta de Colores Preferidos */}
              <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5]">
                <span className="text-[10px] uppercase font-bold text-[#8C7A70] flex items-center gap-1 mb-2">
                  <Palette className="w-3 h-3 text-[#8E4455]" />
                  Paleta de Colores & Tonos Predilectos
                </span>
                {form.coloresPreferidos && form.coloresPreferidos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {form.coloresPreferidos.map((colName) => {
                      const found = POPULAR_COLORS.find(c => c.name === colName);
                      return (
                        <span
                          key={colName}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#D9C9BF] text-xs font-semibold text-[#241E1A] flex items-center gap-1.5 shadow-xs"
                        >
                          <span 
                            className="w-3 h-3 rounded-full border border-black/15 shrink-0" 
                            style={{ backgroundColor: found?.hex || '#8E4455' }}
                          />
                          <span>{colName}</span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-xs text-[#7A6B62] italic">Sin colores predilectos especificados.</span>
                )}
              </div>

              {/* Line 3: Productos Favoritos & Productos a Evitar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {form.productosPreferidos && (
                  <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 flex items-center gap-1 mb-1">
                      <ThumbsUp className="w-3 h-3 text-emerald-600" />
                      Productos / Marcas Favoritas
                    </span>
                    <p className="text-xs text-emerald-950 font-medium whitespace-pre-line leading-relaxed">
                      {form.productosPreferidos}
                    </p>
                  </div>
                )}

                {form.productosEvitar && (
                  <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                    <span className="text-[10px] uppercase font-bold text-amber-800 flex items-center gap-1 mb-1">
                      <Ban className="w-3 h-3 text-amber-600" />
                      Productos o Técnicas que No le gustan
                    </span>
                    <p className="text-xs text-amber-950 font-medium whitespace-pre-line leading-relaxed">
                      {form.productosEvitar}
                    </p>
                  </div>
                )}
              </div>

              {/* Line 4: Observaciones Generales */}
              {form.observacionesGenerales && (
                <div className="bg-purple-50/40 p-3 rounded-xl border border-purple-200">
                  <span className="text-[10px] uppercase font-bold text-purple-900 flex items-center gap-1 mb-1">
                    <FileText className="w-3 h-3 text-purple-700" />
                    Observaciones Estéticas Generales
                  </span>
                  <p className="text-xs text-purple-950 leading-relaxed italic">
                    "{form.observacionesGenerales}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= SECCIÓN DE EDICIÓN COMPACTA ================= */}
      {isEditing && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-[#E8DCD5] p-5 shadow-xs space-y-5 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-[#FAF7F2]">
            <h5 className="font-serif text-xs font-bold uppercase tracking-wider text-[#8E4455] flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              Editar Ficha de Preferencias
            </h5>
            <span className="text-[11px] text-[#7A6B62]">Selección ágil y directa</span>
          </div>

          {/* 1. Forma de Uñas - Compact Chips */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#4A3E39] flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-[#8E4455]" />
              Forma de Uña
            </label>
            <div className="flex flex-wrap gap-1.5">
              {NAIL_SHAPES.map((shape) => {
                const isSelected = form.formaUnas === shape.id;
                return (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, formaUnas: isSelected ? '' : shape.id }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#8E4455] text-white border-[#8E4455] font-semibold shadow-xs'
                        : 'bg-[#FAF7F2] text-[#241E1A] border-[#E8DCD5] hover:bg-white'
                    }`}
                  >
                    <span>{shape.icon}</span>
                    <span>{shape.label}</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Largo Habitual - Compact Pills */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#4A3E39] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#8E4455]" />
              Largo Habitual
            </label>
            <div className="flex flex-wrap gap-1.5">
              {NAIL_LENGTHS.map((len) => {
                const isSelected = form.largoHabitual === len.id;
                return (
                  <button
                    key={len.id}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, largoHabitual: isSelected ? '' : len.id }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#8E4455] text-white border-[#8E4455] font-semibold shadow-xs'
                        : 'bg-[#FAF7F2] text-[#241E1A] border-[#E8DCD5] hover:bg-white'
                    }`}
                  >
                    {len.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Estilo / Técnica - Compact Pills */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#4A3E39] flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[#8E4455]" />
              Estilo / Técnica Predilecta
            </label>
            <div className="flex flex-wrap gap-1.5">
              {NAIL_STYLES.map((st) => {
                const isSelected = form.estilo === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, estilo: isSelected ? '' : st.id }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#8E4455] text-white border-[#8E4455] font-semibold shadow-xs'
                        : 'bg-[#FAF7F2] text-[#241E1A] border-[#E8DCD5] hover:bg-white'
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Colores y Tonos Predilectos */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#4A3E39] flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[#8E4455]" />
              Colores y Tonos Predilectos
            </label>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_COLORS.map((col) => {
                const isSelected = form.coloresPreferidos.includes(col.name);
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => handleToggleColor(col.name)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#8E4455] text-white border-[#8E4455] font-semibold shadow-xs'
                        : 'bg-[#FAF7F2] text-[#241E1A] border-[#E8DCD5] hover:bg-white'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: col.hex }}
                    />
                    <span>{col.name}</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>

            {/* Custom color input */}
            <div className="flex items-center gap-2 pt-1 max-w-md">
              <input
                type="text"
                value={customColorInput}
                onChange={(e) => setCustomColorInput(e.target.value)}
                placeholder="Otro tono (Ej: Terracota, Verde Oliva...)"
                className="flex-1 px-3 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomColor(e);
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddCustomColor}
                className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E8DCD5] border border-[#D9C9BF] text-xs font-semibold text-[#241E1A] transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Agregar
              </button>
            </div>

            {form.coloresPreferidos.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {form.coloresPreferidos.map((color) => (
                  <span
                    key={color}
                    className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-900 text-[11px] font-medium flex items-center gap-1"
                  >
                    {color}
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(color)}
                      className="text-rose-400 hover:text-rose-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 5. Campos de texto complementarios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-[#4A3E39] mb-1">
                Productos / Marcas Favoritas
              </label>
              <input
                type="text"
                value={form.productosPreferidos}
                onChange={(e) => setForm(prev => ({ ...prev, productosPreferidos: e.target.value }))}
                placeholder="Ej: Base Rubber Cherimoya, Top ultrabrillo..."
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4A3E39] mb-1">
                Productos o Técnicas que No le gustan
              </label>
              <input
                type="text"
                value={form.productosEvitar}
                onChange={(e) => setForm(prev => ({ ...prev, productosEvitar: e.target.value }))}
                placeholder="Ej: No le gusta el glitter grueso, prefiere brillante..."
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4A3E39] mb-1">
              Observaciones Generales de Estilo
            </label>
            <textarea
              rows={2}
              value={form.observacionesGenerales}
              onChange={(e) => setForm(prev => ({ ...prev, observacionesGenerales: e.target.value }))}
              placeholder="Ej: Trabaja mucho con la computadora, cuidar el borde libre..."
              className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455] resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#FAF7F2]">
            {hasAnyPreference && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl border border-[#D9C9BF] text-xs font-medium text-[#4A3E39] hover:bg-[#FAF7F2]"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#8E4455] text-white text-xs font-semibold hover:bg-[#783746] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Guardando...' : 'Guardar Preferencias'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
