import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { Mail, Lock, AlertCircle, Building2, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { sanitizeEmail, sanitizePassword } from '../../utils/sanitizeInput'
import { 
  isLocked, 
  recordFailedAttempt, 
  clearLoginAttempts, 
  formatRemainingTime 
} from '../../utils/rateLimiter'

export default function LoginPabellon() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lockoutInfo, setLockoutInfo] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  // Verificar bloqueo al cambiar el email
  useEffect(() => {
    if (email) {
      const lockStatus = isLocked(email)
      if (lockStatus.isLocked) {
        setLockoutInfo({
          isLocked: true,
          remainingTime: formatRemainingTime(lockStatus.remainingTime),
        })
      } else {
        setLockoutInfo(null)
      }
    } else {
      setLockoutInfo(null)
    }
  }, [email])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Verificar si está bloqueado
      const lockStatus = isLocked(email)
      if (lockStatus.isLocked) {
        setError(`Demasiados intentos fallidos. Intenta nuevamente en ${formatRemainingTime(lockStatus.remainingTime)}.`)
        setLoading(false)
        return
      }

      // Marcar que estamos validando para prevenir redirecciones automáticas
      sessionStorage.setItem('validating_login', 'true')

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        sessionStorage.removeItem('validating_login')
        // Registrar intento fallido
        const attemptResult = recordFailedAttempt(email)
        if (attemptResult.isLocked) {
          throw new Error(`Demasiados intentos fallidos. Tu cuenta ha sido bloqueada por ${formatRemainingTime(Math.ceil((attemptResult.lockoutTime - Date.now()) / 1000))}.`)
        } else {
          const remaining = attemptResult.remainingAttempts
          throw new Error(`Usuario o contraseña incorrectos. ${remaining > 0 ? `Te quedan ${remaining} intento${remaining !== 1 ? 's' : ''}.` : ''}`)
        }
      }

      // Verificar que el usuario sea Pabellón
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (userError && userError.code !== 'PGRST116') {
        sessionStorage.removeItem('validating_login')
        throw userError
      }

      if (!userData) {
        sessionStorage.removeItem('validating_login')
        await supabase.auth.signOut()
        throw new Error('Usuario no encontrado en el sistema. Contacte al administrador.')
      }

      // Si el usuario es Doctor, mostrar error y cerrar sesión
      if (userData.role === 'doctor') {
        setError('Tienes que ingresar como Doctor')
        setLoading(false)
        // Cerrar sesión después de mostrar el error
        setTimeout(async () => {
          await supabase.auth.signOut()
          sessionStorage.removeItem('validating_login')
        }, 100)
        return
      }

      // Si todo está bien, limpiar el flag y los intentos fallidos
      sessionStorage.removeItem('validating_login')
      clearLoginAttempts(email)

      if (userData.role !== 'pabellon') {
        await supabase.auth.signOut()
        throw new Error('Este acceso es solo para usuarios de Pabellón')
      }

      // Esperar un momento para que App.jsx detecte el cambio de autenticación
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Usar window.location para forzar la navegación completa
      window.location.href = '/pabellon'
    } catch (err) {
      sessionStorage.removeItem('validating_login')
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 sm:mb-8 font-bold text-xs uppercase tracking-widest touch-manipulation"
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
          Volver a inicio
        </button>


        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="bg-blue-600 p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl shadow-blue-200 rotate-6">
              <Building2 aria-hidden="true" className="text-white w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">Acceso Pabellón</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Portal de Gestión de Pabellones</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
          {lockoutInfo?.isLocked && (
            <div className="bg-orange-50 border-2 border-orange-200 text-orange-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl flex items-center gap-2 animate-in fade-in duration-300">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="text-xs font-bold break-words">
                Cuenta bloqueada. Intenta nuevamente en {lockoutInfo.remainingTime}.
              </span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl flex items-center gap-2 animate-in fade-in duration-300">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="text-xs font-bold break-words">
                {error === 'ROLE_MISMATCH_DOCTOR'
                  ? 'Tienes que ingresar como Doctor'
                  : error}
              </span>
            </div>
          )}

          <div className="space-y-1.5 sm:space-y-2">
            <label htmlFor="email" className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Usuario</label>
            <div className="relative">
              <Mail aria-hidden="true" className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(sanitizeEmail(e.target.value))}
                className="w-full bg-slate-50 border-2 border-slate-50 rounded-xl sm:rounded-2xl py-3 sm:py-4 pl-10 sm:pl-12 pr-3 sm:pr-4 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm sm:text-base text-slate-700 touch-manipulation"
                placeholder="pabellon@clinica.cl"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <label htmlFor="password" className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Contraseña</label>
            <div className="relative">
              <Lock aria-hidden="true" className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(sanitizePassword(e.target.value))}
                className="w-full bg-slate-50 border-2 border-slate-50 rounded-xl sm:rounded-2xl py-3 sm:py-4 pl-10 sm:pl-12 pr-12 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm sm:text-base text-slate-700 touch-manipulation"
                placeholder="••••••••"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff aria-hidden="true" className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye aria-hidden="true" className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || lockoutInfo?.isLocked}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-[0.2em] shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {loading ? 'Iniciando sesión...' : lockoutInfo?.isLocked ? 'Cuenta Bloqueada' : 'Entrar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}
