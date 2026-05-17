import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../config/supabase'
import {
  LayoutDashboard,
  UserPlus,
  FileText,
  Calendar,
  LayoutGrid,
  Bell,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Activity,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Stethoscope,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import LoadingSpinner from '../components/common/LoadingSpinner'

const Dashboard          = lazy(() => import('../pages/doctor/Dashboard'))
const CrearPaciente      = lazy(() => import('../pages/doctor/CrearPaciente'))
const Solicitudes        = lazy(() => import('../pages/doctor/Solicitudes'))
const Calendario         = lazy(() => import('../pages/doctor/Calendario'))
const HorariosDisponibles = lazy(() => import('../pages/doctor/HorariosDisponibles'))
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'
import { useNotificationsList } from '../hooks/useNotificationsList'
import Modal from '../components/common/Modal'

const menuItems = [
  { path: '/doctor', icon: LayoutDashboard, label: 'Panel Principal' },
  { path: '/doctor/paciente', icon: UserPlus, label: 'Reservar hora' },
  { path: '/doctor/solicitudes', icon: FileText, label: 'Mis Solicitudes' },
  { path: '/doctor/horarios', icon: LayoutGrid, label: 'Horarios pabellones' },
  { path: '/doctor/calendario', icon: Calendar, label: 'Mi Calendario' },
]

export default function DoctorLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, changeTheme } = useTheme()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false)
  const notificationsDropdownRef = useRef(null)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationsDropdownRef.current && !notificationsDropdownRef.current.contains(event.target)) {
        setShowNotificationsDropdown(false)
      }
    }
    if (showNotificationsDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotificationsDropdown])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useRealtimeNotifications(userId)
  const { count: unreadCount } = useUnreadNotifications(userId)
  const { notifications, markAsRead, markAllAsRead } = useNotificationsList(userId, { enabled: showNotificationsDropdown })

  const handleLogout = async () => {
    const { clearAllAppData } = await import('../utils/storageCleaner')
    clearAllAppData()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const handleNotificationClick = (n) => {
    if (!n.vista) markAsRead.mutate(n.id)
    setShowNotificationsDropdown(false)
    if (n.tipo === 'operacion_programada' || n.tipo === 'operacion_reagendada') {
      navigate('/doctor/calendario')
    } else if (n.tipo === 'solicitud_aceptada' || n.tipo === 'solicitud_rechazada') {
      navigate('/doctor/solicitudes')
    }
  }

  const isSelected = (path) => {
    if (path === '/doctor') return location.pathname === '/doctor'
    return location.pathname.startsWith(path)
  }

  return (
    <div className={`min-h-screen font-sans antialiased flex overflow-hidden transition-colors duration-150 ${
      theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Desktop */}
      <aside className={`${isCollapsed ? 'w-24' : 'w-72'} ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : theme === 'medical' ? 'bg-blue-900 border-blue-800' : 'bg-white border-slate-200'
      } border-r h-screen sticky top-0 flex flex-col p-6 hidden lg:flex transition-all duration-300 ease-in-out z-50`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} mb-12 px-1`}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 animate-in fade-in duration-300">
              <div className={`${theme === 'dark' ? 'bg-slate-800' : theme === 'medical' ? 'bg-blue-700' : 'bg-blue-600'} p-2 rounded-xl shadow-lg`}>
                <Stethoscope className="text-white w-6 h-6" />
              </div>
              <div>
                <h2 className={`text-lg font-black tracking-tighter uppercase leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>SurgicalHUB</h2>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}>Panel Médico</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className={`${theme === 'dark' ? 'bg-slate-800' : theme === 'medical' ? 'bg-blue-700' : 'bg-blue-600'} p-2 rounded-xl shadow-lg`}>
              <Stethoscope className="text-white w-6 h-6" />
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 rounded-xl transition-all ${isCollapsed ? 'mt-4' : ''} ${
              theme === 'dark'
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : theme === 'medical'
                ? 'hover:bg-blue-800 text-blue-200 hover:text-white'
                : 'hover:bg-slate-50 text-slate-400 hover:text-blue-600'
            }`}
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
          {!isCollapsed && (
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-2 animate-in fade-in ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}>Navegación</p>
          )}
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isSelected(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-4 py-3.5 rounded-2xl transition-all group ${
                  active
                    ? `${theme === 'dark' ? 'bg-slate-800 text-white shadow-lg shadow-slate-900' : theme === 'medical' ? 'bg-blue-700 text-white shadow-lg shadow-blue-900' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'}`
                    : `${theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : theme === 'medical' ? 'text-blue-200 hover:bg-blue-800 hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-[22px] h-[22px] ${active ? 'text-white' : theme === 'dark' ? 'text-slate-400 group-hover:text-white' : theme === 'medical' ? 'text-blue-200 group-hover:text-white' : 'text-slate-400 group-hover:text-blue-600'}`} />
                  {!isCollapsed && (
                    <span className="font-bold text-sm uppercase tracking-tight">{item.label}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        <div className={`mt-auto space-y-4 pt-6 border-t ${theme === 'dark' ? 'border-slate-800' : theme === 'medical' ? 'border-blue-800' : 'border-slate-100'}`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 ${
              theme === 'dark' ? 'text-slate-400 hover:text-red-400 hover:bg-red-900/20' : theme === 'medical' ? 'text-blue-200 hover:text-red-400 hover:bg-red-900/20' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
            } rounded-2xl transition-all font-bold text-sm uppercase tracking-tight group`}
          >
            <LogOut className={`w-[22px] h-[22px] ${theme === 'dark' || theme === 'medical' ? 'group-hover:text-red-400' : 'group-hover:text-red-500'}`} />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-72 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : theme === 'medical' ? 'bg-blue-900 border-blue-800' : 'bg-white border-slate-200'
      } border-r flex flex-col p-6 transition-transform duration-300 ease-in-out z-50 lg:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between mb-12 px-1">
          <div className="flex items-center gap-3">
            <div className={`${theme === 'dark' ? 'bg-slate-800' : theme === 'medical' ? 'bg-blue-700' : 'bg-blue-600'} p-2 rounded-xl shadow-lg`}>
              <Stethoscope className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className={`text-lg font-black tracking-tighter uppercase leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>SurgicalHUB</h2>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}>Panel Médico</span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className={`p-2 rounded-xl transition-all ${
              theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : theme === 'medical' ? 'hover:bg-blue-800 text-blue-200 hover:text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-blue-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}>Navegación</p>
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isSelected(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group ${
                  active
                    ? `${theme === 'dark' ? 'bg-slate-800 text-white shadow-lg shadow-slate-900' : theme === 'medical' ? 'bg-blue-700 text-white shadow-lg shadow-blue-900' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'}`
                    : `${theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : theme === 'medical' ? 'text-blue-200 hover:bg-blue-800 hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-[22px] h-[22px] ${active ? 'text-white' : theme === 'dark' ? 'text-slate-400 group-hover:text-white' : theme === 'medical' ? 'text-blue-200 group-hover:text-white' : 'text-slate-400 group-hover:text-blue-600'}`} />
                  <span className="font-bold text-sm uppercase tracking-tight">{item.label}</span>
                </div>
              </Link>
            )
          })}
        </nav>

        <div className={`mt-auto space-y-4 pt-6 border-t ${theme === 'dark' ? 'border-slate-800' : theme === 'medical' ? 'border-blue-800' : 'border-slate-100'}`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm uppercase tracking-tight group ${
              theme === 'dark' ? 'text-slate-400 hover:text-red-400 hover:bg-red-900/20' : theme === 'medical' ? 'text-blue-200 hover:text-red-400 hover:bg-red-900/20' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
            }`}
          >
            <LogOut className={`w-[22px] h-[22px] ${theme === 'dark' || theme === 'medical' ? 'group-hover:text-red-400' : 'group-hover:text-red-500'}`} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden transition-all duration-300 lg:ml-0 ${
        theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'
      }`}>
        <header className={`${
          theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : theme === 'medical' ? 'bg-white/95 border-blue-100' : 'bg-white/95 border-slate-200 shadow-sm'
        } backdrop-blur-xl border-b sticky top-0 z-40 px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between`}>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition-all touch-manipulation"
              aria-label="Abrir menú"
            >
              <Menu className="w-6 h-6" />
            </button>
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-100">
                <Stethoscope className="text-white w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tighter uppercase leading-none">SurgicalHUB</h2>
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Panel Médico</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notificaciones */}
            <div className="relative" ref={notificationsDropdownRef}>
              <button
                type="button"
                onClick={() => setShowNotificationsDropdown((v) => !v)}
                className={`w-8 h-8 sm:w-10 sm:h-10 ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-blue-400 hover:bg-slate-700' : theme === 'medical' ? 'bg-blue-50 border-blue-200 text-blue-600 hover:text-blue-700 hover:bg-blue-100' : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                } rounded-xl flex items-center justify-center border transition-all relative`}
                title="Notificaciones"
                aria-label="Notificaciones"
                aria-expanded={showNotificationsDropdown}
              >
                <Bell className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center border-2 border-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotificationsDropdown && (
                <div className={`absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl border shadow-xl z-50 flex flex-col ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700' : theme === 'medical' ? 'bg-white border-blue-200' : 'bg-white border-slate-200'
                }`}>
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                    <h3 className={`font-bold text-sm uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Notificaciones
                    </h3>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllAsRead.mutate()}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Marcar todas como leídas
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <p className={`px-4 py-6 text-center text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        No hay notificaciones
                      </p>
                    ) : (
                      <ul className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-200'}`}>
                        {notifications.map((n) => (
                          <li
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNotificationClick(n) }}
                            className={`px-4 py-3 cursor-pointer transition-colors ${
                              n.vista
                                ? theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'hover:bg-slate-50'
                                : theme === 'dark' ? 'bg-blue-900/20 hover:bg-slate-700/50' : 'bg-blue-50/50 hover:bg-slate-50'
                            }`}
                          >
                            <p className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{n.titulo}</p>
                            <p className={`text-xs mt-0.5 line-clamp-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{n.mensaje}</p>
                            <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                              {format(new Date(n.created_at), 'd MMM yyyy, HH:mm', { locale: es })}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Configuración */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className={`w-8 h-8 sm:w-10 sm:h-10 ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-blue-400 hover:bg-slate-700' : theme === 'medical' ? 'bg-blue-50 border-blue-200 text-blue-600 hover:text-blue-700 hover:bg-blue-100' : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50'
              } rounded-xl flex items-center justify-center border transition-all cursor-pointer`}
              title="Configuración"
              aria-label="Configuración"
            >
              <Settings className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            </button>
          </div>
        </header>

        <main className={`flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10 transition-colors duration-150 min-h-full ${
          theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'
        }`}>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/paciente" element={<CrearPaciente />} />
              <Route path="/solicitudes" element={<Solicitudes />} />
              <Route path="/horarios" element={<HorariosDisponibles />} />
              <Route path="/calendario" element={<Calendario />} />
              <Route path="*" element={<Navigate to="/doctor" />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Modal de Configuración de Tema */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Configuración de Tema"
      >
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-bold text-blue-900 mb-1">
              Personaliza la apariencia de la aplicación
            </p>
            <p className="text-[10px] sm:text-xs text-blue-700">
              Selecciona un tema que se adapte a tus preferencias de trabajo
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Tema Claro */}
            <button
              onClick={() => { changeTheme('light'); setShowSettingsModal(false) }}
              className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all text-left hover:shadow-lg ${
                theme === 'light' ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-white border-2 border-slate-300 flex items-center justify-center flex-shrink-0">
                  <Sun className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 uppercase">Claro</h3>
                  <p className="text-[10px] text-slate-500 font-bold">Estándar</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-3">Tema claro con fondo blanco, ideal para trabajo diurno</p>
              <div className="flex gap-1">
                <div className="w-6 h-6 rounded bg-white border border-slate-200"></div>
                <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200"></div>
                <div className="w-6 h-6 rounded bg-blue-100 border border-blue-200"></div>
              </div>
              {theme === 'light' && <div className="mt-3 text-xs font-bold text-blue-600 uppercase">Activo</div>}
            </button>

            {/* Tema Oscuro */}
            <button
              onClick={() => { changeTheme('dark'); setShowSettingsModal(false) }}
              className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all text-left hover:shadow-lg ${
                theme === 'dark' ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-slate-900 border-2 border-slate-700 flex items-center justify-center flex-shrink-0">
                  <Moon className="w-5 h-5 text-slate-300" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 uppercase">Oscuro</h3>
                  <p className="text-[10px] text-slate-500 font-bold">Blanco y Negro</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-3">Tema oscuro en escala de grises, reduce la fatiga visual</p>
              <div className="flex gap-1">
                <div className="w-6 h-6 rounded bg-slate-900 border border-slate-800"></div>
                <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700"></div>
                <div className="w-6 h-6 rounded bg-slate-700 border border-slate-600"></div>
              </div>
              {theme === 'dark' && <div className="mt-3 text-xs font-bold text-blue-600 uppercase">Activo</div>}
            </button>

            {/* Tema Médico */}
            <button
              onClick={() => { changeTheme('medical'); setShowSettingsModal(false) }}
              className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all text-left hover:shadow-lg ${
                theme === 'medical' ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 border-2 border-blue-700 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 uppercase">Médico</h3>
                  <p className="text-[10px] text-slate-500 font-bold">Clínico</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-3">Tema diseñado para entornos clínicos y hospitalarios</p>
              <div className="flex gap-1">
                <div className="w-6 h-6 rounded bg-blue-600 border border-blue-700"></div>
                <div className="w-6 h-6 rounded bg-blue-50 border border-blue-200"></div>
                <div className="w-6 h-6 rounded bg-white border border-blue-100"></div>
              </div>
              {theme === 'medical' && <div className="mt-3 text-xs font-bold text-blue-600 uppercase">Activo</div>}
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-[10px] sm:text-xs text-slate-500 font-bold text-center">
              El tema seleccionado se guardará automáticamente y se aplicará en toda la aplicación
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
