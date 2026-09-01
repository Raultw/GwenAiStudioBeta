import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, Lock, Menu, X, Clock, MapPin, Phone } from 'lucide-react';

interface NavbarProps {
  onOpenAdmin: () => void;
  onSelectBooking: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAdmin, onSelectBooking }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Experiencia', href: '#experiencia' },
    { label: 'Servicios', href: '#servicios' },
    { label: 'Galería', href: '#galeria' },
    { label: 'Testimonios', href: '#testimonios' },
    { label: 'Preguntas', href: '#faq' },
  ];

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Top micro-bar */}
      <div className="bg-[#241E1A] text-[#E8DCC4] text-xs py-1.5 px-4 hidden md:flex justify-between items-center tracking-wide">
        <div className="flex items-center gap-6 max-w-7xl mx-auto w-full">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
            Gorriti 5540, Palermo Hollywood, CABA
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
            Lun a Vie: 09:00 - 19:00 · Sáb: 09:00 - 17:00
          </span>
          <div className="ml-auto flex items-center gap-4">
            <a
              href="tel:01115682386"
              className="flex items-center gap-1 font-sans text-[#E8DCC4] hover:text-[#E8C5CE] transition-colors"
            >
              <Phone className="w-3 h-3 text-[#D4AF37]" />
              011-15682386
            </a>
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#8E4455]/80 hover:bg-[#8E4455] text-white transition-colors text-[11px] font-medium cursor-pointer border border-[#E8C5CE]/30"
              title="Panel de Administración (Gestión y Control de Turnos)"
            >
              <Lock className="w-3 h-3 text-[#D4AF37]" />
              <span>Panel Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#FAF7F2]/95 backdrop-blur-md shadow-xs border-b border-[#E8DCD5]/80 py-3'
            : 'bg-[#FAF7F2] py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo */}
          <a
            href="#"
            className="flex items-center gap-2 group cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <div className="flex flex-col leading-none">
              <span className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#241E1A] group-hover:text-[#8E4455] transition-colors">
                Gwen <span className="font-sans text-xs uppercase tracking-[0.25em] font-light text-[#8E4455] ml-1">Nails</span>
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#8C7A70] -mt-0.5">
                Boutique Studio
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.href)}
                className="text-sm font-medium text-[#4A3E39] hover:text-[#8E4455] tracking-wide transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onSelectBooking();
                const target = document.querySelector('#turnos');
                target?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#8E4455] text-white text-xs sm:text-sm font-medium tracking-wide shadow-sm hover:bg-[#783645] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Reservar Turno</span>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-[#4A3E39] hover:text-[#8E4455] transition-colors rounded-lg focus:outline-none"
              aria-label="Abrir menú de navegación"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#FAF7F2] border-b border-[#E8DCD5] px-6 py-5 shadow-lg animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item.href)}
                  className="text-left text-base font-medium text-[#241E1A] hover:text-[#8E4455] py-1 transition-colors"
                >
                  {item.label}
                </button>
              ))}
              <div className="pt-3 border-t border-[#E8DCD5] flex flex-col gap-3">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAdmin();
                  }}
                  className="flex items-center justify-between text-xs text-[#241E1A] bg-white border border-[#D9C9BF] p-3 rounded-xl shadow-xs w-full cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Lock className="w-4 h-4 text-[#8E4455]" />
                    Panel Admin (Gestión)
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
