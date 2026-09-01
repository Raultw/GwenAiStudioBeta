import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  User,
  Plus,
  Trash2,
  Edit3,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mail,
  Phone,
  Shield,
  Sparkles,
  RefreshCw,
  X,
  Lock,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import type { 
  Professional, 
  Service, 
  User as UserType, 
  UserRole,
  Appointment 
} from '../types.js';

interface ProfessionalManagementAdminProps {
  services?: Service[];
  appointments?: Appointment[];
  onRefreshData?: () => void;
  onNavigateToSchedule?: (profesionalId: string) => void;
}

const COLOR_PRESETS = [
  { hex: '#8E4455', label: 'Borgogna Gwen' },
  { hex: '#D4AF37', label: 'Dorado Glam' },
  { hex: '#7D4F72', label: 'Lavanda Profundo' },
  { hex: '#2E5B88', label: 'Azul Noche' },
  { hex: '#3B7A57', label: 'Verde Botánico' },
  { hex: '#B3541E', label: 'Terracota Cálido' },
  { hex: '#5A4B43', label: 'Marrón Cuero' },
  { hex: '#8C7A70', label: 'Nude Muted' }
];

export const ProfessionalManagementAdmin: React.FC<ProfessionalManagementAdminProps> = ({
  services = [],
  appointments = [],
  onRefreshData,
  onNavigateToSchedule
}) => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit/Create Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProf, setEditingProf] = useState<Professional | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [formNombre, setFormNombre] = useState<string>('');
  const [formApellido, setFormApellido] = useState<string>('');
  const [formTitulo, setFormTitulo] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formTelefono, setFormTelefono] = useState<string>('');
  const [formFotoUrl, setFormFotoUrl] = useState<string>('');
  const [formColorAgenda, setFormColorAgenda] = useState<string>('#8E4455');
  const [formActivo, setFormActivo] = useState<boolean>(true);
  const [formServiciosIds, setFormServiciosIds] = useState<string[]>([]);

  // User association fields
  const [enableUserAuth, setEnableUserAuth] = useState<boolean>(false);
  const [formUserRole, setFormUserRole] = useState<UserRole>('empleado');
  const [formUserPassword, setFormUserPassword] = useState<string>('');

  // Deletion / Deactivation confirmation dialog
  const [profToAction, setProfToAction] = useState<{
    prof: Professional;
    action: 'delete' | 'deactivate';
    appointmentCount: number;
  } | null>(null);

  // Load Professionals & Users
  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [profRes, usersRes] = await Promise.all([
        fetch('/api/profesionales?all=true', { credentials: 'include' }),
        fetch('/api/users', { credentials: 'include' })
      ]);

      if (profRes.ok) {
        const profs: Professional[] = await profRes.json();
        setProfessionals(Array.isArray(profs) ? profs : []);
      }
      if (usersRes.ok) {
        const users: UserType[] = await usersRes.json();
        setUsersList(Array.isArray(users) ? users : []);
      }
    } catch (err) {
      console.error('Error loading professionals data:', err);
      setErrorMsg('Error al cargar la información de profesionales.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingProf(null);
    setFormNombre('');
    setFormApellido('');
    setFormTitulo('Especialista en Uñas');
    setFormEmail('');
    setFormTelefono('');
    setFormFotoUrl('');
    setFormColorAgenda(COLOR_PRESETS[professionals.length % COLOR_PRESETS.length]?.hex || '#8E4455');
    setFormActivo(true);
    setFormServiciosIds((services || []).map(s => s.id)); // Default all services checked
    setEnableUserAuth(false);
    setFormUserRole('empleado');
    setFormUserPassword('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = async (prof: Professional) => {
    setEditingProf(prof);
    setFormNombre(prof.nombre);
    setFormApellido(prof.apellido);
    setFormTitulo(prof.titulo || '');
    setFormEmail(prof.email || '');
    setFormTelefono(prof.telefono || '');
    setFormFotoUrl(prof.fotoUrl || '');
    setFormColorAgenda(prof.colorAgenda || '#8E4455');
    setFormActivo(prof.activo);

    // Fetch this professional's enabled services
    try {
      const sRes = await fetch(`/api/profesionales/${prof.id}/servicios`, { credentials: 'include' });
      if (sRes.ok) {
        const profServices: Service[] = await sRes.json();
        setFormServiciosIds(profServices.map(s => s.id));
      } else {
        setFormServiciosIds(prof.serviciosIds || []);
      }
    } catch {
      setFormServiciosIds(prof.serviciosIds || []);
    }

    // Check if there is an associated user
    const existingUser = usersList.find(u => u.profesionalId === prof.id || (prof.userId && u.id === prof.userId));
    if (existingUser) {
      setEnableUserAuth(true);
      setFormUserRole(existingUser.rol);
      setFormUserPassword('');
    } else {
      setEnableUserAuth(false);
      setFormUserRole('empleado');
      setFormUserPassword('');
    }

    setIsModalOpen(true);
  };

  // Toggle service selection in form
  const handleToggleService = (serviceId: string) => {
    setFormServiciosIds(prev => 
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleSelectAllServices = () => {
    setFormServiciosIds((services || []).map(s => s.id));
  };

  const handleClearServices = () => {
    setFormServiciosIds([]);
  };

  // Save Professional (Create or Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!formNombre.trim() || !formApellido.trim()) {
      setErrorMsg('Nombre y apellido son campos obligatorios.');
      return;
    }

    setIsSaving(true);
    try {
      const profPayload = {
        nombre: formNombre.trim(),
        apellido: formApellido.trim(),
        titulo: formTitulo.trim() || undefined,
        email: formEmail.trim() || undefined,
        telefono: formTelefono.trim() || undefined,
        fotoUrl: formFotoUrl.trim() || undefined,
        colorAgenda: formColorAgenda,
        activo: formActivo,
        serviciosIds: formServiciosIds
      };

      let savedProf: Professional;

      if (editingProf) {
        // Update Professional
        const res = await fetch(`/api/profesionales/${editingProf.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(profPayload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al actualizar profesional');
        }
        savedProf = await res.json();
      } else {
        // Create Professional
        const res = await fetch('/api/profesionales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(profPayload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al crear profesional');
        }
        savedProf = await res.json();
      }

      // Handle user account association if requested
      if (enableUserAuth && formEmail.trim()) {
        const existingUser = usersList.find(u => u.profesionalId === savedProf.id || u.email === formEmail.trim());
        if (existingUser) {
          // Update user
          await fetch(`/api/users/${existingUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              rol: formUserRole,
              nombre: `${formNombre.trim()} ${formApellido.trim()}`,
              activo: formActivo,
              profesionalId: savedProf.id,
              password: formUserPassword.trim() ? formUserPassword.trim() : undefined
            })
          });
        } else if (formUserPassword.trim()) {
          // Create user
          await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              email: formEmail.trim(),
              password: formUserPassword.trim(),
              rol: formUserRole,
              nombre: `${formNombre.trim()} ${formApellido.trim()}`,
              profesionalId: savedProf.id,
              activo: formActivo
            })
          });
        }
      }

      setSuccessMsg(
        editingProf
          ? `¡Profesional "${savedProf.nombre} ${savedProf.apellido}" actualizada con éxito!`
          : `¡Profesional "${savedProf.nombre} ${savedProf.apellido}" creada con éxito!`
      );
      setTimeout(() => setSuccessMsg(null), 5000);
      setIsModalOpen(false);
      await loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Error saving professional:', err);
      setErrorMsg(err.message || 'Error al guardar profesional.');
    } finally {
      setIsSaving(false);
    }
  };

  // Direct toggle active/inactive status
  const handleToggleActive = async (prof: Professional) => {
    try {
      const res = await fetch(`/api/profesionales/${prof.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ activo: !prof.activo })
      });
      if (res.ok) {
        setSuccessMsg(`Estado de ${prof.nombre} ${prof.apellido} cambiado a: ${!prof.activo ? 'ACTIVA' : 'INACTIVA'}`);
        setTimeout(() => setSuccessMsg(null), 4000);
        await loadData();
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error('Error toggling professional status:', err);
    }
  };

  // Safe Delete or Deactivate Trigger
  const handleRequestDelete = (prof: Professional) => {
    // Check how many appointments are linked to this professional
    const linkedAppointments = (appointments || []).filter(
      a => a.profesionalId === prof.id || (a.profesionalNombre && a.profesionalNombre.toLowerCase().includes(prof.nombre.toLowerCase()))
    );

    if (linkedAppointments.length > 0) {
      // Must offer deactivation to protect historical data
      setProfToAction({
        prof,
        action: 'deactivate',
        appointmentCount: linkedAppointments.length
      });
    } else {
      setProfToAction({
        prof,
        action: 'delete',
        appointmentCount: 0
      });
    }
  };

  const handleExecuteDeleteOrDeactivate = async () => {
    if (!profToAction) return;
    const { prof, action } = profToAction;

    try {
      if (action === 'delete') {
        const res = await fetch(`/api/profesionales/${prof.id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) {
          setSuccessMsg(`Profesional "${prof.nombre} ${prof.apellido}" eliminada definitivamente.`);
        } else {
          const errData = await res.json().catch(() => ({}));
          setErrorMsg(errData.error || 'No se pudo eliminar la profesional.');
        }
      } else {
        // Deactivate
        await fetch(`/api/profesionales/${prof.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ activo: false })
        });
        setSuccessMsg(`Profesional "${prof.nombre} ${prof.apellido}" desactivada correctamente. Sus turnos históricos se mantienen intactos.`);
      }

      setProfToAction(null);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Error executing delete/deactivate:', err);
      setErrorMsg('Error de conexión al procesar la solicitud.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E8DCD5] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-[#E8DCD5] flex items-center justify-center text-[#8E4455] shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E4455]">
                  Equipo & Staff
                </span>
                <span className="text-xs text-[#7A6B62] bg-[#FAF7F2] px-2 py-0.5 rounded-full border border-[#E8DCD5]">
                  ABM Centralizado
                </span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#241E1A]">
                Gestión de Profesionales
              </h3>
              <p className="text-xs text-[#7A6B62] mt-0.5">
                Administrá el equipo del salón, vinculá sus servicios asignados, roles de acceso y cronogramas individuales.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-5 py-2.5 rounded-2xl bg-[#8E4455] hover:bg-[#783645] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Profesional</span>
          </button>
        </div>
      </div>

      {/* Global feedback messages */}
      {errorMsg && (
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* PROFESSIONALS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {(professionals || []).map(prof => {
          const profAppointmentsCount = (appointments || []).filter(
            a => a.profesionalId === prof.id || (a.profesionalNombre && a.profesionalNombre.toLowerCase().includes(prof.nombre.toLowerCase()))
          ).length;

          const linkedUser = (usersList || []).find(u => u.profesionalId === prof.id || (prof.userId && u.id === prof.userId));

          return (
            <div
              key={prof.id}
              className={`bg-white p-5 sm:p-6 rounded-3xl border transition-all flex flex-col justify-between gap-5 shadow-xs ${
                prof.activo ? 'border-[#E8DCD5]' : 'border-stone-200 bg-stone-50/70 opacity-85'
              }`}
            >
              {/* Top card info */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-13 h-13 rounded-2xl flex items-center justify-center text-white font-serif font-bold text-lg shrink-0 shadow-2xs relative"
                      style={{ backgroundColor: prof.colorAgenda || '#8E4455' }}
                    >
                      {prof.fotoUrl ? (
                        <img
                          src={prof.fotoUrl}
                          alt={prof.nombre}
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      ) : (
                        <span>{prof.nombre.charAt(0)}{prof.apellido.charAt(0)}</span>
                      )}
                      <span
                        className={`w-3.5 h-3.5 rounded-full absolute -bottom-1 -right-1 border-2 border-white ${
                          prof.activo ? 'bg-emerald-500' : 'bg-stone-400'
                        }`}
                        title={prof.activo ? 'Activa' : 'Inactiva'}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-serif font-bold text-lg text-[#241E1A] truncate">
                          {prof.nombre} {prof.apellido}
                        </h4>
                      </div>
                      <p className="text-xs text-[#8E4455] font-medium truncate">
                        {prof.titulo || 'Profesional de Uñas'}
                      </p>
                      {linkedUser && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] bg-[#FAF7F2] text-[#5A4B43] px-2 py-0.2 rounded-md border border-[#E8DCD5] font-mono flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5 text-[#8E4455]" />
                            {linkedUser.rol === 'admin' ? 'Administradora' : 'Acceso Empleada'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active switch badge */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(prof)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors cursor-pointer shrink-0 ${
                      prof.activo
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                    }`}
                    title="Click para cambiar estado de actividad"
                  >
                    {prof.activo ? '● Activa' : '○ Inactiva'}
                  </button>
                </div>

                {/* Contact info & metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-[#FAF7F2] p-3 rounded-2xl border border-[#E8DCD5]">
                  <div className="truncate">
                    <span className="text-[10px] text-[#8C7A70] uppercase font-semibold block">Email</span>
                    <span className="text-[#241E1A] font-mono text-[11px] truncate block" title={prof.email || 'Sin email'}>
                      {prof.email || 'Sin email'}
                    </span>
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] text-[#8C7A70] uppercase font-semibold block">Teléfono</span>
                    <span className="text-[#241E1A] font-mono text-[11px] truncate block" title={prof.telefono || 'Sin teléfono'}>
                      {prof.telefono || 'Sin teléfono'}
                    </span>
                  </div>
                </div>

                {/* Services enabled chips */}
                <div>
                  <span className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider block mb-1.5">
                    Servicios Habilitados ({prof.serviciosIds?.length ?? (services || []).length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {prof.serviciosIds && prof.serviciosIds.length > 0 ? (
                      prof.serviciosIds.map(sId => {
                        const srv = (services || []).find(s => s.id === sId);
                        return srv ? (
                          <span
                            key={sId}
                            className="text-[10px] bg-white text-[#5A4B43] px-2 py-0.5 rounded-lg border border-[#E8DCD5] font-medium"
                          >
                            {srv.icono} {srv.nombre}
                          </span>
                        ) : null;
                      })
                    ) : (
                      <span className="text-[11px] text-[#7A6B62] italic">
                        Todos los servicios habilitados por defecto
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-[#E8DCD5] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(prof)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#241E1A] bg-[#FAF7F2] hover:bg-[#E8DCD5] px-3 py-1.5 rounded-xl border border-[#E8DCD5] transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>

                  {onNavigateToSchedule && (
                    <button
                      type="button"
                      onClick={() => onNavigateToSchedule(prof.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#8E4455] bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                      title="Configurar horario semanal de esta profesional"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Horarios</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleRequestDelete(prof)}
                  className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="Eliminar o desactivar profesional"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#FAF7F2] w-full max-w-2xl rounded-3xl border border-[#E8DCD5] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-white px-6 py-4 border-b border-[#E8DCD5] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#E8DCD5] flex items-center justify-center text-[#8E4455]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg sm:text-xl font-bold text-[#241E1A]">
                    {editingProf ? 'Editar Profesional' : 'Alta de Nueva Profesional'}
                  </h3>
                  <p className="text-xs text-[#7A6B62]">
                    Completá los datos del perfil, servicios habilitados y credenciales de acceso.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Basic Details */}
              <div className="bg-white p-5 rounded-2xl border border-[#E8DCD5] space-y-4">
                <h5 className="font-serif font-bold text-sm text-[#241E1A] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#8E4455]" />
                  <span>1. Datos Personales & Visuales</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#241E1A] mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={formNombre}
                      onChange={(e) => setFormNombre(e.target.value)}
                      placeholder="Ej: María"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs font-semibold text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#241E1A] mb-1">Apellido *</label>
                    <input
                      type="text"
                      value={formApellido}
                      onChange={(e) => setFormApellido(e.target.value)}
                      placeholder="Ej: López"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs font-semibold text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#241E1A] mb-1">Título / Especialidad</label>
                    <input
                      type="text"
                      value={formTitulo}
                      onChange={(e) => setFormTitulo(e.target.value)}
                      placeholder="Ej: Master Nail Artist & Soft Gel"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#241E1A] mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={formTelefono}
                      onChange={(e) => setFormTelefono(e.target.value)}
                      placeholder="Ej: 11-4567-8901"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#241E1A] mb-1">Email</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="Ej: maria@gwenestudio.com"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#241E1A] mb-1">Foto URL (Opcional)</label>
                    <input
                      type="text"
                      value={formFotoUrl}
                      onChange={(e) => setFormFotoUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                    />
                  </div>
                </div>

                {/* Color de Agenda Presets */}
                <div className="pt-3 border-t border-[#E8DCD5]/80 space-y-2">
                  <label className="block text-xs font-semibold text-[#241E1A]">
                    Color de Distinción en Agenda:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map(preset => (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setFormColorAgenda(preset.hex)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          formColorAgenda === preset.hex
                            ? 'bg-[#241E1A] text-white border-[#241E1A] shadow-xs'
                            : 'bg-white text-[#5A4B43] border-[#E8DCD5] hover:bg-[#FAF7F2]'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Activo Switch */}
                <div className="pt-3 border-t border-[#E8DCD5]/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#241E1A] block">Estado de la Profesional:</span>
                    <span className="text-[11px] text-[#7A6B62]">
                      {formActivo ? 'Habilitada para recibir reservas' : 'Inactiva (no aparecerá en el flujo de reserva)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormActivo(prev => !prev)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      formActivo
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    {formActivo ? '✓ Activa' : '✕ Inactiva'}
                  </button>
                </div>
              </div>

              {/* Enabled Services (Multi-select) */}
              <div className="bg-white p-5 rounded-2xl border border-[#E8DCD5] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-serif font-bold text-sm text-[#241E1A] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#8E4455]" />
                    <span>2. Servicios que Puede Realizar ({formServiciosIds.length} seleccionados)</span>
                  </h5>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllServices}
                      className="text-[10px] text-[#8E4455] hover:underline font-medium cursor-pointer"
                    >
                      Habilitar todos
                    </button>
                    <span className="text-stone-300">·</span>
                    <button
                      type="button"
                      onClick={handleClearServices}
                      className="text-[10px] text-stone-500 hover:underline font-medium cursor-pointer"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(services || []).map(srv => {
                    const isChecked = formServiciosIds.includes(srv.id);
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => handleToggleService(srv.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-[#FAF7F2] border-[#8E4455] shadow-2xs ring-1 ring-[#8E4455]'
                            : 'bg-white border-[#E8DCD5] hover:bg-[#FAF7F2]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">{srv.icono}</span>
                          <div className="truncate">
                            <p className="text-xs font-semibold text-[#241E1A] truncate">{srv.nombre}</p>
                            <p className="text-[10px] text-[#7A6B62]">{srv.duracionMinutos} min · ${srv.precio.toLocaleString('es-AR')}</p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                          isChecked ? 'bg-[#8E4455] text-white border-[#8E4455]' : 'border-[#D9C9BF]'
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User Account / Role Association */}
              <div className="bg-white p-5 rounded-2xl border border-[#E8DCD5] space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-serif font-bold text-sm text-[#241E1A] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#8E4455]" />
                    <span>3. Usuario de Acceso al Sistema</span>
                  </h5>
                  <button
                    type="button"
                    onClick={() => setEnableUserAuth(prev => !prev)}
                    className={`text-xs font-semibold px-3 py-1 rounded-xl border transition-all cursor-pointer ${
                      enableUserAuth
                        ? 'bg-[#8E4455] text-white border-[#8E4455]'
                        : 'bg-[#FAF7F2] text-[#5A4B43] border-[#E8DCD5]'
                    }`}
                  >
                    {enableUserAuth ? 'Habilitado' : 'No Habilitar'}
                  </button>
                </div>

                {enableUserAuth && (
                  <div className="pt-2 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#241E1A] mb-1">Rol en el Sistema</label>
                        <select
                          value={formUserRole}
                          onChange={(e) => setFormUserRole(e.target.value as UserRole)}
                          className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs font-semibold text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                        >
                          <option value="empleado">Empleado / Profesional</option>
                          <option value="admin">Administrador Total</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#241E1A] mb-1">
                          {editingProf ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso *'}
                        </label>
                        <input
                          type="password"
                          value={formUserPassword}
                          onChange={(e) => setFormUserPassword(e.target.value)}
                          placeholder={editingProf ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
                          className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9C9BF] text-xs text-[#241E1A] focus:outline-none focus:border-[#8E4455]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#5A4B43] hover:bg-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-[#8E4455] hover:bg-[#783645] text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingProf ? 'Guardar Cambios' : 'Crear Profesional'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE OR DEACTIVATE DIALOG */}
      {profToAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-7 border border-[#E8DCD5] shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-serif font-bold text-lg text-[#241E1A]">
                {profToAction.action === 'deactivate'
                  ? 'Preservar Historial de Turnos'
                  : '¿Eliminar profesional definitivamente?'}
              </h4>
              <p className="text-xs text-[#5A4B43] mt-2 leading-relaxed">
                {profToAction.action === 'deactivate' ? (
                  <>
                    La profesional <strong>{profToAction.prof.nombre} {profToAction.prof.apellido}</strong> posee{' '}
                    <strong>{profToAction.appointmentCount} turno(s) históricos</strong> registrados. Para no comprometer la integridad histórica de la agenda, la acción recomendada es <strong>desactivarla</strong>.
                  </>
                ) : (
                  <>
                    ¿Confirmás que deseás eliminar a <strong>{profToAction.prof.nombre} {profToAction.prof.apellido}</strong>? Esta profesional no posee turnos asociados y su registro será borrado permanentemente.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8DCD5]">
              <button
                type="button"
                onClick={() => setProfToAction(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#5A4B43] hover:bg-[#FAF7F2] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteOrDeactivate}
                className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-2xs cursor-pointer ${
                  profToAction.action === 'deactivate'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {profToAction.action === 'deactivate' ? 'Desactivar Profesional' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
