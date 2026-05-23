import { useMemo, useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, Info, Lock, Activity, X, Stethoscope, XCircle, AlertTriangle, Search } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { sanitizeString } from '../../utils/sanitizeInput'
import { useTheme } from '../../contexts/ThemeContext'
import { logger } from '../../utils/logger'
import Button from '../../components/common/Button'
import Tooltip from '../../components/common/Tooltip'
import TimeInput from '../../components/TimeInput'
import {
  startOfYear,
  endOfYear,
  endOfMonth,
  isWithinInterval,
  startOfMonth,
  eachWeekOfInterval,
  endOfWeek,
  format,
  addDays,
  isSameDay,
  startOfWeek,
  eachDayOfInterval,
  isSameMonth,
  getWeek,
  isPast,
  startOfDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { codigosOperaciones } from '../../data/codigosOperaciones'
import Modal from '../../components/common/Modal'

const MESES = [
  { indice: 0, nombre: 'ENERO' },
  { indice: 1, nombre: 'FEBRERO' },
  { indice: 2, nombre: 'MARZO' },
  { indice: 3, nombre: 'ABRIL' },
  { indice: 4, nombre: 'MAYO' },
  { indice: 5, nombre: 'JUNIO' },
  { indice: 6, nombre: 'JULIO' },
  { indice: 7, nombre: 'AGOSTO' },
  { indice: 8, nombre: 'SEPTIEMBRE' },
  { indice: 9, nombre: 'OCTUBRE' },
  { indice: 10, nombre: 'NOVIEMBRE' },
  { indice: 11, nombre: 'DICIEMBRE' },
]

// Componente Breadcrumbs mejorado
const Breadcrumbs = ({ anio, view, selectedMonth, selectedWeek, selectedDay, onNavigate }) => {
  const monthName = selectedMonth !== null ? MESES[selectedMonth].nombre : ''
  const weekNumber = selectedWeek ? getWeek(selectedWeek, { weekStartsOn: 1 }) - getWeek(startOfMonth(selectedWeek), { weekStartsOn: 1 }) + 1 : ''
  
  return (
    <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4 leading-relaxed" aria-label="Breadcrumb">
      <button 
        onClick={() => onNavigate('year')} 
        className={`hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation px-1 py-0.5 rounded ${view === 'year' ? 'text-slate-900' : ''}`}
        aria-current={view === 'year' ? 'page' : undefined}
      >
        <span className="hidden sm:inline">Año </span>{anio}
      </button>
      
      {(view === 'month' || view === 'week' || view === 'day') && (
        <>
          <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-300 flex-shrink-0" />
          <div className="flex items-center gap-1">
            {selectedMonth !== null && (
              <>
                <button
                  onClick={() => {
                    const newMonth = selectedMonth === 0 ? 11 : selectedMonth - 1
                    const newAnio = selectedMonth === 0 ? anio - 1 : anio
                    onNavigate('month', newAnio, newMonth)
                  }}
                  className="p-1 rounded hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="w-3 h-3 text-slate-400" />
                </button>
                <button 
                  onClick={() => onNavigate('month')}
                  className={`hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation px-1 py-0.5 rounded truncate max-w-[120px] sm:max-w-none ${view === 'month' ? 'text-slate-900' : ''}`}
                  aria-current={view === 'month' ? 'page' : undefined}
                >
                  {monthName}
                </button>
                <button
                  onClick={() => {
                    const newMonth = selectedMonth === 11 ? 0 : selectedMonth + 1
                    const newAnio = selectedMonth === 11 ? anio + 1 : anio
                    onNavigate('month', newAnio, newMonth)
                  }}
                  className="p-1 rounded hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                </button>
              </>
            )}
            {selectedMonth === null && (
              <button 
                onClick={() => onNavigate('month')}
                className={`hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation px-1 py-0.5 rounded truncate max-w-[120px] sm:max-w-none ${view === 'month' ? 'text-slate-900' : ''}`}
                aria-current={view === 'month' ? 'page' : undefined}
              >
                {monthName}
              </button>
            )}
          </div>
        </>
      )}
      
      {(view === 'week' || view === 'day') && (
        <>
          <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-300 flex-shrink-0" />
          <button 
            onClick={() => onNavigate('week')}
            className={`hover:text-blue-600 active:text-blue-700 transition-colors touch-manipulation px-1 py-0.5 rounded ${view === 'week' ? 'text-slate-900' : ''}`}
            aria-current={view === 'week' ? 'page' : undefined}
          >
            Semana {weekNumber}
          </button>
        </>
      )}

      {view === 'day' && selectedDay && (
        <>
          <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-300 flex-shrink-0" />
          <span className="text-slate-900 px-1 py-0.5 truncate max-w-[150px] sm:max-w-none" aria-current="page">
            {format(selectedDay, 'EEEE d', { locale: es })}
          </span>
        </>
      )}
    </nav>
  )
}

// Componente MonthView (Lista de Semanas)
const MonthView = ({ anio, monthIndex, onWeekClick }) => {
  const weeks = useMemo(() => {
    const start = startOfMonth(new Date(anio, monthIndex))
    const end = endOfMonth(start)
    return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
  }, [anio, monthIndex])

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2 sm:px-4 lg:px-0">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-6 xl:p-8 flex items-center gap-3 sm:gap-4 lg:gap-5">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
          <Info className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-black text-blue-900 uppercase tracking-wide leading-relaxed">Directiva Quirúrgica</h3>
          <p className="text-xs sm:text-sm font-medium text-blue-600 mt-1 sm:mt-2 truncate">Semanas de {MESES[monthIndex].nombre} (futuras y pasadas).</p>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-5 lg:gap-6">
        {weeks.map((weekStart, idx) => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
          const isCurrentMonth = isSameMonth(weekStart, new Date(anio, monthIndex)) || isSameMonth(weekEnd, new Date(anio, monthIndex))
          
          if (!isCurrentMonth) return null

          // Verificar si la semana es pasada (si el último día de la semana es pasado)
          const esSemanaPasada = isPast(startOfDay(weekEnd)) && !isSameDay(weekEnd, new Date())
          
          // Calcular número de semana relativo al mes
          const weekNum = idx + 1 

          return (
            <button
              key={weekStart.toISOString()}
              onClick={() => onWeekClick(weekStart)}
              className={`w-full border rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-6 xl:p-8 flex items-center justify-between transition-all group active:scale-[0.98] touch-manipulation ${
                esSemanaPasada
                  ? 'bg-slate-50 border-slate-200 opacity-75 hover:border-slate-300 hover:opacity-90 cursor-pointer'
                  : 'bg-white border-slate-100 hover:border-blue-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }`}
              aria-label={`Semana ${weekNum} del ${format(weekStart, 'd', { locale: es })} al ${format(weekEnd, 'd', { locale: es })} de ${MESES[monthIndex].nombre}${esSemanaPasada ? ' (modo consulta)' : ''}`}
            >
              <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 min-w-0 flex-1">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors flex-shrink-0 ${
                  esSemanaPasada
                    ? 'bg-slate-100'
                    : 'bg-slate-50 group-hover:bg-blue-50'
                }`}>
                  <CalendarIcon className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${
                    esSemanaPasada
                      ? 'text-slate-300'
                      : 'text-slate-400 group-hover:text-blue-600'
                  }`} />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm sm:text-base font-black uppercase tracking-wide leading-relaxed truncate ${
                      esSemanaPasada ? 'text-slate-500' : 'text-slate-900'
                    }`}>
                      Semana 0{weekNum}
                    </h3>
                    {esSemanaPasada && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-600">
                        Histórica
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1 sm:mt-2 uppercase tracking-wider leading-relaxed truncate">
                    Del {format(weekStart, 'd', { locale: es })} al {format(weekEnd, 'd', { locale: es })} de {MESES[monthIndex].nombre}
                  </p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors flex-shrink-0 ml-2 ${
                esSemanaPasada ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-300 group-hover:text-blue-500'
              }`} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Componente WeekView (Grilla de 7 días: Lunes a Domingo)
const WeekView = ({ weekStart, cirugias, pabellonId, onDayClick, pabellones, selectedDay }) => {
  const days = useMemo(() => {
    // Lunes a Domingo (7 días, incluyendo domingo)
    return eachDayOfInterval({
      start: weekStart, // Ya es lunes (weekStartsOn: 1)
      end: addDays(weekStart, 6) // Lunes + 6 días = Domingo
    })
  }, [weekStart])

  // Calcular ocupación global por día (suma de todos los pabellones)
  const getOcupacionGlobal = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const cirugiasDia = cirugias.filter(c => {
      if (pabellonId !== 'todos' && c.operating_room_id !== pabellonId) return false
      return c.fecha === dayStr
    })
    
    const minutosOcupados = cirugiasDia.reduce((acc, curr) => {
      const [h1, m1] = curr.hora_inicio.split(':').map(Number)
      const [h2, m2] = curr.hora_fin.split(':').map(Number)
      const startMins = h1 * 60 + m1
      const endMins = h2 * 60 + m2
      return acc + (endMins - startMins)
    }, 0)
    
    // Total de minutos disponibles en todos los pabellones (4 pabellones × 12 horas × 60 min)
    const totalMinutos = pabellones.length * 12 * 60
    return Math.min(100, Math.round((minutosOcupados / totalMinutos) * 100))
  }

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2 sm:px-4 lg:px-0">
      {/* Información de la semana */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-6 xl:p-8 flex items-center gap-3 sm:gap-4 lg:gap-5">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <CalendarIcon className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-black text-blue-900 uppercase tracking-wide leading-relaxed">
            Semana Laboral
          </h3>
          <p className="text-xs sm:text-sm font-medium text-blue-600 mt-1 sm:mt-2 truncate">
            {format(weekStart, 'd', { locale: es })} - {format(addDays(weekStart, 6), 'd MMMM', { locale: es })}
          </p>
        </div>
      </div>

      {/* Grilla de días - Completamente Responsive (7 días: Lunes a Domingo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 lg:gap-6 xl:gap-7 auto-rows-fr items-stretch">
        {days.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd')
          const esDiaPasado = isPast(startOfDay(day)) && !isSameDay(day, new Date())
          const esSeleccionado = selectedDay && isSameDay(day, selectedDay)
          const ocupacionGlobal = getOcupacionGlobal(day)
          const cirugiasDia = cirugias.filter(c => {
            if (pabellonId !== 'todos' && c.operating_room_id !== pabellonId) return false
            return c.fecha === dayStr
          })
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`bg-white rounded-xl sm:rounded-2xl lg:rounded-[2.5rem] border-2 p-4 sm:p-5 md:p-6 lg:p-7 xl:p-8 flex flex-col h-full text-left hover:shadow-xl transition-all group w-full min-h-[160px] sm:min-h-[180px] lg:min-h-[200px] xl:min-h-[220px] 2xl:min-h-[240px] active:scale-[0.98] touch-manipulation ${
                esDiaPasado
                  ? 'border-slate-200 opacity-75 hover:border-slate-300 hover:opacity-90 cursor-pointer'
                  : esSeleccionado
                  ? 'border-blue-500 shadow-lg shadow-blue-200/50 bg-blue-50/30 ring-2 ring-blue-500 ring-offset-2'
                  : 'border-slate-100 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }`}
              aria-label={`${format(day, 'EEEE d MMMM', { locale: es })} - ${ocupacionGlobal}% ocupado${esDiaPasado ? ' (modo consulta)' : ''}`}
              aria-pressed={esSeleccionado}
            >
              <div className="flex items-start justify-between mb-4 sm:mb-6 w-full gap-2 sm:gap-3">
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className={`text-base sm:text-lg lg:text-xl xl:text-xl font-black uppercase mb-1 sm:mb-2 whitespace-nowrap ${
                    esDiaPasado ? 'text-slate-400' : esSeleccionado ? 'text-blue-700' : 'text-slate-900 group-hover:text-blue-600'
                  } transition-colors`}>
                    {format(day, 'EEEE', { locale: es })}
                  </h3>
                  <p className="text-xs sm:text-sm lg:text-sm font-bold text-slate-500 uppercase tracking-wider leading-relaxed whitespace-nowrap">
                    {format(day, 'd MMMM', { locale: es })}
                  </p>
                </div>
                <div className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider leading-relaxed ml-2 sm:ml-4 flex-shrink-0 ${
                  esDiaPasado
                    ? 'bg-slate-200 text-slate-600'
                    : ocupacionGlobal > 80
                    ? 'bg-red-100 text-red-700'
                    : ocupacionGlobal > 50
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {esDiaPasado ? 'Histórico' : `${ocupacionGlobal}%`}
                </div>
              </div>

              {/* Indicador visual de ocupación */}
              <div className="mt-auto w-full">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider leading-relaxed truncate">
                    Ocupación Global
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-600 ml-2 flex-shrink-0">
                    {cirugiasDia.length} cirugías
                  </span>
                </div>
                <div className="h-3 sm:h-4 lg:h-5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner mb-2 sm:mb-3">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      ocupacionGlobal > 80
                        ? 'bg-gradient-to-r from-red-500 to-red-600'
                        : ocupacionGlobal > 50
                        ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                    }`}
                    style={{ width: `${ocupacionGlobal}%` }}
                    aria-label={`${ocupacionGlobal}% ocupado`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] sm:text-xs lg:text-sm font-bold text-slate-500">
                  <span className="truncate">{pabellones.length} pabellones</span>
                  <span className={`ml-2 flex-shrink-0 ${ocupacionGlobal > 80 ? 'text-red-600' : ocupacionGlobal > 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {100 - ocupacionGlobal}% disponible
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Constantes para slots de tiempo (8:00 AM a 7:00 PM en bloques de 1 hora)
const TIME_SLOTS = Array.from({ length: 12 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`)

// Componente DayView (Slots Horarios)
const DayView = ({ day, pabellones, cirugias, bloqueos, onSlotSelect, selectedSlot, currentRequest, onConfirmSlot, onSlotClick, showError }) => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const scrollRef = useRef(null)
  const [gridWidth, setGridWidth] = useState(800) // Ancho inicial de la grilla (más espacio por defecto)
  const [isResizing, setIsResizing] = useState(false)
  const gridRef = useRef(null)
  const resizeHandleRef = useRef(null)
  
  // Verificar si el día es pasado
  const esDiaPasado = isPast(startOfDay(day)) && !isSameDay(day, new Date())

  // Actualizar hora actual cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Scroll automático a la hora actual al cargar
  useEffect(() => {
    if (scrollRef.current && isSameDay(day, new Date())) {
      const currentHour = currentTime.getHours()
      const currentSlotIndex = Math.max(0, currentHour - 8)
      const scrollPosition = currentSlotIndex * 160 // altura aproximada de cada slot
      scrollRef.current.scrollTop = scrollPosition - 140 // offset para centrar
    }
  }, [day, currentTime])
  // Obtener solo los primeros 4 pabellones (siempre mostrar 4)
  const PAVILIONS = useMemo(() => {
    const primeros4 = pabellones.slice(0, 4)
    // Rellenar hasta 4 si hay menos
    while (primeros4.length < 4) {
      primeros4.push({ id: `empty-${primeros4.length}`, nombre: `Pabellón ${primeros4.length + 1}` })
    }
    return primeros4.map(p => p.nombre)
  }, [pabellones])

  const pabellonesMostrar = useMemo(() => {
    return pabellones.slice(0, 4)
  }, [pabellones])

  // Verificar si el Pabellón 1 a las 8:00 está ocupado (para bloquearlo completamente)
  const pabellon1Bloqueado = useMemo(() => {
    const pabellon1 = pabellonesMostrar[0]
    if (!pabellon1) return false
    
    const cirugiaPabellon1_8am = cirugias.find(c => 
      c.operating_room_id === pabellon1.id && 
      c.fecha === format(day, 'yyyy-MM-dd') &&
      c.hora_inicio <= '08:00' && c.hora_fin > '08:00'
    )
    return !!cirugiaPabellon1_8am
  }, [pabellonesMostrar, cirugias, day])

  // Función para obtener el estado de una celda específica
  const getGridStatus = (tIdx, pIdx, selectedDay, bloqueosList) => {
    const time = TIME_SLOTS[tIdx]
    const pabellon = pabellonesMostrar[pIdx]
    
    if (!pabellon) {
      return { status: 'free' }
    }

    // REGLA ESPECIAL: Si Pabellón 1 a las 8:00 está ocupado, el Pabellón 1 queda bloqueado para TODAS las horas
    if (pIdx === 0 && pabellon1Bloqueado) {
      return { status: 'blocked_agreement', data: { motivo: 'Pabellón 1 ocupado a las 8:00' } }
    }

    // Verificar si hay cirugía ocupando este slot
    const cirugia = cirugias.find(c => 
      c.operating_room_id === pabellon.id && 
      c.fecha === format(selectedDay, 'yyyy-MM-dd') &&
      c.hora_inicio <= time + ':00' && c.hora_fin > time + ':00'
    )
    
    if (cirugia) {
      return { status: 'occupied', data: cirugia }
    }
    
    // Verificar bloqueos por convenio (fecha y vigencia; comparar horas normalizadas)
    const fechaDia = format(selectedDay, 'yyyy-MM-dd')
    const slotTime = time.length === 5 ? time : time + ':00' // "15:00"
    const bloqueo = bloqueosList.find(b => {
      const f = typeof b.fecha === 'string' ? b.fecha.slice(0, 10) : format(new Date(b.fecha), 'yyyy-MM-dd')
      if (b.operating_room_id !== pabellon.id || f !== fechaDia) return false
      if (b.vigencia_hasta) {
        const vig = typeof b.vigencia_hasta === 'string' ? b.vigencia_hasta.slice(0, 10) : format(new Date(b.vigencia_hasta), 'yyyy-MM-dd')
        if (vig < fechaDia) return false
      }
      const hin = (b.hora_inicio && typeof b.hora_inicio === 'string') ? b.hora_inicio.slice(0, 5) : b.hora_inicio
      const hfn = (b.hora_fin && typeof b.hora_fin === 'string') ? b.hora_fin.slice(0, 5) : b.hora_fin
      if (!hin || !hfn) return true
      return hin <= slotTime && hfn > slotTime
    })
    
    if (bloqueo) {
      return { status: 'blocked_agreement', data: bloqueo }
    }

    return { status: 'free' }
  }

  // Calcula el estado de cada celda usando useMemo para optimizar
  const gridData = useMemo(() =>
    TIME_SLOTS.map((_, tIdx) =>
      PAVILIONS.map((_, pIdx) => getGridStatus(tIdx, pIdx, day, bloqueos))
    ),
    // PAVILIONS y getGridStatus son constantes de módulo — no cambian entre renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day, bloqueos, cirugias, pabellonesMostrar, pabellon1Bloqueado]
  )

  return (
    <div className="flex flex-col h-auto lg:h-[calc(100vh-250px)] lg:flex-row gap-4 sm:gap-5 lg:gap-6 xl:gap-8 animate-in fade-in duration-500 px-2 sm:px-0">
      {/* Contenedor para el mensaje de día histórico si existe - Versión móvil más pequeña */}
      {esDiaPasado && (
        <div className="lg:hidden mb-2 sm:mb-3 bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex items-start gap-1.5 sm:gap-2">
          <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] font-black text-blue-900 uppercase tracking-wide leading-tight">
              Modo Consulta - Día Histórico
            </p>
            <p className="text-[8px] sm:text-[9px] text-blue-700 mt-0.5 leading-tight">
              Puede revisar las cirugías realizadas este día. No se pueden realizar modificaciones en fechas pasadas.
            </p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 lg:gap-6 xl:gap-8 flex-1 min-w-0">
      {/* COLUMNA IZQUIERDA: Tarjeta de Solicitud y Leyenda - Completamente Responsive */}
      <div className="w-full lg:w-72 flex-shrink-0 space-y-3 sm:space-y-4 lg:space-y-6">
        {/* Tarjeta oscura "Solicitud en Curso" */}
        <div className="bg-slate-900 p-4 sm:p-5 md:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
          {/* Círculo decorativo azul en la esquina */}
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/20 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
          
          <h6 className="font-black text-[8px] sm:text-[9px] uppercase tracking-[0.4em] text-blue-400 mb-3 sm:mb-4 leading-relaxed">Solicitud en Curso</h6>
          
          {/* Lógica condicional: Mostrar datos si hay request, o texto por defecto */}
          {currentRequest ? (
            <div className="space-y-3 sm:space-y-4 relative z-10">
              <div>
                <div className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed mb-0.5 sm:mb-1">Paciente</div>
                <div className="text-base sm:text-lg md:text-xl font-black uppercase tracking-wide leading-relaxed break-words">{currentRequest.patients?.nombre} {currentRequest.patients?.apellido}</div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 bg-white/5 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-white/10">
                <Activity size={14} className="sm:w-4 sm:h-4 text-blue-500 flex-shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest leading-relaxed truncate min-w-0 flex-1">
                  {(() => {
                    const codigoObj = codigosOperaciones.find(c => c.codigo === currentRequest.codigo_operacion)
                    return codigoObj?.nombre || currentRequest.codigo_operacion
                  })()}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[9px] sm:text-[10px] text-slate-500 italic">Navegación libre por disponibilidad.</p>
          )}
        </div>

        {/* Tarjeta blanca "Leyenda" mejorada */}
        <div className="bg-white p-4 sm:p-5 md:p-6 lg:p-7 rounded-2xl sm:rounded-[2.5rem] border border-slate-200 shadow-sm">
          <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 sm:mb-4 flex items-center gap-2 leading-relaxed">
            <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md bg-blue-50 flex items-center justify-center text-blue-500 text-[10px] sm:text-xs flex-shrink-0">?</span>
            <span className="truncate">Leyenda de Estados</span>
          </h4>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-4 h-4 rounded border-2 border-green-300 bg-green-50 flex items-center justify-center">
                <CheckCircle2 size={12} className="text-green-600" />
              </div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Disponible</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-4 h-4 rounded border-2 border-red-300 bg-red-50 flex items-center justify-center">
                <XCircle size={12} className="text-red-600" />
              </div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide leading-relaxed">Ocupado</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-4 h-4 rounded border-2 border-amber-400 bg-slate-800 flex items-center justify-center">
                <Lock size={12} className="text-amber-400" />
              </div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide leading-relaxed">Bloqueado / Convenio</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-50 flex items-center justify-center">
                <CheckCircle2 size={12} className="text-blue-600" />
              </div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide leading-relaxed">Seleccionado</span>
            </div>
          </div>
        </div>

        {/* Mensaje informativo si el día es pasado - Más pequeño y debajo de la leyenda */}
        {esDiaPasado && (
          <div className="hidden lg:block bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex items-start gap-1.5 sm:gap-2">
            <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] sm:text-[10px] font-black text-blue-900 uppercase tracking-wide leading-tight">
                Modo Consulta - Día Histórico
              </p>
              <p className="text-[8px] sm:text-[9px] text-blue-700 mt-0.5 leading-tight">
                Puede revisar las cirugías realizadas este día. No se pueden realizar modificaciones en fechas pasadas.
              </p>
            </div>
          </div>
        )}
      </div>

        {/* GRILLA PRINCIPAL: Pabellones y Horarios - Completamente Responsive con Resize */}
      <div 
        ref={gridRef}
        style={{ 
          width: `${gridWidth}px`,
          minWidth: '600px',
          maxWidth: '90%'
        }}
        className={`relative bg-white rounded-xl sm:rounded-2xl lg:rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col ${esDiaPasado ? 'opacity-90' : ''} ${isResizing ? 'select-none' : ''}`}
      >
        {/* Handle de resize en el borde izquierdo */}
        <div
          ref={resizeHandleRef}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!gridRef.current) return
            
            setIsResizing(true)
            const startX = e.clientX
            const startWidth = gridRef.current.getBoundingClientRect().width
            
            document.body.style.userSelect = 'none'
            document.body.style.cursor = 'col-resize'
            
            const handleMove = (moveEvent) => {
              const deltaX = moveEvent.clientX - startX
              let newWidth = startWidth + deltaX
              
              // Límites: mínimo 600px, máximo el 90% del viewport
              if (newWidth < 600) newWidth = 600
              if (newWidth > window.innerWidth * 0.9) newWidth = window.innerWidth * 0.9
              
              setGridWidth(newWidth)
            }
            
            const handleUp = () => {
              document.removeEventListener('mousemove', handleMove)
              document.removeEventListener('mouseup', handleUp)
              document.body.style.userSelect = ''
              document.body.style.cursor = ''
              setIsResizing(false)
            }
            
            document.addEventListener('mousemove', handleMove)
            document.addEventListener('mouseup', handleUp)
          }}
          className={`absolute left-0 top-0 w-4 h-full cursor-col-resize z-30 group ${
            isResizing ? 'bg-blue-500/30' : 'bg-transparent hover:bg-blue-200/30'
          } transition-colors`}
          style={{ 
            touchAction: 'none',
            userSelect: 'none',
            marginLeft: '-16px',
            paddingLeft: '16px'
          }}
          title="Arrastra para redimensionar"
        >
          {/* Indicador visual del handle */}
          <div className={`absolute top-1/2 left-2 transform -translate-y-1/2 w-1 h-32 rounded-full transition-all pointer-events-none ${
            isResizing 
              ? 'bg-blue-600 opacity-100 w-2' 
              : 'bg-blue-400 opacity-0 group-hover:opacity-70 group-hover:w-1.5'
          }`} />
          {/* Línea vertical del handle */}
          <div className={`absolute top-0 left-0 w-0.5 h-full transition-all ${
            isResizing 
              ? 'bg-blue-500 opacity-100' 
              : 'bg-blue-300 opacity-0 group-hover:opacity-60'
          }`} />
        </div>
        {/* Cabecera de la tabla (Pabellón 1, Pabellón 2, etc.) - Scroll horizontal en móvil */}
        <div className="flex bg-slate-50 border-b-2 border-slate-200 shadow-sm overflow-x-auto -mx-2 sm:mx-0 scrollbar-hide">
          <div className="w-16 sm:w-20 lg:w-24 border-r-2 border-slate-200 flex-shrink-0 flex items-center justify-center py-3 sm:py-4 lg:py-6 sticky left-0 bg-slate-50 z-20">
            <Clock size={14} className="sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px] text-slate-400" />
          </div>
          {PAVILIONS.map((p, pIdx) => {
            const pabellon = pabellonesMostrar[pIdx]
            if (!pabellon) {
              return (
                <div key={`empty-${pIdx}`} className="flex-1 min-w-[100px] sm:min-w-[120px] text-center py-3 sm:py-4 lg:py-6 border-r-2 last:border-r-0 border-slate-200 bg-slate-50/50 px-2">
                  <div className="font-black text-slate-800 text-[9px] sm:text-[10px] lg:text-[11px] uppercase tracking-[0.3em] leading-relaxed truncate">{p}</div>
                  <div className="text-[7px] sm:text-[8px] lg:text-[9px] font-black text-slate-400 uppercase mt-1 sm:mt-1.5">No disponible</div>
                </div>
              )
            }
            const slotsLibres = gridData.filter(r => r[pIdx].status === 'free').length
            return (
              <div key={pabellon.id} className="flex-1 min-w-[100px] sm:min-w-[120px] text-center py-3 sm:py-4 lg:py-6 border-r-2 last:border-r-0 border-slate-200 hover:bg-slate-100/50 transition-colors px-2">
                <div className="font-black text-slate-800 text-[9px] sm:text-[10px] lg:text-[11px] uppercase tracking-[0.3em] leading-relaxed truncate">{p}</div>
                <div className="text-[7px] sm:text-[8px] lg:text-[9px] font-black text-green-500 uppercase mt-1 sm:mt-1.5">
                  {slotsLibres} {slotsLibres === 1 ? 'Libre' : 'Libres'}
                </div>
              </div>
            )
          })}
        </div>

        {/* Cuerpo de la grilla (Scrollable) */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar bg-slate-50/30 relative -mx-2 sm:mx-0 scrollbar-hide">
          
          {TIME_SLOTS.map((time, tIdx) => {
            const isCurrentHour = isSameDay(day, new Date()) && 
              currentTime.getHours() === parseInt(time.split(':')[0]) &&
              currentTime.getHours() >= 8 && currentTime.getHours() < 20
            
            return (
            <div key={time} className={`flex border-b-2 border-slate-200 last:border-0 hover:bg-white/50 transition-all group relative min-h-[90px] sm:min-h-[100px] lg:min-h-[110px] ${isCurrentHour ? 'bg-gradient-to-r from-blue-50/40 to-transparent' : ''}`}>
              {/* Columna de Hora (08:00, 09:00...) - Sticky en móvil */}
              <div className={`w-16 sm:w-20 lg:w-24 border-r-[3px] border-slate-500 flex-shrink-0 flex items-center justify-center h-full text-[9px] sm:text-[10px] lg:text-[11px] font-black uppercase tracking-widest leading-relaxed transition-all duration-300 relative z-10 bg-white sticky left-0 ${
                isCurrentHour 
                  ? 'text-blue-600 bg-blue-50/30 shadow-sm' 
                  : 'text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50/20'
              }`}
              aria-label={`Hora ${time}`}
              >
                {time}
              </div>
              
              {/* Celdas interactivas */}
              {PAVILIONS.map((pav, pIdx) => {
                const pabellon = pabellonesMostrar[pIdx]
                const info = gridData[tIdx][pIdx]
                const isSelected = selectedSlot?.pabellonId === pabellon?.id && selectedSlot?.time === time
                const isAvailable = info.status === 'free' && pabellon
                
                if (!pabellon) {
                  return (
                    <div key={`${time}-${pav}`} className="flex-1 h-full border-r-2 last:border-r-0 border-slate-200 p-0 bg-slate-50/30">
                      <div className="h-full w-full flex items-center justify-center border-2 border-dashed rounded-xl border-slate-100 opacity-50 m-1">
                        <span className="text-sm text-slate-300 font-black uppercase tracking-widest">N/A</span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div 
                    key={`${time}-${pav}`} 
                    onClick={() => {
                      // Si el día es pasado, solo permitir ver detalles de cirugías
                      if (esDiaPasado) {
                        if (info.status === 'occupied') {
                          // Permitir ver detalles de cirugías pasadas
                          onSlotClick({ 
                            type: 'occupied', 
                            data: info.data, 
                            pabellon: pabellon.nombre,
                            time,
                            date: day
                          })
                        } else {
                          // Para slots disponibles en días pasados, mostrar mensaje informativo
                          showError('Este día es histórico. Solo se pueden consultar cirugías realizadas.')
                        }
                        return
                      }
                      
                      if (info.status === 'occupied') {
                        // Si está ocupado, mostrar detalles
                        onSlotClick({ 
                          type: 'occupied', 
                          data: info.data, 
                          pabellon: pabellon.nombre,
                          time,
                          date: day
                        })
                        return
                      }
                      
                      if (info.status === 'blocked_agreement') {
                        // Si está bloqueado, mostrar error
                        showError('Este horario está bloqueado por convenio')
                        return
                      }
                      
                      if (isAvailable && currentRequest) {
                        // Si hay una solicitud en curso, seleccionar para agendar
                        onSlotSelect({ pabellonId: pabellon.id, time, date: day })
                      } else if (isAvailable) {
                        // Si está disponible y no hay solicitud, mostrar detalles del slot disponible
                        onSlotClick({ 
                          type: 'available', 
                          pabellon: pabellon.nombre,
                          time,
                          date: day
                        })
                      }
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && isAvailable && !esDiaPasado) {
                        e.preventDefault()
                        if (currentRequest) {
                          onSlotSelect({ pabellonId: pabellon.id, time, date: day })
                        } else {
                          onSlotClick({ 
                            type: 'available', 
                            pabellon: pabellon.nombre,
                            time,
                            date: day
                          })
                        }
                      }
                    }}
                    className={`flex-1 h-full border-r-2 last:border-r-0 border-slate-200 pl-1.5 sm:pl-2 lg:pl-4 pr-1.5 sm:pr-2 lg:pr-3 py-1.5 sm:py-2 transition-all flex items-center justify-center bg-white min-w-[90px] sm:min-w-[100px] touch-manipulation ${
                      esDiaPasado 
                        ? info.status === 'occupied'
                          ? 'cursor-pointer hover:bg-blue-50/40 opacity-90'
                          : 'cursor-not-allowed opacity-50'
                        : isAvailable || info.status === 'occupied' 
                          ? 'cursor-pointer hover:bg-blue-50/40 active:bg-blue-100/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1' 
                          : 'cursor-not-allowed'
                    }`}
                    tabIndex={esDiaPasado ? (info.status === 'occupied' ? 0 : -1) : (isAvailable || info.status === 'occupied' ? 0 : -1)}
                  >
                    {info.status === 'occupied' ? (
                      // Renderizado para celda OCUPADA - diseño más compacto y claro
                      <Tooltip content={
                        <div className="text-left">
                          <div className="font-black mb-1 text-white">Cirugía Programada</div>
                          <div className="text-xs text-slate-200">
                            <div>Dr. {info.data?.doctors?.apellido || info.data?.doctors?.nombre || 'General'}</div>
                            <div className="mt-1">
                              {info.data?.hora_inicio?.substring(0, 5)} - {info.data?.hora_fin?.substring(0, 5)}
                            </div>
                            {info.data?.patients?.nombre && (
                              <div className="mt-1">
                                {info.data.patients.nombre} {info.data.patients.apellido}
                              </div>
                            )}
                            <div className="mt-2 text-[10px] text-blue-300">Click para ver detalles</div>
                          </div>
                        </div>
                      }>
                        <div className="w-full h-full bg-red-50 border-2 border-red-300 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-red-100 hover:border-red-400 hover:shadow-lg active:scale-95 transition-all group/occupied" role="button" tabIndex={0} aria-label="Horario ocupado">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-500 flex items-center justify-center mb-1 sm:mb-2 group-hover/occupied:scale-110 transition-transform">
                            <XCircle size={12} className="sm:w-4 sm:h-4 text-white" />
                          </div>
                          <span className="text-[10px] sm:text-xs font-black text-red-700 uppercase tracking-wider leading-relaxed text-center">Ocupado</span>
                          {info.data?.patients?.nombre && (
                            <span className="text-[8px] sm:text-[9px] text-red-600 font-bold mt-0.5 sm:mt-1 truncate w-full text-center px-1">
                              {info.data.patients.nombre.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </Tooltip>
                    ) : info.status === 'blocked_agreement' ? (
                      // Renderizado para celda BLOQUEADA - diseño más compacto
                      <Tooltip content="Bloqueado por convenio - No disponible para agendar">
                        <div className="w-full h-full bg-slate-800 border-2 border-amber-400/50 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col items-center justify-center cursor-not-allowed hover:border-amber-400 transition-all" role="button" tabIndex={-1} aria-label="Horario bloqueado">
                          <Lock size={16} className="sm:w-5 sm:h-5 text-amber-400 mb-1 sm:mb-2" />
                          <span className="text-[10px] sm:text-xs font-black text-amber-400 uppercase tracking-wider leading-relaxed text-center">Bloqueado</span>
                        </div>
                      </Tooltip>
                    ) : (
                      // Renderizado para celda DISPONIBLE - diseño más claro y eficiente
                      <Tooltip content={currentRequest ? "Click para seleccionar este horario" : "Click para ver detalles del horario disponible"}>
                        <div className={`w-full h-full border-2 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col items-center justify-center transition-all active:scale-95 ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-200/50' 
                            : isAvailable
                            ? 'border-green-300 bg-green-50 hover:border-green-500 hover:bg-green-100 hover:shadow-md active:bg-green-200'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                        role="button"
                        tabIndex={isAvailable ? 0 : -1}
                        aria-label={isAvailable ? `Horario disponible ${time} en ${pabellon.nombre}` : 'Horario no disponible'}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 size={16} className="sm:w-5 sm:h-5 text-blue-600 mb-0.5 sm:mb-1" />
                              <span className="text-[10px] sm:text-xs font-black text-blue-600 uppercase tracking-wider text-center">Seleccionado</span>
                            </>
                          ) : isAvailable ? (
                            <>
                              <CheckCircle2 size={16} className="sm:w-5 sm:h-5 text-green-600 mb-0.5 sm:mb-1" />
                              <span className="text-[10px] sm:text-xs font-black text-green-700 uppercase tracking-wider leading-relaxed text-center">Disponible</span>
                            </>
                          ) : (
                            <span className="text-[10px] sm:text-xs text-slate-400 font-bold">N/A</span>
                          )}
                        </div>
                      </Tooltip>
                    )}
                  </div>
                )
              })}
            </div>
            )
          })}
        </div>
        
        {/* Barra inferior de confirmación (aparece al seleccionar) - Completamente Responsive */}
        {selectedSlot && (
          <div className="bg-slate-900 text-white p-3 sm:p-4 lg:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 animate-in slide-in-from-bottom duration-500 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] sticky bottom-0 z-30">
            <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 flex-1 min-w-0 w-full sm:w-auto">
              <div className="bg-blue-600 p-2.5 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl lg:rounded-2xl flex-shrink-0">
                <Info size={18} className="sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[7px] sm:text-[8px] lg:text-[9px] text-blue-400 font-black uppercase tracking-[0.4em] mb-0.5 sm:mb-1 leading-relaxed">BLOQUE SELECCIONADO</p>
                <h3 className="text-sm sm:text-base lg:text-xl font-black uppercase tracking-wide leading-relaxed truncate">
                  {pabellonesMostrar.find(p => p.id === selectedSlot.pabellonId)?.nombre} 
                  <span className="text-slate-400 mx-1.5 sm:mx-2 lg:mx-3">•</span> 
                  {selectedSlot.time}
                </h3>
              </div>
            </div>
            <Button 
              onClick={onConfirmSlot}
              className="w-full sm:w-auto px-6 sm:px-8 lg:px-12 py-2.5 sm:py-3 lg:py-4 text-sm sm:text-base touch-manipulation"
            >
              <span className="hidden sm:inline">PROCEDER AL AGENDAMIENTO</span>
              <span className="sm:hidden">CONFIRMAR</span>
            </Button>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

export default function Calendario() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const fromReagendamientoNotification = location.state?.fromReagendamientoNotification === true
  const isReagendarMode = location.state?.reagendar === true && (location.state?.surgeryRequestId || typeof sessionStorage !== 'undefined' && sessionStorage.getItem('reagendar_solicitud_id'))
  const { showSuccess, showError } = useNotifications()
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [pabellonId, setPabellonId] = useState('todos')
  const [filtroPaciente, setFiltroPaciente] = useState('') // Filtro por nombre de paciente
  
  // Estados de navegación
  const [view, setView] = useState('year') // year, month, week, day
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
  // Reagendamiento: cirugía existente a actualizar (cuando el doctor pidió reagendar)
  const [cirugiaAReagendar, setCirugiaAReagendar] = useState(null)
  
  // Obtener solicitud desde sessionStorage si existe (programar) o null hasta cargar en modo reagendar
  const [currentRequest, setCurrentRequest] = useState(() => {
    try {
      const solicitudStr = sessionStorage.getItem('solicitud_gestionando')
      if (solicitudStr) {
        return JSON.parse(solicitudStr)
      }
    } catch (e) {
      logger.errorWithContext('Error al parsear solicitud', e)
    }
    return null
  })

  // Navegación rápida desde el dashboard (ver hoy en día o semana)
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

  // Cargar cirugía y solicitud cuando se llega en modo reagendar (desde Solicitudes o notificación)
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
          .select(`
            *,
            doctors:doctor_id(id, nombre, apellido, especialidad, estado),
            patients:patient_id(nombre, apellido, rut)
          `)
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
        setSelectedDay(new Date(cirugia.fecha))
        setSelectedMonth(new Date(cirugia.fecha).getMonth())
        setAnio(new Date(cirugia.fecha).getFullYear())
      } catch (e) {
        logger.errorWithContext('Error en loadReagendar', e)
        showError('Error al cargar datos para reagendar.')
      }
    }

    loadReagendar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReagendarMode, location.state?.surgeryRequestId])
  
  // Mutation para programar la cirugía usando función PostgreSQL atómica
  const programarCirugia = useMutation({
    mutationFn: async ({ solicitudId, formData }) => {
      // Normalizar formato de horas a HH:MM:SS
      let horaInicio = formData.hora_inicio
      let horaFin = formData.hora_fin
      
      // Si tiene formato HH:MM, agregar :00
      if (horaInicio && horaInicio.match(/^\d{1,2}:\d{2}$/)) {
        const [h, m] = horaInicio.split(':')
        horaInicio = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`
      } else if (horaInicio && horaInicio.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
        // Ya tiene formato completo, solo asegurar padding
        const [h, m, s] = horaInicio.split(':')
        horaInicio = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`
      }
      
      if (horaFin && horaFin.match(/^\d{1,2}:\d{2}$/)) {
        const [h, m] = horaFin.split(':')
        horaFin = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`
      } else if (horaFin && horaFin.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
        // Ya tiene formato completo, solo asegurar padding
        const [h, m, s] = horaFin.split(':')
        horaFin = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`
      }

      // Validar formato de horas antes de enviar
      if (!horaInicio || !horaInicio.match(/^\d{2}:\d{2}:\d{2}$/)) {
        throw new Error(`Formato de hora de inicio inválido: ${horaInicio}`)
      }
      if (!horaFin || !horaFin.match(/^\d{2}:\d{2}:\d{2}$/)) {
        throw new Error(`Formato de hora de fin inválido: ${horaFin}`)
      }

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
        logger.errorWithContext('Error al programar cirugía (desde slot)', error, {
          slot: selectedSlot,
          horaInicio,
          horaFin,
        })
        throw error
      }

      if (!data || !data.success) {
        throw new Error(data?.message || 'Error desconocido al programar la cirugía')
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['solicitudes'])
      queryClient.invalidateQueries(['solicitudes-pendientes'])
      queryClient.invalidateQueries(['cirugias-hoy'])
      queryClient.invalidateQueries(['cirugias-calendario'])
      queryClient.invalidateQueries(['calendario-anual-cirugias'])
      showSuccess('Cirugía programada exitosamente')
      // Limpiar sessionStorage
      sessionStorage.removeItem('solicitud_gestionando')
      sessionStorage.removeItem('slot_seleccionado')
      // Cerrar modal y resetear
      setShowConfirmModal(false)
      setSelectedSlot(null)
      setCurrentRequest(null)
      // Navegar de vuelta a solicitudes
      navigate('/pabellon/solicitudes')
    },
    onError: (error) => {
      logger.errorWithContext('Error al programar cirugía', error)
      
      let mensaje = 'Error al programar la cirugía'
      
      const errorMessage = error.message || error.toString() || 'Error desconocido'
      const errorDetails = error.details || ''
      const errorHint = error.hint || ''
      
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

  // Mutation para reagendar (actualizar fecha/hora de cirugía existente; el trigger notifica al doctor y pabellón)
  const reagendarCirugia = useMutation({
    mutationFn: async ({ cirugiaId, formData }) => {
      let horaInicio = formData.hora_inicio
      let horaFin = formData.hora_fin
      if (horaInicio && horaInicio.match(/^\d{1,2}:\d{2}$/)) {
        const [h, m] = horaInicio.split(':')
        horaInicio = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`
      }
      if (horaFin && horaFin.match(/^\d{1,2}:\d{2}$/)) {
        const [h, m] = horaFin.split(':')
        horaFin = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`
      }
      const { error } = await supabase
        .from('surgeries')
        .update({
          fecha: formData.fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          operating_room_id: formData.operating_room_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cirugiaId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['solicitudes'])
      queryClient.invalidateQueries(['cirugias-hoy'])
      queryClient.invalidateQueries(['cirugias-calendario'])
      queryClient.invalidateQueries(['calendario-anual-cirugias'])
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
  
  // Función para manejar la confirmación del slot seleccionado
  const handleConfirmSlot = () => {
    if (selectedSlot && currentRequest) {
      // Calcular hora fin por defecto (1 hora después)
      const [hours, minutes] = selectedSlot.time.split(':')
      const horaFinDate = new Date()
      horaFinDate.setHours(parseInt(hours) + 1, parseInt(minutes), 0, 0)
      const horaFinStr = `${horaFinDate.getHours().toString().padStart(2, '0')}:${horaFinDate.getMinutes().toString().padStart(2, '0')}`
      setHoraFin(horaFinStr)
      setShowConfirmModal(true)
    }
  }
  
  // Función para confirmar y programar la cirugía (o reagendar si estamos en modo reagendar)
  const handleConfirmarCupo = () => {
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

    if (cirugiaAReagendar) {
      reagendarCirugia.mutate({ cirugiaId: cirugiaAReagendar.id, formData })
    } else {
      programarCirugia.mutate({
        solicitudId: currentRequest.id,
        formData,
      })
    }
  }

  // Mutation para cancelar cirugía (pabellón)
  const cancelarCirugia = useMutation({
    mutationFn: async (cirugiaId) => {
      // Obtener datos de la cirugía para crear notificación al doctor
      const { data: cirugia, error: errorCirugia } = await supabase
        .from('surgeries')
        .select('doctor_id, fecha, hora_inicio, patients:patient_id(nombre, apellido)')
        .eq('id', cirugiaId)
        .single()
      
      if (errorCirugia) throw errorCirugia

      // Actualizar estado de la cirugía
      const { error } = await supabase
        .from('surgeries')
        .update({ 
          estado: 'cancelada',
          updated_at: new Date().toISOString()
        })
        .eq('id', cirugiaId)
      
      if (error) throw error

      // Crear notificación para el doctor
      if (cirugia.doctor_id) {
        const { data: doctorUser } = await supabase
          .from('doctors')
          .select('user_id')
          .eq('id', cirugia.doctor_id)
          .single()

        if (doctorUser?.user_id) {
          await supabase
            .from('notifications')
            .insert({
              user_id: doctorUser.user_id,
              tipo: 'operacion_programada',
              titulo: 'Cirugía Cancelada',
              mensaje: `La cirugía programada para ${cirugia.patients?.nombre} ${cirugia.patients?.apellido} el ${format(new Date(cirugia.fecha), 'dd/MM/yyyy')} a las ${cirugia.hora_inicio} ha sido cancelada por el pabellón.`,
              relacionado_con: cirugiaId,
            })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['calendario-anual-cirugias'])
      queryClient.invalidateQueries(['cirugias-dia-detalle'])
      queryClient.invalidateQueries(['cirugias-fecha'])
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

  const inicioAnio = startOfYear(new Date(anio, 0, 1))
  const finAnio = endOfYear(new Date(anio, 0, 1))

  const fechaInicioStr = inicioAnio.toISOString().slice(0, 10)
  const fechaFinStr = finAnio.toISOString().slice(0, 10)

  const { data: cirugias = [], isLoading: loadingCirugias } = useQuery({
    queryKey: ['calendario-anual-cirugias', anio, filtroPaciente],
    queryFn: async () => {
      let query = supabase
        .from('surgeries')
        .select(`
          id, 
          fecha, 
          operating_room_id, 
          hora_inicio, 
          hora_fin,
          estado,
          doctors (
            apellido
          ),
          patients:patient_id (
            nombre,
            apellido,
            rut
          )
        `)
        .is('deleted_at', null)
      
      // Si no hay filtro de paciente, limitar al año actual
      if (!filtroPaciente) {
        query = query.gte('fecha', fechaInicioStr).lte('fecha', fechaFinStr)
      } else {
        // Si hay filtro, buscar en todos los años pero limitar a un rango razonable (últimos 5 años y próximos 2 años)
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
      
      // Filtrar por nombre de paciente en el cliente si hay filtro
      if (filtroPaciente && data) {
        const filtroLower = filtroPaciente.toLowerCase().trim()
        return data.filter(cirugia => {
          const nombre = cirugia.patients?.nombre?.toLowerCase() || ''
          const apellido = cirugia.patients?.apellido?.toLowerCase() || ''
          const nombreCompleto = `${nombre} ${apellido}`.trim()
          return nombreCompleto.includes(filtroLower) || 
                 nombre.includes(filtroLower) || 
                 apellido.includes(filtroLower)
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

  // Query para obtener cirugías del día seleccionado con detalles completos
  const { data: cirugiasDetalle = [] } = useQuery({
    queryKey: ['cirugias-dia-detalle', selectedDay, filtroPaciente],
    queryFn: async () => {
      if (!selectedDay) return []
      
      const fechaStr = format(selectedDay, 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('surgeries')
        .select(`
          *,
          doctors:doctor_id(nombre, apellido, especialidad),
          patients:patient_id(nombre, apellido, rut),
          operating_rooms:operating_room_id(nombre),
          surgery_request_id,
          surgery_requests:surgery_request_id(codigo_operacion)
        `)
        .eq('fecha', fechaStr)
        .is('deleted_at', null)
        .order('hora_inicio', { ascending: true })

      if (error) throw error
      
      // Filtrar por nombre de paciente si hay filtro
      if (filtroPaciente && data) {
        const filtroLower = filtroPaciente.toLowerCase().trim()
        return data.filter(cirugia => {
          const nombre = cirugia.patients?.nombre?.toLowerCase() || ''
          const apellido = cirugia.patients?.apellido?.toLowerCase() || ''
          const nombreCompleto = `${nombre} ${apellido}`.trim()
          return nombreCompleto.includes(filtroLower) || 
                 nombre.includes(filtroLower) || 
                 apellido.includes(filtroLower)
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

      return {
        ...mes,
        cirugiasEstimadas: cirugiasMes.length,
        porcentajeAgendado,
        porcentajeBloqueado,
        porcentajeLibre,
      }
    })
  }, [anio, pabellonId, cirugias, bloqueos])

  const cargando = loadingCirugias || loadingBloqueos

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
      if (newAnio !== null) {
        setAnio(newAnio)
      }
      if (newMonth !== null) {
        setSelectedMonth(newMonth)
      }
    } else if (targetView === 'week') {
      setView('week')
      setSelectedDay(null)
      setSelectedSlot(null)
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5 px-4 sm:px-5 md:px-6 lg:px-8 py-3 sm:py-4 md:py-5 lg:py-6 max-w-7xl mx-auto">
      {/* Aviso cuando se llega por reagendamiento (notificación o botón Reagendar en Solicitudes) */}
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

      {/* Header General */}
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between mb-3 sm:mb-4 md:mb-5">
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
           {/* Selector de año solo visible en vista anual */}
           {view === 'year' && (
              <div className={`flex items-center gap-2 border rounded-xl sm:rounded-2xl px-3 py-2 w-full sm:w-auto justify-between sm:justify-start ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700'
                  : theme === 'medical'
                  ? 'bg-white border-blue-100'
                  : 'bg-white border-slate-200'
              }`} role="group" aria-label="Selector de año">
               <button
                 onClick={() => setAnio(anio - 1)}
                 className={`p-2 sm:p-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation ${
                   theme === 'dark'
                     ? 'hover:bg-slate-700 active:bg-slate-600'
                     : 'hover:bg-slate-100 active:bg-slate-200'
                 }`}
                 aria-label="Año anterior"
               >
                 <ChevronLeft className={`w-5 h-5 sm:w-4 sm:h-4 ${
                   theme === 'dark' ? 'text-slate-300' : 'text-slate-400'
                 }`} />
               </button>
               <span className={`text-base sm:text-sm font-bold min-w-[80px] sm:min-w-[60px] text-center ${
                 theme === 'dark' ? 'text-white' : 'text-slate-700'
               }`} aria-live="polite">{anio}</span>
               <button
                 onClick={() => setAnio(anio + 1)}
                 className={`p-2 sm:p-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation ${
                   theme === 'dark'
                     ? 'hover:bg-slate-700 active:bg-slate-600'
                     : 'hover:bg-slate-100 active:bg-slate-200'
                 }`}
                 aria-label="Año siguiente"
               >
                 <ChevronRight className={`w-5 h-5 sm:w-4 sm:h-4 ${
                   theme === 'dark' ? 'text-slate-300' : 'text-slate-400'
                 }`} />
               </button>
             </div>
           )}

          {/* Filtro por nombre de paciente */}
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

          {/* Filtro por pabellón */}
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
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mensaje cuando hay filtro de paciente activo */}
      {filtroPaciente && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start sm:items-center gap-2 sm:gap-3">
          <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-black text-blue-900 uppercase tracking-wide leading-relaxed">
              Búsqueda activa: "{filtroPaciente}"
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
                <div className={`flex flex-wrap items-center justify-center sm:justify-end gap-2 md:gap-2.5 lg:gap-3 text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-[0.3em] leading-relaxed ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-400'
                }`}>
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
                </div>
              </div>
              {/* Grilla 3x4 para los 12 meses - Diseño compacto para ver todos en una pantalla */}
              <div className="grid grid-cols-3 gap-3 md:gap-4 lg:gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {statsMeses.map((mes) => (
                  <button
                    key={mes.indice}
                    onClick={() => {
                      setSelectedMonth(mes.indice)
                      setView('month')
                    }}
                    className={`rounded-xl border-2 shadow-sm p-3 md:p-4 lg:p-5 flex flex-col justify-between text-left hover:border-blue-500 hover:shadow-lg hover:scale-[1.02] transition-all group min-h-[95px] md:min-h-[110px] lg:min-h-[125px] active:scale-[0.98] touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-700'
                        : theme === 'medical'
                        ? 'bg-white border-blue-100'
                        : 'bg-white border-slate-100'
                    }`}
                    aria-label={`Ver ${mes.nombre} - ${mes.cirugiasEstimadas} cirugías estimadas, ${mes.porcentajeAgendado}% ocupación`}
                  >
                    <div className="flex items-start justify-between mb-2 md:mb-2.5 w-full gap-1.5 md:gap-2">
                      <div className="flex-1 min-w-0">
                        <h2 className={`text-base md:text-lg lg:text-xl font-black transition-colors uppercase truncate leading-normal tracking-wide ${
                          theme === 'dark'
                            ? 'text-white group-hover:text-blue-400'
                            : 'text-slate-900 group-hover:text-blue-600'
                        }`}>{mes.nombre}</h2>
                        <p className={`text-[8px] md:text-[9px] lg:text-[10px] font-bold mt-1 leading-relaxed ${
                          theme === 'dark' ? 'text-slate-300' : 'text-slate-500'
                        }`}>
                          {mes.cirugiasEstimadas} cirugías est.
                        </p>
                      </div>
                      <div className="text-right ml-1.5 md:ml-2 flex-shrink-0">
                        <p className={`text-base md:text-lg lg:text-xl font-black leading-normal ${
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        }`}>{mes.porcentajeAgendado}%</p>
                        <p className={`text-[7px] md:text-[8px] lg:text-[9px] font-black uppercase tracking-[0.3em] mt-0.5 leading-relaxed ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-400'
                        }`}>
                          Agendado
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto w-full">
                      <div className={`h-2 md:h-2.5 lg:h-3 w-full rounded-full overflow-hidden shadow-inner mb-1.5 ${
                        theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'
                      }`}>
                        <div className="h-full flex">
                          {mes.porcentajeAgendado > 0 && (
                            <div
                              className="bg-blue-500 transition-all"
                              style={{ width: `${mes.porcentajeAgendado}%` }}
                              aria-label={`${mes.porcentajeAgendado}% agendado`}
                            />
                          )}
                          {mes.porcentajeBloqueado > 0 && (
                            <div
                              className="bg-yellow-400 transition-all"
                              style={{ width: `${mes.porcentajeBloqueado}%` }}
                              aria-label={`${mes.porcentajeBloqueado}% bloqueado`}
                            />
                          )}
                          {mes.porcentajeLibre > 0 && (
                            <div
                              className="bg-slate-300 transition-all"
                              style={{ width: `${mes.porcentajeLibre}%` }}
                              aria-label={`${mes.porcentajeLibre}% libre`}
                            />
                          )}
                        </div>
                      </div>
                      <div className={`flex items-center justify-between text-[8px] md:text-[9px] lg:text-[10px] font-bold mt-1 leading-relaxed ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-500'
                      }`}>
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
              onWeekClick={(weekStart) => {
                setSelectedWeek(weekStart)
                setView('week')
              }}
            />
          )}

          {view === 'week' && selectedWeek && (
            <WeekView 
              weekStart={selectedWeek} 
              cirugias={cirugias}
              pabellonId={pabellonId}
              pabellones={pabellones}
              selectedDay={selectedDay}
              onDayClick={(day) => {
                setSelectedDay(day)
                setView('day')
              }}
            />
          )}

          {view === 'day' && selectedDay && (
            <DayView 
              day={selectedDay}
              pabellones={pabellones}
              cirugias={cirugiasDetalle}
              bloqueos={bloqueos}
              onSlotSelect={setSelectedSlot}
              selectedSlot={selectedSlot}
              currentRequest={currentRequest}
              onConfirmSlot={handleConfirmSlot}
              onSlotClick={(slotInfo) => {
                setSlotDetalle(slotInfo)
                setShowDetallesModal(true)
              }}
              showError={showError}
            />
          )}
        </>
      )}

      {/* Modal de Confirmación de Cupo - Diseño mejorado */}
      {showConfirmModal && selectedSlot && currentRequest && (
        <Modal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title={cirugiaAReagendar ? 'Confirmar Reagendamiento' : 'Confirmar Agendamiento'}
        >
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            {/* Resumen visual del agendamiento */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 border-2 border-blue-200">
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-lg sm:text-xl md:text-2xl shadow-lg bg-blue-600 flex-shrink-0">
                  {currentRequest.patients?.nombre?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[8px] sm:text-[9px] font-black text-blue-400 uppercase tracking-widest mb-0.5 sm:mb-1">
                    Paciente
                  </div>
                  <div className="font-black text-slate-900 text-base sm:text-lg md:text-xl uppercase leading-relaxed tracking-wide truncate">
                    {currentRequest.patients?.nombre} {currentRequest.patients?.apellido}
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-600 font-bold mt-0.5 sm:mt-1">
                    RUT: {currentRequest.patients?.rut}
                  </div>
                </div>
              </div>

              {/* Procedimiento */}
              <div className="bg-white/60 rounded-lg sm:rounded-xl p-2.5 sm:p-3 border border-blue-200">
                <div className="text-[8px] sm:text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 sm:gap-2">
                  <Activity size={10} className="sm:w-3 sm:h-3" />
                  Procedimiento
                </div>
                <div className="text-xs sm:text-sm font-black text-slate-800 break-words">
                  {(() => {
                    const codigoObj = codigosOperaciones.find(c => c.codigo === currentRequest.codigo_operacion)
                    return codigoObj?.nombre || currentRequest.codigo_operacion
                  })()}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-bold mt-0.5 sm:mt-1">
                  Código: {currentRequest.codigo_operacion}
                </div>
              </div>
            </div>

            {/* Detalles del agendamiento en grilla - Responsive */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-slate-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200">
                <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                  <Clock size={10} className="sm:w-3 sm:h-3" />
                  Horario
                </div>
                <div className="text-sm sm:text-base font-black text-slate-900 break-words">
                  {selectedSlot.time} - {horaFin || '--:--'}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200">
                <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                  <CalendarIcon size={10} className="sm:w-3 sm:h-3" />
                  Pabellón
                </div>
                <div className="text-sm sm:text-base font-black text-slate-900 break-words">
                  {pabellones.find(p => p.id === selectedSlot.pabellonId)?.nombre || 'N/A'}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200">
                <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                  <CalendarIcon size={10} className="sm:w-3 sm:h-3" />
                  Fecha
                </div>
                <div className="text-sm sm:text-base font-black text-slate-900 break-words">
                  {format(selectedSlot.date, 'EEEE d', { locale: es })}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-bold mt-0.5 sm:mt-1">
                  {format(selectedSlot.date, 'MMMM yyyy', { locale: es })}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200">
                <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                  <Stethoscope size={10} className="sm:w-3 sm:h-3" />
                  Cirujano
                </div>
                <div className="text-sm sm:text-base font-black text-slate-900 break-words">
                  Dr. {currentRequest.doctors?.apellido || currentRequest.doctors?.nombre}
                </div>
              </div>
            </div>

            {/* Campo de Hora Fin con validación mejorada */}
            <div className="space-y-2">
              <label htmlFor="hora-fin" className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                Hora Fin *
              </label>
              <TimeInput
                id="hora-fin"
                value={horaFin}
                onChange={(e) => {
                  const nuevaHoraFin = e.target.value
                  // Validar que hora fin > hora inicio
                  if (selectedSlot && nuevaHoraFin && nuevaHoraFin.match(/^\d{2}:\d{2}$/)) {
                    const [horaInicioH, horaInicioM] = selectedSlot.time.split(':').map(Number)
                    const [horaFinH, horaFinM] = nuevaHoraFin.split(':').map(Number)
                    const minutosInicio = horaInicioH * 60 + horaInicioM
                    const minutosFin = horaFinH * 60 + horaFinM
                    
                    if (minutosFin <= minutosInicio) {
                      showError('La hora de fin debe ser mayor que la hora de inicio')
                      return
                    }
                  }
                  setHoraFin(nuevaHoraFin)
                }}
                min={selectedSlot ? selectedSlot.time : undefined}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl py-3 sm:py-3.5 px-4 sm:px-5 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 text-base touch-manipulation"
                required
                aria-required="true"
                aria-label="Hora de fin de la cirugía"
              />
              {selectedSlot && horaFin && (() => {
                const [horaInicioH, horaInicioM] = selectedSlot.time.split(':').map(Number)
                const [horaFinH, horaFinM] = horaFin.split(':').map(Number)
                const minutosInicio = horaInicioH * 60 + horaInicioM
                const minutosFin = horaFinH * 60 + horaFinM
                const esValido = minutosFin > minutosInicio
                return !esValido ? (
                  <p className="mt-2 text-xs sm:text-sm text-red-600 font-bold" role="alert">
                    La hora de fin debe ser mayor que {selectedSlot.time}
                  </p>
                ) : (
                  <p className="mt-2 text-xs sm:text-sm text-green-600 font-bold">
                    ✓ Duración: {Math.round((minutosFin - minutosInicio) / 60)} horas
                  </p>
                )
              })()}
            </div>

            {/* Botones de acción - Responsive */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-slate-200">
              <Button
                variant="secondary"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 w-full sm:w-auto touch-manipulation"
                disabled={programarCirugia.isPending || reagendarCirugia.isPending}
              >
                Cancelar
              </Button>
              <Button
                loading={programarCirugia.isPending || reagendarCirugia.isPending}
                onClick={handleConfirmarCupo}
                disabled={!horaFin || programarCirugia.isPending || reagendarCirugia.isPending}
                className="flex-1 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white touch-manipulation"
              >
                {cirugiaAReagendar ? 'Confirmar Reagendamiento' : 'Confirmar Agendamiento'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Detalles del Slot */}
      <Modal
        isOpen={showDetallesModal}
        onClose={() => {
          setShowDetallesModal(false)
          setSlotDetalle(null)
        }}
        title={slotDetalle?.type === 'occupied' ? 'Detalles de Cirugía' : 'Detalles del Horario'}
      >
        {slotDetalle && (
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            {slotDetalle.type === 'occupied' && slotDetalle.data ? (
              <>
                {/* Información del Paciente */}
                <div className="flex items-center gap-3 sm:gap-4 md:gap-5 p-3 sm:p-4 md:p-5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-lg sm:text-xl md:text-2xl shadow-lg bg-red-600 flex-shrink-0">
                    {slotDetalle.data.patients?.nombre?.charAt(0).toUpperCase() || 'P'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                      Paciente
                    </div>
                    <div className="font-black text-slate-800 text-sm sm:text-base md:text-lg uppercase leading-none break-words">
                      {slotDetalle.data.patients?.nombre || 'N/A'} {slotDetalle.data.patients?.apellido || ''}
                    </div>
                    {slotDetalle.data.patients?.rut && (
                      <div className="text-[10px] sm:text-xs text-slate-500 font-bold mt-0.5 sm:mt-1">
                        RUT: {slotDetalle.data.patients.rut}
                      </div>
                    )}
                  </div>
                </div>

                {/* Información del Doctor */}
                <div className="flex items-center gap-3 sm:gap-4 md:gap-5 p-3 sm:p-4 md:p-5 bg-blue-50 rounded-xl sm:rounded-2xl border border-blue-100">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-lg bg-blue-600 flex-shrink-0">
                    <Stethoscope size={18} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[8px] sm:text-[9px] font-black text-blue-400 uppercase tracking-widest mb-0.5">
                      Cirujano
                    </div>
                    <div className="font-black text-slate-800 text-sm sm:text-base md:text-lg uppercase leading-none break-words">
                      Dr. {slotDetalle.data.doctors?.apellido || slotDetalle.data.doctors?.nombre || 'General'}
                    </div>
                    {slotDetalle.data.doctors?.especialidad && (
                      <div className="text-[10px] sm:text-xs text-slate-500 font-bold mt-0.5 sm:mt-1">
                        {slotDetalle.data.doctors.especialidad}
                      </div>
                    )}
                  </div>
                </div>

                {/* Información del Procedimiento */}
                {(() => {
                  const codigoOperacion = slotDetalle.data.surgery_requests?.codigo_operacion || slotDetalle.data.codigo_operacion
                  if (!codigoOperacion) return null
                  const codigoObj = codigosOperaciones.find(c => c.codigo === codigoOperacion)
                  return (
                    <div className="p-3 sm:p-4 md:p-5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100">
                      <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2">
                        Procedimiento
                      </div>
                      <div className="font-black text-slate-800 text-sm sm:text-base break-words">
                        {codigoObj?.nombre || codigoOperacion}
                      </div>
                      <div className="text-[10px] sm:text-xs text-slate-500 font-bold mt-0.5 sm:mt-1">
                        Código: {codigoOperacion}
                      </div>
                    </div>
                  )
                })()}

                {/* Información del Horario y Pabellón */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 md:p-5 bg-white rounded-xl sm:rounded-2xl border border-slate-100">
                    <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1">
                      <Clock size={9} className="sm:w-2.5 sm:h-2.5" /> Horario
                    </div>
                    <div className="font-black text-slate-800 text-sm sm:text-base">
                      {slotDetalle.data.hora_inicio?.substring(0, 5)} - {slotDetalle.data.hora_fin?.substring(0, 5)}
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 md:p-5 bg-white rounded-xl sm:rounded-2xl border border-slate-100">
                    <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1">
                      <CalendarIcon size={9} className="sm:w-2.5 sm:h-2.5" /> Pabellón
                    </div>
                    <div className="font-black text-slate-800 text-sm sm:text-base break-words">
                      {slotDetalle.pabellon}
                    </div>
                  </div>
                </div>

                {/* Fecha */}
                <div className="p-3 sm:p-4 md:p-5 bg-white rounded-xl sm:rounded-2xl border border-slate-100">
                  <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1">
                    <CalendarIcon size={9} className="sm:w-2.5 sm:h-2.5" /> Fecha
                  </div>
                  <div className="font-black text-slate-800 text-sm sm:text-base break-words">
                    {format(slotDetalle.date, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
                  </div>
                </div>

                {/* Observaciones si existen */}
                {slotDetalle.data.observaciones && (
                  <div className="p-3 sm:p-4 md:p-5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100">
                    <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2">
                      Observaciones
                    </div>
                    <div className="text-xs sm:text-sm text-slate-700 break-words">
                      {slotDetalle.data.observaciones}
                    </div>
                  </div>
                )}

                {/* Estado */}
                <div className="p-3 sm:p-4 md:p-5 bg-white rounded-xl sm:rounded-2xl border border-slate-100">
                  <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2">
                    Estado
                  </div>
                  <div className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full font-bold text-[10px] sm:text-xs ${
                    slotDetalle.data.estado === 'programada' ? 'bg-green-100 text-green-700' :
                    slotDetalle.data.estado === 'en_proceso' ? 'bg-yellow-100 text-yellow-700' :
                    slotDetalle.data.estado === 'cancelada' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    <CheckCircle2 size={10} className="sm:w-3 sm:h-3" />
                    {slotDetalle.data.estado === 'programada' ? 'Programada' : slotDetalle.data.estado === 'en_proceso' ? 'En Proceso' : slotDetalle.data.estado}
                  </div>
                </div>

                {/* Botón Cancelar si está programada y no es día pasado */}
                {slotDetalle.data.estado === 'programada' && slotDetalle.date && !isPast(startOfDay(slotDetalle.date)) && (
                  <div className="p-3 sm:p-4 md:p-5 bg-white rounded-xl sm:rounded-2xl border border-slate-100">
                    <button
                      onClick={() => {
                        setSlotDetalle({ ...slotDetalle, action: 'cancel' })
                        setShowDetallesModal(false)
                        setShowConfirmCancelar(true)
                        setCirugiaACancelar(slotDetalle.data)
                      }}
                      className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl transition-colors flex items-center justify-center gap-2 touch-manipulation"
                    >
                      <XCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                      Cancelar Cirugía
                    </button>
                  </div>
                )}
                
                {/* Mensaje informativo si es día pasado */}
                {slotDetalle.date && isPast(startOfDay(slotDetalle.date)) && (
                  <div className="p-3 sm:p-4 md:p-5 bg-blue-50 rounded-xl sm:rounded-2xl border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Info size={16} className="sm:w-5 sm:h-5" />
                      <p className="text-xs sm:text-sm font-bold">
                        Esta cirugía pertenece a un día histórico. Solo se puede consultar información.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : slotDetalle.type === 'available' ? (
              <>
                {/* Información del Slot Disponible */}
                <div className="flex items-center gap-3 sm:gap-4 md:gap-5 p-3 sm:p-4 md:p-5 bg-green-50 rounded-xl sm:rounded-2xl border border-green-100">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-lg bg-green-600 flex-shrink-0">
                    <CheckCircle2 size={24} className="sm:w-8 sm:h-8" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[8px] sm:text-[9px] font-black text-green-400 uppercase tracking-widest mb-0.5">
                      Horario Disponible
                    </div>
                    <div className="font-black text-slate-800 text-sm sm:text-base md:text-lg uppercase leading-none break-words">
                      {slotDetalle.pabellon}
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-500 font-bold mt-0.5 sm:mt-1">
                      {slotDetalle.time}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 md:p-5 bg-white rounded-xl sm:rounded-2xl border border-slate-100">
                    <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1">
                      <Clock size={9} className="sm:w-2.5 sm:h-2.5" /> Hora
                    </div>
                    <div className="font-black text-slate-800 text-sm sm:text-base">
                      {slotDetalle.time}
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 md:p-5 bg-white rounded-xl sm:rounded-2xl border border-slate-100">
                    <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1">
                      <CalendarIcon size={9} className="sm:w-2.5 sm:h-2.5" /> Fecha
                    </div>
                    <div className="font-black text-slate-800 text-sm sm:text-base break-words">
                      {format(slotDetalle.date, "EEEE d 'de' MMMM", { locale: es })}
                    </div>
                  </div>
                </div>

                <div className="p-3 sm:p-4 md:p-5 bg-blue-50 rounded-xl sm:rounded-2xl border border-blue-100">
                  <div className="text-[8px] sm:text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1">
                    <Info size={9} className="sm:w-2.5 sm:h-2.5" /> Información
                  </div>
                  <div className="text-xs sm:text-sm text-slate-700 break-words">
                    Este horario está disponible para agendar una nueva cirugía. Para proceder con el agendamiento, primero debe seleccionar una solicitud desde la bandeja de solicitudes.
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </Modal>

      {/* Modal de Confirmación para Cancelar Cirugía (Pabellón) */}
      <Modal
        isOpen={showConfirmCancelar}
        onClose={() => {
          setShowConfirmCancelar(false)
          setCirugiaACancelar(null)
        }}
        title="Confirmar Cancelación"
      >
        {cirugiaACancelar && (
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-red-50 rounded-lg sm:rounded-xl border border-red-200">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-base text-slate-900 font-bold mb-2">
                  ¿Está seguro de que desea cancelar esta cirugía?
                </p>
                <div className="text-xs sm:text-sm text-slate-700 space-y-1">
                  <p><span className="font-bold">Paciente:</span> {cirugiaACancelar.patients?.nombre} {cirugiaACancelar.patients?.apellido}</p>
                  <p><span className="font-bold">Doctor:</span> Dr. {cirugiaACancelar.doctors?.apellido || cirugiaACancelar.doctors?.nombre}</p>
                  <p><span className="font-bold">Fecha:</span> {format(new Date(cirugiaACancelar.fecha), 'dd/MM/yyyy')}</p>
                  <p><span className="font-bold">Horario:</span> {cirugiaACancelar.hora_inicio?.substring(0, 5)} - {cirugiaACancelar.hora_fin?.substring(0, 5)}</p>
                  <p><span className="font-bold">Pabellón:</span> {slotDetalle?.pabellon || 'N/A'}</p>
                </div>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Esta acción no se puede deshacer. El doctor será notificado automáticamente de la cancelación.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowConfirmCancelar(false)
                  setCirugiaACancelar(null)
                }}
                disabled={cancelarCirugia.isPending}
                className="w-full sm:w-auto touch-manipulation"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarCancelar}
                loading={cancelarCirugia.isPending}
                disabled={cancelarCirugia.isPending}
                className="bg-red-600 hover:bg-red-700 w-full sm:w-auto touch-manipulation"
              >
                Confirmar Cancelación
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
