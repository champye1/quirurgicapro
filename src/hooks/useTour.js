import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

// ─────────────────────────────────────────────
// Steps por ruta
// ─────────────────────────────────────────────

const TOUR_STEPS = {
  '/pabellon': [
    {
      popover: {
        title: 'Panel Administrativo',
        description: 'Vista principal del sistema. Aquí encuentras de un vistazo todo lo que necesitas para gestionar el día quirúrgico.',
        side: 'over', align: 'center',
      },
    },
    {
      element: '#tour-sidebar-nav',
      popover: {
        title: 'Menú de navegación',
        description: 'Accede a todas las secciones desde aquí: Solicitudes, Calendario, Médicos, Insumos, Estadísticas y más.',
        side: 'right', align: 'start',
      },
    },
    {
      element: '#tour-metricas',
      popover: {
        title: 'Métricas del día',
        description: 'Solicitudes pendientes de revisión, cirugías programadas para hoy y porcentaje de ocupación de pabellones — todo de un vistazo.',
        side: 'bottom', align: 'center',
      },
    },
    {
      element: '#ocupacion-semanal',
      popover: {
        title: 'Gráfico de ocupación',
        description: 'Uso de pabellones por día en los últimos 7 días. Filtra por pabellón individual o ve el total. Ideal para detectar días subutilizados.',
        side: 'top', align: 'center',
      },
    },
    {
      element: '#tour-solicitudes-card',
      popover: {
        title: 'Solicitudes pendientes',
        description: 'Acceso rápido a las últimas solicitudes de cirugía enviadas por médicos. Haz clic para ir a la bandeja completa.',
        side: 'top', align: 'start',
      },
    },
    {
      element: '#tour-recordatorios-card',
      popover: {
        title: 'Muro de recordatorios',
        description: 'Anotaciones internas del equipo de pabellón. Útil para avisos rápidos sin necesidad de enviar mensajes.',
        side: 'top', align: 'end',
      },
    },
    {
      element: '#tour-header-notifications',
      popover: {
        title: 'Notificaciones en tiempo real',
        description: 'Alertas instantáneas cuando llega una nueva solicitud, se reagenda una cirugía o hay un mensaje de un médico.',
        side: 'bottom', align: 'end',
      },
    },
    {
      element: '#tour-header-search',
      popover: {
        title: 'Búsqueda global (Ctrl+K)',
        description: 'Encuentra pacientes, médicos o cirugías desde cualquier sección del sistema.',
        side: 'bottom', align: 'end',
      },
    },
    {
      popover: {
        title: '¡Listo!',
        description: 'Usa el botón <b>Tour</b> en el header en cualquier pantalla para ver la explicación de esa sección específica.',
        side: 'over', align: 'center',
      },
    },
  ],

  '/pabellon/solicitudes': [
    {
      element: '#tour-sol-header',
      popover: {
        title: 'Bandeja de Solicitudes',
        description: 'Aquí llegan todas las solicitudes de cirugía enviadas por los médicos desde su portal. Puedes programarlas, rechazarlas o pedir más información.',
        side: 'bottom', align: 'center',
      },
    },
    {
      element: '#tour-sol-filters',
      popover: {
        title: 'Filtros avanzados',
        description: 'Filtra por doctor, código de operación, previsión (FONASA/ISAPRE), estado y rango de fechas. También busca por nombre de paciente o RUT.',
        side: 'bottom', align: 'center',
      },
    },
    {
      popover: {
        title: 'Tarjetas de solicitud',
        description: 'Cada solicitud muestra el paciente, médico, código de operación y previsión. Haz clic para ver el detalle completo y las acciones disponibles.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Acciones disponibles',
        description: '<b>Programar</b>: asigna pabellón y horario.<br><b>Completar</b>: marca como realizada.<br><b>Rechazar</b>: con motivo visible al médico.<br><b>Cancelar</b>: para cirugías ya agendadas.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Selección masiva',
        description: 'Selecciona varias solicitudes pendientes con el checkbox para rechazarlas en bloque — útil cuando hay un doctor que no tiene disponibilidad.',
        side: 'over', align: 'center',
      },
    },
  ],

  '/pabellon/calendario': [
    {
      element: '#tour-cal-container',
      popover: {
        title: 'Calendario Quirúrgico',
        description: 'Vista completa de la agenda del pabellón. Navega por año, mes, semana o día. Haz clic en un bloque para ver detalles o programar una cirugía.',
        side: 'over', align: 'center',
      },
    },
    {
      element: '#tour-cal-header',
      popover: {
        title: 'Navegación y filtros',
        description: 'Usa las flechas para cambiar de año. Filtra por pabellón específico o médico. El buscador de paciente destaca sus cirugías en el calendario.',
        side: 'bottom', align: 'center',
      },
    },
    {
      popover: {
        title: 'Vistas del calendario',
        description: 'Haz clic en un <b>mes</b> para ver la vista semanal. Luego en una <b>semana</b> para ver la vista diaria con los slots hora a hora de cada pabellón.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Agendar desde el calendario',
        description: 'En la vista diaria, haz clic en un bloque libre para programar una cirugía directamente. También puedes arrastrar desde una solicitud pendiente.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Emitir boleta/factura',
        description: 'Al ver los detalles de una cirugía agendada, el botón <b>Emitir Boleta/Factura</b> permite generar el DTE electrónico directo desde aquí (requiere configuración en Configuración).',
        side: 'over', align: 'center',
      },
    },
  ],

  '/pabellon/bloqueo': [
    {
      element: '#tour-blq-container',
      popover: {
        title: 'Bloqueo de Horario',
        description: 'Reserva bloques de tiempo en pabellones para convenios, limpiezas, mantenciones u otros eventos que impidan agendar cirugías.',
        side: 'over', align: 'center',
      },
    },
    {
      element: '#tour-blq-form',
      popover: {
        title: 'Crear un bloqueo',
        description: 'Selecciona el pabellón, fecha, rango horario y tipo de bloqueo. El campo de vigencia permite que el bloqueo se repita hasta una fecha determinada.',
        side: 'right', align: 'start',
      },
    },
    {
      element: '#tour-blq-list',
      popover: {
        title: 'Bloqueos activos',
        description: 'Lista de todos los bloqueos vigentes. Puedes editarlos o eliminarlos desde aquí. Los bloqueos aparecen en gris en el calendario.',
        side: 'left', align: 'start',
      },
    },
  ],

  '/pabellon/medicos': [
    {
      element: '#tour-med-header',
      popover: {
        title: 'Gestión de Médicos',
        description: 'Registro completo del cuerpo médico que trabaja con el pabellón. Cada médico puede tener acceso al portal web para enviar solicitudes.',
        side: 'bottom', align: 'center',
      },
    },
    {
      element: '#tour-med-actions',
      popover: {
        title: 'Agregar y exportar',
        description: '<b>Nuevo Médico</b>: registra nombre, RUT, especialidad y credenciales del portal.<br><b>Importar CSV</b>: carga masiva desde planilla.<br><b>Exportar</b>: descarga el listado en Excel o CSV.',
        side: 'bottom', align: 'end',
      },
    },
    {
      element: '#tour-med-filters',
      popover: {
        title: 'Buscar y filtrar',
        description: 'Busca por nombre o apellido. Filtra por especialidad (cirugía general, cardiovascular, oncológica, etc.) o por estado (activo/inactivo).',
        side: 'bottom', align: 'center',
      },
    },
    {
      popover: {
        title: 'Portal del médico',
        description: 'Al crear un médico con acceso web, se genera un usuario/contraseña para el portal de médicos. Desde allí envían solicitudes de cirugía sin llamar al pabellón.',
        side: 'over', align: 'center',
      },
    },
  ],

  '/pabellon/insumos': [
    {
      element: '#tour-ins-header',
      popover: {
        title: 'Gestión de Insumos',
        description: 'Inventario de materiales, instrumentos y suministros del pabellón. Controla stock mínimo y recibe alertas cuando el nivel es crítico.',
        side: 'bottom', align: 'center',
      },
    },
    {
      popover: {
        title: 'Stock bajo',
        description: 'El botón <b>Solo stock bajo</b> filtra los insumos que están por debajo del mínimo configurado. En el Dashboard también aparece el banner de alerta.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Movimientos de stock',
        description: 'Haz clic en cualquier insumo para registrar entradas (reposición) o salidas (uso en cirugía). Cada movimiento queda registrado en la auditoría.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Exportar inventario',
        description: 'Los botones CSV, Excel y PDF generan el inventario completo — útil para enviar a proveedores o para auditores externos.',
        side: 'over', align: 'center',
      },
    },
  ],

  '/pabellon/estadisticas': [
    {
      element: '#tour-est-header',
      popover: {
        title: 'Estadísticas y Reportes',
        description: 'Análisis de desempeño del pabellón. Elige el rango de fechas para ver los datos del período que necesitas.',
        side: 'bottom', align: 'center',
      },
    },
    {
      element: '#tour-est-kpis',
      popover: {
        title: 'KPIs principales',
        description: 'Total de cirugías, completadas, canceladas y en proceso para el período seleccionado. Comparativa rápida de rendimiento.',
        side: 'bottom', align: 'center',
      },
    },
    {
      popover: {
        title: 'Gráficos de análisis',
        description: 'Curvas de cirugías por mes, distribución por estado y rendimiento por médico. Identifica tendencias y picos de demanda.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Exportar reporte PDF',
        description: 'El botón <b>Exportar PDF</b> genera un informe ejecutivo listo para presentar a la dirección de la clínica.',
        side: 'over', align: 'center',
      },
    },
  ],

  '/pabellon/chat': [
    {
      element: '#tour-chat-container',
      popover: {
        title: 'Chat Interno',
        description: 'Mensajería en tiempo real entre el equipo de pabellón y los médicos. Toda comunicación queda registrada.',
        side: 'over', align: 'center',
      },
    },
    {
      element: '#tour-chat-threads',
      popover: {
        title: 'Conversaciones',
        description: '<b>Canal general</b>: visible para todo el equipo.<br><b>Conversaciones individuales</b>: una por cada médico que envió solicitudes. Ideal para coordinar reagendamientos.',
        side: 'right', align: 'start',
      },
    },
    {
      popover: {
        title: 'Mensajes en tiempo real',
        description: 'Los mensajes se sincronizan instantáneamente. El médico recibe la respuesta en su portal sin necesidad de recargar la página.',
        side: 'over', align: 'center',
      },
    },
  ],

  '/pabellon/correos': [
    {
      element: '#tour-cor-header',
      popover: {
        title: 'Bandeja de Correos',
        description: 'Mensajes enviados por médicos externos desde el formulario público de contacto (/contacto). No requieren cuenta en el sistema.',
        side: 'bottom', align: 'center',
      },
    },
    {
      popover: {
        title: 'Configurar Gmail',
        description: 'El botón <b>Configurar Gmail</b> conecta una cuenta de correo para recibir los emails entrantes automáticamente. Se configura en la sección Configuración.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Revisar y responder',
        description: 'Haz clic en cualquier mensaje para ver el contenido completo y responder directamente al médico desde la plataforma.',
        side: 'over', align: 'center',
      },
    },
  ],

  '/pabellon/auditoria': [
    {
      element: '#tour-aud-header',
      popover: {
        title: 'Historial de Auditoría',
        description: 'Registro inmutable de todas las acciones realizadas en el sistema: quién hizo qué y cuándo. Fundamental para cumplimiento regulatorio.',
        side: 'bottom', align: 'center',
      },
    },
    {
      element: '#tour-aud-filters',
      popover: {
        title: 'Buscar en el historial',
        description: 'Busca por acción, tabla o usuario. Filtra por rango de fechas para auditar períodos específicos. Exporta en CSV o Excel para reportes externos.',
        side: 'bottom', align: 'center',
      },
    },
    {
      popover: {
        title: 'Registros de cambios',
        description: 'Cada entrada muestra la acción (INSERT, UPDATE, DELETE), la tabla afectada, el usuario que la ejecutó y la fecha exacta con hora.',
        side: 'over', align: 'center',
      },
    },
  ],

  '/pabellon/configuracion': [
    {
      element: '#tour-cfg-header',
      popover: {
        title: 'Configuración del sistema',
        description: 'Ajustes globales de la clínica e integraciones con servicios externos. Solo los usuarios con rol pabellón pueden acceder a esta sección.',
        side: 'bottom', align: 'center',
      },
    },
    {
      element: '#tour-cfg-clinica',
      popover: {
        title: 'Datos de la clínica',
        description: 'Nombre, eslogan, teléfono, dirección y logo que aparecen en toda la interfaz y en los documentos exportados (PDF, contratos).',
        side: 'bottom', align: 'center',
      },
    },
    {
      element: '#tour-cfg-whatsapp',
      popover: {
        title: 'WhatsApp Business',
        description: 'Conecta la API de WhatsApp para enviar notificaciones automáticas a médicos (confirmaciones, reagendamientos). Requiere cuenta Business verificada.',
        side: 'bottom', align: 'center',
      },
    },
    {
      element: '#tour-cfg-facturacion',
      popover: {
        title: 'Facturación Electrónica DTE',
        description: 'Conecta OpenFactura para emitir boletas y facturas electrónicas desde el calendario. Ingresa tu API key, RUT emisor y datos del emisor.',
        side: 'top', align: 'center',
      },
    },
  ],
}

// Tours para páginas adicionales del menú
const EXTRA_STEPS = {
  '/pabellon/perfil': [
    {
      popover: {
        title: 'Mi Perfil',
        description: 'Gestiona tu cuenta personal: correo electrónico, contraseña y seguridad adicional.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Cambiar contraseña',
        description: 'Escribe tu contraseña actual y la nueva para actualizarla. Usa al menos 8 caracteres con letras y números.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Doble Factor (2FA)',
        description: 'Agrega una capa extra de seguridad con Google Authenticator o Authy. Recomendado para proteger el acceso a la clínica.',
        side: 'over', align: 'center',
      },
    },
  ],

  '/pabellon/ayuda': [
    {
      popover: {
        title: 'Centro de Ayuda',
        description: 'Preguntas frecuentes organizadas por tema. Busca tu duda o contacta al soporte directamente desde aquí.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Canales de soporte',
        description: 'Chat en vivo (Lun–Vie 9–18h), correo y teléfono. Para dudas urgentes durante cirugías usa el chat — tiempo de respuesta bajo 5 minutos.',
        side: 'over', align: 'center',
      },
    },
    {
      popover: {
        title: 'Preguntas frecuentes',
        description: 'Las FAQ están agrupadas por módulo. Si no encuentras tu respuesta, el botón de contacto al final abre un ticket directamente al equipo de QuirúrgicaPro.',
        side: 'over', align: 'center',
      },
    },
  ],
}

// Fallback para rutas sin tour específico
const DEFAULT_STEPS = [
  {
    popover: {
      title: 'Tour no disponible aquí',
      description: 'Esta página no tiene tour específico. Navega a otra sección del menú y pulsa Tour para ver su guía.',
      side: 'over', align: 'center',
    },
  },
]

const ALL_STEPS = { ...TOUR_STEPS, ...EXTRA_STEPS }

// ─────────────────────────────────────────────

function getStepsForPath(pathname) {
  const path = pathname.replace(/\/$/, '') || '/'

  // 1. Coincidencia exacta
  if (ALL_STEPS[path]) return ALL_STEPS[path]

  // 2. Coincidencia por prefijo SOLO para claves con más de un segmento
  //    (evita que '/pabellon' coincida con '/pabellon/perfil')
  const match = Object.keys(ALL_STEPS)
    .filter(k => k.includes('/', 1) && path.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0]

  return match ? ALL_STEPS[match] : DEFAULT_STEPS
}

export function useTour() {
  const location = useLocation()

  const startTour = useCallback(() => {
    const steps = getStepsForPath(location.pathname)

    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Anterior',
      doneBtnText: '¡Listo!',
      progressText: '{{current}} / {{total}}',
      smoothScroll: true,
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      steps,
    })

    driverObj.drive()
  }, [location.pathname])

  return { startTour }
}
