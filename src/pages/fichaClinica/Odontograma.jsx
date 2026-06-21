import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useNotifications } from '../../hooks/useNotifications'
import { Save, X } from 'lucide-react'

// FDI notation — display order: right to left for Q1/Q4, left to right for Q2/Q3
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

const CONDICIONES = {
  sano:       { label: 'Sano',        bg: 'bg-white',       text: 'text-slate-600', border: 'border-slate-300' },
  caries:     { label: 'Caries',      bg: 'bg-red-200',     text: 'text-red-800',   border: 'border-red-400' },
  obturado:   { label: 'Obturado',    bg: 'bg-blue-200',    text: 'text-blue-800',  border: 'border-blue-400' },
  extraccion: { label: 'Extracción',  bg: 'bg-slate-700',   text: 'text-white',     border: 'border-slate-800' },
  corona:     { label: 'Corona',      bg: 'bg-yellow-200',  text: 'text-yellow-800', border: 'border-yellow-400' },
  implante:   { label: 'Implante',    bg: 'bg-green-200',   text: 'text-green-800', border: 'border-green-400' },
  fractura:   { label: 'Fractura',    bg: 'bg-orange-200',  text: 'text-orange-800', border: 'border-orange-400' },
  ausente:    { label: 'Ausente',     bg: 'bg-slate-200',   text: 'text-slate-400', border: 'border-slate-300' },
  puente:     { label: 'Puente',      bg: 'bg-purple-200',  text: 'text-purple-800', border: 'border-purple-400' },
  endodoncia: { label: 'Endodoncia',  bg: 'bg-pink-200',    text: 'text-pink-800',  border: 'border-pink-400' },
}

function ToothButton({ number, condition, onClick }) {
  const c = CONDICIONES[condition] || CONDICIONES.sano
  const isExtraccion = condition === 'extraccion'
  const isAusente = condition === 'ausente'

  return (
    <button
      onClick={() => onClick(number)}
      title={`Diente ${number} — ${c.label}`}
      className={`relative w-9 h-10 rounded-md border-2 text-[10px] font-black flex flex-col items-center justify-between py-1 transition-all hover:scale-110 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 ${c.bg} ${c.text} ${c.border}`}
    >
      {isExtraccion && (
        <span className="absolute inset-0 flex items-center justify-center text-base font-black text-white">✕</span>
      )}
      {isAusente && (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">—</span>
      )}
      <span className={isExtraccion || isAusente ? 'opacity-0' : ''}>{number}</span>
    </button>
  )
}

function EditModal({ toothNumber, current, onSave, onClose, isDark }) {
  const [condicion, setCondicion] = useState(current || 'sano')
  const [notas, setNotas] = useState('')

  const inputBase = `w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'
  }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full max-w-xs rounded-2xl border shadow-2xl p-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Diente {toothNumber}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {Object.entries(CONDICIONES).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setCondicion(key)}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${val.bg} ${val.text} ${
                condicion === key ? 'border-blue-500 ring-2 ring-blue-300' : val.border
              }`}
            >
              {val.label}
            </button>
          ))}
        </div>

        <textarea
          placeholder="Notas (opcional)"
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={2}
          className={`${inputBase} resize-none mb-4`}
        />

        <button
          onClick={() => onSave(toothNumber, condicion, notas)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors"
        >
          <Save size={14} /> Guardar
        </button>
      </div>
    </div>
  )
}

export default function Odontograma({ dentalRecordId, clinicaId, isDark }) {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()
  const [editingTooth, setEditingTooth] = useState(null)

  const { data: conditions = [] } = useQuery({
    queryKey: ['tooth-conditions', dentalRecordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tooth_conditions')
        .select('numero_diente, condicion, notas')
        .eq('dental_record_id', dentalRecordId)
      if (error) throw error
      return data || []
    },
    enabled: !!dentalRecordId,
  })

  const conditionMap = Object.fromEntries(conditions.map(c => [c.numero_diente, c]))

  const saveTooth = useMutation({
    mutationFn: async ({ numero, condicion, notas }) => {
      const { error } = await supabase
        .from('tooth_conditions')
        .upsert({
          dental_record_id: dentalRecordId,
          clinica_id: clinicaId,
          numero_diente: numero,
          condicion,
          notas: notas || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'dental_record_id,numero_diente' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tooth-conditions', dentalRecordId] })
      showSuccess('Diente actualizado')
      setEditingTooth(null)
    },
    onError: () => showError('Error al guardar'),
  })

  const cardBase = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const labelStyle = `text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`

  const renderArch = (teeth, label) => (
    <div>
      <p className={`${labelStyle} mb-2 text-center`}>{label}</p>
      <div className="flex items-end justify-center gap-1">
        {teeth.map(n => (
          <ToothButton
            key={n}
            number={n}
            condition={conditionMap[n]?.condicion || 'sano'}
            onClick={setEditingTooth}
          />
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <div className={`rounded-2xl border p-6 ${cardBase}`}>
        <h3 className={`text-sm font-black uppercase tracking-wider mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Odontograma — Notación FDI
        </h3>

        <div className="space-y-3">
          {renderArch(UPPER_TEETH, 'Maxilar Superior')}

          {/* Línea central */}
          <div className={`flex items-center gap-2 my-1`}>
            <div className={`flex-1 h-px ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`} />
            <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Derecha · Izquierda
            </span>
            <div className={`flex-1 h-px ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`} />
          </div>

          {renderArch(LOWER_TEETH, 'Mandíbula Inferior')}
        </div>

        {/* Leyenda */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <p className={`${labelStyle} mb-2`}>Leyenda</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CONDICIONES).map(([key, val]) => (
              <span key={key} className={`px-2 py-0.5 rounded text-[10px] font-bold border ${val.bg} ${val.text} ${val.border}`}>
                {val.label}
              </span>
            ))}
          </div>
        </div>

        <p className={`mt-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Haz clic en cualquier diente para registrar o cambiar su condición.
        </p>
      </div>

      {editingTooth && (
        <EditModal
          toothNumber={editingTooth}
          current={conditionMap[editingTooth]?.condicion}
          isDark={isDark}
          onClose={() => setEditingTooth(null)}
          onSave={(numero, condicion, notas) => saveTooth.mutate({ numero, condicion, notas })}
        />
      )}
    </div>
  )
}
