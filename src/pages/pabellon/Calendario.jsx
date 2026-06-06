import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { ChevronLeft, ChevronRight, Clock, Info, Stethoscope, X, Search, Printer, FileDown } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { sanitizeString } from '../../utils/sanitizeInput'
import { useTheme } from '../../contexts/ThemeContext'
import { logger } from '../../utils/logger'
import { useClinicInfo } from '../../hooks/useClinicInfo'
import { exportProgramaDia } from '../../utils/pdfExport'
import {
  startOfYear,
  endOfYear,
  endOfMonth,
  isWithinInterval,
  format,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { MESES, DOCTOR_COLORS } from './calendario/constants'
import Breadcrumbs from './calendario/Breadcrumbs'
import MonthView from './calendario/MonthView'
import WeekView from './calendario/WeekView'
import DayView from './calendario/DayView'
import ModalConfirmarCupo from './calendario/ModalConfirmarCupo'
import ModalDetallesSlot from './calendario/ModalDetallesSlot'
import ModalCancelarCirugia from './calendario/ModalCancelarCirugia'

export default function Calendario() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const fromReagendamientoNotification = location.state?.fromReagendamientoNotification === true
  const isReagendarMode = location.state?.reagendar === true && (location.state?.surgeryRequestId || typeof sessionStorage !== 'undefined' && sessionStorage.getItem('reagendar_solicitud_id'))
  const { showSuccess, showError } = useNotifications()
  const { data: clinicInfo } = useClinicInfo()
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [pabellonId, setPabellonId] = useState('todos')
  const [filtroPaciente, setFiltroPaciente] = useState('')
  const [filtroDoctorId, setFiltroDoctorId] = useState('todos')

  const [view, setView] = useState('year')
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const { theme } = useTheme()
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [horaFin, setHoraFin] = useState('')
  const [showDetallesModal, setShowDetallesModal] = useState(false)
  const [slotDetalle, setSlotDetalle] = useState(null)
  const [showConfirmCancelar, setShowConfirmCancelar] = useState(false)
  const [cirugiaACancelar, setCirugiaACancelar] = useState(null)
  const [cirugiaAReagendar, setCirugiaAReagendar] = useState(null)
  const [editandoObservaciones, setEditandoObservaciones] = useState(false)
  const [observacionesEditadas, setObservacionesEditadas] = useState('')
  const [conflictoAgenda, setConflictoAgenda] = useState(null)
  const [ignorarConflicto, setIgnorarConflicto] = useState(false)

  const [currentRequest, setCurrentRequest] = useState(() => {
    try {
      const solicitudStr = sessionStorage.getItem('solicitud_gestionando')
      if (solicitudStr) return JSON.parse(solicitudStr)
    } catch (e) {
      logger.errorWithContext('Error al parsear solicitud', e)
    }
    return null
  })

  useEffect(() => {
    try {
      const modo = sessionStorage.getItem('calendario_ir_hoy')
      if (modo) {
        sessionStorage.removeItem('calendario_ir_hoy')
        const hoy = new Date()
        setAnio(hoy.getFullYear())
        setSelectedMonth(hoy.getMonth())
        setSelectedDay(hoy)
        if (modo === 'week') {
          const semana = startOfWeek(hoy, { weekStartsOn: 1 })
          setSelectedWeek(semana)
          setView('week')
        } else {
          setView('day')
        }
      }
    } catch (e) {
      // ignorar errores de storage
    }
  }, [])

  useEffect(() => {
    if (!isReagendarMode) return
    const requestId = location.state?.surgeryRequestId || sessionStorage.getItem('reagendar_solicitud_id')
    if (!requestId) return

    const loadReagendar = async () => {
      try {
        const { data: cirugia, error: errCirugia } = await supabase
          .from('surgeries')
          .select('id, surgery_request_id, fecha, hora_inicio, hora_fin, operating_room_id')
          .eq('surgery_request_id', requestId)
          .is('deleted_at', null)
          .maybeSingle()

        if (errCirugia) {
          logger.errorWithContext('Error al cargar cirugía para reagendar', errCirugia)
          showError('No se encontró la cirugía a reagendar.')
          return
        }
        if (!cirugia) {
          showError('No hay cirugía programada para esta solicitud.')
          return
        }

        const { data: solicitud, error: errSol } = await supabase
          .from('surgery_requests')
          .select(`*, doctors:doctor_id(id, nombre, apellido, especialidad, estado), patients:patient_id(nombre, apellido, rut)`)
          .eq('id', requestId)
          .is('deleted_at', null)
          .single()

        if (errSol || !solicitud) {
          logger.errorWithContext('Error al cargar solicitud para reagendar', errSol)
          showError('No se pudo cargar la solicitud.')
          return
        }

        setCirugiaAReagendar(cirugia)
        setCurrentRequest(solicitud)
        setView('day')
        const fechaLocal = new Date(cirugia.fecha + 'T00:00:00')
        setSelectedDay(fechaLocal)
        setSelectedMonth(fechaLocal.getMonth())
        setAnio(fechaLocal.getFullYear())
      } catch (e) {
        logger.errorWithContext('Error en loadReagendar', e)
        showError('Error al cargar datos para reagendar.')
      }
    }

    loadReagendar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReagendarMode, location.state?.surgeryRequestId])

  const programarCirugia = useMutation({
    mutationFn: async ({ solicitudId, formData }) => {
      let horaInicio = formData.hora_inicio
      let horaFinMut = formData.hora_fin

      if (horaInicio && horaInicio.match(/^\d{1,2}:\d{2}$/)) {
        const [h, m] = horaInicio.split(':')
        horaInicio = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`
      } else if (horaInicio && horaInicio.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
        const [h, m, s] = horaInicio.split(':')
        horaInicio = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`
      }

      if (horaFinMut && horaFinMut.match(/^\d{1,2}:\d{2}$/)) {
        const [h, m] = horaFinMut.split(':')
        horaFinMut = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`
      } else if (horaFinMut && horaFinMut.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
        const [h, m, s] = horaFinMut.split(':')
        horaFinMut = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`
      }

      if (!horaInicio || !horaInicio.match(/^\d{2}:\d{2}:\d{2}$/)) {
        throw new Error(`Formato de hora de inicio inválido: ${horaInicio}`)
      }
      if (!horaFinMut || !horaFinMut.match(/^\d{2}:\d{2}:\d{2}$/)) {
        throw new Error(`Formato de hora de fin inválido: ${horaFinMut}`)
      }

      const { data, error } = await supabase.rpc('programar_cirugia_completa', {
        p_surgery_request_id: solicitudId,
        p_operating_room_id: formData.operating_room_id,
        p_fecha: formData.fecha,
        p_hora_inicio: horaInicio,
        p_hora_fin: horaFinMut,
        p_observaciones: formData.observaciones || null
      })

      if (error) {
        logger.errorWithContext('Error al programar cirugía (desde slot)', error, { slot: selectedSlot, horaInicio, horaFinMut })
        throw error
      }

      if (!data || !data.success) {
        throw new Error(data?.message || 'Error desconocido al programar la cirugía')
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
      queryClient.invalidateQueries({ queryKey: ['solicitudes-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-hoy'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-calendario'] })
      queryClient.invalidateQueries({ queryKey: ['calendario-anual-cirugias'] })
      showSuccess('Cirugía programada exitosamente')
      sessionStorage.removeItem('solicitud_gestionando')
      sessionStorage.removeItem('slot_seleccionado')
      setShowConfirmModal(false)
      setSelectedSlot(null)
      setCurrentRequest(null)
      navigate('/pabellon/solicitudes')
    },
    onError: (error) => {
      logger.errorWithContext('Error al programar cirugía', error)
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      const errorDetails = error.details || ''
      const errorHint = error.hint || ''
      let mensaje = 'Error al programar la cirugía'

      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        mensaje = 'Error de conexión. Verifique su conexión a internet e intente nuevamente.'
      } else if (errorMessage.includes('solapamiento') || errorMessage.includes('overlap') || errorMessage.includes('Ya existe una cirugía')) {
        mensaje = 'Ya existe una cirugía programada en este horario. Por favor, seleccione otro horario.'
      } else if (errorMessage.includes('hora de fin') || errorMessage.includes('hora de inicio')) {
        mensaje = errorMessage
      } else if (errorMessage.includes('tiempo de limpieza') || errorMessage.includes('limpieza')) {
        mensaje = errorMessage
      } else if (errorMessage.includes('doctor debe estar activo')) {
        mensaje = 'El doctor debe estar activo para programar cirugías'
      } else if (errorMessage.includes('bloqueado') || errorMessage.includes('blocked')) {
        mensaje = 'El horario seleccionado está bloqueado'
      } else if (errorMessage.includes('fecha pasada')) {
        mensaje = 'No se puede agendar una cirugía en una fecha pasada'
      } else if (errorMessage.includes('solicitud') && errorMessage.includes('pendiente')) {
        mensaje = 'La solicitud debe estar en estado pendiente para ser programada'
      } else if (error.code === 'PGRST116' || error.code === '42883') {
        mensaje = 'Error en la función de base de datos. Por favor, contacte al administrador.'
      } else {
        mensaje = errorMessage + (errorDetails ? ` (${errorDetails})` : '') + (errorHint ? ` - ${errorHint}` : '')
      }

      showError(mensaje)
    },
  })

  const reagendarCirugia = useMutation({
    mutationFn: async ({ cirugiaId, formData }) => {
      let horaInicio = formData.hora_inicio
      let horaFinMut = formData.hora_fin
      if (horaInicio && horaInicio.match(/^\d{1,2}:\d{2}$/)) {
        const [h, m] = horaInicio.split(':')
        horaInicio = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`
      }
      if (horaFinMut && horaFinMut.match(/^\d{1,2}:\d{2}$/)) {
        const [h, m] = horaFinMut.split(':')
        horaFinMut = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`
      }

      // Verificar solapamiento en el pabellón antes de reagendar
      const { data: conflictos } = await supabase
        .from('surgeries')
        .select('id, hora_inicio, hora_fin')
        .eq('operating_room_id', formData.operating_room_id)
        .eq('fecha', formData.fecha)
        .not('estado', 'eq', 'cancelada')
        .is('deleted_at', null)
        .neq('id', cirugiaId)

      if (conflictos?.length) {
        const hay = conflictos.some(c => {
          const cIni = c.hora_inicio?.slice(0, 5)
          const cFin = c.hora_fin?.slice(0, 5)
          if (!cIni || !cFin) return false
          return horaInicio.slice(0, 5) < cFin && horaFinMut.slice(0, 5) > cIni
        })
        if (hay) throw new Error('solapamiento: Ya existe una cirugía en ese horario y pabellón')
      }

      const { error } = await supabase
        .from('surgeries')
        .update({
          fecha: formData.fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFinMut,
          operating_room_id: formData.operating_room_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cirugiaId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-hoy'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-calendario'] })
      queryClient.invalidateQueries({ queryKey: ['calendario-anual-cirugias'] })
      showSuccess('Cirugía reagendada. Se notificó al doctor y al pabellón.')
      sessionStorage.removeItem('reagendar_solicitud_id')
      setShowConfirmModal(false)
      setSelectedSlot(null)
      setCurrentRequest(null)
      setCirugiaAReagendar(null)
      navigate('/pabellon/solicitudes')
    },
    onError: (error) => {
      const msg = error.message || error.toString()
      if (msg.includes('solapamiento') || msg.includes('Ya existe')) {
        showError('Ya existe una cirugía en ese horario. Elija otro slot.')
      } else if (msg.includes('bloqueado')) {
        showError('El horario está bloqueado.')
      } else {
        showError('Error al reagendar: ' + msg)
      }
    },
  })

  const imprimirPrograma = () => {
    if (!selectedDay || cirugiasDetalleFiltered.length === 0) return
    const fecha = format(selectedDay, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
    const rows = cirugiasDetalleFiltered
      .slice()
      .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''))
      .map(c => `
        <tr>
          <td>${c.hora_inicio?.slice(0, 5) || '—'} – ${c.hora_fin?.slice(0, 5) || '—'}</td>
          <td>${c.operating_rooms?.nombre || '—'}</td>
          <td>${c.patients?.nombre || ''} ${c.patients?.apellido || ''}</td>
          <td>${c.patients?.rut || '—'}</td>
          <td>Dr. ${c.doctors?.apellido || ''}, ${c.doctors?.nombre || ''}</td>
          <td>${c.surgery_requests?.codigo_operacion || '—'}</td>
          <td style="text-transform:capitalize">${c.estado || '—'}</td>
        </tr>`)
      .join('')
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>Programa Quirúrgico – ${fecha}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #1e293b; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { color: #64748b; margin: 0 0 16px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1e293b; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
        td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        @media print { body { margin: 16px; } }
      </style></head><body>
      <h1>Programa Quirúrgico</h1>
      <p>${fecha.charAt(0).toUpperCase() + fecha.slice(1)} — generado el ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
      <table>
        <thead><tr>
          <th>Horario</th><th>Pabellón</th><th>Paciente</th><th>RUT</th><th>Médico</th><th>Código op.</th><th>Estado</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`
    const win = window.open('', '_blank')
    if (!win) { showError('El navegador bloqueó la ventana de impresión. Permite popups para este sitio.'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  const handleConfirmSlot = () => {
    if (selectedSlot && currentRequest) {
      const [hours, minutes] = selectedSlot.time.split(':')
      const horaFinDate = new Date()
      horaFinDate.setHours(parseInt(hours, 10) + 1, parseInt(minutes, 10), 0, 0)
      const horaFinStr = `${horaFinDate.getHours().toString().padStart(2, '0')}:${horaFinDate.getMinutes().toString().padStart(2, '0')}`
      setHoraFin(horaFinStr)
      setShowConfirmModal(true)
    }
  }

  const handleConfirmarCupo = async () => {
    if (!selectedSlot || !currentRequest || !horaFin) return
    const [horaInicioH, horaInicioM] = selectedSlot.time.split(':').map(Number)
    const [horaFinH, horaFinM] = horaFin.split(':').map(Number)
    const minutosInicio = horaInicioH * 60 + horaInicioM
    const minutosFin = horaFinH * 60 + horaFinM
    if (minutosFin <= minutosInicio) {
      showError('La hora de fin debe ser mayor que la hora de inicio')
      return
    }

    const formData = {
      fecha: format(selectedSlot.date, 'yyyy-MM-dd'),
      hora_inicio: selectedSlot.time,
      hora_fin: horaFin,
      operating_room_id: selectedSlot.pabellonId,
      observaciones: '',
    }

    if (!ignorarConflicto && currentRequest.doctor_id) {
      const { data: cirugiasConflicto } = await supabase
        .from('surgeries')
        .select('id, hora_inicio, hora_fin, patients:patient_id(nombre, apellido), operating_rooms:operating_room_id(nombre)')
        .eq('doctor_id', currentRequest.doctor_id)
        .eq('fecha', formData.fecha)
        .not('estado', 'eq', 'cancelada')
        .is('deleted_at', null)

      if (cirugiasConflicto?.length) {
        const solapan = cirugiasConflicto.filter(c => {
          if (cirugiaAReagendar && c.id === cirugiaAReagendar.id) return false
          const cIni = c.hora_inicio?.slice(0, 5).split(':').map(Number)
          const cFin = c.hora_fin?.slice(0, 5).split(':').map(Number)
          if (!cIni || !cFin) return false
          const cIniMin = cIni[0] * 60 + cIni[1]
          const cFinMin = cFin[0] * 60 + cFin[1]
          return minutosInicio < cFinMin && minutosFin > cIniMin
        })
        if (solapan.length > 0) {
          setConflictoAgenda({ cirugias: solapan })
          return
        }
      }
    }

    setConflictoAgenda(null)
    setIgnorarConflicto(false)

    if (cirugiaAReagendar) {
      reagendarCirugia.mutate({ cirugiaId: cirugiaAReagendar.id, formData })
    } else {
      programarCirugia.mutate({ solicitudId: currentRequest.id, formData })
    }
  }

  const cancelarCirugia = useMutation({
    mutationFn: async (cirugiaId) => {
      const { data: cirugia, error: errorCirugia } = await supabase
        .from('surgeries')
        .select('doctor_id, fecha, hora_inicio, patients:patient_id(nombre, apellido)')
        .eq('id', cirugiaId)
        .single()

      if (errorCirugia) throw errorCirugia

      const { error } = await supabase
        .from('surgeries')
        .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
        .eq('id', cirugiaId)

      if (error) throw error

      if (cirugia.doctor_id) {
        const { data: doctorUser } = await supabase
          .from('doctors')
          .select('user_id')
          .eq('id', cirugia.doctor_id)
          .maybeSingle()

        if (doctorUser?.user_id) {
          const { error: notifErrCancel } = await supabase
            .from('notifications')
            .insert({
              user_id: doctorUser.user_id,
              tipo: 'operacion_programada',
              titulo: 'Cirugía Cancelada',
              mensaje: `La cirugía programada para ${cirugia.patients?.nombre} ${cirugia.patients?.apellido} el ${format(new Date(cirugia.fecha), 'dd/MM/yyyy')} a las ${cirugia.hora_inicio} ha sido cancelada por el pabellón.`,
              relacionado_con: cirugiaId,
            })
          if (notifErrCancel) logger.warn('Error al notificar cancelación al doctor:', notifErrCancel)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendario-anual-cirugias'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-dia-detalle'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-fecha'] })
      showSuccess('Cirugía cancelada exitosamente. El doctor ha sido notificado.')
      setShowConfirmCancelar(false)
      setCirugiaACancelar(null)
      setShowDetallesModal(false)
      setSlotDetalle(null)
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError('Error al cancelar la cirugía: ' + errorMessage)
      }
    },
  })

  const confirmarCancelar = () => {
    if (cirugiaACancelar) {
      cancelarCirugia.mutate(cirugiaACancelar.id)
    }
  }

  const marcarEnProceso = useMutation({
    mutationFn: async (cirugiaId) => {
      const { data: cirugia, error: errCirugia } = await supabase
        .from('surgeries')
        .select('doctor_id, fecha, hora_inicio, patients:patient_id(nombre, apellido)')
        .eq('id', cirugiaId)
        .maybeSingle()

      if (errCirugia) throw errCirugia
      if (!cirugia) throw new Error('No se encontró la cirugía')

      const { error } = await supabase
        .from('surgeries')
        .update({ estado: 'en_proceso', updated_at: new Date().toISOString() })
        .eq('id', cirugiaId)
      if (error) throw error

      if (cirugia?.doctor_id) {
        const { data: doctorUser } = await supabase.from('doctors').select('user_id').eq('id', cirugia.doctor_id).maybeSingle()
        if (doctorUser?.user_id) {
          const { error: notifErrProceso } = await supabase.from('notifications').insert({
            user_id: doctorUser.user_id,
            tipo: 'operacion_programada',
            titulo: 'Cirugía en proceso',
            mensaje: `La cirugía de ${cirugia.patients?.nombre || ''} ${cirugia.patients?.apellido || ''} del ${format(new Date(cirugia.fecha), 'dd/MM/yyyy')} a las ${cirugia.hora_inicio?.slice(0, 5)} ha comenzado.`,
            relacionado_con: cirugiaId,
          })
          if (notifErrProceso) logger.warn('Error al notificar inicio de cirugía al doctor:', notifErrProceso)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cirugias-dia-detalle'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-hoy'] })
      queryClient.invalidateQueries({ queryKey: ['calendario-anual-cirugias'] })
      showSuccess('Cirugía marcada como en proceso.')
      setShowDetallesModal(false)
      setSlotDetalle(null)
    },
    onError: (e) => showError('Error al actualizar estado: ' + (e.message || e)),
  })

  const completarCirugia = useMutation({
    mutationFn: async (cirugiaId) => {
      const { error } = await supabase
        .from('surgeries')
        .update({ estado: 'completada', updated_at: new Date().toISOString() })
        .eq('id', cirugiaId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cirugias-dia-detalle'] })
      queryClient.invalidateQueries({ queryKey: ['cirugias-hoy'] })
      queryClient.invalidateQueries({ queryKey: ['calendario-anual-cirugias'] })
      showSuccess('Cirugía marcada como completada.')
      setShowDetallesModal(false)
      setSlotDetalle(null)
    },
    onError: (e) => showError('Error al completar cirugía: ' + (e.message || e)),
  })

  const editarObservaciones = useMutation({
    mutationFn: async ({ cirugiaId, observaciones }) => {
      const { error } = await supabase
        .from('surgeries')
        .update({ observaciones, updated_at: new Date().toISOString() })
        .eq('id', cirugiaId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cirugias-dia-detalle'] })
      showSuccess('Observaciones actualizadas.')
      setEditandoObservaciones(false)
      setSlotDetalle(prev => prev ? { ...prev, data: { ...prev.data, observaciones: observacionesEditadas } } : prev)
    },
    onError: (e) => showError('Error al guardar: ' + (e.message || e)),
  })

  const inicioAnio = startOfYear(new Date(anio, 0, 1))
  const finAnio = endOfYear(new Date(anio, 0, 1))
  const fechaInicioStr = inicioAnio.toISOString().slice(0, 10)
  const fechaFinStr = finAnio.toISOString().slice(0, 10)

  const { data: cirugias = [], isLoading: loadingCirugias } = useQuery({
    queryKey: ['calendario-anual-cirugias', anio, filtroPaciente],
    queryFn: async () => {
      let query = supabase
        .from('surgeries')
        .select(`id, fecha, operating_room_id, hora_inicio, hora_fin, estado, doctors(id, apellido), patients:patient_id(nombre, apellido, rut)`)
        .is('deleted_at', null)

      if (!filtroPaciente) {
        query = query.gte('fecha', fechaInicioStr).lte('fecha', fechaFinStr)
      } else {
        const fechaLimiteInferior = new Date()
        fechaLimiteInferior.setFullYear(fechaLimiteInferior.getFullYear() - 5)
        const fechaLimiteSuperior = new Date()
        fechaLimiteSuperior.setFullYear(fechaLimiteSuperior.getFullYear() + 2)
        query = query
          .gte('fecha', fechaLimiteInferior.toISOString().slice(0, 10))
          .lte('fecha', fechaLimiteSuperior.toISOString().slice(0, 10))
      }

      const { data, error } = await query.order('fecha', { ascending: false })
      if (error) throw error

      if (filtroPaciente && data) {
        const filtroLower = filtroPaciente.toLowerCase().trim()
        return data.filter(cirugia => {
          const nombre = cirugia.patients?.nombre?.toLowerCase() || ''
          const apellido = cirugia.patients?.apellido?.toLowerCase() || ''
          const nombreCompleto = `${nombre} ${apellido}`.trim()
          return nombreCompleto.includes(filtroLower) || nombre.includes(filtroLower) || apellido.includes(filtroLower)
        })
      }

      return data || []
    },
  })

  const { data: bloqueos = [], isLoading: loadingBloqueos } = useQuery({
    queryKey: ['calendario-anual-bloqueos', anio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_blocks')
        .select('id, fecha, operating_room_id, hora_inicio, hora_fin, vigencia_hasta')
        .gte('fecha', fechaInicioStr)
        .lte('fecha', fechaFinStr)
        .is('deleted_at', null)
      if (error) throw error
      return data || []
    },
  })

  const { data: solicitudesPendientes = [] } = useQuery({
    queryKey: ['solicitudes-pendientes-calendario', anio],
    queryFn: async () => {
      const { data } = await supabase
        .from('surgery_requests')
        .select('id, fecha_preferida, created_at')
        .eq('estado', 'pendiente')
        .is('deleted_at', null)
      return data || []
    },
  })

  const pendientesPorMes = useMemo(() => {
    const map = {}
    for (const s of solicitudesPendientes) {
      const fecha = s.fecha_preferida ? new Date(s.fecha_preferida + 'T12:00:00') : new Date(s.created_at)
      if (fecha.getFullYear() === anio) {
        const m = fecha.getMonth()
        map[m] = (map[m] || 0) + 1
      }
    }
    return map
  }, [solicitudesPendientes, anio])

  const { data: cirugiasDetalle = [] } = useQuery({
    queryKey: ['cirugias-dia-detalle', selectedDay, filtroPaciente],
    queryFn: async () => {
      if (!selectedDay) return []
      const fechaStr = format(selectedDay, 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('surgeries')
        .select(`*, doctors:doctor_id(nombre, apellido, especialidad), patients:patient_id(nombre, apellido, rut), operating_rooms:operating_room_id(nombre), surgery_request_id, surgery_requests:surgery_request_id(codigo_operacion)`)
        .eq('fecha', fechaStr)
        .is('deleted_at', null)
        .order('hora_inicio', { ascending: true })

      if (error) throw error

      if (filtroPaciente && data) {
        const filtroLower = filtroPaciente.toLowerCase().trim()
        return data.filter(cirugia => {
          const nombre = cirugia.patients?.nombre?.toLowerCase() || ''
          const apellido = cirugia.patients?.apellido?.toLowerCase() || ''
          const nombreCompleto = `${nombre} ${apellido}`.trim()
          return nombreCompleto.includes(filtroLower) || nombre.includes(filtroLower) || apellido.includes(filtroLower)
        })
      }

      return data || []
    },
    enabled: !!selectedDay && view === 'day',
  })

  const { data: pabellones = [] } = useQuery({
    queryKey: ['pabellones-calendario'],
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

  const statsMeses = useMemo(() => {
    return MESES.map((mes) => {
      const inicioMes = new Date(anio, mes.indice, 1)
      const finMes = endOfMonth(inicioMes)

      const cirugiasMes = cirugias.filter((c) => {
        if (pabellonId !== 'todos' && c.operating_room_id !== pabellonId) return false
        const fechaCirugia = new Date(c.fecha)
        return isWithinInterval(fechaCirugia, { start: inicioMes, end: finMes })
      })

      const bloqueosMes = bloqueos.filter((b) => {
        if (pabellonId !== 'todos' && b.operating_room_id !== pabellonId) return false
        const fechaBloqueo = new Date(b.fecha)
        return isWithinInterval(fechaBloqueo, { start: inicioMes, end: finMes })
      })

      const totalEventos = cirugiasMes.length + bloqueosMes.length
      let porcentajeAgendado = 0
      let porcentajeBloqueado = 0
      let porcentajeLibre = 100

      if (totalEventos > 0) {
        porcentajeAgendado = Math.round((cirugiasMes.length / totalEventos) * 100)
        porcentajeBloqueado = Math.round((bloqueosMes.length / totalEventos) * 100)
        porcentajeLibre = Math.max(0, 100 - porcentajeAgendado - porcentajeBloqueado)
      }

      return { ...mes, cirugiasEstimadas: cirugiasMes.length, porcentajeAgendado, porcentajeBloqueado, porcentajeLibre }
    })
  }, [anio, pabellonId, cirugias, bloqueos])

  const doctorColorMap = useMemo(() => {
    const map = {}
    let colorIdx = 0
    for (const c of cirugias) {
      if (c.doctor_id && !map[c.doctor_id]) {
        map[c.doctor_id] = {
          color: DOCTOR_COLORS[colorIdx % DOCTOR_COLORS.length],
          apellido: c.doctors?.apellido || c.doctors?.nombre || 'Dr.',
        }
        colorIdx++
      }
    }
    return map
  }, [cirugias])

  const doctoresEnDia = useMemo(() => {
    const map = {}
    for (const c of cirugiasDetalle) {
      if (c.doctor_id && !map[c.doctor_id]) {
        map[c.doctor_id] = `Dr. ${c.doctors?.nombre || ''} ${c.doctors?.apellido || ''}`.trim()
      }
    }
    return Object.entries(map).map(([id, nombre]) => ({ id, nombre }))
  }, [cirugiasDetalle])

  const cirugiasDetalleFiltered = useMemo(() => {
    if (filtroDoctorId === 'todos') return cirugiasDetalle
    return cirugiasDetalle.filter(c => c.doctor_id === filtroDoctorId)
  }, [cirugiasDetalle, filtroDoctorId])

  const cargando = loadingCirugias || loadingBloqueos

  const { data: historialCirugia = [] } = useQuery({
    queryKey: ['historial-cirugia', slotDetalle?.data?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgery_schedule_history')
        .select('fecha_anterior, hora_inicio_anterior, fecha_nueva, hora_inicio_nueva, motivo, created_at')
        .eq('surgery_id', slotDetalle.data.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!slotDetalle?.data?.id && showDetallesModal,
  })

  const handleNavigate = (targetView, newAnio = null, newMonth = null) => {
    if (targetView === 'year') {
      setView('year')
      setSelectedMonth(null)
      setSelectedWeek(null)
      setSelectedDay(null)
      setSelectedSlot(null)
    } else if (targetView === 'month') {
      setView('month')
      setSelectedWeek(null)
      setSelectedDay(null)
      setSelectedSlot(null)
      if (newAnio !== null) setAnio(newAnio)
      if (newMonth !== null) setSelectedMonth(newMonth)
    } else if (targetView === 'week') {
      setView('week')
      setSelectedDay(null)
      setSelectedSlot(null)
    }
  }

  return (
    <div id="tour-cal-container" className="space-y-3 sm:space-y-4 md:space-y-5 px-4 sm:px-5 md:px-6 lg:px-8 py-3 sm:py-4 md:py-5 lg:py-6 max-w-7xl mx-auto">
      {/* Aviso de reagendamiento */}
      {(fromReagendamientoNotification || (isReagendarMode && cirugiaAReagendar)) && (
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
          theme === 'dark' ? 'bg-amber-900/30 border-amber-700 text-amber-100' : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <Clock className="w-5 h-5 flex-shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Reagendamiento</p>
            <p className="text-xs opacity-90 mt-0.5">
              {cirugiaAReagendar ? 'Seleccione el nuevo horario en el calendario y confirme. Se notificará al doctor y al pabellón.' : 'Seleccione un nuevo horario en el calendario o vaya a Solicitudes.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/pabellon/solicitudes', { state: { surgeryRequestId: location.state?.surgeryRequestId } })}
            className="text-xs font-bold underline hover:no-underline"
          >
            Ver Solicitudes
          </button>
        </div>
      )}

      {/* Header */}
      <div id="tour-cal-header" className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between mb-3 sm:mb-4 md:mb-5">
        <div>
          <Breadcrumbs
            anio={anio}
            view={view}
            selectedMonth={selectedMonth}
            selectedWeek={selectedWeek}
            selectedDay={selectedDay}
            onNavigate={handleNavigate}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 w-full sm:w-auto">
          {view === 'year' && (
            <div className={`flex items-center gap-2 border rounded-xl sm:rounded-2xl px-3 py-2 w-full sm:w-auto justify-between sm:justify-start ${
              theme === 'dark' ? 'bg-slate-800 border-slate-700' : theme === 'medical' ? 'bg-white border-blue-100' : 'bg-white border-slate-200'
            }`} role="group" aria-label="Selector de año">
              <button
                onClick={() => setAnio(anio - 1)}
                className={`p-2 sm:p-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation ${theme === 'dark' ? 'hover:bg-slate-700 active:bg-slate-600' : 'hover:bg-slate-100 active:bg-slate-200'}`}
                aria-label="Año anterior"
              >
                <ChevronLeft className={`w-5 h-5 sm:w-4 sm:h-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-400'}`} />
              </button>
              <span className={`text-base sm:text-sm font-bold min-w-[80px] sm:min-w-[60px] text-center ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`} aria-live="polite">{anio}</span>
              <button
                onClick={() => setAnio(anio + 1)}
                className={`p-2 sm:p-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation ${theme === 'dark' ? 'hover:bg-slate-700 active:bg-slate-600' : 'hover:bg-slate-100 active:bg-slate-200'}`}
                aria-label="Año siguiente"
              >
                <ChevronRight className={`w-5 h-5 sm:w-4 sm:h-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-400'}`} />
              </button>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2 flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={filtroPaciente}
              onChange={(e) => setFiltroPaciente(sanitizeString(e.target.value))}
              placeholder="Buscar por nombre de paciente..."
              className="bg-transparent text-sm sm:text-base font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 rounded-xl px-2 py-1.5 sm:py-1 flex-1 min-w-0 placeholder:text-slate-400 placeholder:font-normal"
              aria-label="Buscar por nombre de paciente"
            />
            {filtroPaciente && (
              <button
                onClick={() => setFiltroPaciente('')}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2 flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap leading-relaxed">
              Filtrar:
            </span>
            <select
              value={pabellonId}
              onChange={(e) => setPabellonId(sanitizeString(e.target.value))}
              className="bg-transparent text-sm sm:text-base font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 rounded-xl px-2 py-1.5 sm:py-1 flex-1 sm:flex-none min-w-0"
              aria-label="Filtrar por pabellón"
            >
              <option value="todos">Todos los pabellones</option>
              {pabellones.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mensaje filtro activo */}
      {filtroPaciente && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start sm:items-center gap-2 sm:gap-3">
          <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-black text-blue-900 uppercase tracking-wide leading-relaxed">
              Búsqueda activa: &quot;{filtroPaciente}&quot;
            </p>
            <p className="text-[10px] sm:text-xs text-blue-700 mt-0.5 sm:mt-1">
              Mostrando {cirugias.length} cirugía{cirugias.length !== 1 ? 's' : ''} (futuras y pasadas) que coinciden con el nombre del paciente.
            </p>
          </div>
          <button
            onClick={() => setFiltroPaciente('')}
            className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 hover:text-blue-700 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {cargando ? (
        <div className="card flex items-center justify-center min-h-[300px] sm:min-h-[400px] px-4 py-8">
          <p className="text-slate-400 text-sm sm:text-base font-bold animate-pulse">Cargando datos...</p>
        </div>
      ) : (
        <>
          {view === 'year' && (
            <>
              <div className="flex justify-center sm:justify-end mb-3 md:mb-4">
                <div className={`flex flex-wrap items-center justify-center sm:justify-end gap-2 md:gap-2.5 lg:gap-3 text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-[0.3em] leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-400'}`}>
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-blue-500 flex-shrink-0" />
                    <span className="whitespace-nowrap">Agendado</span>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-yellow-400 flex-shrink-0" />
                    <span className="whitespace-nowrap">Bloqueado</span>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-slate-300 flex-shrink-0" />
                    <span className="whitespace-nowrap">Libre</span>
                  </div>
                  {Object.keys(pendientesPorMes).length > 0 && (
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="whitespace-nowrap">Pendientes</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 md:gap-4 lg:gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {statsMeses.map((mes) => (
                  <button
                    key={mes.indice}
                    onClick={() => { setSelectedMonth(mes.indice); setView('month') }}
                    className={`rounded-xl border-2 shadow-sm p-3 md:p-4 lg:p-5 flex flex-col justify-between text-left hover:border-blue-500 hover:shadow-lg hover:scale-[1.02] transition-all group min-h-[95px] md:min-h-[110px] lg:min-h-[125px] active:scale-[0.98] touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700' : theme === 'medical' ? 'bg-white border-blue-100' : 'bg-white border-slate-100'
                    }`}
                    aria-label={`Ver ${mes.nombre} - ${mes.cirugiasEstimadas} cirugías estimadas, ${mes.porcentajeAgendado}% ocupación`}
                  >
                    <div className="flex items-start justify-between mb-2 md:mb-2.5 w-full gap-1.5 md:gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className={`text-base md:text-lg lg:text-xl font-black transition-colors uppercase truncate leading-normal tracking-wide ${
                            theme === 'dark' ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'
                          }`}>{mes.nombre}</h2>
                          {pendientesPorMes[mes.indice] > 0 && (
                            <span className="shrink-0 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none" title={`${pendientesPorMes[mes.indice]} solicitudes pendientes`}>
                              {pendientesPorMes[mes.indice]}
                            </span>
                          )}
                        </div>
                        <p className={`text-[8px] md:text-[9px] lg:text-[10px] font-bold mt-1 leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
                          {mes.cirugiasEstimadas} cirugías est.
                        </p>
                      </div>
                      <div className="text-right ml-1.5 md:ml-2 flex-shrink-0">
                        <p className={`text-base md:text-lg lg:text-xl font-black leading-normal ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{mes.porcentajeAgendado}%</p>
                        <p className={`text-[7px] md:text-[8px] lg:text-[9px] font-black uppercase tracking-[0.3em] mt-0.5 leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}>
                          Agendado
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto w-full">
                      <div className={`h-2 md:h-2.5 lg:h-3 w-full rounded-full overflow-hidden shadow-inner mb-1.5 ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'}`}>
                        <div className="h-full flex">
                          {mes.porcentajeAgendado > 0 && (
                            <div className="bg-blue-500 transition-all" style={{ width: `${mes.porcentajeAgendado}%` }} aria-label={`${mes.porcentajeAgendado}% agendado`} />
                          )}
                          {mes.porcentajeBloqueado > 0 && (
                            <div className="bg-yellow-400 transition-all" style={{ width: `${mes.porcentajeBloqueado}%` }} aria-label={`${mes.porcentajeBloqueado}% bloqueado`} />
                          )}
                          {mes.porcentajeLibre > 0 && (
                            <div className="bg-slate-300 transition-all" style={{ width: `${mes.porcentajeLibre}%` }} aria-label={`${mes.porcentajeLibre}% libre`} />
                          )}
                        </div>
                      </div>
                      <div className={`flex items-center justify-between text-[8px] md:text-[9px] lg:text-[10px] font-bold mt-1 leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
                        <span className="truncate">{mes.porcentajeBloqueado}% bloqueado</span>
                        <span className="ml-1.5 truncate">{mes.porcentajeLibre}% ocioso</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {view === 'month' && selectedMonth !== null && (
            <MonthView
              anio={anio}
              monthIndex={selectedMonth}
              onWeekClick={(weekStart) => { setSelectedWeek(weekStart); setView('week') }}
            />
          )}

          {view === 'week' && selectedWeek && (
            <WeekView
              weekStart={selectedWeek}
              cirugias={cirugias}
              pabellonId={pabellonId}
              pabellones={pabellones}
              selectedDay={selectedDay}
              onDayClick={(day) => { setSelectedDay(day); setView('day') }}
            />
          )}

          {view === 'day' && selectedDay && (
            <>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {doctoresEnDia.length > 1 && (
                  <>
                    <Stethoscope size={14} className="text-slate-400 shrink-0" />
                    <select
                      value={filtroDoctorId}
                      onChange={e => setFiltroDoctorId(e.target.value)}
                      className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      aria-label="Filtrar por doctor"
                    >
                      <option value="todos">Todos los médicos</option>
                      {doctoresEnDia.map(d => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>
                    {filtroDoctorId !== 'todos' && (
                      <button onClick={() => setFiltroDoctorId('todos')} className="text-xs text-blue-600 font-bold hover:underline">
                        Limpiar
                      </button>
                    )}
                  </>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => exportProgramaDia(cirugiasDetalleFiltered, format(selectedDay, 'yyyy-MM-dd'), clinicInfo)}
                    disabled={cirugiasDetalleFiltered.length === 0}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 border border-blue-200 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Exportar programa a PDF"
                  >
                    <FileDown size={13} />
                    PDF
                  </button>
                  <button
                    onClick={imprimirPrograma}
                    disabled={cirugiasDetalleFiltered.length === 0}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Imprimir programa quirúrgico del día"
                  >
                    <Printer size={13} />
                    Imprimir
                  </button>
                </div>
              </div>
              <DayView
                day={selectedDay}
                pabellones={pabellones}
                cirugias={cirugiasDetalleFiltered}
                bloqueos={bloqueos}
                onSlotSelect={setSelectedSlot}
                selectedSlot={selectedSlot}
                currentRequest={currentRequest}
                onConfirmSlot={handleConfirmSlot}
                onSlotClick={(slotInfo) => { setSlotDetalle(slotInfo); setShowDetallesModal(true) }}
                showError={showError}
                doctorColorMap={doctorColorMap}
              />
            </>
          )}
        </>
      )}

      <ModalConfirmarCupo
        isOpen={showConfirmModal && !!selectedSlot && !!currentRequest}
        onClose={() => setShowConfirmModal(false)}
        selectedSlot={selectedSlot}
        currentRequest={currentRequest}
        cirugiaAReagendar={cirugiaAReagendar}
        pabellones={pabellones}
        horaFin={horaFin}
        setHoraFin={setHoraFin}
        conflictoAgenda={conflictoAgenda}
        setConflictoAgenda={setConflictoAgenda}
        setIgnorarConflicto={setIgnorarConflicto}
        onConfirmar={handleConfirmarCupo}
        showError={showError}
        isPending={programarCirugia.isPending || reagendarCirugia.isPending}
      />

      <ModalDetallesSlot
        isOpen={showDetallesModal}
        onClose={() => { setShowDetallesModal(false); setSlotDetalle(null); setEditandoObservaciones(false) }}
        slotDetalle={slotDetalle}
        historialCirugia={historialCirugia}
        editandoObservaciones={editandoObservaciones}
        setEditandoObservaciones={setEditandoObservaciones}
        observacionesEditadas={observacionesEditadas}
        setObservacionesEditadas={setObservacionesEditadas}
        editarObservaciones={editarObservaciones}
        marcarEnProceso={marcarEnProceso}
        completarCirugia={completarCirugia}
        onCancelarCirugia={() => {
          setSlotDetalle(prev => prev ? { ...prev, action: 'cancel' } : prev)
          setShowDetallesModal(false)
          setShowConfirmCancelar(true)
          setCirugiaACancelar(slotDetalle?.data)
        }}
      />

      <ModalCancelarCirugia
        isOpen={showConfirmCancelar}
        onClose={() => { setShowConfirmCancelar(false); setCirugiaACancelar(null) }}
        cirugiaACancelar={cirugiaACancelar}
        pabellonNombre={slotDetalle?.pabellon}
        onConfirmar={confirmarCancelar}
        isPending={cancelarCirugia.isPending}
      />
    </div>
  )
}
