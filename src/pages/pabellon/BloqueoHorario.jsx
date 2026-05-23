import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { Clock, X, Edit, CheckCircle, XCircle, Lock } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { sanitizeString, sanitizeNumber } from '../../utils/sanitizeInput'
import { HORAS_SELECT } from '../../utils/horasOpciones'
import Pagination from '../../components/common/Pagination'

const HORAS_PARA_PREVIEW = HORAS_SELECT
import ConfirmModal from '../../components/common/ConfirmModal'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { useTheme } from '../../contexts/ThemeContext'

export default function BloqueoHorario() {
  const [formData, setFormData] = useState({
    doctor_id: '',
    operating_room_id: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    motivo: '',
    dias_limite_vigencia: '',
  })
  const [showConfirmEliminar, setShowConfirmEliminar] = useState(false)
  const [bloqueoAEliminar, setBloqueoAEliminar] = useState(null)
  const [bloqueoEditando, setBloqueoEditando] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()
  const { theme } = useTheme()

  const { data: doctores = [] } = useQuery({
    queryKey: ['doctores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select('id, nombre, apellido')
        .eq('estado', 'activo')
        .is('deleted_at', null)
      
      if (error) throw error
      return data
    },
  })

  const { data: pabellones = [] } = useQuery({
    queryKey: ['pabellones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operating_rooms')
        .select('id, nombre')
        .eq('activo', true)
        .is('deleted_at', null)
      
      if (error) throw error
      return data
    },
  })

  const { data: bloqueos = [] } = useQuery({
    queryKey: ['bloqueos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_blocks')
        .select(`
          *,
          doctors:doctor_id(nombre, apellido),
          operating_rooms:operating_room_id(nombre)
        `)
        .is('deleted_at', null)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
      
      if (error) throw error
      return data
    },
  })

  // Consultar cirugías para validar solapamiento
  const { data: cirugias = [] } = useQuery({
    queryKey: ['cirugias-validacion', formData.fecha, formData.operating_room_id],
    queryFn: async () => {
      if (!formData.fecha || !formData.operating_room_id) return []
      
      const { data, error } = await supabase
        .from('surgeries')
        .select('hora_inicio, hora_fin')
        .eq('fecha', formData.fecha)
        .eq('operating_room_id', formData.operating_room_id)
        .is('deleted_at', null)
        .in('estado', ['programada', 'en_proceso'])
      
      if (error) throw error
      return data || []
    },
    enabled: !!formData.fecha && !!formData.operating_room_id,
  })

  // Estado por hora para el día y pabellón seleccionados (para mostrar horarios disponibles)
  const estadoPorHora = useMemo(() => {
    if (!formData.fecha || !formData.operating_room_id) return {}
    const map = {}
    HORAS_PARA_PREVIEW.forEach(h => { map[h] = 'libre' })
    cirugias.forEach(c => {
      const hi = (c.hora_inicio || '').slice(0, 5)
      const hf = (c.hora_fin || '').slice(0, 5)
      HORAS_PARA_PREVIEW.forEach(h => {
        if (h >= hi && h < hf) map[h] = 'ocupado'
      })
    })
    const bloqueosDia = bloqueos.filter(b =>
      b.fecha === formData.fecha &&
      b.operating_room_id === formData.operating_room_id &&
      b.id !== bloqueoEditando?.id
    )
    bloqueosDia.forEach(b => {
      const hi = (b.hora_inicio || '').slice(0, 5)
      const hf = (b.hora_fin || '').slice(0, 5)
      HORAS_PARA_PREVIEW.forEach(h => {
        if (h >= hi && h < hf) map[h] = 'bloqueado'
      })
    })
    return map
  }, [formData.fecha, formData.operating_room_id, cirugias, bloqueos, bloqueoEditando?.id])

  const crearBloqueo = useMutation({
    mutationFn: async (data) => {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('schedule_blocks')
        .insert({
          ...data,
          created_by: user.id,
        })
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bloqueos'])
      queryClient.invalidateQueries(['cirugias-validacion'])
      queryClient.invalidateQueries({ queryKey: ['calendario-anual-bloqueos'] })
      queryClient.invalidateQueries({ queryKey: ['ocupacion-hoy'] })
      setFormData({
        doctor_id: '',
        operating_room_id: '',
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
        motivo: '',
        dias_limite_vigencia: '',
      })
      setBloqueoEditando(null)
      showSuccess('Bloqueo creado exitosamente')
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError(`Error al crear bloqueo: ${errorMessage}`)
      }
    },
  })

  const actualizarBloqueo = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase
        .from('schedule_blocks')
        .update(data)
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bloqueos'])
      queryClient.invalidateQueries(['cirugias-validacion'])
      queryClient.invalidateQueries({ queryKey: ['calendario-anual-bloqueos'] })
      queryClient.invalidateQueries({ queryKey: ['ocupacion-hoy'] })
      setFormData({
        doctor_id: '',
        operating_room_id: '',
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
        motivo: '',
        dias_limite_vigencia: '',
      })
      setBloqueoEditando(null)
      showSuccess('Bloqueo actualizado exitosamente')
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError(`Error al actualizar bloqueo: ${errorMessage}`)
      }
    },
  })

  const eliminarBloqueo = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('schedule_blocks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bloqueos'])
      queryClient.invalidateQueries(['cirugias-validacion'])
      queryClient.invalidateQueries({ queryKey: ['calendario-anual-bloqueos'] })
      queryClient.invalidateQueries({ queryKey: ['ocupacion-hoy'] })
      showSuccess('Bloqueo eliminado exitosamente')
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError(`Error al eliminar bloqueo: ${errorMessage}`)
      }
    },
  })

  // Validar solapamiento con cirugías y otros bloqueos
  const validarSolapamiento = async () => {
    if (!formData.fecha || !formData.operating_room_id || !formData.hora_inicio || !formData.hora_fin) {
      return null
    }

    // Convertir horas a minutos para comparación
    const [horaInicioH, horaInicioM] = formData.hora_inicio.split(':').map(Number)
    const [horaFinH, horaFinM] = formData.hora_fin.split(':').map(Number)
    const minutosInicio = horaInicioH * 60 + horaInicioM
    const minutosFin = horaFinH * 60 + horaFinM

    // Validar solapamiento con cirugías
    for (const cirugia of cirugias) {
      const [cInicioH, cInicioM] = cirugia.hora_inicio.split(':').map(Number)
      const [cFinH, cFinM] = cirugia.hora_fin.split(':').map(Number)
      const cMinutosInicio = cInicioH * 60 + cInicioM
      const cMinutosFin = cFinH * 60 + cFinM

      // Verificar solapamiento: si hay intersección entre los rangos
      if (
        (minutosInicio < cMinutosFin && minutosFin > cMinutosInicio)
      ) {
        return `El bloqueo se solapa con una cirugía programada (${cirugia.hora_inicio} - ${cirugia.hora_fin})`
      }
    }

    // Validar solapamiento con otros bloqueos (excluyendo el que estamos editando)
    const bloqueosExistentes = bloqueos.filter(b => 
      b.id !== bloqueoEditando?.id &&
      b.fecha === formData.fecha &&
      b.operating_room_id === formData.operating_room_id
    )

    for (const bloqueo of bloqueosExistentes) {
      const [bInicioH, bInicioM] = bloqueo.hora_inicio.split(':').map(Number)
      const [bFinH, bFinM] = bloqueo.hora_fin.split(':').map(Number)
      const bMinutosInicio = bInicioH * 60 + bInicioM
      const bMinutosFin = bFinH * 60 + bFinM

      // Verificar solapamiento
      if (
        (minutosInicio < bMinutosFin && minutosFin > bMinutosInicio)
      ) {
        return `El bloqueo se solapa con otro bloqueo existente (${bloqueo.hora_inicio} - ${bloqueo.hora_fin})`
      }
    }

    return null
  }

  // Paginación
  const totalPages = Math.ceil(bloqueos.length / itemsPerPage)
  const bloqueosPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return bloqueos.slice(startIndex, startIndex + itemsPerPage)
  }, [bloqueos, currentPage, itemsPerPage])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validar hora fin > hora inicio
    if (formData.hora_fin <= formData.hora_inicio) {
      showError('La hora de fin debe ser mayor que la hora de inicio')
      return
    }
    
    // Validar días límite de vigencia (entero positivo si se indica)
    const dias = formData.dias_limite_vigencia === '' ? null : parseInt(formData.dias_limite_vigencia, 10)
    if (formData.dias_limite_vigencia !== '' && (Number.isNaN(dias) || dias < 1)) {
      showError('Los días límite de vigencia deben ser un número mayor a 0')
      return
    }

    // Validar solapamiento
    const errorSolapamiento = await validarSolapamiento()
    if (errorSolapamiento) {
      showError(errorSolapamiento)
      return
    }
    
    const payload = {
      doctor_id: formData.doctor_id || null,
      operating_room_id: formData.operating_room_id,
      fecha: formData.fecha,
      hora_inicio: formData.hora_inicio,
      hora_fin: formData.hora_fin,
      motivo: formData.motivo || null,
      dias_auto_liberacion: dias != null && dias > 0 ? dias : null,
      vigencia_hasta: null,
    }
    if (bloqueoEditando) {
      actualizarBloqueo.mutate({ id: bloqueoEditando.id, data: payload })
    } else {
      crearBloqueo.mutate(payload)
    }
  }

  const handleEliminar = (bloqueo) => {
    setBloqueoAEliminar(bloqueo)
    setShowConfirmEliminar(true)
  }

  const confirmarEliminar = () => {
    if (bloqueoAEliminar) {
      eliminarBloqueo.mutate(bloqueoAEliminar.id)
    }
    setBloqueoAEliminar(null)
  }

  const iniciarEdicion = (bloqueo) => {
    setBloqueoEditando(bloqueo)
    setFormData({
      doctor_id: bloqueo.doctor_id || '',
      operating_room_id: bloqueo.operating_room_id,
      fecha: bloqueo.fecha,
      hora_inicio: bloqueo.hora_inicio,
      hora_fin: bloqueo.hora_fin,
      motivo: bloqueo.motivo || '',
      dias_limite_vigencia: bloqueo.dias_auto_liberacion != null ? String(bloqueo.dias_auto_liberacion) : '',
    })
    // Scroll al formulario
    document.querySelector('.card form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const cancelarEdicion = () => {
    setBloqueoEditando(null)
    setFormData({
      doctor_id: '',
      operating_room_id: '',
      fecha: '',
      hora_inicio: '',
      hora_fin: '',
      motivo: '',
      dias_limite_vigencia: '',
    })
  }

  return (
    <div className="space-y-6">
      <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Bloqueo de Horario</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {bloqueoEditando ? 'Editar Bloqueo' : 'Crear Bloqueo'}
            </h2>
            {bloqueoEditando && (
              <button
                type="button"
                onClick={cancelarEdicion}
                className={`text-sm ${theme === 'dark' ? 'text-slate-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
              >
                Cancelar edición
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-field">Doctor (Opcional)</label>
              <select
                value={formData.doctor_id}
                onChange={(e) => setFormData({ ...formData, doctor_id: sanitizeString(e.target.value) })}
                className="input-field"
              >
                <option value="">Seleccionar doctor...</option>
                {doctores.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.nombre} {doctor.apellido}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-field">Pabellón *</label>
              <select
                value={formData.operating_room_id}
                onChange={(e) => setFormData({ ...formData, operating_room_id: sanitizeString(e.target.value) })}
                className="input-field"
                required
              >
                <option value="">Seleccionar pabellón...</option>
                {pabellones.map(pabellon => (
                  <option key={pabellon.id} value={pabellon.id}>
                    {pabellon.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-field">Fecha *</label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: sanitizeString(e.target.value) })}
                className="input-field w-full"
                required
                min={new Date().toISOString().split('T')[0]}
              />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                Elija fecha y pabellón para ver abajo los horarios disponibles u ocupados.
              </p>
            </div>

            {/* Horarios del día: solo se muestra cuando hay fecha y pabellón */}
            {formData.fecha && formData.operating_room_id && (
              <div className={`rounded-xl border-2 p-4 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  <Clock className="w-4 h-4" />
                  Horarios del día ({formData.fecha}) — {pabellones.find(p => p.id === formData.operating_room_id)?.nombre || 'Pabellón'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {HORAS_PARA_PREVIEW.map(h => {
                    const estado = estadoPorHora[h] || 'libre'
                    return (
                      <span
                        key={h}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                          estado === 'libre'
                            ? theme === 'dark'
                              ? 'bg-green-900/50 text-green-300 border border-green-600/50'
                              : 'bg-green-100 text-green-800 border border-green-300'
                            : estado === 'ocupado'
                            ? theme === 'dark'
                              ? 'bg-red-900/50 text-red-300 border border-red-600/50'
                              : 'bg-red-100 text-red-800 border border-red-300'
                            : theme === 'dark'
                            ? 'bg-amber-900/50 text-amber-300 border border-amber-600/50'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                        title={estado === 'libre' ? 'Disponible para bloquear' : estado === 'ocupado' ? 'Ocupado por cirugía' : 'Ya bloqueado'}
                      >
                        {estado === 'libre' && <CheckCircle className="w-3.5 h-3.5" />}
                        {estado === 'ocupado' && <XCircle className="w-3.5 h-3.5" />}
                        {estado === 'bloqueado' && <Lock className="w-3.5 h-3.5" />}
                        {h}
                      </span>
                    )
                  })}
                </div>
                <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Verde = disponible · Rojo = ocupado (cirugía) · Amarillo = ya bloqueado. Elija Hora Inicio y Hora Fin entre las verdes.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Hora Inicio *</label>
                <select
                  value={formData.hora_inicio ? String(formData.hora_inicio).slice(0, 5) : ''}
                  onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                  className="input-field w-full"
                  required
                >
                  <option value="">Seleccione hora</option>
                  {HORAS_SELECT.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Solo hora (sin minutos)</p>
              </div>
              <div>
                <label className="label-field">Hora Fin *</label>
                <select
                  value={formData.hora_fin ? String(formData.hora_fin).slice(0, 5) : ''}
                  onChange={(e) => setFormData({ ...formData, hora_fin: e.target.value })}
                  className="input-field w-full"
                  required
                >
                  <option value="">Seleccione hora</option>
                  {HORAS_SELECT.filter(h => !formData.hora_inicio || h > formData.hora_inicio).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Solo hora (sin minutos)</p>
              </div>
            </div>

            <div>
              <label className="label-field">Motivo</label>
              <textarea
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: sanitizeString(e.target.value) })}
                className="input-field"
                rows="3"
                maxLength={500}
              />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>
                {formData.motivo.length}/500 caracteres
              </p>
            </div>

            <div>
              <label className="label-field">Días límite de vigencia (Opcional)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={formData.dias_limite_vigencia}
                onChange={(e) => setFormData({ ...formData, dias_limite_vigencia: sanitizeNumber(e.target.value).slice(0, 3) })}
                className="input-field"
                placeholder="Ej: 5"
              />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-600'}`}>
                Ejemplo: si pones 5, el bloqueo dura 5 días desde la fecha del bloqueo y luego se libera si no se llenó. Puedes usar cualquier número (5, 15, etc.). Vacío = permanente hasta liberación manual.
              </p>
            </div>

            <button 
              type="submit" 
              className="btn-primary w-full"
              disabled={crearBloqueo.isPending || actualizarBloqueo.isPending}
            >
              {crearBloqueo.isPending || actualizarBloqueo.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  {bloqueoEditando ? 'Actualizando...' : 'Creando...'}
                </span>
              ) : (
                bloqueoEditando ? 'Actualizar Bloqueo' : 'Crear Bloqueo'
              )}
            </button>
          </form>
        </div>

        {/* Lista de bloqueos */}
        <div className="card">
          <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Bloqueos Activos</h2>
          <div className="space-y-3">
            {bloqueos.length === 0 ? (
              <p className={`text-center py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>No hay bloqueos activos</p>
            ) : (
              bloqueosPaginados.map(bloqueo => (
                <div key={bloqueo.id} className={`border rounded-lg p-4 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{bloqueo.operating_rooms?.nombre}</p>
                      <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                        <span className={`font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>Inicio:</span> {bloqueo.fecha} · {bloqueo.hora_inicio} - {bloqueo.hora_fin}
                      </p>
                      <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                        <span className={`font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>Fin:</span>{' '}
                        {bloqueo.fecha_auto_liberacion || bloqueo.vigencia_hasta
                          ? (bloqueo.fecha_auto_liberacion || bloqueo.vigencia_hasta)
                          : 'Permanente (hasta liberación manual)'}
                      </p>
                      {bloqueo.doctors && (
                        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
                          Dr. {bloqueo.doctors.nombre} {bloqueo.doctors.apellido}
                        </p>
                      )}
                      {bloqueo.motivo && (
                        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-600'}`}>{bloqueo.motivo}</p>
                      )}
                      {bloqueo.dias_auto_liberacion != null && (
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                          Vigencia: {bloqueo.dias_auto_liberacion} día(s) desde el inicio
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => iniciarEdicion(bloqueo)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        disabled={crearBloqueo.isPending || actualizarBloqueo.isPending}
                        title="Editar bloqueo"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleEliminar(bloqueo)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        disabled={eliminarBloqueo.isPending || crearBloqueo.isPending || actualizarBloqueo.isPending}
                        title="Eliminar bloqueo"
                      >
                        {eliminarBloqueo.isPending ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <X className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {bloqueos.length > itemsPerPage && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={bloqueos.length}
            />
          )}
        </div>
      </div>

      {/* Modal de Confirmación */}
      <ConfirmModal
        isOpen={showConfirmEliminar}
        onClose={() => {
          setShowConfirmEliminar(false)
          setBloqueoAEliminar(null)
        }}
        onConfirm={confirmarEliminar}
        title="Eliminar Bloqueo"
        message={bloqueoAEliminar ? `¿Estás seguro de eliminar este bloqueo?\n\nPabellón: ${bloqueoAEliminar.operating_rooms?.nombre}\nFecha: ${bloqueoAEliminar.fecha}\nHora: ${bloqueoAEliminar.hora_inicio} - ${bloqueoAEliminar.hora_fin}${bloqueoAEliminar.doctors ? `\nDoctor: ${bloqueoAEliminar.doctors.nombre} ${bloqueoAEliminar.doctors.apellido}` : ''}` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  )
}
