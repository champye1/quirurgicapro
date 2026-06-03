import { useState, useEffect } from 'react'
import { supabase } from '../../config/supabase'
import { Stethoscope, Send, CheckCircle2, AlertCircle, Phone, Mail, MapPin } from 'lucide-react'
import { sanitizeString } from '../../utils/sanitizeInput'

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
    nombre: '',
    email: '',
    telefono: '',
    urgencia: 'normal',
    tipo_cirugia: '',
    mensaje: '',
  })
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: sanitizeString(value) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.nombre.trim()) {
      setError('Por favor ingrese su nombre.')
      return
    }
    if (!form.email.trim() && !form.telefono.trim()) {
      setError('Ingrese al menos un medio de contacto: email o teléfono.')
      return
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('El correo electrónico no es válido.')
      return
    }
    if (!form.mensaje.trim()) {
      setError('Por favor escriba su mensaje.')
      return
    }

    setEnviando(true)
    try {
      const asunto = form.tipo_cirugia.trim()
        ? `Solicitud: ${form.tipo_cirugia.trim()}`
        : 'Solicitud de hora quirúrgica'

      const { error: dbError } = await supabase
        .from('external_messages')
        .insert({
          nombre_remitente: form.nombre.trim(),
          email_remitente:  form.email.trim().toLowerCase() || null,
          telefono_remitente: form.telefono.trim() || null,
          asunto,
          mensaje: form.mensaje.trim(),
          tipo_cirugia: form.tipo_cirugia.trim() || null,
          urgencia: form.urgencia,
        })

      if (dbError) throw dbError

      // Notificar al equipo de pabellón
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
              tipo: 'orden_sin_agendar',
              titulo: `Nuevo contacto${form.urgencia === 'urgente' ? ' ⚠️ URGENTE' : ''}`,
              mensaje: `${form.nombre.trim()}: ${asunto}`,
              relacionado_con: null,
            }))
          )
        }
      } catch { /* no bloquear el flujo */ }

      // Email de confirmación si tiene correo
      if (form.email.trim()) {
        try {
          const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          const clinicaNombre = esc(clinicInfo?.nombre || 'la clínica')
          const html = `
            <h2 style="color:#1e40af;margin-bottom:8px">Hemos recibido su solicitud ✅</h2>
            <p>Estimado/a <strong>${esc(form.nombre)}</strong>,</p>
            <p>Su solicitud fue recibida correctamente por el equipo de ${clinicaNombre}.</p>
            ${form.tipo_cirugia ? `<p><strong>Procedimiento:</strong> ${esc(form.tipo_cirugia)}</p>` : ''}
            <hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0"/>
            <p>Nos comunicaremos en un plazo de <strong>24 horas hábiles</strong>.</p>
            ${clinicInfo?.telefono ? `<p>Si su caso es urgente llámenos al <strong>${esc(clinicInfo.telefono)}</strong>.</p>` : ''}
            <p style="color:#94a3b8;font-size:12px;margin-top:16px">Mensaje automático — ${clinicaNombre}</p>`
          await supabase.functions.invoke('send-email', {
            body: { to: form.email.trim(), subject: `Confirmación — ${asunto}`, html },
          })
        } catch { /* no bloquear */ }
      }

      setEnviado(true)
    } catch {
      setError('Error al enviar el mensaje. Por favor intente nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  const resetForm = () => {
    setEnviado(false)
    setForm({ nombre: '', email: '', telefono: '', urgencia: 'normal', tipo_cirugia: '', mensaje: '' })
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">¡Mensaje enviado!</h2>
          <p className="text-slate-500 text-sm mb-2">
            Nos comunicaremos con usted en un plazo de <strong>24 horas hábiles</strong>.
          </p>
          {clinicInfo?.telefono && (
            <p className="text-slate-400 text-xs mb-6">
              Urgente:{' '}
              <a href={`tel:${clinicInfo.telefono}`} className="text-blue-600 font-semibold">
                {clinicInfo.telefono}
              </a>
            </p>
          )}
          {!clinicInfo?.telefono && <div className="mb-6" />}
          <button
            onClick={resetForm}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors"
          >
            Enviar otro mensaje
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="text-white w-4 h-4" />
            </div>
            <span className="font-black text-slate-900 text-base">
              {clinicInfo?.nombre || 'QuirúrgicaPro'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">Solicitar hora quirúrgica</h1>
          <p className="text-slate-500 text-sm">
            Déjenos su mensaje y lo contactaremos a la brevedad.
          </p>
          {(clinicInfo?.telefono || clinicInfo?.email || clinicInfo?.direccion) && (
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-slate-400">
              {clinicInfo?.telefono && (
                <a href={`tel:${clinicInfo.telefono}`} className="flex items-center gap-1 hover:text-blue-600">
                  <Phone className="w-3 h-3" /> {clinicInfo.telefono}
                </a>
              )}
              {clinicInfo?.email && (
                <a href={`mailto:${clinicInfo.email}`} className="flex items-center gap-1 hover:text-blue-600">
                  <Mail className="w-3 h-3" /> {clinicInfo.email}
                </a>
              )}
              {clinicInfo?.direccion && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {clinicInfo.direccion}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">

          {/* Nombre */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Dr. Juan Pérez"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxLength={120}
            />
          </div>

          {/* Email y Teléfono en la misma fila */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="doctor@clinica.cl"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={150}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Teléfono</label>
              <input
                type="tel"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="+56 9 1234 5678"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={30}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 -mt-2">Al menos uno de los dos es obligatorio.</p>

          {/* Urgencia */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Urgencia</label>
            <div className="flex gap-2">
              {[
                { value: 'electiva', label: 'Electiva', active: 'border-green-400 text-green-700 bg-green-50' },
                { value: 'normal',   label: 'Normal',   active: 'border-blue-400 text-blue-700 bg-blue-50' },
                { value: 'urgente',  label: 'Urgente',  active: 'border-red-400 text-red-700 bg-red-50' },
              ].map(op => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, urgencia: op.value }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase border-2 transition-all ${
                    form.urgencia === op.value ? op.active : 'border-slate-200 text-slate-400 bg-white hover:border-slate-300'
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* Procedimiento (opcional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Procedimiento <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              name="tipo_cirugia"
              value={form.tipo_cirugia}
              onChange={handleChange}
              placeholder="Ej: Colecistectomía laparoscópica"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={200}
            />
          </div>

          {/* Mensaje */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Mensaje <span className="text-red-500">*</span>
            </label>
            <textarea
              name="mensaje"
              value={form.mensaje}
              onChange={handleChange}
              placeholder="Cuéntenos su solicitud: disponibilidad horaria, datos del paciente, antecedentes relevantes..."
              rows={5}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              required
              maxLength={2000}
            />
            <p className="text-xs text-slate-400 text-right">{form.mensaje.length}/2000</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            {enviando ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>
            ) : (
              <><Send className="w-4 h-4" />Enviar solicitud</>
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            Sus datos son confidenciales y se usan solo para coordinar la atención.
          </p>
        </form>
      </div>
    </div>
  )
}
