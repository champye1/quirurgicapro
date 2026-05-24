import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { CheckCircle2, Clock, Eye, CalendarClock, X, User, Stethoscope, Package, FileText, CheckCircle, Activity, Lock, Search, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { codigosOperaciones } from '../../data/codigosOperaciones'
import { useNotifications } from '../../hooks/useNotifications'
import { useDebounce } from '../../hooks/useDebounce'
import { useTheme } from '../../contexts/ThemeContext'
import { sanitizeString } from '../../utils/sanitizeInput'
import { HORAS_SELECT } from '../../utils/horasOpciones'
import { logger } from '../../utils/logger'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { TableSkeleton } from '../../components/common/Skeleton'
import Modal from '../../components/common/Modal'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { motion } from 'framer-motion'

export default function Solicitudes() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { showSuccess, showError } = useNotifications()
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [filtroDoctor, setFiltroDoctor] = useState('todos')
  const [filtroCodigoOperacion, setFiltroCodigoOperacion] = useState('todos')
  const debouncedBusqueda = useDebounce(busqueda, 300)
  const [solicitudProgramando, setSolicitudProgramando] = useState(null)
  const [solicitudDetalle, setSolicitudDetalle] = useState(null)
  const [solicitudAceptandoHorario, setSolicitudAceptandoHorario] = useState(null)
  
  // Verificar si hay un slot seleccionado desde el calendario
  useEffect(() => {
    try {
      const slotStr = sessionStorage.getItem('slot_seleccionado')
      const solicitudStr = sessionStorage.getItem('solicitud_gestionando')
      
      if (slotStr && solicitudStr) {
        const slot = JSON.parse(slotStr)
        const solicitud = JSON.parse(solicitudStr)
        
        // Configurar el modal con la información del slot
        setSolicitudProgramando(solicitud)
        setFormProgramacion({
          fecha: format(new Date(slot.date), 'yyyy-MM-dd'),
          hora_inicio: slot.time,
          hora_fin: '',
          operating_room_id: slot.pabellonId,
          observaciones: '',
        })
        
        // Limpiar sessionStorage
        sessionStorage.removeItem('slot_seleccionado')
        sessionStorage.removeItem('solicitud_gestionando')
      }
    } catch (e) {
      logger.errorWithContext('Error al procesar slot seleccionado', e)
    }
  }, [])
  const [formProgramacion, setFormProgramacion] = useState({
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    operating_room_id: '',
    observaciones: '',
  })
  const queryClient = useQueryClient()

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['solicitudes', filtroEstado],
    queryFn: async () => {
      let query = supabase
        .from('surgery_requests')
        .select(`
          *,
          doctors:doctor_id(id, user_id, nombre, apellido, especialidad, estado, telefono),
          patients:patient_id(nombre, apellido, rut, telefono),
          surgery_request_supplies(
            cantidad,
            supplies:supply_id(nombre, codigo, grupo_prestacion)
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (filtroEstado !== 'todas') {
        query = query.eq('estado', filtroEstado)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  // Obtener lista única de doctores para filtro
  const doctoresUnicos = useMemo(() => {
    const doctoresMap = new Map()
    solicitudes.forEach(s => {
      if (s.doctors && !doctoresMap.has(s.doctors.id)) {
        doctoresMap.set(s.doctors.id, s.doctors)
      }
    })
    return Array.from(doctoresMap.values())
  }, [solicitudes])

  // Obtener lista única de códigos de operación para filtro
  const codigosUnicos = useMemo(() => {
    const codigosSet = new Set()
    solicitudes.forEach(s => {
      if (s.codigo_operacion) {
        codigosSet.add(s.codigo_operacion)
      }
    })
    return Array.from(codigosSet).sort()
  }, [solicitudes])

  // Filtrar solicitudes según búsqueda y filtros
  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter(s => {
      // Filtro por estado
      if (filtroEstado !== 'todas' && s.estado !== filtroEstado) {
        return false
      }

      // Filtro por doctor
      if (filtroDoctor !== 'todos' && s.doctors?.id !== filtroDoctor) {
        return false
      }

      // Filtro por código de operación
      if (filtroCodigoOperacion !== 'todos' && s.codigo_operacion !== filtroCodigoOperacion) {
        return false
      }

      // Búsqueda por texto (usando debounced value)
      if (debouncedBusqueda.trim()) {
        const busquedaLower = debouncedBusqueda.toLowerCase()
        const nombrePaciente = `${s.patients?.nombre || ''} ${s.patients?.apellido || ''}`.toLowerCase()
        const rutPaciente = (s.patients?.rut || '').toLowerCase()
        const nombreDoctor = `${s.doctors?.nombre || ''} ${s.doctors?.apellido || ''}`.toLowerCase()
        const codigoOperacion = (s.codigo_operacion || '').toLowerCase()
        
        if (
          !nombrePaciente.includes(busquedaLower) &&
          !rutPaciente.includes(busquedaLower) &&
          !nombreDoctor.includes(busquedaLower) &&
          !codigoOperacion.includes(busquedaLower)
        ) {
          return false
        }
      }

      return true
    })
  }, [solicitudes, filtroEstado, filtroDoctor, filtroCodigoOperacion, debouncedBusqueda])

  const enviarWhatsApp = async (solicitud, tipo) => {
    const nombreDoctor   = solicitud.doctors ? `${solicitud.doctors.nombre} ${solicitud.doctors.apellido}` : null
    const nombrePaciente = solicitud.patients ? `${solicitud.patients.nombre} ${solicitud.patients.apellido}` : null
    const fechaCirugia   = solicitud.hora_recomendada
      ? format(new Date(solicitud.hora_recomendada), "dd/MM/yyyy HH:mm")
      : solicitud.fecha_preferida || null
    const observaciones  = solicitud.observaciones || null

    const payload = { tipo, nombreDoctor, nombrePaciente, fechaCirugia, observaciones }

    // Notificar al médico (fire-and-forget: no bloquea la operación principal)
    if (solicitud.doctors?.telefono) {
      supabase.functions.invoke('send-whatsapp', {
        body: { ...payload, to: solicitud.doctors.telefono, destinatario: 'doctor' },
      }).catch((err) => logger.warn('WhatsApp al médico falló (no crítico):', err?.message))
    }

    // Notificar al paciente (fire-and-forget)
    if (solicitud.patients?.telefono) {
      supabase.functions.invoke('send-whatsapp', {
        body: { ...payload, to: solicitud.patients.telefono, destinatario: 'paciente' },
      }).catch((err) => logger.warn('WhatsApp al paciente falló (no crítico):', err?.message))
    }
  }

  const [showConfirmRechazar, setShowConfirmRechazar] = useState(false)
  const [solicitudARechazar, setSolicitudARechazar] = useState(null)

  const rechazarSolicitud = useMutation({
    mutationFn: async (solicitud) => {
      const { error } = await supabase
        .from('surgery_requests')
        .update({ estado: 'rechazada', updated_at: new Date().toISOString() })
        .eq('id', solicitud.id)

      if (error) throw error
      return solicitud
    },
    onSuccess: (solicitud) => {
      queryClient.invalidateQueries(['solicitudes'])
      queryClient.invalidateQueries(['solicitudes-pendientes'])
      showSuccess('Solicitud rechazada')
      setShowConfirmRechazar(false)
      setSolicitudARechazar(null)
      enviarWhatsApp(solicitud, 'rechazada')
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError('Error al rechazar la solicitud: ' + errorMessage)
      }
    },
  })

  const confirmarRechazar = () => {
    if (solicitudARechazar) {
      rechazarSolicitud.mutate(solicitudARechazar)
    }
  }

  const { data: pabellones = [] } = useQuery({
    queryKey: ['pabellones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operating_rooms')
        .select('id, nombre')
        .eq('activo', true)
        .is('deleted_at', null)
        .order('nombre')
      
      if (error) throw error
      return data
    },
  })

  // Consultar todas las cirugías para la fecha seleccionada (para mostrar el calendario completo)
  const { data: cirugiasFecha = [] } = useQuery({
    queryKey: ['cirugias-fecha', formProgramacion.fecha],
    queryFn: async () => {
      if (!formProgramacion.fecha) return []

      const { data, error } = await supabase
        .from('surgeries')
        .select(`
          id,
          operating_room_id,
          hora_inicio,
          hora_fin,
          doctors:doctor_id(nombre, apellido)
        `)
        .eq('fecha', formProgramacion.fecha)
        .is('deleted_at', null)
        .in('estado', ['programada', 'en_proceso'])
      
      if (error) throw error
      return data || []
    },
    enabled: !!formProgramacion.fecha,
  })

  // Consultar bloqueos para la fecha seleccionada
  const { data: bloqueosFecha = [] } = useQuery({
    queryKey: ['bloqueos-fecha', formProgramacion.fecha],
    queryFn: async () => {
      if (!formProgramacion.fecha) return []

      let query = supabase
        .from('schedule_blocks')
        .select('id, operating_room_id, hora_inicio, hora_fin, vigencia_hasta')
        .eq('fecha', formProgramacion.fecha)
        .is('deleted_at', null)
      
      const { data, error } = await query
      
      if (error) throw error
      
      // Filtrar bloqueos que están vigentes (vigencia_hasta es null o >= fecha seleccionada)
      return (data || []).filter(bloqueo => 
        !bloqueo.vigencia_hasta || bloqueo.vigencia_hasta >= formProgramacion.fecha
      )
    },
    enabled: !!formProgramacion.fecha,
  })

  // Generar slots de horas (08:00 a 19:00)
  const slotsHorarios = useMemo(() => {
    const hours = []
    for (let i = 8; i < 20; i++) {
      hours.push(`${i.toString().padStart(2, '0')}:00`)
    }
    return hours
  }, [])

  // Obtener solo los primeros 4 pabellones (siempre mostrar 4)
  const pabellonesMostrar = useMemo(() => {
    const primeros4 = pabellones.slice(0, 4)
    return primeros4
  }, [pabellones])

  // Función para obtener el estado de un slot
  const getSlotStatus = (pabellonId, time) => {
    if (!formProgramacion.fecha) return { status: 'available' }

    // Verificar si hay cirugía en este slot
    const cirugia = cirugiasFecha.find(c => 
      c.operating_room_id === pabellonId &&
      c.hora_inicio <= time + ':00' && 
      c.hora_fin > time + ':00'
    )
    
    if (cirugia) return { status: 'occupied', data: cirugia }
    
    // Verificar si hay bloqueo en este slot
    const bloqueo = bloqueosFecha.find(b => 
      b.operating_room_id === pabellonId &&
      b.hora_inicio <= time + ':00' && 
      b.hora_fin > time + ':00'
    )
    
    if (bloqueo) return { status: 'blocked', data: bloqueo }
    
    return { status: 'available' }
  }

  const programarCirugia = useMutation({
    mutationFn: async ({ solicitudId, formData }) => {
      // Asegurar formato correcto de horas (HH:MM:SS)
      const horaInicio = formData.hora_inicio.includes(':') && formData.hora_inicio.length === 5 
        ? `${formData.hora_inicio}:00` 
        : formData.hora_inicio
      const horaFin = formData.hora_fin.includes(':') && formData.hora_fin.length === 5 
        ? `${formData.hora_fin}:00` 
        : formData.hora_fin

      // Usar función PostgreSQL atómica que garantiza transacción completa
      // Esta función crea la cirugía, copia insumos y actualiza la solicitud en una sola transacción
      const { data, error } = await supabase.rpc('programar_cirugia_completa', {
        p_surgery_request_id: solicitudId,
        p_operating_room_id: formData.operating_room_id,
        p_fecha: formData.fecha,
        p_hora_inicio: horaInicio,
        p_hora_fin: horaFin,
        p_observaciones: formData.observaciones || null
      })

      if (error) {
        logger.errorWithContext('Error al programar cirugía desde Solicitudes', error)
        throw error
      }

      if (!data || !data.success) {
        throw new Error(data?.message || 'Error desconocido al programar la cirugía')
      }

      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['solicitudes'])
      queryClient.invalidateQueries(['solicitudes-pendientes'])
      queryClient.invalidateQueries(['cirugias-hoy'])
      queryClient.invalidateQueries(['cirugias-calendario'])
      queryClient.invalidateQueries(['cirugias-fecha'])
      if (solicitudProgramando) {
        enviarWhatsApp({ ...solicitudProgramando, hora_recomendada: variables.formData?.fecha ? `${variables.formData.fecha}T${variables.formData.hora_inicio}` : solicitudProgramando.hora_recomendada }, 'aceptada')
      }
      setSolicitudProgramando(null)
      setFormProgramacion({
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
        operating_room_id: '',
        observaciones: '',
      })
      // Limpiar sessionStorage
      sessionStorage.removeItem('solicitud_gestionando')
      sessionStorage.removeItem('slot_seleccionado')
    },
    onError: (error) => {
      logger.errorWithContext('Error al programar cirugía (onError)', error)
      let mensaje = 'Error al programar la cirugía'
      
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        mensaje = 'Error de conexión. Verifique su conexión a internet e intente nuevamente.'
      } else if (errorMessage.includes('solapamiento') || errorMessage.includes('overlap')) {
        mensaje = 'Ya existe una cirugía programada en este horario. Por favor, seleccione otro horario.'
      } else if (errorMessage.includes('hora de fin')) {
        mensaje = errorMessage
      } else if (errorMessage.includes('doctor debe estar activo')) {
        mensaje = 'El doctor debe estar activo para programar cirugías'
      } else if (errorMessage.includes('bloqueado') || errorMessage.includes('blocked')) {
        mensaje = 'El horario seleccionado está bloqueado por convenio'
      } else if (errorMessage.includes('fecha pasada')) {
        mensaje = 'No se puede agendar una cirugía en una fecha pasada'
      } else {
        mensaje = errorMessage
      }
      
      showError(mensaje)
    },
  })

  // Programar directamente usando el horario preferido definido por el médico
  const programarConHorarioDelMedico = useMutation({
    mutationFn: async ({ solicitudId, fecha, operatingRoomId, horaInicio, horaFin }) => {
      // Normalizar horas a formato HH:MM:SS
      const normalizarHora = (hora) => {
        if (!hora) return null
        if (typeof hora === 'string') {
          const limpia = hora.length === 5 ? `${hora}:00` : hora
          return limpia
        }
        return hora
      }

      const horaInicioNorm = normalizarHora(horaInicio)
      let horaFinNorm = normalizarHora(horaFin)

      // Si no viene hora fin desde la solicitud, asumir 1 hora de duración
      if (!horaFinNorm && horaInicioNorm) {
        const [h, m, s] = horaInicioNorm.split(':').map(Number)
        const base = new Date()
        base.setHours(h, m ?? 0, s ?? 0, 0)
        base.setHours(base.getHours() + 1)
        const hh = String(base.getHours()).padStart(2, '0')
        const mm = String(base.getMinutes()).padStart(2, '0')
        horaFinNorm = `${hh}:${mm}:00`
      }

      const { data, error } = await supabase.rpc('programar_cirugia_completa', {
        p_surgery_request_id: solicitudId,
        p_operating_room_id: operatingRoomId,
        p_fecha: fecha,
        p_hora_inicio: horaInicioNorm,
        p_hora_fin: horaFinNorm,
        p_observaciones: null,
      })

      if (error) {
        logger.errorWithContext('Error al programar cirugía con horario del médico', error)
        throw error
      }

      if (!data || !data.success) {
        throw new Error(data?.message || 'Error desconocido al programar la cirugía con el horario del médico')
      }

      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['solicitudes'])
      queryClient.invalidateQueries(['solicitudes-pendientes'])
      queryClient.invalidateQueries(['cirugias-hoy'])
      queryClient.invalidateQueries(['cirugias-calendario'])
      if (variables.solicitud) enviarWhatsApp(variables.solicitud, 'aceptada')
      setSolicitudAceptandoHorario(null)
      showSuccess('Horario del médico aceptado y cirugía programada')
    },
    onError: (error) => {
      logger.errorWithContext('Error al aceptar horario del médico (onError)', error)
      let mensaje = 'Error al aceptar el horario del médico'

      const errorMessage = error.message || error.toString() || 'Error desconocido'

      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        mensaje = 'Error de conexión. Verifique su conexión a internet e intente nuevamente.'
      } else if (errorMessage.includes('solapamiento') || errorMessage.includes('overlap')) {
        mensaje = 'Ya existe una cirugía programada en este horario. Por favor, seleccione otro horario.'
      } else if (errorMessage.includes('bloqueado') || errorMessage.includes('blocked')) {
        mensaje = 'El horario seleccionado está bloqueado por convenio'
      } else if (errorMessage.includes('fecha pasada')) {
        mensaje = 'No se puede agendar una cirugía en una fecha pasada'
      } else {
        mensaje = errorMessage
      }

      showError(mensaje)
    },
  })

  // Reagendar una cirugía existente usando el horario propuesto por el médico
  const reagendarConHorarioDelMedico = useMutation({
    mutationFn: async ({ solicitudId, fecha, operatingRoomId, horaInicio, horaFin }) => {
      const normalizarHora = (hora) => {
        if (!hora) return null
        if (typeof hora === 'string') {
          return hora.length === 5 ? `${hora}:00` : hora
        }
        return hora
      }

      const horaInicioNorm = normalizarHora(horaInicio)
      let horaFinNorm = normalizarHora(horaFin)

      if (!horaFinNorm && horaInicioNorm) {
        const [h, m, s] = horaInicioNorm.split(':').map(Number)
        const base = new Date()
        base.setHours(h, m ?? 0, s ?? 0, 0)
        base.setHours(base.getHours() + 1)
        horaFinNorm = `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}:00`
      }

      const { data: cirugia, error: cirugiaError } = await supabase
        .from('surgeries')
        .select('id')
        .eq('surgery_request_id', solicitudId)
        .is('deleted_at', null)
        .maybeSingle()

      if (cirugiaError) throw cirugiaError
      if (!cirugia?.id) throw new Error('No hay cirugía programada para esta solicitud.')

      const { error: updateError } = await supabase
        .from('surgeries')
        .update({
          fecha,
          hora_inicio: horaInicioNorm,
          hora_fin: horaFinNorm,
          operating_room_id: operatingRoomId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cirugia.id)

      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['solicitudes'])
      queryClient.invalidateQueries(['solicitudes-pendientes'])
      queryClient.invalidateQueries(['cirugias-hoy'])
      queryClient.invalidateQueries(['cirugias-calendario'])
      queryClient.invalidateQueries(['calendario-anual-cirugias'])
      setSolicitudAceptandoHorario(null)
      showSuccess('Horario del médico aceptado y cirugía reagendada')
    },
    onError: (error) => {
      logger.errorWithContext('Error al reagendar con horario del médico (onError)', error)
      const msg = error.message || error.toString() || 'Error desconocido'
      if (msg.includes('solapamiento') || msg.includes('overlap') || msg.includes('Ya existe')) {
        showError('Ya existe una cirugía en ese horario. Elija otro horario.')
      } else if (msg.includes('bloqueado') || msg.includes('blocked')) {
        showError('El horario está bloqueado.')
      } else {
        showError('Error al aceptar el horario del médico: ' + msg)
      }
    },
  })

  // Buscar el primer horario preferido utilizable (1°, 2° o extra)
  const obtenerHorarioPreferido = (solicitud) => {
    if (!solicitud || solicitud.dejar_fecha_a_pabellon) return null

    if (solicitud.fecha_preferida && solicitud.hora_recomendada && solicitud.operating_room_id_preferido) {
      return {
        fecha: solicitud.fecha_preferida,
        horaInicio: solicitud.hora_recomendada,
        horaFin: solicitud.hora_fin_recomendada || null,
        operatingRoomId: solicitud.operating_room_id_preferido,
      }
    }

    if (solicitud.fecha_preferida_2 && solicitud.hora_recomendada_2 && solicitud.operating_room_id_preferido_2) {
      return {
        fecha: solicitud.fecha_preferida_2,
        horaInicio: solicitud.hora_recomendada_2,
        horaFin: solicitud.hora_fin_recomendada_2 || null,
        operatingRoomId: solicitud.operating_room_id_preferido_2,
      }
    }

    const extras = Array.isArray(solicitud.horarios_preferidos_extra)
      ? solicitud.horarios_preferidos_extra
      : []
    const extraValido = extras.find(
      h => h?.fecha_preferida && h?.hora_recomendada && h?.operating_room_id
    )
    if (extraValido) {
      return {
        fecha: extraValido.fecha_preferida,
        horaInicio: extraValido.hora_recomendada,
        horaFin: extraValido.hora_fin_recomendada || null,
        operatingRoomId: extraValido.operating_room_id,
      }
    }

    return null
  }

  const tieneHorarioPreferido = (solicitud) => Boolean(obtenerHorarioPreferido(solicitud))

  // Aceptar directamente el horario definido por el médico (sin pasar por el calendario)
  const handleAceptarHorarioMedico = (solicitud) => {
    const horario = obtenerHorarioPreferido(solicitud)
    if (!horario) {
      showError('La solicitud no tiene un horario preferido válido para aceptar.')
      return
    }

    setSolicitudAceptandoHorario(solicitud)

    if (solicitud.estado === 'aceptada') {
      reagendarConHorarioDelMedico.mutate({
        solicitudId: solicitud.id,
        fecha: horario.fecha,
        operatingRoomId: horario.operatingRoomId,
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
      })
      return
    }

    programarConHorarioDelMedico.mutate({
      solicitud,
      solicitudId: solicitud.id,
      fecha: horario.fecha,
      operatingRoomId: horario.operatingRoomId,
      horaInicio: horario.horaInicio,
      horaFin: horario.horaFin,
    })
  }

  const handleAceptarYProgramar = (solicitud) => {
    // Guardar la solicitud en sessionStorage para que el calendario la pueda recuperar
    sessionStorage.setItem('solicitud_gestionando', JSON.stringify(solicitud))
    // Navegar al calendario
    navigate('/pabellon/calendario')
  }

  // Notificar al doctor que pabellón debe reagendar antes de abrir el calendario
  const notificarDoctorPorReagendamiento = async (solicitud) => {
    const doctorUserId = solicitud?.doctors?.user_id
    if (!doctorUserId) return

    const nombrePaciente = `${solicitud?.patients?.nombre || ''} ${solicitud?.patients?.apellido || ''}`.trim() || 'el paciente'
    const mensaje = `Pabellón no pudo aceptar el horario propuesto para ${nombrePaciente}. Se iniciará el proceso de reagendamiento.`

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: doctorUserId,
        tipo: 'solicitud_reagendamiento',
        titulo: 'Pabellón reagendará la cirugía',
        mensaje,
        relacionado_con: solicitud.id,
      })

    if (error) throw error
  }

  // Ir al calendario para reagendar (solicitud ya programada; el doctor pidió cambio de fecha/hora)
  const handleReagendar = async (solicitud) => {
    try {
      await notificarDoctorPorReagendamiento(solicitud)
    } catch (error) {
      logger.errorWithContext('Error al notificar al doctor sobre reagendamiento', error)
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      showError('No se pudo notificar al doctor: ' + errorMessage)
    }

    sessionStorage.setItem('reagendar_solicitud_id', solicitud.id)
    navigate('/pabellon/calendario', { state: { reagendar: true, surgeryRequestId: solicitud.id } })
  }

  const handleProgramar = (e) => {
    e.preventDefault()
    if (solicitudProgramando) {
      // Validar que hora_fin > hora_inicio
      if (formProgramacion.hora_inicio && formProgramacion.hora_fin) {
        const [horaInicioH, horaInicioM] = formProgramacion.hora_inicio.split(':').map(Number)
        const [horaFinH, horaFinM] = formProgramacion.hora_fin.split(':').map(Number)
        const minutosInicio = horaInicioH * 60 + horaInicioM
        const minutosFin = horaFinH * 60 + horaFinM
        
        if (minutosFin <= minutosInicio) {
          showError('La hora de fin debe ser mayor que la hora de inicio')
          return
        }
      }
      
      programarCirugia.mutate({
        solicitudId: solicitudProgramando.id,
        formData: formProgramacion,
      })
    }
  }

  const getEstadoBadge = (estado) => {
    const estados = {
      pendiente: 'bg-yellow-100 text-yellow-800',
      aceptada: 'bg-green-100 text-green-800',
      rechazada: 'bg-red-100 text-red-800',
      cancelada: 'bg-gray-100 text-gray-800',
    }
    return estados[estado] || estados.pendiente
  }

  if (isLoading) {
    return <div className="text-center py-8">Cargando solicitudes...</div>
  }

  // Función para obtener el color del círculo según la prioridad o estado
  const getPriorityColor = (solicitud) => {
    // Si hay campo prioridad, usarlo
    if (solicitud.prioridad === 'alta' || solicitud.prioridad === 'Alta') {
      return 'bg-red-500'
    }
    // Si no hay prioridad, usar rojo para pendientes urgentes o azul para otros
    if (solicitud.estado === 'pendiente' && solicitud.urgencia === 'alta') {
      return 'bg-red-500'
    }
    return 'bg-blue-500'
  }

  // Función para obtener el badge de prioridad
  const getPriorityBadge = (solicitud) => {
    // Si hay campo prioridad, usarlo
    if (solicitud.prioridad === 'alta' || solicitud.prioridad === 'Alta') {
      return { text: 'PRIORIDAD ALTA', bg: 'bg-red-500', textColor: 'text-white' }
    }
    // Si no hay prioridad, determinar por estado o urgencia
    if (solicitud.estado === 'pendiente' && solicitud.urgencia === 'alta') {
      return { text: 'PRIORIDAD ALTA', bg: 'bg-red-500', textColor: 'text-white' }
    }
    return { text: 'PRIORIDAD MEDIA', bg: 'bg-blue-500', textColor: 'text-white' }
  }

  // Obtener inicial del paciente
  const getInitial = (nombre) => {
    return nombre?.charAt(0).toUpperCase() || '?'
  }

  // Obtener nombre del procedimiento desde código
  const getProcedureName = (codigo) => {
    const codigoObj = codigosOperaciones.find(c => c.codigo === codigo)
    return codigoObj?.nombre || codigo
  }


  return (
    <div className="animate-in fade-in slide-in-from-right duration-500 max-w-5xl mx-auto px-4 sm:px-6 lg:px-0">
      {/* Header centrado */}
      <div className="mb-6 sm:mb-8 lg:mb-10 text-center">
        <h2 className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter uppercase mb-2 ${
          theme === 'dark' ? 'text-white' : 'text-slate-900'
        }`}>
          BANDEJA DE SOLICITUDES
        </h2>
        <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest ${
          theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
        }`}>
          MÉDICOS PENDIENTES DE AGENDAMIENTO
        </p>
      </div>

      {/* Búsqueda y Filtros Avanzados */}
      <div className="mb-6 sm:mb-8 space-y-3 sm:space-y-4">
        {/* Campo de Búsqueda */}
        <div className="relative">
          <Search className={`absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
          }`} />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(sanitizeString(e.target.value))}
            placeholder="Buscar por paciente, RUT, doctor o código..."
            aria-label="Buscar solicitudes"
            className={`w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 border-2 rounded-xl sm:rounded-2xl focus:border-blue-500 focus:outline-none font-bold text-sm sm:text-base transition-all touch-manipulation ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                : theme === 'medical'
                ? 'bg-white border-blue-200 text-slate-700 placeholder-slate-400'
                : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Filtros Múltiples */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1.5 sm:mb-2 block ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
            }`}>
              Filtro por Doctor
            </label>
            <select
              value={filtroDoctor}
              onChange={(e) => setFiltroDoctor(sanitizeString(e.target.value))}
              className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 rounded-lg sm:rounded-xl focus:border-blue-500 focus:outline-none font-bold text-sm sm:text-base touch-manipulation ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : theme === 'medical'
                  ? 'bg-white border-blue-200 text-slate-700'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <option value="todos">Todos los doctores</option>
              {doctoresUnicos.map(doctor => (
                <option key={doctor.id} value={doctor.id}>
                  Dr. {doctor.nombre} {doctor.apellido}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1.5 sm:mb-2 block ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
            }`}>
              Filtro por Código de Operación
            </label>
            <select
              value={filtroCodigoOperacion}
              onChange={(e) => setFiltroCodigoOperacion(sanitizeString(e.target.value))}
              className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 rounded-lg sm:rounded-xl focus:border-blue-500 focus:outline-none font-bold text-sm sm:text-base touch-manipulation ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : theme === 'medical'
                  ? 'bg-white border-blue-200 text-slate-700'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <option value="todos">Todos los códigos</option>
              {codigosUnicos.map(codigo => {
                const codigoObj = codigosOperaciones.find(c => c.codigo === codigo)
                return (
                  <option key={codigo} value={codigo}>
                    {codigo} - {codigoObj?.nombre || codigo}
                  </option>
                )
              })}
            </select>
          </div>

          <div>
            <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1.5 sm:mb-2 block ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
            }`}>
              Filtro por Estado
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(sanitizeString(e.target.value))}
              className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 rounded-lg sm:rounded-xl focus:border-blue-500 focus:outline-none font-bold text-sm sm:text-base touch-manipulation ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : theme === 'medical'
                  ? 'bg-white border-blue-200 text-slate-700'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <option value="todas">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="aceptada">Aceptadas</option>
              <option value="rechazada">Rechazadas</option>
            </select>
          </div>
        </div>

        {/* Contador de resultados */}
        {busqueda || filtroDoctor !== 'todos' || filtroCodigoOperacion !== 'todos' || filtroEstado !== 'todas' ? (
          <div className={`text-xs sm:text-sm font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Mostrando {solicitudesFiltradas.length} de {solicitudes.length} solicitudes
          </div>
        ) : null}
      </div>

      {/* Filtros con chips animados */}
      <div className="mb-6 sm:mb-8 flex flex-wrap justify-center gap-2 sm:gap-3">
        {[
          { value: 'todas', label: 'Todas', count: solicitudes.length },
          { value: 'pendiente', label: 'Pendientes', count: solicitudes.filter(s => s.estado === 'pendiente').length },
          { value: 'aceptada', label: 'Aceptadas', count: solicitudes.filter(s => s.estado === 'aceptada').length },
        ].map((filtro) => (
          <motion.button
            key={filtro.value}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFiltroEstado(filtro.value)}
            className={`
              px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest
              transition-all flex items-center gap-1.5 sm:gap-2 touch-manipulation active:scale-95
              ${filtroEstado === filtro.value
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-blue-300'
              }
            `}
          >
            <span>{filtro.label}</span>
            <span className={`
              px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px]
              ${filtroEstado === filtro.value
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-600'
              }
            `}>
              {filtro.count}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Tarjetas de solicitudes */}
      <div className="grid gap-4 sm:gap-6">
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : solicitudesFiltradas.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No hay solicitudes"
            description={filtroEstado === 'todas' 
              ? "No se encontraron solicitudes en el sistema"
              : `No hay solicitudes con estado "${filtroEstado}"`
            }
          />
        ) : (
          solicitudesFiltradas.map((solicitud) => {
              const initial = getInitial(solicitud.patients?.nombre)
              const priorityColor = getPriorityColor(solicitud)
              const priorityBadge = getPriorityBadge(solicitud)
              const procedureName = getProcedureName(solicitud.codigo_operacion)
              
              return (
                <div
                  key={solicitud.id}
                  className={`rounded-2xl sm:rounded-[2rem] border shadow-sm p-4 sm:p-6 lg:p-8 flex flex-col sm:flex-row items-center justify-between hover:shadow-xl transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-700'
                      : theme === 'medical'
                      ? 'bg-white border-blue-100'
                      : 'bg-white border-slate-100'
                  }`}
                >
                  {/* Lado izquierdo: Círculo con inicial */}
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 ${priorityColor} rounded-full flex items-center justify-center font-black text-base sm:text-lg text-white shadow-inner mb-3 sm:mb-0 flex-shrink-0`}>
                    {initial}
                  </div>

                  {/* Centro: Información del paciente */}
                  <div className="flex-1 mx-0 sm:mx-4 lg:mx-6 mb-3 sm:mb-0 min-w-0 w-full sm:w-auto text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 mb-2">
                      <h4 className={`text-lg sm:text-xl font-black tracking-tight truncate w-full sm:w-auto ${
                        theme === 'dark' ? 'text-white' : 'text-slate-800'
                      }`}>
                        {solicitud.patients?.nombre} {solicitud.patients?.apellido}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest ${priorityBadge.bg} ${priorityBadge.textColor} flex-shrink-0`}>
                        {priorityBadge.text}
                      </span>
                    </div>
                    <div className={`text-[10px] sm:text-xs font-bold mt-1 uppercase tracking-widest break-words sm:break-normal ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {procedureName} • <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>Dr. {solicitud.doctors?.apellido || solicitud.doctors?.nombre} {solicitud.doctors?.apellido}</span>
                    </div>
                    {/* Aviso: el doctor pidió reagendamiento */}
                    {solicitud.reagendamiento_notificado_at && (
                      <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 w-fit ${
                        theme === 'dark' ? 'bg-amber-900/40 text-amber-200 border border-amber-700' : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}>
                        <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>El doctor solicitó reagendamiento ({format(new Date(solicitud.reagendamiento_notificado_at), 'dd/MM/yyyy HH:mm')})</span>
                      </div>
                    )}
                  </div>

                  {/* Lado derecho: Botones */}
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-end">
                    {/* Botón Ver Detalles */}
                    <button
                      onClick={() => setSolicitudDetalle(solicitud)}
                      className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl transition-all border touch-manipulation active:scale-95 ${
                        theme === 'dark'
                          ? 'text-blue-400 hover:bg-blue-900/30 border-blue-800 hover:border-blue-600'
                          : theme === 'medical'
                          ? 'text-blue-600 hover:bg-blue-50 border-blue-100 hover:border-blue-300'
                          : 'text-blue-600 hover:bg-blue-50 border-blue-100 hover:border-blue-300'
                      }`}
                      title="Ver detalles"
                      aria-label="Ver detalles de la solicitud"
                    >
                      <Eye className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                    </button>
                    
                    {/* Botón Reagendar: cuando el doctor pidió reagendamiento y la solicitud ya está aceptada/programada */}
                    {solicitud.estado === 'aceptada' && solicitud.reagendamiento_notificado_at && (
                      <>
                        {tieneHorarioPreferido(solicitud) && (
                          <button
                            onClick={() => handleAceptarHorarioMedico(solicitud)}
                            disabled={programarConHorarioDelMedico.isPending || reagendarConHorarioDelMedico.isPending}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-[0.15em] shadow-lg active:scale-95 transition-all touch-manipulation flex items-center gap-2"
                            title="Aceptar horario propuesto por el médico"
                          >
                            {reagendarConHorarioDelMedico.isPending && solicitudAceptandoHorario?.id === solicitud.id ? (
                              <>
                                <LoadingSpinner size="sm" />
                                Aceptando horario...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                ACEPTAR HORARIO MÉDICO
                              </>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleReagendar(solicitud)}
                          className="bg-amber-500 hover:bg-amber-600 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-[0.15em] shadow-lg active:scale-95 transition-all touch-manipulation flex items-center gap-2"
                          title="Cambiar fecha/hora de la cirugía"
                        >
                          <CalendarClock className="w-4 h-4" />
                          REAGENDAR
                        </button>
                      </>
                    )}
                    {/* Botones de gestión de cupo */}
                    {solicitud.estado === 'pendiente' && (
                      <>
                        {tieneHorarioPreferido(solicitud) && (
                          <button
                            onClick={() => handleAceptarHorarioMedico(solicitud)}
                            disabled={programarConHorarioDelMedico.isPending || reagendarConHorarioDelMedico.isPending}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 sm:px-5 lg:px-6 py-2.5 sm:py-3 lg:py-3.5 rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-[0.15em] shadow-lg active:scale-95 transition-all touch-manipulation flex-1 sm:flex-initial flex items-center justify-center gap-2"
                          >
                            {programarConHorarioDelMedico.isPending && solicitudAceptandoHorario?.id === solicitud.id ? (
                              <>
                                <LoadingSpinner size="sm" />
                                Aceptando horario...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                ACEPTAR HORARIO MÉDICO
                              </>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleAceptarYProgramar(solicitud)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-3.5 rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-[0.15em] shadow-lg active:scale-95 transition-all touch-manipulation flex-1 sm:flex-initial"
                        >
                          GESTIONAR CUPO
                        </button>
                        <button
                          onClick={() => { setSolicitudARechazar(solicitud); setShowConfirmRechazar(true) }}
                          className="bg-red-600 hover:bg-red-700 text-white p-2.5 sm:p-3 rounded-lg sm:rounded-xl shadow-lg active:scale-95 transition-all touch-manipulation"
                          title="Rechazar solicitud"
                          aria-label="Rechazar solicitud"
                        >
                          <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
        )}
      </div>

      {/* Modal de Detalles */}
      {solicitudDetalle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Detalles de la Solicitud"
            className={`rounded-[2rem] p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar ${
            theme === 'dark'
              ? 'bg-slate-800'
              : theme === 'medical'
              ? 'bg-white'
              : 'bg-white'
          }`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-black uppercase tracking-tight ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>Detalles de la Solicitud</h2>
              <button
                onClick={() => setSolicitudDetalle(null)}
                className={`p-2 rounded-xl transition-colors ${
                  theme === 'dark'
                    ? 'hover:bg-slate-700'
                    : 'hover:bg-slate-100'
                }`}
                aria-label="Cerrar detalles"
              >
                <X className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                }`} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Información del Paciente */}
              <div className={`rounded-2xl p-6 border ${
                theme === 'dark'
                  ? 'bg-slate-700/50 border-slate-600'
                  : theme === 'medical'
                  ? 'bg-blue-50 border-blue-100'
                  : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
                  }`}>
                    <User className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <h3 className={`text-lg font-black uppercase tracking-tight ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>Información del Paciente</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-xs font-black uppercase tracking-wider mb-1 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
                    }`}>Nombre Completo</p>
                    <p className={`text-sm font-bold ${
                      theme === 'dark' ? 'text-white' : 'text-slate-700'
                    }`}>
                      {solicitudDetalle.patients?.nombre} {solicitudDetalle.patients?.apellido}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-black uppercase tracking-wider mb-1 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
                    }`}>RUT</p>
                    <p className={`text-sm font-bold ${
                      theme === 'dark' ? 'text-white' : 'text-slate-700'
                    }`}>{solicitudDetalle.patients?.rut}</p>
                  </div>
                </div>
              </div>

              {/* Información del Doctor */}
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <Stethoscope className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Información del Doctor</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Nombre Completo</p>
                    <p className="text-sm font-bold text-slate-700">
                      {solicitudDetalle.doctors?.nombre} {solicitudDetalle.doctors?.apellido}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Especialidad</p>
                    <p className="text-sm font-bold text-slate-700 capitalize">
                      {solicitudDetalle.doctors?.especialidad?.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Estado</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      solicitudDetalle.doctors?.estado === 'activo' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {solicitudDetalle.doctors?.estado}
                    </span>
                  </div>
                </div>
              </div>

              {/* Información de la Operación */}
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Información de la Operación</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Código de Operación</p>
                    <p className="text-sm font-bold text-slate-700">{solicitudDetalle.codigo_operacion}</p>
                    {(() => {
                      const operacion = codigosOperaciones.find(op => op.codigo === solicitudDetalle.codigo_operacion)
                      return operacion ? (
                        <div className="mt-2">
                          <p className="text-xs font-bold text-slate-600">{operacion.nombre}</p>
                          {operacion.descripcion && (
                            <p className="text-xs text-slate-500 mt-1">{operacion.descripcion}</p>
                          )}
                        </div>
                      ) : null
                    })()}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                      {solicitudDetalle.fecha_preferida ? 'Horario solicitado (slot vacío)' : 'Hora Recomendada'}
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                      {solicitudDetalle.fecha_preferida ? (
                        <>
                          {format(new Date(solicitudDetalle.fecha_preferida), 'dd/MM/yyyy')}
                          {solicitudDetalle.hora_recomendada && (
                            <> · {typeof solicitudDetalle.hora_recomendada === 'string' ? solicitudDetalle.hora_recomendada.slice(0, 5) : solicitudDetalle.hora_recomendada}
                              {solicitudDetalle.hora_fin_recomendada && `–${typeof solicitudDetalle.hora_fin_recomendada === 'string' ? solicitudDetalle.hora_fin_recomendada.slice(0, 5) : solicitudDetalle.hora_fin_recomendada}`}
                            </>
                          )}
                        </>
                      ) : (
                        solicitudDetalle.hora_recomendada ? (typeof solicitudDetalle.hora_recomendada === 'string' ? solicitudDetalle.hora_recomendada.slice(0, 5) : solicitudDetalle.hora_recomendada) : 'No especificada'
                      )}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Estado</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getEstadoBadge(solicitudDetalle.estado)}`}>
                      {solicitudDetalle.estado}
                    </span>
                  </div>
                  {solicitudDetalle.observaciones && (
                    <div className="col-span-2">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Observaciones</p>
                      <p className="text-sm text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
                        {solicitudDetalle.observaciones}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Insumos Requeridos */}
              {solicitudDetalle.surgery_request_supplies && solicitudDetalle.surgery_request_supplies.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                      <Package className="w-5 h-5 text-orange-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Insumos Requeridos</h3>
                  </div>
                  <div className="space-y-2">
                    {solicitudDetalle.surgery_request_supplies.map((item, idx) => (
                      <div key={idx} className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-700">{item.supplies?.nombre}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-500">Código: {item.supplies?.codigo}</span>
                            {item.supplies?.grupo_prestacion && (
                              <span className="text-xs text-blue-600 font-bold">
                                {item.supplies.grupo_prestacion}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">
                            Cantidad: {item.cantidad}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Información Adicional */}
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Información Adicional</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Fecha de Creación</p>
                    <p className="text-sm font-bold text-slate-700">
                      {format(new Date(solicitudDetalle.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Última Actualización</p>
                    <p className="text-sm font-bold text-slate-700">
                      {format(new Date(solicitudDetalle.updated_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSolicitudDetalle(null)}
                className="btn-secondary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Programación - Estilo Gemini */}
      {solicitudProgramando && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Programar Cirugía"
            className="bg-white rounded-[2.5rem] w-full max-w-6xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[95vh]"
          >
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Programar Cirugía</h2>
                <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                  Agendamiento Quirúrgico
                </p>
              </div>
              <button
                onClick={() => {
                  setSolicitudProgramando(null)
                  setFormProgramacion({
                    fecha: '',
                    hora_inicio: '',
                    hora_fin: '',
                    operating_room_id: '',
                    observaciones: '',
                  })
                  // Limpiar sessionStorage
                  sessionStorage.removeItem('solicitud_gestionando')
                  sessionStorage.removeItem('slot_seleccionado')
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                aria-label="Cerrar programación"
              >
                <X size={24} className="text-white" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleProgramar} className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
              {/* Campos de fecha y hora - Estilo Gemini */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha *</label>
                  <input
                    type="date"
                    value={formProgramacion.fecha}
                    onChange={(e) => setFormProgramacion({ ...formProgramacion, fecha: sanitizeString(e.target.value) })}
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3.5 px-5 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                    required
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hora Fin *</label>
                  <select
                    value={formProgramacion.hora_fin ? String(formProgramacion.hora_fin).slice(0, 5) : ''}
                    onChange={(e) => setFormProgramacion({ ...formProgramacion, hora_fin: sanitizeString(e.target.value) })}
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3.5 px-5 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                    required
                  >
                    <option value="">Seleccione hora</option>
                    {HORAS_SELECT.filter(h => !formProgramacion.hora_inicio || h > String(formProgramacion.hora_inicio).slice(0, 5)).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 ml-1">Solo hora (sin minutos)</p>
                </div>
              </div>

              {/* Vista de Calendario de Pabellones - Estilo Gemini EXACTO */}
              {formProgramacion.fecha && (
                <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
                  {/* Sidebar Izquierdo - Solicitud + Leyenda */}
                  <div className="lg:w-80 flex-shrink-0 space-y-6">
                    {/* Panel Solicitud en Curso */}
                    <div className="bg-slate-900 p-8 rounded-[2rem] text-white overflow-hidden relative group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-[60px] opacity-20 transform translate-x-10 -translate-y-10"></div>
                      <div className="relative z-10">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-70 mb-1">
                          Solicitud en curso
                        </h3>
                        {solicitudProgramando ? (
                          <div className="space-y-4 mt-4">
                            <div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Paciente</div>
                              <div className="text-xl font-black uppercase tracking-tighter leading-tight">
                                {solicitudProgramando.patients?.nombre} {solicitudProgramando.patients?.apellido}
                              </div>
                              <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                                RUT: {solicitudProgramando.patients?.rut}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
                              <Activity size={16} className="text-blue-500" />
                              <span className="text-[10px] font-bold uppercase tracking-widest truncate">
                                {solicitudProgramando.codigo_operacion}
                              </span>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Cirujano: <span className="text-white">{solicitudProgramando.doctors?.nombre} {solicitudProgramando.doctors?.apellido}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm font-medium opacity-50 mt-2">Navegación libre por disponibilidad</p>
                        )}
                      </div>
                    </div>

                    {/* Panel Leyenda */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 p-6">
                      <h4 className="text-[10px] font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-[0.2em]">
                        <span className="w-4 h-4 rounded-md bg-blue-50 flex items-center justify-center text-blue-500 text-xs">?</span>
                        Leyenda
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full border-2 border-slate-200"></div>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Disponible</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-red-50 border-2 border-red-100"></div>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ocupado</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-slate-900"></div>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Prioridad / Convenio</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grid Principal - Estilo EXACTO de la imagen */}
                  <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm overflow-hidden relative flex flex-col">
                    {/* Header del Grid con fondo gris claro - SIEMPRE 4 COLUMNAS */}
                    <div className="flex bg-slate-50 border-b border-slate-200 mb-0 flex-shrink-0">
                      <div className="w-24 border-r border-slate-200 flex-shrink-0 flex items-center justify-center py-6">
                        <Clock size={18} className="text-slate-400" />
                      </div>
                      {/* Mostrar siempre 4 columnas */}
                      {Array.from({ length: 4 }).map((_, index) => {
                        const p = pabellonesMostrar[index]
                        if (!p) {
                          // Si no hay pabellón en esta posición, mostrar columna vacía
                          return (
                            <div key={`empty-${index}`} className="flex-1 text-center py-6 border-r last:border-r-0 bg-slate-50/50">
                              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider leading-none">
                                Pabellón {index + 1}
                              </h4>
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mt-1.5 block">
                                No disponible
                              </span>
                            </div>
                          )
                        }
                        
                        // Calcular libres correctamente: slots totales menos los ocupados
                        const ocupados = slotsHorarios.filter(time => {
                          const { status } = getSlotStatus(p.id, time)
                          return status === 'occupied' || status === 'blocked'
                        }).length
                        const libres = slotsHorarios.length - ocupados
                        
                        return (
                          <div key={p.id} className="flex-1 text-center py-6 border-r last:border-r-0">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider leading-none">
                              {p.nombre}
                            </h4>
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider mt-1.5 block">
                              {libres} Libres
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Filas de horarios con scroll */}
                    <div className={`flex-1 overflow-y-auto custom-scrollbar bg-white ${formProgramacion.operating_room_id && formProgramacion.hora_inicio ? 'pb-24' : ''}`}>
                      {slotsHorarios.map((time) => {
                        const horaSeleccionada = formProgramacion.hora_inicio === time
                        
                        return (
                          <div key={time} className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors group">
                            <div className="w-24 border-r border-slate-200 flex-shrink-0 flex items-center justify-center py-10 text-[10px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors uppercase tracking-widest">
                              {time}
                            </div>
                            {/* Mostrar siempre 4 columnas */}
                            {Array.from({ length: 4 }).map((_, index) => {
                              const pav = pabellonesMostrar[index]
                              
                              if (!pav) {
                                // Si no hay pabellón, mostrar celda vacía/deshabilitada
                                return (
                                  <div
                                    key={`${time}-empty-${index}`}
                                    className="flex-1 min-h-[110px] border-r last:border-r-0 p-2.5 bg-slate-50/30"
                                  >
                                    <div className="h-full w-full flex items-center justify-center border-2 border-dashed rounded-2xl border-slate-100 opacity-50">
                                      <span className="text-[8px] text-slate-300 font-black uppercase tracking-widest">
                                        N/A
                                      </span>
                                    </div>
                                  </div>
                                )
                              }
                              
                              const { status, data } = getSlotStatus(pav.id, time)
                              const isSelected = formProgramacion.operating_room_id === pav.id && horaSeleccionada
                              const isOccupied = status === 'occupied' || status === 'blocked'
                              
                              return (
                                <div
                                  key={`${time}-${pav.id}`}
                                  onClick={() => {
                                    if (isOccupied) {
                                      if (status === 'occupied') {
                                        showError('Este horario ya está ocupado por otra cirugía')
                                      } else if (status === 'blocked') {
                                        showError('Este horario está bloqueado por convenio')
                                      }
                                      return
                                    }
                                    setFormProgramacion({ 
                                      ...formProgramacion, 
                                      operating_room_id: pav.id,
                                      hora_inicio: time
                                    })
                                  }}
                                  className={`flex-1 min-h-[110px] border-r last:border-r-0 p-2.5 transition-all ${
                                    isOccupied ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50/30'
                                  }`}
                                >
                                  {status === 'occupied' ? (
                                    <div className="h-full w-full bg-red-50 rounded-2xl border border-red-100 p-4 flex flex-col justify-between shadow-sm">
                                      <span className="text-[10px] font-black text-red-500 uppercase tracking-wider mb-1">Ocupado</span>
                                      <span className="text-xs font-bold text-red-900 leading-tight truncate">
                                        {data.doctors?.apellido ? `Dr. ${data.doctors.apellido}` : data.doctors?.nombre ? `Dr. ${data.doctors.nombre}` : 'Cirugía'}
                                      </span>
                                    </div>
                                  ) : status === 'blocked' ? (
                                    <div className="h-full w-full bg-slate-900 rounded-2xl border-2 border-amber-400/50 p-4 flex flex-col justify-between shadow-lg">
                                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider leading-none flex items-center gap-1">
                                        <Lock size={8} /> Convenio
                                      </span>
                                      <span className="text-[11px] font-black text-white uppercase tracking-tighter leading-tight truncate">
                                        Bloqueado
                                      </span>
                                    </div>
                                  ) : (
                                    <div className={`h-full w-full flex items-center justify-center border-2 border-dashed rounded-2xl transition-all duration-300 ${
                                      isSelected 
                                        ? 'border-blue-500 bg-blue-50 scale-[0.97] shadow-inner' 
                                        : 'border-slate-200 group-hover:border-slate-300'
                                    }`}>
                                      {isSelected && (
                                        <CheckCircle2 size={36} className="text-blue-500 animate-in zoom-in duration-300" />
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>

                    
                    {/* Footer flotante cuando hay selección */}
                    {formProgramacion.operating_room_id && formProgramacion.hora_inicio && (
                      <div className="absolute bottom-0 left-0 right-0 bg-slate-900 text-white p-6 flex items-center justify-between animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
                        <div className="flex items-center gap-6">
                          <div className="bg-blue-600 p-4 rounded-2xl">
                            <Activity size={24} />
                          </div>
                          <div>
                            <div className="text-[9px] text-blue-400 font-black uppercase tracking-[0.3em] mb-1">
                              Bloque Seleccionado
                            </div>
                            <div className="font-black text-xl uppercase tracking-tighter">
                              {pabellonesMostrar.find(p => p.id === formProgramacion.operating_room_id)?.nombre || 'Pabellón'} 
                              <span className="text-slate-600 mx-3">•</span> 
                              {formProgramacion.hora_inicio}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const pabellon = pabellonesMostrar.find(p => p.id === formProgramacion.operating_room_id)
                            if (pabellon && formProgramacion.hora_inicio) {
                              // Calcular hora fin (asumiendo 1 hora por defecto, máx 19:00 exacto)
                              const [hours, minutes] = formProgramacion.hora_inicio.split(':')
                              const finMinutos = Math.min(parseInt(hours) * 60 + parseInt(minutes) + 60, 19 * 60)
                              const horaFinStr = `${Math.floor(finMinutos / 60).toString().padStart(2, '0')}:${(finMinutos % 60).toString().padStart(2, '0')}`
                              
                              setFormProgramacion(prev => ({
                                ...prev,
                                hora_fin: horaFinStr
                              }))
                            }
                          }}
                          className="bg-blue-500 hover:bg-blue-400 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all"
                        >
                          Proceder al agendamiento
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Select de Pabellón - Estilo Gemini (solo si no se seleccionó desde el calendario) */}
              {!formProgramacion.operating_room_id && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Seleccionar Pabellón Manualmente *
                  </label>
                  <select
                    value={formProgramacion.operating_room_id}
                    onChange={(e) => setFormProgramacion({ ...formProgramacion, operating_room_id: sanitizeString(e.target.value) })}
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3.5 px-5 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                    required
                  >
                    <option value="">-- Seleccionar Pabellón --</option>
                    {pabellones.map(pabellon => {
                      // Verificar si está ocupado en la hora seleccionada
                      let estaOcupado = false
                      if (formProgramacion.fecha && formProgramacion.hora_inicio) {
                        const cirugiaOcupada = cirugiasFecha.find(c => 
                          c.operating_room_id === pabellon.id &&
                          c.hora_inicio <= formProgramacion.hora_inicio + ':00' && 
                          c.hora_fin > formProgramacion.hora_inicio + ':00'
                        )
                        const bloqueo = bloqueosFecha.find(b => 
                          b.operating_room_id === pabellon.id &&
                          b.hora_inicio <= formProgramacion.hora_inicio + ':00' && 
                          b.hora_fin > formProgramacion.hora_inicio + ':00'
                        )
                        estaOcupado = !!cirugiaOcupada || !!bloqueo
                      }
                      
                      return (
                        <option 
                          key={pabellon.id} 
                          value={pabellon.id}
                          disabled={estaOcupado}
                        >
                          {pabellon.nombre} {estaOcupado ? '(Ocupado)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              {/* Campo de Observaciones - Estilo Gemini */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Observaciones
                </label>
                <textarea
                  value={formProgramacion.observaciones}
                    onChange={(e) => setFormProgramacion({ ...formProgramacion, observaciones: sanitizeString(e.target.value) })}
                  className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-3.5 px-5 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 resize-none"
                  rows={3}
                  placeholder="Notas adicionales sobre la cirugía..."
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {formProgramacion.observaciones?.length || 0}/500 caracteres
                </p>
              </div>

              {/* Botones de Acción - Estilo Gemini */}
              <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSolicitudProgramando(null)
                    setFormProgramacion({
                      fecha: '',
                      hora_inicio: '',
                      hora_fin: '',
                      operating_room_id: '',
                      observaciones: '',
                    })
                    // Limpiar sessionStorage
                    sessionStorage.removeItem('solicitud_gestionando')
                    sessionStorage.removeItem('slot_seleccionado')
                  }}
                  className="px-8 py-3.5 text-slate-400 hover:text-slate-600 font-black text-xs uppercase tracking-widest transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:bg-slate-200 disabled:shadow-none flex items-center justify-center gap-2"
                  disabled={!formProgramacion.operating_room_id || !formProgramacion.fecha || !formProgramacion.hora_inicio || !formProgramacion.hora_fin || programarCirugia.isPending}
                >
                  {programarCirugia.isPending ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Programando...
                    </>
                  ) : (
                    'Programar Cirugía'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Rechazar */}
      <Modal
        isOpen={showConfirmRechazar}
        onClose={() => {
          setShowConfirmRechazar(false)
          setSolicitudARechazar(null)
        }}
        title="Confirmar Rechazo"
      >
        {solicitudARechazar && (
          <div className="space-y-6">
            <p className="text-slate-700">
              ¿Está seguro de que desea rechazar la solicitud de{' '}
              <span className="font-black">
                {solicitudARechazar.patients?.nombre} {solicitudARechazar.patients?.apellido}
              </span>?
            </p>
            <p className="text-sm text-slate-500">
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-4 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowConfirmRechazar(false)
                  setSolicitudARechazar(null)
                }}
                disabled={rechazarSolicitud.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarRechazar}
                loading={rechazarSolicitud.isPending}
                disabled={rechazarSolicitud.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                Confirmar Rechazo
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
