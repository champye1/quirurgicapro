import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { useNotifications } from '../../hooks/useNotifications'
import { Plus, Trash2, CalendarClock } from 'lucide-react'
import { HORAS_SELECT } from '../../utils/horasOpciones'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const DIAS = [
  { valor: 1, label: 'Lunes' },
  { valor: 2, label: 'Martes' },
  { valor: 3, label: 'Miércoles' },
  { valor: 4, label: 'Jueves' },
  { valor: 5, label: 'Viernes' },
  { valor: 6, label: 'Sábado' },
  { valor: 7, label: 'Domingo' },
]

export default function Disponibilidad() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const { showSuccess, showError } = useNotifications()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    dia_semana: '1',
    hora_inicio: '08:00',
    hora_fin: '14:00',
    notas: '',
  })

  // Obtener doctor_id del usuario autenticado
  const { data: doctorId } = useQuery({
    queryKey: ['mi-doctor-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return data?.id || null
    },
  })

  const { data: disponibilidades = [], isLoading } = useQuery({
    queryKey: ['mi-disponibilidad', doctorId],
    queryFn: async () => {
      if (!doctorId) return []
      const { data, error } = await supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('activo', true)
        .order('dia_semana')
        .order('hora_inicio')
      if (error) throw error
      return data || []
    },
    enabled: !!doctorId,
  })

  const agregar = useMutation({
    mutationFn: async () => {
      if (!doctorId) throw new Error('No se encontró tu perfil de doctor')
      const { error } = await supabase.from('doctor_availability').insert({
        doctor_id: doctorId,
        dia_semana: parseInt(formData.dia_semana),
        hora_inicio: formData.hora_inicio + ':00',
        hora_fin: formData.hora_fin + ':00',
        notas: formData.notas.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-disponibilidad'] })
      showSuccess('Disponibilidad agregada')
      setFormData({ dia_semana: '1', hora_inicio: '08:00', hora_fin: '14:00', notas: '' })
    },
    onError: (err) => showError('Error al guardar: ' + (err.message || 'Error desconocido')),
  })

  const eliminar = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('doctor_availability')
        .update({ activo: false, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-disponibilidad'] })
      showSuccess('Disponibilidad eliminada')
    },
    onError: (err) => showError('Error al eliminar: ' + (err.message || 'Error desconocido')),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.hora_fin <= formData.hora_inicio) {
      showError('La hora de fin debe ser mayor que la hora de inicio')
      return
    }
    agregar.mutate()
  }

  const cardClass = `rounded-2xl p-5 shadow-sm border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`
  const textPrimary = dark ? 'text-white' : 'text-slate-900'
  const textSec = dark ? 'text-slate-300' : 'text-slate-600'

  // Agrupar por día
  const porDia = DIAS.map(d => ({
    ...d,
    franjas: disponibilidades.filter(d2 => d2.dia_semana === d.valor),
  })).filter(d => d.franjas.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className={`text-2xl font-black ${textPrimary}`}>Mi Disponibilidad</h1>
          <p className={`text-sm mt-0.5 ${textSec}`}>
            Configura los horarios semanales en que estás disponible para operar
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className={cardClass}>
          <h2 className={`text-base font-bold mb-4 ${textPrimary}`}>Agregar horario</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-field">Día de la semana</label>
              <select
                value={formData.dia_semana}
                onChange={e => setFormData({ ...formData, dia_semana: e.target.value })}
                className="input-field"
              >
                {DIAS.map(d => (
                  <option key={d.valor} value={d.valor}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Hora inicio</label>
                <select
                  value={formData.hora_inicio}
                  onChange={e => setFormData({ ...formData, hora_inicio: e.target.value })}
                  className="input-field"
                >
                  {HORAS_SELECT.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Hora fin</label>
                <select
                  value={formData.hora_fin}
                  onChange={e => setFormData({ ...formData, hora_fin: e.target.value })}
                  className="input-field"
                >
                  {HORAS_SELECT.filter(h => h > formData.hora_inicio).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label-field">Notas (opcional)</label>
              <input
                type="text"
                value={formData.notas}
                onChange={e => setFormData({ ...formData, notas: e.target.value })}
                className="input-field"
                placeholder="Ej: Solo cirugías programadas"
                maxLength={200}
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={agregar.isPending}
            >
              {agregar.isPending ? <LoadingSpinner size="sm" /> : <Plus className="w-4 h-4" />}
              Agregar horario
            </button>
          </form>
        </div>

        {/* Lista */}
        <div className={cardClass}>
          <h2 className={`text-base font-bold mb-4 ${textPrimary}`}>Horarios configurados</h2>
          {isLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : porDia.length === 0 ? (
            <div className="text-center py-8">
              <CalendarClock className={`w-10 h-10 mx-auto mb-3 ${dark ? 'text-slate-600' : 'text-slate-300'}`} />
              <p className={`text-sm ${textSec}`}>No hay horarios configurados aún.</p>
              <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                Usa el formulario para agregar tu disponibilidad semanal.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {porDia.map(dia => (
                <div key={dia.valor}>
                  <p className={`text-xs font-black uppercase tracking-wider mb-2 ${dark ? 'text-blue-400' : 'text-blue-600'}`}>
                    {dia.label}
                  </p>
                  <div className="space-y-2">
                    {dia.franjas.map(f => (
                      <div
                        key={f.id}
                        className={`flex items-center justify-between rounded-xl px-4 py-3 ${dark ? 'bg-slate-700/50' : 'bg-slate-50'}`}
                      >
                        <div>
                          <span className={`text-sm font-bold ${textPrimary}`}>
                            {f.hora_inicio.slice(0, 5)} – {f.hora_fin.slice(0, 5)}
                          </span>
                          {f.notas && (
                            <p className={`text-xs mt-0.5 ${textSec}`}>{f.notas}</p>
                          )}
                        </div>
                        <button
                          onClick={() => eliminar.mutate(f.id)}
                          disabled={eliminar.isPending}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar horario"
                          aria-label="Eliminar horario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className={`rounded-xl p-4 text-sm ${dark ? 'bg-slate-800/50 border border-slate-700 text-slate-300' : 'bg-blue-50 border border-blue-100 text-blue-700'}`}>
        <strong>¿Para qué sirve esto?</strong> Pabellón podrá ver tu disponibilidad al gestionar solicitudes de cirugía, facilitando la asignación de horarios compatibles con tu agenda semanal.
      </div>
    </div>
  )
}
