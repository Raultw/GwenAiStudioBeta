import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { Hero } from './components/Hero.js';
import { Experience } from './components/Experience.js';
import { ServicesSection } from './components/ServicesSection.js';
import { GallerySection } from './components/GallerySection.js';
import { TestimonialsSection } from './components/TestimonialsSection.js';
import { FaqSection } from './components/FaqSection.js';
import { BookingSection } from './components/BookingSection.js';
import { AdminModal } from './components/AdminModal.js';
import { WhatsAppFab } from './components/WhatsAppFab.js';
import { Footer } from './components/Footer.js';
import type { Service } from './types.js';

export default function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [preselectedServiceId, setPreselectedServiceId] = useState<string | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(true);

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/servicios');
      if (res.ok) {
        const data: Service[] = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error('Error loading services:', err);
    } finally {
      setIsLoadingServices(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleSelectServiceForBooking = (serviceId: string) => {
    setPreselectedServiceId(serviceId);
    const bookingElement = document.querySelector('#turnos');
    if (bookingElement) {
      bookingElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleBookNow = () => {
    const bookingElement = document.querySelector('#turnos');
    if (bookingElement) {
      bookingElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleExploreServices = () => {
    const servicesElement = document.querySelector('#servicios');
    if (servicesElement) {
      servicesElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#241E1A]">
      {/* Top Navbar */}
      <Navbar
        onOpenAdmin={() => setIsAdminOpen(true)}
        onSelectBooking={handleBookNow}
      />

      {/* Main Content Sections */}
      <main className="flex-grow">
        {/* 1. Hero */}
        <Hero
          onBookNow={handleBookNow}
          onExploreServices={handleExploreServices}
        />

        {/* 2. Studio Experience & Philosophy */}
        <Experience />

        {/* 3. Services Catalog */}
        <ServicesSection
          services={services}
          onSelectServiceForBooking={handleSelectServiceForBooking}
        />

        {/* 4. Gallery & Style Inspiration */}
        <GallerySection />

        {/* 5. Smart Booking System */}
        <BookingSection
          services={services}
          preselectedServiceId={preselectedServiceId}
          onClearPreselection={() => setPreselectedServiceId(null)}
        />

        {/* 6. Testimonials */}
        <TestimonialsSection />

        {/* 7. FAQ */}
        <FaqSection />
      </main>

      {/* Footer */}
      <Footer onOpenAdmin={() => setIsAdminOpen(true)} />

      {/* Floating WhatsApp Action */}
      <WhatsAppFab />

      {/* Studio Admin Management Portal Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onRefreshPublicData={fetchServices}
      />
    </div>
  );
}
