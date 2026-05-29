import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { Mail, Lock, AlertCircle, Stethoscope, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { sanitizeEmail, sanitizePassword } from '../../utils/sanitizeInput'
import { 
  isLocked, 
  recordFailedAttempt, 
  clearLoginAttempts, 
  formatRemainingTime 
} from '../../utils/rateLimiter'

export default function LoginDoctor() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  /** 'blocked_account' = aviso por vacaciones o acceso web deshabilitado (mensaje claro para el doctor) */
  const [errorType, setErrorType] = useState(null)
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
    setErrorType(null)

    try {
      // Verificar si está bloqueado (usar el identificador ingresado)
      const lockStatus = isLocked(email)
      if (lockStatus.isLocked) {
        setError(`Demasiados intentos fallidos. Intenta nuevamente en ${formatRemainingTime(lockStatus.remainingTime)}.`)
        setLoading(false)
        return
      }

      // Marcar que estamos validando para prevenir redirecciones automáticas
      sessionStorage.setItem('validating_login', 'true')

      // Determinar si el input es un email o un username
      const isEmail = email.includes('@')
      let emailToUse = email.toLowerCase().trim()

      // Si no es un email, resolver username -> email vía RPC (anon no puede leer users por RLS)
      if (!isEmail) {
        const { data: resolvedEmail, error: rpcError } = await supabase
          .rpc('get_doctor_email_by_username', { p_username: email.toLowerCase().trim() })

        if (rpcError || resolvedEmail == null || resolvedEmail === '') {
          sessionStorage.removeItem('validating_login')
          const attemptResult = recordFailedAttempt(email)
          if (attemptResult.isLocked) {
            throw new Error(`Demasiados intentos fallidos. Tu cuenta ha sido bloqueada por ${formatRemainingTime(Math.ceil((attemptResult.lockoutTime - Date.now()) / 1000))}.`)
          } else {
            const remaining = attemptResult.remainingAttempts
            throw new Error(`Usuario o contraseña incorrectos. ${remaining > 0 ? `Te quedan ${remaining} intento${remaining !== 1 ? 's' : ''}.` : ''}`)
          }
        }

        emailToUse = resolvedEmail
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      })

      if (authError) {
        sessionStorage.removeItem('validating_login')
        // Registrar intento fallido usando el identificador ingresado
        const attemptResult = recordFailedAttempt(email)
        if (attemptResult.isLocked) {
          throw new Error(`Demasiados intentos fallidos. Tu cuenta ha sido bloqueada por ${formatRemainingTime(Math.ceil((attemptResult.lockoutTime - Date.now()) / 1000))}.`)
        } else {
          const remaining = attemptResult.remainingAttempts
          throw new Error(`Usuario o contraseña incorrectos. ${remaining > 0 ? `Te quedan ${remaining} intento${remaining !== 1 ? 's' : ''}.` : ''}`)
        }
      }

      // PRIMERO: Verificar el rol ANTES de que App.jsx pueda redirigir
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (userError && userError.code !== 'PGRST116') {
        sessionStorage.removeItem('validating_login')
        await supabase.auth.signOut()
        throw userError
      }

      if (!userData) {
        sessionStorage.removeItem('validating_login')
        await supabase.auth.signOut()
        throw new Error('Usuario no encontrado en el sistema. Contacte al administrador.')
      }

      // Si el usuario es Pabellón, mostrar error y cerrar sesión
      if (userData.role === 'pabellon') {
        setError('Tienes que ingresar como Pabellón')
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
      // También limpiar por email si se usó username
      if (!isEmail && emailToUse) {
        clearLoginAttempts(emailToUse)
      }

      // Si no es doctor, rechazar
      if (userData.role !== 'doctor') {
        await supabase.auth.signOut()
        throw new Error('Este acceso es solo para usuarios de Doctor')
      }

      // SEGUNDO: Verificar que exista en la tabla doctors y tenga acceso habilitado
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (doctorError && doctorError.code !== 'PGRST116') {
        throw doctorError
      }

      if (!doctorData) {
        await supabase.auth.signOut()
        throw new Error('No se encontró información del doctor. Contacte al administrador.')
      }

      if (!doctorData.acceso_web_enabled) {
        setErrorType('blocked_account')
        setError('Su cuenta no tiene acceso web habilitado. Solo el administrador (Pabellón) puede activarlo. Contacte a la clínica si necesita ingresar al portal.')
        setLoading(false)
        await supabase.auth.signOut()
        return
      }

      if (doctorData.estado === 'vacaciones') {
        setErrorType('blocked_account')
        setError('Su cuenta está en modo vacaciones. No puede acceder al sistema hasta que un administrador cambie su estado a activo. Contacte a la clínica si necesita ingresar.')
        setLoading(false)
        await supabase.auth.signOut()
        return
      }

      // Esperar un momento para que App.jsx detecte el cambio de autenticación
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Usar window.location para forzar la navegación completa
      window.location.href = '/doctor'
    } catch (err) {
      sessionStorage.removeItem('validating_login')
      setErrorType(null)
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
          <div className="bg-green-600 p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl shadow-green-200 rotate-6">
              <Stethoscope className="text-white w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">Acceso Doctor</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Portal Médico</p>
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
            <div
              className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl flex items-start gap-2 animate-in fade-in duration-300 ${
                errorType === 'blocked_account'
                  ? 'bg-amber-50 border-2 border-amber-300 text-amber-900'
                  : 'bg-red-50 border-2 border-red-200 text-red-700'
              }`}
            >
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                {errorType === 'blocked_account' && (
                  <span className="text-xs font-black uppercase tracking-wider text-amber-700">
                    Aviso: no puede acceder al portal
                  </span>
                )}
                <span className="text-xs font-bold break-words">{error}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5 sm:space-y-2">
            <label htmlFor="email" className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Usuario o Correo</label>
            <div className="relative">
              <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(sanitizeEmail(e.target.value))}
                className="w-full bg-slate-50 border-2 border-slate-50 rounded-xl sm:rounded-2xl py-3 sm:py-4 pl-10 sm:pl-12 pr-3 sm:pr-4 focus:border-green-500 focus:bg-white transition-all outline-none font-bold text-sm sm:text-base text-slate-700 touch-manipulation"
                placeholder="evenegas o doctor@clinica.cl"
                required
                disabled={loading}
              />
            </div>
            <p className="text-xs text-slate-500 ml-1">
              Puedes ingresar con tu nombre de usuario o correo electrónico
            </p>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <label htmlFor="password" className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(sanitizePassword(e.target.value))}
                className="w-full bg-slate-50 border-2 border-slate-50 rounded-xl sm:rounded-2xl py-3 sm:py-4 pl-10 sm:pl-12 pr-11 sm:pr-12 focus:border-green-500 focus:bg-white transition-all outline-none font-bold text-sm sm:text-base text-slate-700 touch-manipulation"
                placeholder="••••••••"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || lockoutInfo?.isLocked}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-[0.2em] shadow-xl shadow-green-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {loading ? 'Iniciando sesión...' : lockoutInfo?.isLocked ? 'Cuenta Bloqueada' : 'Entrar al Sistema'}
          </button>

          <p className="text-center mt-3">
            <button
              type="button"
              onClick={() => navigate('/recuperar-contrasena')}
              className="text-slate-500 hover:text-green-600 text-xs font-bold transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
