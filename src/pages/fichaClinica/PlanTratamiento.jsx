import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useNotifications } from '../../hooks/useNotifications'
import { Plus, Save, X, Loader2, Trash2, Check, Circle } from 'lucide-react'

const PRIORIDAD = {
  1: { label: 'Alta',  color: 'bg-red-100 text-red-700 border-red-200' },
  2: { label: 'Media', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  3: { label: 'Baja',  color: 'bg-slate-100 text-slate-600 border-slate-200' },
}
const ESTADO = {
  pendiente:   { label: 'Pendiente',   color: 'text-amber-600' },
  en_proceso:  { label: 'En proceso',  color: 'text-blue-600' },
  completado:  { label: 'Completado',  color: 'text-green-600' },
}

const EMPTY = { tratamiento: '', numero_diente: '', prioridad: 2, estado: 'pendiente', notas: '' }

export default function PlanTratamiento({ dentalRecordId, clinicaId, isDark }) {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['treatment-plans', dentalRecordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dental_treatment_plans')
        .select('*')
        .eq('dental_record_id', dentalRecordId)
        .order('prioridad')
        .order('orden')
      if (error) throw error
      return data || []
    },
    enabled: !!dentalRecordId,
  })

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dental_treatment_plans').insert({
        dental_record_id: dentalRecordId,
        clinica_id: clinicaId,
        tratamiento: form.tratamiento,
        numero_diente: form.numero_diente ? parseInt(form.numero_diente) : null,
        prioridad: parseInt(form.prioridad),
        estado: form.estado,
        notas: form.notas || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans', dentalRecordId] })
      showSuccess('Item agregado al plan')
      setForm(EMPTY)
      setShowForm(false)
    },
    onError: () => showError('Error al agregar'),
  })

  const updateEstado = useMutation({
    mutationFn: async ({ id, estado }) => {
      const { error } = await supabase
        .from('dental_treatment_plans')
        .update({ estado, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['treatment-plans', dentalRecordId] }),
    onError: () => showError('Error al actualizar'),
  })

  const deleteItem = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('dental_treatment_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans', dentalRecordId] })
      showSuccess('Item eliminado')
    },
    onError: () => showError('Error al eliminar'),
  })

  const cardBase = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const inputBase = `w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
    isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-800'
  }`
  const labelStyle = `block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`

  const pendientes = items.filter(i => i.estado === 'pendiente')
  const enProceso = items.filter(i => i.estado === 'en_proceso')
  const completados = items.filter(i => i.estado === 'completado')

  const renderItem = (item) => (
    <div key={item.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cardBase}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {item.tratamiento}
          </p>
          {item.numero_diente && (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded">
              D.{item.numero_diente}
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${PRIORIDAD[item.prioridad]?.color}`}>
            {PRIORIDAD[item.prioridad]?.label}
          </span>
        </div>
        {item.notas && (
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.notas}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Ciclo de estados */}
        {item.estado === 'pendiente' && (
          <button
            onClick={() => updateEstado.mutate({ id: item.id, estado: 'en_proceso' })}
            title="Marcar en proceso"
            className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
          >
            <Circle size={14} />
          </button>
        )}
        {item.estado === 'en_proceso' && (
          <button
            onClick={() => updateEstado.mutate({ id: item.id, estado: 'completado' })}
            title="Marcar completado"
            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
          >
            <Check size={14} />
          </button>
        )}
        {item.estado === 'completado' && (
          <button
            onClick={() => updateEstado.mutate({ id: item.id, estado: 'pendiente' })}
            title="Reabrir"
            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
          >
            <Check size={14} className="opacity-60" />
          </button>
        )}
        <button
          onClick={() => deleteItem.mutate(item.id)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-black uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Plan de Tratamiento
        </h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <Plus size={13} /> Agregar
          </button>
        )}
      </div>

      {showForm && (
        <div className={`rounded-2xl border p-5 space-y-4 ${cardBase}`}>
          <div>
            <label className={labelStyle}>Tratamiento *</label>
            <input type="text" value={form.tratamiento} onChange={e => set('tratamiento', e.target.value)} placeholder="Ej: Obturación compuesta, Extracción, Implante…" className={inputBase} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelStyle}>Diente (FDI)</label>
              <input type="number" value={form.numero_diente} onChange={e => set('numero_diente', e.target.value)} placeholder="16" className={inputBase} />
            </div>
            <div>
              <label className={labelStyle}>Prioridad</label>
              <select value={form.prioridad} onChange={e => set('prioridad', e.target.value)} className={inputBase}>
                <option value={1}>Alta</option>
                <option value={2}>Media</option>
                <option value={3}>Baja</option>
              </select>
            </div>
            <div>
              <label className={labelStyle}>Estado</label>
              <select value={form.estado} onChange={e => set('estado', e.target.value)} className={inputBase}>
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En proceso</option>
                <option value="completado">Completado</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelStyle}>Notas</label>
            <input type="text" value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Detalles adicionales…" className={inputBase} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => addItem.mutate()}
              disabled={!form.tratamiento || addItem.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {addItem.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Agregar
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border transition-colors ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <X size={14} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-24"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : items.length === 0 ? (
        <div className={`rounded-2xl border p-8 text-center ${cardBase}`}>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sin tratamientos planificados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {enProceso.length > 0 && (
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-2 text-blue-600`}>En proceso ({enProceso.length})</p>
              <div className="space-y-2">{enProceso.map(renderItem)}</div>
            </div>
          )}
          {pendientes.length > 0 && (
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-2 text-amber-600`}>Pendientes ({pendientes.length})</p>
              <div className="space-y-2">{pendientes.map(renderItem)}</div>
            </div>
          )}
          {completados.length > 0 && (
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-2 text-green-600`}>Completados ({completados.length})</p>
              <div className="space-y-2 opacity-70">{completados.map(renderItem)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
