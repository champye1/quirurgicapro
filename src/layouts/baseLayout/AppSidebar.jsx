import { Link, useLocation } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen, Stethoscope, X } from 'lucide-react'

export default function AppSidebar({
  isCollapsed,
  setIsCollapsed,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  menuItems,
  badgeCounts,
  portalLabel,
  handleLogout,
  theme,
  clinicName,
  clinicLogoUrl,
}) {
  const location = useLocation()
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

  const isSelected = (path) => {
    const basePaths = menuItems.map(i => i.path).filter(p => p !== path)
    const isExactRoot = basePaths.every(p => !path.startsWith(p) || path === p)
    if (isExactRoot && menuItems.find(i => i.path === path && !path.includes('/', path.indexOf('/', 1)))) {
      return location.pathname === path
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const Logo = () => (
    clinicLogoUrl
      ? <img src={clinicLogoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-contain bg-white p-1 shadow-lg" onError={e => { e.target.style.display = 'none' }} />
      : <div className={`${iconBg} p-2 rounded-xl shadow-lg`}><Stethoscope className="text-white w-6 h-6" aria-hidden="true" /></div>
  )

  const NavItem = ({ item, showLabel = true, closeMobile = false }) => {
    const Icon = item.icon
    const active = isSelected(item.path)
    const badgeCount = item.badge ? (badgeCounts[item.path] || 0) : 0

    return (
      <Link
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
    <>
      {/* Desktop Sidebar */}
      <aside className={`${isCollapsed ? 'w-24' : 'w-72'} ${sidebarBg} border-r h-screen sticky top-0 flex flex-col p-6 hidden lg:flex transition-all duration-300 ease-in-out z-50`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} mb-12 px-1`}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 animate-in fade-in duration-300">
              <Logo />
              <div>
                <h2 className={`text-lg font-black tracking-tighter uppercase leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{clinicName || 'QuirúrgicaPro'}</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{portalLabel}</span>
              </div>
            </div>
          )}
          {isCollapsed && <Logo />}
          <button
            onClick={() => setIsCollapsed(v => !v)}
            className={`p-2 rounded-xl transition-all ${isCollapsed ? 'mt-4' : ''} ${collapseBtn}`}
            aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        <nav id="tour-sidebar-nav" className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1" aria-label="Menú principal">
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
            <LogOut className="w-[22px] h-[22px]" aria-hidden="true" />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-72 ${sidebarBg} border-r flex flex-col p-6 transition-transform duration-300 ease-in-out z-50 lg:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-12 px-1">
          <div className="flex items-center gap-3">
            <Logo />
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
    </>
  )
}
