import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LayoutDashboard, UserPlus, FileText, Calendar, LayoutGrid } from 'lucide-react'
import BaseLayout from './BaseLayout'

const Dashboard           = lazy(() => import('../pages/doctor/Dashboard'))
const CrearPaciente       = lazy(() => import('../pages/doctor/CrearPaciente'))
const Solicitudes         = lazy(() => import('../pages/doctor/Solicitudes'))
const Calendario          = lazy(() => import('../pages/doctor/Calendario'))
const HorariosDisponibles = lazy(() => import('../pages/doctor/HorariosDisponibles'))

const MENU = [
  { path: '/doctor',           icon: LayoutDashboard, label: 'Panel Principal' },
  { path: '/doctor/paciente',  icon: UserPlus,        label: 'Reservar hora' },
  { path: '/doctor/solicitudes', icon: FileText,      label: 'Mis Solicitudes' },
  { path: '/doctor/horarios',  icon: LayoutGrid,      label: 'Horarios pabellones' },
  { path: '/doctor/calendario', icon: Calendar,       label: 'Mi Calendario' },
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
        <Route path="/solicitudes" element={<Solicitudes />} />
        <Route path="/horarios"    element={<HorariosDisponibles />} />
        <Route path="/calendario"  element={<Calendario />} />
        <Route path="*"            element={<Navigate to="/doctor" />} />
      </Routes>
    </BaseLayout>
  )
}
