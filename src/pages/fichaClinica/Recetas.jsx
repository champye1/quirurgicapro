import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useNotifications } from '../../hooks/useNotifications'
import { Plus, Save, X, Loader2, Trash2, Pill } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const MEDICAMENTOS_COMUNES = [
  'Amoxicilina 500mg', 'Metronidazol 500mg', 'Clindamicina 300mg',
  'Ibuprofeno 400mg', 'Paracetamol 500mg', 'Ketorolaco 10mg',
  'Dexametasona 0.75mg', 'Tramadol 50mg',
]

const EMPTY = { medicamento: '', dosis: '', frecuencia: '', duracion: '', indicaciones: '' }

export default function Recetas({ dentalRecordId, clinicaId, isDark }) {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const { data: recetas = [], isLoading } = useQuery({
    queryKey: ['dental-prescriptions', dentalRecordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dental_prescriptions')
        .select('*, doctors:doctor_id(nombre, apellido)')
        .eq('dental_record_id', dentalRecordId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!dentalRecordId,
  })

  const addReceta = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: doc } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle()
      const { error } = await supabase.from('dental_prescriptions').insert({
        dental_record_id: dentalRecordId,
        clinica_id: clinicaId,
        doctor_id: doc?.id || null,
        medicamento: form.medicamento,
        dosis: form.dosis || null,
        frecuencia: form.frecuencia || null,
        duracion: form.duracion || null,
        indicaciones: form.indicaciones || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-prescriptions', dentalRecordId] })
      showSuccess('Receta registrada')
      setForm(EMPTY)
      setShowForm(false)
    },
    onError: () => showError('Error al registrar receta'),
  })

  const deleteReceta = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('dental_prescriptions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-prescriptions', dentalRecordId] })
      showSuccess('Receta eliminada')
    },
    onError: () => showError('Error al eliminar'),
  })

  const cardBase = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const inputBase = `w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
    isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-800'
  }`
  const labelStyle = `block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-black uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Recetas / Prescripciones
        </h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <Plus size={13} /> Nueva receta
          </button>
        )}
      </div>

      {showForm && (
        <div className={`rounded-2xl border p-5 space-y-4 ${cardBase}`}>
          <div>
            <label className={labelStyle}>Medicamento *</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {MEDICAMENTOS_COMUNES.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set('medicamento', m)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    form.medicamento === m
                      ? 'bg-blue-600 text-white border-blue-600'
                      : isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input type="text" value={form.medicamento} onChange={e => set('medicamento', e.target.value)} placeholder="O escribe el medicamento…" className={inputBase} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelStyle}>Dosis</label>
              <input type="text" value={form.dosis} onChange={e => set('dosis', e.target.value)} placeholder="500mg" className={inputBase} />
            </div>
            <div>
              <label className={labelStyle}>Frecuencia</label>
              <input type="text" value={form.frecuencia} onChange={e => set('frecuencia', e.target.value)} placeholder="Cada 8 hrs" className={inputBase} />
            </div>
            <div>
              <label className={labelStyle}>Duración</label>
              <input type="text" value={form.duracion} onChange={e => set('duracion', e.target.value)} placeholder="7 días" className={inputBase} />
            </div>
          </div>

          <div>
            <label className={labelStyle}>Indicaciones al paciente</label>
            <textarea value={form.indicaciones} onChange={e => set('indicaciones', e.target.value)} rows={2} placeholder="Tomar con comida, no mezclar con alcohol…" className={`${inputBase} resize-none`} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => addReceta.mutate()}
              disabled={!form.medicamento || addReceta.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {addReceta.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Registrar receta
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border transition-colors ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <X size={14} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-24"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : recetas.length === 0 ? (
        <div className={`rounded-2xl border p-8 text-center ${cardBase}`}>
          <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sin recetas registradas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recetas.map(r => (
            <div key={r.id} className={`rounded-xl border p-4 ${cardBase}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{r.medicamento}</p>
                    {r.dosis && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded">{r.dosis}</span>}
                  </div>
                  <div className={`flex gap-4 mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {r.frecuencia && <span>{r.frecuencia}</span>}
                    {r.duracion && <span>Por {r.duracion}</span>}
                    {r.doctors && <span>Dr. {r.doctors.nombre} {r.doctors.apellido}</span>}
                  </div>
                  {r.indicaciones && (
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.indicaciones}</p>
                  )}
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {format(new Date(r.created_at), 'd MMM yyyy · HH:mm', { locale: es })}
                  </p>
                </div>
                <button
                  onClick={() => deleteReceta.mutate(r.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
