import { Link } from 'react-router-dom'
import {
  Calendar, Users, Package, Bell, CheckCircle,
  ArrowRight, Shield, Clock, ChevronRight, Mail,
  Stethoscope, ClipboardList, BarChart3, Zap
} from 'lucide-react'

const FEATURES = [
  {
    icon: Calendar,
    title: 'Agenda quirúrgica',
    description: 'Calendario visual por pabellón. Programa cirugías, detecta solapamientos y gestiona bloqueos de horario en tiempo real.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Users,
    title: 'Portal del médico',
    description: 'Cada dentista tiene su propio acceso para solicitar procedimientos, ver el estado de sus cirugías y recibir notificaciones.',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: Package,
    title: 'Control de insumos',
    description: 'Stock en tiempo real con alertas de stock mínimo. Descuento automático de materiales al programar cada procedimiento.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Bell,
    title: 'Notificaciones',
    description: 'El médico recibe confirmación automática al aceptar su cirugía. Sin llamadas, sin WhatsApp manual.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: ClipboardList,
    title: 'Auditoría completa',
    description: 'Registro de cada acción: quién programó, cuándo y qué cambió. Trazabilidad total para cumplimiento normativo.',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    icon: BarChart3,
    title: 'Dashboard en tiempo real',
    description: 'Vista ejecutiva de cirugías del día, ocupación de pabellones y solicitudes pendientes al abrir el sistema.',
    color: 'bg-violet-50 text-violet-600',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'El médico solicita',
    description: 'El dentista ingresa a su portal y crea una solicitud de cirugía con el procedimiento, paciente y horario preferido.',
  },
  {
    number: '02',
    title: 'Pabellón programa',
    description: 'El equipo de pabellón revisa la solicitud, asigna el pabellón disponible y confirma la fecha en el calendario.',
  },
  {
    number: '03',
    title: 'Todos quedan informados',
    description: 'El sistema notifica automáticamente al médico. Los insumos se descuentan del stock. Sin papel, sin teléfonos.',
  },
]

const BENEFITS = [
  'Sin instalación — funciona desde cualquier navegador',
  'Datos seguros con cifrado y respaldo automático',
  'Soporte incluido en el primer mes',
  'Adaptado a la normativa chilena',
]

export default function LandingPage() {
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
            <Link
              to="/contacto"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors hidden sm:block"
            >
              Contacto
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
            Software para clínicas dentales · Chile
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
            Gestión quirúrgica sin
            <span className="text-blue-400"> Excel</span>,
            sin <span className="text-blue-400">papel</span>.
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            QuirúrgicaPro centraliza las solicitudes de cirugía, el calendario de pabellón
            y el inventario de insumos. Diseñado para clínicas dentales en Chile.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/acceso"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-blue-500/20"
            >
              Ver demo en vivo
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              to="/contacto"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-xl text-base transition-all border border-white/20"
            >
              Solicitar información
            </Link>
          </div>
          <p className="text-slate-500 text-sm mt-6">
            Demo disponible con datos reales · Sin tarjeta de crédito
          </p>
        </div>
      </section>

      {/* ── BENEFICIOS RÁPIDOS ── */}
      <section className="py-8 bg-blue-600">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-center gap-2 text-white text-sm font-medium">
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-blue-200" aria-hidden="true" />
                {b}
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
              Sin integraciones complejas. Sin capacitación de meses. Listo para operar desde el primer día.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section className="py-24 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
              ¿Cómo funciona?
            </h2>
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

      {/* ── PARA QUIÉN ── */}
      <section className="py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-6">
                Pensado para clínicas dentales que quieren crecer con orden
              </h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-8">
                Si hoy coordinas las cirugías por WhatsApp o Excel, QuirúrgicaPro te da el control
                que necesitas para escalar sin perder calidad en la atención.
              </p>
              <ul className="space-y-4">
                {[
                  'Clínicas con 2 o más dentistas cirujanos',
                  'Centros con pabellón propio o compartido',
                  'Clínicas que realizan implantes, endodoncias o cirugías orales',
                  'Equipos que quieren eliminar el caos de agendamiento manual',
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
                  { icon: Shield, text: 'Datos cifrados en tránsito y en reposo' },
                  { icon: Clock, text: 'Registro de auditoría de cada acción' },
                  { icon: CheckCircle, text: 'Conforme a Ley 19.628 (privacidad Chile)' },
                  { icon: CheckCircle, text: 'Backups automáticos diarios' },
                  { icon: CheckCircle, text: 'Acceso por roles: pabellón y médico separados' },
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

      {/* ── PRECIOS ── */}
      <section className="py-24 px-4 sm:px-6 bg-white">
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
                  <span className="text-5xl font-black text-slate-900">$990</span>
                  <span className="text-slate-500 text-lg mb-1">USD</span>
                </div>
                <p className="text-slate-500 text-sm">Pago único · Licencia permanente</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Usuarios ilimitados (médicos + pabellón)',
                  'Agenda quirúrgica completa',
                  'Control de inventario',
                  'Notificaciones automáticas',
                  'Auditoría y trazabilidad',
                  'Dashboard en tiempo real',
                  '1 mes de soporte incluido',
                  'Instalación y configuración inicial',
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

            {/* Plan con soporte extendido */}
            <div className="rounded-3xl border border-slate-200 p-8 bg-slate-50">
              <div className="mb-6">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Plan Clínica + Soporte</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-black text-slate-900">$1.490</span>
                  <span className="text-slate-500 text-lg mb-1">USD</span>
                </div>
                <p className="text-slate-500 text-sm">Pago único · Todo incluido</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Todo lo del Plan Clínica',
                  '6 meses de soporte prioritario',
                  'Personalizaciones menores',
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

      {/* ── CTA FINAL ── */}
      <section className="py-24 px-4 sm:px-6 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            ¿Listo para modernizar tu clínica?
          </h2>
          <p className="text-blue-100 text-lg mb-10">
            Agenda una demostración gratuita. Te mostramos el sistema funcionando con
            datos reales en menos de 30 minutos.
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
              Ver demo ahora
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            </div>
            <span className="text-white font-bold text-sm">QuirúrgicaPro</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link to="/politica-privacidad" className="hover:text-slate-300 transition-colors">
              Política de privacidad
            </Link>
            <Link to="/contacto" className="hover:text-slate-300 transition-colors">
              Contacto
            </Link>
            <Link to="/acceso" className="hover:text-slate-300 transition-colors">
              Ingresar
            </Link>
          </div>
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} QuirúrgicaPro · Chile</p>
        </div>
      </footer>

    </div>
  )
}
