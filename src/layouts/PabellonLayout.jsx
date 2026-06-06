import { lazy, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import {
  Home, FileText, Calendar, Clock, Users, Package, Mail, FileSearch, User, Settings, BarChart2, MessageSquare, HelpCircle, UserRound,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../config/supabase'
import BaseLayout from './BaseLayout'
import OnboardingWizard from '../components/onboarding/OnboardingWizard'

const Dashboard     = lazy(() => import('../pages/pabellon/Dashboard'))
const Solicitudes   = lazy(() => import('../pages/pabellon/Solicitudes'))
const Calendario    = lazy(() => import('../pages/pabellon/Calendario'))
const BloqueoHorario = lazy(() => import('../pages/pabellon/BloqueoHorario'))
const Medicos       = lazy(() => import('../pages/pabellon/Medicos'))
const Pacientes     = lazy(() => import('../pages/pabellon/Pacientes'))
const Insumos       = lazy(() => import('../pages/pabellon/Insumos'))
const Auditoria     = lazy(() => import('../pages/pabellon/Auditoria'))
const Estadisticas    = lazy(() => import('../pages/pabellon/Estadisticas'))
const ChatPabellon    = lazy(() => import('../pages/pabellon/Chat'))
const Correos         = lazy(() => import('../pages/pabellon/Correos'))
const Configuracion   = lazy(() => import('../pages/pabellon/Configuracion'))
const Perfil          = lazy(() => import('../pages/Perfil'))
const Ayuda           = lazy(() => import('../pages/pabellon/Ayuda'))

const MENU = [
  { path: '/pabellon',           icon: Home,       label: 'Inicio' },
  { path: '/pabellon/solicitudes', icon: FileText,  label: 'Solicitudes' },
  { path: '/pabellon/calendario',  icon: Calendar,  label: 'Calendario' },
  { path: '/pabellon/bloqueo',     icon: Clock,     label: 'Bloqueo Horario' },
  { path: '/pabellon/medicos',     icon: Users,     label: 'Médicos' },
  { path: '/pabellon/pacientes',   icon: UserRound, label: 'Pacientes' },
  { path: '/pabellon/insumos',     icon: Package,   label: 'Insumos' },
  { path: '/pabellon/estadisticas', icon: BarChart2,      label: 'Estadísticas' },
  { path: '/pabellon/chat',         icon: MessageSquare,  label: 'Chat Médicos' },
  { path: '/pabellon/correos',      icon: Mail,           label: 'Correos', badge: true },
  { path: '/pabellon/auditoria',      icon: FileSearch, label: 'Auditoría' },
  { path: '/pabellon/configuracion', icon: Settings,    label: 'Configuración' },
  { path: '/pabellon/ayuda',         icon: HelpCircle, label: 'Ayuda' },
  { path: '/pabellon/perfil',        icon: User,        label: 'Mi Perfil' },
]

export default function PabellonLayout() {
  const [onboardingDone, setOnboardingDone] = useState(
    () => !!localStorage.getItem('onboarding_completed')
  )

  // Detectar si es primera vez: sin pabellones configurados
  const { data: tienePabellones, isLoading: checkingPabellones } = useQuery({
    queryKey: ['check-pabellones-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('operating_rooms')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)
      return (count ?? 0) > 0
    },
    enabled: !onboardingDone,
    staleTime: Infinity,
  })

  const showWizard = !onboardingDone && !checkingPabellones && tienePabellones === false

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
      {showWizard && <OnboardingWizard onComplete={() => setOnboardingDone(true)} />}
      <Routes>
        <Route path="/"           element={<Dashboard />} />
        <Route path="/solicitudes" element={<Solicitudes />} />
        <Route path="/calendario"  element={<Calendario />} />
        <Route path="/bloqueo"     element={<BloqueoHorario />} />
        <Route path="/medicos"     element={<Medicos />} />
        <Route path="/pacientes"   element={<Pacientes />} />
        <Route path="/insumos"     element={<Insumos />} />
        <Route path="/estadisticas"   element={<Estadisticas />} />
        <Route path="/chat"           element={<ChatPabellon />} />
        <Route path="/correos"        element={<Correos />} />
        <Route path="/auditoria"      element={<Auditoria />} />
        <Route path="/configuracion"  element={<Configuracion />} />
        <Route path="/ayuda"          element={<Ayuda />} />
        <Route path="/perfil"         element={<Perfil />} />
        <Route path="*"            element={<Navigate to="/pabellon" />} />
      </Routes>
    </BaseLayout>
  )
}
