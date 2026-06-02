import { useState, useMemo, useEffect, useRef } from 'react'
import { useLocation, useNavigate, useBlocker } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { AlertCircle, Ban } from 'lucide-react'
import { validateRut, isValidRutFormat, cleanRut } from '../../utils/rutFormatter'
import { codigosOperaciones, getGrupoFonasaByCodigo, insumoAplicaParaGrupo } from '../../data/codigosOperaciones'
import { useNotifications } from '../../hooks/useNotifications'
import { useTheme } from '../../contexts/ThemeContext'
import ConfirmModal from '../../components/common/ConfirmModal'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import SeccionPaciente from './crearPaciente/SeccionPaciente'
import SeccionHorarios from './crearPaciente/SeccionHorarios'
import SeccionInsumos from './crearPaciente/SeccionInsumos'

export default function CrearPaciente() {
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    rut: '',
    telefono: '',
    prevision: '',
    codigo_operacion: '',
    hora_recomendada: '',
    hora_fin_recomendada: '',
    fecha_preferida: '',
    operating_room_id_preferido: '',
    hora_recomendada_2: '',
    hora_fin_recomendada_2: '',
    fecha_preferida_2: '',
    operating_room_id_preferido_2: '',
    dejar_fecha_a_pabellon: true,
    horarios_extra: [],
    observaciones: '',
    insumos: [],
  })
  const [slot1Seleccionado, setSlot1Seleccionado] = useState(null)
  const [slot2Seleccionado, setSlot2Seleccionado] = useState(null)
  const [showSegundoHorario, setShowSegundoHorario] = useState(false)
  const [insumoSeleccionado, setInsumoSeleccionado] = useState('')
  const [cantidadInsumo, setCantidadInsumo] = useState(1)
  const [rutError, setRutError] = useState('')
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null)
  const [buscandoPaciente, setBuscandoPaciente] = useState(false)
  const [showConfirmSinInsumos, setShowConfirmSinInsumos] = useState(false)
  const [showCalendarioGrid, setShowCalendarioGrid] = useState(true)
  const [historialPaciente, setHistorialPaciente] = useState([])
  const [showHistorial, setShowHistorial] = useState(false)
  const [solicitudDuplicadaAlert, setSolicitudDuplicadaAlert] = useState(false)

  const queryClient = useQueryClient()
  const { showError, showSuccess } = useNotifications()
  const { theme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const isDirty = !!(
    formData.nombre.trim() || formData.apellido.trim() || formData.rut.trim() ||
    formData.codigo_operacion || formData.insumos.length > 0
  )

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !crearPacienteYSolicitud?.isSuccess && currentLocation.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  useEffect(() => {
    const state = location.state
    if (!state?.desdeDisponibilidad || !state.fechaPreferida) return
    const s1 = state.slot1
    const s2 = state.slot2
    if (s1) {
      setFormData(prev => ({
        ...prev,
        fecha_preferida: state.fechaPreferida,
        hora_recomendada: s1.horaInicio || '',
        hora_fin_recomendada: s1.horaFin || '',
        operating_room_id_preferido: s1.operating_room_id || '',
        fecha_preferida_2: s2 ? (state.fechaPreferida2 || state.fechaPreferida) : '',
        hora_recomendada_2: s2?.horaInicio || '',
        hora_fin_recomendada_2: s2?.horaFin || '',
        operating_room_id_preferido_2: s2?.operating_room_id || '',
      }))
      setSlot1Seleccionado({
        operating_room_id: s1.operating_room_id,
        nombre_pabellon: s1.nombrePabellon || '',
        hora_inicio: s1.horaInicio,
        hora_fin: s1.horaFin,
      })
      setSlot2Seleccionado(s2 ? {
        operating_room_id: s2.operating_room_id,
        nombre_pabellon: s2.nombrePabellon || '',
        hora_inicio: s2.horaInicio,
        hora_fin: s2.horaFin,
      } : null)
      if (s2) setShowSegundoHorario(true)
    }
  }, [location.state])

  const { data: doctor } = useQuery({
    queryKey: ['doctor-actual'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('doctors')
        .select('id, estado, nombre, apellido')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
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
  })

  const { data: pabellonesList = [] } = useQuery({
    queryKey: ['operating-rooms-crear'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operating_rooms')
        .select('id, nombre')
        .eq('activo', true)
        .is('deleted_at', null)
        .order('nombre')
      if (error) throw error
      return data || []
    },
  })

  const { data: packData } = useQuery({
    queryKey: ['operation-pack', formData.codigo_operacion],
    queryFn: async () => {
      if (!formData.codigo_operacion) return { packItems: [], recommendedSupplyIds: [] }
      try {
        const { data: rows, error } = await supabase
          .from('operation_supply_packs')
          .select('supply_id, cantidad, supplies(id, nombre, codigo)')
          .eq('codigo_operacion', formData.codigo_operacion)
        if (error) return { packItems: [], recommendedSupplyIds: [] }
        const packItems = (rows || [])
          .filter(r => r.supplies)
          .map(r => ({
            supply_id: r.supply_id,
            nombre: r.supplies.nombre,
            codigo: r.supplies.codigo,
            cantidad: Math.max(0, Number(r.cantidad) || 0),
          }))
        return { packItems, recommendedSupplyIds: packItems.map(p => p.supply_id) }
      } catch {
        return { packItems: [], recommendedSupplyIds: [] }
      }
    },
    enabled: !!formData.codigo_operacion,
  })

  const lastAppliedPackCodeRef = useRef(null)
  useEffect(() => {
    if (!formData.codigo_operacion) {
      lastAppliedPackCodeRef.current = null
      return
    }
    if (!packData?.packItems || lastAppliedPackCodeRef.current === formData.codigo_operacion) return
    // Si el médico agregó insumos manualmente antes de elegir código, no sobreescribir
    if (lastAppliedPackCodeRef.current === null && formData.insumos.length > 0) {
      lastAppliedPackCodeRef.current = formData.codigo_operacion
      return
    }
    const packInsumos = packData.packItems
      .filter(p => p.cantidad >= 1)
      .map(p => ({ supply_id: p.supply_id, nombre: p.nombre, codigo: p.codigo, cantidad: p.cantidad }))
    lastAppliedPackCodeRef.current = formData.codigo_operacion
    setFormData(prev => ({ ...prev, insumos: packInsumos }))
  }, [formData.codigo_operacion, formData.insumos.length, packData?.packItems])

  const grupoFonasa = getGrupoFonasaByCodigo(formData.codigo_operacion)
  const insumosDisponibles = useMemo(() => {
    let list = grupoFonasa
      ? insumos.filter(ins => insumoAplicaParaGrupo(ins.grupos_fonasa, grupoFonasa))
      : insumos
    const recommendedIds = packData?.recommendedSupplyIds || []
    if (recommendedIds.length === 0) return list
    return [...list].sort((a, b) => {
      const aRec = recommendedIds.includes(a.id)
      const bRec = recommendedIds.includes(b.id)
      if (aRec && !bRec) return -1
      if (!aRec && bRec) return 1
      return 0
    })
  }, [insumos, grupoFonasa, packData?.recommendedSupplyIds])

  useEffect(() => {
    if (insumoSeleccionado && !insumosDisponibles.some(i => i.id === insumoSeleccionado)) {
      setInsumoSeleccionado('')
    }
  }, [insumosDisponibles, insumoSeleccionado])

  const buscarPacientePorRut = async (rut) => {
    if (!doctor || !validateRut(rut) || !isValidRutFormat(rut)) return
    setBuscandoPaciente(true)
    setHistorialPaciente([])
    setSolicitudDuplicadaAlert(false)
    setShowHistorial(false)
    try {
      const { data } = await supabase
        .from('patients')
        .select('id, nombre, apellido, telefono, prevision')
        .eq('doctor_id', doctor.id)
        .eq('rut', cleanRut(rut))
        .is('deleted_at', null)
        .maybeSingle()
      if (data) {
        setPacienteEncontrado(data)
        setFormData(prev => ({
          ...prev,
          nombre: data.nombre,
          apellido: data.apellido,
          telefono: data.telefono || prev.telefono,
          prevision: data.prevision || prev.prevision,
        }))
        const [histRes] = await Promise.all([
          supabase
            .from('surgery_requests')
            .select('id, estado, created_at, codigo_operacion')
            .eq('patient_id', data.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(10),
        ])
        const historial = histRes.data || []
        setHistorialPaciente(historial)
        setSolicitudDuplicadaAlert(historial.some(s => s.estado === 'pendiente'))
      } else {
        setPacienteEncontrado(null)
        setHistorialPaciente([])
        setSolicitudDuplicadaAlert(false)
      }
    } catch {
      setPacienteEncontrado(null)
    } finally {
      setBuscandoPaciente(false)
    }
  }

  const crearPacienteYSolicitud = useMutation({
    mutationFn: async (data) => {
      if (!doctor) throw new Error('Doctor no encontrado')

      const { data: pacienteExistente, error: errorBusqueda } = await supabase
        .from('patients')
        .select('id, nombre, apellido')
        .eq('doctor_id', doctor.id)
        .eq('rut', cleanRut(data.rut))
        .is('deleted_at', null)
        .maybeSingle()

      if (errorBusqueda) throw errorBusqueda

      let paciente
      if (pacienteExistente) {
        paciente = pacienteExistente
        if (pacienteExistente.nombre !== data.nombre || pacienteExistente.apellido !== data.apellido || data.telefono || data.prevision) {
          const { error: updateError } = await supabase
            .from('patients')
            .update({
              nombre: data.nombre,
              apellido: data.apellido,
              ...(data.telefono ? { telefono: data.telefono } : {}),
              ...(data.prevision ? { prevision: data.prevision } : {}),
              updated_at: new Date().toISOString()
            })
            .eq('id', pacienteExistente.id)
          if (updateError) throw updateError
          paciente = { ...pacienteExistente, nombre: data.nombre, apellido: data.apellido }
        }
      } else {
        const { data: nuevoPaciente, error: pacienteError } = await supabase
          .from('patients')
          .insert({
            doctor_id: doctor.id,
            nombre: data.nombre,
            apellido: data.apellido,
            rut: cleanRut(data.rut),
            ...(data.telefono ? { telefono: data.telefono } : {}),
            ...(data.prevision ? { prevision: data.prevision } : {}),
          })
          .select()
          .single()
        if (pacienteError) throw pacienteError
        paciente = nuevoPaciente
      }

      const dejarAPabellon = Boolean(data.dejar_fecha_a_pabellon)
      const payloadSolicitud = {
        doctor_id: doctor.id,
        patient_id: paciente.id,
        codigo_operacion: data.codigo_operacion,
        observaciones: data.observaciones || null,
        dejar_fecha_a_pabellon: dejarAPabellon,
        hora_recomendada: dejarAPabellon ? null : (data.hora_recomendada || null),
        hora_fin_recomendada: dejarAPabellon ? null : (data.hora_fin_recomendada || null),
        fecha_preferida: dejarAPabellon ? null : (data.fecha_preferida || null),
        operating_room_id_preferido: dejarAPabellon ? null : (data.operating_room_id_preferido || null),
        hora_recomendada_2: dejarAPabellon ? null : (data.hora_recomendada_2 || null),
        hora_fin_recomendada_2: dejarAPabellon ? null : (data.hora_fin_recomendada_2 || null),
        fecha_preferida_2: dejarAPabellon ? null : (data.fecha_preferida_2 || null),
        operating_room_id_preferido_2: dejarAPabellon ? null : (data.operating_room_id_preferido_2 || null),
        horarios_preferidos_extra: (data.horarios_extra?.length
          ? data.horarios_extra.map(({ _key: _k, ...h }) => h)
          : null),
      }
      const { data: solicitud, error: solicitudError } = await supabase
        .from('surgery_requests')
        .insert(payloadSolicitud)
        .select()
        .single()

      if (solicitudError) throw solicitudError

      if (data.insumos && data.insumos.length > 0) {
        const insumosData = data.insumos.map(insumo => ({
          surgery_request_id: solicitud.id,
          supply_id: insumo.supply_id,
          cantidad: insumo.cantidad,
        }))
        const { error: insumosError } = await supabase
          .from('surgery_request_supplies')
          .insert(insumosData)
        if (insumosError) throw insumosError
      }

      try {
        const { data: pabellonUsers } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'pabellon')
          .is('deleted_at', null)

        if (pabellonUsers && pabellonUsers.length > 0) {
          const notificaciones = pabellonUsers.map(u => ({
            user_id: u.id,
            tipo: 'orden_sin_agendar',
            titulo: 'Nueva orden de cirugía sin agendar',
            mensaje: `Dr. ${doctor.nombre} ${doctor.apellido} tiene un paciente pendiente de agendamiento: ${data.nombre} ${data.apellido} — ${data.codigo_operacion}`,
            relacionado_con: solicitud.id,
          }))
          await supabase.from('notifications').insert(notificaciones)
        }
      } catch {
        // no bloquear creación si falla la notificación
      }

      return { paciente, solicitud }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes-doctor-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['estado-slots-pabellon'] })
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
      queryClient.invalidateQueries({ queryKey: ['solicitudes-pendientes'] })
      setFormData({
        nombre: '', apellido: '', rut: '', telefono: '', prevision: '', codigo_operacion: '',
        hora_recomendada: '', hora_fin_recomendada: '', fecha_preferida: '', operating_room_id_preferido: '',
        hora_recomendada_2: '', hora_fin_recomendada_2: '', fecha_preferida_2: '', operating_room_id_preferido_2: '',
        dejar_fecha_a_pabellon: true, horarios_extra: [], observaciones: '', insumos: [],
      })
      setSlot1Seleccionado(null)
      setSlot2Seleccionado(null)
      setShowSegundoHorario(false)
      setRutError('')
      let mensaje = 'Solicitud creada.'
      if (variables?.dejar_fecha_a_pabellon) {
        mensaje = 'Solicitud creada. Pabellón asignará fecha y hora.'
      } else if (variables?.fecha_preferida) {
        try {
          const fechaReserva = new Date(variables.fecha_preferida + 'T12:00:00')
          const diaYFecha = format(fechaReserva, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
          mensaje = `Se creó una reserva para este día: ${diaYFecha.charAt(0).toUpperCase() + diaYFecha.slice(1)}.`
        } catch {
          mensaje = 'Solicitud creada exitosamente. El horario quedó guardado para este paciente.'
        }
      } else {
        mensaje = 'Solicitud creada exitosamente. El horario quedó guardado para este paciente.'
      }
      showSuccess(mensaje)
      if (variables?.fecha_preferida && !variables?.dejar_fecha_a_pabellon) {
        navigate('/doctor/horarios', { state: { fecha: variables.fecha_preferida }, replace: true })
      }
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      let mensaje = 'Error al crear la solicitud'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        mensaje = 'Error de conexión. Verifique su conexión a internet e intente nuevamente.'
      } else if (errorMessage.includes('duplicate key') || error.code === '23505') {
        mensaje = 'Ya existe un paciente con este RUT. La solicitud debería haberse creado usando el paciente existente.'
      } else if (errorMessage.includes('doctor debe estar activo')) {
        mensaje = 'No puede crear solicitudes. Su estado actual no permite esta acción'
      } else {
        mensaje = errorMessage
      }
      showError(mensaje)
    },
  })

  const agregarInsumo = () => {
    if (!insumoSeleccionado) { showError('Por favor seleccione un insumo'); return }
    const insumo = insumos.find(i => i.id === insumoSeleccionado)
    if (!insumo) { showError('Insumo no encontrado'); return }
    if (formData.insumos.some(i => i.supply_id === insumo.id)) { showError('Este insumo ya está agregado a la solicitud'); return }
    if (!cantidadInsumo || cantidadInsumo < 1) { showError('La cantidad debe ser al menos 1'); return }
    setFormData({ ...formData, insumos: [...formData.insumos, { supply_id: insumo.id, nombre: insumo.nombre, codigo: insumo.codigo, cantidad: cantidadInsumo }] })
    setInsumoSeleccionado('')
    setCantidadInsumo(1)
    showSuccess(`Insumo "${insumo.nombre}" agregado correctamente`)
  }

  const eliminarInsumo = (supplyId) => {
    setFormData({ ...formData, insumos: formData.insumos.filter((ins) => ins.supply_id !== supplyId) })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!doctor) { showError('No se pudo obtener la información del doctor'); return }
    if (doctor.estado !== 'activo') {
      showError(`No puede crear solicitudes. Su estado actual es: ${doctor.estado === 'vacaciones' ? 'vacaciones' : doctor.estado}. Por favor, contacte al administrador si necesita crear solicitudes.`)
      return
    }
    if (formData.nombre.trim().length < 2) { showError('El nombre debe tener al menos 2 caracteres'); return }
    if (formData.apellido.trim().length < 2) { showError('El apellido debe tener al menos 2 caracteres'); return }
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(formData.nombre)) { showError('El nombre debe contener letras'); return }
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(formData.apellido)) { showError('El apellido debe contener letras'); return }
    if (formData.telefono) {
      const telefonoLimpio = formData.telefono.replace(/\s/g, '')
      if (!/^\+[1-9]\d{7,14}$/.test(telefonoLimpio)) { showError('El teléfono debe estar en formato internacional: +56912345678'); return }
    }
    if (!isValidRutFormat(formData.rut)) {
      setRutError('El formato del RUT no es válido. Use el formato: 12.345.678-9')
      showError('El formato del RUT no es válido')
      return
    }
    if (!validateRut(formData.rut)) {
      setRutError('El dígito verificador del RUT no es válido')
      showError('El dígito verificador del RUT no es válido. Por favor, verifique el RUT ingresado.')
      return
    }
    setRutError('')
    const codigoValido = codigosOperaciones.some(c => c.codigo === formData.codigo_operacion)
    if (!codigoValido) { showError('Código de operación inválido. Por favor, seleccione un código válido de la lista.'); return }
    if (formData.insumos.length === 0) { setShowConfirmSinInsumos(true); return }
    crearPacienteYSolicitud.mutate({ ...formData, rut: cleanRut(formData.rut) })
  }

  const confirmarSinInsumos = () => {
    crearPacienteYSolicitud.mutate({ ...formData, rut: cleanRut(formData.rut) })
    setShowConfirmSinInsumos(false)
  }

  const puedeCrearSolicitud = doctor?.estado === 'activo'
  const estaEnVacaciones = doctor?.estado === 'vacaciones'

  const pasos = [
    { label: 'Paciente', completo: formData.nombre.trim().length >= 2 && formData.apellido.trim().length >= 2 && validateRut(formData.rut) },
    { label: 'Operación', completo: !!formData.codigo_operacion },
    { label: 'Insumos', completo: formData.insumos.length > 0 },
    { label: 'Horario', completo: formData.dejar_fecha_a_pabellon || !!formData.fecha_preferida },
  ]
  const completados = pasos.filter(p => p.completo).length

  return (
    <div className="space-y-6">
      <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Crear Ficha de Paciente</h1>

      {/* Indicador de progreso */}
      <div className={`rounded-xl border p-4 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}>
            Progreso del formulario
          </span>
          <span className={`ml-auto text-xs font-bold ${completados === pasos.length ? 'text-green-600' : (theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}`}>
            {completados}/{pasos.length} completados
          </span>
        </div>
        <div className="flex gap-2">
          {pasos.map((paso, i) => (
            <div key={paso.label} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full h-2 rounded-full transition-colors ${paso.completo ? 'bg-blue-600' : (theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200')}`} />
              <span className={`text-[10px] font-bold ${paso.completo ? (theme === 'dark' ? 'text-blue-400' : 'text-blue-600') : (theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}`}>
                {i + 1}. {paso.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Alertas de estado del doctor */}
      {estaEnVacaciones && (
        <div className="card bg-amber-50 border-2 border-amber-200">
          <div className="flex items-start gap-4">
            <div className="bg-amber-100 p-3 rounded-full flex-shrink-0">
              <Ban className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-amber-900 mb-2">Estado: En Vacaciones</h3>
              <p className="text-sm text-amber-800 mb-1">No puede crear solicitudes quirúrgicas mientras su estado sea &quot;vacaciones&quot;.</p>
              <p className="text-xs text-amber-700">Si necesita crear solicitudes, por favor contacte al administrador del sistema para cambiar su estado a &quot;activo&quot;.</p>
            </div>
          </div>
        </div>
      )}

      {doctor && !puedeCrearSolicitud && !estaEnVacaciones && (
        <div className="card bg-red-50 border-2 border-red-200">
          <div className="flex items-start gap-4">
            <div className="bg-red-100 p-3 rounded-full flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-red-900 mb-2">Estado No Válido</h3>
              <p className="text-sm text-red-800">Su estado actual ({doctor.estado}) no permite crear solicitudes. Por favor, contacte al administrador.</p>
            </div>
          </div>
        </div>
      )}

      <div className={`card ${!puedeCrearSolicitud ? 'opacity-60 pointer-events-none' : ''}`}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <SeccionPaciente
            formData={formData}
            setFormData={setFormData}
            rutError={rutError}
            setRutError={setRutError}
            pacienteEncontrado={pacienteEncontrado}
            setPacienteEncontrado={setPacienteEncontrado}
            buscandoPaciente={buscandoPaciente}
            historialPaciente={historialPaciente}
            setHistorialPaciente={setHistorialPaciente}
            solicitudDuplicadaAlert={solicitudDuplicadaAlert}
            setSolicitudDuplicadaAlert={setSolicitudDuplicadaAlert}
            showHistorial={showHistorial}
            setShowHistorial={setShowHistorial}
            onBuscarPaciente={buscarPacientePorRut}
          />

          <SeccionHorarios
            formData={formData}
            setFormData={setFormData}
            slot1Seleccionado={slot1Seleccionado}
            setSlot1Seleccionado={setSlot1Seleccionado}
            slot2Seleccionado={slot2Seleccionado}
            setSlot2Seleccionado={setSlot2Seleccionado}
            showSegundoHorario={showSegundoHorario}
            setShowSegundoHorario={setShowSegundoHorario}
            showCalendarioGrid={showCalendarioGrid}
            setShowCalendarioGrid={setShowCalendarioGrid}
            pabellonesList={pabellonesList}
            theme={theme}
            locationState={location.state}
          />

          <SeccionInsumos
            formData={formData}
            theme={theme}
            insumoSeleccionado={insumoSeleccionado}
            setInsumoSeleccionado={setInsumoSeleccionado}
            cantidadInsumo={cantidadInsumo}
            setCantidadInsumo={setCantidadInsumo}
            insumosDisponibles={insumosDisponibles}
            packData={packData}
            grupoFonasa={grupoFonasa}
            onAgregar={agregarInsumo}
            onEliminar={eliminarInsumo}
          />

          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={!puedeCrearSolicitud || crearPacienteYSolicitud.isPending}
          >
            {crearPacienteYSolicitud.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" />
                Creando...
              </span>
            ) : puedeCrearSolicitud ? (
              'Crear Paciente y Solicitud'
            ) : (
              'No disponible - Estado inválido'
            )}
          </button>
        </form>
      </div>

      <ConfirmModal
        isOpen={showConfirmSinInsumos}
        onClose={() => setShowConfirmSinInsumos(false)}
        onConfirm={confirmarSinInsumos}
        title="Confirmar Solicitud Sin Insumos"
        message="No ha seleccionado insumos. ¿Desea continuar con la solicitud sin insumos?"
        confirmText="Continuar"
        cancelText="Cancelar"
        variant="warning"
      />

      <ConfirmModal
        isOpen={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => { blocker.proceed?.(); blocker.reset?.() }}
        title="¿Salir sin guardar?"
        message="Tienes datos ingresados que se perderán si abandonas esta página. ¿Deseas continuar?"
        confirmText="Sí, salir"
        cancelText="Quedarme"
        variant="warning"
      />
    </div>
  )
}
