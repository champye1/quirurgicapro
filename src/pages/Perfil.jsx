import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../config/supabase'
import { Eye, EyeOff, KeyRound, User, CheckCircle2 } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { useTheme } from '../contexts/ThemeContext'

function getPasswordStrength(pwd) {
  if (!pwd) return { level: 0, label: '', color: '' }
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (score <= 1) return { level: 1, label: 'Débil', color: 'bg-red-500', text: 'text-red-600' }
  if (score <= 3) return { level: 2, label: 'Media', color: 'bg-yellow-500', text: 'text-yellow-600' }
  return { level: 3, label: 'Fuerte', color: 'bg-green-500', text: 'text-green-600' }
}

export default function Perfil() {
  const { theme } = useTheme()
  const { showSuccess, showError } = useNotifications()

  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [showNueva, setShowNueva] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exito, setExito] = useState(false)
  const [errores, setErrores] = useState({})

  const { data: user } = useQuery({
    queryKey: ['auth-user-perfil'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    },
  })

  const validar = () => {
    const e = {}
    if (!form.nueva) e.nueva = 'Ingrese la nueva contraseña'
    else if (form.nueva.length < 8) e.nueva = 'Mínimo 8 caracteres'
    if (!form.confirmar) e.confirmar = 'Confirme la contraseña'
    else if (form.nueva !== form.confirmar) e.confirmar = 'Las contraseñas no coinciden'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validar()) return
    setLoading(true)
    setExito(false)
    try {
      const { error } = await supabase.auth.updateUser({ password: form.nueva })
      if (error) throw error
      setExito(true)
      setForm({ actual: '', nueva: '', confirmar: '' })
      showSuccess('Contraseña actualizada exitosamente')
    } catch (err) {
      showError(`Error al cambiar contraseña: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const isDark = theme === 'dark'
  const inputCls = `input-field ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : ''}`
  const labelCls = `label-field ${isDark ? 'text-slate-400' : ''}`
  const strength = getPasswordStrength(form.nueva)

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Mi Perfil</h1>
        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Gestiona tu cuenta y seguridad</p>
      </div>

      {/* Información de cuenta */}
      <div className={`card ${isDark ? 'bg-slate-800 border-slate-700' : ''}`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-blue-50'}`}>
            <User className={`w-7 h-7 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <p className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Correo electrónico</p>
            <p className={`font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{user?.email || '—'}</p>
          </div>
        </div>
      </div>

      {/* Cambiar contraseña */}
      <div className={`card ${isDark ? 'bg-slate-800 border-slate-700' : ''}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
            <KeyRound className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
          </div>
          <div>
            <h2 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>Cambiar Contraseña</h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Usa una contraseña fuerte de al menos 8 caracteres</p>
          </div>
        </div>

        {exito && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm font-bold text-green-800">Contraseña actualizada correctamente</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className={labelCls}>Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNueva ? 'text' : 'password'}
                value={form.nueva}
                onChange={e => { setForm(f => ({ ...f, nueva: e.target.value })); setErrores(er => ({ ...er, nueva: '' })) }}
                className={`${inputCls} pr-12`}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowNueva(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.nueva && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.level ? strength.color : (isDark ? 'bg-slate-600' : 'bg-slate-200')}`}
                    />
                  ))}
                </div>
                <p className={`text-[11px] font-bold ${strength.text}`}>{strength.label}</p>
              </div>
            )}
            {errores.nueva && <p className="mt-1 text-xs text-red-600">{errores.nueva}</p>}
          </div>

          <div>
            <label className={labelCls}>Confirmar nueva contraseña</label>
            <div className="relative">
              <input
                type={showConfirmar ? 'text' : 'password'}
                value={form.confirmar}
                onChange={e => { setForm(f => ({ ...f, confirmar: e.target.value })); setErrores(er => ({ ...er, confirmar: '' })) }}
                className={`${inputCls} pr-12`}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConfirmar(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errores.confirmar && <p className="mt-1 text-xs text-red-600">{errores.confirmar}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
