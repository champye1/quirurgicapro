import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { Search, Download, FileSpreadsheet, User, Database, Clock, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useDebounce } from '../../hooks/useDebounce'
import { sanitizeString } from '../../utils/sanitizeInput'
import { logger } from '../../utils/logger'
import { exportToCSV, exportToExcel } from '../../utils/exportData'
import Pagination from '../../components/common/Pagination'
import { TableSkeleton } from '../../components/common/Skeleton'
import { useTheme } from '../../contexts/ThemeContext'

const TABLA_LABELS = {
  surgery_requests: 'Solicitudes de Cirugía',
  surgeries: 'Cirugías',
  patients: 'Pacientes',
  doctors: 'Médicos',
  supplies: 'Insumos',
  operating_rooms: 'Pabellones',
  schedule_blocks: 'Bloqueos de Horario',
  clinic_settings: 'Configuración',
  external_messages: 'Correos Externos',
  notifications: 'Notificaciones',
  users: 'Usuarios',
}

const tablaLabel = (nombre) => TABLA_LABELS[nombre] || nombre

export default function Auditoria() {
  const [busqueda, setBusqueda] = useState('')
  const [filtroTabla, setFiltroTabla] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const itemsPerPage = 20

  const debouncedBusqueda = useDebounce(busqueda, 300)
  const { theme } = useTheme()

  const { data: logs = [], isLoading, isError } = useQuery({
    queryKey: ['audit-logs', filtroTabla, filtroAccion, fechaDesde, fechaHasta],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          users:user_id(email, role)
        `)
        .order('created_at', { ascending: false })
        .limit(1000) // Limitar a 1000 registros más recientes

      if (filtroTabla) {
        query = query.eq('tabla_afectada', filtroTabla)
      }

      if (filtroAccion) {
        query = query.eq('accion', filtroAccion.toUpperCase())
      }

      if (fechaDesde) {
        query = query.gte('created_at', fechaDesde)
      }

      if (fechaHasta) {
        query = query.lte('created_at', fechaHasta + 'T23:59:59')
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
  })

  // Filtrar por búsqueda
  const logsFiltrados = useMemo(() => {
    return logs.filter(log => {
      if (debouncedBusqueda) {
        const busquedaLower = debouncedBusqueda.toLowerCase()
        const accion = log.accion?.toLowerCase() || ''
        const tabla = log.tabla_afectada?.toLowerCase() || ''
        const email = log.users?.email?.toLowerCase() || ''
        
        if (!accion.includes(busquedaLower) && 
            !tabla.includes(busquedaLower) && 
            !email.includes(busquedaLower)) {
          return false
        }
      }
      return true
    })
  }, [logs, debouncedBusqueda])

  // Ordenamiento + paginación
  const totalPages = Math.ceil(logsFiltrados.length / itemsPerPage)
  const logsPaginados = useMemo(() => {
    const sorted = [...logsFiltrados].sort((a, b) => {
      const va = a[sortField] ?? ''
      const vb = b[sortField] ?? ''
      const cmp = String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    const startIndex = (currentPage - 1) * itemsPerPage
    return sorted.slice(startIndex, startIndex + itemsPerPage)
  }, [logsFiltrados, currentPage, itemsPerPage, sortField, sortDir])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setCurrentPage(1)
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
  }

  // Obtener tablas únicas para filtro
  const tablasUnicas = useMemo(() => {
    const tablas = new Set()
    logs.forEach(log => {
      if (log.tabla_afectada) {
        tablas.add(log.tabla_afectada)
      }
    })
    return Array.from(tablas).sort()
  }, [logs])

  // Funciones de exportación
  const prepararFilasExport = () => logsFiltrados.map(log => ({
    ...log,
    'created_at': format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
    'users.email': log.users?.email || 'Sistema',
    'registro_id': log.registro_id || '-',
    'datos_anteriores': log.datos_anteriores ? JSON.stringify(log.datos_anteriores) : '-',
    'datos_nuevos': log.datos_nuevos ? JSON.stringify(log.datos_nuevos) : '-',
  }))

  const EXPORT_COLUMNS = [
    { key: 'created_at', label: 'Fecha y Hora' },
    { key: 'users.email', label: 'Usuario' },
    { key: 'accion', label: 'Acción' },
    { key: 'tabla_afectada', label: 'Tabla' },
    { key: 'registro_id', label: 'ID Registro' },
    { key: 'datos_anteriores', label: 'Valores Anteriores' },
    { key: 'datos_nuevos', label: 'Valores Nuevos' },
  ]

  const handleExportCSV = () => {
    try {
      exportToCSV(prepararFilasExport(), EXPORT_COLUMNS, 'auditoria')
    } catch (error) {
      logger.errorWithContext('Error al exportar CSV', error)
    }
  }

  const handleExportExcel = async () => {
    try {
      await exportToExcel(prepararFilasExport(), EXPORT_COLUMNS, 'auditoria')
    } catch (error) {
      logger.errorWithContext('Error al exportar Excel', error)
    }
  }

  const getAccionColor = (accion, currentTheme = 'light') => {
    if (currentTheme === 'dark') {
      const colores = {
        'INSERT': 'bg-green-900 text-green-200',
        'UPDATE': 'bg-blue-900 text-blue-200',
        'DELETE': 'bg-red-900 text-red-200',
      }
      return colores[accion] || 'bg-slate-700 text-slate-200'
    }
    const colores = {
      'INSERT': 'bg-green-100 text-green-800',
      'UPDATE': 'bg-blue-100 text-blue-800',
      'DELETE': 'bg-red-100 text-red-800',
    }
    return colores[accion] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className={`text-2xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Historial de Auditoría</h1>
        {logsFiltrados.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="btn-secondary flex items-center gap-2 text-sm"
              title="Exportar a CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="btn-secondary flex items-center gap-2 text-sm"
              title="Exportar a Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(sanitizeString(e.target.value))}
              placeholder="Buscar por acción, tabla o usuario..."
              className="input-field pl-10"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label-field text-sm">Tabla</label>
              <select
                value={filtroTabla}
                onChange={(e) => {
                  setFiltroTabla(sanitizeString(e.target.value))
                  setCurrentPage(1)
                }}
                className="input-field"
              >
                <option value="">Todas las tablas</option>
                {tablasUnicas.map(tabla => (
                  <option key={tabla} value={tabla}>{tablaLabel(tabla)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-field text-sm">Acción</label>
              <select
                value={filtroAccion}
                onChange={(e) => {
                  setFiltroAccion(sanitizeString(e.target.value))
                  setCurrentPage(1)
                }}
                className="input-field"
              >
                <option value="">Todas las acciones</option>
                <option value="INSERT">Crear (INSERT)</option>
                <option value="UPDATE">Actualizar (UPDATE)</option>
                <option value="DELETE">Eliminar (DELETE)</option>
              </select>
            </div>

            <div>
              <label className="label-field text-sm">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(sanitizeString(e.target.value))
                  setCurrentPage(1)
                }}
                className="input-field"
              />
            </div>

            <div>
              <label className="label-field text-sm">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(sanitizeString(e.target.value))
                  setCurrentPage(1)
                }}
                className="input-field"
                min={fechaDesde}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de logs */}
      <div className="card">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : isError ? (
          <div className={`text-center py-8 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
            Error al cargar los registros de auditoría. Verifica tu conexión e intenta de nuevo.
          </div>
        ) : logsFiltrados.length === 0 ? (
          <div className={`text-center py-8 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>
            No se encontraron registros de auditoría
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                    {[
                      { field: 'created_at', label: 'Fecha y Hora', sortable: true },
                      { field: null, label: 'Usuario', sortable: false },
                      { field: 'accion', label: 'Acción', sortable: true },
                      { field: 'tabla_afectada', label: 'Tabla', sortable: true },
                      { field: null, label: 'ID Registro', sortable: false },
                    ].map(({ field, label, sortable }) => (
                      <th key={label} className={`text-left py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                        {sortable ? (
                          <button
                            onClick={() => handleSort(field)}
                            className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
                            aria-label={`Ordenar por ${label}`}
                          >
                            {label}
                            <SortIcon field={field} />
                          </button>
                        ) : label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logsPaginados.map(log => (
                    <tr 
                      key={log.id} 
                      className={`border-b transition-colors ${
                        theme === 'dark' 
                          ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' 
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <td className={`py-3 px-4 text-sm ${theme === 'dark' ? 'text-slate-100' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })} CLT
                        </div>
                      </td>
                      <td className={`py-3 px-4 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <User className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                          <span className="text-sm">{log.users?.email || 'Sistema'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getAccionColor(log.accion, theme)}`}>
                          {log.accion}
                        </span>
                      </td>
                      <td className={`py-3 px-4 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <Database className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                          <span className="text-sm font-mono">{tablaLabel(log.tabla_afectada)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-sm font-mono ${theme === 'dark' ? 'text-slate-200' : 'text-gray-600'}`}>
                          {log.registro_id ? log.registro_id.substring(0, 8) + '...' : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {logsFiltrados.length > itemsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={logsFiltrados.length}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
