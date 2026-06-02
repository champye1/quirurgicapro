import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, LayoutGrid, CheckCircle2, ChevronRight, Plus, Trash2, Stethoscope } from 'lucide-react'
import { supabase } from '../../config/supabase'
import { useSaveClinicInfo } from '../../hooks/useClinicInfo'
import { useQueryClient } from '@tanstack/react-query'
import { sanitizeString } from '../../utils/sanitizeInput'
import { logger } from '../../utils/logger'
import LoadingSpinner from '../common/LoadingSpinner'

const STEPS = [
  { id: 1, label: 'Tu clínica',  icon: Building2 },
  { id: 2, label: 'Pabellones',  icon: LayoutGrid },
  { id: 3, label: '¡Listo!',     icon: CheckCircle2 },
]

const PABELLON_PLACEHOLDER = ['Pabellón 1', 'Pabellón 2', 'Pabellón 3', 'Pabellón 4']

export default function OnboardingWizard({ onComplete }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const saveClinicInfo = useSaveClinicInfo()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1 — Clinic info
  const [clinicNombre, setClinicNombre] = useState('')
  const [clinicRut, setClinicRut] = useState('')
  const [clinicTelefono, setClinicTelefono] = useState('')
  const [clinicDireccion, setClinicDireccion] = useState('')

  // Step 2 — Pabellones
  const [pabellones, setPabellones] = useState([
    { nombre: '', activo: true },
    { nombre: '', activo: true },
  ])

  const addPabellon = () => {
    if (pabellones.length < 8) setPabellones(p => [...p, { nombre: '', activo: true }])
  }
  const removePabellon = (i) => {
    if (pabellones.length > 1) setPabellones(p => p.filter((_, idx) => idx !== i))
  }
  const updatePabellon = (i, val) => {
    setPabellones(p => p.map((item, idx) => idx === i ? { ...item, nombre: val } : item))
  }

  const handleStep1 = async () => {
    if (!clinicNombre.trim()) return
    setSaving(true)
    try {
      await saveClinicInfo.mutateAsync({
        nombre: sanitizeString(clinicNombre),
        tagline: 'Sistema de Gestión Quirúrgica',
        rut: sanitizeString(clinicRut),
        telefono: sanitizeString(clinicTelefono),
        direccion: sanitizeString(clinicDireccion),
        logo_url: '',
      })
      setStep(2)
    } finally {
      setSaving(false)
    }
  }

  const handleStep2 = async () => {
    const validos = pabellones.filter(p => p.nombre.trim())
    if (!validos.length) { setStep(3); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('operating_rooms').insert(
        validos.map(p => ({ nombre: sanitizeString(p.nombre), activo: true }))
      )
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['pabellones'] })
      setStep(3)
    } catch (e) {
      // Mostrar error pero no bloquear — el usuario puede continuar y agregar pabellones después
      logger.errorWithContext('Error al crear pabellones', e)
      setStep(3)
    } finally {
      setSaving(false)
    }
  }

  const handleFinish = () => {
    localStorage.setItem('onboarding_completed', '1')
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">

        {/* Progress bar */}
        <div className="bg-slate-50 px-8 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done = step > s.id
              const active = step === s.id
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                    done ? 'bg-green-500 text-white' :
                    active ? 'bg-blue-600 text-white' :
                    'bg-slate-200 text-slate-400'
                  }`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wide hidden sm:block ${
                    active ? 'text-blue-600' : done ? 'text-green-600' : 'text-slate-400'
                  }`}>{s.label}</span>
                  {i < STEPS.length - 1 && (
                    <div className={`w-8 sm:w-12 h-0.5 mx-1 transition-all ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Step 1: Clinic Info ── */}
        {step === 1 && (
          <div className="px-8 py-6 space-y-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <Stethoscope className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">¡Bienvenido a QuirúrgicaPro!</h2>
                  <p className="text-xs text-slate-500">Configura tu clínica en 2 minutos</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                  Nombre de la clínica *
                </label>
                <input
                  type="text"
                  value={clinicNombre}
                  onChange={e => setClinicNombre(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Ej: Clínica Quirúrgica Viña del Mar"
                  maxLength={80}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">RUT</label>
                  <input
                    type="text"
                    value={clinicRut}
                    onChange={e => setClinicRut(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="76.543.210-8"
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={clinicTelefono}
                    onChange={e => setClinicTelefono(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="+56 32 234 5678"
                    maxLength={25}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Dirección</label>
                <input
                  type="text"
                  value={clinicDireccion}
                  onChange={e => setClinicDireccion(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Av. Libertad 1234, Viña del Mar"
                  maxLength={120}
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => { localStorage.setItem('onboarding_completed', '1'); onComplete() }}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Omitir configuración
              </button>
              <button
                onClick={handleStep1}
                disabled={!clinicNombre.trim() || saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-black text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <LoadingSpinner size="sm" /> : <>Siguiente <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Pabellones ── */}
        {step === 2 && (
          <div className="px-8 py-6 space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">Configura tus pabellones</h2>
              <p className="text-xs text-slate-500 mt-1">Agrega los pabellones quirúrgicos de tu clínica. Puedes editar esto después.</p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {pabellones.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.nombre}
                    onChange={e => updatePabellon(i, e.target.value)}
                    placeholder={PABELLON_PLACEHOLDER[i] || `Pabellón ${i + 1}`}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    maxLength={60}
                  />
                  {pabellones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePabellon(i)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pabellones.length < 8 && (
              <button
                type="button"
                onClick={addPabellon}
                className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agregar pabellón
              </button>
            )}

            <div className="flex justify-between items-center pt-2">
              <button type="button" onClick={() => setStep(1)} className="text-xs text-slate-400 hover:text-slate-600 font-bold">
                ← Volver
              </button>
              <button
                onClick={handleStep2}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-black text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <LoadingSpinner size="sm" /> : <>Guardar y continuar <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === 3 && (
          <div className="px-8 py-8 text-center space-y-5">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">¡Todo listo!</h2>
              <p className="text-sm text-slate-500 mt-2">
                Tu clínica está configurada. Ahora puedes comenzar a gestionar cirugías.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              {[
                { label: 'Agregar médicos',   path: '/pabellon/medicos',     emoji: '👨‍⚕️' },
                { label: 'Ver solicitudes',   path: '/pabellon/solicitudes', emoji: '📋' },
                { label: 'Abrir calendario',  path: '/pabellon/calendario',  emoji: '📅' },
                { label: 'Cargar insumos',    path: '/pabellon/insumos',     emoji: '📦' },
              ].map(item => (
                <button
                  key={item.path}
                  onClick={() => { handleFinish(); navigate(item.path) }}
                  className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all text-sm font-bold text-slate-700"
                >
                  <span className="text-lg">{item.emoji}</span>
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-3 bg-slate-900 text-white font-black text-sm rounded-xl hover:bg-slate-800 transition-colors"
            >
              Ir al Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
