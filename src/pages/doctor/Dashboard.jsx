import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { Calendar, CheckCircle2, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTheme } from '../../contexts/ThemeContext'
import { logger } from '../../utils/logger'

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      {/* Próximas cirugías confirmadas */}
      <div className="card">
        <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Próximas Cirugías Confirmadas</h2>
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
