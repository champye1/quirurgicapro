import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './config/supabase'
import { logger } from './utils/logger'
import LoadingSpinner from './components/common/LoadingSpinner'

const LandingPage        = lazy(() => import('./pages/public/LandingPage'))
const PoliticaPrivacidad = lazy(() => import('./pages/public/PoliticaPrivacidad'))
const NotFound           = lazy(() => import('./pages/public/NotFound'))
const Inicio            = lazy(() => import('./pages/auth/Inicio'))
const LoginPabellon     = lazy(() => import('./pages/auth/LoginPabellon'))
const LoginDoctor       = lazy(() => import('./pages/auth/LoginDoctor'))
const RecuperarContraseña   = lazy(() => import('./pages/auth/RecuperarContraseña'))
const RestablecerContraseña = lazy(() => import('./pages/auth/RestablecerContraseña'))
const ContactoExterno   = lazy(() => import('./pages/public/ContactoExterno'))
const PortalPaciente    = lazy(() => import('./pages/public/PortalPaciente'))
const PabellonLayout    = lazy(() => import('./layouts/PabellonLayout'))
const DoctorLayout      = lazy(() => import('./layouts/DoctorLayout'))

// Detecta si el error es por token de refresco inválido (sesión antigua/revocada)
function isInvalidRefreshTokenError(error) {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  const name = (error.name || '').toLowerCase()
  return name === 'authapierror' || msg.includes('refresh token') || msg.includes('refresh_token')
}

function AppContent() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    // Validar sesión con el servidor (getUser refresca el token; getSession solo lee almacenamiento)
    // Así capturamos "Invalid Refresh Token" al cargar y limpiamos sin mostrar error en consola
    const initAuth = async () => {
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser()
        if (error) {
          if (isInvalidRefreshTokenError(error)) {
            logger.warn('Token de refresco inválido o no encontrado. Limpiando sesión.')
            await supabase.auth.signOut()
            sessionStorage.setItem('session_expired', '1')
          }
          setUser(null)
          setUserRole(null)
          setLoading(false)
          return
        }
        setUser(currentUser ?? null)
        if (currentUser) {
          fetchUserRole(currentUser.id)
        } else {
          setUserRole(null)
          setLoading(false)
        }
      } catch (err) {
        if (isInvalidRefreshTokenError(err)) {
          logger.warn('Token de refresco inválido. Limpiando sesión.')
          await supabase.auth.signOut()
          sessionStorage.setItem('session_expired', '1')
        }
        setUser(null)
        setUserRole(null)
        setLoading(false)
      }
    }
    initAuth()

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserRole(session.user.id)
      } else {
        // Cuando se hace logout, asegurar que el loading se desactive
        setUserRole(null)
        setLoading(false)
        // Limpiar sessionStorage si existe
        sessionStorage.removeItem('validating_login')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle() // Usa maybeSingle() en lugar de single() para manejar cuando no hay registro

      if (error) {
        // Si el error es que no existe el registro, no es crítico
        if (error.code === 'PGRST116') {
          logger.warn('Usuario no encontrado en tabla users. Debe crear el registro primero.')
          setUserRole(null)
          setLoading(false)
          return
        }
        
        // Manejar sesión expirada (401)
        if (error.status === 401 || error.message?.includes('JWT')) {
          logger.warn('Sesión expirada. Redirigiendo al login...')
          await supabase.auth.signOut()
          setUser(null)
          setUserRole(null)
          setLoading(false)
          return
        }
        
        throw error
      }
      
      if (data) {
        setUserRole(data.role)
        sessionStorage.removeItem('validating_login')
      } else {
        setUserRole(null)
      }
    } catch (error) {
      logger.errorWithContext('Error fetching user role', error)
      
      // Manejar sesión expirada en catch también
      if (error.status === 401 || error.message?.includes('JWT') || error.message?.includes('expired')) {
        logger.warn('Sesión expirada. Redirigiendo al login...')
        await supabase.auth.signOut()
        setUser(null)
        setUserRole(null)
      } else {
        setUserRole(null)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
    <Routes>
      <Route
        path="/"
        element={
          user && userRole ? (
            <Navigate to={userRole === 'pabellon' ? '/pabellon' : '/doctor'} replace />
          ) : (
            <LandingPage />
          )
        }
      />

      <Route
        path="/acceso"
        element={
          user && userRole ? (
            <Navigate to={userRole === 'pabellon' ? '/pabellon' : '/doctor'} replace />
          ) : (
            <Inicio />
          )
        }
      />

      <Route path="/politica-privacidad" element={<PoliticaPrivacidad />} />
      
      <Route 
        path="/login/pabellon" 
        element={
          user && userRole === 'pabellon' ? (
            <Navigate to="/pabellon" />
          ) : user && userRole === 'doctor' ? (
            // Si es doctor intentando acceder a login de pabellon, no redirigir automáticamente
            // Dejar que LoginPabellon maneje el error
            <LoginPabellon />
          ) : user ? (
            <Navigate to="/" />
          ) : (
            <LoginPabellon />
          )
        } 
      />
      
      <Route 
        path="/login/doctor" 
        element={
          user && userRole === 'doctor' ? (
            <Navigate to="/doctor" />
          ) : user && userRole === 'pabellon' ? (
            // Si es pabellon intentando acceder a login de doctor, no redirigir automáticamente
            // Dejar que LoginDoctor maneje el error
            <LoginDoctor />
          ) : user ? (
            <Navigate to="/" />
          ) : (
            <LoginDoctor />
          )
        } 
      />

      <Route path="/recuperar-contrasena" element={<RecuperarContraseña />} />
      <Route path="/restablecer-contrasena" element={<RestablecerContraseña />} />
      {/* Ruta pública para médicos externos — no requiere autenticación */}
      <Route path="/contacto" element={<ContactoExterno />} />
      {/* Portal de paciente — acceso público por token */}
      <Route path="/portal/paciente/:token" element={<PortalPaciente />} />
      
      <Route 
        path="/pabellon/*" 
        element={
          user && userRole === 'pabellon' && !sessionStorage.getItem('validating_login') ? (
            <PabellonLayout />
          ) : user && sessionStorage.getItem('validating_login') ? (
            // Si estamos validando, no redirigir todavía
            <LoadingSpinner />
          ) : user ? (
            <Navigate to="/" replace />
          ) : (
            <Navigate to="/login/pabellon" replace />
          )
        } 
      />
      
      <Route
        path="/doctor/*"
        element={
          user && userRole === 'doctor' && !sessionStorage.getItem('validating_login') ? (
            <DoctorLayout />
          ) : user && sessionStorage.getItem('validating_login') ? (
            // Si estamos validando, no redirigir todavía
            <LoadingSpinner />
          ) : user ? (
            <Navigate to="/" replace />
          ) : (
            <Navigate to="/login/doctor" replace />
          )
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  )
}

function App() {
  return <AppContent />
}

export default App
