import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../config/supabase'
import { Eye, EyeOff, KeyRound, User, CheckCircle2, ShieldCheck, ShieldOff, Smartphone, Download, BookOpen } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { useTheme } from '../contexts/ThemeContext'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { exportManualPDF } from '../utils/exportData'

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
  const queryClient = useQueryClient()

  // ── Contraseña ──────────────────────────────────────────────────────────
  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [showNueva, setShowNueva] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [loadingPwd, setLoadingPwd] = useState(false)
  const [exitoPwd, setExitoPwd] = useState(false)
  const [erroresPwd, setErroresPwd] = useState({})

  // ── 2FA ─────────────────────────────────────────────────────────────────
  const [mfaStep, setMfaStep] = useState('idle') // idle | enrolling | verifying
  const [qrUri, setQrUri] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaChallengeId, setMfaChallengeId] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)

  // ── Manual ───────────────────────────────────────────────────────────────
  const [exportandoManual, setExportandoManual] = useState(false)

  const { data: user } = useQuery({
    queryKey: ['auth-user-perfil'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    },
  })

  const { data: mfaFactors, isLoading: loadingFactors } = useQuery({
    queryKey: ['mfa-factors'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      return data?.totp || []
    },
  })

  const mfaActivo = mfaFactors?.some(f => f.status === 'verified') ?? false
  const factorVerificado = mfaFactors?.find(f => f.status === 'verified')

  // ── Mutación desactivar 2FA ──────────────────────────────────────────────
  const desactivarMfa = useMutation({
    mutationFn: async () => {
      if (!factorVerificado) throw new Error('No hay factor activo')
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factorVerificado.id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfa-factors'] })
      showSuccess('Doble autenticación desactivada')
      setMfaStep('idle')
    },
    onError: (err) => showError(`Error al desactivar 2FA: ${err.message}`),
  })

  // ── Contraseña ──────────────────────────────────────────────────────────
  const validarPwd = () => {
    const e = {}
    if (!form.actual) e.actual = 'Ingrese su contraseña actual'
    if (!form.nueva) e.nueva = 'Ingrese la nueva contraseña'
    else if (form.nueva.length < 8) e.nueva = 'Mínimo 8 caracteres'
    else if (form.actual && form.nueva === form.actual) e.nueva = 'La nueva contraseña debe ser diferente a la actual'
    if (!form.confirmar) e.confirmar = 'Confirme la contraseña'
    else if (form.nueva !== form.confirmar) e.confirmar = 'Las contraseñas no coinciden'
    setErroresPwd(e)
    return Object.keys(e).length === 0
  }

  const handleSubmitPwd = async (e) => {
    e.preventDefault()
    if (!validarPwd()) return
    setLoadingPwd(true)
    setExitoPwd(false)
    try {
      // Re-autenticar con la contraseña actual antes de cambiarla
      const { data: userData } = await supabase.auth.getUser()
      const userEmail = userData?.user?.email
      if (!userEmail) throw new Error('No se pudo obtener el email del usuario')

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: form.actual,
      })
      if (signInErr) {
        throw new Error('La contraseña actual es incorrecta')
      }

      const { error } = await supabase.auth.updateUser({ password: form.nueva })
      if (error) throw error
      setExitoPwd(true)
      setForm({ actual: '', nueva: '', confirmar: '' })
      showSuccess('Contraseña actualizada exitosamente')
    } catch (err) {
      showError(`Error al cambiar contraseña: ${err.message}`)
    } finally {
      setLoadingPwd(false)
    }
  }

  // ── 2FA handlers ────────────────────────────────────────────────────────
  const iniciarEnroll = async () => {
    setMfaLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'ClínicaQx' })
      if (error) throw error
      setQrUri(data.totp.qr_code)
      setMfaSecret(data.totp.secret)
      setMfaFactorId(data.id)
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: data.id })
      if (challengeErr) throw challengeErr
      setMfaChallengeId(challenge.id)
      setMfaStep('enrolling')
    } catch (err) {
      showError(`Error al iniciar 2FA: ${err.message}`)
    } finally {
      setMfaLoading(false)
    }
  }

  const verificarCodigo = async () => {
    if (mfaCode.length !== 6) { showError('El código debe tener 6 dígitos'); return }
    setMfaLoading(true)
    try {
      const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: mfaChallengeId, code: mfaCode })
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['mfa-factors'] })
      showSuccess('Doble autenticación activada correctamente')
      setMfaStep('idle')
      setMfaCode('')
    } catch (err) {
      showError('Código incorrecto. Verifica tu aplicación autenticadora.')
    } finally {
      setMfaLoading(false)
    }
  }

  const cancelarEnroll = async () => {
    if (mfaFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: mfaFactorId }).catch(() => {})
    }
    setMfaStep('idle')
    setMfaCode('')
    setQrUri('')
    setMfaSecret('')
    setMfaFactorId('')
    setMfaChallengeId('')
  }

  const isDark = theme === 'dark'
  const inputCls = `input-field ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : ''}`
  const labelCls = `label-field ${isDark ? 'text-slate-400' : ''}`
  const strength = getPasswordStrength(form.nueva)
  const cardCls = `card ${isDark ? 'bg-slate-800 border-slate-700' : ''}`

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Mi Perfil</h1>
        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Gestiona tu cuenta y seguridad</p>
      </div>

      {/* Cuenta */}
      <div className={cardCls}>
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
      <div className={cardCls}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
            <KeyRound className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
          </div>
          <div>
            <h2 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>Cambiar Contraseña</h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Usa una contraseña fuerte de al menos 8 caracteres</p>
          </div>
        </div>

        {exitoPwd && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm font-bold text-green-800">Contraseña actualizada correctamente</p>
          </div>
        )}

        <form onSubmit={handleSubmitPwd} className="space-y-4" noValidate>
          <div>
            <label className={labelCls}>Contraseña actual</label>
            <input
              type="password"
              value={form.actual}
              onChange={e => { setForm(f => ({ ...f, actual: e.target.value })); setErroresPwd(er => ({ ...er, actual: '' })) }}
              className={inputCls}
              placeholder="Tu contraseña actual"
              autoComplete="current-password"
            />
            {erroresPwd.actual && <p className="mt-1 text-xs text-red-600">{erroresPwd.actual}</p>}
          </div>

          <div>
            <label className={labelCls}>Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNueva ? 'text' : 'password'}
                value={form.nueva}
                onChange={e => { setForm(f => ({ ...f, nueva: e.target.value })); setErroresPwd(er => ({ ...er, nueva: '' })) }}
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
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.level ? strength.color : (isDark ? 'bg-slate-600' : 'bg-slate-200')}`} />
                  ))}
                </div>
                <p className={`text-[11px] font-bold ${strength.text}`}>{strength.label}</p>
              </div>
            )}
            {erroresPwd.nueva && <p className="mt-1 text-xs text-red-600">{erroresPwd.nueva}</p>}
          </div>

          <div>
            <label className={labelCls}>Confirmar nueva contraseña</label>
            <div className="relative">
              <input
                type={showConfirmar ? 'text' : 'password'}
                value={form.confirmar}
                onChange={e => { setForm(f => ({ ...f, confirmar: e.target.value })); setErroresPwd(er => ({ ...er, confirmar: '' })) }}
                className={`${inputCls} pr-12`}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConfirmar(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {erroresPwd.confirmar && <p className="mt-1 text-xs text-red-600">{erroresPwd.confirmar}</p>}
          </div>

          <button type="submit" disabled={loadingPwd} className="btn-primary w-full flex items-center justify-center gap-2">
            {loadingPwd ? <><LoadingSpinner size="sm" /> Actualizando...</> : 'Actualizar contraseña'}
          </button>
        </form>
      </div>

      {/* 2FA */}
      <div className={cardCls}>
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mfaActivo ? (isDark ? 'bg-green-900/50' : 'bg-green-100') : (isDark ? 'bg-slate-700' : 'bg-slate-100')}`}>
            {mfaActivo
              ? <ShieldCheck className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              : <ShieldOff className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            }
          </div>
          <div>
            <h2 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>Doble Factor de Autenticación (2FA)</h2>
            <p className={`text-xs ${mfaActivo ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
              {loadingFactors ? 'Verificando...' : mfaActivo ? 'Activado — tu cuenta está protegida' : 'Desactivado — recomendamos activarlo'}
            </p>
          </div>
        </div>

        {mfaStep === 'idle' && (
          <>
            {mfaActivo ? (
              <div className="space-y-3">
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${isDark ? 'bg-green-900/20 border border-green-800 text-green-300' : 'bg-green-50 border border-green-200 text-green-800'}`}>
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="font-medium">El 2FA está activo. Se pedirá un código de 6 dígitos en cada inicio de sesión.</span>
                </div>
                <button
                  onClick={() => desactivarMfa.mutate()}
                  disabled={desactivarMfa.isPending}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-colors ${
                    isDark
                      ? 'border-red-800 text-red-400 hover:bg-red-900/20'
                      : 'border-red-200 text-red-600 hover:bg-red-50'
                  } disabled:opacity-50`}
                >
                  {desactivarMfa.isPending ? <><LoadingSpinner size="sm" />Desactivando...</> : <><ShieldOff className="w-4 h-4" />Desactivar 2FA</>}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  El 2FA agrega una capa extra de seguridad. Necesitarás una aplicación autenticadora como <strong>Google Authenticator</strong> o <strong>Authy</strong>.
                </p>
                <button
                  onClick={iniciarEnroll}
                  disabled={mfaLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {mfaLoading ? <><LoadingSpinner size="sm" />Iniciando...</> : <><Smartphone className="w-4 h-4" />Activar 2FA</>}
                </button>
              </div>
            )}
          </>
        )}

        {mfaStep === 'enrolling' && (
          <div className="space-y-5">
            <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Escanea el código QR con tu aplicación autenticadora:
            </p>

            {qrUri && (
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-200">
                  <img src={qrUri} alt="QR Code 2FA" className="w-44 h-44" />
                </div>
              </div>
            )}

            <div className={`rounded-xl px-4 py-3 text-xs font-mono break-all ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Clave manual (si no puedes escanear)</p>
              {mfaSecret}
            </div>

            <div>
              <label className={`${labelCls} mb-2`}>Ingresa el código de 6 dígitos de tu app para confirmar</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={`${inputCls} text-center text-xl tracking-[0.5em] font-mono`}
                placeholder="000000"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={verificarCodigo}
                disabled={mfaLoading || mfaCode.length !== 6}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {mfaLoading ? <><LoadingSpinner size="sm" />Verificando...</> : <><CheckCircle2 className="w-4 h-4" />Confirmar</>}
              </button>
              <button onClick={cancelarEnroll} disabled={mfaLoading} className="btn-secondary flex-1">Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* Manual de usuario */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-blue-50'}`}>
              <BookOpen className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h2 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>Manual de Usuario</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Guía completa del sistema en PDF</p>
            </div>
          </div>
          <button
            onClick={async () => {
              setExportandoManual(true)
              try { await exportManualPDF() }
              finally { setExportandoManual(false) }
            }}
            disabled={exportandoManual}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${
              isDark
                ? 'border-blue-700 text-blue-400 hover:bg-blue-900/20'
                : 'border-blue-200 text-blue-700 hover:bg-blue-50'
            } disabled:opacity-50`}
          >
            {exportandoManual ? <><LoadingSpinner size="sm" />Generando...</> : <><Download className="w-4 h-4" />Descargar</>}
          </button>
        </div>
      </div>
    </div>
  )
}
