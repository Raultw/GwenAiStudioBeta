import React from 'react';
import { Calendar, Sparkles, Star, ShieldCheck, Heart, ArrowDown } from 'lucide-react';

interface HeroProps {
  onBookNow: () => void;
  onExploreServices: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onBookNow, onExploreServices }) => {
  return (
    <section className="relative overflow-hidden bg-[#F5EFEB] pt-12 pb-20 md:pt-16 md:pb-28 border-b border-[#E8DCD5]">
      {/* Decorative ambient gradients */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-[#E8C5CE]/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 -mb-20 w-80 h-80 rounded-full bg-[#D4AF37]/15 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Text Left Column */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            {/* Studio Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-[#D9C9BF] text-xs font-medium text-[#783645] mb-6 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Estudio Boutique · Palermo Hollywood</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[#241E1A] leading-[1.12] mb-6">
              Donde tus manos <br />
              <span className="italic font-normal text-[#8E4455]">cuentan tu historia.</span>
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-[#5A4B43] leading-relaxed max-w-2xl mb-8 font-light">
              Manicura rusa de precisión, extensiones <strong className="font-medium text-[#241E1A]">Soft Gel</strong>, kapping fortalecedor y nail art exclusivo. Un espacio creado para que disfrutes de una pausa de bienestar y belleza con productos premium y bioseguridad absoluta.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto mb-10">
              <button
                onClick={onBookNow}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-[#8E4455] text-white text-sm font-medium tracking-wide shadow-md hover:bg-[#783645] hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>Reservar Turno Online</span>
              </button>

              <button
                onClick={onExploreServices}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-white border border-[#D9C9BF] text-[#4A3E39] text-sm font-medium hover:bg-[#FAF7F2] hover:border-[#8E4455] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Ver Servicios & Precios</span>
              </button>
            </div>

            {/* Quick Guarantees bar */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-6 border-t border-[#E2D5CC] w-full max-w-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#E8C5CE]/40 flex items-center justify-center text-[#8E4455] shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-[#241E1A] font-sans">100% Estéril</p>
                  <p className="text-[#7A6B62] hidden sm:block">Autoclave médico</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#997A15] shrink-0">
                  <Star className="w-4 h-4 fill-[#D4AF37]" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-[#241E1A] font-sans">4.9 / 5 Estrellas</p>
                  <p className="text-[#7A6B62] hidden sm:block">+450 opiniones</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#E8C5CE]/40 flex items-center justify-center text-[#8E4455] shrink-0">
                  <Heart className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-[#241E1A] font-sans">Cruelty-Free</p>
                  <p className="text-[#7A6B62] hidden sm:block">Marcas premium</p>
                </div>
              </div>
            </div>

          </div>

          {/* Visual Right Column */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Photo frame */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/5] bg-[#E8DCD5]">
                <img
                  src="/hero-bg.jpg"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Fallback to high quality nail art image if needed
                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=1000&q=80";
                  }}
                  alt="Nail Art y Manicura Profesional en Gwen Nails Studio"
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                />
                
                {/* Floating pill: Sofía L. */}
                <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-[#E8DCD5] shadow-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#8E4455] text-white flex items-center justify-center font-serif text-lg font-medium">
                      S
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#241E1A]">Sofía L.</p>
                      <p className="text-xs text-[#7A6B62]">Esculpidora & Artista Principal</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-sans font-bold bg-[#F5EFEB] text-[#8E4455] px-2.5 py-1 rounded-full border border-[#E2D5CC]">
                    10+ Años
                  </span>
                </div>
              </div>

              {/* Decorative side accent badge */}
              <div className="absolute -top-4 -right-4 bg-[#241E1A] text-[#E8DCC4] p-3 rounded-2xl shadow-xl hidden sm:flex items-center gap-2 text-xs border border-[#4A3E39]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Turnos de la semana disponibles</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
