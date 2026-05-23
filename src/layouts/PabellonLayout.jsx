import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import {
  Home, FileText, Calendar, Clock, Users, Package, Mail, FileSearch,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../config/supabase'
import BaseLayout from './BaseLayout'

const Dashboard     = lazy(() => import('../pages/pabellon/Dashboard'))
const Solicitudes   = lazy(() => import('../pages/pabellon/Solicitudes'))
const Calendario    = lazy(() => import('../pages/pabellon/Calendario'))
const BloqueoHorario = lazy(() => import('../pages/pabellon/BloqueoHorario'))
const Medicos       = lazy(() => import('../pages/pabellon/Medicos'))
const Insumos       = lazy(() => import('../pages/pabellon/Insumos'))
const Auditoria     = lazy(() => import('../pages/pabellon/Auditoria'))
const Correos       = lazy(() => import('../pages/pabellon/Correos'))

const MENU = [
  { path: '/pabellon',           icon: Home,       label: 'Inicio' },
  { path: '/pabellon/solicitudes', icon: FileText,  label: 'Solicitudes' },
  { path: '/pabellon/calendario',  icon: Calendar,  label: 'Calendario' },
  { path: '/pabellon/bloqueo',     icon: Clock,     label: 'Bloqueo Horario' },
  { path: '/pabellon/medicos',     icon: Users,     label: 'Médicos' },
  { path: '/pabellon/insumos',     icon: Package,   label: 'Insumos' },
  { path: '/pabellon/correos',     icon: Mail,      label: 'Correos', badge: true },
  { path: '/pabellon/auditoria',   icon: FileSearch, label: 'Auditoría' },
]

export default function PabellonLayout() {
  // Badge: correos externos no leídos
  const { data: correosNoLeidos = 0 } = useQuery({
    queryKey: ['external-messages-unread'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('external_messages')
        .select('*', { count: 'exact', head: true })
        .eq('leido', false)
        .eq('archivado', false)
        .is('deleted_at', null)
      if (error) return 0
      return count || 0
    },
    refetchInterval: 30000,
  })

  const handleNotificationClick = (n, nav) => {
    if (n.tipo === 'solicitud_reagendamiento') {
      nav('/pabellon/calendario', { state: { fromReagendamientoNotification: true, surgeryRequestId: n.relacionado_con } })
    } else if (n.tipo === 'operacion_reagendada') {
      nav('/pabellon/calendario', { state: { surgeryId: n.relacionado_con } })
    } else {
      nav('/pabellon/solicitudes')
    }
  }

  return (
    <BaseLayout
      menuItems={MENU}
      portalLabel="Portal Clínico"
      badgeCounts={{ '/pabellon/correos': correosNoLeidos }}
      onNotificationClick={handleNotificationClick}
    >
      <Routes>
        <Route path="/"           element={<Dashboard />} />
        <Route path="/solicitudes" element={<Solicitudes />} />
        <Route path="/calendario"  element={<Calendario />} />
        <Route path="/bloqueo"     element={<BloqueoHorario />} />
        <Route path="/medicos"     element={<Medicos />} />
        <Route path="/insumos"     element={<Insumos />} />
        <Route path="/correos"     element={<Correos />} />
        <Route path="/auditoria"   element={<Auditoria />} />
        <Route path="*"            element={<Navigate to="/pabellon" />} />
      </Routes>
    </BaseLayout>
  )
}
