import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { Plus, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { formatRut, cleanRut, validateRut } from '../../utils/rutFormatter'
import { useNotifications } from '../../hooks/useNotifications'
import toast from 'react-hot-toast'
import { logger } from '../../utils/logger'
import { useDebounce } from '../../hooks/useDebounce'
import { handleMutationError } from '../../utils/errorHandler'
import { exportToCSV, exportToExcel } from '../../utils/exportData'
import ConfirmModal from '../../components/common/ConfirmModal'
import { useTheme } from '../../contexts/ThemeContext'
import MedicosFiltros from './medicos/MedicosFiltros'
import MedicoForm from './medicos/MedicoForm'
import MedicosTable from './medicos/MedicosTable'
import ModalImportarMedicos from './medicos/ModalImportarMedicos'

const ESPECIALIDADES = [
  'cirugia_general',
  'cirugia_cardiovascular',
  'cirugia_plastica',
  'cirugia_ortopedica',
  'neurocirugia',
  'cirugia_oncologica',
  'urologia',
  'ginecologia',
  'otorrinolaringologia',
  'oftalmologia',
  'otra',
]

const EMPTY_FORM = {
  nombre: '',
  apellido: '',
  rut: '',
  email: '',
  telefono: '',
  especialidad: '',
  estado: 'activo',
  acceso_web_enabled: false,
  username: '',
  password: '',
}

const notifyDoctorAction = (type, doctorName, details = null) => {
  const isCreate = type === 'create'
  const title = isCreate ? 'Médico Creado' : 'Perfil Actualizado'
  const icon = isCreate ? '✅' : '🔄'

  toast.custom((t) => (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-white dark:bg-slate-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
    >
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <span className="text-2xl">{icon}</span>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
              Doctor: <span className="font-semibold">{doctorName}</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">{new Date().toLocaleString()}</p>
            {details && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 p-2 rounded whitespace-pre-wrap">
                {details}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex border-l border-gray-200 dark:border-slate-700">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Cerrar
        </button>
      </div>
    </div>
  ), { duration: 8000, position: 'top-right' })
}

const generarUsername = (nombre, apellido) => {
  if (!nombre) return ''
  return nombre.charAt(0).toLowerCase() + (apellido ? apellido.toLowerCase() : '')
}

export default function Medicos() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [medicoEditando, setMedicoEditando] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showConfirmEliminar, setShowConfirmEliminar] = useState(false)
  const [showImportar, setShowImportar] = useState(false)
  const [medicoAEliminar, setMedicoAEliminar] = useState(null)
  const [credencialesModal, setCredencialesModal] = useState(null) // { nombre, username, email, password }
  const [fieldErrors, setFieldErrors] = useState({})
  const [touchedFields, setTouchedFields] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState('apellido')
  const [sortDir, setSortDir] = useState('asc')
  const itemsPerPage = 20

  const queryClient = useQueryClient()
  const { showSuccess, showError, showInfo } = useNotifications()
  const debouncedBusqueda = useDebounce(busqueda, 300)
  const { theme } = useTheme()

  const { data: medicos = [], isLoading } = useQuery({
    queryKey: ['medicos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .is('deleted_at', null)
        .order('apellido', { ascending: true })
      if (error) throw error
      return data
    },
  })

  const { data: cirugiasEstaSemana = [] } = useQuery({
    queryKey: ['medicos-cirugias-semana'],
    queryFn: async () => {
      const hoy = new Date()
      const lunes = new Date(hoy)
      lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
      const domingo = new Date(lunes)
      domingo.setDate(lunes.getDate() + 6)
      const { data } = await supabase
        .from('surgeries')
        .select('doctor_id')
        .gte('fecha', lunes.toISOString().slice(0, 10))
        .lte('fecha', domingo.toISOString().slice(0, 10))
        .not('estado', 'eq', 'cancelada')
        .is('deleted_at', null)
      return data || []
    },
  })

  const cirugiasSemanaPorDoctor = useMemo(() => {
    const map = {}
    for (const c of cirugiasEstaSemana) {
      if (c.doctor_id) map[c.doctor_id] = (map[c.doctor_id] || 0) + 1
    }
    return map
  }, [cirugiasEstaSemana])

  const medicosFiltrados = useMemo(() => {
    return medicos.filter(medico => {
      if (debouncedBusqueda) {
        const q = debouncedBusqueda.toLowerCase()
        const nombre = `${medico.nombre} ${medico.apellido}`.toLowerCase()
        const rut = formatRut(medico.rut).toLowerCase()
        const email = (medico.email || '').toLowerCase()
        if (!nombre.includes(q) && !rut.includes(q) && !email.includes(q)) return false
      }
      if (filtroEspecialidad && medico.especialidad !== filtroEspecialidad) return false
      if (filtroEstado && medico.estado !== filtroEstado) return false
      return true
    })
  }, [medicos, debouncedBusqueda, filtroEspecialidad, filtroEstado])

  const totalPages = Math.ceil(medicosFiltrados.length / itemsPerPage)

  const medicosPaginados = useMemo(() => {
    const sorted = [...medicosFiltrados].sort((a, b) => {
      const va = sortField === 'nombre' ? `${a.apellido} ${a.nombre}` : (a[sortField] ?? '')
      const vb = sortField === 'nombre' ? `${b.apellido} ${b.nombre}` : (b[sortField] ?? '')
      const cmp = String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    const start = (currentPage - 1) * itemsPerPage
    return sorted.slice(start, start + itemsPerPage)
  }, [medicosFiltrados, currentPage, itemsPerPage, sortField, sortDir])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setCurrentPage(1)
  }

  useEffect(() => { setCurrentPage(1) }, [debouncedBusqueda, filtroEspecialidad, filtroEstado])

  // Auto-update username when nombre/apellido change with web access enabled
  useEffect(() => {
    if (formData.acceso_web_enabled && !medicoEditando && formData.nombre && formData.apellido) {
      const nuevo = generarUsername(formData.nombre, formData.apellido)
      if (nuevo) setFormData(prev => ({ ...prev, username: nuevo }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.nombre, formData.apellido])

  const handleExportCSV = () => {
    try {
      const columns = [
        { key: 'nombre', label: 'Nombre' },
        { key: 'apellido', label: 'Apellido' },
        { key: 'rut', label: 'RUT' },
        { key: 'email', label: 'Email' },
        { key: 'especialidad', label: 'Especialidad' },
        { key: 'estado', label: 'Estado' },
        { key: 'acceso_web_enabled', label: 'Acceso Web' },
      ]
      exportToCSV(medicosFiltrados.map(m => ({
        ...m,
        rut: formatRut(m.rut),
        especialidad: m.especialidad.replace(/_/g, ' '),
        acceso_web_enabled: m.acceso_web_enabled ? 'Sí' : 'No',
      })), columns, 'medicos')
      showSuccess('Datos exportados a CSV exitosamente')
    } catch (error) {
      showError(`Error al exportar: ${error.message}`)
    }
  }

  const handleExportExcel = async () => {
    try {
      const columns = [
        { key: 'nombre', label: 'Nombre' },
        { key: 'apellido', label: 'Apellido' },
        { key: 'rut', label: 'RUT' },
        { key: 'email', label: 'Email' },
        { key: 'especialidad', label: 'Especialidad' },
        { key: 'estado', label: 'Estado' },
        { key: 'acceso_web_enabled', label: 'Acceso Web' },
      ]
      await exportToExcel(medicosFiltrados.map(m => ({
        ...m,
        rut: formatRut(m.rut),
        especialidad: m.especialidad.replace(/_/g, ' '),
        acceso_web_enabled: m.acceso_web_enabled ? 'Sí' : 'No',
      })), columns, 'medicos')
      showSuccess('Datos exportados a Excel exitosamente')
    } catch (error) {
      showError(`Error al exportar: ${error.message}`)
    }
  }

  const validateField = (name, value) => {
    const errors = { ...fieldErrors }
    if (name === 'email' && value) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ok ? delete errors.email : (errors.email = 'El formato del email no es válido')
    }
    if (name === 'rut' && value) {
      const ok = validateRut(cleanRut(value))
      ok ? delete errors.rut : (errors.rut = 'El dígito verificador del RUT no es válido')
    }
    if (name === 'password' && formData.acceso_web_enabled && value) {
      const ok = /^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9@$!%*?&]{8,128}$/.test(value)
      ok ? delete errors.password : (errors.password = 'La contraseña debe tener entre 8 y 128 caracteres, con al menos una letra y un número.')
    }
    setFieldErrors(errors)
  }

  const handleFieldChange = (name, value) => {
    setFormData({ ...formData, [name]: value })
    if (touchedFields[name]) validateField(name, value)
  }

  const handleFieldBlur = (name) => {
    setTouchedFields({ ...touchedFields, [name]: true })
    validateField(name, formData[name])
  }

  const handleNuevoMedico = () => {
    setMostrarFormulario(true)
    setMedicoEditando(null)
    setFormData(EMPTY_FORM)
    setFieldErrors({})
    setTouchedFields({})
    setShowPassword(false)
  }

  const handleCancelForm = () => {
    setMostrarFormulario(false)
    setMedicoEditando(null)
    setFieldErrors({})
    setTouchedFields({})
  }

  const crearMedico = useMutation({
    mutationFn: async (data) => {
      const normalizedData = {
        ...data,
        email: data.email.toLowerCase().trim(),
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
      }
      if (!ESPECIALIDADES.includes(normalizedData.especialidad)) {
        throw new Error(`Especialidad inválida: ${normalizedData.especialidad}`)
      }
      if (!/^[0-9]{7,8}-[0-9kK]{1}$/.test(normalizedData.rut)) {
        throw new Error('Formato de RUT inválido. Debe ser: 12345678-9')
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')

      const { data: functionData, error: functionError } = await supabase.functions.invoke('create-doctor', {
        body: normalizedData,
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (functionError) {
        logger.errorWithContext('Error al invocar Edge Function create-doctor', functionError, { functionData })
        throw new Error(functionError.message || 'Error al invocar Edge Function')
      }
      if (!functionData) throw new Error('Respuesta vacía de la Edge Function')
      if (!functionData.success) throw new Error(functionData.error || 'Error al crear médico')
      return { ...functionData.doctor, tempPassword: functionData.tempPassword }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['medicos'] })
      setMostrarFormulario(false)
      setFormData(EMPTY_FORM)
      setShowPassword(false)
      if (result.tempPassword) {
        // Mostrar contraseña en modal dedicado en lugar de toast (evita exposición en screenshots)
        setCredencialesModal({ nombre: `${result.nombre} ${result.apellido}`, username: result.username || result.email, email: result.email, password: result.tempPassword })
      } else {
        notifyDoctorAction('create', `${result.nombre} ${result.apellido}`, 'Acceso web deshabilitado.')
      }
    },
    onError: (error) => {
      logger.errorWithContext('Error completo al crear médico', error, { formData: { ...formData, password: '***' } })
      if (handleMutationError(error, showError)) return
      showError(`Error al crear médico: ${error?.message || error?.toString() || 'Error desconocido'}`)
    },
  })

  const actualizarMedico = useMutation({
    mutationFn: async ({ id, data, password }) => {
      if (data.email && medicoEditando && data.email !== medicoEditando.email) {
        const { data: existente, error: errBusqueda } = await supabase
          .from('doctors')
          .select('id')
          .eq('email', data.email.toLowerCase().trim())
          .neq('id', id)
          .is('deleted_at', null)
          .maybeSingle()
        if (errBusqueda) throw errBusqueda
        if (existente) throw new Error('El email ya está registrado para otro médico')
      }
      if (password) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No hay sesión activa')
        const { data: fnData, error: fnError } = await supabase.functions.invoke('update-doctor-password', {
          body: { doctorId: id, password },
        })
        if (fnError) {
          logger.errorWithContext('Error invocando update-doctor-password', fnError)
          throw new Error(fnError.message || 'Error al actualizar contraseña')
        }
        if (fnData && fnData.error) throw new Error(fnData.error)
      }
      const { error } = await supabase.from('doctors').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['medicos'] })
      setMedicoEditando(null)
      setMostrarFormulario(false)
      const nombre = variables.data.nombre
        ? `${variables.data.nombre} ${variables.data.apellido}`
        : (medicoEditando ? `${medicoEditando.nombre} ${medicoEditando.apellido}` : 'Doctor')
      const detalle = variables.password
        ? 'Perfil y contraseña actualizados correctamente.'
        : 'Los datos han sido actualizados correctamente.'
      notifyDoctorAction('update', nombre, detalle)
    },
    onError: (error) => {
      if (handleMutationError(error, showError)) return
      showError(`Error al actualizar médico: ${error.message || error.toString() || 'Error desconocido'}`)
    },
  })

  const toggleAccesoWeb = useMutation({
    mutationFn: async ({ id, acceso_web_enabled }) => {
      const { error } = await supabase.from('doctors').update({ acceso_web_enabled }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medicos'] }),
    onError: (error) => {
      showError(`Error al cambiar acceso web: ${error.message || 'Error desconocido'}`)
      logger.error('Error toggleAccesoWeb:', error)
    },
  })

  const toggleEstado = useMutation({
    mutationFn: async ({ id, estado }) => {
      const nuevoEstado = estado === 'activo' ? 'vacaciones' : 'activo'
      const { error } = await supabase.from('doctors').update({ estado: nuevoEstado }).eq('id', id)
      if (error) throw error
      return nuevoEstado
    },
    onSuccess: (nuevoEstado) => {
      queryClient.invalidateQueries({ queryKey: ['medicos'] })
      toast.success(`Médico cambiado a ${nuevoEstado === 'activo' ? 'activo' : 'vacaciones'}`)
    },
    onError: (error) => {
      toast.error('Error al cambiar estado del médico')
      logger.error('Error toggleEstado:', error)
    },
  })

  const eliminarMedico = useMutation({
    mutationFn: async (id) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')
      const { data: fnData, error: fnError } = await supabase.functions.invoke('delete-doctor', {
        body: { doctorId: id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (fnError) {
        logger.errorWithContext('Error al invocar Edge Function delete-doctor', fnError)
        throw new Error(fnError.message || 'Error al eliminar médico')
      }
      if (!fnData) throw new Error('Respuesta vacía de la Edge Function')
      if (!fnData.success) throw new Error(fnData.error || 'Error al eliminar médico')
      return fnData
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['medicos'] })
      if (result.deleted) {
        showInfo(
          `✅ Médico eliminado completamente\n\n👤 Nombre: ${result.deleted.doctor}\n📧 Email: ${result.deleted.email}\n🆔 RUT: ${result.deleted.rut}\n\nTodos los datos relacionados han sido eliminados.`
        )
      } else {
        showSuccess('Médico eliminado exitosamente')
      }
    },
    onError: (error) => {
      logger.errorWithContext('Error completo al eliminar médico', error)
      if (handleMutationError(error, showError)) return
      showError(`Error al eliminar médico: ${error.message || error.toString() || 'Error desconocido'}`)
    },
  })

  const handleEliminar = (medico) => {
    setMedicoAEliminar(medico)
    setShowConfirmEliminar(true)
  }

  const confirmarEliminar = () => {
    if (medicoAEliminar) eliminarMedico.mutate(medicoAEliminar.id)
    setMedicoAEliminar(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.nombre.trim().length < 2) return showError('El nombre debe tener al menos 2 caracteres')
    if (formData.apellido.trim().length < 2) return showError('El apellido debe tener al menos 2 caracteres')
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(formData.nombre)) return showError('El nombre debe contener letras')
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(formData.apellido)) return showError('El apellido debe contener letras')
    if (formData.telefono) {
      const tel = formData.telefono.replace(/\s/g, '')
      if (!/^\+[1-9]\d{7,14}$/.test(tel)) return showError('El teléfono debe estar en formato internacional: +56912345678')
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return showError('El formato del email no es válido')
    if (!validateRut(cleanRut(formData.rut))) return showError('El RUT ingresado no es válido. Verifique el dígito verificador.')
    if (formData.acceso_web_enabled) {
      if (!medicoEditando && (!formData.username || !formData.password)) {
        return showInfo('Si habilitas el acceso web, debes proporcionar un nombre de usuario y contraseña.')
      }
      if (formData.password) {
        const ok = /^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9@$!%*?&]{8,128}$/.test(formData.password)
        if (!ok) return showError('La contraseña debe tener entre 8 y 128 caracteres, con al menos una letra y un número.')
      }
    }
    const dataToSubmit = { ...formData, rut: cleanRut(formData.rut), email: formData.email.toLowerCase().trim() }
    delete dataToSubmit.username
    delete dataToSubmit.password
    if (!medicoEditando && formData.acceso_web_enabled) {
      dataToSubmit.username = formData.username.toLowerCase().trim()
      dataToSubmit.password = formData.password
    }
    if (medicoEditando) {
      actualizarMedico.mutate({ id: medicoEditando.id, data: dataToSubmit, password: formData.password || null })
    } else {
      crearMedico.mutate(dataToSubmit)
    }
  }

  const iniciarEdicion = (medico) => {
    setMedicoEditando(medico)
    setFormData({
      nombre: medico.nombre,
      apellido: medico.apellido,
      rut: formatRut(medico.rut),
      email: (medico.email || '').toLowerCase(),
      telefono: medico.telefono || '',
      especialidad: medico.especialidad,
      estado: medico.estado,
      acceso_web_enabled: medico.acceso_web_enabled,
      username: '',
      password: '',
    })
    setFieldErrors({})
    setTouchedFields({})
    setMostrarFormulario(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className={`text-2xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Gestión de Médicos
        </h1>
        <div className="flex flex-wrap gap-2">
          {medicosFiltrados.length > 0 && (
            <>
              <button
                onClick={handleExportCSV}
                className="btn-secondary flex items-center gap-2 text-sm"
                title="Exportar a CSV"
                aria-label="Exportar a CSV"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={handleExportExcel}
                className="btn-secondary flex items-center gap-2 text-sm"
                title="Exportar a Excel"
                aria-label="Exportar a Excel"
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Excel</span>
              </button>
            </>
          )}
          <button
            onClick={() => setShowImportar(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Importar médicos desde CSV"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Importar CSV</span>
          </button>
          <button onClick={handleNuevoMedico} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Nuevo Médico</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      <MedicosFiltros
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        filtroEspecialidad={filtroEspecialidad}
        setFiltroEspecialidad={setFiltroEspecialidad}
        filtroEstado={filtroEstado}
        setFiltroEstado={setFiltroEstado}
        medicosFiltrados={medicosFiltrados}
        medicos={medicos}
        especialidades={ESPECIALIDADES}
      />

      {mostrarFormulario && (
        <MedicoForm
          medicoEditando={medicoEditando}
          formData={formData}
          setFormData={setFormData}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          fieldErrors={fieldErrors}
          touchedFields={touchedFields}
          handleFieldChange={handleFieldChange}
          handleFieldBlur={handleFieldBlur}
          handleSubmit={handleSubmit}
          crearMedico={crearMedico}
          actualizarMedico={actualizarMedico}
          generarUsername={generarUsername}
          onCancel={handleCancelForm}
          especialidades={ESPECIALIDADES}
        />
      )}

      <MedicosTable
        isLoading={isLoading}
        medicosFiltrados={medicosFiltrados}
        medicosPaginados={medicosPaginados}
        busqueda={busqueda}
        filtroEspecialidad={filtroEspecialidad}
        filtroEstado={filtroEstado}
        theme={theme}
        sortField={sortField}
        sortDir={sortDir}
        handleSort={handleSort}
        cirugiasSemanaPorDoctor={cirugiasSemanaPorDoctor}
        iniciarEdicion={iniciarEdicion}
        toggleAccesoWeb={toggleAccesoWeb}
        toggleEstado={toggleEstado}
        eliminarMedico={eliminarMedico}
        handleEliminar={handleEliminar}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {showImportar && (
        <ModalImportarMedicos
          onClose={() => setShowImportar(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['medicos'] })
            setShowImportar(false)
            showSuccess('Médicos importados correctamente')
          }}
        />
      )}

      {/* Modal de credenciales — mostrado en lugar de toast para evitar exposición en screenshots */}
      {credencialesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-black text-slate-900">Médico creado — Credenciales de acceso</h2>
            <p className="text-sm text-slate-500">Anota estas credenciales antes de cerrar. No se mostrarán nuevamente.</p>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm font-mono">
              <p><span className="text-slate-500">Nombre:</span> <strong>{credencialesModal.nombre}</strong></p>
              <p><span className="text-slate-500">Usuario:</span> <strong>{credencialesModal.username}</strong></p>
              <p><span className="text-slate-500">Email:</span> <strong>{credencialesModal.email}</strong></p>
              <p><span className="text-slate-500">Contraseña:</span> <strong>{credencialesModal.password}</strong></p>
            </div>
            <p className="text-xs text-amber-600 font-semibold">⚠️ El médico debe cambiar su contraseña al ingresar por primera vez.</p>
            <button
              onClick={() => setCredencialesModal(null)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Entendido, ya las anoté
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmEliminar}
        onClose={() => { setShowConfirmEliminar(false); setMedicoAEliminar(null) }}
        onConfirm={confirmarEliminar}
        title="Eliminar Médico"
        message={medicoAEliminar
          ? `⚠️ ELIMINACIÓN PERMANENTE\n\n¿Estás seguro de que deseas eliminar completamente al médico:\n\n👤 ${medicoAEliminar.nombre} ${medicoAEliminar.apellido}\n📧 ${medicoAEliminar.email}\n🆔 RUT: ${formatRut(medicoAEliminar.rut)}\n\nEsto eliminará PERMANENTEMENTE:\n• El correo electrónico\n• El nombre de usuario\n• El RUT\n• Todos los pacientes asociados\n• Todas las solicitudes quirúrgicas\n• Todas las cirugías programadas\n• Todos los datos relacionados\n\n⚠️ Esta acción NO se puede deshacer.`
          : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  )
}
