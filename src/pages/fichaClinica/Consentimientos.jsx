import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useNotifications } from '../../hooks/useNotifications'
import { Plus, Save, X, Loader2, Trash2, FileCheck, CheckCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const PROCEDIMIENTOS_COMUNES = [
  'Extracción dental', 'Implante dental', 'Cirugía oral', 'Endodoncia',
  'Ortodoncia', 'Injerto óseo', 'Elevación de seno maxilar', 'Blanqueamiento dental',
  'Cirugía periodontal', 'Anestesia general / sedación',
]

const EMPTY = { tipo_procedimiento: '', firmado_por: '', observaciones: '' }

export default function Consentimientos({ dentalRecordId, clinicaId, isDark }) {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const { data: consentimientos = [], isLoading } = useQuery({
    queryKey: ['dental-consents', dentalRecordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dental_consents')
        .select('*')
        .eq('dental_record_id', dentalRecordId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!dentalRecordId,
  })

  const addConsentimiento = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dental_consents').insert({
        dental_record_id: dentalRecordId,
        clinica_id: clinicaId,
        tipo_procedimiento: form.tipo_procedimiento,
        firmado_por: form.firmado_por || null,
        firmado_en: form.firmado_por ? new Date().toISOString() : null,
        observaciones: form.observaciones || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-consents', dentalRecordId] })
      showSuccess('Consentimiento registrado')
      setForm(EMPTY)
      setShowForm(false)
    },
    onError: () => showError('Error al registrar'),
  })

  const firmar = useMutation({
    mutationFn: async ({ id, firmado_por }) => {
      const { error } = await supabase.from('dental_consents').update({
        firmado_por,
        firmado_en: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-consents', dentalRecordId] })
      showSuccess('Consentimiento firmado')
    },
    onError: () => showError('Error al actualizar'),
  })

  const deleteConsentimiento = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('dental_consents').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-consents', dentalRecordId] })
      showSuccess('Eliminado')
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
        <div>
          <h3 className={`text-sm font-black uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Consentimientos Informados
          </h3>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Requerido por Ley 20.584 art. 14 — derecho a ser informado
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <Plus size={13} /> Nuevo
          </button>
        )}
      </div>

      {showForm && (
        <div className={`rounded-2xl border p-5 space-y-4 ${cardBase}`}>
          <div>
            <label className={labelStyle}>Procedimiento *</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PROCEDIMIENTOS_COMUNES.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('tipo_procedimiento', p)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    form.tipo_procedimiento === p
                      ? 'bg-blue-600 text-white border-blue-600'
                      : isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input type="text" value={form.tipo_procedimiento} onChange={e => set('tipo_procedimiento', e.target.value)} placeholder="O escribe el procedimiento…" className={inputBase} />
          </div>

          <div>
            <label className={labelStyle}>Firmado por (nombre del paciente o tutor)</label>
            <input type="text" value={form.firmado_por} onChange={e => set('firmado_por', e.target.value)} placeholder="Dejar vacío si aún no está firmado" className={inputBase} />
          </div>

          <div>
            <label className={labelStyle}>Observaciones</label>
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2} placeholder="Notas adicionales sobre el consentimiento…" className={`${inputBase} resize-none`} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => addConsentimiento.mutate()}
              disabled={!form.tipo_procedimiento || addConsentimiento.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {addConsentimiento.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Registrar
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border transition-colors ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <X size={14} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-24"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : consentimientos.length === 0 ? (
        <div className={`rounded-2xl border p-8 text-center ${cardBase}`}>
          <FileCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sin consentimientos registrados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {consentimientos.map(c => (
            <div key={c.id} className={`rounded-xl border p-4 ${cardBase}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${c.firmado_en ? 'bg-green-100' : 'bg-amber-100'}`}>
                    {c.firmado_en
                      ? <CheckCircle size={16} className="text-green-600" />
                      : <Clock size={16} className="text-amber-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {c.tipo_procedimiento}
                    </p>
                    {c.firmado_en ? (
                      <p className={`text-xs mt-0.5 text-green-600 font-medium`}>
                        Firmado por {c.firmado_por} · {format(new Date(c.firmado_en), 'd MMM yyyy · HH:mm', { locale: es })}
                      </p>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-amber-600 font-medium">Pendiente de firma</span>
                        <button
                          onClick={() => {
                            const nombre = window.prompt('Nombre del paciente o tutor:')
                            if (nombre) firmar.mutate({ id: c.id, firmado_por: nombre })
                          }}
                          className="text-xs px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                        >
                          Marcar como firmado
                        </button>
                      </div>
                    )}
                    {c.observaciones && (
                      <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{c.observaciones}</p>
                    )}
                    <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Registrado {format(new Date(c.created_at), 'd MMM yyyy', { locale: es })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteConsentimiento.mutate(c.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors shrink-0"
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
