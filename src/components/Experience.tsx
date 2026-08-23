import React from 'react';
import { Award, ShieldCheck, Sparkles, HeartHandshake, Coffee, CheckCircle2 } from 'lucide-react';

export const Experience: React.FC = () => {
  return (
    <section id="experiencia" className="py-20 md:py-28 bg-[#FAF7F2] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase tracking-[0.25em] text-[#8E4455] font-semibold mb-3 block">
            Filosofía & Trayectoria
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#241E1A] font-medium tracking-tight mb-5">
            Una década perfeccionando el arte de cuidar tus manos
          </h2>
          <p className="text-base sm:text-lg text-[#5A4B43] font-light leading-relaxed">
            Comenzamos atendiendo a amigas y familia con la misma calidez y detalle que hoy mantenemos en nuestro estudio en Palermo. Creemos que la manicura es un ritual de autoexpresión y cuidado personal.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20 bg-white rounded-3xl p-8 border border-[#E8DCD5] shadow-xs">
          <div className="text-center md:border-r border-[#E8DCD5]/80 last:border-none p-2">
            <span className="font-sans text-4xl sm:text-5xl font-bold tracking-tight text-[#8E4455] block mb-1">10+</span>
            <span className="text-xs sm:text-sm text-[#7A6B62]">Años de experiencia continua</span>
          </div>
          <div className="text-center md:border-r border-[#E8DCD5]/80 last:border-none p-2">
            <span className="font-sans text-4xl sm:text-5xl font-bold tracking-tight text-[#241E1A] block mb-1">+4.200</span>
            <span className="text-xs sm:text-sm text-[#7A6B62]">Clientas que confían en nosotras</span>
          </div>
          <div className="text-center md:border-r border-[#E8DCD5]/80 last:border-none p-2">
            <span className="font-sans text-4xl sm:text-5xl font-bold tracking-tight text-[#D4AF37] block mb-1">100%</span>
            <span className="text-xs sm:text-sm text-[#7A6B62]">Bioseguridad & Instrumental estéril</span>
          </div>
          <div className="text-center p-2">
            <span className="font-sans text-4xl sm:text-5xl font-bold tracking-tight text-[#8E4455] block mb-1">1 a 1</span>
            <span className="text-xs sm:text-sm text-[#7A6B62]">Atención personalizada exclusiva</span>
          </div>
        </div>

        {/* 4 Pillars Grid with Experience visual */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Image Left */}
          <div className="lg:col-span-5 relative order-2 lg:order-1">
            <div className="relative rounded-3xl overflow-hidden shadow-xl border-4 border-white aspect-[3/4] bg-[#E8DCD5]">
              <img
                src="/experience.jpg"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80";
                }}
                alt="Espacio y herramientas de Gwen Nails"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#241E1A]/60 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <p className="text-xs uppercase tracking-wider font-semibold text-[#E8C5CE]">Espacio Seguro & Calmo</p>
                <p className="font-serif text-lg text-white">Café de especialidad, música suave y atención sin prisas.</p>
              </div>
            </div>
          </div>

          {/* 4 Value Pillars Right */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6 order-1 lg:order-2">
            
            <div className="p-6 rounded-2xl bg-white border border-[#E8DCD5] hover:border-[#8E4455]/40 transition-all shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] text-[#8E4455] flex items-center justify-center mb-4 border border-[#E8DCD5]">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-medium text-[#241E1A] mb-2">Técnica Rusa de Vanguardia</h3>
              <p className="text-sm text-[#6E5D55] leading-relaxed">
                Manicura combinada con fresas de diamante de alta precisión para un acabado limpio, simétrico y de máxima duración.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-[#E8DCD5] hover:border-[#8E4455]/40 transition-all shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] text-[#D4AF37] flex items-center justify-center mb-4 border border-[#E8DCD5]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-medium text-[#241E1A] mb-2">Bioseguridad Grado Médico</h3>
              <p className="text-sm text-[#6E5D55] leading-relaxed">
                Todo el instrumental de metal pasa por limpieza ultrasónica y autoclave sellado en pouch individual que abrimos frente a vos.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-[#E8DCD5] hover:border-[#8E4455]/40 transition-all shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] text-[#8E4455] flex items-center justify-center mb-4 border border-[#E8DCD5]">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-medium text-[#241E1A] mb-2">Materiales Hipoalergénicos</h3>
              <p className="text-sm text-[#6E5D55] leading-relaxed">
                Fórmulas 9-Free y Cruelty-Free de primera línea internacional, libres de monómeros agresivos que preservan la salud de la uña.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-[#E8DCD5] hover:border-[#8E4455]/40 transition-all shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] text-[#783645] flex items-center justify-center mb-4 border border-[#E8DCD5]">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-medium text-[#241E1A] mb-2">Atención Exclusiva 1 a 1</h3>
              <p className="text-sm text-[#6E5D55] leading-relaxed">
                Sin rotación de personal ni turnos superpuestos. Tiempo real dedicado a diseñar y materializar exactamente lo que imaginás.
              </p>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
