import { useState } from 'react'
import { ChevronDown, ChevronUp, MessageSquare, Mail, Book, Phone, ExternalLink } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useClinicInfo } from '../../hooks/useClinicInfo'

const FAQS = [
  {
    category: 'Solicitudes',
    items: [
      {
        q: '¿Cómo acepto una solicitud de cirugía?',
        a: 'Ve a Solicitudes → busca la solicitud en estado "Pendiente" → haz clic en el botón verde "Aceptar y Programar". Si la solicitud tiene un horario preferido del médico, puedes aceptar ese horario directamente o seleccionar uno diferente en el calendario.'
      },
      {
        q: '¿Qué significa el estado "Aceptada" vs "Programada"?',
        a: '"Aceptada" significa que el pabellón confirmó la cirugía pero aún no se asignó una hora específica. "Programada" significa que ya tiene fecha, hora y pabellón asignados en el calendario.'
      },
      {
        q: '¿Puedo rechazar múltiples solicitudes a la vez?',
        a: 'Sí. En la lista de solicitudes, marca las casillas de las solicitudes que deseas rechazar y haz clic en "Rechazar seleccionadas". Puedes rechazar hasta 100 solicitudes simultáneamente.'
      },
    ]
  },
  {
    category: 'Calendario',
    items: [
      {
        q: '¿Cómo bloqueo un pabellón por mantenimiento?',
        a: 'Ve a Bloqueo Horario en el menú lateral. Selecciona el pabellón, fecha, hora de inicio y fin, y el motivo del bloqueo. El sistema notificará automáticamente a los médicos con cirugías afectadas.'
      },
      {
        q: '¿Cómo imprimo el programa del día?',
        a: 'En la vista de Calendario, selecciona un día en la vista diaria. Aparecerá el botón "PDF" para descargar el programa en PDF y "Imprimir" para imprimir directamente. El programa incluye todos los datos de las cirugías del día.'
      },
      {
        q: '¿Puedo reagendar una cirugía ya programada?',
        a: 'Sí. En el calendario, haz clic en la cirugía programada → selecciona "Reagendar". Se abrirá el calendario para elegir el nuevo horario. El médico recibirá una notificación automática.'
      },
    ]
  },
  {
    category: 'Médicos',
    items: [
      {
        q: '¿Cómo agrego un nuevo médico?',
        a: 'Ve a Médicos → clic en "Nuevo Médico". Completa nombre, apellido, RUT, email y especialidad. Si el médico necesita acceso al portal para crear solicitudes, activa "Habilitar Acceso Web" y se generará una contraseña temporal.'
      },
      {
        q: '¿Puedo importar varios médicos a la vez?',
        a: 'Sí. En la página de Médicos, usa el botón "Importar CSV". Descarga la plantilla, rellénala con los datos de tus médicos y súbela. El sistema validará cada fila antes de importar.'
      },
      {
        q: '¿Qué pasa si elimino un médico?',
        a: 'La eliminación es permanente y borra todos sus datos asociados: pacientes, solicitudes, cirugías y notificaciones. Esta acción no se puede deshacer. Se recomienda cambiar el estado a "Vacaciones" si es temporal.'
      },
    ]
  },
  {
    category: 'Insumos',
    items: [
      {
        q: '¿Cómo registro una entrada de stock?',
        a: 'Ve a Insumos → haz clic en el ícono de movimiento del insumo → selecciona tipo "Entrada", ingresa la cantidad y el motivo (opcional). El stock se actualizará inmediatamente.'
      },
      {
        q: '¿Qué significa el alerta de stock bajo?',
        a: 'Cuando el stock actual de un insumo es igual o menor al stock mínimo configurado, aparece una alerta en rojo. Puedes ver todos los insumos con stock bajo activando el filtro "Solo stock bajo" en la página de Insumos.'
      },
    ]
  },
  {
    category: 'Configuración',
    items: [
      {
        q: '¿Cómo cambio el nombre de la clínica que aparece en el sistema?',
        a: 'Ve a Configuración → sección "Información de la Clínica". Actualiza el nombre y guarda. El cambio se refleja inmediatamente en el sidebar y en todos los PDFs exportados.'
      },
      {
        q: '¿Cómo configuro las notificaciones de WhatsApp?',
        a: 'Ve a Configuración → sección "WhatsApp Business". Necesitas una cuenta de WhatsApp Business API (Evolution API o similar). Ingresa el ID de instancia y el token de acceso. Puedes probar la conexión antes de guardar.'
      },
    ]
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-5 py-4 text-left font-bold text-sm transition-colors ${
          isDark ? 'hover:bg-slate-800 text-white' : 'hover:bg-slate-50 text-slate-900'
        }`}
      >
        {q}
        {open ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-blue-500" /> : <ChevronDown className="w-4 h-4 flex-shrink-0 text-slate-400" />}
      </button>
      {open && (
        <div className={`px-5 pb-4 text-sm leading-relaxed ${isDark ? 'text-slate-300 border-t border-slate-700' : 'text-slate-600 border-t border-slate-100'}`}>
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function Ayuda() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [categoriaActiva, setCategoriaActiva] = useState('Solicitudes')
  const { data: clinicInfo } = useClinicInfo()

  const emailSoporte = clinicInfo?.email || 'soporte@quirurgicapro.cl'
  const telefonoSoporte = clinicInfo?.telefono || '+56 9 1234 5678'
  const nombreClinica = clinicInfo?.nombre || 'QuirúrgicaPro'

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Centro de Ayuda
        </h1>
        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Respuestas a las preguntas más frecuentes
        </p>
      </div>

      {/* Contacto rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: MessageSquare, label: 'Chat en vivo', desc: 'Lun–Vie 9:00–18:00', color: 'bg-blue-100 text-blue-700' },
          { icon: Mail, label: 'Correo soporte', desc: emailSoporte, color: 'bg-purple-100 text-purple-700' },
          { icon: Phone, label: 'Teléfono', desc: telefonoSoporte, color: 'bg-green-100 text-green-700' },
        ].map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className={`card p-4 flex items-center gap-3 ${isDark ? 'bg-slate-800 border-slate-700' : ''}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.label}</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* FAQ */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Book className="w-5 h-5 text-blue-600" />
          <h2 className={`font-black text-base uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Preguntas frecuentes
          </h2>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {FAQS.map(cat => (
            <button
              key={cat.category}
              onClick={() => setCategoriaActiva(cat.category)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                categoriaActiva === cat.category
                  ? 'bg-blue-600 text-white'
                  : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.category}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {FAQS.find(c => c.category === categoriaActiva)?.items.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      {/* Docs link */}
      <div className={`rounded-2xl border p-5 flex items-center justify-between ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
        <div>
          <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>¿No encontraste tu respuesta?</p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Escríbenos a {emailSoporte} · {nombreClinica} responde en menos de 4 horas hábiles
          </p>
        </div>
        <a
          href={`mailto:${emailSoporte}`}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-colors"
        >
          Contactar soporte
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  )
}
