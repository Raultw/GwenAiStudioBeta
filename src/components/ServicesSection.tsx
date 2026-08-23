import React, { useState } from 'react';
import { Clock, Check, ArrowRight, Sparkles, Star } from 'lucide-react';
import type { Service } from '../types.js';

interface ServicesSectionProps {
  services: Service[];
  onSelectServiceForBooking: (serviceId: string) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  services,
  onSelectServiceForBooking,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  const categories = [
    { id: 'todos', label: 'Todos los Servicios' },
    { id: 'esculpidas', label: 'Soft Gel & Esculpidas' },
    { id: 'esmaltado', label: 'Semipermanente' },
    { id: 'cuidado', label: 'Kapping & Cuidado' },
    { id: 'arte', label: 'Nail Art' },
  ];

  const filteredServices = selectedCategory === 'todos'
    ? services.filter(s => s.activo)
    : services.filter(s => s.activo && s.categoria === selectedCategory);

  return (
    <section id="servicios" className="py-20 md:py-28 bg-[#F5EFEB] border-t border-b border-[#E8DCD5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.25em] text-[#8E4455] font-semibold mb-3 block">
            Nuestra Carta de Servicios
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#241E1A] font-medium tracking-tight mb-4">
            Todo lo que tus manos merecen
          </h2>
          <p className="text-base text-[#5A4B43] font-light leading-relaxed">
            Precios transparentes y tiempos dedicados con la mayor prolijidad. Seleccioná cualquier servicio para consultar disponibilidad inmediata.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-5 py-2 rounded-full text-xs sm:text-sm font-medium tracking-wide transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#8E4455] text-white shadow-xs'
                  : 'bg-white text-[#5A4B43] border border-[#D9C9BF] hover:bg-[#FAF7F2] hover:border-[#8E4455]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className={`relative rounded-3xl p-7 flex flex-col justify-between transition-all duration-300 ${
                service.esPopular
                  ? 'bg-white border-2 border-[#8E4455] shadow-lg shadow-[#8E4455]/5'
                  : 'bg-white border border-[#E8DCD5] hover:border-[#8E4455]/40 hover:shadow-md'
              }`}
            >
              {/* Popular Badge */}
              {service.esPopular && (
                <div className="absolute -top-3.5 right-6 px-3.5 py-1 rounded-full bg-[#8E4455] text-white text-[11px] font-semibold tracking-wider uppercase flex items-center gap-1 shadow-xs">
                  <Star className="w-3 h-3 fill-current" />
                  <span>Más Elegido</span>
                </div>
              )}

              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-[#E8DCD5] text-2xl flex items-center justify-center shrink-0">
                    {service.icono}
                  </div>
                  <div className="text-right">
                    <span className="text-2xl sm:text-3xl font-serif font-semibold text-[#241E1A]">
                      ${service.precio.toLocaleString('es-AR')}
                    </span>
                    <span className="block text-[11px] text-[#8C7A70] uppercase tracking-wider">ARS</span>
                  </div>
                </div>

                {/* Title & Duration */}
                <h3 className="font-serif text-2xl font-medium text-[#241E1A] mb-2">
                  {service.nombre}
                </h3>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF7F2] text-[#7A6B62] text-xs font-medium mb-4">
                  <Clock className="w-3.5 h-3.5 text-[#8E4455]" />
                  <span>{service.duracionMinutos} minutos de sesión</span>
                </div>

                {/* Description */}
                <p className="text-sm text-[#5A4B43] leading-relaxed mb-6 font-light">
                  {service.descripcion}
                </p>

                {/* Features checklist */}
                {service.detalles && service.detalles.length > 0 && (
                  <ul className="space-y-2 mb-8 pt-4 border-t border-[#F0E6DE]">
                    {service.detalles.map((detalle, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[#5A4B43]">
                        <Check className="w-3.5 h-3.5 text-[#8E4455] shrink-0 mt-0.5" />
                        <span>{detalle}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={() => onSelectServiceForBooking(service.id)}
                className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-medium tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  service.esPopular
                    ? 'bg-[#8E4455] text-white hover:bg-[#783645] shadow-xs'
                    : 'bg-[#FAF7F2] text-[#241E1A] border border-[#D9C9BF] hover:bg-[#8E4455] hover:text-white hover:border-[#8E4455]'
                }`}
              >
                <span>Reservar este servicio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Footnote about bespoke nail art */}
        <div className="mt-12 text-center p-6 rounded-2xl bg-white/70 border border-[#E8DCD5] max-w-2xl mx-auto">
          <p className="text-xs sm:text-sm text-[#6E5D55]">
            💡 ¿Tenés una foto de referencia de un diseño especial? Podés adjuntar la descripción en el formulario de reserva o enviárnosla por WhatsApp para presupuestar detalles personalizados.
          </p>
        </div>

      </div>
    </section>
  );
};
