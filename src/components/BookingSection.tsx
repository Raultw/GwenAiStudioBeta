import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Check, 
  Sparkles, 
  AlertCircle, 
  Send, 
  User, 
  Phone, 
  Mail,
  FileText, 
  ChevronLeft, 
  ChevronRight,
  Download,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Tag,
  Gift,
  Percent,
  X,
  BadgePercent
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { 
  Service, 
  DayAvailability, 
  Appointment, 
  TimeSlot, 
  Professional, 
  ClientBenefit, 
  ValidateDiscountResult 
} from '../types.js';
import { 
  getBusinessDate, 
  isoDateToAR, 
  formatDateWithWeekdayAR 
} from '../utils/dateUtils.js';

interface BookingSectionProps {
  services: Service[];
  preselectedServiceId: string | null;
  onClearPreselection: () => void;
}

export const BookingSection: React.FC<BookingSectionProps> = ({
  services,
  preselectedServiceId,
  onClearPreselection,
}) => {
  // Form State
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('cualquiera');
  const [professionalsForService, setProfessionalsForService] = useState<Professional[]>([]);
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState<boolean>(false);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [nombre, setNombre] = useState<string>('');
  const [apellido, setApellido] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  // -------------------------------------------------------------------------
  // Descuentos, Cupones y Beneficios de Clienta
  // -------------------------------------------------------------------------
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [isValidatingPromo, setIsValidatingPromo] = useState<boolean>(false);
  const [validatedPromo, setValidatedPromo] = useState<ValidateDiscountResult | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Beneficios individuales disponibles para la clienta identificada
  const [availableBenefits, setAvailableBenefits] = useState<ClientBenefit[]>([]);
  const [selectedBenefitId, setSelectedBenefitId] = useState<string | null>(null);
  const [isLoadingBenefits, setIsLoadingBenefits] = useState<boolean>(false);

  // Anonymous Device Identifier for backend client association
  const getBrowserId = () => {
    try {
      let bId = localStorage.getItem('gwen_client_dev_id');
      if (!bId) {
        bId = 'dev-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        localStorage.setItem('gwen_client_dev_id', bId);
      }
      return bId;
    } catch {
      return undefined;
    }
  };

  // Refs for smooth focus/scroll
  const confirmationRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const promoInputRef = useRef<HTMLInputElement | null>(null);

  // Calendar view state
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  // Availability State
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState<boolean>(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    turno: Appointment;
    whatsappUrl: string;
  } | null>(null);

  // Automatically scroll to the confirmed booking card when reservation succeeds
  useEffect(() => {
    if (confirmedBooking) {
      setTimeout(() => {
        if (confirmationRef.current) {
          confirmationRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (sectionRef.current) {
          sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
    }
  }, [confirmedBooking]);

  // Field validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync preselected service from parent
  useEffect(() => {
    if (preselectedServiceId) {
      setSelectedServiceId(preselectedServiceId);
      onClearPreselection();
    } else if (!selectedServiceId && services.length > 0) {
      // Default to popular or first service
      const popular = services.find(s => s.esPopular) || services[0];
      setSelectedServiceId(popular.id);
    }
  }, [preselectedServiceId, services]);

  // Set default initial date to tomorrow or today
  useEffect(() => {
    if (!selectedDate) {
      const todayBusiness = getBusinessDate();
      const [y, m, d] = todayBusiness.split('-').map(Number);
      const tomorrow = new Date(y, m - 1, d + 1);
      // If tomorrow is Sunday, advance to Monday
      if (tomorrow.getDay() === 0) {
        tomorrow.setDate(tomorrow.getDate() + 1);
      }
      const dateStr = getBusinessDate(tomorrow);
      setSelectedDate(dateStr);
      const [ty, tm] = dateStr.split('-').map(Number);
      setCalendarMonth(new Date(ty, tm - 1, 1));
    }
  }, [selectedDate]);

  // Selected Service Object
  const selectedService = useMemo(() => {
    return services.find(s => s.id === selectedServiceId) || services[0];
  }, [services, selectedServiceId]);

  // Selected Professional Object
  const selectedProfessional = useMemo(() => {
    if (selectedProfessionalId === 'cualquiera') return null;
    return professionalsForService.find(p => p.id === selectedProfessionalId) || null;
  }, [selectedProfessionalId, professionalsForService]);

  // Fetch active professionals for selected service
  useEffect(() => {
    if (!selectedServiceId) return;
    let isMounted = true;
    setIsLoadingProfessionals(true);

    const fetchProfs = async () => {
      try {
        const res = await fetch(`/api/servicios/${selectedServiceId}/profesionales`);
        if (res.ok) {
          const profs: Professional[] = await res.json();
          if (isMounted) {
            const activeProfs = profs.filter(p => p.activo);
            setProfessionalsForService(activeProfs);
            setSelectedProfessionalId('cualquiera');
          }
        }
      } catch (err) {
        console.error('Error fetching professionals for service:', err);
      } finally {
        if (isMounted) setIsLoadingProfessionals(false);
      }
    };

    fetchProfs();

    return () => {
      isMounted = false;
    };
  }, [selectedServiceId]);

  // Fetch Availability when date, service, or professional changes
  useEffect(() => {
    if (!selectedDate || !selectedServiceId) return;

    let isMounted = true;
    setIsLoadingAvailability(true);
    setAvailabilityError(null);

    const fetchAvailability = async () => {
      try {
        const profParam = selectedProfessionalId && selectedProfessionalId !== 'cualquiera' ? `&profesional_id=${selectedProfessionalId}` : '';
        const res = await fetch(`/api/availability?date=${selectedDate}&service_id=${selectedServiceId}${profParam}`);
        if (!res.ok) {
          throw new Error('No se pudo verificar la disponibilidad para esta fecha.');
        }
        const data: DayAvailability = await res.json();
        if (isMounted) {
          setAvailability(data);
          // If previously selected time is no longer available in new slots, clear it
          if (selectedTime) {
            const slotStillAvailable = data.slots.some(
              s => s.hora === selectedTime && s.disponible
            );
            if (!slotStillAvailable) {
              setSelectedTime('');
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setAvailabilityError(err.message || 'Error al consultar disponibilidad.');
          setAvailability(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingAvailability(false);
        }
      }
    };

    fetchAvailability();

    return () => {
      isMounted = false;
    };
  }, [selectedDate, selectedServiceId, selectedProfessionalId]);

  // Calculate End Time
  const calculatedEndTime = useMemo(() => {
    if (!selectedTime || !selectedService) return '';
    const [h, m] = selectedTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + selectedService.duracionMinutos;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }, [selectedTime, selectedService]);

  // Calendar Helpers
  const daysInMonth = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    // adjust to Monday start: Monday=0, ..., Sunday=6
    const adjustedFirstDay = (firstDayIndex + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dayNumber: number; dateStr: string; isPast: boolean; isSunday: boolean } | null> = [];

    // Blank padding for days before the 1st
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(null);
    }

    const todayBusiness = getBusinessDate();

    for (let d = 1; d <= totalDays; d++) {
      const curDate = new Date(year, month, d);
      const isSunday = curDate.getDay() === 0;
      const yyyy = year;
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const isPast = dateStr < todayBusiness;
      days.push({
        dayNumber: d,
        dateStr,
        isPast,
        isSunday,
      });
    }

    return days;
  }, [calendarMonth]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const handlePrevMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // -------------------------------------------------------------------------
  // Consultar beneficios disponibles para la clienta identificada
  // -------------------------------------------------------------------------
  useEffect(() => {
    const cleanTel = telefono.trim();
    const cleanMail = email.trim();
    const bId = getBrowserId();

    if (!cleanTel && !cleanMail && !bId) {
      setAvailableBenefits([]);
      setSelectedBenefitId(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingBenefits(true);
      try {
        const queryParams = new URLSearchParams();
        if (cleanTel) queryParams.set('telefono', cleanTel);
        if (cleanMail) queryParams.set('email', cleanMail);
        if (selectedServiceId) queryParams.set('servicioId', selectedServiceId);
        if (selectedService?.precio) queryParams.set('precio', String(selectedService.precio));

        const res = await fetch(`/api/beneficios-cliente/disponibles?${queryParams.toString()}`);
        if (res.ok) {
          const data: ClientBenefit[] = await res.json();
          setAvailableBenefits(data);
          if (selectedBenefitId && !data.some(b => b.id === selectedBenefitId)) {
            setSelectedBenefitId(null);
          }
        }
      } catch (err) {
        console.error('Error al consultar beneficios de cliente:', err);
      } finally {
        setIsLoadingBenefits(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [telefono, email, selectedServiceId, selectedService]);

  // Aplicar código promocional público
  const handleApplyPromoCode = async () => {
    const cleanCode = promoCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setPromoError('Por favor ingresá un código promocional.');
      return;
    }

    setIsValidatingPromo(true);
    setPromoError(null);

    try {
      const res = await fetch('/api/promociones/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: cleanCode,
          servicioId: selectedServiceId,
          precio: selectedService ? selectedService.precio : 0,
          telefono: telefono.trim() || undefined,
          email: email.trim() || undefined,
          fecha: selectedDate || undefined
        })
      });

      const data: ValidateDiscountResult = await res.json();

      if (res.ok && data.valido) {
        setValidatedPromo(data);
        setPromoError(null);
        // Regla: No acumular beneficios individuales con promociones públicas
        setSelectedBenefitId(null);
      } else {
        setValidatedPromo(null);
        setPromoError(data.error || 'El código promocional no es válido para este turno.');
      }
    } catch (err) {
      setValidatedPromo(null);
      setPromoError('Error de comunicación con el servidor al validar el código.');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setValidatedPromo(null);
    setPromoCodeInput('');
    setPromoError(null);
  };

  const handleSelectBenefit = (benefitId: string | null) => {
    setSelectedBenefitId(benefitId);
    if (benefitId) {
      // Regla: No acumular con códigos promocionales
      setValidatedPromo(null);
      setPromoCodeInput('');
      setPromoError(null);
    }
  };

  // Re-validar código si el servicio cambia y ya había un código validado
  useEffect(() => {
    if (validatedPromo && selectedServiceId) {
      handleApplyPromoCode();
    }
  }, [selectedServiceId]);

  // -------------------------------------------------------------------------
  // Cálculo de Precios y Descuentos Activos (Mutuamente Excluyentes)
  // -------------------------------------------------------------------------
  const discountCalculation = useMemo(() => {
    const originalPrice = selectedService ? selectedService.precio : 0;
    if (originalPrice <= 0) {
      return {
        hasDiscount: false,
        tipo: null,
        descuentoId: undefined,
        codigo: undefined,
        nombre: '',
        originalPrice: 0,
        discountAmount: 0,
        finalPrice: 0,
        label: '',
        detail: ''
      };
    }

    if (validatedPromo && validatedPromo.valido) {
      const discountAmount = validatedPromo.montoDescontado || 0;
      const finalPrice = Math.max(0, originalPrice - discountAmount);
      return {
        hasDiscount: true,
        tipo: 'promocion' as const,
        descuentoId: validatedPromo.descuentoId,
        codigo: validatedPromo.codigo,
        nombre: validatedPromo.titulo || validatedPromo.codigo,
        originalPrice,
        discountAmount,
        finalPrice,
        label: `Cupón ${validatedPromo.codigo}`,
        detail: validatedPromo.titulo || (validatedPromo.tipoDescuento === 'porcentaje' ? `${validatedPromo.valorDescuento}% OFF` : `$${discountAmount.toLocaleString('es-AR')} OFF`)
      };
    }

    if (selectedBenefitId) {
      const benefit = availableBenefits.find(b => b.id === selectedBenefitId);
      if (benefit) {
        let discountAmount = 0;
        if (benefit.tipoDescuento === 'porcentaje') {
          discountAmount = Math.round(originalPrice * (benefit.valorDescuento / 100));
        } else {
          discountAmount = Math.min(originalPrice, benefit.valorDescuento);
        }
        const finalPrice = Math.max(0, originalPrice - discountAmount);
        return {
          hasDiscount: true,
          tipo: 'beneficio' as const,
          descuentoId: benefit.id,
          codigo: undefined,
          nombre: benefit.titulo,
          originalPrice,
          discountAmount,
          finalPrice,
          label: `Beneficio: ${benefit.titulo}`,
          detail: benefit.tipoDescuento === 'porcentaje' ? `${benefit.valorDescuento}% OFF` : `$${discountAmount.toLocaleString('es-AR')} OFF`
        };
      }
    }

    return {
      hasDiscount: false,
      tipo: null,
      descuentoId: undefined,
      codigo: undefined,
      nombre: '',
      originalPrice,
      discountAmount: 0,
      finalPrice: originalPrice,
      label: '',
      detail: ''
    };
  }, [selectedService, validatedPromo, selectedBenefitId, availableBenefits]);

  // Field validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedServiceId) newErrors.service = 'Seleccioná un servicio.';
    if (!selectedDate) newErrors.date = 'Seleccioná una fecha.';
    if (!selectedTime) newErrors.time = 'Seleccioná un horario disponible.';

    if (!nombre.trim() || nombre.trim().length < 2) {
      newErrors.nombre = 'Ingresá un nombre válido (mínimo 2 letras).';
    }
    if (!apellido.trim() || apellido.trim().length < 2) {
      newErrors.apellido = 'Ingresá un apellido válido.';
    }
    if (!telefono.trim() || !/^[\d\-\+\s]{7,20}$/.test(telefono.trim())) {
      newErrors.telefono = 'Ingresá un teléfono válido (ej: 011-1565852012).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Regla estricta: Si existe un código escrito pero no validado/válido, impedir confirmar la reserva
    if (promoCodeInput.trim() !== '' && !validatedPromo) {
      setPromoError('Tenés un código promocional escrito sin validar. Hacé clic en "Aplicar" para validarlo o borrá el texto para confirmar.');
      setSubmitError('Hay un código promocional escrito sin validar. Aplicá el cupón o borrá el texto para continuar.');
      if (promoInputRef.current) {
        promoInputRef.current.focus();
        promoInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!validate()) {
      const firstErr = document.querySelector('.form-error-marker');
      firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono.trim(),
        email: email.trim() ? email.trim() : undefined,
        servicio_id: selectedServiceId,
        profesional_id: selectedProfessionalId !== 'cualquiera' ? selectedProfessionalId : undefined,
        fecha: selectedDate,
        hora_inicio: selectedTime,
        observaciones: observaciones.trim(),
        browserId: getBrowserId()
      };

      // Incluir descuento aplicado de forma atómica y transaccional
      if (discountCalculation.hasDiscount) {
        payload.descuentoTipo = discountCalculation.tipo;
        payload.descuentoId = discountCalculation.descuentoId;
        if (discountCalculation.codigo) {
          payload.descuentoCodigo = discountCalculation.codigo;
        }
      }

      const res = await fetch('/api/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Time slot conflict
          setSubmitError('El horario seleccionado acaba de ser ocupado. Por favor elegí otro de los horarios disponibles.');
          // Re-fetch slots
          const profParam = selectedProfessionalId && selectedProfessionalId !== 'cualquiera' ? `&profesional_id=${selectedProfessionalId}` : '';
          const refreshRes = await fetch(`/api/availability?date=${selectedDate}&service_id=${selectedServiceId}${profParam}`);
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            setAvailability(refreshData);
          }
        } else {
          setSubmitError(data.error || 'Hubo un inconveniente al procesar tu turno. Verificá los datos ingresados.');
        }
        setIsSubmitting(false);
        return;
      }

      // Success! Fire celebratory confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8E4455', '#D4AF37', '#E8C5CE', '#241E1A']
      });

      setConfirmedBooking({
        turno: data.turno,
        whatsappUrl: data.whatsappUrl
      });

      // Clear Form state
      setSelectedTime('');
      setObservaciones('');
      setPromoCodeInput('');
      setValidatedPromo(null);
      setPromoError(null);
      setSelectedBenefitId(null);

    } catch (err: any) {
      setSubmitError('Error de comunicación con el servidor. Podés intentar nuevamente o comunicarte directamente por WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Split morning and afternoon slots
  const { morningSlots, afternoonSlots } = useMemo(() => {
    if (!availability || !availability.slots) return { morningSlots: [], afternoonSlots: [] };
    const morning: TimeSlot[] = [];
    const afternoon: TimeSlot[] = [];

    availability.slots.forEach(slot => {
      const hour = parseInt(slot.hora.split(':')[0], 10);
      if (hour < 13) {
        morning.push(slot);
      } else {
        afternoon.push(slot);
      }
    });

    return { morningSlots: morning, afternoonSlots: afternoon };
  }, [availability]);

  // Google Calendar Link generator
  const createGoogleCalendarLink = (apt: Appointment) => {
    const [year, month, day] = apt.fecha.split('-').map(Number);
    const [startH, startM] = apt.horaInicio.split(':').map(Number);
    const [endH, endM] = apt.horaFin.split(':').map(Number);

    const startDate = new Date(year, month - 1, day, startH, startM);
    const endDate = new Date(year, month - 1, day, endH, endM);

    const formatGDate = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');

    const title = encodeURIComponent(`Turno Gwen Nails: ${apt.servicioNombre}`);
    const details = encodeURIComponent(
      `Turno confirmado para ${apt.nombre} ${apt.apellido}\nCódigo: ${apt.codigo}\nServicio: ${apt.servicioNombre}\nEstudio: Gorriti 5540, Palermo Hollywood, CABA`
    );
    const location = encodeURIComponent('Gorriti 5540, Palermo, CABA, Argentina');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGDate(startDate)}/${formatGDate(endDate)}&details=${details}&location=${location}`;
  };

  return (
    <section id="turnos" ref={sectionRef} className="py-20 md:py-28 bg-[#FAF7F2] relative scroll-mt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase tracking-[0.25em] text-[#8E4455] font-semibold mb-3 block">
            Agenda Online en Tiempo Real
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#241E1A] font-medium tracking-tight mb-4">
            Reservá tu turno en 3 simples pasos
          </h2>
          <p className="text-base text-[#5A4B43] font-light leading-relaxed">
            Elegí tu servicio, seleccioná la fecha y el horario disponible que mejor te convenga y asegurá tu lugar al instante.
          </p>
        </div>

        {/* Confirmation Success Modal / View */}
        {confirmedBooking ? (
          <div ref={confirmationRef} className="max-w-2xl mx-auto bg-white rounded-3xl p-8 sm:p-12 border border-[#E8DCD5] shadow-xl text-center animate-in zoom-in-95 duration-300 scroll-mt-24">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-6 border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="text-xs uppercase tracking-widest text-[#8E4455] font-semibold block mb-1">
              ¡Turno Reservado con Éxito!
            </span>
            <h3 className="font-serif text-3xl sm:text-4xl font-medium text-[#241E1A] mb-4">
              Te esperamos en el estudio
            </h3>
            <p className="text-sm text-[#5A4B43] max-w-lg mx-auto mb-8 font-light">
              Hemos registrado tu reserva correctamente. Te esperamos en el estudio en la fecha y horario seleccionados.
            </p>

            {/* Ticket Card */}
            <div className="bg-[#FAF7F2] rounded-2xl p-6 border border-[#E8DCD5] text-left mb-8 space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-[#E8DCD5]">
                <span className="text-xs text-[#8C7A70] uppercase tracking-wider">Código de Reserva</span>
                <span className="font-mono font-bold text-[#8E4455] text-sm bg-white px-2.5 py-0.5 rounded-md border border-[#E8DCD5]">
                  {confirmedBooking.turno.codigo}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-[#8C7A70] block text-xs">Servicio:</span>
                  <span className="font-medium text-[#241E1A]">{confirmedBooking.turno.servicioNombre}</span>
                </div>
                {confirmedBooking.turno.profesionalNombre && (
                  <div>
                    <span className="text-[#8C7A70] block text-xs">Profesional:</span>
                    <span className="font-medium text-[#241E1A] flex items-center gap-1">
                      <span>👩‍🎨</span> {confirmedBooking.turno.profesionalNombre}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[#8C7A70] block text-xs">Fecha & Horario:</span>
                  <span className="font-medium text-[#241E1A]">
                    {isoDateToAR(confirmedBooking.turno.fecha)} · {confirmedBooking.turno.horaInicio} a {confirmedBooking.turno.horaFin} hs
                  </span>
                </div>
                <div>
                  <span className="text-[#8C7A70] block text-xs">Duración:</span>
                  <span className="font-medium text-[#241E1A]">{confirmedBooking.turno.duracionMinutos} minutos</span>
                </div>
                <div>
                  <span className="text-[#8C7A70] block text-xs">Monto a abonar en el estudio:</span>
                  {confirmedBooking.turno.descuentoMonto && confirmedBooking.turno.descuentoMonto > 0 ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#8C7A70] line-through">
                          ${(confirmedBooking.turno.precioOriginal || (confirmedBooking.turno.precio + confirmedBooking.turno.descuentoMonto)).toLocaleString('es-AR')}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          <span>-${confirmedBooking.turno.descuentoMonto.toLocaleString('es-AR')} OFF</span>
                        </span>
                      </div>
                      <div className="font-bold text-[#8E4455] text-lg">
                        ${confirmedBooking.turno.precio.toLocaleString('es-AR')} ARS
                      </div>
                      <div className="text-[10px] text-[#7A6B62]">
                        {confirmedBooking.turno.descuentoNombre || confirmedBooking.turno.descuentoCodigo ? `Aplicado: ${confirmedBooking.turno.descuentoNombre || confirmedBooking.turno.descuentoCodigo}` : 'Descuento aplicado'}
                      </div>
                    </div>
                  ) : (
                    <span className="font-semibold text-[#8E4455] text-base">
                      ${confirmedBooking.turno.precio.toLocaleString('es-AR')} ARS
                    </span>
                  )}
                </div>
              </div>

              {confirmedBooking.turno.observaciones && (
                <div className="pt-2 border-t border-[#E8DCD5] text-xs">
                  <span className="text-[#8C7A70] block">Observaciones:</span>
                  <span className="text-[#5A4B43] italic">{confirmedBooking.turno.observaciones}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <a
                href={createGoogleCalendarLink(confirmedBooking.turno)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white border border-[#D9C9BF] text-[#241E1A] text-sm font-medium hover:bg-[#FAF7F2] transition-all shadow-xs"
              >
                <CalendarPlus className="w-4 h-4 text-[#8E4455]" />
                <span>Agregar a Google Calendar</span>
              </a>
            </div>

            <button
              onClick={() => setConfirmedBooking(null)}
              className="text-xs text-[#8C7A70] hover:text-[#241E1A] underline cursor-pointer"
            >
              Hacer otra reserva
            </button>
          </div>
        ) : (
          /* Main Booking Form Grid */
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Col: Step 1 & 2 & 3 */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* STEP 1: Servicio */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DCD5] shadow-xs">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-[#8E4455] text-white flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#241E1A]">
                      Seleccioná tu Servicio
                    </h3>
                    <p className="text-xs text-[#7A6B62]">El tiempo de los turnos se ajustará según la duración del tratamiento.</p>
                  </div>
                </div>

                <div className="divide-y divide-[#F2EAE4] rounded-2xl border border-[#E8DCD5] bg-white overflow-hidden shadow-xs">
                  {services.filter(s => s.activo).map((service) => {
                    const isSelected = selectedServiceId === service.id;
                    return (
                      <button
                        type="button"
                        key={service.id}
                        onClick={() => setSelectedServiceId(service.id)}
                        className={`w-full text-left p-3.5 sm:py-3.5 sm:px-5 flex items-start sm:items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#FDF6F4]'
                            : 'hover:bg-[#FAF7F2]'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 transition-colors ${
                            isSelected
                              ? 'border-[#8E4455] bg-[#8E4455]'
                              : 'border-[#D9C9BF] bg-white'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className={`text-sm sm:text-base font-medium leading-snug sm:truncate ${
                              isSelected ? 'text-[#8E4455] font-semibold' : 'text-[#241E1A]'
                            }`}>
                              {service.nombre}
                            </div>
                            
                            {/* Información secundaria en móviles (2da línea) */}
                            <div className="flex sm:hidden items-center gap-3 mt-1 text-xs">
                              <span className="text-[#7A6B62] flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#8E4455]" />
                                {service.duracionMinutos} min
                              </span>
                              <span className="text-[#D9C9BF]">·</span>
                              <span className="font-semibold text-[#8E4455]">
                                ${service.precio.toLocaleString('es-AR')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Información en pantallas medianas y grandes (a la derecha) */}
                        <div className="hidden sm:flex items-center gap-6 shrink-0 text-sm">
                          <span className="text-[#7A6B62] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#8E4455]" />
                            {service.duracionMinutos} min
                          </span>
                          <span className="font-semibold text-[#8E4455] text-right min-w-[75px]">
                            ${service.precio.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.service && (
                  <p className="mt-3 text-xs text-rose-600 form-error-marker">{errors.service}</p>
                )}

                {/* Professional Selector */}
                <div className="mt-6 pt-6 border-t border-[#E8DCD5]">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#7A6B62] mb-3 flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-[#8E4455]" />
                    Profesional (Opcional - Elegí con quién atenderte)
                  </label>
                  {isLoadingProfessionals ? (
                    <div className="text-xs text-[#7A6B62] py-2 flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-[#8E4455] border-t-transparent rounded-full animate-spin" />
                      <span>Cargando profesionales disponibles...</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedProfessionalId('cualquiera')}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
                          selectedProfessionalId === 'cualquiera'
                            ? 'bg-[#8E4455] text-white shadow-xs font-semibold'
                            : 'bg-[#FAF7F2] text-[#241E1A] border border-[#D9C9BF] hover:bg-white'
                        }`}
                      >
                        <span>✨</span>
                        <span>Cualquier profesional disponible</span>
                      </button>

                      {professionalsForService.map(prof => {
                        const isSelected = selectedProfessionalId === prof.id;
                        return (
                          <button
                            type="button"
                            key={prof.id}
                            onClick={() => setSelectedProfessionalId(prof.id)}
                            className={`px-4 py-2.5 rounded-2xl text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
                              isSelected
                                ? 'bg-[#8E4455] text-white shadow-xs font-semibold'
                                : 'bg-[#FAF7F2] text-[#241E1A] border border-[#D9C9BF] hover:bg-white'
                            }`}
                          >
                            <div 
                              className="w-3 h-3 rounded-full shrink-0" 
                              style={{ backgroundColor: prof.colorAgenda || '#8E4455' }} 
                            />
                            <span>{prof.nombre} {prof.apellido}</span>
                            {prof.titulo && <span className="opacity-75 text-[10px]">({prof.titulo})</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 2: Calendario & Horarios */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DCD5] shadow-xs">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-[#8E4455] text-white flex items-center justify-center text-xs font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#241E1A]">
                      Elegí Fecha y Horario
                    </h3>
                    <p className="text-xs text-[#7A6B62]">Disponibilidad en tiempo real calculada automáticamente.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                  
                  {/* Custom Calendar Column */}
                  <div className="md:col-span-6 bg-[#FAF7F2] p-5 rounded-2xl border border-[#E8DCD5]">
                    
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-serif text-lg font-medium text-[#241E1A] capitalize">
                        {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                      </h4>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="p-1.5 rounded-lg hover:bg-white border border-[#D9C9BF] text-[#4A3E39] transition-colors cursor-pointer"
                          aria-label="Mes anterior"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1.5 rounded-lg hover:bg-white border border-[#D9C9BF] text-[#4A3E39] transition-colors cursor-pointer"
                          aria-label="Mes siguiente"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Day Headers (Lu - Do) */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#8C7A70] uppercase mb-2">
                      <span>Lu</span>
                      <span>Ma</span>
                      <span>Mi</span>
                      <span>Ju</span>
                      <span>Vi</span>
                      <span>Sá</span>
                      <span className="text-rose-400">Do</span>
                    </div>

                    {/* Calendar Days Matrix */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {daysInMonth.map((dayObj, index) => {
                        if (!dayObj) {
                          return <div key={`blank-${index}`} className="h-9" />;
                        }

                        const isSelected = selectedDate === dayObj.dateStr;
                        const isDisabled = dayObj.isPast || dayObj.isSunday;

                        return (
                          <button
                            key={dayObj.dateStr}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              setSelectedDate(dayObj.dateStr);
                              setSelectedTime('');
                            }}
                            className={`h-9 rounded-xl text-xs font-medium transition-all flex items-center justify-center cursor-pointer ${
                              isSelected
                                ? 'bg-[#8E4455] text-white shadow-xs font-bold scale-105'
                                : isDisabled
                                ? 'text-[#C4B0A3] cursor-not-allowed opacity-40'
                                : 'text-[#241E1A] hover:bg-white hover:border border-[#D9C9BF] bg-white/60'
                            }`}
                          >
                            {dayObj.dayNumber}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E8DCD5] flex items-center justify-between text-[11px] text-[#7A6B62]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#8E4455]"></span> Seleccionado
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#C4B0A3]"></span> No disponible / Domingo
                      </span>
                    </div>
                  </div>

                  {/* Time Slots Column */}
                  <div className="md:col-span-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-[#4A3E39]">
                        Horarios Disponibles para {selectedDate ? isoDateToAR(selectedDate) : 'la fecha'}:
                      </span>
                      {availability && availability.abierto && (
                        <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                          {availability.slotsDisponiblesCount} libres
                        </span>
                      )}
                    </div>

                    {isLoadingAvailability ? (
                      <div className="p-8 text-center bg-[#FAF7F2] rounded-2xl border border-[#E8DCD5]">
                        <div className="w-6 h-6 border-2 border-[#8E4455] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs text-[#7A6B62]">Calculando disponibilidad...</p>
                      </div>
                    ) : availabilityError ? (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{availabilityError}</span>
                      </div>
                    ) : availability && !availability.abierto ? (
                      <div className="p-6 bg-[#FAF7F2] border border-[#E8DCD5] rounded-2xl text-center text-xs text-[#7A6B62]">
                        <p className="font-medium text-[#241E1A] mb-1">Día no disponible para reservas</p>
                        <p>{availability.motivo || 'El estudio se encuentra cerrado.'}</p>
                      </div>
                    ) : availability && availability.slots.length === 0 ? (
                      <div className="p-6 bg-[#FAF7F2] border border-[#E8DCD5] rounded-2xl text-center text-xs text-[#7A6B62]">
                        <p>No se encontraron turnos configurados para este día.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                        
                        {/* Morning */}
                        {morningSlots.length > 0 && (
                          <div>
                            <span className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-2">
                              Turnos Mañana
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                              {morningSlots.map((slot) => {
                                const isSelected = selectedTime === slot.hora;
                                return (
                                  <button
                                    key={slot.hora}
                                    type="button"
                                    disabled={!slot.disponible}
                                    onClick={() => setSelectedTime(slot.hora)}
                                    title={slot.motivo}
                                    className={`py-2 px-1 rounded-xl text-xs font-medium transition-all text-center cursor-pointer ${
                                      isSelected
                                        ? 'bg-[#8E4455] text-white shadow-xs font-semibold ring-2 ring-[#8E4455]/30'
                                        : slot.disponible
                                        ? 'bg-[#FAF7F2] text-[#241E1A] border border-[#E8DCD5] hover:border-[#8E4455] hover:bg-white'
                                        : 'bg-[#F5F2ED] text-[#A6978E] border border-transparent line-through cursor-not-allowed opacity-50'
                                    }`}
                                  >
                                    {slot.hora} hs
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Afternoon */}
                        {afternoonSlots.length > 0 && (
                          <div>
                            <span className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-2">
                              Turnos Tarde
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                              {afternoonSlots.map((slot) => {
                                const isSelected = selectedTime === slot.hora;
                                return (
                                  <button
                                    key={slot.hora}
                                    type="button"
                                    disabled={!slot.disponible}
                                    onClick={() => setSelectedTime(slot.hora)}
                                    title={slot.motivo}
                                    className={`py-2 px-1 rounded-xl text-xs font-medium transition-all text-center cursor-pointer ${
                                      isSelected
                                        ? 'bg-[#8E4455] text-white shadow-xs font-semibold ring-2 ring-[#8E4455]/30'
                                        : slot.disponible
                                        ? 'bg-[#FAF7F2] text-[#241E1A] border border-[#E8DCD5] hover:border-[#8E4455] hover:bg-white'
                                        : 'bg-[#F5F2ED] text-[#A6978E] border border-transparent line-through cursor-not-allowed opacity-50'
                                    }`}
                                  >
                                    {slot.hora} hs
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                      </div>
                    )}

                    {errors.time && (
                      <p className="mt-3 text-xs text-rose-600 form-error-marker">{errors.time}</p>
                    )}
                  </div>

                </div>
              </div>

              {/* STEP 3: Datos del Cliente */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DCD5] shadow-xs">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-[#8E4455] text-white flex items-center justify-center text-xs font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#241E1A]">
                      Tus Datos de Contacto
                    </h3>
                    <p className="text-xs text-[#7A6B62]">Completá tus datos de contacto para registrar la reserva.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-[#4A3E39] mb-1.5">
                      Nombre *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#8C7A70] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Ej: Camila"
                        className={`w-full pl-10 pr-4 py-3 rounded-xl bg-[#FAF7F2] border text-sm text-[#241E1A] placeholder-[#A6978E] focus:outline-none focus:bg-white transition-all ${
                          errors.nombre ? 'border-rose-400 bg-rose-50/30' : 'border-[#D9C9BF] focus:border-[#8E4455]'
                        }`}
                      />
                    </div>
                    {errors.nombre && <p className="mt-1 text-xs text-rose-600">{errors.nombre}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4A3E39] mb-1.5">
                      Apellido *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#8C7A70] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={apellido}
                        onChange={(e) => setApellido(e.target.value)}
                        placeholder="Ej: Valenzuela"
                        className={`w-full pl-10 pr-4 py-3 rounded-xl bg-[#FAF7F2] border text-sm text-[#241E1A] placeholder-[#A6978E] focus:outline-none focus:bg-white transition-all ${
                          errors.apellido ? 'border-rose-400 bg-rose-50/30' : 'border-[#D9C9BF] focus:border-[#8E4455]'
                        }`}
                      />
                    </div>
                    {errors.apellido && <p className="mt-1 text-xs text-rose-600">{errors.apellido}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-[#4A3E39] mb-1.5">
                      Teléfono / WhatsApp *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#8C7A70] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        placeholder="Ej: 11-4521-8899 ó +54 9 11..."
                        className={`w-full pl-10 pr-4 py-3 rounded-xl bg-[#FAF7F2] border text-sm text-[#241E1A] placeholder-[#A6978E] focus:outline-none focus:bg-white transition-all ${
                          errors.telefono ? 'border-rose-400 bg-rose-50/30' : 'border-[#D9C9BF] focus:border-[#8E4455]'
                        }`}
                      />
                    </div>
                    {errors.telefono && <p className="mt-1 text-xs text-rose-600">{errors.telefono}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4A3E39] mb-1.5">
                      Email <span className="text-[#8C7A70] font-normal">(Opcional)</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#8C7A70] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-sm text-[#241E1A] placeholder-[#A6978E] focus:outline-none focus:border-[#8E4455] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-medium text-[#4A3E39]">
                      Detalles del diseño o trabajo deseado (Opcional)
                    </label>
                    <span className="text-[11px] text-[#8C7A70]">
                      {observaciones.length}/150
                    </span>
                  </div>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-[#8C7A70] absolute left-3.5 top-3.5" />
                    <textarea
                      rows={2}
                      maxLength={150}
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Ej: Soft gel largo medio almendrado, diseño vanilla chrome o retiro previo..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-sm text-[#241E1A] placeholder-[#A6978E] focus:outline-none focus:border-[#8E4455] focus:bg-white transition-all resize-none"
                    />
                  </div>
                </div>

                {/* ----------------------------------------------------------- */}
                {/* Beneficios Individuales & Promociones                       */}
                {/* ----------------------------------------------------------- */}
                <div className="pt-6 border-t border-[#E8DCD5] space-y-4">
                  
                  {/* Beneficios Personales de la Clienta (Si existen) */}
                  {availableBenefits.length > 0 && (
                    <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-2 text-amber-900 font-medium text-xs sm:text-sm">
                        <Gift className="w-4 h-4 text-amber-700" />
                        <span>¡Tenés beneficios especiales asignados por el salón!</span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-amber-800/80 mb-3">
                        Podés elegir utilizar uno para esta reserva o guardarlo para tu próximo turno.
                      </p>

                      <div className="space-y-2">
                        {availableBenefits.map((benefit) => {
                          const isSelected = selectedBenefitId === benefit.id;
                          return (
                            <div
                              key={benefit.id}
                              onClick={() => handleSelectBenefit(isSelected ? null : benefit.id)}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-amber-100/90 border-amber-500 shadow-xs'
                                  : 'bg-white/80 border-amber-200 hover:bg-white'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-400 bg-white'
                                }`}>
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-[#241E1A] flex items-center gap-2">
                                    <span>{benefit.titulo}</span>
                                    <span className="text-[10px] bg-amber-200/70 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                                      {benefit.tipoDescuento === 'porcentaje' ? `${benefit.valorDescuento}% OFF` : `-$${benefit.valorDescuento.toLocaleString('es-AR')}`}
                                    </span>
                                  </div>
                                  {benefit.descripcion && (
                                    <p className="text-[11px] text-[#5A4B43] mt-0.5">{benefit.descripcion}</p>
                                  )}
                                  {benefit.fechaVencimiento && (
                                    <p className="text-[10px] text-[#8C7A70] mt-0.5">
                                      Válido hasta: {isoDateToAR(benefit.fechaVencimiento)}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectBenefit(isSelected ? null : benefit.id);
                                }}
                                className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                                  isSelected
                                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                                    : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
                                }`}
                              >
                                {isSelected ? 'Seleccionado' : 'Usar Beneficio'}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {selectedBenefitId && (
                        <div className="mt-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleSelectBenefit(null)}
                            className="text-[11px] text-amber-900/80 hover:text-amber-950 underline"
                          >
                            Continuar sin usar este beneficio
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cupón / Código Promocional */}
                  <div>
                    <label className="block text-xs font-medium text-[#4A3E39] mb-1.5">
                      ¿Tenés un código de descuento?
                    </label>

                    {validatedPromo ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-emerald-900">
                          <BadgePercent className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-semibold">{validatedPromo.codigo}</span>
                            <span className="text-emerald-700 ml-1.5">
                              ({validatedPromo.titulo || (validatedPromo.tipoDescuento === 'porcentaje' ? `${validatedPromo.valorDescuento}% OFF` : `-$${validatedPromo.montoDescontado?.toLocaleString('es-AR')}`)})
                            </span>
                            <span className="block text-[11px] text-emerald-800 font-medium">
                              ¡Descuento de ${validatedPromo.montoDescontado?.toLocaleString('es-AR')} aplicado!
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemovePromo}
                          className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          title="Quitar código"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Tag className="w-4 h-4 text-[#8C7A70] absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              ref={promoInputRef}
                              type="text"
                              value={promoCodeInput}
                              onChange={(e) => {
                                setPromoCodeInput(e.target.value.toUpperCase());
                                if (promoError) setPromoError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleApplyPromoCode();
                                }
                              }}
                              placeholder="Ej: BIENVENIDA15"
                              disabled={selectedBenefitId !== null}
                              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF7F2] border text-xs font-mono uppercase text-[#241E1A] placeholder-[#A6978E] focus:outline-none focus:bg-white transition-all ${
                                promoError ? 'border-rose-400 bg-rose-50/20' : 'border-[#D9C9BF] focus:border-[#8E4455]'
                              } ${selectedBenefitId !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleApplyPromoCode}
                            disabled={isValidatingPromo || !promoCodeInput.trim() || selectedBenefitId !== null}
                            className="px-4 py-2.5 bg-[#8E4455] text-white text-xs font-medium rounded-xl hover:bg-[#783645] disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            {isValidatingPromo ? (
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span>Aplicar</span>
                            )}
                          </button>
                        </div>

                        {promoError && (
                          <div className="mt-2 text-xs text-rose-600 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{promoError}</span>
                          </div>
                        )}

                        {selectedBenefitId !== null && (
                          <p className="mt-1 text-[11px] text-[#8C7A70] italic">
                            * Ya tenés un beneficio de clienta seleccionado. Los descuentos no son acumulables.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                </div>

              </div>

            </div>

            {/* Right Col: Live Summary Ticket Card */}
            <div className="lg:col-span-4 sticky top-24 space-y-6">
              
              <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-[#8E4455]/30 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8C5CE]/30 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs uppercase tracking-widest text-[#8E4455] font-semibold">
                    Resumen de tu Turno
                  </span>
                </div>

                <div className="space-y-4 pb-5 border-b border-[#E8DCD5]">
                  <div>
                    <span className="text-xs text-[#8C7A70] block">Servicio Seleccionado</span>
                    <h4 className="font-serif text-xl font-medium text-[#241E1A]">
                      {selectedService?.nombre || 'Seleccioná un servicio'}
                    </h4>
                    {selectedProfessional ? (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-[#8E4455] font-medium">
                        <span>👩‍🎨 Profesional:</span>
                        <span>{selectedProfessional.nombre} {selectedProfessional.apellido}</span>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-[#7A6B62]">
                        <span>👩‍🎨 Profesional:</span> <span className="italic">Cualquiera disponible</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5]">
                      <span className="text-[#8C7A70] block">Fecha</span>
                      <span className="font-medium text-[#241E1A] block truncate">
                        {selectedDate ? isoDateToAR(selectedDate) : 'No seleccionada'}
                      </span>
                    </div>

                    <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E8DCD5]">
                      <span className="text-[#8C7A70] block">Horario</span>
                      <span className="font-medium text-[#241E1A] block">
                        {selectedTime ? `${selectedTime} hs` : 'A elegir'}
                      </span>
                    </div>
                  </div>

                  {selectedTime && calculatedEndTime && (
                    <div className="flex items-center justify-between text-xs text-[#5A4B43] bg-[#FAF7F2] px-3.5 py-2 rounded-lg border border-[#E8DCD5]">
                      <span>Duración estimada:</span>
                      <span className="font-medium text-[#241E1A]">
                        {selectedTime} a {calculatedEndTime} hs ({selectedService?.duracionMinutos} min)
                      </span>
                    </div>
                  )}
                </div>

                {/* Price & Discount breakdown */}
                <div className="py-4 border-b border-[#E8DCD5] space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#7A6B62]">
                    <span>Precio del servicio:</span>
                    <span className={discountCalculation.hasDiscount ? 'line-through text-[#8C7A70]' : 'font-medium text-[#241E1A]'}>
                      ${discountCalculation.originalPrice.toLocaleString('es-AR')}
                    </span>
                  </div>

                  {discountCalculation.hasDiscount && (
                    <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-emerald-600" />
                        <span className="font-medium truncate max-w-[170px]">{discountCalculation.label}</span>
                      </div>
                      <span className="font-bold">-${discountCalculation.discountAmount.toLocaleString('es-AR')}</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[#4A3E39] block">Total a abonar:</span>
                      <span className="text-[10px] text-[#8C7A70]">En el salón al finalizar</span>
                    </div>
                    <div className="text-right">
                      <span className="font-serif text-3xl font-bold text-[#8E4455]">
                        ${discountCalculation.finalPrice.toLocaleString('es-AR')}
                      </span>
                      <span className="text-[10px] text-[#8C7A70] block">ARS</span>
                    </div>
                  </div>
                </div>

                {/* Submit Error */}
                {submitError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-full bg-[#8E4455] text-white text-sm font-medium tracking-wide shadow-md hover:bg-[#783645] hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Confirmando reserva...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Reservar Mi Turno</span>
                    </>
                  )}
                </button>

                <p className="mt-4 text-[11px] text-[#7A6B62] text-center">
                  🔒 Sin cobro previo. Podés abonar al finalizar con efectivo, transferencia o débito.
                </p>

              </div>

              {/* Assistance Box */}
              <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-[#E8DCD5] text-xs text-[#5A4B43] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#25D366]/20 text-[#128C7E] flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-[#241E1A]">¿Dudas con tu diseño o fecha?</p>
                  <a
                    href="https://wa.me/5491115682386"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#8E4455] hover:underline font-medium"
                  >
                    Consultanos por WhatsApp directo →
                  </a>
                </div>
              </div>

            </div>

          </form>
        )}

      </div>
    </section>
  );
};
