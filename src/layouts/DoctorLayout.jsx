import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LayoutDashboard, UserPlus, FileText, Calendar, LayoutGrid, User, Users, CalendarClock, MessageSquare } from 'lucide-react'
import BaseLayout from './BaseLayout'

const Dashboard           = lazy(() => import('../pages/doctor/Dashboard'))
const CrearPaciente       = lazy(() => import('../pages/doctor/CrearPaciente'))
const Pacientes           = lazy(() => import('../pages/doctor/Pacientes'))
const Solicitudes         = lazy(() => import('../pages/doctor/Solicitudes'))
const Calendario          = lazy(() => import('../pages/doctor/Calendario'))
const HorariosDisponibles = lazy(() => import('../pages/doctor/HorariosDisponibles'))
const Disponibilidad      = lazy(() => import('../pages/doctor/Disponibilidad'))
const Chat                = lazy(() => import('../pages/doctor/Chat'))
const Perfil              = lazy(() => import('../pages/Perfil'))

const MENU = [
  { path: '/doctor',            icon: LayoutDashboard, label: 'Panel Principal' },
  { path: '/doctor/paciente',   icon: UserPlus,        label: 'Reservar hora' },
  { path: '/doctor/pacientes',  icon: Users,           label: 'Mis Pacientes' },
  { path: '/doctor/solicitudes', icon: FileText,       label: 'Mis Solicitudes' },
  { path: '/doctor/horarios',   icon: LayoutGrid,      label: 'Horarios pabellones' },
  { path: '/doctor/disponibilidad', icon: CalendarClock,  label: 'Mi Disponibilidad' },
  { path: '/doctor/chat',           icon: MessageSquare,  label: 'Chat Pabellón' },
  { path: '/doctor/calendario', icon: Calendar,        label: 'Mi Calendario' },
  { path: '/doctor/perfil',     icon: User,            label: 'Mi Perfil' },
]

const handleNotificationClick = (n, navigate) => {
  if (n.tipo === 'operacion_programada' || n.tipo === 'operacion_reagendada') {
    navigate('/doctor/calendario')
  } else {
    navigate('/doctor/solicitudes')
  }
}

export default function DoctorLayout() {
  return (
    <BaseLayout
      menuItems={MENU}
      portalLabel="Panel Médico"
      onNotificationClick={handleNotificationClick}
    >
      <Routes>
        <Route path="/"            element={<Dashboard />} />
        <Route path="/paciente"    element={<CrearPaciente />} />
        <Route path="/pacientes"   element={<Pacientes />} />
        <Route path="/solicitudes" element={<Solicitudes />} />
        <Route path="/horarios"        element={<HorariosDisponibles />} />
        <Route path="/disponibilidad"  element={<Disponibilidad />} />
        <Route path="/chat"            element={<Chat />} />
        <Route path="/calendario"      element={<Calendario />} />
        <Route path="/perfil"      element={<Perfil />} />
        <Route path="*"            element={<Navigate to="/doctor" />} />
      </Routes>
    </BaseLayout>
  )
}
