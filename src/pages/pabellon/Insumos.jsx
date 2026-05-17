import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { Plus, Edit, Trash2, Search, Download, FileSpreadsheet } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { useDebounce } from '../../hooks/useDebounce'
import { exportToCSV, exportToExcel } from '../../utils/exportData'
import { sanitizeString, sanitizeCode } from '../../utils/sanitizeInput'
import Pagination from '../../components/common/Pagination'
import ConfirmModal from '../../components/common/ConfirmModal'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { useTheme } from '../../contexts/ThemeContext'

export default function Insumos() {
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('nombre') // nombre o codigo
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [insumoEditando, setInsumoEditando] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    grupo_prestacion: '',
    proveedor: '',
    grupos_fonasa: '',
  })
  const [showConfirmEliminar, setShowConfirmEliminar] = useState(false)
  const [insumoAEliminar, setInsumoAEliminar] = useState(null)
  const [codigoError, setCodigoError] = useState('')
  const [codigoTouched, setCodigoTouched] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()
  const debouncedBusqueda = useDebounce(busqueda, 300)
  const { theme } = useTheme()

  const { data: insumos = [], isLoading } = useQuery({
    queryKey: ['insumos', debouncedBusqueda, filtroTipo],
    queryFn: async () => {
      let query = supabase
        .from('supplies')
        .select('*')
        .eq('activo', true)
        .is('deleted_at', null)
        .order('nombre', { ascending: true })

      const termino = debouncedBusqueda.trim()
      if (termino) {
        if (filtroTipo === 'codigo') {
          query = query.ilike('codigo', `%${termino}%`)
        } else {
          query = query.ilike('nombre', `%${termino}%`)
        }
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  // Paginación
  const totalPages = Math.ceil(insumos.length / itemsPerPage)
  const insumosPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return insumos.slice(startIndex, startIndex + itemsPerPage)
  }, [insumos, currentPage, itemsPerPage])

  // Resetear página cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedBusqueda])

  // Funciones de exportación
  const handleExportCSV = () => {
    try {
      const columns = [
        { key: 'nombre', label: 'Nombre' },
        { key: 'codigo', label: 'Código' },
        { key: 'grupo_prestacion', label: 'Grupo Prestación' },
        { key: 'proveedor', label: 'Proveedor' },
        { key: 'grupos_fonasa', label: 'Grupos Fonasa' },
      ]
      exportToCSV(insumos, columns, 'insumos')
      showSuccess('Datos exportados a CSV exitosamente')
    } catch (error) {
      showError(`Error al exportar: ${error.message}`)
    }
  }

  const handleExportExcel = async () => {
    try {
      const columns = [
        { key: 'nombre', label: 'Nombre' },
        { key: 'codigo', label: 'Código' },
        { key: 'grupo_prestacion', label: 'Grupo Prestación' },
        { key: 'proveedor', label: 'Proveedor' },
        { key: 'grupos_fonasa', label: 'Grupos Fonasa' },
      ]
      await exportToExcel(insumos, columns, 'insumos')
      showSuccess('Datos exportados a Excel exitosamente')
    } catch (error) {
      showError(`Error al exportar: ${error.message}`)
    }
  }

  const crearInsumo = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase
        .from('supplies')
        .insert(data)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['insumos'])
      setMostrarFormulario(false)
      setFormData({ nombre: '', codigo: '', grupo_prestacion: '', proveedor: '', grupos_fonasa: '' })
      setCodigoError('')
      setCodigoTouched(false)
      showSuccess('Insumo creado exitosamente')
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError(`Error al crear insumo: ${errorMessage}`)
      }
    },
  })

  const actualizarInsumo = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase
        .from('supplies')
        .update(data)
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['insumos'])
      setInsumoEditando(null)
      setMostrarFormulario(false)
      setCodigoError('')
      setCodigoTouched(false)
      showSuccess('Insumo actualizado exitosamente')
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError(`Error al actualizar insumo: ${errorMessage}`)
      }
    },
  })

  const eliminarInsumo = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('supplies')
        .update({ deleted_at: new Date().toISOString(), activo: false })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['insumos'])
      showSuccess('Insumo eliminado exitosamente')
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError(`Error al eliminar insumo: ${errorMessage}`)
      }
    },
  })

  // Validar solo que el código no esté duplicado (código libre por clínica)
  const validarCodigo = async (codigo) => {
    if (!codigo || codigo.trim() === '') {
      setCodigoError('')
      return
    }

    let query = supabase
      .from('supplies')
      .select('id')
      .eq('codigo', codigo.trim())
      .is('deleted_at', null)
    if (insumoEditando?.id) {
      query = query.neq('id', insumoEditando.id)
    }
    const { data: insumoExistente, error: errorBusqueda } = await query.maybeSingle()
    
    // Si falla la consulta (red, RLS, etc.) no bloquear: el código queda libre
    if (errorBusqueda) {
      setCodigoError('')
      return
    }
    
    if (insumoExistente) {
      setCodigoError('El código ya existe para otro insumo')
    } else {
      setCodigoError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validar solo duplicado; si la consulta falla no bloquear (código libre por clínica)
    if (codigoError) {
      showError(codigoError)
      return
    }

    const codigoTrim = (formData.codigo || '').trim()
    let queryCodigo = supabase
      .from('supplies')
      .select('id')
      .eq('codigo', codigoTrim)
      .is('deleted_at', null)
    if (insumoEditando?.id) {
      queryCodigo = queryCodigo.neq('id', insumoEditando.id)
    }
    const { data: insumoExistente, error: errorBusqueda } = await queryCodigo.maybeSingle()
    
    if (!errorBusqueda && insumoExistente) {
      showError('El código ya existe para otro insumo')
      return
    }
    
    const payload = {
      ...formData,
      codigo: codigoTrim,
      proveedor: (formData.proveedor || '').trim() || null,
      grupos_fonasa: (formData.grupos_fonasa || '').trim() || null,
      stock_actual: 0,
      stock_minimo: 0,
      unidad_medida: 'unidad',
    }
    if (insumoEditando) {
      actualizarInsumo.mutate({ id: insumoEditando.id, data: payload })
    } else {
      crearInsumo.mutate(payload)
    }
  }

  const handleEliminar = (insumo) => {
    setInsumoAEliminar(insumo)
    setShowConfirmEliminar(true)
  }

  const confirmarEliminar = () => {
    if (insumoAEliminar) {
      eliminarInsumo.mutate(insumoAEliminar.id)
    }
    setInsumoAEliminar(null)
  }

  const iniciarEdicion = (insumo) => {
    setInsumoEditando(insumo)
    setFormData({
      nombre: insumo.nombre,
      codigo: insumo.codigo,
      grupo_prestacion: insumo.grupo_prestacion,
      proveedor: insumo.proveedor ?? '',
      grupos_fonasa: insumo.grupos_fonasa ?? '',
    })
    setCodigoError('')
    setCodigoTouched(false)
    setMostrarFormulario(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestión de Insumos</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {insumos.length > 0 && (
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
              setInsumoEditando(null)
              setFormData({ 
                nombre: '', 
                codigo: '', 
                grupo_prestacion: '',
                proveedor: '',
                grupos_fonasa: '',
              })
              setCodigoError('')
              setCodigoTouched(false)
            }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Nuevo Insumo</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="card">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(sanitizeString(e.target.value, { trim: false }))}
                placeholder={`Buscar por ${filtroTipo === 'codigo' ? 'código' : 'nombre'}...`}
                className="input-field pl-10"
                aria-label="Buscar insumos"
              />
            </div>
          </div>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(sanitizeString(e.target.value))}
            className="input-field w-auto"
            aria-label="Criterio de búsqueda"
          >
            <option value="nombre">Por Nombre</option>
            <option value="codigo">Por Código</option>
          </select>
        </div>
      </div>

      {mostrarFormulario && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">
            {insumoEditando ? 'Editar Insumo' : 'Nuevo Insumo'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="label-field">Código *</label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) => {
                  const sanitized = sanitizeCode(e.target.value)
                  setFormData({ ...formData, codigo: sanitized })
                  if (codigoTouched && !insumoEditando) {
                    validarCodigo(sanitized)
                  }
                }}
                onBlur={() => {
                  setCodigoTouched(true)
                  if (!insumoEditando) {
                    validarCodigo(formData.codigo)
                  }
                }}
                className={`input-field ${codigoError ? 'border-red-500' : ''}`}
                required
                disabled={!!insumoEditando}
              />
              {codigoError && codigoTouched && (
                <p className="text-xs text-red-600 mt-1">{codigoError}</p>
              )}
            </div>

            <div>
              <label className="label-field">Grupo de Prestación *</label>
              <input
                type="text"
                value={formData.grupo_prestacion}
                onChange={(e) => setFormData({ ...formData, grupo_prestacion: sanitizeString(e.target.value) })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="label-field">Proveedor (opcional)</label>
              <input
                type="text"
                value={formData.proveedor}
                onChange={(e) => setFormData({ ...formData, proveedor: sanitizeString(e.target.value) })}
                className="input-field"
                placeholder="Quien proveyó el item"
              />
            </div>

            <div>
              <label className="label-field">Grupos Fonasa (opcional)</label>
              <input
                type="text"
                value={formData.grupos_fonasa}
                onChange={(e) => setFormData({ ...formData, grupos_fonasa: sanitizeString(e.target.value) })}
                className="input-field"
                placeholder="Ej: 18, 11, 30 — Vacío = disponible para todas las cirugías"
              />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                Códigos de grupo de prestación FONASA (según tipo de cirugía): 18 = general, 11 = ortopedia, 20 = plástica, 30 = oftalmología, 40 = otorrino, 50 = urología, 60 = gineco. Separados por coma. Vacío = el insumo aplica a todas las cirugías.
              </p>
            </div>

            <div className="flex gap-2">
              <button 
                type="submit" 
                className="btn-primary"
                disabled={crearInsumo.isPending || actualizarInsumo.isPending}
              >
                {crearInsumo.isPending || actualizarInsumo.isPending ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    {insumoEditando ? 'Actualizando...' : 'Creando...'}
                  </span>
                ) : (
                  insumoEditando ? 'Actualizar' : 'Crear'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarFormulario(false)
                  setInsumoEditando(null)
                }}
                className="btn-secondary"
                disabled={crearInsumo.isPending || actualizarInsumo.isPending}
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
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Código</th>
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Grupo Prestación</th>
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Proveedor</th>
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`} title="Grupos de prestación FONASA para los que aplica este insumo (ej. 18=general, 11=ortopedia). Vacío = todas las cirugías.">Grupos Fonasa</th>
                <th className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className={`text-center py-8 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>Cargando...</td>
                </tr>
              ) : insumos.length === 0 ? (
                <tr>
                  <td colSpan="6" className={`text-center py-8 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>
                    No se encontraron insumos
                  </td>
                </tr>
              ) : (
                insumosPaginados.map(insumo => (
                    <tr 
                      key={insumo.id} 
                      className={`border-b transition-colors ${
                        theme === 'dark' 
                          ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' 
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <td className={`py-3 px-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{insumo.nombre}</td>
                      <td className={`py-3 px-4 font-mono ${theme === 'dark' ? 'text-slate-100' : 'text-gray-700'}`}>{insumo.codigo}</td>
                      <td className={`py-3 px-4 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-700'}`}>{insumo.grupo_prestacion}</td>
                      <td className={`py-3 px-4 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-700'}`}>{insumo.proveedor || '—'}</td>
                      <td className={`py-3 px-4 font-mono text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`} title={insumo.grupos_fonasa ? `Cirugías grupo(s): ${insumo.grupos_fonasa}` : 'Todas las cirugías'}>
                        {insumo.grupos_fonasa || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => iniciarEdicion(insumo)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            aria-label="Editar insumo"
                            title="Editar insumo"
                          >
                            <Edit className="w-5 h-5" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleEliminar(insumo)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                            disabled={eliminarInsumo.isPending}
                            title="Eliminar insumo"
                            aria-label="Eliminar insumo"
                          >
                            {eliminarInsumo.isPending ? (
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
        
        {insumos.length > itemsPerPage && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={insumos.length}
          />
        )}
      </div>

      {/* Modal de Confirmación */}
      <ConfirmModal
        isOpen={showConfirmEliminar}
        onClose={() => {
          setShowConfirmEliminar(false)
          setInsumoAEliminar(null)
        }}
        onConfirm={confirmarEliminar}
        title="Eliminar Insumo"
        message={insumoAEliminar ? `¿Estás seguro de eliminar el insumo "${insumoAEliminar.nombre}"?\n\nCódigo: ${insumoAEliminar.codigo}\nGrupo: ${insumoAEliminar.grupo_prestacion}` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  )
}
