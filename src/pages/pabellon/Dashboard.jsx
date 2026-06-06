import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import {
  Activity,
  CheckCircle2,
  Plus,
  Inbox,
  LayoutGrid,
  TrendingUp,
  ClipboardList,
  ArrowRight,
  MessageSquare,
  BarChart3,
  Timer,
  Trash2,
  PhoneCall,
  AlertTriangle,
  Package,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import Card from '../../components/common/Card'
import OcupacionChart from '../../components/charts/OcupacionChart'
import { useNotifications } from '../../hooks/useNotifications'
import { MetricSkeleton } from '../../components/common/Skeleton'
import Tooltip from '../../components/common/Tooltip'
import Modal from '../../components/common/Modal'
import { useTheme } from '../../contexts/ThemeContext'
import { sanitizeString } from '../../utils/sanitizeInput'
import { logger } from '../../utils/logger'
import { STORAGE_KEYS } from '../../utils/storageKeys'

export default function Dashboard() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { showSuccess, showError } = useNotifications()
  const [filtroTipoOcupacion, setFiltroTipoOcupacion] = useState('porcentaje') // porcentaje | horas_ocupadas | horas_libres
  const [filtroPabellon, setFiltroPabellon] = useState('todos') // todos | id de pabellón
  const [showCirugiasHoyModal, setShowCirugiasHoyModal] = useState(false)
  const [marcarOrdenesLoading, setMarcarOrdenesLoading] = useState(false)
  const [expandedCirugiaHoyId, setExpandedCirugiaHoyId] = useState(null)
  // Solicitudes pendientes
  const { data: solicitudesPendientes = [], isLoading: isLoadingSolicitudes } = useQuery({
    queryKey: ['solicitudes-pendientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgery_requests')
        .select(`
          *,
          doctors:doctor_id(nombre, apellido, especialidad),
          patients:patient_id(nombre, apellido, rut)
        `)
        .eq('estado', 'pendiente')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      return data
    },
  })

  // Órdenes sin agendar: notificaciones no leídas de tipo 'orden_sin_agendar'
  const { data: ordenesNotificaciones = [], refetch: refetchOrdenes } = useQuery({
    queryKey: ['ordenes-sin-agendar-notifs'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data, error } = await supabase
        .from('notifications')
        .select('id, mensaje, created_at, relacionado_con')
        .eq('user_id', user.id)
        .eq('tipo', 'orden_sin_agendar')
        .eq('vista', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (error) return []
      return data || []
    },
    refetchInterval: 30000,
  })

  const marcarOrdenesVistas = async () => {
    if (marcarOrdenesLoading || ordenesNotificaciones.length === 0) return
    setMarcarOrdenesLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase
        .from('notifications')
        .update({ vista: true })
        .eq('user_id', user.id)
        .eq('tipo', 'orden_sin_agendar')
        .eq('vista', false)
      refetchOrdenes()
    } catch (e) {
      logger.error('Error al marcar órdenes como vistas:', e)
    } finally {
      setMarcarOrdenesLoading(false)
    }
  }

  // Cirugías de hoy
  const { data: cirugiasHoy = [] } = useQuery({
    queryKey: ['cirugias-hoy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select(`
          *,
          doctors:doctor_id(nombre, apellido),
          patients:patient_id(nombre, apellido),
          operating_rooms:operating_room_id(nombre)
        `)
        .eq('fecha', format(new Date(), 'yyyy-MM-dd'))
        .is('deleted_at', null)
        .order('hora_inicio', { ascending: true })
      
      if (error) throw error
      return data
    },
  })

  // Insumos de la cirugía expandida en el modal de hoy
  const { data: insumosCirugiaHoy = [] } = useQuery({
    queryKey: ['insumos-cirugia-hoy', expandedCirugiaHoyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgery_supplies')
        .select('cantidad, supplies:supply_id(nombre, unidad)')
        .eq('surgery_id', expandedCirugiaHoyId)
      if (error) throw error
      return data || []
    },
    enabled: !!expandedCirugiaHoyId,
  })

  // Cirugías de la última semana para el gráfico
  const { data: cirugiasSemana = [] } = useQuery({
    queryKey: ['cirugias-semana'],
    queryFn: async () => {
      const fechaInicio = format(subDays(new Date(), 6), 'yyyy-MM-dd')
      const fechaFin = format(new Date(), 'yyyy-MM-dd')
      
      const { data, error } = await supabase
        .from('surgeries')
        .select('fecha, operating_room_id, hora_inicio, hora_fin')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .is('deleted_at', null)
      
      if (error) throw error
      return data || []
    },
  })

  // Pabellones activos para filtros del gráfico
  const { data: pabellonesActivos = [] } = useQuery({
    queryKey: ['pabellones-activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operating_rooms')
        .select('id, nombre')
        .eq('activo', true)
        .is('deleted_at', null)
        .order('nombre', { ascending: true })

      if (error) throw error
      return data || []
    },
  })

  // Ocupación del día (incluye pabellones con cirugía y pabellones bloqueados por convenio)
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const { data: ocupacion, isLoading: isLoadingOcupacion } = useQuery({
    queryKey: ['ocupacion-hoy', hoy],
    queryFn: async () => {
      const { data: cirugias } = await supabase
        .from('surgeries')
        .select('operating_room_id')
        .eq('fecha', hoy)
        .is('deleted_at', null)
        .in('estado', ['programada', 'en_proceso'])

      const { data: bloqueos } = await supabase
        .from('schedule_blocks')
        .select('operating_room_id')
        .eq('fecha', hoy)
        .is('deleted_at', null)
        .or(`vigencia_hasta.is.null,vigencia_hasta.gte.${hoy}`)

      const { data: pabellones } = await supabase
        .from('operating_rooms')
        .select('id')
        .eq('activo', true)
        .is('deleted_at', null)

      const totalPabellones = pabellones?.length || 0
      const idsOcupadosOBloqueados = new Set([
        ...(cirugias?.map(c => c.operating_room_id) || []),
        ...(bloqueos?.map(b => b.operating_room_id) || []),
      ])
      const pabellonesOcupados = idsOcupadosOBloqueados.size
      const porcentajeOcupacion = totalPabellones > 0
        ? Math.round((pabellonesOcupados / totalPabellones) * 100)
        : 0

      return {
        totalPabellones,
        pabellonesOcupados,
        porcentajeOcupacion,
        totalCirugias: cirugias?.length || 0,
      }
    },
  })

  // KPIs adicionales: Tiempo promedio de cirugía
  const { data: tiempoPromedioCirugia } = useQuery({
    queryKey: ['tiempo-promedio-cirugia'],
    queryFn: async () => {
      const fechaInicio = format(subDays(new Date(), 30), 'yyyy-MM-dd')
      
      const { data: cirugias, error } = await supabase
        .from('surgeries')
        .select('hora_inicio, hora_fin')
        .gte('fecha', fechaInicio)
        .is('deleted_at', null)
        .in('estado', ['programada', 'en_proceso', 'completada'])
      
      if (error) throw error
      if (!cirugias || cirugias.length === 0) return 0

      const tiempos = cirugias
        .filter(c => c.hora_inicio && c.hora_fin)
        .map(c => {
          const inicio = new Date(`2000-01-01T${c.hora_inicio}`)
          const fin = new Date(`2000-01-01T${c.hora_fin}`)
          return (fin - inicio) / (1000 * 60)
        })
        .filter(m => m > 0)

      if (tiempos.length === 0) return 0
      return Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
    },
  })

  // KPIs adicionales: Tasa de utilización de pabellones (últimos 7 días)
  const { data: tasaUtilizacion } = useQuery({
    queryKey: ['tasa-utilizacion'],
    queryFn: async () => {
      const fechaInicio = format(subDays(new Date(), 6), 'yyyy-MM-dd')
      const fechaFin = format(new Date(), 'yyyy-MM-dd')
      
      const { data: cirugias } = await supabase
        .from('surgeries')
        .select('operating_room_id, fecha')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .is('deleted_at', null)
        .in('estado', ['programada', 'en_proceso', 'completada'])

      const { data: pabellones } = await supabase
        .from('operating_rooms')
        .select('id')
        .eq('activo', true)
        .is('deleted_at', null)

      const totalPabellones = pabellones?.length || 0
      const dias = 7
      const slotsTotales = totalPabellones * dias * 12 // 12 horas por día
      const slotsOcupados = new Set(cirugias?.map(c => `${c.operating_room_id}-${c.fecha}`) || []).size

      return {
        porcentaje: slotsTotales > 0 ? Math.round((slotsOcupados / slotsTotales) * 100) : 0,
        slotsOcupados,
        slotsTotales
      }
    },
  })

  // Insumos con stock bajo (stock_actual <= stock_minimo)
  const { data: insumosStockBajo = [] } = useQuery({
    queryKey: ['insumos-stock-bajo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplies')
        .select('id, nombre, codigo, stock_actual, stock_minimo, unidad_medida')
        .eq('activo', true)
        .is('deleted_at', null)
        .order('stock_actual', { ascending: true })
        .limit(50)
      if (error) return []
      return (data || []).filter(s => s.stock_actual <= s.stock_minimo)
    },
    refetchInterval: 60_000,
  })

  // Recordatorios
  const { data: recordatorios = [] } = useQuery({
    queryKey: ['recordatorios-pabellon'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (error) throw error
      return data
    },
  })

  // Inicializar desde localStorage si existe
  const [nuevoRecordatorio, setNuevoRecordatorio] = useState(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEYS.RECORDATORIO_TEMPORAL)
      if (guardado) {
        return JSON.parse(guardado)
      }
    } catch (e) {
      logger.errorWithContext('Error al cargar recordatorio temporal', e)
    }
    return { titulo: '', contenido: '' }
  })
  const queryClient = useQueryClient()

  // Guardar en localStorage cada vez que cambia el contenido
  useEffect(() => {
    if (nuevoRecordatorio.contenido.trim()) {
      localStorage.setItem(STORAGE_KEYS.RECORDATORIO_TEMPORAL, JSON.stringify(nuevoRecordatorio))
    } else {
      localStorage.removeItem(STORAGE_KEYS.RECORDATORIO_TEMPORAL)
    }
  }, [nuevoRecordatorio])

  const crearRecordatorio = useMutation({
    mutationFn: async (data) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      const { error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          titulo: data.titulo,
          contenido: data.contenido,
          tipo: 'aviso',
        })
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordatorios-pabellon'] })
      setNuevoRecordatorio({ titulo: '', contenido: '' })
      // Limpiar localStorage después de crear exitosamente
      localStorage.removeItem(STORAGE_KEYS.RECORDATORIO_TEMPORAL)
      showSuccess('Recordatorio creado exitosamente')
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError('Error al crear recordatorio: ' + errorMessage)
      }
    },
  })

  const marcarRecordatorioVisto = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('reminders')
        .update({ visto: true })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordatorios-pabellon'] })
      showSuccess('Recordatorio marcado como realizado')
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError('Error al marcar recordatorio: ' + errorMessage)
      }
    },
  })

  const eliminarRecordatorio = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('reminders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordatorios-pabellon'] })
      showSuccess('Recordatorio eliminado')
    },
    onError: (error) => {
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      } else {
        showError('Error al eliminar recordatorio: ' + errorMessage)
      }
    },
  })

  const handleCrearRecordatorio = (e) => {
    e.preventDefault()
    if (nuevoRecordatorio.contenido.trim()) {
      crearRecordatorio.mutate({
        titulo: nuevoRecordatorio.contenido.substring(0, 50),
        contenido: nuevoRecordatorio.contenido
      })
    }
  }

  // Calcular datos para el gráfico de ocupación semanal
  const datosOcupacionSemanal = useMemo(() => {
    const ultimos7Dias = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    })
    
    const totalPabellonesBase = pabellonesActivos.length || ocupacion?.totalPabellones || 4
    const horasPorDia = 12 // 8 AM a 7 PM = 12 horas

    return ultimos7Dias.map(dia => {
      const fechaStr = format(dia, 'yyyy-MM-dd')
      const cirugiasDelDia = cirugiasSemana.filter(c => {
        if (c.fecha !== fechaStr) return false
        if (filtroPabellon !== 'todos' && String(c.operating_room_id) !== String(filtroPabellon)) {
          return false
        }
        return true
      })

      // Calcular minutos ocupados sumando la duración de cada cirugía
      const minutosOcupados = cirugiasDelDia.reduce((total, c) => {
        if (!c.hora_inicio || !c.hora_fin) return total
        const inicio = new Date(`2000-01-01T${c.hora_inicio}`)
        const fin = new Date(`2000-01-01T${c.hora_fin}`)
        const minutos = (fin - inicio) / (1000 * 60)
        return minutos > 0 ? total + minutos : total
      }, 0)

      const pabellonesConsiderados = filtroPabellon === 'todos' ? totalPabellonesBase : 1
      const minutosTotales = pabellonesConsiderados * horasPorDia * 60

      const porcentaje = minutosTotales > 0
        ? Math.round((minutosOcupados / minutosTotales) * 100)
        : 0

      const ocupadasHoras = minutosOcupados / 60
      const libresHoras = minutosTotales > 0 ? Math.max(minutosTotales / 60 - ocupadasHoras, 0) : 0
      
      return {
        dia: format(dia, 'EEE', { locale: es }),
        porcentaje: Math.min(porcentaje, 100),
        ocupadasHoras: Math.max(ocupadasHoras, 0),
        libresHoras: Math.max(libresHoras, 0),
      }
    })
  }, [cirugiasSemana, ocupacion, filtroPabellon, pabellonesActivos])

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-0 mb-6 sm:mb-8 lg:mb-10">
        <div>
          <h2 className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter uppercase ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>Panel Administrativo</h2>
          <p className={`font-bold text-[10px] sm:text-xs uppercase tracking-widest mt-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
          }`}>
            Gestión Clínica • {format(new Date(), "MMMM yyyy", { locale: es })}
          </p>
        </div>
        <button 
          onClick={() => navigate('/pabellon/solicitudes')} 
          className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs uppercase flex items-center gap-2 shadow-sm transition-all touch-manipulation active:scale-95 w-full sm:w-auto ${
            theme === 'dark' 
              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' 
              : theme === 'medical'
              ? 'bg-white border-blue-200 text-slate-700 hover:bg-blue-50'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          } border`}
        >
          <Inbox size={14} className="sm:w-4 sm:h-4" /> Solicitudes
        </button>
      </div>

      {/* Banner: Órdenes sin agendar */}
      {ordenesNotificaciones.length > 0 && (
        <div className={`mb-6 sm:mb-8 rounded-2xl border-2 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
          theme === 'dark'
            ? 'bg-orange-950/40 border-orange-700 text-orange-100'
            : 'bg-orange-50 border-orange-400 text-orange-900'
        }`}>
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            theme === 'dark' ? 'bg-orange-700/50' : 'bg-orange-100'
          }`}>
            <PhoneCall size={20} className={theme === 'dark' ? 'text-orange-300' : 'text-orange-600'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm sm:text-base uppercase tracking-tight">
              {ordenesNotificaciones.length === 1
                ? '1 paciente con orden de hospitalización sin agendar'
                : `${ordenesNotificaciones.length} pacientes con orden de hospitalización sin agendar`}
            </p>
            <p className={`text-xs sm:text-sm font-semibold mt-1 ${
              theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
            }`}>
              Contactar al médico para ofrecer horas disponibles
            </p>
            <ul className={`mt-2 space-y-0.5 ${theme === 'dark' ? 'text-orange-200' : 'text-orange-800'}`}>
              {ordenesNotificaciones.slice(0, 3).map(n => (
                <li key={n.id} className="text-xs font-medium truncate">• {n.mensaje}</li>
              ))}
              {ordenesNotificaciones.length > 3 && (
                <li className="text-xs font-bold">
                  + {ordenesNotificaciones.length - 3} más...
                </li>
              )}
            </ul>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 w-full sm:w-auto">
            <button
              onClick={() => { marcarOrdenesVistas(); navigate('/pabellon/solicitudes') }}
              disabled={marcarOrdenesLoading}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase rounded-xl transition-colors touch-manipulation w-full sm:w-auto disabled:opacity-60"
            >
              Ver solicitudes
            </button>
            <button
              onClick={marcarOrdenesVistas}
              disabled={marcarOrdenesLoading}
              className={`px-3 py-2 font-black text-xs uppercase rounded-xl transition-colors touch-manipulation w-full sm:w-auto disabled:opacity-60 ${
                theme === 'dark'
                  ? 'bg-orange-900/50 hover:bg-orange-900 text-orange-300'
                  : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
              }`}
            >
              Marcar vistas
            </button>
          </div>
        </div>
      )}

      {/* Banner: Stock bajo de insumos */}
      {insumosStockBajo.length > 0 && (
        <div className={`mb-6 sm:mb-8 rounded-2xl border-2 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
          theme === 'dark'
            ? 'bg-red-950/40 border-red-700 text-red-100'
            : 'bg-red-50 border-red-400 text-red-900'
        }`}>
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            theme === 'dark' ? 'bg-red-700/50' : 'bg-red-100'
          }`}>
            <AlertTriangle size={20} className={theme === 'dark' ? 'text-red-300' : 'text-red-600'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm sm:text-base uppercase tracking-tight">
              {insumosStockBajo.length === 1
                ? '1 insumo con stock bajo'
                : `${insumosStockBajo.length} insumos con stock bajo`}
            </p>
            <p className={`text-xs sm:text-sm font-semibold mt-1 ${
              theme === 'dark' ? 'text-red-300' : 'text-red-700'
            }`}>
              Reabastecer antes de las próximas cirugías
            </p>
            <ul className={`mt-2 space-y-0.5 ${theme === 'dark' ? 'text-red-200' : 'text-red-800'}`}>
              {insumosStockBajo.slice(0, 3).map(insumo => (
                <li key={insumo.id} className="text-xs font-medium truncate">
                  • {insumo.nombre} — {insumo.stock_actual}/{insumo.stock_minimo} {insumo.unidad_medida || 'unid.'}
                </li>
              ))}
              {insumosStockBajo.length > 3 && (
                <li className="text-xs font-bold">
                  + {insumosStockBajo.length - 3} más...
                </li>
              )}
            </ul>
          </div>
          <button
            onClick={() => navigate('/pabellon/insumos', { state: { filtroStockBajo: true } })}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase rounded-xl transition-colors touch-manipulation w-full sm:w-auto flex-shrink-0"
          >
            Ver inventario crítico
          </button>
        </div>
      )}

      {/* Métricas principales (3 tarjetas) */}
      <div id="tour-metricas" className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8 lg:mb-10">
        {isLoadingOcupacion || isLoadingSolicitudes ? (
          Array.from({ length: 3 }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))
        ) : (
          [
            { 
              id: 'pendientes',
              label: 'Solicitudes pendientes',
              value: solicitudesPendientes.length.toString(),
              icon: Inbox,
              color: theme === 'dark' ? 'text-blue-400' : 'text-blue-600',
              bg: theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50',
              tooltip: 'Solicitudes de cirugía pendientes de revisión',
              onClick: () => navigate('/pabellon/solicitudes'),
            },
            { 
              id: 'cirugias-hoy',
              label: 'Cirugías Hoy',
              value: cirugiasHoy.length.toString(),
              icon: Activity,
              color: theme === 'dark' ? 'text-green-400' : 'text-green-600',
              bg: theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50',
              tooltip: 'Ver detalle de todas las cirugías programadas para hoy',
              onClick: () => setShowCirugiasHoyModal(true),
            },
            { 
              id: 'ocupacion-hoy',
              label: 'Ocupación',
              value: `${ocupacion?.porcentajeOcupacion || 0}%`,
              icon: TrendingUp,
              color: theme === 'dark' ? 'text-amber-400' : 'text-amber-600',
              bg: theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-50',
              tooltip: `Ver calendario de hoy (${ocupacion?.pabellonesOcupados || 0}/${ocupacion?.totalPabellones || 0} pabellones ocupados)`,
              onClick: () => {
                try {
                  sessionStorage.setItem('calendario_ir_hoy', 'day')
                } catch (e) {
                  // ignorar errores de storage
                }
                navigate('/pabellon/calendario')
              },
            },
          ].map((stat) => (
            <Tooltip key={stat.id} content={stat.tooltip}>
              <Card 
                hover={!!stat.onClick}
                onClick={stat.onClick}
                className={`p-4 sm:p-5 lg:p-6 flex items-center gap-3 sm:gap-4 lg:gap-5 ${
                  stat.onClick ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <div className={`${stat.bg} ${stat.color} p-3 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl flex-shrink-0`}>
                  <stat.icon size={18} className="sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-[9px] sm:text-[10px] font-black uppercase truncate ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
                  }`}>{stat.label}</div>
                  <div className={`text-lg sm:text-xl lg:text-2xl font-black truncate ${
                    theme === 'dark' ? 'text-white' : 'text-slate-800'
                  }`}>{stat.value}</div>
                </div>
              </Card>
            </Tooltip>
          ))
        )}
      </div>

      {/* KPIs Adicionales (3 tarjetas) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8 lg:mb-10">
        {[
          { 
            id: 'pabellones-libres',
            label: 'Bloques libres',
            value: `${ocupacion?.totalPabellones - ocupacion?.pabellonesOcupados || 0}`,
            icon: LayoutGrid,
            color: theme === 'dark' ? 'text-purple-400' : 'text-purple-600',
            bg: theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-50',
            tooltip: 'Ver disponibilidad de pabellones para hoy en el calendario',
            onClick: () => {
              try {
                sessionStorage.setItem('calendario_ir_hoy', 'day')
              } catch (e) {
                // ignorar errores de storage
              }
              navigate('/pabellon/calendario')
            },
          },
          { 
            id: 'tiempo-promedio',
            label: 'Tiempo promedio por paciente', 
            value: tiempoPromedioCirugia ? `${Math.floor(tiempoPromedioCirugia / 60)}h ${tiempoPromedioCirugia % 60}m` : 'N/A', 
            icon: Timer, 
            color: theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600', 
            bg: theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-50', 
            tooltip: 'Tiempo promedio de cirugía por paciente (últimos 30 días)',
            onClick: undefined,
          },
          { 
            id: 'utilizacion-7d',
            label: 'Utilización 7d', 
            value: `${tasaUtilizacion?.porcentaje || 0}%`, 
            icon: BarChart3, 
            color: theme === 'dark' ? 'text-teal-400' : 'text-teal-600', 
            bg: theme === 'dark' ? 'bg-teal-900/30' : 'bg-teal-50', 
            tooltip: `Ver detalle de ocupación semanal (${tasaUtilizacion?.slotsOcupados || 0} días con uso de pabellón)`,
            onClick: () => {
              const section = document.getElementById('ocupacion-semanal')
              if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            },
          },
        ].map((stat) => (
          <Tooltip key={stat.id} content={stat.tooltip}>
            <Card 
              hover={!!stat.onClick}
              onClick={stat.onClick}
              className={`p-4 sm:p-5 lg:p-6 flex items-center gap-3 sm:gap-4 lg:gap-5 ${
                stat.onClick ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className={`${stat.bg} ${stat.color} p-3 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl flex-shrink-0`}>
                <stat.icon size={18} className="sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-[9px] sm:text-[10px] font-black uppercase truncate ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
                }`}>{stat.label}</div>
                <div className={`text-lg sm:text-xl lg:text-2xl font-black truncate ${
                  theme === 'dark' ? 'text-white' : 'text-slate-800'
                }`}>{stat.value}</div>
              </div>
            </Card>
          </Tooltip>
        ))}
      </div>

      {/* Gráfico de Ocupación Semanal */}
      <Card id="ocupacion-semanal" className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <h3 className={`font-black uppercase text-xs sm:text-sm flex items-center gap-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-800'
          }`}>
            <TrendingUp size={16} className="sm:w-[18px] sm:h-[18px] text-blue-500" /> Ocupación Semanal
          </h3>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="inline-flex rounded-full bg-slate-100 text-[10px] sm:text-xs p-1">
              {[
                { id: 'porcentaje', label: 'Ocupación %' },
                { id: 'horas_ocupadas', label: 'Horas ocupadas' },
                { id: 'horas_libres', label: 'Horas libres' },
              ].map(opcion => (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => setFiltroTipoOcupacion(opcion.id)}
                  className={`px-2.5 sm:px-3 py-1 rounded-full font-bold uppercase tracking-tight transition-colors ${
                    filtroTipoOcupacion === opcion.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {opcion.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400">Pabellón</span>
              <select
                value={filtroPabellon}
                onChange={(e) => setFiltroPabellon(sanitizeString(e.target.value))}
                className="text-[10px] sm:text-xs font-bold border border-slate-200 rounded-full px-2.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="todos">Todos</option>
                {pabellonesActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <OcupacionChart data={datosOcupacionSemanal} mode={filtroTipoOcupacion} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 min-h-[400px] sm:min-h-[450px] lg:h-[500px]">
        {/* Solicitudes pendientes */}
        <Card id="tour-solicitudes-card" className="lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-4 sm:mb-6 lg:mb-8">
            <h3 className={`font-black uppercase text-[10px] sm:text-xs flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-800'
            }`}>
              <ClipboardList size={14} className="sm:w-4 sm:h-4 text-blue-500" /> Solicitudes
            </h3>
            <button 
              onClick={() => navigate('/pabellon/solicitudes')} 
              className="text-[10px] sm:text-xs font-black text-blue-600 uppercase hover:underline touch-manipulation"
            >
              Ver todas
            </button>
          </div>
          <div className="space-y-3 sm:space-y-4 overflow-y-auto flex-1 custom-scrollbar pr-1 sm:pr-2">
            {isLoadingSolicitudes ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border ${
                  theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : theme === 'medical' ? 'border-blue-100' : 'border-slate-100'
                }`}>
                  <div className={`h-4 rounded w-3/4 mb-2 animate-pulse ${
                    theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'
                  }`}></div>
                  <div className={`h-3 rounded w-1/2 animate-pulse ${
                    theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'
                  }`}></div>
                </div>
              ))
            ) : solicitudesPendientes.length === 0 ? (
              <p className={`text-center py-4 text-[10px] sm:text-xs font-bold uppercase ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
              }`}>No hay solicitudes pendientes</p>
            ) : (
              solicitudesPendientes.map((solicitud) => (
                <div 
                  key={solicitud.id} 
                  className={`flex items-center justify-between p-4 sm:p-5 rounded-xl sm:rounded-2xl transition-all group cursor-pointer touch-manipulation active:scale-[0.98] ${
                    theme === 'dark' 
                      ? 'border-slate-700 hover:border-blue-600 bg-slate-800/50' 
                      : theme === 'medical'
                      ? 'border-blue-100 hover:border-blue-300 bg-white'
                      : 'border-slate-100 hover:border-blue-100'
                  } border`}
                  onClick={() => navigate('/pabellon/solicitudes')}
                >
                  <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 min-w-0 flex-1">
                    <div className="w-1.5 sm:w-2 h-8 sm:h-10 rounded-full bg-blue-400 flex-shrink-0"></div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-black text-sm sm:text-base truncate ${
                        theme === 'dark' ? 'text-white' : 'text-slate-800'
                      }`}>
                        {solicitud.patients?.nombre} {solicitud.patients?.apellido}
                      </div>
                      <div className={`text-[9px] sm:text-[10px] font-bold uppercase truncate ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
                      }`}>
                        {solicitud.codigo_operacion} • Dr. {solicitud.doctors?.nombre} {solicitud.doctors?.apellido}
                      </div>
                    </div>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 bg-blue-600 text-white p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all flex-shrink-0 ml-2 touch-manipulation">
                    <ArrowRight size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Muro de Recordatorios */}
        <Card
          id="tour-recordatorios-card"
          className={`flex flex-col relative overflow-hidden ${
            theme === 'dark'
              ? 'bg-slate-900 text-white border-slate-800'
              : theme === 'medical'
              ? 'bg-blue-900 text-white border-blue-800'
              : 'bg-white text-slate-900 border-slate-200'
          } border`}
        >
          <h3
            className={`font-black uppercase text-[9px] sm:text-[10px] mb-4 sm:mb-6 flex items-center gap-2 relative z-10 ${
              theme === 'dark' || theme === 'medical'
                ? 'text-blue-400'
                : 'text-blue-600'
            }`}
          >
            <MessageSquare size={12} className="sm:w-[14px] sm:h-[14px]" /> Muro de Recordatorios
          </h3>
          <div className="flex-1 space-y-3 sm:space-y-4 overflow-y-auto custom-scrollbar mb-4 sm:mb-6 relative z-10">
            {recordatorios.length === 0 ? (
              <p
                className={`text-center py-4 text-[10px] sm:text-xs font-bold uppercase ${
                  theme === 'dark' || theme === 'medical'
                    ? 'text-slate-400'
                    : 'text-slate-500'
                }`}
              >
                No hay recordatorios
              </p>
            ) : (
              recordatorios.map((recordatorio) => (
                <div
                  key={recordatorio.id}
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${
                    recordatorio.visto
                      ? (theme === 'dark' || theme === 'medical' ? 'bg-green-900/20 border-green-500/40' : 'bg-green-50 border-green-200')
                      : (theme === 'dark' || theme === 'medical'
                        ? 'bg-white/5 border-white/10'
                        : 'bg-slate-50 border-slate-200')
                  }`}
                >
                  <p
                    className={`text-[10px] sm:text-xs font-medium mb-2 sm:mb-3 break-words ${
                      theme === 'dark' || theme === 'medical'
                        ? 'text-slate-100'
                        : 'text-slate-800'
                    } ${recordatorio.visto ? 'line-through opacity-80' : ''}`}
                  >
                    "{recordatorio.contenido}"
                  </p>
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <div
                      className={`flex-1 min-w-0 text-[8px] sm:text-[9px] font-black uppercase ${
                        theme === 'dark' || theme === 'medical'
                          ? 'text-blue-400'
                          : 'text-blue-600'
                      }`}
                    >
                      <span className="truncate">{recordatorio.titulo}</span>
                      <span className="ml-2 flex-shrink-0">{recordatorio.created_at ? format(new Date(recordatorio.created_at), 'dd/MM HH:mm') : '—'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {!recordatorio.visto && (
                        <button
                          type="button"
                          onClick={() => marcarRecordatorioVisto.mutate(recordatorio.id)}
                          disabled={marcarRecordatorioVisto.isPending}
                          className="p-1.5 sm:p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-all touch-manipulation disabled:opacity-50"
                          title="Marcar como realizado"
                        >
                          <CheckCircle2 size={14} className="sm:w-4 sm:h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => eliminarRecordatorio.mutate(recordatorio.id)}
                        disabled={eliminarRecordatorio.isPending}
                        className="p-1.5 sm:p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-all touch-manipulation disabled:opacity-50"
                        title="Eliminar recordatorio"
                      >
                        <Trash2 size={14} className="sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="relative z-10">
            <form onSubmit={handleCrearRecordatorio} className="space-y-2 sm:space-y-3">
              <textarea
                placeholder="Recordatorio..."
                value={nuevoRecordatorio.contenido}
                onChange={(e) => setNuevoRecordatorio({ 
                  ...nuevoRecordatorio, 
                  contenido: sanitizeString(e.target.value, { maxLength: 150, trim: false }) 
                })}
                maxLength={150}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (nuevoRecordatorio.contenido.trim()) {
                      handleCrearRecordatorio(e)
                    }
                  }
                }}
                className={`w-full rounded-xl sm:rounded-2xl p-2.5 sm:p-3 text-[10px] sm:text-xs outline-none h-14 sm:h-16 resize-none font-bold touch-manipulation border ${
                  theme === 'dark' || theme === 'medical'
                    ? 'bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800/70'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white'
                }`}
              />
              <div className="flex justify-between items-center">
                <span
                  className={`text-[8px] sm:text-[9px] font-black ${
                    theme === 'dark' || theme === 'medical'
                      ? 'text-slate-500'
                      : 'text-slate-500'
                  }`}
                >
                  {nuevoRecordatorio.contenido.length}/150
                </span>
                <button
                  type="submit"
                  disabled={!nuevoRecordatorio.contenido.trim()}
                  className="bg-blue-600 text-white p-1.5 sm:p-2 rounded-lg sm:rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all touch-manipulation active:scale-95"
                >
                  <Plus size={14} className="sm:w-4 sm:h-4" />
                </button>
              </div>
            </form>
          </div>
        </Card>
      </div>

      {/* Modal: Detalle de Cirugías de Hoy */}
      <Modal
        isOpen={showCirugiasHoyModal}
        onClose={() => setShowCirugiasHoyModal(false)}
        title="Cirugías programadas para hoy"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {cirugiasHoy.length === 0 ? (
            <p className="text-sm text-slate-500 font-bold">
              No hay cirugías programadas para el día de hoy.
            </p>
          ) : (
            cirugiasHoy.map((cirugia) => {
              const isExpanded = expandedCirugiaHoyId === cirugia.id
              return (
                <div key={cirugia.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedCirugiaHoyId(isExpanded ? null : cirugia.id)}
                    className="w-full text-left p-3 sm:p-4 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {cirugia.patients?.nombre} {cirugia.patients?.apellido}
                      </p>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        {cirugia.operating_rooms?.nombre || 'Pabellón'} • {cirugia.hora_inicio?.slice(0,5)}–{cirugia.hora_fin?.slice(0,5)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Dr. {cirugia.doctors?.nombre} {cirugia.doctors?.apellido} • <span className="font-semibold capitalize">{cirugia.estado}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Package size={13} className="text-slate-400" />
                      {isExpanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
                        <Package size={9} /> Kit de insumos
                      </p>
                      {insumosCirugiaHoy.length === 0 ? (
                        <p className="text-xs text-slate-400">Sin insumos asignados.</p>
                      ) : (
                        <ul className="space-y-1">
                          {insumosCirugiaHoy.map((s, i) => (
                            <li key={i} className="flex items-center justify-between text-xs text-slate-700">
                              <span className="font-medium">{s.supplies?.nombre || 'Insumo'}</span>
                              <span className="font-bold text-slate-500">{s.cantidad} {s.supplies?.unidad || 'u.'}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
        {cirugiasHoy.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={() => {
                const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                const fecha = format(new Date(), "d 'de' MMMM yyyy", { locale: es })
                const filas = cirugiasHoy.map(c =>
                  `<tr>
                    <td>${esc(c.hora_inicio || '—')}–${esc(c.hora_fin || '—')}</td>
                    <td>${esc(c.patients?.nombre || '')} ${esc(c.patients?.apellido || '')}</td>
                    <td>${esc(c.operating_rooms?.nombre || '—')}</td>
                    <td>Dr. ${esc(c.doctors?.nombre || '')} ${esc(c.doctors?.apellido || '')}</td>
                    <td>${esc(c.estado)}</td>
                  </tr>`
                ).join('')
                const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
                  <title>Programa del día — ${fecha}</title>
                  <style>
                    body{font-family:Arial,sans-serif;margin:20mm;color:#000}
                    h1{font-size:18px;margin-bottom:4px}
                    p{font-size:12px;color:#555;margin-bottom:16px}
                    table{width:100%;border-collapse:collapse;font-size:12px}
                    th{background:#1e40af;color:#fff;padding:8px;text-align:left}
                    td{padding:7px 8px;border-bottom:1px solid #ddd}
                    tr:nth-child(even) td{background:#f8fafc}
                  </style>
                </head><body>
                  <h1>Programa quirúrgico del día</h1>
                  <p>${fecha}</p>
                  <table>
                    <thead><tr><th>Horario</th><th>Paciente</th><th>Pabellón</th><th>Médico</th><th>Estado</th></tr></thead>
                    <tbody>${filas}</tbody>
                  </table>
                </body></html>`
                const win = window.open('', '_blank')
                if (win) {
                  win.document.write(html)
                  win.document.close()
                  win.print()
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded-xl transition-colors flex items-center gap-2"
            >
              <ClipboardList size={14} /> Exportar PDF
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
