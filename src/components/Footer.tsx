import React from 'react';
import { Instagram, Phone, MapPin, Clock, Lock, Heart } from 'lucide-react';

interface FooterProps {
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdmin }) => {
  return (
    <footer className="bg-[#241E1A] text-[#E8DCC4] pt-16 pb-12 border-t border-[#3B322C]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main 4-column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-[#3B322C]">
          
          {/* Brand Col */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex flex-col leading-none">
              <span className="font-serif text-3xl font-medium tracking-tight text-white">
                Gwen <span className="font-sans text-xs uppercase tracking-[0.25em] font-light text-[#E8C5CE] ml-1">Nails</span>
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#C4B0A3] mt-1">
                Boutique Studio · Palermo
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#A6978E] leading-relaxed max-w-sm font-light">
              Donde tus manos cuentan tu historia. Un espacio dedicado a la belleza de tus uñas con técnicas de autor, atención personalizada y bioseguridad absoluta.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://instagram.com/gwennails"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#8E4455] text-white flex items-center justify-center transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://wa.me/5491115682386"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#25D366] text-white flex items-center justify-center transition-colors"
                aria-label="WhatsApp"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-serif text-base font-medium text-white">Explorar</h4>
            <ul className="space-y-2 text-xs text-[#A6978E]">
              <li><a href="#experiencia" className="hover:text-white transition-colors">La Experiencia</a></li>
              <li><a href="#servicios" className="hover:text-white transition-colors">Nuestros Servicios</a></li>
              <li><a href="#galeria" className="hover:text-white transition-colors">Galería de Estilos</a></li>
              <li><a href="#testimonios" className="hover:text-white transition-colors">Opiniones de Clientas</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors">Preguntas Frecuentes</a></li>
            </ul>
          </div>

          {/* Services list */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="font-serif text-base font-medium text-white">Servicios Principales</h4>
            <ul className="space-y-2 text-xs text-[#A6978E]">
              <li><a href="#turnos" className="hover:text-[#E8C5CE] transition-colors">Soft Gel System (Popular)</a></li>
              <li><a href="#turnos" className="hover:text-[#E8C5CE] transition-colors">Esmaltado Semipermanente</a></li>
              <li><a href="#turnos" className="hover:text-[#E8C5CE] transition-colors">Kapping Fortalecedor</a></li>
              <li><a href="#turnos" className="hover:text-[#E8C5CE] transition-colors">Nail Art & Diseños Exclusivos</a></li>
              <li><a href="#turnos" className="hover:text-[#E8C5CE] transition-colors">Manicura Rusa Combinada</a></li>
            </ul>
          </div>

          {/* Studio Hours & Location */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="font-serif text-base font-medium text-white">Estudio & Contacto</h4>
            <ul className="space-y-2.5 text-xs text-[#A6978E]">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>Gorriti 5540, Palermo Hollywood, CABA, Argentina</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <a href="tel:01115682386" className="hover:text-white">011-15682386</a>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <p>Lun a Vie: 09:00 a 19:00 hs</p>
                  <p>Sábados: 09:00 a 17:00 hs</p>
                  <p className="text-[11px] text-[#8C7A70]">Domingos: Con turno previo</p>
                </div>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom micro row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8C7A70]">
          <p>© {new Date().getFullYear()} Gwen Nails Studio. Todos los derechos reservados. · Sofía L. Esculpidora Profesional</p>
          <div className="flex items-center gap-4">
            <button
              onClick={onOpenAdmin}
              className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors text-[11px]"
            >
              <Lock className="w-3 h-3 text-[#D4AF37]" />
              Acceso Estudio (Panel Admin)
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
