import { useState, useEffect, useRef, Suspense } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../config/supabase'
import {
  LogOut, PanelLeftClose, PanelLeftOpen, Settings,
  Menu, X, Bell, Stethoscope, Sun, Moon, Activity,
} from 'lucide-react'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Modal from '../components/common/Modal'
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'
import { useNotificationsList } from '../hooks/useNotificationsList'
import { useTheme } from '../contexts/ThemeContext'

/**
 * Shell compartido entre PabellonLayout y DoctorLayout.
 *
 * Props:
 *   menuItems        — [{ path, icon, label, badge?: boolean }]
 *   portalLabel      — texto bajo el logo (ej: "Portal Clínico")
 *   badgeCounts      — { [path]: number } — contadores de badge por ruta
 *   onNotificationClick — (notification, navigate) => void
 *   children         — <Routes>…</Routes>
 */
export default function BaseLayout({ menuItems, portalLabel, badgeCounts = {}, onNotificationClick, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, changeTheme } = useTheme()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false)
  const [userId, setUserId] = useState(null)
  const notificationsDropdownRef = useRef(null)

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationsDropdownRef.current && !notificationsDropdownRef.current.contains(event.target)) {
        setShowNotificationsDropdown(false)
      }
    }
    if (showNotificationsDropdown) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotificationsDropdown])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
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

  const handleNotificationClickInternal = (n) => {
    if (!n.vista) markAsRead.mutate(n.id)
    setShowNotificationsDropdown(false)
    onNotificationClick(n, navigate)
  }

  const isSelected = (path) => {
    const basePaths = menuItems.map(i => i.path).filter(p => p !== path)
    const isExactRoot = basePaths.every(p => !path.startsWith(p) || path === p)
    if (isExactRoot && menuItems.find(i => i.path === path && !path.includes('/', path.indexOf('/', 1)))) {
      return location.pathname === path
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  // ─── helpers de estilo ────────────────────────────────────────────────
  const isDark = theme === 'dark'
  const isMedical = theme === 'medical'

  const sidebarBg = isDark ? 'bg-slate-900 border-slate-800' : isMedical ? 'bg-blue-900 border-blue-800' : 'bg-white border-slate-200'
  const iconBg = isDark ? 'bg-slate-800' : isMedical ? 'bg-blue-700' : 'bg-blue-600'
  const collapseBtn = isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : isMedical ? 'hover:bg-blue-800 text-blue-200 hover:text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-blue-600'
  const activeItem = isDark ? 'bg-slate-800 text-white shadow-lg shadow-slate-900' : isMedical ? 'bg-blue-700 text-white shadow-lg shadow-blue-900' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'
  const inactiveItem = isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : isMedical ? 'text-blue-200 hover:bg-blue-800 hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
  const iconActive = 'text-white'
  const iconInactive = isDark ? 'text-slate-400 group-hover:text-white' : isMedical ? 'text-blue-200 group-hover:text-white' : 'text-slate-400 group-hover:text-blue-600'
  const divider = isDark ? 'border-slate-800' : isMedical ? 'border-blue-800' : 'border-slate-100'
  const logoutBtn = isDark ? 'text-slate-400 hover:text-red-400 hover:bg-red-900/20' : isMedical ? 'text-blue-200 hover:text-red-400 hover:bg-red-900/20' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
  const headerBg = isDark ? 'bg-slate-900/80 border-slate-800' : isMedical ? 'bg-white/95 border-blue-100' : 'bg-white/95 border-slate-200 shadow-sm'
  const mainBg = isDark ? 'bg-slate-900' : 'bg-slate-50'

  // ─── nav item renderer ────────────────────────────────────────────────
  const NavItem = ({ item, showLabel = true, closeMobile = false }) => {
    const Icon = item.icon
    const active = isSelected(item.path)
    const badgeCount = item.badge ? (badgeCounts[item.path] || 0) : 0

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={closeMobile ? () => setIsMobileMenuOpen(false) : undefined}
        className={`w-full flex items-center ${!showLabel || isCollapsed ? 'justify-center' : 'justify-between'} px-4 py-3.5 rounded-2xl transition-all group ${active ? activeItem : inactiveItem}`}
        aria-current={active ? 'page' : undefined}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon className={`w-[22px] h-[22px] ${active ? iconActive : iconInactive}`} aria-hidden="true" />
            {badgeCount > 0 && (!showLabel || isCollapsed) && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border border-white">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </div>
          {showLabel && !isCollapsed && (
            <span className="font-bold text-sm uppercase tracking-tight">{item.label}</span>
          )}
        </div>
        {showLabel && !isCollapsed && badgeCount > 0 && (
          <span className="bg-red-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div className={`min-h-screen font-sans antialiased flex overflow-hidden transition-colors duration-150 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* ── Sidebar Desktop ── */}
      <aside className={`${isCollapsed ? 'w-24' : 'w-72'} ${sidebarBg} border-r h-screen sticky top-0 flex flex-col p-6 hidden lg:flex transition-all duration-300 ease-in-out z-50`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} mb-12 px-1`}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 animate-in fade-in duration-300">
              <div className={`${iconBg} p-2 rounded-xl shadow-lg`}>
                <Stethoscope className="text-white w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className={`text-lg font-black tracking-tighter uppercase leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>SurgicalHUB</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{portalLabel}</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className={`${iconBg} p-2 rounded-xl shadow-lg`}>
              <Stethoscope className="text-white w-6 h-6" aria-hidden="true" />
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 rounded-xl transition-all ${isCollapsed ? 'mt-4' : ''} ${collapseBtn}`}
            aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1" aria-label="Menú principal">
          {!isCollapsed && (
            <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-2 animate-in fade-in text-slate-400">
              Navegación
            </p>
          )}
          {menuItems.map(item => <NavItem key={item.path} item={item} />)}
        </nav>

        <div className={`mt-auto space-y-4 pt-6 border-t ${divider}`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 ${logoutBtn} rounded-2xl transition-all font-bold text-sm uppercase tracking-tight group`}
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-[22px] h-[22px] group-hover:text-inherit" aria-hidden="true" />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* ── Mobile Sidebar ── */}
      <aside className={`fixed left-0 top-0 h-full w-72 ${sidebarBg} border-r flex flex-col p-6 transition-transform duration-300 ease-in-out z-50 lg:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-12 px-1">
          <div className="flex items-center gap-3">
            <div className={`${iconBg} p-2 rounded-xl shadow-lg`}>
              <Stethoscope className="text-white w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className={`text-lg font-black tracking-tighter uppercase leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>SurgicalHUB</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{portalLabel}</span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className={`p-2 rounded-xl transition-all ${collapseBtn}`}
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1" aria-label="Menú principal móvil">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-2 text-slate-400">Navegación</p>
          {menuItems.map(item => <NavItem key={item.path} item={item} showLabel closeMobile />)}
        </nav>

        <div className={`mt-auto space-y-4 pt-6 border-t ${divider}`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm uppercase tracking-tight group ${logoutBtn}`}
          >
            <LogOut className="w-[22px] h-[22px]" aria-hidden="true" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className={`flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden transition-all duration-300 ${mainBg}`}>

        {/* Header */}
        <header className={`${headerBg} backdrop-blur-xl border-b sticky top-0 z-40 px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between`}>
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition-all"
              aria-label="Abrir menú"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-100">
                <Stethoscope className="text-white w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tighter uppercase leading-none">SurgicalHUB</h2>
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{portalLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notificaciones */}
            <div className="relative" ref={notificationsDropdownRef}>
              <button
                type="button"
                onClick={() => setShowNotificationsDropdown(v => !v)}
                className={`w-8 h-8 sm:w-10 sm:h-10 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-blue-400 hover:bg-slate-700' : isMedical ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100' : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50'} rounded-xl flex items-center justify-center border transition-all relative`}
                aria-label="Notificaciones"
                aria-expanded={showNotificationsDropdown}
              >
                <Bell className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center border-2 border-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotificationsDropdown && (
                <div className={`absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl border shadow-xl z-50 flex flex-col ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <h3 className={`font-bold text-sm uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Notificaciones
                    </h3>
                    {unreadCount > 0 && (
                      <button type="button" onClick={() => markAllAsRead.mutate()} className="text-xs font-semibold text-blue-600 hover:underline">
                        Marcar todas como leídas
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <p className={`px-4 py-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        No hay notificaciones
                      </p>
                    ) : (
                      <ul className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
                        {notifications.map(n => (
                          <li
                            key={n.id}
                            onClick={() => handleNotificationClickInternal(n)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleNotificationClickInternal(n) }}
                            className={`px-4 py-3 cursor-pointer transition-colors ${n.vista ? (isDark ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'hover:bg-slate-50') : (isDark ? 'bg-blue-900/20 hover:bg-slate-700/50' : 'bg-blue-50/50 hover:bg-slate-50')}`}
                          >
                            <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{n.titulo}</p>
                            <p className={`text-xs mt-0.5 line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{n.mensaje}</p>
                            <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
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
              className={`w-8 h-8 sm:w-10 sm:h-10 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-blue-400 hover:bg-slate-700' : isMedical ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100' : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50'} rounded-xl flex items-center justify-center border transition-all`}
              aria-label="Configuración"
            >
              <Settings className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className={`flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10 ${mainBg} min-h-full`}>
          <Suspense fallback={<LoadingSpinner />}>
            {children}
          </Suspense>
        </main>
      </div>

      {/* ── Modal de Tema ── */}
      <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Configuración de Tema">
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm font-bold text-blue-900 mb-1">Personaliza la apariencia</p>
            <p className="text-xs text-blue-700">El tema se guardará automáticamente.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { key: 'light',   icon: Sun,      label: 'Claro',   sub: 'Estándar',     desc: 'Ideal para trabajo diurno', swatches: ['bg-white border-slate-200', 'bg-slate-100 border-slate-200', 'bg-blue-100 border-blue-200'] },
              { key: 'dark',    icon: Moon,     label: 'Oscuro',  sub: 'Blanco y Negro', desc: 'Reduce la fatiga visual', swatches: ['bg-slate-900 border-slate-800', 'bg-slate-800 border-slate-700', 'bg-slate-700 border-slate-600'] },
              { key: 'medical', icon: Activity, label: 'Médico',  sub: 'Clínico',       desc: 'Para entornos clínicos', swatches: ['bg-blue-600 border-blue-700', 'bg-blue-50 border-blue-200', 'bg-white border-blue-100'] },
            ].map(({ key, icon: Icon, label, sub, desc, swatches }) => (
              <button
                key={key}
                onClick={() => { changeTheme(key); setShowSettingsModal(false) }}
                className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 transition-all text-left hover:shadow-lg ${theme === key ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-blue-300'}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${key === 'light' ? 'bg-white border-2 border-slate-300' : key === 'dark' ? 'bg-slate-900 border-2 border-slate-700' : 'bg-blue-600 border-2 border-blue-700'}`}>
                    <Icon className={`w-5 h-5 ${key === 'light' ? 'text-yellow-500' : key === 'dark' ? 'text-slate-300' : 'text-white'}`} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 uppercase">{label}</h3>
                    <p className="text-[10px] text-slate-500 font-bold">{sub}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mb-3">{desc}</p>
                <div className="flex gap-1">
                  {swatches.map((s, i) => <div key={i} className={`w-6 h-6 rounded border ${s}`} />)}
                </div>
                {theme === key && <div className="mt-3 text-xs font-bold text-blue-600 uppercase">Activo</div>}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
