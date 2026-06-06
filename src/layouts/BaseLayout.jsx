import { useState, useEffect, useRef, Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabase'
import { Settings, Menu, Search, Stethoscope, Compass } from 'lucide-react'
import { useTour } from '../hooks/useTour'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { LayoutErrorBoundary } from '../components/common/ErrorBoundary'
import OfflineBanner from '../components/common/OfflineBanner'
import CommandPalette from '../components/common/CommandPalette'
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications'
import { useClinicInfo } from '../hooks/useClinicInfo'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'
import { useNotificationsList } from '../hooks/useNotificationsList'
import { useTheme } from '../contexts/ThemeContext'
import AppSidebar from './baseLayout/AppSidebar'
import NotificationsDropdown from './baseLayout/NotificationsDropdown'
import SessionWarning from './baseLayout/SessionWarning'
import ThemeModal from './baseLayout/ThemeModal'

/**
 * Shell compartido entre PabellonLayout y DoctorLayout.
 *
 * Props:
 *   menuItems            — [{ path, icon, label, badge?: boolean }]
 *   portalLabel          — texto bajo el logo (ej: "Portal Clínico")
 *   badgeCounts          — { [path]: number } contadores de badge por ruta
 *   onNotificationClick  — (notification, navigate) => void
 *   children             — <Routes>…</Routes>
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
  const [doctorId, setDoctorId] = useState(null)
  const [showSessionWarning, setShowSessionWarning] = useState(false)
  const [sessionMinutosRestantes, setSessionMinutosRestantes] = useState(null)
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  const hadSessionRef = useRef(false)
  const notificationsDropdownRef = useRef(null)
  const basePrefix = location.pathname.startsWith('/pabellon') ? '/pabellon' : '/doctor'
  const { startTour } = useTour()

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

  // Sesión + expiración
  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    initUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        hadSessionRef.current = true
        setUserId(session.user.id)
        const expiresAt = session.expires_at
        if (expiresAt) {
          const segsRestantes = expiresAt - Math.floor(Date.now() / 1000)
          if (segsRestantes > 0 && segsRestantes <= 300) {
            setSessionMinutosRestantes(Math.floor(segsRestantes / 60))
            setShowSessionWarning(true)
          } else {
            setShowSessionWarning(false)
          }
        }
      } else {
        setUserId(null)
        if (event === 'SIGNED_OUT' && hadSessionRef.current) {
          hadSessionRef.current = false
          setShowSessionExpiredModal(true)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(v => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Obtener doctorId para filtrar suscripciones realtime en rutas de médico
  useEffect(() => {
    if (!userId || !location.pathname.startsWith('/doctor')) {
      setDoctorId(null)
      return
    }
    supabase.from('doctors').select('id').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (data?.id) setDoctorId(data.id) })
  }, [userId, location.pathname])

  useRealtimeNotifications(userId, doctorId)
  const { data: clinicInfo } = useClinicInfo()
  const { count: unreadCount } = useUnreadNotifications(userId)
  const { notifications, markAsRead, markAllAsRead } = useNotificationsList(userId, { enabled: showNotificationsDropdown })

  useEffect(() => {
    const base = `${clinicInfo?.nombre || 'QuirúrgicaPro'} — Gestión Quirúrgica`
    document.title = unreadCount > 0 ? `(${unreadCount > 99 ? '99+' : unreadCount}) ${base}` : base
  }, [unreadCount, clinicInfo?.nombre])

  const handleLogout = async () => {
    const { clearAllAppData } = await import('../utils/storageCleaner')
    clearAllAppData()
    await supabase.auth.signOut({ scope: 'global' })
    window.location.href = '/'
  }

  const handleNotificationClick = (n) => {
    if (!n.vista) markAsRead.mutate(n.id)
    setShowNotificationsDropdown(false)
    onNotificationClick(n, navigate)
  }

  const isDark = theme === 'dark'
  const isMedical = theme === 'medical'
  const headerBg = isDark ? 'bg-slate-900/80 border-slate-800' : isMedical ? 'bg-white/95 border-blue-100' : 'bg-white/95 border-slate-200 shadow-sm'
  const mainBg = isDark ? 'bg-slate-900' : 'bg-slate-50'
  const headerBtnClass = isDark
    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-blue-400 hover:bg-slate-700'
    : isMedical
    ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
    : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50'

  return (
    <div className={`min-h-screen font-sans antialiased flex overflow-hidden transition-colors duration-150 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>

      <OfflineBanner />

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <AppSidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        menuItems={menuItems}
        badgeCounts={badgeCounts}
        portalLabel={portalLabel}
        handleLogout={handleLogout}
        theme={theme}
        clinicName={clinicInfo?.nombre}
        clinicLogoUrl={clinicInfo?.logo_url}
      />

      {/* Main Content */}
      <div className={`flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden transition-all duration-300 ${mainBg}`}>

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
            <div id="tour-header-notifications">
              <NotificationsDropdown
                ref={notificationsDropdownRef}
                isDark={isDark}
                isMedical={isMedical}
                showDropdown={showNotificationsDropdown}
                onToggle={() => setShowNotificationsDropdown(v => !v)}
                unreadCount={unreadCount}
                notifications={notifications}
                onMarkAllRead={() => markAllAsRead.mutate()}
                onNotificationClick={handleNotificationClick}
              />
            </div>

            <button
              id="tour-header-search"
              onClick={() => setShowCommandPalette(true)}
              title="Búsqueda global (Ctrl+K)"
              className={`flex items-center gap-2 h-8 sm:h-10 px-2.5 sm:px-3 ${headerBtnClass} rounded-xl border transition-all text-xs font-bold`}
              aria-label="Búsqueda global"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Buscar</span>
              <kbd className="hidden md:inline text-[9px] border border-current rounded px-1 opacity-60">⌘K</kbd>
            </button>

            <button
              onClick={startTour}
              title="Tour guiado"
              className={`hidden sm:flex items-center gap-1.5 h-8 sm:h-10 px-2.5 sm:px-3 ${headerBtnClass} rounded-xl border transition-all text-xs font-bold`}
              aria-label="Iniciar tour guiado"
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tour</span>
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className={`w-8 h-8 sm:w-10 sm:h-10 ${headerBtnClass} rounded-xl flex items-center justify-center border transition-all`}
              aria-label="Configuración"
            >
              <Settings className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className={`flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10 ${mainBg} min-h-full`}>
          <LayoutErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              {children}
            </Suspense>
          </LayoutErrorBoundary>
        </main>
      </div>

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        basePrefix={basePrefix}
      />

      <SessionWarning
        showWarning={showSessionWarning}
        onCloseWarning={() => setShowSessionWarning(false)}
        minutosRestantes={sessionMinutosRestantes}
        showExpired={showSessionExpiredModal}
      />

      <ThemeModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        theme={theme}
        changeTheme={changeTheme}
      />
    </div>
  )
}
