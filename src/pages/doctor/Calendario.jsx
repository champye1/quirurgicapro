import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../config/supabase'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info, XCircle } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
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
  isSameMonth,
  getWeek,
  eachDayOfInterval,
} from 'date-fns'
import { es } from 'date-fns/locale'

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

// Componente Breadcrumbs
const Breadcrumbs = ({ anio, view, selectedMonth, selectedWeek, selectedDay, onNavigate }) => {
  const monthName = selectedMonth !== null ? MESES[selectedMonth].nombre : ''
  const weekNumber = selectedWeek ? getWeek(selectedWeek, { weekStartsOn: 1 }) - getWeek(startOfMonth(selectedWeek), { weekStartsOn: 1 }) + 1 : ''
  
  return (
    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">
      <button 
        onClick={() => onNavigate('year')} 
        className={`hover:text-blue-600 ${view === 'year' ? 'text-slate-900' : ''}`}
      >
        Calendario {anio}
      </button>
      
      {(view === 'month' || view === 'week' || view === 'day') && (
        <>
          <span className="text-slate-300">/</span>
          <button 
            onClick={() => onNavigate('month')}
            className={`hover:text-blue-600 ${view === 'month' ? 'text-slate-900' : ''}`}
          >
            {monthName}
          </button>
        </>
      )}
      
      {(view === 'week' || view === 'day') && (
        <>
          <span className="text-slate-300">/</span>
          <button 
            onClick={() => onNavigate('week')}
            className={`hover:text-blue-600 ${view === 'week' ? 'text-slate-900' : ''}`}
          >
            Semana {weekNumber}
          </button>
        </>
      )}

      {view === 'day' && selectedDay && (
        <>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900">
            {format(selectedDay, 'EEEE d', { locale: es })}
          </span>
        </>
      )}
    </div>
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
          <Info className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-black text-blue-900 uppercase tracking-wide">Mis Cirugías Programadas</h3>
          <p className="text-xs font-medium text-blue-600 mt-1">Semanas disponibles para {MESES[monthIndex].nombre}.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {weeks.map((weekStart, idx) => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
          const isCurrentMonth = isSameMonth(weekStart, new Date(anio, monthIndex)) || isSameMonth(weekEnd, new Date(anio, monthIndex))
          
          if (!isCurrentMonth) return null

          // Calcular número de semana relativo al mes
          const weekNum = idx + 1 

          return (
            <button
              key={weekStart.toISOString()}
              onClick={() => onWeekClick(weekStart)}
              className="w-full bg-white border border-slate-100 rounded-3xl p-6 flex items-center justify-between hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                  <CalendarIcon className="w-6 h-6 text-slate-400 group-hover:text-blue-600" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Semana {weekNum}
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
                    Del {format(weekStart, 'd', { locale: es })} al {format(weekEnd, 'd', { locale: es })} de {MESES[monthIndex].nombre}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Componente WeekView (Grilla de Días)
const WeekView = ({ weekStart, cirugias, onDayClick, pabellones: _pabellones }) => {
  const days = useMemo(() => {
    return eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 6) // Lunes a Domingo
    })
  }, [weekStart])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 justify-items-center">
      {days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd')
        const cirugiasDia = cirugias.filter(c => c.fecha === dayStr)
        
        return (
          <div key={day.toISOString()} className="bg-white rounded-[2rem] border border-slate-100 p-6 flex flex-col h-full w-full max-w-[400px]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase whitespace-nowrap">
                  {format(day, 'EEEE', { locale: es })}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  {format(day, 'd MMMM', { locale: es })}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                cirugiasDia.length > 0 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {cirugiasDia.length > 0 ? `${cirugiasDia.length} Cirugía${cirugiasDia.length > 1 ? 's' : ''}` : 'Disponible'}
              </span>
            </div>

            <div className="space-y-4 flex-1">
              {cirugiasDia.length > 0 ? (
                cirugiasDia.map(cirugia => (
                  <div key={cirugia.id} className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-blue-900 uppercase tracking-wider">
                        {cirugia.hora_inicio} - {cirugia.hora_fin}
                      </span>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                        cirugia.estado === 'programada' ? 'bg-blue-100 text-blue-800' :
                        cirugia.estado === 'en_proceso' ? 'bg-yellow-100 text-yellow-800' :
                        cirugia.estado === 'completada' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {cirugia.estado}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 mb-1">
                      {cirugia.patients?.nombre} {cirugia.patients?.apellido}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {cirugia.operating_rooms?.nombre}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  No hay cirugías programadas
                </p>
              )}
            </div>

            <button
              onClick={() => onDayClick(day)}
              className="mt-6 w-full py-3 rounded-xl bg-slate-50 text-slate-600 text-xs font-black uppercase tracking-wider hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              Ver Detalles
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Componente DayView (Slots Horarios)
const DayView = ({ day, pabellones, cirugias, onCancelarClick }) => {
  // Generar slots de 08:00 a 20:00 cada 1 hora (simplificado)
  const slots = useMemo(() => {
    const hours = []
    for (let i = 8; i < 20; i++) {
      hours.push(`${i.toString().padStart(2, '0')}:00`)
    }
    return hours
  }, [])

  const dayStr = format(day, 'yyyy-MM-dd')
  const cirugiasDia = cirugias.filter(c => c.fecha === dayStr)

  const getSlotStatus = (pabellonId, time) => {
    const cirugia = cirugiasDia.find(c => 
      c.operating_room_id === pabellonId && 
      c.hora_inicio <= time + ':00' && c.hora_fin > time + ':00'
    )
    
    if (cirugia) return { status: 'occupied', data: cirugia }
    return { status: 'available' }
  }

  return (
    <div className="flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sidebar Izquierdo - Info */}
      <div className="w-80 flex-shrink-0 space-y-6">
        <div className="bg-[#0f172a] rounded-[2rem] p-6 text-white overflow-hidden relative">
          <div className="relative z-10">
             <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-70 mb-1">Mis Cirugías</h3>
             <p className="text-sm font-medium opacity-50">Vista detallada del día</p>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-[60px] opacity-20 transform translate-x-10 -translate-y-10" />
        </div>

        {/* Lista de cirugías del día */}
        {cirugiasDia.length > 0 ? (
          <div className="bg-white rounded-[2rem] border border-slate-100 p-6 space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
              Cirugías Programadas
            </h4>
            {cirugiasDia.map(cirugia => (
              <div key={cirugia.id} className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-blue-900 uppercase tracking-wider">
                    {cirugia.hora_inicio} - {cirugia.hora_fin}
                  </span>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    cirugia.estado === 'programada' ? 'bg-blue-100 text-blue-800' :
                    cirugia.estado === 'en_proceso' ? 'bg-yellow-100 text-yellow-800' :
                    cirugia.estado === 'completada' ? 'bg-green-100 text-green-800' :
                    cirugia.estado === 'cancelada' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {cirugia.estado}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900 mb-1">
                  {cirugia.patients?.nombre} {cirugia.patients?.apellido}
                </p>
                <p className="text-xs text-slate-600 mb-2">
                  RUT: {cirugia.patients?.rut}
                </p>
                <p className="text-xs font-bold text-blue-600">
                  {cirugia.operating_rooms?.nombre}
                </p>
                {cirugia.observaciones && (
                  <p className="text-xs text-slate-500 mt-2 italic">
                    {cirugia.observaciones}
                  </p>
                )}
                {cirugia.estado === 'programada' && (
                  <button
                    onClick={() => onCancelarClick(cirugia)}
                    className="mt-3 w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancelar Cirugía
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-slate-100 p-6 text-center">
            <p className="text-xs text-slate-400">No hay cirugías programadas para este día</p>
          </div>
        )}

        <div className="bg-white rounded-[2rem] border border-slate-100 p-6">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
             <span className="w-4 h-4 rounded-md bg-blue-50 flex items-center justify-center text-blue-500 text-xs">?</span>
             Leyenda
           </h4>
           <div className="space-y-3">
             <div className="flex items-center gap-3">
               <div className="w-3 h-3 rounded-full border-2 border-slate-200" />
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Disponible</span>
             </div>
             <div className="flex items-center gap-3">
               <div className="w-3 h-3 rounded-full bg-blue-50 border-2 border-blue-100" />
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mi Cirugía</span>
             </div>
           </div>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm overflow-hidden relative">
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: `3rem repeat(${pabellones.length}, 1fr)` }}>
          <div className="w-12" /> {/* Espaciador hora */}
          {pabellones.map(p => (
            <div key={p.id} className="text-center">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">{p.nombre}</h4>
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                {cirugiasDia.filter(c => c.operating_room_id === p.id).length} Cirugía{cirugiasDia.filter(c => c.operating_room_id === p.id).length !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {slots.map(time => (
            <div key={time} className="grid gap-4 items-center group" style={{ gridTemplateColumns: `3rem repeat(${pabellones.length}, 1fr)` }}>
              <span className="w-12 text-[10px] font-bold text-slate-400 text-right">{time}</span>
              {pabellones.map(p => {
                const { status, data } = getSlotStatus(p.id, time)
                
                if (status === 'occupied') {
                   return (
                     <div key={p.id} className="h-16 rounded-2xl bg-blue-50 border border-blue-200 p-3 flex flex-col justify-center">
                       <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-1">Mi Cirugía</span>
                       <span className="text-xs font-bold text-blue-900 truncate">
                         {data.patients?.nombre} {data.patients?.apellido}
                       </span>
                     </div>
                   )
                }

                return (
                  <div
                    key={p.id}
                    className="h-16 rounded-2xl border-2 border-dashed border-slate-100"
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Calendario() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useNotifications()
  const [anio, setAnio] = useState(new Date().getFullYear())
  
  // Estados de navegación
  const [view, setView] = useState('year') // year, month, week, day
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  
  // Estados para cancelación
  const [showConfirmCancelar, setShowConfirmCancelar] = useState(false)
  const [cirugiaACancelar, setCirugiaACancelar] = useState(null)

  // Obtener doctor actual
  const { data: doctor } = useQuery({
    queryKey: ['doctor-actual'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .single()
      
      if (error) throw error
      return data
    },
  })

  const inicioAnio = startOfYear(new Date(anio, 0, 1))
  const finAnio = endOfYear(new Date(anio, 0, 1))

  const fechaInicioStr = inicioAnio.toISOString().slice(0, 10)
  const fechaFinStr = finAnio.toISOString().slice(0, 10)

  const { data: cirugias = [], isLoading: loadingCirugias } = useQuery({
    queryKey: ['calendario-doctor-cirugias', anio, doctor?.id],
    queryFn: async () => {
      if (!doctor) return []

      const { data, error } = await supabase
        .from('surgeries')
        .select(`
          id, 
          fecha, 
          operating_room_id, 
          hora_inicio, 
          hora_fin,
          estado,
          observaciones,
          patients:patient_id(
            nombre,
            apellido,
            rut
          ),
          operating_rooms:operating_room_id(
            nombre
          )
        `)
        .eq('doctor_id', doctor.id)
        .gte('fecha', fechaInicioStr)
        .lte('fecha', fechaFinStr)
        .is('deleted_at', null)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!doctor,
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

  // Mutation para cancelar cirugía
  const cancelarCirugia = useMutation({
    mutationFn: async (cirugiaId) => {
      const { error } = await supabase
        .from('surgeries')
        .update({ 
          estado: 'cancelada',
          updated_at: new Date().toISOString()
        })
        .eq('id', cirugiaId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['calendario-doctor-cirugias'])
      queryClient.invalidateQueries(['cirugias-dia-detalle'])
      showSuccess('Cirugía cancelada exitosamente')
      setShowConfirmCancelar(false)
      setCirugiaACancelar(null)
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

  const handleCancelarClick = (cirugia) => {
    setCirugiaACancelar(cirugia)
    setShowConfirmCancelar(true)
  }

  const confirmarCancelar = () => {
    if (cirugiaACancelar) {
      cancelarCirugia.mutate(cirugiaACancelar.id)
    }
  }

  const statsMeses = useMemo(() => {
    return MESES.map((mes) => {
      const inicioMes = new Date(anio, mes.indice, 1)
      const finMes = endOfMonth(inicioMes)

      const cirugiasMes = cirugias.filter((c) => {
        const fechaCirugia = new Date(c.fecha)
        return isWithinInterval(fechaCirugia, { start: inicioMes, end: finMes })
      })

      const totalDias = finMes.getDate()
      const diasConCirugias = new Set(cirugiasMes.map(c => c.fecha)).size
      const porcentajeOcupado = Math.round((diasConCirugias / totalDias) * 100)

      return {
        ...mes,
        cirugiasEstimadas: cirugiasMes.length,
        porcentajeOcupado,
        porcentajeLibre: 100 - porcentajeOcupado,
      }
    })
  }, [anio, cirugias])

  const cargando = loadingCirugias || !doctor

  const handleNavigate = (targetView) => {
    if (targetView === 'year') {
      setView('year')
      setSelectedMonth(null)
      setSelectedWeek(null)
      setSelectedDay(null)
    } else if (targetView === 'month') {
      setView('month')
      setSelectedWeek(null)
      setSelectedDay(null)
    } else if (targetView === 'week') {
      setView('week')
      setSelectedDay(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header General */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
           {/* Selector de año solo visible en vista anual */}
           {view === 'year' && (
             <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2">
               <button
                 onClick={() => setAnio(anio - 1)}
                 className="p-1 rounded-lg hover:bg-slate-100"
               >
                 <ChevronLeft className="w-4 h-4 text-slate-400" />
               </button>
               <span className="text-sm font-bold text-slate-700">{anio}</span>
               <button
                 onClick={() => setAnio(anio + 1)}
                 className="p-1 rounded-lg hover:bg-slate-100"
               >
                 <ChevronRight className="w-4 h-4 text-slate-400" />
               </button>
             </div>
           )}
        </div>
      </div>

      {cargando ? (
        <div className="card flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400 text-sm font-bold animate-pulse">Cargando datos...</p>
        </div>
      ) : (
        <>
          {view === 'year' && (
            <>
               <div className="flex justify-end mb-4">
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>Con Cirugías</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-slate-300" />
                    <span>Libre</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {statsMeses.map((mes) => (
                  <button
                    key={mes.indice}
                    onClick={() => {
                      setSelectedMonth(mes.indice)
                      setView('month')
                    }}
                    className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 flex flex-col justify-between text-left hover:border-blue-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4 w-full">
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                          {mes.cirugiasEstimadas} cirugía{mes.cirugiasEstimadas !== 1 ? 's' : ''}
                        </p>
                        <h2 className="text-xl font-black text-slate-900 mt-1 group-hover:text-blue-600 transition-colors">{mes.nombre}</h2>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-blue-600">{mes.porcentajeOcupado}%</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          Ocupado
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 w-full">
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full flex">
                          {mes.porcentajeOcupado > 0 && (
                            <div
                              className="bg-blue-500"
                              style={{ width: `${mes.porcentajeOcupado}%` }}
                            />
                          )}
                          {mes.porcentajeLibre > 0 && (
                            <div
                              className="bg-slate-300"
                              style={{ width: `${mes.porcentajeLibre}%` }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 text-[11px] font-bold text-slate-500">
                        <span>{mes.porcentajeLibre}% libre</span>
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
              pabellones={pabellones}
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
              cirugias={cirugias}
              onCancelarClick={handleCancelarClick}
            />
          )}
        </>
      )}

      {/* Modal de Confirmación de Cancelación */}
      <Modal
        isOpen={showConfirmCancelar}
        onClose={() => {
          setShowConfirmCancelar(false)
          setCirugiaACancelar(null)
        }}
        title="Cancelar Cirugía"
      >
        {cirugiaACancelar && (
          <div className="space-y-6">
            <p className="text-slate-700">
              ¿Está seguro de que desea cancelar la cirugía programada para{' '}
              <span className="font-bold">
                {cirugiaACancelar.patients?.nombre} {cirugiaACancelar.patients?.apellido}
              </span>?
            </p>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <p className="text-sm text-slate-600">
                <span className="font-bold">Fecha:</span> {format(new Date(cirugiaACancelar.fecha), 'dd/MM/yyyy')}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-bold">Hora:</span> {cirugiaACancelar.hora_inicio} - {cirugiaACancelar.hora_fin}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-bold">Pabellón:</span> {cirugiaACancelar.operating_rooms?.nombre}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowConfirmCancelar(false)
                  setCirugiaACancelar(null)
                }}
                disabled={cancelarCirugia.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarCancelar}
                loading={cancelarCirugia.isPending}
                disabled={cancelarCirugia.isPending}
                className="bg-red-600 hover:bg-red-700"
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
