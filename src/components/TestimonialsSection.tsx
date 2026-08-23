import React, { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';

interface Testimonial {
  id: string;
  name: string;
  avatarLetter: string;
  source: string;
  text: string;
  rating: number;
}

export const TestimonialsSection: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const testimonials: Testimonial[] = [
    {
      id: '1',
      name: 'Camila V.',
      avatarLetter: 'C',
      source: 'Google Reviews',
      text: 'La dedicación y el detalle de Sofía no se comparan con ningún otro lugar. Mis uñas duran 4 semanas impecables, sin desprendimientos. El estudio es súper tranquilo y hermoso.',
      rating: 5
    },
    {
      id: '2',
      name: 'Valentina R.',
      avatarLetter: 'V',
      source: 'Instagram',
      text: 'Probé varios lugares en Palermo, pero acá encontré el trato, la limpieza y la calidad que buscaba. Me explicó el paso a paso del Soft Gel y me cuidó muchísimo la uña natural.',
      rating: 5
    },
    {
      id: '3',
      name: 'Lucía F.',
      avatarLetter: 'L',
      source: 'WhatsApp',
      text: 'El ambiente es increíble y la música suave te desconecta del día. El kapping fortalecedor me cambió la vida, mis uñas ya no se quiebran. Ya tengo mi turno agendado para el mes que viene.',
      rating: 5
    },
    {
      id: '4',
      name: 'Carolina M.',
      avatarLetter: 'C',
      source: 'Google Reviews',
      text: 'Me trató como si me conociera de toda la vida. Se nota que ama lo que hace y el instrumental estéril que abren frente a vos da muchísima tranquilidad y confianza.',
      rating: 5
    },
    {
      id: '5',
      name: 'Agustina T.',
      avatarLetter: 'A',
      source: 'Instagram',
      text: 'Fui por primera vez recomendada por una amiga y quedé enamorada. El Nail Art a mano alzada que me hizo fue idéntico a la foto que le mostré. ¡Clienta fiel para siempre!',
      rating: 5
    }
  ];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  // Auto advance smoothly
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const current = testimonials[currentIndex];

  return (
    <section id="testimonios" className="py-20 md:py-28 bg-[#F5EFEB] border-t border-b border-[#E8DCD5]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.25em] text-[#8E4455] font-semibold mb-3 block">
            Voces de Nuestras Clientas
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#241E1A] font-medium tracking-tight mb-4">
            Lo que dicen de la experiencia Gwen
          </h2>
          <div className="flex items-center justify-center gap-1 text-[#D4AF37]">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-current" />
            ))}
            <span className="text-xs text-[#5A4B43] ml-2 font-medium">4.9 de calificación promedio</span>
          </div>
        </div>

        {/* Carousel Card */}
        <div className="relative bg-white rounded-3xl p-8 sm:p-12 border border-[#E8DCD5] shadow-sm max-w-3xl mx-auto">
          <Quote className="w-12 h-12 text-[#E8C5CE]/60 mb-6" />

          <p className="font-serif text-xl sm:text-2xl text-[#241E1A] leading-relaxed italic mb-8 min-h-[100px]">
            "{current.text}"
          </p>

          <div className="flex items-center justify-between pt-6 border-t border-[#F0E6DE]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#8E4455] text-white flex items-center justify-center font-serif text-lg font-medium">
                {current.avatarLetter}
              </div>
              <div>
                <h4 className="font-medium text-[#241E1A] text-base">{current.name}</h4>
                <span className="text-xs text-[#8C7A70]">{current.source}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="w-10 h-10 rounded-full border border-[#D9C9BF] flex items-center justify-center text-[#4A3E39] hover:bg-[#FAF7F2] hover:border-[#8E4455] transition-colors cursor-pointer"
                aria-label="Testimonio anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="w-10 h-10 rounded-full border border-[#D9C9BF] flex items-center justify-center text-[#4A3E39] hover:bg-[#FAF7F2] hover:border-[#8E4455] transition-colors cursor-pointer"
                aria-label="Siguiente testimonio"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center justify-center gap-2 mt-8">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentIndex === idx ? 'w-6 bg-[#8E4455]' : 'w-2 bg-[#D9C9BF]'
                }`}
                aria-label={`Ir a testimonio ${idx + 1}`}
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
