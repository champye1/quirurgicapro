import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar, Users, Package, Bell, CheckCircle, ArrowRight, Shield,
  Clock, ChevronRight, Mail, Stethoscope, ClipboardList, BarChart3,
  Zap, X, ChevronDown, ChevronUp, FileText, MessageSquare, Eye,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Calendar,
    title: 'Agenda quirúrgica',
    description: 'Calendario visual por pabellón con vistas diaria, semanal y anual. Detecta solapamientos y gestiona bloqueos en tiempo real.',
    color: 'bg-blue-50 text-blue-600',
    preview: '/previews/agenda-quirurgica.svg',
    previewCaption: 'Calendario de pabellones con vista diaria, semanal y anual',
  },
  {
    icon: Users,
    title: 'Portal del médico',
    description: 'Cada cirujano tiene su propio acceso para solicitar procedimientos, ver el estado de sus cirugías y recibir notificaciones al instante.',
    color: 'bg-indigo-50 text-indigo-600',
    preview: '/previews/portal-medico.svg',
    previewCaption: 'Panel del médico con solicitudes, calendario personal y notificaciones',
  },
  {
    icon: Package,
    title: 'Control de insumos',
    description: 'Stock en tiempo real con alertas de mínimo. Registro de movimientos de entrada y salida. Exportación a Excel y PDF.',
    color: 'bg-emerald-50 text-emerald-600',
    preview: '/previews/control-insumos.svg',
    previewCaption: 'Inventario en tiempo real con alertas de stock mínimo',
  },
  {
    icon: Bell,
    title: 'Notificaciones automáticas',
    description: 'El médico recibe confirmación al aceptar su cirugía vía WhatsApp o email. Sin llamadas, sin mensajes manuales.',
    color: 'bg-amber-50 text-amber-600',
    preview: '/previews/notificaciones.svg',
    previewCaption: 'Notificaciones automáticas por WhatsApp y email al aceptar o rechazar',
  },
  {
    icon: ClipboardList,
    title: 'Auditoría completa',
    description: 'Registro de cada acción: quién programó, cuándo y qué cambió. Trazabilidad total para cumplimiento normativo MINSAL.',
    color: 'bg-rose-50 text-rose-600',
    preview: '/previews/auditoria.svg',
    previewCaption: 'Log de auditoría con cada acción registrada por usuario y fecha',
  },
  {
    icon: BarChart3,
    title: 'Reportes y estadísticas',
    description: 'Dashboard ejecutivo en tiempo real. Exporta reportes de cirugías, ocupación de pabellones e inventario en PDF con tu logo.',
    color: 'bg-violet-50 text-violet-600',
    preview: '/previews/estadisticas.svg',
    previewCaption: 'Dashboard ejecutivo con gráficos de ocupación y estadísticas mensuales',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'El médico solicita',
    description: 'El cirujano ingresa a su portal y crea una solicitud con el procedimiento, paciente, insumos requeridos y horario preferido.',
  },
  {
    number: '02',
    title: 'Pabellón programa',
    description: 'El equipo de pabellón revisa la solicitud, verifica disponibilidad de sala e insumos, y confirma la fecha en el calendario.',
  },
  {
    number: '03',
    title: 'Todos quedan informados',
    description: 'El sistema notifica automáticamente al médico. El stock se actualiza. Sin papel, sin planillas, sin llamadas.',
  },
]

const COMPARISON = [
  { feature: 'Agenda en tiempo real',          pro: true,  excel: false, whatsapp: false },
  { feature: 'Portal propio por médico',        pro: true,  excel: false, whatsapp: false },
  { feature: 'Detección de solapamientos',      pro: true,  excel: false, whatsapp: false },
  { feature: 'Control de stock de insumos',     pro: true,  excel: true,  whatsapp: false },
  { feature: 'Notificaciones automáticas',      pro: true,  excel: false, whatsapp: true  },
  { feature: 'Auditoría y trazabilidad',        pro: true,  excel: false, whatsapp: false },
  { feature: 'Reportes PDF con logo clínica',   pro: true,  excel: false, whatsapp: false },
  { feature: 'Acceso desde cualquier dispositivo', pro: true, excel: true, whatsapp: true },
  { feature: 'Datos seguros y respaldados',     pro: true,  excel: false, whatsapp: false },
]


const FAQS = [
  {
    q: '¿Cuánto tiempo toma instalar el sistema?',
    a: 'La instalación base se realiza en 1-2 horas. Incluye la configuración de la base de datos, pabellones, y primer usuario administrador. Para clínicas con muchos médicos, la importación masiva vía CSV reduce el tiempo de carga de datos a minutos.',
  },
  {
    q: '¿El sistema funciona en celulares?',
    a: 'Sí. QuirúrgicaPro es una aplicación web progresiva (PWA) que funciona en cualquier navegador, incluyendo Safari en iPhone y Chrome en Android. Los médicos pueden instalarla como app en su celular desde el navegador, sin tienda de aplicaciones.',
  },
  {
    q: '¿Qué pasa con mis datos si dejo de usar el sistema?',
    a: 'Los datos son tuyos. Puedes exportar toda la información en cualquier momento (Excel, CSV, PDF). El sistema incluye funciones de exportación masiva para pacientes, cirugías e insumos. No hay lock-in.',
  },
  {
    q: '¿Es seguro guardar datos de pacientes en la nube?',
    a: 'Sí. Usamos Supabase como base de datos, que cumple con SOC 2, ISO 27001 y GDPR. Los datos se cifran en tránsito y en reposo. El sistema es compatible con la Ley N° 19.628 de Chile sobre protección de datos personales.',
  },
  {
    q: '¿Puede tener múltiples pabellones y médicos?',
    a: 'Sí, sin límite de usuarios. Puedes configurar hasta 8 pabellones en la interfaz estándar. Para más pabellones o configuraciones especiales, contáctanos.',
  },
  {
    q: '¿Qué incluye el soporte?',
    a: 'El Plan Clínica incluye 1 mes de soporte por correo con respuesta en 4 horas hábiles. El Plan Clínica + Soporte incluye 6 meses de soporte prioritario, 2 sesiones de capacitación y actualizaciones por 1 año.',
  },
]

function FeatureModal({ feature, onClose }) {
  const [imgError, setImgError] = useState(false)

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  if (!feature) return null

  const Icon = feature.icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${feature.color}`}>
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">{feature.title}</h3>
              <p className="text-slate-500 text-xs">{feature.previewCaption}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview image */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] bg-slate-50">
          {imgError ? (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${feature.color}`}>
                <Icon className="w-8 h-8" aria-hidden="true" />
              </div>
              <p className="font-bold text-slate-700 mb-2">{feature.title}</p>
              <p className="text-slate-500 text-sm max-w-sm">{feature.description}</p>
              <p className="text-slate-400 text-xs mt-6">
                Captura de pantalla próximamente disponible.
              </p>
            </div>
          ) : (
            <img
              src={feature.preview}
              alt={`Vista previa de ${feature.title}`}
              className="w-full object-contain"
              onError={() => setImgError(true)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors"
      >
        {q}
        {open ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-blue-500" /> : <ChevronDown className="w-4 h-4 flex-shrink-0 text-slate-400" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
          {a}
        </div>
      )}
    </div>
  )
}

const YEAR = new Date().getFullYear()

export default function LandingPage() {
  const [previewFeature, setPreviewFeature] = useState(null)

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tight">QuirúrgicaPro</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#precios" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Precios
            </a>
            <Link to="/contacto" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Contacto
            </Link>
            <Link
              to="/contacto"
              className="hidden sm:inline-flex items-center gap-1 border border-blue-200 text-blue-700 text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Demo gratuita
            </Link>
            <Link
              to="/acceso"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-32 pb-20 px-4 sm:px-6 bg-gradient-to-b from-slate-950 to-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-6">
            Software para clínicas quirúrgicas · Chile
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
            Gestión quirúrgica sin
            <span className="text-blue-400"> Excel</span>,
            sin <span className="text-blue-400">papel</span>.
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            QuirúrgicaPro centraliza las solicitudes de cirugía, el calendario de pabellón
            y el control de insumos. Pensado para clínicas quirúrgicas privadas en Chile.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/contacto"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-blue-500/20"
            >
              Solicitar demo gratuita
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <a
              href="#precios"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-xl text-base transition-all border border-white/20"
            >
              Ver precios
            </a>
          </div>
          <p className="text-slate-500 text-sm mt-6">
            Sin tarjeta de crédito · Instalación en 1 día · Soporte incluido
          </p>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-12 bg-blue-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-white">
            {[
              { value: '< 1 día', label: 'Instalación completa' },
              { value: '100%', label: 'Web — sin instalar nada' },
              { value: '0 papel', label: 'Solicitudes digitales' },
              { value: '24/7', label: 'Acceso desde cualquier lugar' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-3xl font-black mb-1">{s.value}</div>
                <div className="text-blue-200 text-xs font-bold uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
              Todo lo que necesita tu clínica, en un solo lugar
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Sin integraciones complejas. Sin capacitación de meses. Operativo desde el primer día.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <button
                key={f.title}
                onClick={() => setPreviewFeature(f)}
                className="p-6 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group text-left cursor-pointer w-full"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">{f.description}</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 group-hover:text-blue-700 transition-colors">
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  Ver pantalla
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section className="py-24 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">¿Cómo funciona?</h2>
            <p className="text-slate-500 text-lg">Tres pasos. Sin fricción.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.number} className="text-center">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl font-black mx-auto mb-5">
                  {s.number}
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-3">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARACIÓN ── */}
      <section className="py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
              ¿Por qué no Excel o WhatsApp?
            </h2>
            <p className="text-slate-500 text-lg">Las herramientas informales tienen un costo oculto.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="text-left px-6 py-4 font-bold">Funcionalidad</th>
                  <th className="text-center px-4 py-4 font-bold text-blue-400">QuirúrgicaPro</th>
                  <th className="text-center px-4 py-4 font-bold text-slate-400">Excel</th>
                  <th className="text-center px-4 py-4 font-bold text-slate-400">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-6 py-3.5 text-slate-700 font-medium">{row.feature}</td>
                    <td className="px-4 py-3.5 text-center">
                      {row.pro ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-400 mx-auto" />}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {row.excel ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-400 mx-auto" />}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {row.whatsapp ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-400 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── PARA QUIÉN + SEGURIDAD ── */}
      <section className="py-24 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-6">
                Pensado para clínicas quirúrgicas que quieren operar con orden
              </h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-8">
                Si hoy coordinas las cirugías por WhatsApp o Excel, QuirúrgicaPro te da el control
                que necesitas para escalar sin perder calidad en la atención quirúrgica.
              </p>
              <ul className="space-y-4">
                {[
                  'Clínicas con 2 o más médicos cirujanos',
                  'Centros con pabellón propio o compartido',
                  'Clínicas que realizan cirugías generales, cardiovasculares, plásticas u otras especialidades',
                  'Equipos que quieren eliminar el caos del agendamiento manual',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-700">
                    <ChevronRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 rounded-3xl p-8 text-white">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-6 h-6 text-blue-400" aria-hidden="true" />
                <span className="font-bold text-lg">Seguridad y cumplimiento</span>
              </div>
              <ul className="space-y-4">
                {[
                  { icon: Shield, text: 'Datos cifrados en tránsito y en reposo (AES-256)' },
                  { icon: Clock, text: 'Registro de auditoría de cada acción del sistema' },
                  { icon: CheckCircle, text: 'Conforme a Ley 19.628 (privacidad Chile)' },
                  { icon: CheckCircle, text: 'Respaldos automáticos diarios en Supabase' },
                  { icon: CheckCircle, text: 'Acceso por roles: pabellón y médico separados' },
                  { icon: FileText, text: 'Exporta todos tus datos en cualquier momento' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-slate-300 text-sm">
                    <Icon className="w-4 h-4 text-blue-400 flex-shrink-0" aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── BETA CTA ── */}
      <section className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-block bg-blue-100 text-blue-700 text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            Acceso anticipado
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
            Sé la primera clínica en usar QuirúrgicaPro
          </h2>
          <p className="text-slate-500 text-lg mb-8">
            Estamos incorporando nuestras primeras clínicas. Las que entren ahora obtienen precio especial de lanzamiento y soporte personalizado durante la instalación.
          </p>
          <Link
            to="/contacto"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-4 rounded-2xl text-base transition-colors"
          >
            Solicitar acceso anticipado →
          </Link>
        </div>
      </section>

      {/* ── PRECIOS ── */}
      <section id="precios" className="py-24 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
              Precio único, sin sorpresas
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Pagas una vez y el sistema es tuyo. Sin mensualidades, sin cobros ocultos.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Plan Clínica */}
            <div className="relative rounded-3xl border-2 border-blue-600 p-8 bg-white shadow-xl shadow-blue-100">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-blue-600 text-white text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                  Más popular
                </span>
              </div>
              <div className="mb-6">
                <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Plan Clínica</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-black text-slate-900">$750.000</span>
                  <span className="text-slate-500 text-lg mb-1">CLP</span>
                </div>
                <p className="text-slate-500 text-sm">Pago único · Licencia permanente</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Usuarios ilimitados (médicos + pabellón)',
                  'Agenda quirúrgica completa',
                  'Control de inventario + PDF',
                  'Notificaciones automáticas',
                  'Auditoría y trazabilidad',
                  'Importación masiva de médicos (CSV)',
                  'Wizard de configuración inicial',
                  '1 mes de soporte incluido',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/contacto"
                className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                Solicitar demo gratuita
              </Link>
            </div>

            {/* Plan con soporte */}
            <div className="rounded-3xl border border-slate-200 p-8 bg-white">
              <div className="mb-6">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Plan Clínica + Soporte</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-black text-slate-900">$1.100.000</span>
                  <span className="text-slate-500 text-lg mb-1">CLP</span>
                </div>
                <p className="text-slate-500 text-sm">Pago único · Todo incluido</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Todo lo del Plan Clínica',
                  '6 meses de soporte prioritario',
                  'Personalizaciones menores incluidas',
                  'Capacitación al equipo (2 sesiones)',
                  'Migración de datos existentes',
                  'Actualizaciones durante 1 año',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/contacto"
                className="block w-full text-center bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                Consultar
              </Link>
            </div>
          </div>

          <p className="text-center text-slate-400 text-sm mt-10">
            ¿Clínica pequeña con presupuesto ajustado?{' '}
            <Link to="/contacto" className="text-blue-600 hover:underline font-medium">
              Conversemos
            </Link>{' '}
            — tenemos opciones flexibles.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">Preguntas frecuentes</h2>
            <p className="text-slate-500">Todo lo que necesitas saber antes de tomar la decisión.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-24 px-4 sm:px-6 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            ¿Listo para modernizar tu clínica?
          </h2>
          <p className="text-blue-100 text-lg mb-10">
            Agenda una demostración gratuita. Te mostramos el sistema funcionando
            con datos reales en menos de 30 minutos. Sin compromiso.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/contacto"
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 hover:bg-blue-50 font-bold px-8 py-4 rounded-xl text-base transition-all"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              Solicitar demo gratuita
            </Link>
            <Link
              to="/acceso"
              className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold px-8 py-4 rounded-xl text-base transition-all border border-blue-500"
            >
              Acceder al sistema
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
          <p className="text-blue-200 text-sm mt-6">
            <MessageSquare className="w-4 h-4 inline mr-1" />
            También puedes escribirnos directamente a{' '}
            <a href="mailto:hola@quirurgicapro.cl" className="underline font-medium">
              hola@quirurgicapro.cl
            </a>
          </p>
        </div>
      </section>

      {/* ── MODAL PREVIEW FEATURE ── */}
      {previewFeature && (
        <FeatureModal feature={previewFeature} onClose={() => setPreviewFeature(null)} />
      )}

      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-8 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <Stethoscope className="w-3.5 h-3.5 text-white" aria-hidden="true" />
              </div>
              <span className="text-white font-black text-sm">QuirúrgicaPro</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <a href="#precios" className="hover:text-slate-300 transition-colors">Precios</a>
              <Link to="/contacto" className="hover:text-slate-300 transition-colors">Contacto</Link>
              <Link to="/politica-privacidad" className="hover:text-slate-300 transition-colors">Privacidad</Link>
              <Link to="/terminos-uso" className="hover:text-slate-300 transition-colors">Términos de uso</Link>
              <Link to="/acceso" className="hover:text-slate-300 transition-colors">Ingresar</Link>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-600">
            <p>© {YEAR} QuirúrgicaPro · Todos los derechos reservados · Chile</p>
            <p>Hecho con ❤️ para clínicas quirúrgicas chilenas</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
