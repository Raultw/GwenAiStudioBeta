import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      question: '¿Con cuánta anticipación debo reservar mi turno?',
      answer: 'Recomendamos reservar con 3 a 7 días de anticipación para asegurar el día y horario que mejor te convenga, especialmente para turnos de tarde o días sábados que suelen tener alta demanda.'
    },
    {
      question: '¿Cuál es la diferencia entre Kapping y Soft Gel?',
      answer: 'El Kapping es un recubrimiento protector en gel que se aplica directamente sobre el largo natural de tu uña para reforzarla y evitar quiebres. El Soft Gel, en cambio, utiliza tips de gel flexibles para extender el largo de la uña manteniendo una apariencia liviana, natural y sumamente resistente.'
    },
    {
      question: '¿Cuánto tiempo dura el servicio y cada cuánto se realiza el mantenimiento?',
      answer: 'La duración varía entre 45 y 120 minutos según el servicio elegido. El mantenimiento o service se realiza generalmente cada 3 a 4 semanas, dependiendo del crecimiento natural de tus uñas.'
    },
    {
      question: '¿Cómo debo preparar mis manos antes de asistir al turno?',
      answer: 'Lo ideal es asistir con las uñas limpias, sin esmalte tradicional y sin cortar las cutículas en los días previos. Si ya tenés material colocado en otro salón, por favor avísanos en las observaciones para contemplar el tiempo de retiro adecuado.'
    },
    {
      question: '¿Qué medios de pago aceptan?',
      answer: 'Aceptamos transferencias bancarias / Mercado Pago, efectivo y tarjetas de débito/crédito.'
    },
    {
      question: '¿Qué sucede si necesito cancelar o reprogramar mi turno?',
      answer: 'Podés cancelar o reprogramar tu turno con al menos 24 horas de anticipación comunicándote por WhatsApp para que podamos reasignar el horario.'
    }
  ];

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 md:py-28 bg-[#FAF7F2]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.25em] text-[#8E4455] font-semibold mb-3 block">
            Dudas Frecuentes
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#241E1A] font-medium tracking-tight mb-4">
            Todo lo que necesitás saber
          </h2>
          <p className="text-base text-[#5A4B43] font-light">
            Respuestas a las consultas más habituales sobre nuestros procedimientos, cuidados y sistema de turnos.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-[#E8DCD5] overflow-hidden transition-all shadow-xs"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 text-base sm:text-lg font-medium text-[#241E1A] hover:text-[#8E4455] transition-colors cursor-pointer"
                >
                  <span className="font-serif">{faq.question}</span>
                  <div className={`w-8 h-8 rounded-full bg-[#FAF7F2] flex items-center justify-center text-[#4A3E39] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#8E4455]' : ''}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm text-[#5A4B43] leading-relaxed border-t border-[#F0E6DE]/60 animate-in fade-in duration-200 font-light">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
