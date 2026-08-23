import React, { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

export const WhatsAppFab: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [customMsg, setCustomMsg] = useState('');

  const studioPhone = '5491115682386';

  const quickOptions = [
    '¡Hola Sofía! Quiero consultar disponibilidad para esta semana ✨',
    'Hola Gwen Nails, tengo dudas sobre qué técnica me conviene (Kapping o Soft Gel)',
    'Hola! Quería consultar por presupuesto para un diseño de Nail Art personalizado'
  ];

  const handleSend = (text: string) => {
    const url = `https://wa.me/${studioPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
    setCustomMsg('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Expanded Quick Message Bubble */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-88 bg-white rounded-3xl p-5 shadow-2xl border border-[#E8DCD5] animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8DCD5] mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold text-xs">
                <MessageCircle className="w-4 h-4 fill-current" />
              </div>
              <div>
                <h4 className="font-serif font-medium text-sm text-[#241E1A]">Gwen Nails Studio</h4>
                <p className="text-[10px] text-emerald-600 font-medium">● Respondemos en minutos</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#8C7A70] hover:text-[#241E1A] p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[#5A4B43] mb-3">
            ¿En qué podemos ayudarte hoy? Elegí una consulta rápida o escribinos tu mensaje:
          </p>

          <div className="space-y-1.5 mb-3">
            {quickOptions.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(opt)}
                className="w-full text-left p-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#E8C5CE]/30 border border-[#E8DCD5] text-[11px] text-[#241E1A] transition-colors leading-tight cursor-pointer"
              >
                {opt}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customMsg.trim()) {
                  handleSend(customMsg);
                }
              }}
              placeholder="Escribí tu consulta..."
              className="w-full pl-3 pr-10 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
            />
            <button
              onClick={() => customMsg.trim() && handleSend(customMsg)}
              disabled={!customMsg.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[#25D366] text-white hover:bg-[#20bd5a] disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-[#25D366] text-white shadow-xl hover:bg-[#20bd5a] hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer border-2 border-white"
        aria-label="Abrir chat de WhatsApp"
        title="Consultar por WhatsApp"
      >
        <MessageCircle className="w-7 h-7 fill-current" />
      </button>
    </div>
  );
};
