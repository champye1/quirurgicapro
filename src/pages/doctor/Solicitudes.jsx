import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { Clock, CheckCircle2, XCircle, Edit, X, Package, CalendarClock, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { HORAS_SELECT } from '../../utils/horasOpciones'
import { useNotifications } from '../../hooks/useNotifications'
import { useTheme } from '../../contexts/ThemeContext'
import { sanitizeString, sanitizeNumber } from '../../utils/sanitizeInput'
import Pagination from '../../components/common/Pagination'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import SearchableSelect from '../../components/SearchableSelect'
import { codigosOperaciones, getGrupoFonasaByCodigo, insumoAplicaParaGrupo } from '../../data/codigosOperaciones'

export default function Solicitudes() {
  const queryClient = useQueryClient()
  const { theme } = useTheme()
  const { showSuccess, showError } = useNotifications()
  const isDark = theme === 'dark'
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [solicitudEditando, setSolicitudEditando] = useState(null)
  const [formEdicion, setFormEdicion] = useState({
    codigo_operacion: '',
    hora_recomendada: '',
    observaciones: '',
    insumos: [],
  })
  const [insumoSeleccionado, setInsumoSeleccionado] = useState('')
  const [cantidadInsumo, setCantidadInsumo] = useState(1)
  const [solicitudACancelar, setSolicitudACancelar] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const { data: doctor } = useQuery({
    queryKey: ['doctor-actual'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .single()
      
      if (error) throw error
      return data
    },
  })

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['solicitudes-doctor', filtroEstado],
    queryFn: async () => {
      if (!doctor) return []

      let query = supabase
        .from('surgery_requests')
        .select(`
          *,
          patients:patient_id(nombre, apellido, rut, telefono),
          surgery_request_supplies(
            supply_id,
            cantidad,
            supplies:supply_id(nombre, codigo)
          ),
          surgeries(
            id,
            fecha,
            hora_inicio,
            hora_fin,
            estado,
            estado_hora,
            fecha_anterior,
            hora_inicio_anterior,
            hora_fin_anterior,
            operating_rooms:operating_room_id(nombre)
          )
        `)
        .eq('doctor_id', doctor.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (filtroEstado !== 'todas') {
        query = query.eq('estado', filtroEstado)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!doctor,
  })

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplies')
        .select('id, nombre, codigo, grupo_prestacion, grupos_fonasa')
        .eq('activo', true)
        .is('deleted_at', null)
        .order('nombre', { ascending: true })
      
      if (error) throw error
      return data
    },
    enabled: !!doctor,
  })

  // Insumos filtrados por grupo Fonasa de la cirugía (mallas solo en hernias, no en neuro)
  const grupoFonasaEdicion = getGrupoFonasaByCodigo(formEdicion.codigo_operacion)
  const insumosDisponiblesEdicion = useMemo(() => {
    if (!grupoFonasaEdicion) return insumos
    return insumos.filter(ins => insumoAplicaParaGrupo(ins.grupos_fonasa, grupoFonasaEdicion))
  }, [insumos, grupoFonasaEdicion])

  useEffect(() => {
    if (insumoSeleccionado && !insumosDisponiblesEdicion.some(i => i.id === insumoSeleccionado)) {
      setInsumoSeleccionado('')
    }
  }, [insumosDisponiblesEdicion, insumoSeleccionado])

  // Paginación
  const totalPages = Math.ceil(solicitudes.length / itemsPerPage)
  const solicitudesPaginadas = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return solicitudes.slice(startIndex, startIndex + itemsPerPage)
  }, [solicitudes, currentPage, itemsPerPage])

  // Resetear página cuando cambia el filtro
  useEffect(() => {
    setCurrentPage(1)
  }, [filtroEstado])

  // Mutation para actualizar solicitud
  const actualizarSolicitud = useMutation({
    mutationFn: async ({ solicitudId, formData }) => {
      // Actualizar solicitud
      const { error: errorSolicitud } = await supabase
        .from('surgery_requests')
        .update({
          codigo_operacion: formData.codigo_operacion,
          hora_recomendada: formData.hora_recomendada || null,
          hora_fin_recomendada: formData.hora_fin_recomendada || null,
          fecha_preferida: formData.fecha_preferida || null,
          observaciones: formData.observaciones || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitudId)
      
      if (errorSolicitud) throw errorSolicitud

      // Eliminar insumos existentes
      const { error: errorDelete } = await supabase
        .from('surgery_request_supplies')
        .delete()
        .eq('surgery_request_id', solicitudId)
      
      if (errorDelete) throw errorDelete

      // Insertar nuevos insumos
      if (formData.insumos && formData.insumos.length > 0) {
        const insumosData = formData.insumos.map(insumo => ({
          surgery_request_id: solicitudId,
          supply_id: insumo.supply_id,
          cantidad: insumo.cantidad,
        }))

        const { error: errorInsumos } = await supabase
          .from('surgery_request_supplies')
          .insert(insumosData)

        if (errorInsumos) throw errorInsumos
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['solicitudes-doctor'])
      showSuccess('Solicitud actualizada exitosamente')
      setSolicitudEditando(null)
      setFormEdicion({
        codigo_operacion: '',
        hora_recomendada: '',
        hora_fin_recomendada: '',
        fecha_preferida: '',
        observaciones: '',
        insumos: [],
      })
      setInsumoSeleccionado('')
      setCantidadInsumo(1)
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError('Error al actualizar la solicitud: ' + errorMessage)
      }
    },
  })

  const handleEditarClick = (solicitud) => {
    if (solicitud.estado !== 'pendiente') {
      showError('Solo se pueden editar solicitudes pendientes')
      return
    }
    
    setSolicitudEditando(solicitud)
    setFormEdicion({
      codigo_operacion: solicitud.codigo_operacion || '',
      hora_recomendada: solicitud.hora_recomendada ? (typeof solicitud.hora_recomendada === 'string' ? solicitud.hora_recomendada.slice(0, 5) : solicitud.hora_recomendada) : '',
      hora_fin_recomendada: solicitud.hora_fin_recomendada ? (typeof solicitud.hora_fin_recomendada === 'string' ? solicitud.hora_fin_recomendada.slice(0, 5) : solicitud.hora_fin_recomendada) : '',
      fecha_preferida: solicitud.fecha_preferida || '',
      observaciones: solicitud.observaciones || '',
      insumos: (solicitud.surgery_request_supplies || []).map(item => ({
        supply_id: item.supplies?.id || item.supply_id,
        nombre: item.supplies?.nombre,
        codigo: item.supplies?.codigo,
        cantidad: item.cantidad,
      })),
    })
  }

  const agregarInsumo = () => {
    if (!insumoSeleccionado) {
      showError('Por favor seleccione un insumo')
      return
    }

    const insumo = insumos.find(i => i.id === insumoSeleccionado)
    if (!insumo) {
      showError('Insumo no encontrado')
      return
    }

    if (formEdicion.insumos.some(i => i.supply_id === insumo.id)) {
      showError('Este insumo ya está agregado')
      return
    }

    // Validar cantidad mínima
    if (!cantidadInsumo || cantidadInsumo < 1) {
      showError('La cantidad debe ser al menos 1')
      return
    }

    setFormEdicion({
      ...formEdicion,
      insumos: [...formEdicion.insumos, {
        supply_id: insumo.id,
        nombre: insumo.nombre,
        codigo: insumo.codigo,
        cantidad: cantidadInsumo,
      }],
    })

    setInsumoSeleccionado('')
    setCantidadInsumo(1)
    showSuccess(`Insumo "${insumo.nombre}" agregado correctamente`)
  }

  const eliminarInsumo = (index) => {
    setFormEdicion({
      ...formEdicion,
      insumos: formEdicion.insumos.filter((_, i) => i !== index),
    })
  }

  const handleGuardarEdicion = (e) => {
    e.preventDefault()
    
    if (!formEdicion.codigo_operacion) {
      showError('El código de operación es requerido')
      return
    }

    const codigoValido = codigosOperaciones.some(c => c.codigo === formEdicion.codigo_operacion)
    if (!codigoValido) {
      showError('Código de operación inválido')
      return
    }

    actualizarSolicitud.mutate({
      solicitudId: solicitudEditando.id,
      formData: formEdicion,
    })
  }

  const getEstadoBadge = (estado) => {
    const estados = {
      pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
      aceptada: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2 },
      rechazada: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
      cancelada: { bg: 'bg-gray-100', text: 'text-gray-800', icon: XCircle },
    }
    return estados[estado] || estados.pendiente
  }

  const cancelarSolicitud = useMutation({
    mutationFn: async ({ solicitudId, estadoActual, cirugiaId }) => {
      const { error } = await supabase
        .from('surgery_requests')
        .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
        .eq('id', solicitudId)
      if (error) throw error
      // Cancelar la cirugía programada si existe
      if (cirugiaId) {
        await supabase
          .from('surgeries')
          .update({ estado: 'cancelada' })
          .eq('id', cirugiaId)
          .eq('estado', 'programada')
          .catch(() => {})
      }
      // Si estaba aceptada, notificar a los usuarios de pabellón
      if (estadoActual === 'aceptada') {
        const { data: pabellonUsers } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'pabellon')
        for (const u of pabellonUsers || []) {
          await supabase.from('notifications').insert({
            user_id: u.id,
            tipo: 'solicitud_cancelada',
            titulo: 'Solicitud cancelada por el médico',
            mensaje: `El médico canceló una solicitud previamente aceptada (ID ${solicitudId.slice(0,8)}).`,
            relacionado_con: solicitudId,
          }).catch(() => {})
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['solicitudes-doctor'])
      showSuccess('Solicitud cancelada')
      setSolicitudACancelar(null)
    },
    onError: (error) => {
      showError('Error al cancelar: ' + (error.message || 'Error desconocido'))
    },
  })

  // Notificar a pabellón que el paciente/doctor solicitó reagendamiento (vía RPC)
  const solicitarReagendamiento = useMutation({
    mutationFn: async (solicitud) => {
      const { data, error } = await supabase.rpc('notificar_reagendamiento_a_pabellon', {
        p_surgery_request_id: solicitud.id,
      })
      if (error) throw error
      if (!data?.success) throw new Error('No se pudo enviar la notificación')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['solicitudes-doctor'])
      showSuccess('Pabellón ha sido notificado de la solicitud de reagendamiento.')
    },
    onError: (error) => {
      showError(error.message || 'Error al notificar a pabellón.')
    },
  })

  if (isLoading) {
    return <div className="text-center py-8">Cargando solicitudes...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Mis Solicitudes</h1>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(sanitizeString(e.target.value))}
          className="input-field w-auto"
        >
          <option value="todas">Todas</option>
          <option value="pendiente">Pendientes</option>
          <option value="aceptada">Aceptadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>

      <div className="space-y-4">
        {solicitudes.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-500">No hay solicitudes</p>
          </div>
        ) : (
          <>
            {solicitudesPaginadas.map(solicitud => {
            const estadoInfo = getEstadoBadge(solicitud.estado)
            const EstadoIcon = estadoInfo.icon

            return (
              <div key={solicitud.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : ''}`}>
                      {solicitud.patients?.nombre} {solicitud.patients?.apellido}
                    </h3>
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>RUT: {solicitud.patients?.rut}</p>
                    {solicitud.patients?.telefono && (
                      <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Tel: {solicitud.patients.telefono}</p>
                    )}
                    <p className={`text-sm mt-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                      Código Operación: {solicitud.codigo_operacion}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded flex items-center gap-2 ${estadoInfo.bg} ${estadoInfo.text}`}>
                    <EstadoIcon className="w-4 h-4" />
                    {solicitud.estado}
                  </span>
                </div>

                {(solicitud.estado === 'aceptada' || solicitud.estado === 'pendiente') && (
                  <div className="mb-4 space-y-2">
                    {solicitud.reagendamiento_notificado_at && (
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-amber-600" />
                        Ya se notificó sobre el reagendamiento
                        <span className="text-amber-600/80 text-xs">
                          ({format(new Date(solicitud.reagendamiento_notificado_at), 'dd/MM/yyyy HH:mm')})
                        </span>
                      </p>
                    )}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => solicitarReagendamiento.mutate(solicitud)}
                        disabled={solicitarReagendamiento.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                        title="Notificar a pabellón que el paciente solicitó reagendamiento"
                      >
                        <CalendarClock className="w-4 h-4" />
                        Reagendar
                      </button>
                    </div>
                  </div>
                )}

                {(solicitud.hora_recomendada || solicitud.fecha_preferida) && (
                  <div className="mb-2">
                    <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : ''}`}>
                      {solicitud.fecha_preferida ? 'Horario solicitado (vacío, sin reservas ni bloqueos): ' : 'Hora recomendada: '}
                    </span>
                    <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-gray-600'}`}>
                      {solicitud.fecha_preferida && (
                        <>
                          {format(new Date(solicitud.fecha_preferida), 'dd/MM/yyyy')}
                          {solicitud.hora_recomendada && (
                            <> · {typeof solicitud.hora_recomendada === 'string' ? solicitud.hora_recomendada.slice(0, 5) : solicitud.hora_recomendada}
                              {solicitud.hora_fin_recomendada && `–${typeof solicitud.hora_fin_recomendada === 'string' ? solicitud.hora_fin_recomendada.slice(0, 5) : solicitud.hora_fin_recomendada}`}
                            </>
                          )}
                        </>
                      )}
                      {!solicitud.fecha_preferida && solicitud.hora_recomendada && (typeof solicitud.hora_recomendada === 'string' ? solicitud.hora_recomendada.slice(0, 5) : solicitud.hora_recomendada)}
                    </span>
                  </div>
                )}

                {solicitud.estado === 'rechazada' && solicitud.motivo_rechazo && (
                  <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-0.5">Motivo del rechazo</p>
                      <p className="text-sm text-red-700">{solicitud.motivo_rechazo}</p>
                    </div>
                  </div>
                )}

                {solicitud.observaciones && (
                  <div className="mb-2">
                    <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : ''}`}>Observaciones: </span>
                    <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-gray-600'}`}>{solicitud.observaciones}</span>
                  </div>
                )}

                {solicitud.surgery_request_supplies && solicitud.surgery_request_supplies.length > 0 && (
                  <div className="mb-2">
                    <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : ''}`}>Insumos: </span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {solicitud.surgery_request_supplies.map((item, idx) => (
                        <span
                          key={idx}
                          className={`text-xs px-2 py-1 rounded border ${
                            isDark
                              ? 'bg-slate-600/90 text-slate-100 border-slate-500'
                              : 'bg-gray-100 text-gray-800 border-gray-200'
                          }`}
                        >
                          {item.supplies?.nombre} (x{item.cantidad})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {solicitud.surgeries && solicitud.surgeries.length > 0 && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-1">Cirugía Programada:</p>
                    <p className="text-sm text-green-700">
                      {format(new Date(solicitud.surgeries[0].fecha), 'dd/MM/yyyy')} a las {typeof solicitud.surgeries[0].hora_inicio === 'string' ? solicitud.surgeries[0].hora_inicio.substring(0, 5) : solicitud.surgeries[0].hora_inicio}
                    </p>
                    <p className="text-sm text-green-700">
                      Pabellón: {solicitud.surgeries[0].operating_rooms?.nombre}
                    </p>
                    {solicitud.surgeries[0].estado_hora === 'reagendado' && solicitud.surgeries[0].fecha_anterior && (
                      <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-amber-200">
                        Fecha original (ya no aplica): {format(new Date(solicitud.surgeries[0].fecha_anterior), 'dd/MM/yyyy')} a las {typeof solicitud.surgeries[0].hora_inicio_anterior === 'string' ? solicitud.surgeries[0].hora_inicio_anterior.substring(0, 5) : solicitud.surgeries[0].hora_inicio_anterior}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Creada el {format(new Date(solicitud.created_at), 'dd/MM/yyyy HH:mm')}
                  </div>
                  {(solicitud.estado === 'pendiente' || solicitud.estado === 'aceptada') && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSolicitudACancelar(solicitud)}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 border border-red-200"
                        aria-label="Cancelar solicitud"
                      >
                        <Trash2 className="w-4 h-4" />
                        Cancelar
                      </button>
                      {solicitud.estado === 'pendiente' && (
                        <button
                          onClick={() => handleEditarClick(solicitud)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                          aria-label="Editar solicitud"
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          
          {solicitudes.length > itemsPerPage && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={solicitudes.length}
            />
          )}
          </>
        )}
      </div>

      {/* Modal Confirmar Cancelación */}
      <Modal
        isOpen={!!solicitudACancelar}
        onClose={() => setSolicitudACancelar(null)}
        title="Cancelar Solicitud"
        aria-label="Confirmar cancelación de solicitud"
      >
        {solicitudACancelar && (
          <div className="space-y-4">
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              ¿Seguro que quieres cancelar la solicitud de{' '}
              <strong>{solicitudACancelar.patients?.nombre} {solicitudACancelar.patients?.apellido}</strong>?
            </p>
            {solicitudACancelar.estado === 'aceptada' && (
              <div className={`flex items-start gap-2 rounded-xl border p-3 text-xs font-medium ${isDark ? 'bg-amber-900/20 border-amber-700 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <span className="shrink-0">⚠️</span>
                <span>El pabellón ya <strong>aceptó</strong> esta solicitud. Al cancelarla, se notificará al equipo y deberás crear una nueva solicitud si cambias de opinión.</span>
              </div>
            )}
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Esta acción no se puede deshacer. La solicitud quedará marcada como cancelada.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" type="button" onClick={() => setSolicitudACancelar(null)}>
                Volver
              </Button>
              <Button
                type="button"
                loading={cancelarSolicitud.isPending}
                onClick={() => cancelarSolicitud.mutate({ solicitudId: solicitudACancelar.id, estadoActual: solicitudACancelar.estado, cirugiaId: solicitudACancelar.surgeries?.[0]?.id })}
                className="bg-red-600 hover:bg-red-700"
              >
                Sí, cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Edición */}
      <Modal
        isOpen={!!solicitudEditando}
        onClose={() => {
          setSolicitudEditando(null)
          setFormEdicion({
            codigo_operacion: '',
            hora_recomendada: '',
            hora_fin_recomendada: '',
            fecha_preferida: '',
            observaciones: '',
            insumos: [],
          })
          setInsumoSeleccionado('')
          setCantidadInsumo(1)
        }}
        title="Editar Solicitud"
      >
        {solicitudEditando && (
          <form onSubmit={handleGuardarEdicion} className="space-y-6">
            <div>
              <p className="text-sm text-slate-600 mb-4">
                <span className="font-bold">Paciente:</span> {solicitudEditando.patients?.nombre} {solicitudEditando.patients?.apellido}
              </p>
            </div>

            <div>
              <label className="label-field">Código de Operación *</label>
              <SearchableSelect
                options={codigosOperaciones}
                value={formEdicion.codigo_operacion}
                onChange={(codigo) => setFormEdicion({ ...formEdicion, codigo_operacion: codigo })}
                placeholder="Buscar código de operación..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Hora Inicio Recomendada</label>
                <select
                  value={formEdicion.hora_recomendada ? String(formEdicion.hora_recomendada).slice(0, 5) : ''}
                  onChange={(e) => setFormEdicion({ ...formEdicion, hora_recomendada: e.target.value })}
                  className="input-field"
                >
                  <option value="">Sin preferencia</option>
                  {HORAS_SELECT.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Hora Fin Recomendada</label>
                <select
                  value={formEdicion.hora_fin_recomendada ? String(formEdicion.hora_fin_recomendada).slice(0, 5) : ''}
                  onChange={(e) => setFormEdicion({ ...formEdicion, hora_fin_recomendada: e.target.value })}
                  className="input-field"
                >
                  <option value="">Sin preferencia</option>
                  {HORAS_SELECT.filter(h => !formEdicion.hora_recomendada || h > formEdicion.hora_recomendada).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label-field">Fecha Preferida</label>
              <input
                type="date"
                value={formEdicion.fecha_preferida || ''}
                onChange={(e) => setFormEdicion({ ...formEdicion, fecha_preferida: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="label-field">Observaciones</label>
              <textarea
                value={formEdicion.observaciones}
                onChange={(e) => setFormEdicion({ ...formEdicion, observaciones: sanitizeString(e.target.value) })}
                className="input-field"
                rows="3"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formEdicion.observaciones?.length || 0}/500 caracteres
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Insumos Requeridos
              </h3>
              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  <SearchableSelect
                    options={insumosDisponiblesEdicion}
                    value={insumoSeleccionado}
                    onChange={(id) => setInsumoSeleccionado(id)}
                    placeholder={grupoFonasaEdicion ? `Insumos para esta cirugía (grupo ${grupoFonasaEdicion})` : 'Buscar insumo...'}
                    valueKey="id"
                    displayFormat={(insumo) => `${insumo.codigo} - ${insumo.nombre}`}
                  />
                </div>
                <input
                  type="number"
                  value={cantidadInsumo}
                  onChange={(e) => setCantidadInsumo(parseInt(sanitizeNumber(e.target.value)) || 1)}
                  className="input-field w-24"
                  min="1"
                  placeholder="Cant."
                />
                <button
                  type="button"
                  onClick={agregarInsumo}
                  className="btn-secondary"
                  disabled={!insumoSeleccionado}
                >
                  Agregar
                </button>
              </div>

              {formEdicion.insumos.length > 0 && (
                <div className="border rounded-lg p-4 space-y-2">
                  {formEdicion.insumos.map((insumo, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span>
                        {insumo.nombre} ({insumo.codigo}) - Cantidad: {insumo.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminarInsumo(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4 justify-end">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setSolicitudEditando(null)
                  setFormEdicion({
                    codigo_operacion: '',
                    hora_recomendada: '',
                    hora_fin_recomendada: '',
                    fecha_preferida: '',
                    observaciones: '',
                    insumos: [],
                  })
                  setInsumoSeleccionado('')
                  setCantidadInsumo(1)
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={actualizarSolicitud.isPending}
              >
                Guardar Cambios
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
