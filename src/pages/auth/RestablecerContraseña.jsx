import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { Lock, Stethoscope, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { sanitizePassword } from '../../utils/sanitizeInput'
import { logger } from '../../utils/logger'

export default function RestablecerContraseña() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [linkStatus, setLinkStatus] = useState('checking') // 'checking' | 'valid' | 'expired'
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash || ''
    const params = new URLSearchParams(hash.replace(/^#/, ''))

    if (params.get('error') || !params.get('access_token')) {
      setLinkStatus('expired')
      return
    }

    // Supabase v2: el cliente procesa el hash de forma asíncrona.
    // Escuchar PASSWORD_RECOVERY evita la race condition de llamar getSession() demasiado pronto.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setLinkStatus('valid')
      }
    })

    // Fallback: si el cliente ya procesó el hash antes del mount (caso síncrono)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setLinkStatus('valid')
    }
    checkSession()

    // Si ningún evento válido llega en 4 segundos, el token expiró
    const timer = setTimeout(() => {
      setLinkStatus(prev => prev === 'checking' ? 'expired' : prev)
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres.')
      return
    }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: sanitizePassword(password),
      })
      if (updateError) {
        setError(updateError.message || 'Error al actualizar la contraseña.')
        return
      }
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        // La contraseña ya fue cambiada — navegar igual aunque falle el cierre de sesión
        logger.warn('signOut tras cambio de contraseña falló:', signOutError.message)
      }
      navigate('/login/doctor', { replace: true })
    } catch (err) {
      setError(err.message || 'Error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  if (linkStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <p className="text-slate-600 font-bold">Comprobando enlace...</p>
        </div>
      </div>
    )
  }

  if (linkStatus === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6">
        <div className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-amber-500 p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl rotate-6">
              <Lock className="text-white w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">
            Enlace inválido o expirado
          </h1>
          <p className="text-slate-600 text-sm mb-6">
            El enlace de recuperación ya no es válido (caduca en 1 hora). Solicita uno nuevo.
          </p>
          <Link
            to="/recuperar-contrasena"
            className="inline-block w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest text-center"
          >
            Solicitar nuevo enlace
          </Link>
          <p className="mt-6">
            <Link to="/login/doctor" className="text-slate-500 hover:text-slate-700 text-sm inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Volver al login
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6">
      <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="bg-green-600 p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl shadow-green-200 rotate-6">
            <Stethoscope className="text-white w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">
            Nueva contraseña
          </h1>
          <p className="text-slate-500 text-xs mt-2">
            Elige una contraseña segura (mín. 6 caracteres)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-sm">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="password" className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Nueva contraseña
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(sanitizePassword(e.target.value))}
                className="w-full bg-slate-50 border-2 border-slate-50 rounded-xl py-3 pl-10 pr-11 focus:border-green-500 focus:bg-white outline-none font-bold text-sm text-slate-700"
                placeholder="••••••••"
                minLength={6}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                title={showPassword ? 'Ocultar' : 'Ver'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirm" className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Repetir contraseña
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
              <input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(sanitizePassword(e.target.value))}
                className="w-full bg-slate-50 border-2 border-slate-50 rounded-xl py-3 pl-10 pr-4 focus:border-green-500 focus:bg-white outline-none font-bold text-sm text-slate-700"
                placeholder="••••••••"
                minLength={6}
                disabled={loading}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>

        <p className="mt-6 text-center">
          <Link to="/login/doctor" className="text-slate-500 hover:text-slate-700 text-sm inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Volver al login
          </Link>
        </p>
      </div>
    </div>
  )
}
