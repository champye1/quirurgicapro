import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { Plus, Edit, Trash2, CheckCircle2, XCircle, Globe, Key, Eye, EyeOff, Search, Download, FileSpreadsheet, Palmtree, UserCheck } from 'lucide-react'
import { formatRut, cleanRut, validateRut } from '../../utils/rutFormatter'
import { useNotifications } from '../../hooks/useNotifications'
import toast from 'react-hot-toast'
import { sanitizeString, sanitizeEmail, sanitizeCode, sanitizeRut, sanitizePassword } from '../../utils/sanitizeInput'
import { logger } from '../../utils/logger'
import { useDebounce } from '../../hooks/useDebounce'
import { handleMutationError } from '../../utils/errorHandler'
import { exportToCSV, exportToExcel } from '../../utils/exportData'
import Pagination from '../../components/common/Pagination'
import ConfirmModal from '../../components/common/ConfirmModal'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { useTheme } from '../../contexts/ThemeContext'

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
  'otra'
]

export default function Medicos() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [medicoEditando, setMedicoEditando] = useState(null)
  const [formData, setFormData] = useState({
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
  })
  const [showPassword, setShowPassword] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showConfirmEliminar, setShowConfirmEliminar] = useState(false)
  const [medicoAEliminar, setMedicoAEliminar] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [touchedFields, setTouchedFields] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const queryClient = useQueryClient()
  const { showSuccess, showError, showInfo } = useNotifications()
  const debouncedBusqueda = useDebounce(busqueda, 300)
  const { theme } = useTheme()

  // Notificación personalizada para acciones de doctor
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
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {title}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                Doctor: <span className="font-semibold">{doctorName}</span>
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {new Date().toLocaleString()}
              </p>
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
    ), {
      duration: 8000,
      position: 'top-right',
    })
  }

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

  // Filtrar médicos según búsqueda y filtros (usando debouncedBusqueda)
  const medicosFiltrados = useMemo(() => {
    return medicos.filter(medico => {
      // Búsqueda por texto (usando debouncedBusqueda)
      if (debouncedBusqueda) {
        const busquedaLower = debouncedBusqueda.toLowerCase()
        const nombreCompleto = `${medico.nombre} ${medico.apellido}`.toLowerCase()
        const rutFormateado = formatRut(medico.rut).toLowerCase()
        const emailLower = (medico.email || '').toLowerCase()
        
        if (!nombreCompleto.includes(busquedaLower) && 
            !rutFormateado.includes(busquedaLower) && 
            !emailLower.includes(busquedaLower)) {
          return false
        }
      }
      
      // Filtro por especialidad
      if (filtroEspecialidad && medico.especialidad !== filtroEspecialidad) {
        return false
      }
      
      // Filtro por estado
      if (filtroEstado && medico.estado !== filtroEstado) {
        return false
      }
      
      return true
    })
  }, [medicos, debouncedBusqueda, filtroEspecialidad, filtroEstado])

  // Paginación
  const totalPages = Math.ceil(medicosFiltrados.length / itemsPerPage)
  const medicosPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return medicosFiltrados.slice(startIndex, startIndex + itemsPerPage)
  }, [medicosFiltrados, currentPage, itemsPerPage])

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedBusqueda, filtroEspecialidad, filtroEstado])

  // Funciones de exportación
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

  // Validación en tiempo real
  const validateField = (name, value) => {
    const errors = { ...fieldErrors }
    
    if (name === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        errors.email = 'El formato del email no es válido'
      } else {
        delete errors.email
      }
    }
    
    if (name === 'rut' && value) {
      const rutLimpio = cleanRut(value)
      if (!validateRut(rutLimpio)) {
        errors.rut = 'El dígito verificador del RUT no es válido'
      } else {
        delete errors.rut
      }
    }
    
    if (name === 'password' && formData.acceso_web_enabled && value) {
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9@$!%*?&]{8,128}$/
      if (!passwordRegex.test(value)) {
        errors.password = 'La contraseña debe tener entre 8 y 128 caracteres, con al menos una letra y un número.'
      } else {
        delete errors.password
      }
    }
    
    setFieldErrors(errors)
  }

  const handleFieldChange = (name, value) => {
    setFormData({ ...formData, [name]: value })
    if (touchedFields[name]) {
      validateField(name, value)
    }
  }

  const handleFieldBlur = (name) => {
    setTouchedFields({ ...touchedFields, [name]: true })
    validateField(name, formData[name])
  }

  const crearMedico = useMutation({
    mutationFn: async (data) => {
      // Normalizar email a minúsculas
      const normalizedData = {
        ...data,
        email: data.email.toLowerCase().trim(),
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
      }

      // Validar que la especialidad sea válida
      if (!ESPECIALIDADES.includes(normalizedData.especialidad)) {
        throw new Error(`Especialidad inválida: ${normalizedData.especialidad}`)
      }

      // Validar formato de RUT
      const rutPattern = /^[0-9]{7,8}-[0-9kK]{1}$/
      if (!rutPattern.test(normalizedData.rut)) {
        throw new Error('Formato de RUT inválido. Debe ser: 12345678-9')
      }

      // Obtener el token de sesión actual
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No hay sesión activa')
      }

      // Intentar llamar a la Edge Function para crear el médico y usuario automáticamente
      const { data: functionData, error: functionError } = await supabase.functions.invoke('create-doctor', {
        body: normalizedData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (functionError) {
        logger.errorWithContext('Error al invocar Edge Function create-doctor', functionError, { functionData })
        throw new Error(functionError.message || 'Error al invocar Edge Function')
      }

      if (!functionData) {
        throw new Error('Respuesta vacía de la Edge Function')
      }

      if (!functionData.success) {
        throw new Error(functionData.error || 'Error al crear médico')
      }

      return {
        ...functionData.doctor,
        tempPassword: functionData.tempPassword,
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries(['medicos'])
      setMostrarFormulario(false)
      setFormData({
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
      })
      setShowPassword(false)

      // Mostrar mensaje según si se creó el usuario automáticamente o no
      if (result.tempPassword) {
        const detalle = `👤 Usuario: ${result.username || result.email}\n` +
          `📧 Email: ${result.email}\n` +
          `🔑 Contraseña: ${result.tempPassword}\n` +
          `⚠️ Debe cambiar contraseña al ingresar.`
        
        notifyDoctorAction('create', `${result.nombre} ${result.apellido}`, detalle)
      } else {
        notifyDoctorAction('create', `${result.nombre} ${result.apellido}`, 'Acceso web deshabilitado.')
      }
    },
    onError: (error) => {
      logger.errorWithContext('Error completo al crear médico', error, {
        formData: { ...formData, password: '***' }, // No loggear password
      })
      
      // Manejar errores de autenticación y red
      if (handleMutationError(error, showError)) {
        return // Error ya manejado
      }
      
      const errorMessage = error?.message || error?.toString() || 'Error desconocido'
      showError(`Error al crear médico: ${errorMessage}`)
    },
  })

  const actualizarMedico = useMutation({
    mutationFn: async ({ id, data, password }) => {
      // Validar email único si cambió
      if (data.email && medicoEditando && data.email !== medicoEditando.email) {
        const { data: medicoExistente, error: errorBusqueda } = await supabase
          .from('doctors')
          .select('id')
          .eq('email', data.email.toLowerCase().trim())
          .neq('id', id)
          .is('deleted_at', null)
          .maybeSingle()
        
        if (errorBusqueda) throw errorBusqueda
        
        if (medicoExistente) {
          throw new Error('El email ya está registrado para otro médico')
        }
      }

      // 1. Actualizar contraseña si se proporcionó
      if (password) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No hay sesión activa')

        const { data: functionData, error: functionError } = await supabase.functions.invoke('update-doctor-password', {
          body: { doctorId: id, password },
          // No enviar Authorization header manual, supabase-js lo maneja automáticamente
        })

        if (functionError) {
          logger.errorWithContext('Error invocando update-doctor-password', functionError)
          throw new Error(functionError.message || 'Error al actualizar contraseña')
        }
        
        if (functionData && functionData.error) {
           throw new Error(functionData.error)
        }
      }

      // 2. Actualizar datos del perfil
      const { error } = await supabase
        .from('doctors')
        .update(data)
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['medicos'])
      setMedicoEditando(null)
      setMostrarFormulario(false)
      
      const nombreDoctor = variables.data.nombre 
        ? `${variables.data.nombre} ${variables.data.apellido}` 
        : (medicoEditando ? `${medicoEditando.nombre} ${medicoEditando.apellido}` : 'Doctor')
      
      const detalle = variables.password 
        ? 'Perfil y contraseña actualizados correctamente.' 
        : 'Los datos han sido actualizados correctamente.'
        
      notifyDoctorAction('update', nombreDoctor, detalle)
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      
      // Manejar errores de autenticación y red
      if (handleMutationError(error, showError)) {
        return // Error ya manejado
      }
      
      showError(`Error al actualizar médico: ${errorMessage}`)
    },
  })

  const toggleAccesoWeb = useMutation({
    mutationFn: async ({ id, acceso_web_enabled }) => {
      const { error } = await supabase
        .from('doctors')
        .update({ acceso_web_enabled })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['medicos'])
    },
  })

  const toggleEstado = useMutation({
    mutationFn: async ({ id, estado }) => {
      const nuevoEstado = estado === 'activo' ? 'vacaciones' : 'activo'
      const { error } = await supabase
        .from('doctors')
        .update({ estado: nuevoEstado })
        .eq('id', id)
      if (error) throw error
      return nuevoEstado
    },
    onSuccess: (nuevoEstado) => {
      queryClient.invalidateQueries(['medicos'])
      toast.success(`Médico cambiado a ${nuevoEstado === 'activo' ? 'activo' : 'vacaciones'}`)
    },
    onError: (error) => {
      toast.error('Error al cambiar estado del médico')
      logger.error('Error toggleEstado:', error)
    },
  })

  const eliminarMedico = useMutation({
    mutationFn: async (id) => {
      // Obtener el token de sesión actual
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No hay sesión activa')
      }

      // Llamar a la Edge Function para eliminar completamente el médico
      const { data: functionData, error: functionError } = await supabase.functions.invoke('delete-doctor', {
        body: { doctorId: id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (functionError) {
        logger.errorWithContext('Error al invocar Edge Function delete-doctor', functionError)
        throw new Error(functionError.message || 'Error al eliminar médico')
      }

      if (!functionData) {
        throw new Error('Respuesta vacía de la Edge Function')
      }

      if (!functionData.success) {
        throw new Error(functionData.error || 'Error al eliminar médico')
      }

      return functionData
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries(['medicos'])
      if (result.deleted) {
        const mensaje = `✅ Médico eliminado completamente\n\n` +
          `👤 Nombre: ${result.deleted.doctor}\n` +
          `📧 Email: ${result.deleted.email}\n` +
          `🆔 RUT: ${result.deleted.rut}\n\n` +
          `Todos los datos relacionados han sido eliminados.`
        showInfo(mensaje)
      } else {
        showSuccess('Médico eliminado exitosamente')
      }
    },
    onError: (error) => {
      logger.errorWithContext('Error completo al eliminar médico', error)
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      
      // Manejar errores de autenticación y red
      if (handleMutationError(error, showError)) {
        return // Error ya manejado
      }
      
      showError(`Error al eliminar médico: ${errorMessage}`)
    },
  })

  const handleEliminar = (medico) => {
    setMedicoAEliminar(medico)
    setShowConfirmEliminar(true)
  }

  const confirmarEliminar = () => {
    if (medicoAEliminar) {
      eliminarMedico.mutate(medicoAEliminar.id)
    }
    setMedicoAEliminar(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Validar nombre y apellido
    if (formData.nombre.trim().length < 2) {
      showError('El nombre debe tener al menos 2 caracteres')
      return
    }
    if (formData.apellido.trim().length < 2) {
      showError('El apellido debe tener al menos 2 caracteres')
      return
    }
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(formData.nombre)) {
      showError('El nombre debe contener letras')
      return
    }
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(formData.apellido)) {
      showError('El apellido debe contener letras')
      return
    }

    // Validar teléfono WhatsApp si se ingresó
    if (formData.telefono) {
      const telefonoLimpio = formData.telefono.replace(/\s/g, '')
      if (!/^\+[1-9]\d{7,14}$/.test(telefonoLimpio)) {
        showError('El teléfono debe estar en formato internacional: +56912345678')
        return
      }
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      showError('El formato del email no es válido')
      return
    }

    // Validar RUT con dígito verificador
    const rutLimpio = cleanRut(formData.rut)
    if (!validateRut(rutLimpio)) {
      showError('El RUT ingresado no es válido. Verifique el dígito verificador.')
      return
    }
    
    // Validar contraseña si acceso web está habilitado y es creación o edición
    if (formData.acceso_web_enabled) {
      // En creación: usuario y contraseña obligatorios
      if (!medicoEditando && (!formData.username || !formData.password)) {
        showInfo('Si habilitas el acceso web, debes proporcionar un nombre de usuario y contraseña.')
        return
      }

      // En edición o creación: si hay contraseña, validarla
      if (formData.password) {
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9@$!%*?&]{8,128}$/
        if (!passwordRegex.test(formData.password)) {
          showError('La contraseña debe tener entre 8 y 128 caracteres, con al menos una letra y un número.')
          return
        }
      }
    }
    
    // Limpiar el RUT antes de enviar (remover puntos, mantener formato con guion)
    const dataToSubmit = {
      ...formData,
      rut: rutLimpio,
      email: formData.email.toLowerCase().trim(),
    }

    // Eliminar campos que no van a la tabla doctors
    delete dataToSubmit.username
    delete dataToSubmit.password

    // Si es creación, re-agregar username y password si corresponde (create-doctor los espera)
    if (!medicoEditando && formData.acceso_web_enabled) {
      dataToSubmit.username = formData.username.toLowerCase().trim()
      dataToSubmit.password = formData.password
    }
    
    if (medicoEditando) {
      // En edición, enviamos password por separado si existe
      actualizarMedico.mutate({ 
        id: medicoEditando.id, 
        data: dataToSubmit,
        password: formData.password || null
      })
    } else {
      crearMedico.mutate(dataToSubmit)
    }
  }

  // Generar username automático: primera letra del nombre + apellido completo (todo en minúsculas)
  const generarUsername = (nombre, apellido) => {
    if (!nombre) return ''
    const primeraLetraNombre = nombre.charAt(0).toLowerCase()
    const apellidoCompleto = apellido ? apellido.toLowerCase() : ''
    return primeraLetraNombre + apellidoCompleto
  }

  // Generar contraseña segura usando CSPRNG (crypto.getRandomValues)
  const generarPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const bytes = new Uint8Array(12)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, b => chars[b % chars.length]).join('')
  }

  // Actualizar username cuando cambia el nombre o apellido (solo si acceso web está habilitado)
  useEffect(() => {
    if (formData.acceso_web_enabled && !medicoEditando && formData.nombre && formData.apellido) {
      const nuevoUsername = generarUsername(formData.nombre, formData.apellido)
      // Actualizar el username automáticamente cuando cambian nombre o apellido
      if (nuevoUsername) {
        setFormData(prev => ({ ...prev, username: nuevoUsername }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.nombre, formData.apellido])

  const iniciarEdicion = (medico) => {
    setMedicoEditando(medico)
    // Formatear el RUT al editar
    const rutFormateado = formatRut(medico.rut)
    setFormData({
      nombre: medico.nombre,
      apellido: medico.apellido,
      rut: rutFormateado,
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

  const getEstadoBadge = (estado) => {
    if (theme === 'dark') {
      return estado === 'activo' 
        ? 'bg-green-900 text-green-200'
        : 'bg-yellow-900 text-yellow-200'
    }
    return estado === 'activo' 
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className={`text-2xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Gestión de Médicos</h1>
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
            onClick={() => {
              setMostrarFormulario(true)
              setMedicoEditando(null)
              setFormData({
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
              })
              setFieldErrors({})
              setTouchedFields({})
              setShowPassword(false)
            }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Nuevo Médico</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Búsqueda y Filtros */}
      <div className="card">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(sanitizeString(e.target.value))}
              placeholder="Buscar por nombre, apellido, RUT o email..."
              className="input-field pl-10"
              aria-label="Buscar médicos"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field text-sm">Filtrar por Especialidad</label>
              <select
                value={filtroEspecialidad}
                onChange={(e) => setFiltroEspecialidad(sanitizeString(e.target.value))}
                className="input-field"
              >
                <option value="">Todas las especialidades</option>
                {ESPECIALIDADES.map(esp => (
                  <option key={esp} value={esp}>
                    {esp.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field text-sm">Filtrar por Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(sanitizeString(e.target.value))}
                className="input-field"
              >
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="vacaciones">Vacaciones</option>
              </select>
            </div>
          </div>
          {medicosFiltrados.length !== medicos.length && (
            <p className="text-sm text-gray-600">
              Mostrando {medicosFiltrados.length} de {medicos.length} médicos
            </p>
          )}
        </div>
      </div>

      {mostrarFormulario && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">
            {medicoEditando ? 'Editar Médico' : 'Nuevo Médico'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: sanitizeString(e.target.value) })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label-field">Apellido *</label>
                <input
                  type="text"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: sanitizeString(e.target.value) })}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">RUT *</label>
                <input
                  type="text"
                  value={formData.rut}
                  onChange={(e) => {
                    const sanitized = sanitizeRut(e.target.value)
                    const formatted = formatRut(sanitized)
                    handleFieldChange('rut', formatted)
                  }}
                  onBlur={() => handleFieldBlur('rut')}
                  className={`input-field ${fieldErrors.rut ? 'border-red-500' : ''}`}
                  placeholder="12.345.678-9"
                  required
                  maxLength={12}
                />
                {fieldErrors.rut && touchedFields.rut && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.rut}</p>
                )}
              </div>
              <div>
                <label className="label-field">Correo *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFieldChange('email', sanitizeEmail(e.target.value))}
                  onBlur={() => handleFieldBlur('email')}
                  className={`input-field ${fieldErrors.email ? 'border-red-500' : ''}`}
                  required
                  disabled={!!medicoEditando}
                />
                {fieldErrors.email && touchedFields.email && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            <div>
              <label className="label-field">Teléfono WhatsApp</label>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value.replace(/[^+\d\s]/g, '') })}
                className="input-field"
                placeholder="+56912345678"
              />
              <p className="text-xs text-slate-400 mt-1">Formato internacional, ej: +56912345678</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Especialidad *</label>
                <select
                  value={formData.especialidad}
                  onChange={(e) => setFormData({ ...formData, especialidad: sanitizeString(e.target.value) })}
                  className="input-field"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {ESPECIALIDADES.map(esp => (
                    <option key={esp} value={esp}>
                      {esp.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Estado *</label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: sanitizeString(e.target.value) })}
                  className="input-field"
                  required
                >
                  <option value="activo">Activo</option>
                  <option value="vacaciones">Vacaciones</option>
                </select>
              </div>
            </div>

            {/* Sección de Habilitar Acceso Web */}
            <div className="border-2 border-blue-200 rounded-2xl p-4 bg-blue-50/30">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-blue-600" />
                <input
                  type="checkbox"
                  id="acceso_web"
                  checked={formData.acceso_web_enabled}
                  onChange={(e) => {
                    const enabled = e.target.checked
                    // Si se habilita el acceso web, generar username automáticamente
                    const nuevoUsername = enabled ? generarUsername(formData.nombre, formData.apellido) : ''
                    setFormData({ 
                      ...formData, 
                      acceso_web_enabled: enabled,
                      username: enabled ? nuevoUsername : formData.username,
                      password: enabled && !formData.password ? generarPassword() : (enabled ? formData.password : '')
                    })
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="acceso_web" className="text-sm font-bold text-gray-700">
                  HABILITAR ACCESO WEB
                </label>
              </div>

              {formData.acceso_web_enabled && (
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="label-field text-xs font-bold text-gray-600 uppercase">
                      Nombre de Usuario
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: sanitizeCode(e.target.value.toLowerCase()) })}
                      className="input-field"
                      placeholder="Ej: esteban"
                      required={formData.acceso_web_enabled}
                    />
                  </div>
                  
                  <div>
                    <label className="label-field text-xs font-bold text-gray-600 uppercase">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => handleFieldChange('password', sanitizePassword(e.target.value))}
                        onBlur={() => handleFieldBlur('password')}
                        className={`input-field pr-12 ${fieldErrors.password ? 'border-red-500' : ''}`}
                        placeholder="Ingrese contraseña o use la generada"
                        required={formData.acceso_web_enabled}
                      />
                      {fieldErrors.password && touchedFields.password && (
                        <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>
                      )}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, password: generarPassword() })}
                          className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                          title="Generar contraseña aleatoria"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
                          title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    {formData.password && (
                      <p className="text-xs text-gray-500 mt-1">
                        Mínimo 8 caracteres, al menos una letra y un número.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                type="submit" 
                className="btn-primary"
                disabled={crearMedico.isPending || actualizarMedico.isPending}
              >
                {crearMedico.isPending || actualizarMedico.isPending ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    {medicoEditando ? 'Actualizando...' : 'Creando...'}
                  </span>
                ) : (
                  medicoEditando ? 'Actualizar' : 'Crear'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarFormulario(false)
                  setMedicoEditando(null)
                  setFieldErrors({})
                  setTouchedFields({})
                }}
                className="btn-secondary"
                disabled={crearMedico.isPending || actualizarMedico.isPending}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Nombre</th>
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>RUT</th>
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Correo</th>
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Especialidad</th>
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Estado</th>
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Acceso Web</th>
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" className={`text-center py-8 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>Cargando...</td>
                </tr>
              ) : medicosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className={`text-center py-8 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>
                    {busqueda || filtroEspecialidad || filtroEstado 
                      ? 'No se encontraron médicos con los filtros aplicados'
                      : 'No hay médicos registrados'}
                  </td>
                </tr>
              ) : (
                medicosPaginados.map(medico => (
                  <tr 
                    key={medico.id} 
                    className={`border-b transition-colors ${
                      theme === 'dark' 
                        ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' 
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <td className={`py-3 px-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {medico.nombre} {medico.apellido}
                    </td>
                    <td className={`py-3 px-4 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-700'}`}>{formatRut(medico.rut)}</td>
                    <td className={`py-3 px-4 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-700'}`}>{(medico.email || '').toLowerCase()}</td>
                    <td className={`py-3 px-4 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-700'}`}>
                      {medico.especialidad.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${getEstadoBadge(medico.estado)}`}>
                        {medico.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {medico.acceso_web_enabled ? (
                        <CheckCircle2 className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                      ) : (
                        <XCircle className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => iniciarEdicion(medico)}
                          className={`p-2 rounded transition-colors ${
                            theme === 'dark'
                              ? 'text-blue-400 hover:bg-blue-900/30 hover:text-blue-300'
                              : 'text-blue-600 hover:bg-blue-50'
                          }`}
                          title="Editar médico"
                          aria-label="Editar médico"
                        >
                          <Edit className="w-5 h-5" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => toggleAccesoWeb.mutate({
                            id: medico.id,
                            acceso_web_enabled: !medico.acceso_web_enabled
                          })}
                          className={`p-2 rounded transition-colors ${
                            theme === 'dark'
                              ? 'text-green-400 hover:bg-green-900/30 hover:text-green-300'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={medico.acceso_web_enabled ? 'Deshabilitar acceso web' : 'Habilitar acceso web'}
                          aria-label={medico.acceso_web_enabled ? 'Deshabilitar acceso web' : 'Habilitar acceso web'}
                          disabled={toggleAccesoWeb.isPending}
                        >
                          {toggleAccesoWeb.isPending ? (
                            <LoadingSpinner size="sm" />
                          ) : medico.acceso_web_enabled ? (
                            <XCircle className="w-5 h-5" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                          )}
                        </button>
                        <button
                          onClick={() => toggleEstado.mutate({ id: medico.id, estado: medico.estado })}
                          className={`p-2 rounded transition-colors ${
                            medico.estado === 'activo'
                              ? theme === 'dark'
                                ? 'text-yellow-400 hover:bg-yellow-900/30 hover:text-yellow-300'
                                : 'text-yellow-600 hover:bg-yellow-50'
                              : theme === 'dark'
                                ? 'text-blue-400 hover:bg-blue-900/30 hover:text-blue-300'
                                : 'text-blue-600 hover:bg-blue-50'
                          }`}
                          title={medico.estado === 'activo' ? 'Poner en vacaciones' : 'Activar médico'}
                          aria-label={medico.estado === 'activo' ? 'Poner en vacaciones' : 'Activar médico'}
                          disabled={toggleEstado.isPending}
                        >
                          {toggleEstado.isPending ? (
                            <LoadingSpinner size="sm" />
                          ) : medico.estado === 'activo' ? (
                            <Palmtree className="w-5 h-5" aria-hidden="true" />
                          ) : (
                            <UserCheck className="w-5 h-5" aria-hidden="true" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEliminar(medico)}
                          className={`p-2 rounded transition-colors ${
                            theme === 'dark'
                              ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                          title="Eliminar médico"
                          aria-label="Eliminar médico"
                          disabled={eliminarMedico.isPending}
                        >
                          {eliminarMedico.isPending ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Trash2 className="w-5 h-5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {medicosFiltrados.length > itemsPerPage && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={medicosFiltrados.length}
          />
        )}
      </div>

      {/* Modales de Confirmación */}
      <ConfirmModal
        isOpen={showConfirmEliminar}
        onClose={() => {
          setShowConfirmEliminar(false)
          setMedicoAEliminar(null)
        }}
        onConfirm={confirmarEliminar}
        title="Eliminar Médico"
        message={medicoAEliminar ? `⚠️ ELIMINACIÓN PERMANENTE\n\n¿Estás seguro de que deseas eliminar completamente al médico:\n\n👤 ${medicoAEliminar.nombre} ${medicoAEliminar.apellido}\n📧 ${medicoAEliminar.email}\n🆔 RUT: ${formatRut(medicoAEliminar.rut)}\n\nEsto eliminará PERMANENTEMENTE:\n• El correo electrónico\n• El nombre de usuario\n• El RUT\n• Todos los pacientes asociados\n• Todas las solicitudes quirúrgicas\n• Todas las cirugías programadas\n• Todos los datos relacionados\n\n⚠️ Esta acción NO se puede deshacer.` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  )
}
