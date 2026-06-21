import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useNotifications } from '../../hooks/useNotifications'
import { Save, Loader2, Activity } from 'lucide-react'

const SEXTANTES = [
  { label: 'Sup. Derecho', dientes: [18, 17, 16] },
  { label: 'Sup. Anterior', dientes: [15, 14, 13, 12, 11, 21, 22, 23, 24, 25] },
  { label: 'Sup. Izquierdo', dientes: [26, 27, 28] },
  { label: 'Inf. Izquierdo', dientes: [31, 32, 33, 34, 35] },
  { label: 'Inf. Anterior', dientes: [36, 37, 38, 41, 42, 43] },
  { label: 'Inf. Derecho', dientes: [44, 45, 46, 47, 48] },
]

const PUNTOS = ['MB', 'B', 'DB', 'ML', 'L', 'DL']

function SondajeCell({ value, onChange, isDark }) {
  const num = parseInt(value)
  const color = num >= 6 ? 'text-red-600 font-black' : num >= 4 ? 'text-amber-600 font-bold' : isDark ? 'text-slate-200' : 'text-slate-700'
  return (
    <input
      type="number"
      min="0"
      max="12"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-8 text-center text-xs py-0.5 border rounded focus:ring-1 focus:ring-blue-500 outline-none ${color} ${
        isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'
      }`}
    />
  )
}

export default function Periodontograma({ dentalRecordId, clinicaId, isDark }) {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()

  const { data: visitas = [] } = useQuery({
    queryKey: ['dental-visits-select', dentalRecordId],
    queryFn: async () => {
      const { data } = await supabase
        .from('dental_visits')
        .select('id, fecha, motivo')
        .eq('dental_record_id', dentalRecordId)
        .order('fecha', { ascending: false })
      return data || []
    },
    enabled: !!dentalRecordId,
  })

  const [selectedVisita, setSelectedVisita] = useState(null)
  const [perioData, setPerioData] = useState({})

  const { data: existing = [], isLoading } = useQuery({
    queryKey: ['periodontal-records', selectedVisita],
    queryFn: async () => {
      const { data } = await supabase
        .from('periodontal_records')
        .select('*')
        .eq('dental_visit_id', selectedVisita)
      const map = {}
      ;(data || []).forEach(r => { map[r.numero_diente] = r })
      setPerioData(map)
      return data || []
    },
    enabled: !!selectedVisita,
  })

  const getSondaje = (diente, idx) => perioData[diente]?.sondaje?.[idx] ?? ''
  const getSangrado = (diente, idx) => perioData[diente]?.sangrado?.[idx] ?? false
  const getRecesion = (diente, idx) => perioData[diente]?.recesion?.[idx] ?? ''
  const getMovilidad = (diente) => perioData[diente]?.movilidad ?? ''

  const updatePerio = (diente, field, idx, value) => {
    setPerioData(prev => {
      const entry = { ...(prev[diente] || { sondaje: ['','','','','',''], sangrado: [false,false,false,false,false,false], recesion: ['','','','','',''], movilidad: '' }) }
      if (field === 'movilidad') {
        entry.movilidad = value
      } else {
        const arr = [...(entry[field] || [])]
        arr[idx] = value
        entry[field] = arr
      }
      return { ...prev, [diente]: entry }
    })
  }

  const save = useMutation({
    mutationFn: async () => {
      const records = Object.entries(perioData).map(([diente, data]) => ({
        dental_visit_id: selectedVisita,
        dental_record_id: dentalRecordId,
        clinica_id: clinicaId,
        numero_diente: parseInt(diente),
        sondaje: data.sondaje?.map(v => v !== '' ? parseInt(v) : null) || null,
        sangrado: data.sangrado || null,
        recesion: data.recesion?.map(v => v !== '' ? parseInt(v) : null) || null,
        movilidad: data.movilidad !== '' ? parseInt(data.movilidad) : null,
      }))

      for (const r of records) {
        const { error } = await supabase
          .from('periodontal_records')
          .upsert(r, { onConflict: 'dental_visit_id,numero_diente' })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodontal-records', selectedVisita] })
      showSuccess('Periodontograma guardado')
    },
    onError: () => showError('Error al guardar'),
  })

  const cardBase = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const inputBase = `px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'
  }`

  return (
    <div className="space-y-5">
      {/* Selección de visita */}
      <div className={`rounded-2xl border p-5 ${cardBase}`}>
        <h3 className={`text-sm font-black uppercase tracking-wide mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Periodontograma
        </h3>

        {visitas.length === 0 ? (
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Primero registra una visita en la pestaña "Visitas" para asociar el periodontograma.
          </p>
        ) : (
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Seleccionar visita
            </label>
            <select
              value={selectedVisita || ''}
              onChange={e => setSelectedVisita(e.target.value || null)}
              className={`w-full max-w-sm ${inputBase}`}
            >
              <option value="">— Seleccionar —</option>
              {visitas.map(v => (
                <option key={v.id} value={v.id}>
                  {v.fecha} {v.motivo ? `· ${v.motivo}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedVisita && (
        <div className={`rounded-2xl border p-5 overflow-x-auto ${cardBase}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className={`text-xs font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Leyenda sondaje
              </p>
              <div className="flex gap-3 text-[11px]">
                <span className="text-green-600 font-bold">1-3mm Normal</span>
                <span className="text-amber-600 font-bold">4-5mm Moderado</span>
                <span className="text-red-600 font-bold">6+mm Severo</span>
              </div>
            </div>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-colors"
            >
              {save.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            SEXTANTES.map(sextante => (
              <div key={sextante.label} className="mb-6">
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {sextante.label}
                </p>
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className={`text-left pr-3 py-1 text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Diente</th>
                        {PUNTOS.map(p => (
                          <th key={p} className={`px-1 py-1 text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p}</th>
                        ))}
                        <th className={`pl-2 py-1 text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Mov.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sextante.dientes.map(diente => (
                        <tr key={diente}>
                          <td className={`pr-3 py-1 font-black text-[11px] ${isDark ? 'text-white' : 'text-slate-800'}`}>{diente}</td>
                          {PUNTOS.map((_, idx) => (
                            <td key={idx} className="px-0.5 py-1">
                              <SondajeCell
                                value={getSondaje(diente, idx)}
                                onChange={v => updatePerio(diente, 'sondaje', idx, v)}
                                isDark={isDark}
                              />
                            </td>
                          ))}
                          <td className="pl-2 py-1">
                            <input
                              type="number"
                              min="0"
                              max="3"
                              value={getMovilidad(diente)}
                              onChange={e => updatePerio(diente, 'movilidad', null, e.target.value)}
                              className={`w-8 text-center text-xs py-0.5 border rounded focus:ring-1 focus:ring-blue-500 outline-none ${
                                isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-700'
                              }`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
