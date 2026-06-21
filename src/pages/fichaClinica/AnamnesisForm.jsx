import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useNotifications } from '../../hooks/useNotifications'
import { Save, AlertTriangle, Loader2 } from 'lucide-react'

const ENFERMEDADES_COMUNES = [
  'Diabetes', 'Hipertensión', 'Cardiopatía', 'Asma / EPOC',
  'Trastornos de coagulación', 'VIH / inmunosupresión', 'Cáncer / quimioterapia',
  'Epilepsia', 'Osteoporosis', 'Enfermedad renal', 'Hepatitis',
]

const HABITOS_OPCIONES = [
  'Tabaco', 'Alcohol', 'Bruxismo (rechinar dientes)',
  'Onicofagia (comerse las uñas)', 'Respirador bucal',
]

export default function AnamnesisForm({ dentalRecordId, clinicaId, isDark }) {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()

  const [form, setForm] = useState({
    enfermedades: '',
    medicamentos_actuales: '',
    alergias: '',
    alergia_anestesia: false,
    habitos: '',
    embarazo: false,
    motivo_consulta: '',
    experiencias_previas: '',
    habitos_higiene: '',
    observaciones: '',
  })

  const { data: existing, isLoading } = useQuery({
    queryKey: ['dental-anamnesis', dentalRecordId],
    queryFn: async () => {
      const { data } = await supabase
        .from('dental_anamnesis')
        .select('*')
        .eq('dental_record_id', dentalRecordId)
        .maybeSingle()
      return data
    },
    enabled: !!dentalRecordId,
  })

  useEffect(() => {
    if (existing) {
      setForm({
        enfermedades: existing.enfermedades || '',
        medicamentos_actuales: existing.medicamentos_actuales || '',
        alergias: existing.alergias || '',
        alergia_anestesia: existing.alergia_anestesia || false,
        habitos: existing.habitos || '',
        embarazo: existing.embarazo || false,
        motivo_consulta: existing.motivo_consulta || '',
        experiencias_previas: existing.experiencias_previas || '',
        habitos_higiene: existing.habitos_higiene || '',
        observaciones: existing.observaciones || '',
      })
    }
  }, [existing])

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, dental_record_id: dentalRecordId, clinica_id: clinicaId, updated_at: new Date().toISOString() }
      if (existing?.id) {
        const { error } = await supabase.from('dental_anamnesis').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('dental_anamnesis').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-anamnesis', dentalRecordId] })
      queryClient.invalidateQueries({ queryKey: ['dental-anamnesis-alert'] })
      showSuccess('Anamnesis guardada')
    },
    onError: () => showError('Error al guardar la anamnesis'),
  })

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const cardBase = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const inputBase = `w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${
    isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
  }`
  const labelStyle = `block text-xs font-black uppercase tracking-widest mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const sectionTitle = `text-sm font-black uppercase tracking-wide mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Alerta de alergia */}
      {form.alergia_anestesia && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border-2 border-red-300 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-red-700">ALERGIA A ANESTESIA REGISTRADA</p>
            {form.alergias && <p className="text-xs text-red-600 mt-0.5">{form.alergias}</p>}
          </div>
        </div>
      )}

      {/* Antecedentes médicos */}
      <div className={`rounded-2xl border p-5 ${cardBase}`}>
        <h3 className={sectionTitle}>Antecedentes Médicos</h3>
        <div className="space-y-4">
          <div>
            <label className={labelStyle}>Enfermedades sistémicas</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {ENFERMEDADES_COMUNES.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    const list = form.enfermedades.split(',').map(s => s.trim()).filter(Boolean)
                    const idx = list.indexOf(e)
                    if (idx >= 0) list.splice(idx, 1)
                    else list.push(e)
                    set('enfermedades', list.join(', '))
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    form.enfermedades.includes(e)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : isDark
                        ? 'bg-slate-700 text-slate-300 border-slate-600 hover:border-blue-500'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-400'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={form.enfermedades}
              onChange={e => set('enfermedades', e.target.value)}
              placeholder="Otras enfermedades o detalles adicionales…"
              className={inputBase}
            />
          </div>

          <div>
            <label className={labelStyle}>Medicamentos actuales</label>
            <textarea
              value={form.medicamentos_actuales}
              onChange={e => set('medicamentos_actuales', e.target.value)}
              placeholder="Nombre del medicamento, dosis, frecuencia…"
              rows={2}
              className={`${inputBase} resize-none`}
            />
          </div>

          <div>
            <label className={labelStyle}>Alergias conocidas</label>
            <textarea
              value={form.alergias}
              onChange={e => set('alergias', e.target.value)}
              placeholder="Medicamentos, materiales, látex, otros…"
              rows={2}
              className={`${inputBase} resize-none`}
            />
          </div>

          {/* Alerta alergia anestesia */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
            form.alergia_anestesia
              ? 'border-red-400 bg-red-50'
              : isDark ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-slate-50'
          }`}>
            <input
              type="checkbox"
              id="alergia_anestesia"
              checked={form.alergia_anestesia}
              onChange={e => set('alergia_anestesia', e.target.checked)}
              className="w-4 h-4 accent-red-600"
            />
            <label htmlFor="alergia_anestesia" className={`text-sm font-bold cursor-pointer ${form.alergia_anestesia ? 'text-red-700' : isDark ? 'text-white' : 'text-slate-800'}`}>
              ⚠ Alergia a anestésicos (aparecerá como alerta prominente en toda la ficha)
            </label>
          </div>

          <div>
            <label className={labelStyle}>Hábitos</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {HABITOS_OPCIONES.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    const list = form.habitos.split(',').map(s => s.trim()).filter(Boolean)
                    const idx = list.indexOf(h)
                    if (idx >= 0) list.splice(idx, 1)
                    else list.push(h)
                    set('habitos', list.join(', '))
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    form.habitos.includes(h)
                      ? 'bg-amber-500 text-white border-amber-500'
                      : isDark
                        ? 'bg-slate-700 text-slate-300 border-slate-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
            <input
              type="checkbox"
              id="embarazo"
              checked={form.embarazo}
              onChange={e => set('embarazo', e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <label htmlFor="embarazo" className={`text-sm font-medium cursor-pointer ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Paciente embarazada
            </label>
          </div>
        </div>
      </div>

      {/* Antecedentes dentales */}
      <div className={`rounded-2xl border p-5 ${cardBase}`}>
        <h3 className={sectionTitle}>Antecedentes Dentales</h3>
        <div className="space-y-4">
          <div>
            <label className={labelStyle}>Motivo de consulta</label>
            <textarea
              value={form.motivo_consulta}
              onChange={e => set('motivo_consulta', e.target.value)}
              placeholder="¿Por qué consulta el paciente hoy?"
              rows={2}
              className={`${inputBase} resize-none`}
            />
          </div>

          <div>
            <label className={labelStyle}>Experiencias previas con dentista</label>
            <textarea
              value={form.experiencias_previas}
              onChange={e => set('experiencias_previas', e.target.value)}
              placeholder="Tratamientos anteriores, experiencias traumáticas, fobias dentales…"
              rows={2}
              className={`${inputBase} resize-none`}
            />
          </div>

          <div>
            <label className={labelStyle}>Hábitos de higiene oral</label>
            <input
              type="text"
              value={form.habitos_higiene}
              onChange={e => set('habitos_higiene', e.target.value)}
              placeholder="Frecuencia de cepillado, uso de hilo dental, enjuague…"
              className={inputBase}
            />
          </div>

          <div>
            <label className={labelStyle}>Observaciones generales</label>
            <textarea
              value={form.observaciones}
              onChange={e => set('observaciones', e.target.value)}
              placeholder="Cualquier información adicional relevante…"
              rows={3}
              className={`${inputBase} resize-none`}
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
      >
        {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Guardar Anamnesis
      </button>
    </div>
  )
}
