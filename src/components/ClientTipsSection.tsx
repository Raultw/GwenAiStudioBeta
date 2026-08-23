import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Copy, 
  Save, 
  Check, 
  Sliders, 
  Hand,
  Plus,
  Trash2,
  Edit3,
  AlertCircle,
  CheckCircle2,
  ArrowRightLeft,
  ChevronDown
} from 'lucide-react';
import type { ClientTipConfigItem, HandKey, FingerKey } from '../types.js';

interface ClientTipsSectionProps {
  clientId: string;
  tipsConfig: ClientTipConfigItem[];
  onTipsUpdated: () => void;
  showToast: (msg: string) => void;
}

const FINGERS: { key: FingerKey; label: string; icon: string; short: string }[] = [
  { key: 'pulgar', label: 'Pulgar', icon: '👍', short: 'Pulgar' },
  { key: 'indice', label: 'Índice', icon: '☝️', short: 'Índice' },
  { key: 'medio', label: 'Medio / Mayor', icon: '🖐️', short: 'Medio' },
  { key: 'anular', label: 'Anular', icon: '💍', short: 'Anular' },
  { key: 'menique', label: 'Meñique', icon: '🤙', short: 'Meñique' }
];

const TIP_SIZES = ['00', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];

const BRAND_SUGGESTIONS = [
  'Cherimoya Soft Gel',
  'Aprés Gel-X',
  'Victoria Vynn Soft Gel',
  'Navi Pro Tips',
  'Soft Gel Curves',
  'Kinetics / Kapping Tips',
  'Genérico / Standard'
];

type HandFingerMatrix = Record<HandKey, Record<FingerKey, { tamanoTip: string; observaciones: string }>>;

const createDefaultHandMatrix = (): HandFingerMatrix => ({
  izquierda: {
    pulgar: { tamanoTip: '0', observaciones: '' },
    indice: { tamanoTip: '4', observaciones: '' },
    medio: { tamanoTip: '3', observaciones: '' },
    anular: { tamanoTip: '4', observaciones: '' },
    menique: { tamanoTip: '7', observaciones: '' }
  },
  derecha: {
    pulgar: { tamanoTip: '0', observaciones: '' },
    indice: { tamanoTip: '4', observaciones: '' },
    medio: { tamanoTip: '3', observaciones: '' },
    anular: { tamanoTip: '4', observaciones: '' },
    menique: { tamanoTip: '7', observaciones: '' }
  }
});

export const ClientTipsSection: React.FC<ClientTipsSectionProps> = ({
  clientId,
  tipsConfig,
  onTipsUpdated,
  showToast
}) => {
  // All brands stored for this client: Map brandName -> HandFingerMatrix
  const [brandsMap, setBrandsMap] = useState<Record<string, HandFingerMatrix>>({});
  const [selectedBrand, setSelectedBrand] = useState<string>('Cherimoya Soft Gel');
  
  // UI states
  const [activeEditingHand, setActiveEditingHand] = useState<HandKey>('izquierda');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isAddingBrand, setIsAddingBrand] = useState<boolean>(false);
  const [newBrandInput, setNewBrandInput] = useState<string>('');
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  // Initialize or update brandsMap from incoming tipsConfig
  useEffect(() => {
    const map: Record<string, HandFingerMatrix> = {};

    if (tipsConfig && tipsConfig.length > 0) {
      tipsConfig.forEach(item => {
        const brand = (item.marcaModelo || 'Cherimoya Soft Gel').trim();
        if (!map[brand]) {
          map[brand] = createDefaultHandMatrix();
        }
        if (item.mano && item.dedo && map[brand][item.mano] && map[brand][item.mano][item.dedo]) {
          map[brand][item.mano][item.dedo] = {
            tamanoTip: item.tamanoTip || '0',
            observaciones: item.observaciones || ''
          };
        }
      });
    }

    // If map is empty, initialize with default brand
    if (Object.keys(map).length === 0) {
      map['Cherimoya Soft Gel'] = createDefaultHandMatrix();
    }

    setBrandsMap(map);

    // Keep selectedBrand or pick first available
    const existingBrands = Object.keys(map);
    if (!map[selectedBrand] && existingBrands.length > 0) {
      setSelectedBrand(existingBrands[0]);
    }
  }, [tipsConfig]);

  const currentBrandsList = useMemo(() => Object.keys(brandsMap), [brandsMap]);
  const currentMatrix: HandFingerMatrix = brandsMap[selectedBrand] || createDefaultHandMatrix();

  // Normalize brand name: trims, removes accents, lowercase, collapses spaces
  const normalizeBrand = (brand: string = ''): string => {
    return String(brand || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ');
  };

  // Handlers for Brand Management
  const handleSelectBrand = (brand: string) => {
    setSelectedBrand(brand);
    setIsAddingBrand(false);
  };

  const handleCreateBrand = async (brandName: string) => {
    const cleanBrand = normalizeBrand(brandName);
    if (!cleanBrand) {
      showToast('Por favor ingrese un nombre de marca válido.');
      return;
    }

    // Check if brand already exists in the list (normalized check)
    const existing = currentBrandsList.find(b => normalizeBrand(b) === cleanBrand);
    if (existing) {
      setSelectedBrand(existing);
      setNewBrandInput('');
      setIsAddingBrand(false);
      showToast(`La marca "${existing}" ya está en la lista.`);
      return;
    }

    // Add brand to local map
    const newMatrix = createDefaultHandMatrix();
    const updatedMap = {
      ...brandsMap,
      [cleanBrand]: newMatrix
    };
    setBrandsMap(updatedMap);
    setSelectedBrand(cleanBrand);
    setNewBrandInput('');
    setIsAddingBrand(false);
    showToast(`Marca "${cleanBrand}" agregada exitosamente.`);

    // Persist to database
    try {
      const itemsToSave: ClientTipConfigItem[] = [];
      Object.entries(updatedMap).forEach(([brand, matrix]) => {
        (['izquierda', 'derecha'] as HandKey[]).forEach(hand => {
          (['pulgar', 'indice', 'medio', 'anular', 'menique'] as FingerKey[]).forEach(finger => {
            const d = matrix[hand][finger];
            itemsToSave.push({
              clienteId: clientId,
              mano: hand,
              dedo: finger,
              tamanoTip: d.tamanoTip,
              marcaModelo: brand,
              observaciones: d.observaciones
            });
          });
        });
      });

      await fetch(`/api/clientes/${clientId}/tips`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tips: itemsToSave })
      });
      onTipsUpdated();
    } catch (err) {
      console.error('Error saving new brand tips:', err);
    }
  };

  const handleDeleteBrand = async (brandToDelete: string) => {
    const remaining = currentBrandsList.filter(b => b !== brandToDelete);
    const nextBrand = remaining.length > 0 ? remaining[0] : 'cherimoya soft gel';
    
    let updatedMap: Record<string, HandFingerMatrix> = {};
    if (remaining.length === 0) {
      updatedMap = { [nextBrand]: createDefaultHandMatrix() };
    } else {
      updatedMap = { ...brandsMap };
      delete updatedMap[brandToDelete];
    }

    setBrandsMap(updatedMap);
    setSelectedBrand(nextBrand);
    showToast(`Marca "${brandToDelete}" quitada de la lista.`);

    // Save updated map to server to keep DB consistent
    try {
      const itemsToSave: ClientTipConfigItem[] = [];
      Object.entries(updatedMap).forEach(([brand, matrix]) => {
        (['izquierda', 'derecha'] as HandKey[]).forEach(hand => {
          (['pulgar', 'indice', 'medio', 'anular', 'menique'] as FingerKey[]).forEach(finger => {
            const d = matrix[hand][finger];
            itemsToSave.push({
              clienteId: clientId,
              mano: hand,
              dedo: finger,
              tamanoTip: d.tamanoTip,
              marcaModelo: brand,
              observaciones: d.observaciones
            });
          });
        });
      });

      await fetch(`/api/clientes/${clientId}/tips`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tips: itemsToSave })
      });
      onTipsUpdated();
    } catch (err) {
      console.error('Error deleting brand tips:', err);
    }
  };

  // Matrix finger edits
  const handleUpdateFinger = (hand: HandKey, finger: FingerKey, field: 'tamanoTip' | 'observaciones', val: string) => {
    setBrandsMap(prev => {
      const brandObj = prev[selectedBrand] ? JSON.parse(JSON.stringify(prev[selectedBrand])) : createDefaultHandMatrix();
      brandObj[hand][finger][field] = val;
      return {
        ...prev,
        [selectedBrand]: brandObj
      };
    });
  };

  const handleCopyLeftToRight = () => {
    setBrandsMap(prev => {
      const brandObj = prev[selectedBrand] ? JSON.parse(JSON.stringify(prev[selectedBrand])) : createDefaultHandMatrix();
      brandObj.derecha = JSON.parse(JSON.stringify(brandObj.izquierda));
      return {
        ...prev,
        [selectedBrand]: brandObj
      };
    });
    showToast(`Medidas de mano izquierda copiadas a mano derecha en ${selectedBrand}.`);
  };

  const handleCopySummaryToClipboard = () => {
    const izq = FINGERS.map(f => `${f.short.slice(0, 3)}: #${currentMatrix.izquierda[f.key].tamanoTip}`).join(', ');
    const der = FINGERS.map(f => `${f.short.slice(0, 3)}: #${currentMatrix.derecha[f.key].tamanoTip}`).join(', ');
    const text = `💅 Medidas Soft Gel (${selectedBrand}):\n🖐️ Izq: ${izq}\n✋ Der: ${der}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedSuccess(true);
      showToast('Medidas copiadas al portapapeles.');
      setTimeout(() => setCopiedSuccess(false), 3000);
    }).catch(() => {
      showToast('No se pudo copiar automáticamente.');
    });
  };

  // Save all brands & measurements to server
  const handleSaveAll = async () => {
    setIsSaving(true);
    const itemsToSave: ClientTipConfigItem[] = [];

    Object.entries(brandsMap).forEach(([brand, matrix]) => {
      (['izquierda', 'derecha'] as HandKey[]).forEach(hand => {
        (['pulgar', 'indice', 'medio', 'anular', 'menique'] as FingerKey[]).forEach(finger => {
          const d = matrix[hand][finger];
          itemsToSave.push({
            clienteId: clientId,
            mano: hand,
            dedo: finger,
            tamanoTip: d.tamanoTip,
            marcaModelo: brand,
            observaciones: d.observaciones
          });
        });
      });
    });

    try {
      const res = await fetch(`/api/clientes/${clientId}/tips`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tips: itemsToSave })
      });

      if (res.ok) {
        showToast(`Medidas guardadas con éxito para ${selectedBrand}.`);
        onTipsUpdated();
      } else {
        showToast('Error al guardar configuración de tips.');
      }
    } catch (err) {
      console.error('Error saving tips config:', err);
      showToast('Error de conexión al guardar tips.');
    } finally {
      setIsSaving(false);
    }
  };

  // Detect asymmetries between hands
  const asymmetries = useMemo(() => {
    const diffs: { finger: string; izq: string; der: string }[] = [];
    FINGERS.forEach(f => {
      const izq = currentMatrix.izquierda[f.key].tamanoTip;
      const der = currentMatrix.derecha[f.key].tamanoTip;
      if (izq !== der) {
        diffs.push({ finger: f.label, izq, der });
      }
    });
    return diffs;
  }, [currentMatrix]);

  return (
    <div className="space-y-5">
      {/* Header Banner - Compacto, ocupando poco espacio sin botones */}
      <div className="bg-gradient-to-r from-rose-50/70 via-[#FAF7F2] to-amber-50/70 p-3.5 rounded-2xl border border-[#E8DCD5] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#8E4455]/10 text-[#8E4455] flex items-center justify-center shrink-0">
          <Sliders className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-serif text-sm font-bold text-[#241E1A] flex items-center gap-2">
            Medidas de Tips & Soft Gel por Marca
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
              {currentBrandsList.length} {currentBrandsList.length === 1 ? 'marca' : 'marcas'}
            </span>
          </h4>
          <p className="text-[11px] text-[#7A6B62] truncate">
            Consultá el resumen rápido de numeración y ajustá medidas por marca cuando lo requieras.
          </p>
        </div>
      </div>

      {/* ================= GESTIÓN DINÁMICA DE MARCAS (DESPLEGABLE COMPACTO) ================= */}
      <div className="bg-white p-3.5 rounded-2xl border border-[#E8DCD5] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Dropdown Selector */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <label htmlFor="brand-select" className="text-xs font-bold text-[#4A3E39] flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5 text-[#8E4455]" />
              Marca de Tips:
            </label>
            
            <div className="relative flex-1 max-w-xs">
              <select
                id="brand-select"
                value={selectedBrand}
                onChange={(e) => handleSelectBrand(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs font-bold text-[#241E1A] focus:outline-none focus:border-[#8E4455] focus:bg-white transition-colors cursor-pointer appearance-none"
              >
                {currentBrandsList.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#7A6B62]">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            <span className="text-[11px] text-[#8C7A70] hidden md:inline">
              ({currentBrandsList.length} registradas)
            </span>
          </div>

          {/* Action Buttons: Agregar / Quitar */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {!isAddingBrand && (
              <button
                type="button"
                onClick={() => setIsAddingBrand(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#8E4455] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Otra Marca</span>
              </button>
            )}

            {currentBrandsList.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteBrand(selectedBrand)}
                className="px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 hover:border-rose-200 border border-transparent text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                title={`Eliminar configuración de ${selectedBrand}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Quitar Marca</span>
              </button>
            )}
          </div>
        </div>

        {/* Add Brand Form Inline */}
        {isAddingBrand && (
          <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#D9C9BF] space-y-2 animate-fade-in">
            <span className="text-xs font-bold text-[#241E1A] block">Agregar Nueva Marca a la Ficha:</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newBrandInput}
                onChange={(e) => setNewBrandInput(e.target.value)}
                placeholder="Nombre de la marca (Ej: Navi Pro, Organic Nails, D&Z...)"
                className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateBrand(newBrandInput);
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => handleCreateBrand(newBrandInput)}
                className="px-3.5 py-1.5 rounded-lg bg-[#8E4455] text-white text-xs font-semibold hover:bg-[#783746] cursor-pointer"
              >
                Agregar
              </button>
              <button
                type="button"
                onClick={() => setIsAddingBrand(false)}
                className="px-2.5 py-1.5 rounded-lg text-xs text-[#7A6B62] hover:bg-white cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            {/* Quick Brand Suggestions */}
            <div className="pt-1">
              <span className="text-[10px] text-[#8C7A70] block mb-1">Sugerencias rápidas:</span>
              <div className="flex flex-wrap gap-1">
                {BRAND_SUGGESTIONS.filter(b => !currentBrandsList.includes(b)).map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => handleCreateBrand(b)}
                    className="px-2 py-0.5 rounded-md bg-white border border-[#E8DCD5] text-[11px] text-[#4A3E39] hover:bg-rose-50 hover:text-rose-900 cursor-pointer"
                  >
                    + {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= RESUMEN PRINCIPAL DE MEDIDAS (AL INICIO) ================= */}
      <div className="bg-white rounded-2xl border border-[#E8DCD5] p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#FAF7F2]">
          <div>
            <h5 className="font-serif text-sm font-bold text-[#241E1A] flex items-center gap-2">
              <Hand className="w-4 h-4 text-[#8E4455]" />
              Resumen Rápido de Talles: <span className="text-[#8E4455]">{selectedBrand}</span>
            </h5>
            <p className="text-[11px] text-[#7A6B62]">
              Números de tips listos para colocar directamente en mesa de trabajo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#8C7A70] bg-[#FAF7F2] px-2.5 py-1 rounded-full border border-[#E8DCD5]">
              Marca: <strong>{selectedBrand}</strong>
            </span>

            <button
              type="button"
              onClick={handleCopySummaryToClipboard}
              className="px-3 py-1 rounded-xl bg-white border border-[#D9C9BF] text-xs font-semibold text-[#4A3E39] hover:bg-[#FAF7F2] transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Copiar medidas al portapapeles"
            >
              {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#8E4455]" />}
              <span>{copiedSuccess ? 'Copiado' : 'Copiar Medidas'}</span>
            </button>
          </div>
        </div>

        {/* Side-by-Side Hand Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Mano Izquierda */}
          <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DCD5] space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#E8DCD5]/60">
              <span className="font-bold text-xs text-[#8E4455] flex items-center gap-1.5">
                <span className="text-base">🖐️</span> Mano Izquierda
              </span>
              <span className="text-[10px] text-[#8C7A70] uppercase font-bold">5 Dedos</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {FINGERS.map(f => {
                const item = currentMatrix.izquierda[f.key];
                return (
                  <div key={f.key} className="bg-white p-2 rounded-xl border border-[#E8DCD5] text-center shadow-xs">
                    <span className="text-xs">{f.icon}</span>
                    <span className="text-[10px] text-[#8C7A70] block font-medium truncate mt-0.5">
                      {f.short}
                    </span>
                    <span className="font-serif font-extrabold text-sm text-[#241E1A] block mt-1">
                      #{item.tamanoTip}
                    </span>
                    {item.observaciones && (
                      <span className="text-[9px] text-[#8E4455] block truncate mt-0.5" title={item.observaciones}>
                        • {item.observaciones}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mano Derecha */}
          <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8DCD5] space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#E8DCD5]/60">
              <span className="font-bold text-xs text-[#8E4455] flex items-center gap-1.5">
                <span className="text-base">✋</span> Mano Derecha
              </span>
              <span className="text-[10px] text-[#8C7A70] uppercase font-bold">5 Dedos</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {FINGERS.map(f => {
                const item = currentMatrix.derecha[f.key];
                return (
                  <div key={f.key} className="bg-white p-2 rounded-xl border border-[#E8DCD5] text-center shadow-xs">
                    <span className="text-xs">{f.icon}</span>
                    <span className="text-[10px] text-[#8C7A70] block font-medium truncate mt-0.5">
                      {f.short}
                    </span>
                    <span className="font-serif font-extrabold text-sm text-[#241E1A] block mt-1">
                      #{item.tamanoTip}
                    </span>
                    {item.observaciones && (
                      <span className="text-[9px] text-[#8E4455] block truncate mt-0.5" title={item.observaciones}>
                        • {item.observaciones}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Asymmetry / Differences Box */}
        {asymmetries.length > 0 ? (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Asimetrías registradas entre manos: </span>
              {asymmetries.map((a, i) => (
                <span key={i} className="inline-block mr-2 font-medium">
                  {a.finger}: Izq #{a.izq} vs Der #{a.der}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Medidas simétricas en ambas manos (mismos números en izquierda y derecha).</span>
          </div>
        )}
      </div>

      {/* ================= SECCIÓN DE EDICIÓN / AJUSTE DE MEDIDAS (POR DEBAJO) ================= */}
      <div className="bg-white rounded-2xl border border-[#E8DCD5] p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#FAF7F2]">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#8E4455]" />
            <h5 className="font-serif text-xs font-bold uppercase tracking-wider text-[#4A3E39]">
              Editar / Ajustar Medidas de {selectedBrand}
            </h5>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLeftToRight}
              className="px-3 py-1 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs font-semibold text-[#4A3E39] hover:bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRightLeft className="w-3 h-3 text-[#8E4455]" />
              <span>Copiar Izq. a Der.</span>
            </button>
          </div>
        </div>

        {/* Hand selector for detailed inputs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveEditingHand('izquierda')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeEditingHand === 'izquierda'
                ? 'bg-[#8E4455] text-white shadow-xs'
                : 'bg-[#FAF7F2] text-[#5C4D44] border border-[#E8DCD5] hover:bg-white'
            }`}
          >
            <span>🖐️ Editar Mano Izquierda</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveEditingHand('derecha')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeEditingHand === 'derecha'
                ? 'bg-[#8E4455] text-white shadow-xs'
                : 'bg-[#FAF7F2] text-[#5C4D44] border border-[#E8DCD5] hover:bg-white'
            }`}
          >
            <span>✋ Editar Mano Derecha</span>
          </button>
        </div>

        {/* 5 Finger Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {FINGERS.map((finger) => {
            const current = currentMatrix[activeEditingHand][finger.key];
            return (
              <div
                key={finger.key}
                className="bg-[#FAF7F2] rounded-xl p-3.5 border border-[#E8DCD5] shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-[#E8DCD5]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{finger.icon}</span>
                    <span className="font-bold text-xs text-[#241E1A]">{finger.label}</span>
                  </div>
                </div>

                {/* Size picker */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#8C7A70] mb-1">
                    Número de Tip
                  </label>
                  <select
                    value={current.tamanoTip}
                    onChange={(e) => handleUpdateFinger(activeEditingHand, finger.key, 'tamanoTip', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#D9C9BF] text-xs font-bold text-[#8E4455] focus:outline-none focus:border-[#8E4455]"
                  >
                    {TIP_SIZES.map(sz => (
                      <option key={sz} value={sz}>
                        Talle #{sz}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Observations */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#8C7A70] mb-1">
                    Nota / Ajuste
                  </label>
                  <input
                    type="text"
                    value={current.observaciones}
                    onChange={(e) => handleUpdateFinger(activeEditingHand, finger.key, 'observaciones', e.target.value)}
                    placeholder="Ej: Limar laterales..."
                    className="w-full px-2 py-1 rounded-lg bg-white border border-[#D9C9BF] text-[11px] text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Save button at bottom of edit area */}
        <div className="flex justify-end pt-3 border-t border-[#FAF7F2]">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-6 py-2 rounded-xl bg-[#8E4455] text-white text-xs font-semibold hover:bg-[#783746] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Guardando...' : `Guardar Medidas de ${selectedBrand}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
