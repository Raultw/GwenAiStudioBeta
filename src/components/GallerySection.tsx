import React, { useState } from 'react';
import { Sparkles, Eye, X, Instagram } from 'lucide-react';

interface GalleryItem {
  id: string;
  image: string;
  fallbackImage: string;
  title: string;
  category: 'clasicas' | 'elegantes' | 'nailart' | 'tendencia';
  tag: string;
  isTall?: boolean;
}

export const GallerySection: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeModalItem, setActiveModalItem] = useState<GalleryItem | null>(null);

  const galleryItems: GalleryItem[] = [
    {
      id: '1',
      image: '/gallery-1.jpg',
      fallbackImage: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80',
      title: 'Soft Gel Nude & Foil Dorado',
      category: 'elegantes',
      tag: 'Soft Gel · Oro Cálido',
      isTall: false
    },
    {
      id: '2',
      image: '/gallery-2.jpg',
      fallbackImage: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80',
      title: 'Vanilla Chrome Glazed Nails',
      category: 'tendencia',
      tag: 'Vanilla Chrome · Nácar',
      isTall: true
    },
    {
      id: '3',
      image: '/gallery-3.jpg',
      fallbackImage: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=800&q=80',
      title: 'Nail Art Floral a Mano Alzada',
      category: 'nailart',
      tag: 'Nail Art · Mini Rosas',
      isTall: true
    },
    {
      id: '4',
      image: '/gallery-4.jpg',
      fallbackImage: 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=800&q=80',
      title: 'Aura Nails en Lila y Microbrillo',
      category: 'tendencia',
      tag: 'Aura Nails · Degradé',
      isTall: false
    },
    {
      id: '5',
      image: '/gallery-5.jpg',
      fallbackImage: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80',
      title: 'French Moderno Micro-Línea',
      category: 'clasicas',
      tag: 'French · Minimalista',
      isTall: false
    },
    {
      id: '6',
      image: '/gallery-6.jpg',
      fallbackImage: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80',
      title: 'Milky White con Kapping Gel',
      category: 'clasicas',
      tag: 'Kapping · Milky White',
      isTall: false
    }
  ];

  const filterTabs = [
    { id: 'all', label: 'Todos' },
    { id: 'clasicas', label: 'Clásicas' },
    { id: 'elegantes', label: 'Elegantes' },
    { id: 'nailart', label: 'Nail Art' },
    { id: 'tendencia', label: 'Tendencias' },
  ];

  const filteredItems = activeFilter === 'all'
    ? galleryItems
    : galleryItems.filter(item => item.category === activeFilter);

  return (
    <section id="galeria" className="py-20 md:py-28 bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] text-[#8E4455] font-semibold mb-3 block">
              Inspiración & Diseños
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#241E1A] font-medium tracking-tight">
              Tu próxima manicura empieza acá
            </h2>
          </div>
          <a
            href="https://instagram.com/gwennails"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-medium text-[#8E4455] hover:text-[#783645] tracking-wide"
          >
            <Instagram className="w-4 h-4" />
            <span>Ver más trabajos en @gwennails →</span>
          </a>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-10">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-5 py-2 rounded-full text-xs font-medium tracking-wide transition-all cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-[#241E1A] text-white shadow-xs'
                  : 'bg-white text-[#5A4B43] border border-[#D9C9BF] hover:bg-[#FAF7F2]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveModalItem(item)}
              className="group relative rounded-3xl overflow-hidden shadow-xs border border-[#E8DCD5] aspect-[4/5] bg-[#E8DCD5] cursor-pointer"
            >
              <img
                src={item.image}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = item.fallbackImage;
                }}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#241E1A]/80 via-[#241E1A]/20 to-transparent opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                <span className="text-xs uppercase tracking-widest text-[#E8C5CE] font-medium mb-1">
                  {item.tag}
                </span>
                <h3 className="font-serif text-xl text-white font-medium mb-3">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2 text-white/80 text-xs">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Click para ampliar diseño</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Lightbox Modal */}
      {activeModalItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveModalItem(null)}
        >
          <div
            className="relative bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveModalItem(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="aspect-[4/4] bg-[#241E1A] relative">
              <img
                src={activeModalItem.image}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = activeModalItem.fallbackImage;
                }}
                alt={activeModalItem.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6 bg-white flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#8E4455] font-semibold">
                  {activeModalItem.tag}
                </span>
                <h3 className="font-serif text-2xl font-medium text-[#241E1A]">
                  {activeModalItem.title}
                </h3>
              </div>
              <a
                href="#turnos"
                onClick={() => setActiveModalItem(null)}
                className="px-5 py-2.5 rounded-full bg-[#8E4455] text-white text-xs font-medium hover:bg-[#783645] transition-colors"
              >
                Pedir este estilo
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
