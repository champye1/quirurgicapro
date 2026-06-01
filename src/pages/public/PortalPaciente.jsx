import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import { CheckCircle, Clock, XCircle, AlertCircle, Stethoscope, Calendar, User, Building2, AlertTriangle } from 'lucide-react'

const ESTADOS_SOLICITUD = {
  pendiente: { label: 'Pendiente de revisión', icon: Clock,        color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  aceptada:  { label: 'Aceptada — cirugía programada', icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
  rechazada: { label: 'Rechazada',             icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
  cancelada: { label: 'Cancelada',             icon: AlertCircle,  color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200' },
}

const ESTADOS_CIRUGIA = {
  programada:  { label: 'Cirugía programada',    icon: Calendar,     color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  en_proceso:  { label: 'En proceso',            icon: Clock,        color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  completada:  { label: 'Cirugía completada',    icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
  cancelada:   { label: 'Cirugía cancelada',     icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
}

function formatFecha(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-CL', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return dateStr }
}

function formatHora(timeStr) {
  if (!timeStr) return '—'
  return timeStr.slice(0, 5)
}

export default function PortalPaciente() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      try {
        const { data: result, error: rpcError } = await supabase
          .rpc('get_surgery_by_patient_token', { p_token: token })
        if (rpcError) throw rpcError
        if (isMounted) setData(result)
      } catch (err) {
        if (isMounted) setError(err.message || 'Error al cargar la información')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    const TOKEN_REGEX = /^[a-zA-Z0-9_-]{8,128}$/
    if (token && TOKEN_REGEX.test(token)) fetchData()
    else { setError('Enlace inválido o malformado'); setLoading(false) }
    return () => { isMounted = false }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data?.token_valido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-black text-slate-900 mb-2">Enlace no válido</h1>
          <p className="text-slate-500 text-sm">
            {error || 'Este enlace no existe o ha expirado. Solicita un nuevo enlace a tu médico o al equipo de pabellón.'}
          </p>
        </div>
      </div>
    )
  }

  if (data.expirado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <Clock className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h1 className="text-xl font-black text-slate-900 mb-2">Enlace expirado</h1>
          <p className="text-slate-500 text-sm">Este enlace ya no está vigente. Solicita uno nuevo a tu médico.</p>
        </div>
      </div>
    )
  }

  const { paciente, doctor, solicitud, cirugia } = data
  const estadoSolicitud = ESTADOS_SOLICITUD[solicitud.estado] || ESTADOS_SOLICITUD.pendiente
  const estadoCirugia = cirugia ? (ESTADOS_CIRUGIA[cirugia.estado] || ESTADOS_CIRUGIA.programada) : null
  const IconEstadoSol = estadoSolicitud.icon


  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="text-center pt-4">
          <div className="flex justify-center mb-3">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-xl shadow-blue-200">
              <Stethoscope className="text-white w-7 h-7" />
            </div>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tighter">Portal del Paciente</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Gestión Quirúrgica</p>
        </div>

        {/* Paciente */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-slate-600" />
            </div>
            <h2 className="text-base font-black text-slate-900">Información del Paciente</h2>
          </div>
          <dl className="space-y-2">
            <div className="flex justify-between text-sm">
              <dt className="text-slate-500 font-semibold">Nombre</dt>
              <dd className="font-bold text-slate-900">{paciente.nombre} {paciente.apellido}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-slate-500 font-semibold">RUT</dt>
              <dd className="font-bold text-slate-900">{paciente.rut || '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Médico */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-base font-black text-slate-900">Médico Tratante</h2>
          </div>
          <dl className="space-y-2">
            <div className="flex justify-between text-sm">
              <dt className="text-slate-500 font-semibold">Nombre</dt>
              <dd className="font-bold text-slate-900">Dr. {doctor.nombre} {doctor.apellido}</dd>
            </div>
            {doctor.especialidad && (
              <div className="flex justify-between text-sm">
                <dt className="text-slate-500 font-semibold">Especialidad</dt>
                <dd className="font-bold text-slate-900">{doctor.especialidad}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Estado de la solicitud */}
        <div className={`rounded-2xl border p-5 ${estadoSolicitud.bg}`}>
          <div className={`flex items-center gap-2 mb-3 ${estadoSolicitud.color}`}>
            <IconEstadoSol className="w-5 h-5" />
            <h2 className="text-base font-black">Estado de tu solicitud</h2>
          </div>
          <dl className="space-y-2">
            <div className="flex justify-between text-sm">
              <dt className="text-slate-600 font-semibold">Estado</dt>
              <dd className={`font-black ${estadoSolicitud.color}`}>{estadoSolicitud.label}</dd>
            </div>
            {solicitud.codigo_operacion && (
              <div className="flex justify-between text-sm">
                <dt className="text-slate-600 font-semibold">Tipo de procedimiento</dt>
                <dd className="font-bold text-slate-900">{solicitud.codigo_operacion}</dd>
              </div>
            )}
            {solicitud.fecha_preferida && (
              <div className="flex justify-between text-sm">
                <dt className="text-slate-600 font-semibold">Fecha solicitada</dt>
                <dd className="font-bold text-slate-900">{formatFecha(solicitud.fecha_preferida)}</dd>
              </div>
            )}
            {solicitud.estado === 'rechazada' && solicitud.motivo_rechazo && (
              <div className="mt-3 p-3 bg-white/60 rounded-xl">
                <p className="text-xs font-bold text-slate-600 mb-1">Motivo del rechazo:</p>
                <p className="text-sm text-slate-800">{solicitud.motivo_rechazo}</p>
              </div>
            )}
          </dl>
        </div>

        {/* Cirugía programada */}
        {cirugia && (
          <div className={`rounded-2xl border p-5 ${estadoCirugia.bg}`}>
            <div className={`flex items-center gap-2 mb-3 ${estadoCirugia.color}`}>
              <Building2 className="w-5 h-5" />
              <h2 className="text-base font-black">Tu cirugía</h2>
            </div>
            <dl className="space-y-2">
              <div className="flex justify-between text-sm">
                <dt className="text-slate-600 font-semibold">Estado</dt>
                <dd className={`font-black ${estadoCirugia.color}`}>{estadoCirugia.label}</dd>
              </div>
              {cirugia.fecha && (
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-600 font-semibold">Fecha</dt>
                  <dd className="font-bold text-slate-900">{formatFecha(cirugia.fecha)}</dd>
                </div>
              )}
              {cirugia.hora_inicio && (
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-600 font-semibold">Hora</dt>
                  <dd className="font-bold text-slate-900">{formatHora(cirugia.hora_inicio)} – {formatHora(cirugia.hora_fin)}</dd>
                </div>
              )}
              {cirugia.pabellon && (
                <div className="flex justify-between text-sm">
                  <dt className="text-slate-600 font-semibold">Pabellón</dt>
                  <dd className="font-bold text-slate-900">{cirugia.pabellon}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Preparación preoperatoria */}
        {cirugia && ['programada', 'en_proceso'].includes(cirugia.estado) && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
            <div className="flex items-center gap-2 mb-4 text-amber-800">
              <span className="text-xl">⚠️</span>
              <h2 className="text-base font-black">Indicaciones preoperatorias</h2>
            </div>
            <ul className="space-y-3 text-sm text-amber-900">
              {[
                { emoji: '🚫', text: 'Ayuno de al menos 8 horas antes de la cirugía (no comer ni beber, incluyendo agua).' },
                { emoji: '💊', text: 'Si toma medicamentos habituales, consulte con su médico cuáles debe tomar el día de la cirugía.' },
                { emoji: '🚿', text: 'Ducharse la noche anterior o la mañana de la cirugía. No aplicar cremas, perfumes ni desodorante.' },
                { emoji: '💍', text: 'No use joyas, piercings ni esmalte de uñas el día de la cirugía.' },
                { emoji: '👕', text: 'Lleve ropa cómoda y holgada. No llevar objetos de valor.' },
                { emoji: '🚗', text: 'Organice transporte de regreso. No podrá conducir después de la cirugía.' },
                { emoji: '📞', text: 'Ante cualquier duda, contacte a la clínica con anticipación.' },
              ].map(item => (
                <li key={item.text} className="flex items-start gap-2">
                  <span className="flex-shrink-0">{item.emoji}</span>
                  <span className="leading-relaxed">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contacto */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
          <p className="text-sm font-bold text-slate-900 mb-1">¿Tienes alguna duda?</p>
          <p className="text-xs text-slate-500">Contacta directamente a la clínica o a tu médico tratante antes de la cirugía.</p>
        </div>

        <p className="text-center text-[10px] text-slate-400 pb-4">
          Esta información es solo para consulta. Para cualquier duda, contacta a la clínica.
        </p>
      </div>
    </div>
  )
}
