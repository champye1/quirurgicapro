import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useNotifications } from '../../hooks/useNotifications'
import { Plus, Calendar, Stethoscope, X, Save, Loader2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const EMPTY_FORM = {
  fecha: new Date().toISOString().split('T')[0],
  hora: '',
  motivo: '',
  procedimiento_realizado: '',
  dientes_tratados: '',
  anestesia_tipo: '',
  anestesia_cantidad: '',
  materiales_usados: '',
  observaciones: '',
  proxima_cita: '',
}

function VisitaForm({ onSave, onCancel, isDark, loading }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const inputBase = `w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
    isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-800'
  }`
  const labelStyle = `block text-xs font-bold uppercase tracking-wide mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <h4 className={`text-sm font-black uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>Nueva Visita</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelStyle}>Fecha *</label>
          <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className={inputBase} />
        </div>
        <div>
          <label className={labelStyle}>Hora</label>
          <input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} className={inputBase} />
        </div>
      </div>

      <div>
        <label className={labelStyle}>Motivo de la visita</label>
        <input type="text" value={form.motivo} onChange={e => set('motivo', e.target.value)} placeholder="Control, urgencia, tratamiento…" className={inputBase} />
      </div>

      <div>
        <label className={labelStyle}>Procedimiento realizado</label>
        <textarea value={form.procedimiento_realizado} onChange={e => set('procedimiento_realizado', e.target.value)} rows={2} placeholder="Describe el procedimiento…" className={`${inputBase} resize-none`} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelStyle}>Dientes tratados (Ej: 16, 17)</label>
          <input type="text" value={form.dientes_tratados} onChange={e => set('dientes_tratados', e.target.value)} placeholder="16, 17, 26…" className={inputBase} />
        </div>
        <div>
          <label className={labelStyle}>Próxima cita</label>
          <input type="date" value={form.proxima_cita} onChange={e => set('proxima_cita', e.target.value)} className={inputBase} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelStyle}>Anestesia tipo</label>
          <input type="text" value={form.anestesia_tipo} onChange={e => set('anestesia_tipo', e.target.value)} placeholder="Lidocaína, Articaína…" className={inputBase} />
        </div>
        <div>
          <label className={labelStyle}>Cantidad / cartuchos</label>
          <input type="text" value={form.anestesia_cantidad} onChange={e => set('anestesia_cantidad', e.target.value)} placeholder="1 cartucho, 1.8ml…" className={inputBase} />
        </div>
      </div>

      <div>
        <label className={labelStyle}>Materiales utilizados</label>
        <input type="text" value={form.materiales_usados} onChange={e => set('materiales_usados', e.target.value)} placeholder="Composite, amalgama, cemento de vidrio ionómero…" className={inputBase} />
      </div>

      <div>
        <label className={labelStyle}>Observaciones</label>
        <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2} placeholder="Notas clínicas, indicaciones al paciente…" className={`${inputBase} resize-none`} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(form)}
          disabled={!form.fecha || loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Registrar visita
        </button>
        <button onClick={onCancel} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border transition-colors ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <X size={14} /> Cancelar
        </button>
      </div>
    </div>
  )
}

function VisitaCard({ visita, isDark, onDelete }) {
  const [open, setOpen] = useState(false)
  const cardBase = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const metaStyle = `text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`

  return (
    <div className={`rounded-xl border transition-all ${cardBase}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Calendar size={14} className="text-blue-600" />
          </div>
          <div>
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {visita.fecha ? format(new Date(visita.fecha + 'T12:00:00'), 'd MMMM yyyy', { locale: es }) : '—'}
              {visita.hora && ` · ${visita.hora.slice(0, 5)}`}
            </p>
            {visita.motivo && <p className={metaStyle}>{visita.motivo}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onDelete(visita.id) }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Eliminar visita"
          >
            <Trash2 size={13} />
          </button>
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className={`px-4 pb-4 pt-1 border-t space-y-3 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          {visita.procedimiento_realizado && (
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Procedimiento</p>
              <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{visita.procedimiento_realizado}</p>
            </div>
          )}
          {visita.dientes_tratados?.length > 0 && (
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Dientes tratados</p>
              <div className="flex flex-wrap gap-1">
                {visita.dientes_tratados.map(d => (
                  <span key={d} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg">{d}</span>
                ))}
              </div>
            </div>
          )}
          {(visita.anestesia_tipo || visita.anestesia_cantidad) && (
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Anestesia</p>
              <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {[visita.anestesia_tipo, visita.anestesia_cantidad].filter(Boolean).join(' — ')}
              </p>
            </div>
          )}
          {visita.materiales_usados && (
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Materiales</p>
              <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{visita.materiales_usados}</p>
            </div>
          )}
          {visita.observaciones && (
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Observaciones</p>
              <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{visita.observaciones}</p>
            </div>
          )}
          {visita.proxima_cita && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-blue-50'}`}>
              <Calendar size={13} className="text-blue-500" />
              <p className={`text-xs font-bold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                Próxima cita: {format(new Date(visita.proxima_cita + 'T12:00:00'), 'd MMM yyyy', { locale: es })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function VisitasTimeline({ dentalRecordId, clinicaId, isDark }) {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()
  const [showForm, setShowForm] = useState(false)

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ['dental-visits', dentalRecordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dental_visits')
        .select('id, fecha, hora, motivo, procedimiento_realizado, dientes_tratados, anestesia_tipo, anestesia_cantidad, materiales_usados, observaciones, proxima_cita, doctors:doctor_id(nombre, apellido)')
        .eq('dental_record_id', dentalRecordId)
        .order('fecha', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!dentalRecordId,
  })

  const addVisita = useMutation({
    mutationFn: async (form) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: doc } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle()

      const dientes = form.dientes_tratados
        ? form.dientes_tratados.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        : []

      const { error } = await supabase.from('dental_visits').insert({
        dental_record_id: dentalRecordId,
        clinica_id: clinicaId,
        doctor_id: doc?.id || null,
        fecha: form.fecha,
        hora: form.hora || null,
        motivo: form.motivo || null,
        procedimiento_realizado: form.procedimiento_realizado || null,
        dientes_tratados: dientes.length > 0 ? dientes : null,
        anestesia_tipo: form.anestesia_tipo || null,
        anestesia_cantidad: form.anestesia_cantidad || null,
        materiales_usados: form.materiales_usados || null,
        observaciones: form.observaciones || null,
        proxima_cita: form.proxima_cita || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-visits', dentalRecordId] })
      showSuccess('Visita registrada')
      setShowForm(false)
    },
    onError: () => showError('Error al registrar la visita'),
  })

  const deleteVisita = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('dental_visits').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-visits', dentalRecordId] })
      showSuccess('Visita eliminada')
    },
    onError: () => showError('Error al eliminar'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-black uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Visitas / Evoluciones
          </h3>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {visitas.length} visita{visitas.length !== 1 ? 's' : ''} registrada{visitas.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <Plus size={13} /> Nueva visita
          </button>
        )}
      </div>

      {showForm && (
        <VisitaForm
          isDark={isDark}
          loading={addVisita.isPending}
          onSave={(form) => addVisita.mutate(form)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : visitas.length === 0 ? (
        <div className={`rounded-2xl border p-8 text-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sin visitas registradas.</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Registra la primera visita con el botón de arriba.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visitas.map(v => (
            <VisitaCard
              key={v.id}
              visita={v}
              isDark={isDark}
              onDelete={(id) => deleteVisita.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
