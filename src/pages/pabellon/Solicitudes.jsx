import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { X, FileText, CheckSquare, Square, Download } from 'lucide-react'
import { format } from 'date-fns'
import { useNotifications } from '../../hooks/useNotifications'
import { useDebounce } from '../../hooks/useDebounce'
import { useTheme } from '../../contexts/ThemeContext'
import { logger } from '../../utils/logger'
import { exportToExcel } from '../../utils/exportData'
import EmptyState from '../../components/common/EmptyState'
import { TableSkeleton } from '../../components/common/Skeleton'

import FiltrosSolicitudes from './solicitudes/FiltrosSolicitudes'
import SolicitudCard from './solicitudes/SolicitudCard'
import ModalDetalle from './solicitudes/ModalDetalle'
import ModalProgramar from './solicitudes/ModalProgramar'
import ModalRechazar from './solicitudes/ModalRechazar'
import ModalCompletar from './solicitudes/ModalCompletar'
import ModalCancelarCirugia from './solicitudes/ModalCancelarCirugia'
import ModalInsumosAlert from './solicitudes/ModalInsumosAlert'
import ModalBulkRechazar from './solicitudes/ModalBulkRechazar'

export default function Solicitudes() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { showSuccess, showError, showInfo } = useNotifications()
  const queryClient = useQueryClient()
  const scrollYRef = useRef(0)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [filtroDoctor, setFiltroDoctor] = useState('todos')
  const [filtroCodigoOperacion, setFiltroCodigoOperacion] = useState('todos')
  const [filtroPrevision, setFiltroPrevision] = useState('todas')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const debouncedBusqueda = useDebounce(busqueda, 300)

  // Modales de solicitud
  const [solicitudDetalle, setSolicitudDetalle] = useState(null)
  const [solicitudProgramando, setSolicitudProgramando] = useState(null)
  const [solicitudAceptandoHorario, setSolicitudAceptandoHorario] = useState(null)
  const [formProgramacion, setFormProgramacion] = useState({ fecha: '', hora_inicio: '', hora_fin: '', operating_room_id: '', observaciones: '' })

  // null | { solicitud, motivo: '' }
  const [rechazarModal, setRechazarModal] = useState(null)
  // null | { solicitud, notas: '' }
  const [completarModal, setCompletarModal] = useState(null)
  // null | { solicitud }
  const [cancelarModal, setCancelarModal] = useState(null)
  // null | { insumos: [] }
  const [insumosModal, setInsumosModal] = useState(null)
  // null | { motivo: '' }
  const [bulkModal, setBulkModal] = useState(null)

  const [seleccionados, setSeleccionados] = useState(new Set())

  // Limpiar selección cuando cambia el filtro de estado
  useEffect(() => { setSeleccionados(new Set()) }, [filtroEstado, filtroDoctor, filtroPrevision])

  // Enlace paciente
  const [generandoEnlace, setGenerandoEnlace] = useState(false)
  const [enlaceCopiadoId, setEnlaceCopiadoId] = useState(null)

  // Cargar slot preseleccionado desde calendario
  useEffect(() => {
    try {
      const slotStr = sessionStorage.getItem('slot_seleccionado')
      const solicitudStr = sessionStorage.getItem('solicitud_gestionando')
      if (slotStr && solicitudStr) {
        const slot = JSON.parse(slotStr)
        const solicitud = JSON.parse(solicitudStr)
        // Validar que solicitud.id sea UUID antes de usar
        if (solicitud?.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(solicitud.id)) {
          sessionStorage.removeItem('solicitud_gestionando')
          sessionStorage.removeItem('slot_seleccionado')
          return
        }
        const parsedDate = slot.date ? new Date(slot.date) : null
        if (!parsedDate || isNaN(parsedDate.getTime()) || typeof slot.time !== 'string') {
          sessionStorage.removeItem('solicitud_gestionando')
          sessionStorage.removeItem('slot_seleccionado')
          return
        }
        setSolicitudProgramando(solicitud)
        setFormProgramacion({
          fecha: format(parsedDate, 'yyyy-MM-dd'),
          hora_inicio: slot.time,
          hora_fin: '',
          operating_room_id: slot.pabellonId,
          observaciones: '',
        })
        sessionStorage.removeItem('slot_seleccionado')
        sessionStorage.removeItem('solicitud_gestionando')
      }
    } catch (e) {
      logger.errorWithContext('Error al procesar slot seleccionado', e)
    }
  }, [])

  // ─── Queries ──────────────────────────────────────────────────────────────

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['solicitudes', filtroEstado],
    queryFn: async () => {
      let query = supabase
        .from('surgery_requests')
        .select(`
          *,
          doctors:doctor_id(id, user_id, nombre, apellido, especialidad, estado, telefono),
          patients:patient_id(nombre, apellido, rut, telefono, prevision),
          surgery_request_supplies(
            cantidad,
            supplies:supply_id(nombre, codigo, grupo_prestacion, stock_actual, stock_minimo)
          ),
          surgeries(id, estado, fecha, hora_inicio, hora_fin, operating_rooms:operating_room_id(nombre))
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500)
      if (filtroEstado !== 'todas') query = query.eq('estado', filtroEstado)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  const { data: pabellones = [] } = useQuery({
    queryKey: ['pabellones'],
    queryFn: async () => {
      const { data, error } = await supabase.from('operating_rooms').select('*').eq('activo', true).order('nombre')
      if (error) throw error
      return data
    },
    enabled: !!solicitudProgramando,
  })

  const { data: cirugiasFecha = [] } = useQuery({
    queryKey: ['cirugias-fecha', formProgramacion.fecha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select('*, doctors:doctor_id(nombre, apellido)')
        .eq('fecha', formProgramacion.fecha)
        .is('deleted_at', null)
        .neq('estado', 'cancelada')
      if (error) throw error
      return data
    },
    enabled: !!formProgramacion.fecha && !!solicitudProgramando,
  })

  const { data: bloqueosFecha = [] } = useQuery({
    queryKey: ['bloqueos-fecha', formProgramacion.fecha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('fecha', formProgramacion.fecha)
      if (error) throw error
      return data
    },
    enabled: !!formProgramacion.fecha && !!solicitudProgramando,
  })

  // ─── Memos ────────────────────────────────────────────────────────────────

  const doctoresUnicos = useMemo(() => {
    const map = new Map()
    solicitudes.forEach(s => { if (s.doctors && !map.has(s.doctors.id)) map.set(s.doctors.id, s.doctors) })
    return Array.from(map.values())
  }, [solicitudes])

  const codigosUnicos = useMemo(() => {
    const set = new Set()
    solicitudes.forEach(s => { if (s.codigo_operacion) set.add(s.codigo_operacion) })
    return Array.from(set).sort()
  }, [solicitudes])

  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter(s => {
      if (filtroEstado !== 'todas' && s.estado !== filtroEstado) return false
      if (filtroDoctor !== 'todos' && s.doctors?.id !== filtroDoctor) return false
      if (filtroCodigoOperacion !== 'todos' && s.codigo_operacion !== filtroCodigoOperacion) return false
      if (filtroPrevision !== 'todas' && (s.patients?.prevision || '') !== filtroPrevision) return false
      const fecha = (s.fecha_preferida || s.created_at || '').slice(0, 10)
      if (filtroFechaDesde && fecha < filtroFechaDesde) return false
      if (filtroFechaHasta && fecha > filtroFechaHasta) return false
      if (debouncedBusqueda.trim()) {
        const q = debouncedBusqueda.toLowerCase()
        const paciente = `${s.patients?.nombre || ''} ${s.patients?.apellido || ''}`.toLowerCase()
        const rut = (s.patients?.rut || '').toLowerCase()
        const doctor = `${s.doctors?.nombre || ''} ${s.doctors?.apellido || ''}`.toLowerCase()
        const codigo = (s.codigo_operacion || '').toLowerCase()
        if (!paciente.includes(q) && !rut.includes(q) && !doctor.includes(q) && !codigo.includes(q)) return false
      }
      return true
    })
  }, [solicitudes, filtroEstado, filtroDoctor, filtroCodigoOperacion, filtroPrevision, filtroFechaDesde, filtroFechaHasta, debouncedBusqueda])

  const slotsHorarios = useMemo(() => {
    const slots = []
    for (let h = 7; h < 19; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
    }
    return slots
  }, [])

  const pabellonesMostrar = useMemo(() => pabellones.slice(0, 4), [pabellones])

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getSlotStatus = (pabellonId, time) => {
    const timeWithSec = time + ':00'
    const cirugia = cirugiasFecha.find(c =>
      c.operating_room_id === pabellonId &&
      c.hora_inicio <= timeWithSec &&
      c.hora_fin > timeWithSec
    )
    if (cirugia) return { status: 'occupied', data: cirugia }
    const bloqueo = bloqueosFecha.find(b =>
      b.operating_room_id === pabellonId &&
      b.hora_inicio <= timeWithSec &&
      b.hora_fin > timeWithSec
    )
    if (bloqueo) return { status: 'blocked', data: bloqueo }
    return { status: 'available', data: null }
  }

  const normalizarHora = (hora) => {
    if (!hora) return null
    const str = String(hora)
    return str.length === 5 ? str + ':00' : str
  }

  const obtenerHorarioPreferido = (solicitud) => {
    if (!solicitud || solicitud.dejar_fecha_a_pabellon) return null
    if (solicitud.fecha_preferida && solicitud.hora_recomendada && solicitud.operating_room_id_preferido) {
      return { fecha: solicitud.fecha_preferida, horaInicio: solicitud.hora_recomendada, horaFin: solicitud.hora_fin_recomendada || null, operatingRoomId: solicitud.operating_room_id_preferido }
    }
    if (solicitud.fecha_preferida_2 && solicitud.hora_recomendada_2 && solicitud.operating_room_id_preferido_2) {
      return { fecha: solicitud.fecha_preferida_2, horaInicio: solicitud.hora_recomendada_2, horaFin: solicitud.hora_fin_recomendada_2 || null, operatingRoomId: solicitud.operating_room_id_preferido_2 }
    }
    const extras = Array.isArray(solicitud.horarios_preferidos_extra) ? solicitud.horarios_preferidos_extra : []
    const extra = extras.find(h => h?.fecha_preferida && h?.hora_recomendada && h?.operating_room_id)
    if (extra) return { fecha: extra.fecha_preferida, horaInicio: extra.hora_recomendada, horaFin: extra.hora_fin_recomendada || null, operatingRoomId: extra.operating_room_id }
    return null
  }

  const tieneHorarioPreferido = (solicitud) => Boolean(obtenerHorarioPreferido(solicitud))

  // ─── Mutations ────────────────────────────────────────────────────────────

  const enviarWhatsApp = (solicitud, tipo) => {
    const payload = {
      tipo,
      nombreDoctor: solicitud.doctors ? `${solicitud.doctors.nombre} ${solicitud.doctors.apellido}` : null,
      nombrePaciente: solicitud.patients ? `${solicitud.patients.nombre} ${solicitud.patients.apellido}` : null,
      fechaCirugia: solicitud.hora_recomendada ? format(new Date(solicitud.hora_recomendada), 'dd/MM/yyyy HH:mm') : solicitud.fecha_preferida || null,
      observaciones: solicitud.observaciones || null,
    }
    if (solicitud.doctors?.telefono) {
      supabase.functions.invoke('send-whatsapp', { body: { ...payload, to: solicitud.doctors.telefono, destinatario: 'doctor' } })
        .catch(err => { logger.warn('WhatsApp al médico falló:', err?.message); showInfo('No se pudo enviar WhatsApp al médico.') })
    }
    if (solicitud.patients?.telefono) {
      supabase.functions.invoke('send-whatsapp', { body: { ...payload, to: solicitud.patients.telefono, destinatario: 'paciente' } })
        .catch(err => { logger.warn('WhatsApp al paciente falló:', err?.message); showInfo('No se pudo enviar WhatsApp al paciente.') })
    }
  }

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

  const enviarEmail = (solicitud, tipo) => {
    const esAceptada = tipo === 'aceptada'
    const nombreDoctor = solicitud.doctors ? `${solicitud.doctors.nombre} ${solicitud.doctors.apellido}` : null
    const nombrePaciente = solicitud.patients ? `${solicitud.patients.nombre} ${solicitud.patients.apellido}` : null
    const fechaCirugia = solicitud.hora_recomendada
      ? format(new Date(solicitud.hora_recomendada), 'dd/MM/yyyy HH:mm')
      : solicitud.fecha_preferida || null

    if (solicitud.doctors?.email) {
      const subject = esAceptada
        ? `Cirugía programada — ${esc(nombrePaciente || 'su paciente')}`
        : `Solicitud rechazada — ${esc(nombrePaciente || 'su paciente')}`
      const html = esAceptada
        ? `<h2 style="color:#1e40af">Solicitud de cirugía ACEPTADA ✅</h2>
           <p>Estimado/a Dr/a. <strong>${esc(nombreDoctor)}</strong>,</p>
           <p>Su solicitud quirúrgica ha sido <strong>aceptada y programada</strong>.</p>
           ${nombrePaciente ? `<p><strong>Paciente:</strong> ${esc(nombrePaciente)}</p>` : ''}
           ${fechaCirugia ? `<p><strong>Fecha programada:</strong> ${esc(fechaCirugia)}</p>` : ''}
           ${solicitud.observaciones ? `<p><strong>Observaciones:</strong> ${esc(solicitud.observaciones)}</p>` : ''}
           <p style="color:#6b7280;font-size:12px">Portal Clínico — Mensaje automático</p>`
        : `<h2 style="color:#dc2626">Solicitud de cirugía RECHAZADA ❌</h2>
           <p>Estimado/a Dr/a. <strong>${esc(nombreDoctor)}</strong>,</p>
           <p>Su solicitud quirúrgica <strong>no pudo ser aceptada</strong> en este momento.</p>
           ${nombrePaciente ? `<p><strong>Paciente:</strong> ${esc(nombrePaciente)}</p>` : ''}
           ${solicitud.motivo_rechazo ? `<p><strong>Motivo:</strong> ${esc(solicitud.motivo_rechazo)}</p>` : ''}
           <p>Para más información comuníquese directamente con el equipo de pabellón.</p>
           <p style="color:#6b7280;font-size:12px">Portal Clínico — Mensaje automático</p>`
      supabase.functions.invoke('send-email', { body: { to: solicitud.doctors.email, subject, html } })
        .catch(err => { logger.warn('Email al médico falló:', err?.message); showInfo('No se pudo enviar el email al médico.') })
    }
  }

  const rechazarSolicitud = useMutation({
    mutationFn: async ({ solicitud, motivo }) => {
      const { error } = await supabase
        .from('surgery_requests')
        .update({ estado: 'rechazada', motivo_rechazo: motivo.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', solicitud.id)
      if (error) throw error
      return solicitud
    },
    onMutate: async ({ solicitud }) => {
      await queryClient.cancelQueries({ queryKey: ['solicitudes'] })
      const previousData = queryClient.getQueriesData({ queryKey: ['solicitudes'] })
      queryClient.setQueriesData({ queryKey: ['solicitudes'] }, (old) =>
        (old ?? []).map(s => s.id === solicitud.id ? { ...s, estado: 'rechazada' } : s)
      )
      return { previousData }
    },
    onSuccess: (solicitud) => {
      showSuccess('Solicitud rechazada')
      setRechazarModal(null)
      enviarWhatsApp(solicitud, 'rechazada')
      enviarEmail(solicitud, 'rechazada')
    },
    onError: (error, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
      }
      const msg = error.message || error.toString() || 'Error desconocido'
      showError(msg.includes('Failed to fetch') || msg.includes('NetworkError')
        ? 'Error de conexión. Verifique su conexión a internet e intente nuevamente.'
        : 'Error al rechazar la solicitud: ' + msg
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
      queryClient.invalidateQueries({ queryKey: ['solicitudes-pendientes'] })
    },
  })

  const completarCirugia = useMutation({
    mutationFn: async ({ solicitud, notas }) => {
      const cirugia = solicitud.surgeries?.[0]
      if (!cirugia) throw new Error('No se encontró la cirugía asociada')
      const { error } = await supabase
        .from('surgeries')
        .update({ estado: 'completada', observaciones_post: notas || null, updated_at: new Date().toISOString() })
        .eq('id', cirugia.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-hoy'] })
      setCompletarModal(null)
      showSuccess('Cirugía marcada como completada')
    },
    onError: (error) => showError('Error al completar cirugía: ' + (error.message || 'Error desconocido')),
  })

  const cancelarCirugiaYa = useMutation({
    mutationFn: async ({ solicitud }) => {
      const cirugia = solicitud.surgeries?.[0]
      if (!cirugia) throw new Error('No se encontró la cirugía asociada')
      // Primero actualizamos la solicitud (menos destructivo)
      const { error: errR } = await supabase
        .from('surgery_requests')
        .update({ estado: 'pendiente', updated_at: new Date().toISOString() })
        .eq('id', solicitud.id)
      if (errR) throw errR
      // Luego soft-delete la cirugía; si falla, revertimos la solicitud
      const { error: errS } = await supabase
        .from('surgeries')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', cirugia.id)
      if (errS) {
        await supabase
          .from('surgery_requests')
          .update({ estado: 'aceptada', updated_at: new Date().toISOString() })
          .eq('id', solicitud.id)
        throw errS
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
      queryClient.invalidateQueries({ queryKey: ['solicitudes-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-hoy'] })
      setCancelarModal(null)
      showSuccess('Cirugía cancelada — la solicitud volvió a estado pendiente')
    },
    onError: (error) => showError('Error al cancelar cirugía: ' + (error.message || 'Error desconocido')),
  })

  const rechazarBulk = useMutation({
    mutationFn: async ({ ids, motivo }) => {
      const { error } = await supabase
        .from('surgery_requests')
        .update({ estado: 'rechazada', motivo_rechazo: motivo.trim() || null, updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('estado', 'pendiente')
      if (error) throw error
      return ids.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
      queryClient.invalidateQueries({ queryKey: ['solicitudes-pendientes'] })
      setBulkModal(null)
      setSeleccionados(new Set())
      showSuccess(`${count} solicitud${count !== 1 ? 'es' : ''} rechazada${count !== 1 ? 's' : ''}`)
    },
    onError: (error) => showError('Error al rechazar: ' + (error.message || 'Error desconocido')),
  })

  const programarCirugia = useMutation({
    mutationFn: async ({ solicitudId, solicitud, formData }) => {
      const { data: surgeryData, error: surgeryError } = await supabase
        .from('surgeries')
        .insert({
          surgery_request_id: solicitudId,
          fecha: formData.fecha,
          hora_inicio: normalizarHora(formData.hora_inicio),
          hora_fin: normalizarHora(formData.hora_fin),
          operating_room_id: formData.operating_room_id,
          observaciones: formData.observaciones || null,
          estado: 'programada',
        })
        .select()
        .single()
      if (surgeryError) throw surgeryError
      const { error: requestError } = await supabase
        .from('surgery_requests')
        .update({ estado: 'aceptada', updated_at: new Date().toISOString() })
        .eq('id', solicitudId)
      if (requestError) {
        // Rollback: soft-delete la cirugía recién creada para evitar registro huérfano
        await supabase.from('surgeries')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', surgeryData.id)
        throw requestError
      }
      return { surgeryData, solicitud }
    },
    onSuccess: ({ solicitud }) => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
      queryClient.invalidateQueries({ queryKey: ['solicitudes-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-hoy'] })
      setSolicitudProgramando(null)
      setFormProgramacion({ fecha: '', hora_inicio: '', hora_fin: '', operating_room_id: '', observaciones: '' })
      showSuccess('Cirugía programada exitosamente')
      if (solicitud) {
        enviarWhatsApp(solicitud, 'aceptada')
        enviarEmail(solicitud, 'aceptada')
      }
    },
    onError: (error) => showError('Error al programar cirugía: ' + (error.message || 'Error desconocido')),
  })

  const programarConHorarioDelMedico = useMutation({
    mutationFn: async ({ solicitud, solicitudId, fecha, operatingRoomId, horaInicio, horaFin }) => {
      const horaInicioNorm = normalizarHora(horaInicio)
      const horaFinNorm = horaFin ? normalizarHora(horaFin) : null
      const { error: surgeryError } = await supabase.from('surgeries').insert({
        surgery_request_id: solicitudId,
        fecha,
        hora_inicio: horaInicioNorm,
        hora_fin: horaFinNorm,
        operating_room_id: operatingRoomId,
        estado: 'programada',
      })
      if (surgeryError) throw surgeryError
      const { error: requestError } = await supabase.from('surgery_requests')
        .update({ estado: 'aceptada', updated_at: new Date().toISOString() })
        .eq('id', solicitudId)
      if (requestError) throw requestError
      return { solicitud }
    },
    onSuccess: ({ solicitud }) => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
      queryClient.invalidateQueries({ queryKey: ['solicitudes-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-hoy'] })
      setSolicitudAceptandoHorario(null)
      showSuccess('Horario del médico aceptado y cirugía programada')
      enviarWhatsApp(solicitud, 'aceptada')
      enviarEmail(solicitud, 'aceptada')
    },
    onError: (error) => {
      setSolicitudAceptandoHorario(null)
      showError('Error al aceptar horario: ' + (error.message || 'Error desconocido'))
    },
  })

  const reagendarConHorarioDelMedico = useMutation({
    mutationFn: async ({ solicitudId, fecha, operatingRoomId, horaInicio, horaFin }) => {
      const horaInicioNorm = normalizarHora(horaInicio)
      const horaFinNorm = horaFin ? normalizarHora(horaFin) : null
      const { data: oldSurgeries } = await supabase.from('surgeries')
        .select('id')
        .eq('surgery_request_id', solicitudId)
        .is('deleted_at', null)
      // Insertar PRIMERO la nueva cirugía — solo borrar la vieja si el insert tuvo éxito
      const { error: surgeryError } = await supabase.from('surgeries').insert({
        surgery_request_id: solicitudId,
        fecha,
        hora_inicio: horaInicioNorm,
        hora_fin: horaFinNorm,
        operating_room_id: operatingRoomId,
        estado: 'programada',
      })
      if (surgeryError) throw surgeryError
      if (oldSurgeries?.length) {
        await supabase.from('surgeries')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', oldSurgeries.map(s => s.id))
      }
      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData?.user?.id
      if (currentUserId) {
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: currentUserId,
          tipo: 'operacion_reagendada',
          titulo: 'Cirugía reagendada',
          mensaje: 'La cirugía fue reagendada con el horario propuesto por el médico.',
          relacionado_con: solicitudId,
        })
        if (notifError) logger.warn('No se pudo crear notificación de reagendamiento:', notifError)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-hoy'] })
      setSolicitudAceptandoHorario(null)
      showSuccess('Cirugía reagendada con el horario del médico')
    },
    onError: (error) => {
      setSolicitudAceptandoHorario(null)
      showError('Error al reagendar: ' + (error.message || 'Error desconocido'))
    },
  })

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const checkInsumosYProceder = async (solicitud, accion) => {
    const supplies = solicitud.surgery_request_supplies || []
    if (supplies.length === 0) { accion(); return }
    const sinStock = supplies
      .filter(item => item.supplies && item.supplies.stock_actual < item.cantidad)
      .map(item => ({ nombre: item.supplies.nombre, codigo: item.supplies.codigo, stock_actual: item.supplies.stock_actual, requerido: item.cantidad }))
    if (sinStock.length > 0) {
      setInsumosModal({ insumos: sinStock })
      return
    }
    accion()
  }

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSeleccionarTodos = () => {
    const pendientesIds = solicitudesFiltradas.filter(s => s.estado === 'pendiente').map(s => s.id)
    const todasSeleccionadas = pendientesIds.every(id => seleccionados.has(id))
    if (todasSeleccionadas) {
      setSeleccionados(prev => {
        const next = new Set(prev)
        pendientesIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSeleccionados(prev => new Set([...prev, ...pendientesIds]))
    }
  }

  const handleAceptarHorarioMedicoDirecto = (solicitud) => {
    const horario = obtenerHorarioPreferido(solicitud)
    if (!horario) { showError('La solicitud no tiene un horario preferido válido para aceptar.'); return }
    setSolicitudAceptandoHorario(solicitud)
    if (solicitud.estado === 'aceptada') {
      reagendarConHorarioDelMedico.mutate({ solicitudId: solicitud.id, fecha: horario.fecha, operatingRoomId: horario.operatingRoomId, horaInicio: horario.horaInicio, horaFin: horario.horaFin })
      return
    }
    programarConHorarioDelMedico.mutate({ solicitud, solicitudId: solicitud.id, fecha: horario.fecha, operatingRoomId: horario.operatingRoomId, horaInicio: horario.horaInicio, horaFin: horario.horaFin })
  }

  const handleAceptarHorarioMedico = (solicitud) => checkInsumosYProceder(solicitud, () => handleAceptarHorarioMedicoDirecto(solicitud))

  const handleAceptarYProgramar = (solicitud) => checkInsumosYProceder(solicitud, () => {
    sessionStorage.setItem('solicitud_gestionando', JSON.stringify(solicitud))
    navigate('/pabellon/calendario')
  })

  const notificarDoctorPorReagendamiento = async (solicitud) => {
    const doctorUserId = solicitud?.doctors?.user_id
    if (!doctorUserId) return
    const nombrePaciente = `${solicitud?.patients?.nombre || ''} ${solicitud?.patients?.apellido || ''}`.trim() || 'el paciente'
    const { error } = await supabase.from('notifications').insert({
      user_id: doctorUserId,
      tipo: 'solicitud_reagendamiento',
      titulo: 'Pabellón reagendará la cirugía',
      mensaje: `Pabellón no pudo aceptar el horario propuesto para ${nombrePaciente}. Se iniciará el proceso de reagendamiento.`,
      relacionado_con: solicitud.id,
    })
    if (error) throw error
  }

  const handleReagendar = async (solicitud) => {
    try {
      await notificarDoctorPorReagendamiento(solicitud)
    } catch (error) {
      showError('No se pudo notificar al doctor: ' + (error.message || error.toString() || 'Error desconocido'))
    }
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (UUID_REGEX.test(solicitud.id)) sessionStorage.setItem('reagendar_solicitud_id', solicitud.id)
    navigate('/pabellon/calendario', { state: { reagendar: true, surgeryRequestId: solicitud.id } })
  }

  const handleProgramar = (e) => {
    e.preventDefault()
    if (!solicitudProgramando) return
    if (formProgramacion.hora_inicio && formProgramacion.hora_fin) {
      const [hh, hm] = formProgramacion.hora_inicio.split(':').map(Number)
      const [fh, fm] = formProgramacion.hora_fin.split(':').map(Number)
      if (fh * 60 + fm <= hh * 60 + hm) { showError('La hora de fin debe ser mayor que la hora de inicio'); return }
    }
    programarCirugia.mutate({ solicitudId: solicitudProgramando.id, solicitud: solicitudProgramando, formData: formProgramacion })
  }

  const generarEnlacePaciente = async (solicitudId) => {
    setGenerandoEnlace(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('patient_access_tokens')
        .insert({ surgery_request_id: solicitudId, created_by: user.id })
        .select('token').single()
      if (error) throw error
      await navigator.clipboard.writeText(`${window.location.origin}/portal/paciente/${data.token}`)
      setEnlaceCopiadoId(solicitudId)
      setTimeout(() => setEnlaceCopiadoId(null), 3000)
      showSuccess('Enlace copiado al portapapeles')
    } catch (err) {
      showError('Error al generar enlace: ' + (err.message || 'Error desconocido'))
    } finally {
      setGenerandoEnlace(false)
    }
  }

  const exportarExcel = async () => {
    const columns = [
      { key: 'fecha_solicitud', label: 'Fecha solicitud' },
      { key: 'paciente', label: 'Paciente' },
      { key: 'rut_paciente', label: 'RUT Paciente' },
      { key: 'prevision', label: 'Previsión' },
      { key: 'doctor', label: 'Doctor' },
      { key: 'especialidad', label: 'Especialidad' },
      { key: 'codigo_operacion', label: 'Código operación' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha_preferida', label: 'Fecha preferida' },
      { key: 'hora_inicio', label: 'Hora inicio' },
      { key: 'hora_fin', label: 'Hora fin' },
      { key: 'observaciones', label: 'Observaciones' },
    ]
    const filas = solicitudesFiltradas.map(s => ({
      fecha_solicitud: s.created_at ? format(new Date(s.created_at), 'dd/MM/yyyy') : '—',
      paciente: `${s.patients?.nombre || ''} ${s.patients?.apellido || ''}`.trim(),
      rut_paciente: s.patients?.rut || '',
      prevision: s.patients?.prevision ? ({ fonasa: 'Fonasa', isapre: 'Isapre', particular: 'Particular', otro: 'Otro' }[s.patients.prevision] || s.patients.prevision) : '',
      doctor: `${s.doctors?.nombre || ''} ${s.doctors?.apellido || ''}`.trim(),
      especialidad: s.doctors?.especialidad || '',
      codigo_operacion: s.codigo_operacion || '',
      estado: s.estado || '',
      fecha_preferida: s.fecha_preferida || '',
      hora_inicio: s.hora_recomendada || '',
      hora_fin: s.hora_fin_recomendada || '',
      observaciones: s.observaciones || '',
    }))
    await exportToExcel(filas, columns, 'solicitudes')
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const pendientesVisibles = solicitudesFiltradas.filter(s => s.estado === 'pendiente')
  const todasSeleccionadas = pendientesVisibles.length > 0 && pendientesVisibles.every(s => seleccionados.has(s.id))

  return (
    <div id="tour-sol-container" className="animate-in fade-in slide-in-from-right duration-500 max-w-5xl mx-auto px-4 sm:px-6 lg:px-0">
      {/* Header */}
      <div id="tour-sol-header" className="mb-6 sm:mb-8 lg:mb-10 text-center relative">
        <h2 className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter uppercase mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          BANDEJA DE SOLICITUDES
        </h2>
        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">
          MÉDICOS PENDIENTES DE AGENDAMIENTO
        </p>
        {solicitudesFiltradas.length > 0 && (
          <button
            onClick={exportarExcel}
            title="Exportar lista actual a Excel"
            className="absolute right-0 top-0 flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <Download size={14} /> Excel
          </button>
        )}
      </div>

      <div id="tour-sol-filters">
      <FiltrosSolicitudes
        busqueda={busqueda} setBusqueda={setBusqueda}
        filtroEstado={filtroEstado} setFiltroEstado={setFiltroEstado}
        filtroDoctor={filtroDoctor} setFiltroDoctor={setFiltroDoctor}
        filtroCodigoOperacion={filtroCodigoOperacion} setFiltroCodigoOperacion={setFiltroCodigoOperacion}
        filtroPrevision={filtroPrevision} setFiltroPrevision={setFiltroPrevision}
        filtroFechaDesde={filtroFechaDesde} setFiltroFechaDesde={setFiltroFechaDesde}
        filtroFechaHasta={filtroFechaHasta} setFiltroFechaHasta={setFiltroFechaHasta}
        doctoresUnicos={doctoresUnicos}
        codigosUnicos={codigosUnicos}
        solicitudes={solicitudes}
        solicitudesFiltradas={solicitudesFiltradas}
      />
      </div>

      {/* Barra de acciones masivas */}
      {pendientesVisibles.length > 0 && (
        <div className={`sticky top-2 z-30 mb-6 flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 shadow-lg ${
          seleccionados.size > 0
            ? (theme === 'dark' ? 'bg-slate-800 border-blue-700' : 'bg-blue-50 border-blue-400')
            : (theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')
        }`}>
          <div className="flex items-center gap-3">
            {seleccionados.size > 0 && (
              <button onClick={() => setSeleccionados(new Set())} aria-label="Limpiar selección">
                <X className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`} aria-hidden="true" />
              </button>
            )}
            <button
              onClick={toggleSeleccionarTodos}
              className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-colors ${theme === 'dark' ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-blue-600'}`}
              aria-label={todasSeleccionadas ? 'Deseleccionar todas' : 'Seleccionar todas las pendientes'}
            >
              {todasSeleccionadas
                ? <CheckSquare className="w-4 h-4 text-blue-600" aria-hidden="true" />
                : <Square className="w-4 h-4" aria-hidden="true" />}
              {seleccionados.size > 0
                ? `${seleccionados.size} seleccionada${seleccionados.size !== 1 ? 's' : ''}`
                : 'Seleccionar todas las pendientes'}
            </button>
          </div>
          {seleccionados.size > 0 && (
            <button
              onClick={() => setBulkModal({ motivo: '' })}
              disabled={rechazarBulk.isPending}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase rounded-xl transition-colors"
            >
              {rechazarBulk.isPending ? 'Rechazando...' : 'Rechazar seleccionadas'}
            </button>
          )}
        </div>
      )}

      {/* Lista de solicitudes */}
      <div className="grid gap-4 sm:gap-6">
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : solicitudesFiltradas.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No hay solicitudes"
            description={filtroEstado === 'todas' ? 'No se encontraron solicitudes en el sistema' : `No hay solicitudes con estado "${filtroEstado}"`}
          />
        ) : (
          solicitudesFiltradas.map(solicitud => (
            <SolicitudCard
              key={solicitud.id}
              solicitud={solicitud}
              seleccionados={seleccionados}
              onToggleSeleccion={toggleSeleccion}
              onVerDetalle={(s) => { scrollYRef.current = window.scrollY; setSolicitudDetalle(s) }}
              onCompletar={(s) => setCompletarModal({ solicitud: s, notas: '' })}
              onCancelarCirugia={(s) => setCancelarModal({ solicitud: s })}
              onAceptarHorarioMedico={handleAceptarHorarioMedico}
              onReagendar={handleReagendar}
              onAceptarYProgramar={handleAceptarYProgramar}
              onRechazar={(s) => setRechazarModal({ solicitud: s, motivo: '' })}
              tieneHorarioPreferido={tieneHorarioPreferido}
              isAceptandoHorario={programarConHorarioDelMedico.isPending || reagendarConHorarioDelMedico.isPending}
              aceptandoId={solicitudAceptandoHorario?.id}
            />
          ))
        )}
      </div>

      {/* Modales */}
      {solicitudDetalle && (
        <ModalDetalle
          solicitud={solicitudDetalle}
          onClose={() => setSolicitudDetalle(null)}
          scrollYRef={scrollYRef}
          generarEnlacePaciente={generarEnlacePaciente}
          generandoEnlace={generandoEnlace}
          enlaceCopiadoId={enlaceCopiadoId}
        />
      )}

      {solicitudProgramando && (
        <ModalProgramar
          solicitud={solicitudProgramando}
          onClose={() => {
            setSolicitudProgramando(null)
            setFormProgramacion({ fecha: '', hora_inicio: '', hora_fin: '', operating_room_id: '', observaciones: '' })
          }}
          formProgramacion={formProgramacion}
          setFormProgramacion={setFormProgramacion}
          onSubmit={handleProgramar}
          pabellones={pabellones}
          pabellonesMostrar={pabellonesMostrar}
          slotsHorarios={slotsHorarios}
          getSlotStatus={getSlotStatus}
          cirugiasFecha={cirugiasFecha}
          bloqueosFecha={bloqueosFecha}
          isPending={programarCirugia.isPending}
          showError={showError}
        />
      )}

      <ModalRechazar
        isOpen={!!rechazarModal}
        onClose={() => setRechazarModal(null)}
        solicitud={rechazarModal?.solicitud}
        motivoRechazo={rechazarModal?.motivo ?? ''}
        setMotivoRechazo={(v) => setRechazarModal(prev => ({ ...prev, motivo: v }))}
        onConfirmar={() => rechazarModal && rechazarSolicitud.mutate({ solicitud: rechazarModal.solicitud, motivo: rechazarModal.motivo })}
        isPending={rechazarSolicitud.isPending}
      />

      <ModalCompletar
        isOpen={!!completarModal}
        onClose={() => setCompletarModal(null)}
        solicitud={completarModal?.solicitud}
        notas={completarModal?.notas ?? ''}
        setNotas={(v) => setCompletarModal(prev => ({ ...prev, notas: v }))}
        onConfirmar={() => completarModal && completarCirugia.mutate({ solicitud: completarModal.solicitud, notas: completarModal.notas })}
        isPending={completarCirugia.isPending}
      />

      <ModalCancelarCirugia
        isOpen={!!cancelarModal}
        onClose={() => setCancelarModal(null)}
        solicitud={cancelarModal?.solicitud}
        onConfirmar={() => cancelarModal && cancelarCirugiaYa.mutate({ solicitud: cancelarModal.solicitud })}
        isPending={cancelarCirugiaYa.isPending}
      />

      <ModalInsumosAlert
        isOpen={!!insumosModal}
        onClose={() => setInsumosModal(null)}
        insumosConStockCero={insumosModal?.insumos ?? []}
      />

      <ModalBulkRechazar
        isOpen={!!bulkModal}
        onClose={() => setBulkModal(null)}
        seleccionados={seleccionados}
        solicitudesFiltradas={solicitudesFiltradas}
        motivoBulk={bulkModal?.motivo ?? ''}
        setMotivoBulk={(v) => setBulkModal(prev => ({ ...prev, motivo: v }))}
        onConfirmar={() => bulkModal && rechazarBulk.mutate({ ids: Array.from(seleccionados), motivo: bulkModal.motivo })}
        isPending={rechazarBulk.isPending}
      />
    </div>
  )
}
