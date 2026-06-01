import { useState, useEffect } from 'react'
import { supabase } from '../../config/supabase'
import { Stethoscope, Send, CheckCircle2, AlertCircle, Phone, Mail, MapPin } from 'lucide-react'
import { sanitizeString, sanitizeRut } from '../../utils/sanitizeInput'
import { isValidRutFormat, validateRut } from '../../utils/rutFormatter'

const ESPECIALIDADES = [
  'Cirugía General',
  'Cirugía Cardiovascular',
  'Cirugía Plástica',
  'Cirugía Ortopédica',
  'Neurocirugía',
  'Cirugía Oncológica',
  'Urología',
  'Ginecología',
  'Otorrinolaringología',
  'Oftalmología',
  'Otra',
]

export default function ContactoExterno() {
  const [clinicInfo, setClinicInfo] = useState(null)

  useEffect(() => {
    supabase
      .from('clinic_settings')
      .select('value')
      .eq('key', 'clinic_info')
      .maybeSingle()
      .then(({ data }) => { if (data?.value) setClinicInfo(data.value) })
  }, [])

  const [form, setForm] = useState({
    nombre_remitente: '',
    email_remitente: '',
    telefono_remitente: '',
    especialidad_remitente: '',
    institucion_remitente: '',
    asunto: '',
    mensaje: '',
    nombre_paciente: '',
    rut_paciente: '',
    tipo_cirugia: '',
    urgencia: 'normal',
  })
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'rut_paciente') {
      setForm(prev => ({ ...prev, [name]: sanitizeRut(value) }))
    } else {
      setForm(prev => ({ ...prev, [name]: sanitizeString(value) }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.nombre_remitente.trim() || !form.email_remitente.trim() || !form.asunto.trim() || !form.mensaje.trim()) {
      setError('Por favor complete todos los campos obligatorios.')
      return
    }

    if (form.nombre_remitente.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email_remitente)) {
      setError('Por favor ingrese un correo electrónico válido.')
      return
    }

    if (form.telefono_remitente.trim()) {
      const telLimpio = form.telefono_remitente.replace(/\s/g, '')
      if (!/^\+?[1-9]\d{7,14}$/.test(telLimpio)) {
        setError('El teléfono debe estar en formato internacional: +56912345678')
        return
      }
    }

    if (form.rut_paciente.trim()) {
      if (!isValidRutFormat(form.rut_paciente) || !validateRut(form.rut_paciente)) {
        setError('El RUT del paciente no es válido. Use el formato: 12.345.678-9')
        return
      }
    }

    setEnviando(true)
    try {
      const { error: dbError } = await supabase
        .from('external_messages')
        .insert({
          nombre_remitente: form.nombre_remitente.trim(),
          email_remitente: form.email_remitente.trim().toLowerCase(),
          telefono_remitente: form.telefono_remitente.trim() || null,
          especialidad_remitente: form.especialidad_remitente || null,
          institucion_remitente: form.institucion_remitente.trim() || null,
          asunto: form.asunto.trim(),
          mensaje: form.mensaje.trim(),
          nombre_paciente: form.nombre_paciente.trim() || null,
          rut_paciente: form.rut_paciente.trim() || null,
          tipo_cirugia: form.tipo_cirugia.trim() || null,
          urgencia: form.urgencia,
        })

      if (dbError) throw dbError

      // Notificar inmediatamente al equipo de pabellón
      try {
        const { data: pabellonUsers } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'pabellon')
          .is('deleted_at', null)
        if (pabellonUsers?.length) {
          await supabase.from('notifications').insert(
            pabellonUsers.map(u => ({
              user_id: u.id,
              tipo: 'mensaje_externo',
              titulo: `Nuevo mensaje externo${form.urgencia === 'urgente' ? ' ⚠️ URGENTE' : ''}`,
              mensaje: `${form.nombre_remitente} (${form.especialidad_remitente || 'médico'}): ${form.asunto}`,
              relacionado_con: null,
            }))
          )
        }
      } catch {
        // No bloquear el flujo si falla la notificación interna
      }

      // Email de confirmación al médico solicitante
      try {
        const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        const clinicaNombre = esc(clinicInfo?.nombre || 'la clínica')
        const clinicaTelefono = esc(clinicInfo?.telefono || '')
        const html = `
          <h2 style="color:#1e40af;margin-bottom:8px">Hemos recibido su solicitud ✅</h2>
          <p>Estimado/a <strong>${esc(form.nombre_remitente)}</strong>,</p>
          <p>Su solicitud de hora quirúrgica ha sido recibida correctamente por el equipo de ${clinicaNombre}.</p>
          ${form.nombre_paciente ? `<p><strong>Paciente:</strong> ${esc(form.nombre_paciente)}</p>` : ''}
          ${form.tipo_cirugia ? `<p><strong>Procedimiento:</strong> ${esc(form.tipo_cirugia)}</p>` : ''}
          <p><strong>Urgencia:</strong> ${esc(form.urgencia.charAt(0).toUpperCase() + form.urgencia.slice(1))}</p>
          <hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0"/>
          <p>Nos comunicaremos con usted en un plazo de <strong>24 horas hábiles</strong> para coordinar disponibilidad horaria.</p>
          ${clinicaTelefono ? `<p>Si su caso es urgente, puede contactarnos directamente al <strong>${clinicaTelefono}</strong>.</p>` : ''}
          <p style="color:#94a3b8;font-size:12px;margin-top:16px">Este es un mensaje automático — ${clinicaNombre}</p>`
        await supabase.functions.invoke('send-email', {
          body: {
            to: form.email_remitente,
            subject: `Confirmación de recepción — ${form.asunto}`,
            html,
          },
        })
      } catch {
        // No bloquear el flujo si falla el email de confirmación
      }

      setEnviado(true)
    } catch (err) {
      setError('Error al enviar el mensaje. Por favor intente nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 sm:p-10 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3">¡Mensaje enviado!</h2>
          <p className="text-slate-600 text-sm mb-2">
            Su solicitud fue recibida correctamente. El equipo de {clinicInfo?.nombre || 'la clínica'} se comunicará en un plazo de <strong>24 horas hábiles</strong> para coordinar disponibilidad horaria.
          </p>
          {clinicInfo?.telefono && (
            <p className="text-slate-500 text-xs mb-6">
              Si su caso es urgente, puede contactarnos directamente al{' '}
              <a href={`tel:${clinicInfo.telefono}`} className="text-blue-600 font-semibold">{clinicInfo.telefono}</a>
            </p>
          )}
          {!clinicInfo?.telefono && <div className="mb-6" />}
          <button
            onClick={() => {
              setEnviado(false)
              setForm({
                nombre_remitente: '', email_remitente: '', telefono_remitente: '',
                especialidad_remitente: '', institucion_remitente: '',
                asunto: '', mensaje: '', nombre_paciente: '', rut_paciente: '',
                tipo_cirugia: '', urgencia: 'normal',
              })
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors"
          >
            Enviar otro mensaje
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-white rounded-2xl px-5 py-3 shadow-sm border border-slate-200 mb-4">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Stethoscope className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
              <h1 className="text-base font-black text-slate-900 uppercase tracking-tight leading-none">
                {clinicInfo?.nombre || 'QuirúrgicaPro'}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Portal Clínico</span>
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
            Solicitud de Hora Quirúrgica
          </h2>
          <p className="text-slate-500 text-sm mt-2">
            Complete el formulario y el equipo de pabellón se contactará para ofrecer disponibilidad horaria.
          </p>

          {/* Datos de contacto directo */}
          {(clinicInfo?.telefono || clinicInfo?.email || clinicInfo?.direccion) && (
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
              {clinicInfo?.telefono && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-500" />
                  {clinicInfo.telefono}
                </span>
              )}
              {clinicInfo?.email && (
                <a href={`mailto:${clinicInfo.email}`} className="flex items-center gap-1.5 hover:text-blue-600">
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                  {clinicInfo.email}
                </a>
              )}
              {clinicInfo?.direccion && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  {clinicInfo.direccion}
                </span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">

          {/* Sección: Datos del médico */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Datos del médico solicitante</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nombre completo *</label>
                <input
                  type="text"
                  name="nombre_remitente"
                  value={form.nombre_remitente}
                  onChange={handleChange}
                  placeholder="Dr. Juan Pérez"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  maxLength={120}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Correo electrónico *</label>
                <input
                  type="email"
                  name="email_remitente"
                  value={form.email_remitente}
                  onChange={handleChange}
                  placeholder="doctor@clinica.cl"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  maxLength={150}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Teléfono de contacto</label>
                <input
                  type="tel"
                  name="telefono_remitente"
                  value={form.telefono_remitente}
                  onChange={handleChange}
                  placeholder="+56 9 1234 5678"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={30}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Especialidad</label>
                <select
                  name="especialidad_remitente"
                  value={form.especialidad_remitente}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Seleccionar especialidad</option>
                  {ESPECIALIDADES.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Institución / Clínica de origen</label>
                <input
                  type="text"
                  name="institucion_remitente"
                  value={form.institucion_remitente}
                  onChange={handleChange}
                  placeholder="Hospital / Clínica de origen"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={150}
                />
              </div>
            </div>
          </div>

          {/* Sección: Datos del paciente */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Datos del paciente (opcional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nombre del paciente</label>
                <input
                  type="text"
                  name="nombre_paciente"
                  value={form.nombre_paciente}
                  onChange={handleChange}
                  placeholder="Nombre Apellido"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">RUT del paciente</label>
                <input
                  type="text"
                  name="rut_paciente"
                  value={form.rut_paciente}
                  onChange={handleChange}
                  placeholder="12.345.678-9"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={20}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tipo de cirugía / Procedimiento</label>
                <input
                  type="text"
                  name="tipo_cirugia"
                  value={form.tipo_cirugia}
                  onChange={handleChange}
                  placeholder="Ej: Colecistectomía laparoscópica"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={200}
                />
              </div>
            </div>
          </div>

          {/* Sección: Mensaje */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Mensaje</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Urgencia</label>
                <div className="flex gap-3">
                  {[
                    { value: 'electiva', label: 'Electiva', color: 'border-green-400 text-green-700 bg-green-50' },
                    { value: 'normal', label: 'Normal', color: 'border-blue-400 text-blue-700 bg-blue-50' },
                    { value: 'urgente', label: 'Urgente', color: 'border-red-400 text-red-700 bg-red-50' },
                  ].map(op => (
                    <button
                      key={op.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, urgencia: op.value }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-black uppercase border-2 transition-all ${
                        form.urgencia === op.value ? op.color : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Asunto *</label>
                <input
                  type="text"
                  name="asunto"
                  value={form.asunto}
                  onChange={handleChange}
                  placeholder="Motivo principal del contacto"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Mensaje *</label>
                <textarea
                  name="mensaje"
                  value={form.mensaje}
                  onChange={handleChange}
                  placeholder="Describa detalladamente su solicitud, disponibilidad horaria preferida u otros antecedentes relevantes..."
                  rows={5}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  required
                  maxLength={2000}
                />
                <p className="text-xs text-slate-400 text-right mt-1">{form.mensaje.length}/2000</p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            {enviando ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar solicitud
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            Sus datos serán tratados de forma confidencial y solo serán utilizados para coordinar la atención médica.
          </p>
        </form>
      </div>
    </div>
  )
}
