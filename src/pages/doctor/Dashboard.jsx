import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { Calendar, CheckCircle2, Clock, TrendingUp, Download, BarChart3 } from 'lucide-react'
import { format, addDays, eachDayOfInterval, startOfMonth, endOfMonth, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTheme } from '../../contexts/ThemeContext'
import { logger } from '../../utils/logger'

const descargarICS = (cirugias) => {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QuirúrgicaPro//ES',
    'CALSCALE:GREGORIAN',
  ]
  for (const c of cirugias) {
    const fecha = c.fecha?.replace(/-/g, '') // YYYYMMDD
    const hi = (c.hora_inicio || '08:00:00').replace(/:/g, '').slice(0, 6) // HHMMSS
    const hf = (c.hora_fin || '09:00:00').replace(/:/g, '').slice(0, 6)
    lineas.push(
      'BEGIN:VEVENT',
      `DTSTART;TZID=America/Santiago:${fecha}T${hi}`,
      `DTEND;TZID=America/Santiago:${fecha}T${hf}`,
      `SUMMARY:Cirugía programada`,
      `DESCRIPTION:Pabellón: ${c.operating_rooms?.nombre || ''}\\nEstado: ${c.estado || ''}`,
      `UID:cirugia-${c.id}@quirurgicapro`,
      'END:VEVENT',
    )
  }
  lineas.push('END:VCALENDAR')
  const blob = new Blob([lineas.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'cirugias-confirmadas.ics'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Dashboard() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { data: doctor, isLoading: loadingDoctor, isError: errorDoctor } = useQuery({
    queryKey: ['doctor-actual'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (error) throw error
      return data
    },
  })

  const { data: cirugiasHoy = [] } = useQuery({
    queryKey: ['cirugias-doctor-hoy'],
    queryFn: async () => {
      if (!doctor) return []

      const { data, error } = await supabase
        .from('surgeries')
        .select(`
          *,
          patients:patient_id(nombre, apellido, rut),
          operating_rooms:operating_room_id(nombre)
        `)
        .eq('doctor_id', doctor.id)
        .eq('fecha', format(new Date(), 'yyyy-MM-dd'))
        .is('deleted_at', null)
        .order('hora_inicio', { ascending: true })
        .limit(50)
      
      if (error) throw error
      return data
    },
    enabled: !!doctor,
  })

  const { data: solicitudesPendientes = [] } = useQuery({
    queryKey: ['solicitudes-doctor-pendientes'],
    queryFn: async () => {
      if (!doctor) return []

      const { data, error } = await supabase
        .from('surgery_requests')
        .select(`
          *,
          patients:patient_id(nombre, apellido)
        `)
        .eq('doctor_id', doctor.id)
        .eq('estado', 'pendiente')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!doctor,
  })

  const { data: cirugiasConfirmadas = [] } = useQuery({
    queryKey: ['cirugias-doctor-confirmadas'],
    queryFn: async () => {
      if (!doctor) return []

      const { data, error } = await supabase
        .from('surgeries')
        .select(`
          *,
          patients:patient_id(nombre, apellido),
          operating_rooms:operating_room_id(nombre)
        `)
        .eq('doctor_id', doctor.id)
        .gte('fecha', format(new Date(), 'yyyy-MM-dd'))
        .is('deleted_at', null)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!doctor,
  })

  const { data: proximasCirugias14d = [] } = useQuery({
    queryKey: ['cirugias-doctor-proximas-14d'],
    queryFn: async () => {
      if (!doctor) return []
      const desde = format(new Date(), 'yyyy-MM-dd')
      const hasta = format(addDays(new Date(), 13), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('surgeries')
        .select('id, fecha, hora_inicio, hora_fin, estado, patients:patient_id(nombre, apellido), operating_rooms:operating_room_id(nombre)')
        .eq('doctor_id', doctor.id)
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .is('deleted_at', null)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!doctor,
  })

  const { data: recordatorios = [] } = useQuery({
    queryKey: ['recordatorios-doctor'],
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
      
      if (error) {
        logger.errorWithContext('Error al obtener recordatorios', error)
        return []
      }
      return data || []
    },
  })

  const { data: cirugiasAceptadas = [] } = useQuery({
    queryKey: ['cirugias-aceptadas-doctor'],
    queryFn: async () => {
      if (!doctor) return []

      const { data, error } = await supabase
        .from('surgeries')
        .select(`
          *,
          patients:patient_id(nombre, apellido, rut),
          operating_rooms:operating_room_id(nombre),
          surgery_requests:surgery_request_id(codigo_operacion)
        `)
        .eq('doctor_id', doctor.id)
        .gte('fecha', format(new Date(), 'yyyy-MM-dd'))
        .is('deleted_at', null)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .limit(5)
      
      if (error) throw error
      return data
    },
    enabled: !!doctor,
  })

  const { data: solicitudesMes = [] } = useQuery({
    queryKey: ['solicitudes-doctor-mes', doctor?.id],
    queryFn: async () => {
      if (!doctor) return []
      const inicio = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const fin = format(endOfMonth(new Date()), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('surgery_requests')
        .select('id, estado, created_at, updated_at')
        .eq('doctor_id', doctor.id)
        .gte('created_at', inicio)
        .lte('created_at', fin + 'T23:59:59')
        .is('deleted_at', null)
      if (error) throw error
      return data || []
    },
    enabled: !!doctor,
  })

  const { data: statsHistoricas } = useQuery({
    queryKey: ['stats-historicas-doctor', doctor?.id],
    queryFn: async () => {
      if (!doctor) return null
      const [{ data: todasSolicitudes }, { data: cirugiasCompletadas }] = await Promise.all([
        supabase
          .from('surgery_requests')
          .select('id, estado')
          .eq('doctor_id', doctor.id)
          .is('deleted_at', null),
        supabase
          .from('surgeries')
          .select('id, fecha')
          .eq('doctor_id', doctor.id)
          .eq('estado', 'completada')
          .is('deleted_at', null),
      ])
      const total = todasSolicitudes?.length || 0
      const completadas = todasSolicitudes?.filter(s => ['aceptada', 'programada'].includes(s.estado)).length || 0
      const rechazadas = todasSolicitudes?.filter(s => s.estado === 'rechazada').length || 0
      const tasa = total > 0 ? Math.round((completadas / total) * 100) : null
      return {
        totalSolicitudes: total,
        solicitudesAceptadas: completadas,
        solicitudesRechazadas: rechazadas,
        tasaAceptacion: tasa,
        cirugiasCompletadas: cirugiasCompletadas?.length || 0,
      }
    },
    enabled: !!doctor,
  })

  const statsMes = useMemo(() => {
    const total = solicitudesMes.length
    const aceptadas = solicitudesMes.filter(s => ['aceptada', 'programada'].includes(s.estado)).length
    const rechazadas = solicitudesMes.filter(s => s.estado === 'rechazada').length
    const tasaAceptacion = total > 0 ? Math.round((aceptadas / total) * 100) : null
    const tiemposEspera = solicitudesMes
      .filter(s => ['aceptada', 'programada'].includes(s.estado) && s.updated_at)
      .map(s => differenceInDays(new Date(s.updated_at), new Date(s.created_at)))
      .filter(d => d >= 0)
    const promedioEspera = tiemposEspera.length > 0
      ? Math.round(tiemposEspera.reduce((a, b) => a + b, 0) / tiemposEspera.length)
      : null
    return { total, aceptadas, rechazadas, tasaAceptacion, promedioEspera }
  }, [solicitudesMes])

  const semanaActual = useMemo(() => {
    return eachDayOfInterval({ start: new Date(), end: addDays(new Date(), 6) }).map(dia => {
      const fechaStr = format(dia, 'yyyy-MM-dd')
      const cirugiasDia = proximasCirugias14d.filter(c => c.fecha === fechaStr)
      return { dia, fechaStr, cirugias: cirugiasDia }
    })
  }, [proximasCirugias14d])

  if (loadingDoctor) {
    return <div className="text-center py-8">Cargando...</div>
  }
  if (errorDoctor || !doctor) {
    return (
      <div className="text-center py-8">
        <p className={theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}>
          {errorDoctor ? 'Error al cargar el perfil.' : 'No se encontró perfil de doctor. Contacte al administrador.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Bienvenido, Dr. {doctor.nombre} {doctor.apellido}
        </h1>
        <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Cirugías Hoy</p>
              <p className={`text-3xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {cirugiasHoy.length}
              </p>
            </div>
            <div className={theme === 'dark' ? 'bg-blue-900/50 p-3 rounded-full' : 'bg-blue-100 p-3 rounded-full'}>
              <Calendar className={`w-8 h-8 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Solicitudes Pendientes</p>
              <p className={`text-3xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {solicitudesPendientes.length}
              </p>
            </div>
            <div className={theme === 'dark' ? 'bg-yellow-900/50 p-3 rounded-full' : 'bg-yellow-100 p-3 rounded-full'}>
              <Clock className={`w-8 h-8 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Cirugías Confirmadas</p>
              <p className={`text-3xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {cirugiasConfirmadas.length}
              </p>
            </div>
            <div className={theme === 'dark' ? 'bg-green-900/50 p-3 rounded-full' : 'bg-green-100 p-3 rounded-full'}>
              <CheckCircle2 className={`w-8 h-8 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Este Mes</p>
              <p className={`text-3xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {statsMes.total}
              </p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                {statsMes.tasaAceptacion !== null ? `${statsMes.tasaAceptacion}% aceptadas` : 'sin solicitudes'}
                {statsMes.promedioEspera !== null && ` · ${statsMes.promedioEspera}d espera`}
              </p>
            </div>
            <div className={theme === 'dark' ? 'bg-purple-900/50 p-3 rounded-full' : 'bg-purple-100 p-3 rounded-full'}>
              <TrendingUp className={`w-8 h-8 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Resumen semanal */}
      <div className={`card ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}`}>
        <h2 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Próximos 7 días
        </h2>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {semanaActual.map(({ dia, cirugias }) => {
            const esHoy = format(dia, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            return (
              <div key={dia.toISOString()} className={`flex flex-col items-center rounded-xl p-1.5 sm:p-2 text-center ${
                esHoy
                  ? (theme === 'dark' ? 'bg-blue-800/60 ring-1 ring-blue-500' : 'bg-blue-50 ring-1 ring-blue-400')
                  : (theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-50')
              }`}>
                <span className={`text-[10px] font-bold uppercase ${
                  esHoy
                    ? (theme === 'dark' ? 'text-blue-300' : 'text-blue-600')
                    : (theme === 'dark' ? 'text-slate-400' : 'text-slate-400')
                }`}>
                  {format(dia, 'EEE', { locale: es })}
                </span>
                <span className={`text-base sm:text-lg font-black mt-0.5 ${
                  esHoy
                    ? (theme === 'dark' ? 'text-white' : 'text-blue-700')
                    : (theme === 'dark' ? 'text-slate-200' : 'text-slate-700')
                }`}>
                  {format(dia, 'd')}
                </span>
                {cirugias.length > 0 ? (
                  <span className={`mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                  }`}>
                    {cirugias.length}
                  </span>
                ) : (
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-300" />
                )}
              </div>
            )
          })}
        </div>
        {proximasCirugias14d.filter(c => c.fecha > format(new Date(), 'yyyy-MM-dd')).length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              {proximasCirugias14d.length} cirugía{proximasCirugias14d.length !== 1 ? 's' : ''} en los próximos 14 días
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cirugías de hoy */}
        <div className="card">
          <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Cirugías de Hoy</h2>
          <div className="space-y-3">
            {cirugiasHoy.length === 0 ? (
              <p className={`text-center py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>No hay cirugías programadas para hoy</p>
            ) : (
              cirugiasHoy.map(cirugia => (
                <div 
                  key={cirugia.id} 
                  className={`border rounded-lg p-4 transition-colors ${
                    theme === 'dark' 
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' 
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {cirugia.patients?.nombre} {cirugia.patients?.apellido}
                      </p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-gray-600'}`}>
                        {cirugia.operating_rooms?.nombre} - {cirugia.hora_inicio}
                      </p>
                      <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>
                        Estado: {cirugia.estado}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${
                      theme === 'dark' ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
                    }`}>
                      Confirmada
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Muro de Recordatorios */}
        <div className="card">
          <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Muro de Recordatorios</h2>
          <div className="space-y-3">
            {recordatorios.length === 0 && cirugiasAceptadas.length === 0 ? (
              <p className={`text-center py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>No hay recordatorios nuevos</p>
            ) : (
              <>
                {/* Operaciones Aceptadas */}
                {cirugiasAceptadas.map(cirugia => (
                  <div 
                    key={cirugia.id} 
                    className={`border rounded-lg p-4 transition-colors ${
                      theme === 'dark' 
                        ? 'bg-green-900/30 border-green-700 hover:bg-green-900/50' 
                        : 'bg-green-50 border-green-200 hover:bg-green-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`font-medium ${theme === 'dark' ? 'text-green-200' : 'text-green-800'}`}>Operación Aceptada</p>
                        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-100' : 'text-gray-700'}`}>
                          {cirugia.patients?.nombre} {cirugia.patients?.apellido}
                        </p>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-gray-600'}`}>
                          {format(new Date(cirugia.fecha), 'dd/MM/yyyy')} a las {typeof cirugia.hora_inicio === 'string' ? cirugia.hora_inicio.substring(0, 5) : cirugia.hora_inicio}
                        </p>
                        {cirugia.estado_hora === 'reagendado' && cirugia.fecha_anterior && (
                          <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
                            Fecha original (ya no aplica): {format(new Date(cirugia.fecha_anterior), 'dd/MM/yyyy')} a las {typeof cirugia.hora_inicio_anterior === 'string' ? cirugia.hora_inicio_anterior.substring(0, 5) : cirugia.hora_inicio_anterior}
                          </p>
                        )}
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-gray-600'}`}>
                          Pabellón: {cirugia.operating_rooms?.nombre}
                        </p>
                        <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>
                          Código: {cirugia.surgery_requests?.codigo_operacion}
                        </p>
                      </div>
                      <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ml-2 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                    </div>
                  </div>
                ))}
                
                {/* Recordatorios Generales */}
                {recordatorios.filter(r => r.tipo !== 'operacion_aceptada').map(recordatorio => (
                  <div 
                    key={recordatorio.id} 
                    className={`border rounded-lg p-4 transition-colors ${
                      theme === 'dark' 
                        ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' 
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{recordatorio.titulo}</p>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-600'}`}>{recordatorio.contenido}</p>
                    {recordatorio.relacionado_con && (
                      <button
                        onClick={() => navigate('/doctor/calendario')}
                        className="text-xs text-blue-600 hover:underline mt-1 block"
                      >
                        Ver en calendario →
                      </button>
                    )}
                    <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`}>
                      {format(new Date(recordatorio.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Estadísticas históricas */}
      {statsHistoricas && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
            <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Estadísticas Históricas</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total solicitudes', value: statsHistoricas.totalSolicitudes, color: theme === 'dark' ? 'text-white' : 'text-gray-900' },
              { label: 'Aceptadas', value: statsHistoricas.solicitudesAceptadas, color: 'text-blue-600' },
              { label: 'Rechazadas', value: statsHistoricas.solicitudesRechazadas, color: 'text-red-500' },
              { label: 'Tasa aceptación', value: statsHistoricas.tasaAceptacion != null ? `${statsHistoricas.tasaAceptacion}%` : '—', color: 'text-emerald-600' },
              { label: 'Cirugías completadas', value: statsHistoricas.cirugiasCompletadas, color: 'text-purple-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl p-3 text-center ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próximas cirugías confirmadas */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Próximas Cirugías Confirmadas</h2>
          {cirugiasConfirmadas.length > 0 && (
            <button
              onClick={() => descargarICS(cirugiasConfirmadas)}
              title="Exportar al calendario (.ics)"
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <Download className="w-3.5 h-3.5" />
              Exportar .ics
            </button>
          )}
        </div>
        <div className="space-y-3">
          {cirugiasConfirmadas.length === 0 ? (
            <p className={`text-center py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>No hay cirugías confirmadas próximas</p>
          ) : (
            cirugiasConfirmadas.map(cirugia => (
              <div 
                key={cirugia.id} 
                className={`border rounded-lg p-4 transition-colors ${
                  theme === 'dark' 
                    ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' 
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {cirugia.patients?.nombre} {cirugia.patients?.apellido}
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-gray-600'}`}>
                      {format(new Date(cirugia.fecha), 'dd/MM/yyyy')} - {typeof cirugia.hora_inicio === 'string' ? cirugia.hora_inicio.substring(0, 5) : cirugia.hora_inicio}
                    </p>
                    {cirugia.estado_hora === 'reagendado' && cirugia.fecha_anterior && (
                      <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
                        Fecha original (ya no aplica): {format(new Date(cirugia.fecha_anterior), 'dd/MM/yyyy')} a las {typeof cirugia.hora_inicio_anterior === 'string' ? cirugia.hora_inicio_anterior.substring(0, 5) : cirugia.hora_inicio_anterior}
                      </p>
                    )}
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>
                      {cirugia.operating_rooms?.nombre}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    cirugia.estado_hora === 'reagendado'
                      ? (theme === 'dark' ? 'bg-amber-900 text-amber-200' : 'bg-amber-100 text-amber-800')
                      : (theme === 'dark' ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800')
                  }`}>
                    {cirugia.estado_hora === 'reagendado' ? 'Reagendada' : 'Programada'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
