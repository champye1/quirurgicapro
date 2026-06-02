/**
 * Utilidades para exportar datos a Excel/CSV.
 * Excel: usa exceljs (sin vulnerabilidades conocidas).
 * CSV: implementación propia sin dependencias externas.
 */

import { PREVISION_LABELS } from './previsionConfig'

/** Enmascara RUT: muestra solo los últimos 4 caracteres. Ej: ****.***.678-9 */
export function maskRut(rut) {
  if (!rut) return '—'
  const clean = String(rut).replace(/\./g, '')
  if (clean.length <= 4) return clean
  return '***.' + clean.slice(-7, -4).replace(/(\d{3})/, '$1.') + clean.slice(-4)
}

/** Enmascara teléfono: muestra solo últimos 4 dígitos. Ej: +569****5678 */
function maskTelefono(tel) {
  if (!tel) return '—'
  const s = String(tel).replace(/\s/g, '')
  if (s.length <= 4) return s
  return s.slice(0, -4).replace(/\d/g, '*') + s.slice(-4)
}

/**
 * Exporta una solicitud quirúrgica como PDF con jsPDF + autotable
 * @param {Object} solicitud - objeto completo de la solicitud con relations
 */
export async function exportSolicitudPDF(solicitud) {
  if (!solicitud) throw new Error('No se encontró la solicitud')
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF()
  const margin = 14
  const pageW = doc.internal.pageSize.getWidth()

  // Cabecera
  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDEN DE CIRUGÍA', margin, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Emitida: ${new Date().toLocaleDateString('es-CL')}`, pageW - margin, 12, { align: 'right' })
  const estadoBadge = (solicitud.estado || '').toUpperCase()
  doc.text(`Estado: ${estadoBadge}`, pageW - margin, 21, { align: 'right' })

  let y = 36

  // Datos del paciente
  doc.setFontSize(11)
  doc.setTextColor(30, 64, 175)
  doc.setFont('helvetica', 'bold')
  doc.text('DATOS DEL PACIENTE', margin, y)
  y += 2

  const previsionLabel = PREVISION_LABELS[solicitud.patients?.prevision] || solicitud.patients?.prevision || 'No especificada'
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } },
    body: [
      ['Nombre completo', `${solicitud.patients?.nombre || ''} ${solicitud.patients?.apellido || ''}`],
      ['RUT', maskRut(solicitud.patients?.rut)],
      ['Previsión de Salud', previsionLabel],
      ['Teléfono', maskTelefono(solicitud.patients?.telefono)],
    ],
  })

  y = doc.lastAutoTable.finalY + 8

  // Datos del doctor
  doc.setFontSize(11)
  doc.setTextColor(30, 64, 175)
  doc.setFont('helvetica', 'bold')
  doc.text('MÉDICO TRATANTE', margin, y)
  y += 2

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } },
    body: [
      ['Nombre', `Dr. ${solicitud.doctors?.nombre || ''} ${solicitud.doctors?.apellido || ''}`],
      ['Especialidad', (solicitud.doctors?.especialidad || '—').replace('_', ' ')],
    ],
  })

  y = doc.lastAutoTable.finalY + 8

  // Datos de la operación
  doc.setFontSize(11)
  doc.setTextColor(30, 64, 175)
  doc.setFont('helvetica', 'bold')
  doc.text('OPERACIÓN', margin, y)
  y += 2

  const fechaHora = solicitud.fecha_preferida
    ? `${new Date(solicitud.fecha_preferida + 'T12:00:00').toLocaleDateString('es-CL')}${solicitud.hora_recomendada ? ' · ' + String(solicitud.hora_recomendada).slice(0, 5) : ''}${solicitud.hora_fin_recomendada ? '–' + String(solicitud.hora_fin_recomendada).slice(0, 5) : ''}`
    : 'A definir por pabellón'

  const opRows = [
    ['Código operación', solicitud.codigo_operacion || '—'],
    ['Horario preferido', fechaHora],
  ]
  if (solicitud.observaciones) opRows.push(['Observaciones', solicitud.observaciones])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } },
    body: opRows,
  })

  y = doc.lastAutoTable.finalY + 8

  // Insumos
  if (solicitud.surgery_request_supplies?.length > 0) {
    doc.setFontSize(11)
    doc.setTextColor(30, 64, 175)
    doc.setFont('helvetica', 'bold')
    doc.text('INSUMOS REQUERIDOS', margin, y)
    y += 2

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'striped',
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 9 },
      head: [['Insumo', 'Código', 'Cantidad']],
      body: solicitud.surgery_request_supplies.map(item => [
        item.supplies?.nombre || '—',
        item.supplies?.codigo || '—',
        item.cantidad,
      ]),
    })

    y = doc.lastAutoTable.finalY + 8
  }

  // Pie de página
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Documento generado por el sistema de clínica · ${new Date().toLocaleString('es-CL')} · Pág. ${i}/${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    )
  }

  const nombre = `${solicitud.patients?.apellido || 'paciente'}_${solicitud.codigo_operacion || 'orden'}_${today()}`
  doc.save(`${nombre}.pdf`)
}

/**
 * Genera un contrato tipo de prestación de servicios quirúrgicos en PDF.
 * @param {Object} clinicInfo - Datos de la clínica (nombre, rut, telefono, email, direccion)
 */
export async function exportContratoPDF(clinicInfo = {}) {
  const { default: jsPDF } = await import('jspdf')

  const doc = new jsPDF()
  const margin = 20
  const pageW = doc.internal.pageSize.getWidth()
  const contentW = pageW - margin * 2

  const clinicNombre = clinicInfo.nombre || 'Clínica Quirúrgica'
  const clinicRut = clinicInfo.rut || '—'
  const clinicDir = clinicInfo.direccion || '—'
  const clinicTel = clinicInfo.telefono || '—'
  const clinicEmail = clinicInfo.email || '—'

  // Cabecera
  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, pageW, 32, 'F')
  doc.setFontSize(15)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('CONTRATO DE PRESTACIÓN DE SERVICIOS QUIRÚRGICOS', pageW / 2, 13, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(clinicNombre.toUpperCase(), pageW / 2, 23, { align: 'center' })

  let y = 44

  const section = (title) => {
    doc.setFontSize(10)
    doc.setTextColor(30, 64, 175)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin, y)
    doc.setDrawColor(30, 64, 175)
    doc.setLineWidth(0.3)
    doc.line(margin, y + 1.5, pageW - margin, y + 1.5)
    y += 7
  }

  const paragraph = (text) => {
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(text, contentW)
    doc.text(lines, margin, y)
    y += lines.length * 4.5 + 3
  }

  const field = (label, value) => {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80, 80, 80)
    doc.text(`${label}:`, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50, 50, 50)
    doc.text(value || '___________________________', margin + 40, y)
    y += 6
  }

  // Comparecientes
  section('I. COMPARECIENTES')
  paragraph(`En la ciudad de Santiago, a la fecha de firma del presente instrumento, comparecen:`)
  paragraph(`Por una parte, ${clinicNombre}, RUT ${clinicRut}, con domicilio en ${clinicDir}, teléfono ${clinicTel}, correo ${clinicEmail}, en adelante "LA CLÍNICA" o "EL PRESTADOR".`)
  paragraph(`Por otra parte, el paciente cuyos datos se indican a continuación, en adelante "EL PACIENTE":`)

  field('Nombre completo', '')
  field('RUT', '')
  field('Fecha de nacimiento', '')
  field('Teléfono de contacto', '')
  field('Correo electrónico', '')
  field('Previsión de salud', '')
  y += 2

  // Objeto
  section('II. OBJETO DEL CONTRATO')
  paragraph(`El presente contrato tiene por objeto regular la prestación de servicios de salud quirúrgica que ${clinicNombre} otorgará al PACIENTE, incluyendo el uso de pabellón quirúrgico, equipamiento médico, insumos, personal de pabellón y demás recursos necesarios para la realización del procedimiento acordado entre las partes.`)

  field('Código de procedimiento', '')
  field('Nombre del procedimiento', '')
  field('Médico tratante', '')
  field('Fecha estimada', '')
  y += 2

  // Precio y pago
  section('III. PRECIO Y FORMA DE PAGO')
  paragraph(`El valor total del procedimiento, incluyendo honorarios de pabellón, insumos y gastos administrativos, es el siguiente:`)
  field('Valor total (CLP)', '')
  field('Copago paciente', '')
  field('Cobertura previsional', '')
  paragraph(`El pago deberá realizarse de acuerdo a lo indicado por el área de admisión, con anterioridad a la fecha del procedimiento, salvo acuerdo expreso en contrario.`)
  y += 2

  // Obligaciones
  section('IV. OBLIGACIONES DE LAS PARTES')
  paragraph(`LA CLÍNICA se obliga a: (a) proporcionar los recursos humanos y materiales necesarios para el procedimiento; (b) resguardar la confidencialidad de los datos del paciente conforme a la Ley 20.584; (c) informar al paciente sobre el procedimiento, riesgos y alternativas.`)
  paragraph(`EL PACIENTE se obliga a: (a) entregar información veraz sobre su estado de salud; (b) cumplir las indicaciones preoperatorias y postoperatorias; (c) cancelar los valores comprometidos en los plazos acordados.`)

  if (y > 240) { doc.addPage(); y = 20 }

  // Consentimiento
  section('V. CONSENTIMIENTO INFORMADO')
  paragraph(`El PACIENTE declara haber sido informado de manera clara y comprensible sobre el procedimiento a realizar, sus riesgos, beneficios esperados y alternativas disponibles, otorgando su consentimiento libre e informado para su realización, en conformidad con la Ley 20.584 sobre derechos y deberes del paciente.`)

  // Privacidad
  section('VI. PRIVACIDAD Y PROTECCIÓN DE DATOS')
  paragraph(`Los datos personales del PACIENTE serán tratados conforme a la Ley 19.628 de Protección de la Vida Privada, utilizándose exclusivamente para la gestión de la atención médica. No serán cedidos a terceros sin consentimiento del titular, salvo obligación legal.`)

  // Firma
  section('VII. FIRMA')
  paragraph(`En señal de conformidad con todo lo expuesto, las partes suscriben el presente contrato en dos ejemplares de igual valor.`)
  y += 8

  const col1 = margin
  const col2 = pageW / 2 + 5

  doc.setFontSize(9)
  doc.setTextColor(50, 50, 50)
  doc.setDrawColor(100, 100, 100)
  doc.setLineWidth(0.2)

  doc.line(col1, y, col1 + 70, y)
  doc.line(col2, y, col2 + 70, y)
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.text('EL PRESTADOR', col1, y)
  doc.text('EL PACIENTE', col2, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text(clinicNombre, col1, y)
  doc.text('Nombre: ______________________', col2, y)
  y += 4
  doc.text(`RUT: ${clinicRut}`, col1, y)
  doc.text('RUT: ______________________', col2, y)
  y += 4
  doc.text('Firma: ______________________', col1, y)
  doc.text('Firma: ______________________', col2, y)
  y += 4
  doc.text('Fecha: ______________________', col1, y)
  doc.text('Fecha: ______________________', col2, y)

  // Pie de página
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${clinicNombre} · ${clinicDir} · Tel: ${clinicTel} · Pág. ${i}/${pages}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    )
  }

  doc.save(`contrato_tipo_${today()}.pdf`)
}

/**
 * Genera el manual de usuario del sistema en PDF.
 */
export async function exportManualPDF() {
  const { default: jsPDF } = await import('jspdf')

  const doc = new jsPDF()
  const margin = 18
  const pageW = doc.internal.pageSize.getWidth()
  const contentW = pageW - margin * 2

  const azul = [30, 64, 175]
  const grisOscuro = [30, 30, 30]
  const gris = [80, 80, 80]

  const addPage = () => { doc.addPage(); return 20 }

  const h1 = (text, yPos) => {
    doc.setFillColor(...azul)
    doc.rect(0, yPos - 7, pageW, 12, 'F')
    doc.setFontSize(13)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text(text, margin, yPos)
    return yPos + 10
  }

  const h2 = (text, yPos) => {
    doc.setFontSize(10)
    doc.setTextColor(...azul)
    doc.setFont('helvetica', 'bold')
    doc.text(text, margin, yPos)
    doc.setDrawColor(...azul)
    doc.setLineWidth(0.2)
    doc.line(margin, yPos + 1, pageW - margin, yPos + 1)
    return yPos + 7
  }

  const body = (text, yPos) => {
    doc.setFontSize(8.5)
    doc.setTextColor(...gris)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(text, contentW)
    doc.text(lines, margin, yPos)
    return yPos + lines.length * 4.2 + 2
  }

  const bullet = (items, yPos) => {
    doc.setFontSize(8.5)
    doc.setTextColor(...gris)
    doc.setFont('helvetica', 'normal')
    items.forEach(item => {
      doc.text('•', margin, yPos)
      const lines = doc.splitTextToSize(item, contentW - 6)
      doc.text(lines, margin + 5, yPos)
      yPos += lines.length * 4.2 + 1
    })
    return yPos + 2
  }

  // ── Portada ──────────────────────────────────────────────────────────────
  doc.setFillColor(...azul)
  doc.rect(0, 0, pageW, pageW, 'F')
  doc.setFontSize(26)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('MANUAL DE USUARIO', pageW / 2, 80, { align: 'center' })
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text('Sistema de Gestión Quirúrgica', pageW / 2, 96, { align: 'center' })
  doc.setFontSize(9)
  doc.setTextColor(180, 210, 255)
  doc.text(`Versión 1.0 · ${new Date().toLocaleDateString('es-CL')}`, pageW / 2, 110, { align: 'center' })
  doc.text('Para uso interno del personal autorizado', pageW / 2, 118, { align: 'center' })

  // ── Índice ───────────────────────────────────────────────────────────────
  doc.addPage()
  let y = 20
  doc.setFontSize(14)
  doc.setTextColor(...grisOscuro)
  doc.setFont('helvetica', 'bold')
  doc.text('ÍNDICE', margin, y); y += 10

  const indice = [
    ['1.', 'Introducción al sistema', '3'],
    ['2.', 'Acceso y autenticación', '3'],
    ['3.', 'Módulo Médico — Doctor', '4'],
    ['  3.1', 'Crear ficha de paciente y solicitud', '4'],
    ['  3.2', 'Gestionar solicitudes existentes', '5'],
    ['  3.3', 'Calendario de cirugías', '5'],
    ['  3.4', 'Lista de pacientes', '6'],
    ['4.', 'Módulo Pabellón', '6'],
    ['  4.1', 'Bandeja de solicitudes', '6'],
    ['  4.2', 'Programar y gestionar cirugías', '7'],
    ['  4.3', 'Calendario de pabellones', '7'],
    ['  4.4', 'Bloqueo de horarios', '8'],
    ['  4.5', 'Gestión de insumos', '8'],
    ['  4.6', 'Estadísticas', '9'],
    ['  4.7', 'Configuración de la clínica', '9'],
    ['5.', 'Notificaciones', '10'],
    ['6.', 'Seguridad y contraseñas', '10'],
  ]
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gris)
  indice.forEach(([num, titulo, pag]) => {
    doc.text(num, margin, y)
    doc.text(titulo, margin + 12, y)
    doc.text(pag, pageW - margin, y, { align: 'right' })
    y += 5.5
  })

  // ── Sección 1: Introducción ───────────────────────────────────────────────
  doc.addPage(); y = 20
  y = h1('1. INTRODUCCIÓN AL SISTEMA', y)
  y = body('El Sistema de Gestión Quirúrgica es una plataforma web diseñada para coordinar de manera eficiente las solicitudes de cirugías entre los médicos tratantes y el equipo de pabellón. El sistema permite crear solicitudes, programar cirugías, gestionar insumos y obtener reportes estadísticos.', y)
  y = body('El sistema cuenta con dos roles principales: Doctor (médico tratante) y Pabellón (personal administrativo del pabellón quirúrgico). Cada rol tiene acceso a módulos específicos según sus responsabilidades.', y)

  // ── Sección 2: Acceso ─────────────────────────────────────────────────────
  y += 3
  y = h2('2. ACCESO Y AUTENTICACIÓN', y)
  y = body('Para acceder al sistema, ingrese a la URL de la plataforma y seleccione el tipo de usuario (Doctor o Pabellón). Ingrese su correo electrónico y contraseña registrados.', y)
  y = bullet([
    'Si olvidó su contraseña, use el enlace "¿Olvidaste tu contraseña?" en la pantalla de inicio de sesión.',
    'Si tiene activado el factor de doble autenticación (2FA), se le pedirá el código de 6 dígitos de su aplicación autenticadora.',
    'Por seguridad, la sesión expirará automáticamente tras un período de inactividad.',
  ], y)

  // ── Sección 3: Módulo Doctor ──────────────────────────────────────────────
  if (y > 220) { y = addPage() }
  y += 3
  y = h1('3. MÓDULO MÉDICO — DOCTOR', y)

  y = h2('3.1 Crear Ficha de Paciente y Solicitud', y)
  y = body('Desde el menú lateral, seleccione "Nueva Solicitud". Complete el formulario en 4 secciones:', y)
  y = bullet([
    'Paciente: ingrese nombre, apellido, RUT (con formato 12.345.678-9) y previsión de salud. Si el paciente ya existe, los datos se completarán automáticamente al ingresar el RUT.',
    'Operación: seleccione el código de operación desde el buscador. El sistema mostrará el nombre y descripción del procedimiento.',
    'Insumos: agregue los insumos necesarios con sus cantidades. El sistema sugerirá automáticamente el pack de insumos recomendado para el código seleccionado.',
    'Horario: elija una fecha y hora preferida para la cirugía, o active "Dejar a Pabellón" para que el equipo de pabellón asigne el horario.',
  ], y)

  if (y > 220) { y = addPage() }
  y = h2('3.2 Gestionar Solicitudes Existentes', y)
  y = body('Desde "Mis Solicitudes" puede ver el estado de todas sus solicitudes. Estados disponibles:', y)
  y = bullet([
    'Pendiente: la solicitud fue enviada y espera que pabellón la procese.',
    'Aceptada: pabellón asignó fecha y hora. Se mostrará la información de la cirugía programada.',
    'Rechazada: pabellón rechazó la solicitud con un motivo. Puede revisar el motivo y crear una nueva solicitud.',
    'Cancelada: la cirugía fue cancelada.',
  ], y)
  y = body('Para solicitar reagendamiento de una cirugía ya programada, haga clic en "Reagendar" en la tarjeta correspondiente. Pabellón recibirá una notificación automática.', y)

  if (y > 220) { y = addPage() }
  y = h2('3.3 Calendario de Cirugías', y)
  y = body('El calendario muestra las cirugías programadas en vista semanal o mensual. Puede navegar entre fechas usando las flechas de navegación. Haga clic en cualquier cirugía para ver sus detalles.', y)
  y = body('También puede ver la disponibilidad de pabellones desde el ícono de disponibilidad, que muestra los slots libres en todos los pabellones activos.', y)

  if (y > 220) { y = addPage() }
  y = h2('3.4 Lista de Pacientes', y)
  y = body('En "Mis Pacientes" encontrará un listado de todos sus pacientes registrados. Puede buscar por nombre o RUT. Al expandir un paciente, verá:', y)
  y = bullet([
    'Previsión de salud (Fonasa, Isapre, Particular u Otro) — editable con el ícono de lápiz.',
    'Historial de cirugías realizadas con fechas y pabellón.',
    'Historial de solicitudes con estados.',
  ], y)

  // ── Sección 4: Módulo Pabellón ────────────────────────────────────────────
  y = addPage(); y = 20
  y = h1('4. MÓDULO PABELLÓN', y)

  y = h2('4.1 Bandeja de Solicitudes', y)
  y = body('La bandeja central muestra todas las solicitudes recibidas de los médicos. Puede filtrar por estado, doctor, código de operación, previsión del paciente y rango de fechas.', y)
  y = bullet([
    'Las solicitudes pendientes muestran un checkbox para selección múltiple.',
    'El botón "Gestionar Cupo" abre el modal de programación.',
    'El botón "Rechazar" permite rechazar una solicitud con un motivo obligatorio.',
    'Si el médico ya propuso un horario específico, aparece el botón "Aceptar Horario Médico".',
    'Use el botón Excel (esquina superior derecha) para exportar la lista filtrada actual.',
  ], y)

  if (y > 220) { y = addPage() }
  y = h2('4.2 Programar y Gestionar Cirugías', y)
  y = body('Al hacer clic en "Gestionar Cupo", se abre el modal de programación con una grilla visual de los 4 pabellones × slots horarios (7:00–19:00). Los colores indican:', y)
  y = bullet([
    'Blanco: slot disponible.',
    'Rojo/ocupado: ya tiene una cirugía asignada.',
    'Gris oscuro: bloqueado por el equipo de pabellón.',
  ], y)
  y = body('Seleccione pabellón, fecha, hora de inicio y fin. El sistema validará conflictos en tiempo real. Al confirmar, se crea la cirugía y se notifica al médico automáticamente.', y)

  if (y > 220) { y = addPage() }
  y = h2('4.3 Calendario de Pabellones', y)
  y = body('El calendario de pabellones muestra una vista semanal de todos los pabellones activos con sus cirugías programadas. Puede cambiar entre vista semanal y diaria. Haga clic en cualquier cirugía para ver los detalles completos de la solicitud.', y)

  if (y > 220) { y = addPage() }
  y = h2('4.4 Bloqueo de Horarios', y)
  y = body('Desde "Bloqueos" puede reservar rangos horarios en los pabellones para mantenimiento, limpieza u otros fines. Los slots bloqueados aparecerán en el calendario y no estarán disponibles para agendar cirugías.', y)
  y = bullet([
    'Ingrese fecha, pabellón, hora de inicio y fin.',
    'Opcionalmente agregue un motivo del bloqueo.',
    'Los bloqueos existentes se listan con opción de eliminar.',
  ], y)

  if (y > 220) { y = addPage() }
  y = h2('4.5 Gestión de Insumos', y)
  y = body('El módulo de insumos permite controlar el inventario quirúrgico. Puede:', y)
  y = bullet([
    'Ver el stock actual de cada insumo con alerta visual cuando está bajo el mínimo.',
    'Registrar movimientos de entrada (reposición) o salida (uso/merma).',
    'Crear y editar packs de insumos recomendados por código de operación.',
    'Exportar el inventario actual a Excel.',
  ], y)

  if (y > 220) { y = addPage() }
  y = h2('4.6 Estadísticas', y)
  y = body('El panel de estadísticas muestra métricas clave del pabellón: cirugías por período, distribución por estado, ocupación de pabellones, médicos más activos y uso de insumos. Puede filtrar por rango de fechas y exportar los datos.', y)

  if (y > 220) { y = addPage() }
  y = h2('4.7 Configuración de la Clínica', y)
  y = body('Desde Configuración puede actualizar los datos de la clínica (nombre, RUT, dirección, teléfono, email, logo) que aparecen en el portal del paciente y en los documentos exportados. También puede:', y)
  y = bullet([
    'Configurar la integración de WhatsApp para notificaciones automáticas.',
    'Programar y enviar recordatorios de cirugías a los médicos.',
    'Descargar un respaldo completo de los datos del sistema.',
    'Descargar el contrato tipo de prestación de servicios.',
  ], y)

  // ── Sección 5: Notificaciones ─────────────────────────────────────────────
  if (y > 220) { y = addPage() }
  y += 3
  y = h1('5. NOTIFICACIONES', y)
  y = body('El sistema genera notificaciones automáticas en las siguientes situaciones:', y)
  y = bullet([
    'Nueva solicitud creada: pabellón recibe alerta cuando un médico crea una solicitud.',
    'Cirugía programada: el médico es notificado cuando pabellón acepta y programa su solicitud.',
    'Solicitud rechazada: el médico recibe notificación con el motivo del rechazo.',
    'Reagendamiento solicitado: pabellón recibe alerta cuando un médico solicita cambio de fecha.',
    'Insumos bajo mínimo: alerta automática cuando el stock de un insumo cae bajo el mínimo definido.',
  ], y)
  y = body('Las notificaciones aparecen en el ícono de campana (esquina superior derecha). Las no leídas se marcan con un badge numérico rojo.', y)

  // ── Sección 6: Seguridad ──────────────────────────────────────────────────
  if (y > 220) { y = addPage() }
  y += 3
  y = h1('6. SEGURIDAD Y CONTRASEÑAS', y)
  y = body('Para mantener la seguridad de su cuenta:', y)
  y = bullet([
    'Use una contraseña de al menos 8 caracteres combinando letras mayúsculas, minúsculas, números y símbolos.',
    'Active el factor de doble autenticación (2FA) desde "Mi Perfil" → sección "Doble Factor de Autenticación". Use una aplicación como Google Authenticator o Authy.',
    'No comparta sus credenciales con otros usuarios. Cada persona debe tener su propia cuenta.',
    'Si sospecha que su cuenta fue comprometida, cambie su contraseña inmediatamente y contacte al administrador.',
    'Cierre sesión siempre al terminar su trabajo, especialmente desde equipos compartidos.',
  ], y)

  // Pie de página en todas las páginas
  const pages = doc.internal.getNumberOfPages()
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Sistema de Gestión Quirúrgica · Manual de Usuario · Pág. ${i - 1}/${pages - 1}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    )
  }

  doc.save(`manual_usuario_${today()}.pdf`)
}

/**
 * Exporta datos a CSV
 * @param {Array} data - Array de objetos a exportar
 * @param {Array<{key: string, label: string}>} columns
 * @param {string} filename - Nombre del archivo sin extensión
 */
export function exportToCSV(data, columns, filename = 'export') {
  if (!data || data.length === 0) {
    throw new Error('No hay datos para exportar')
  }

  const headers = columns.map(col => col.label).join(',')

  const rows = data.map(item =>
    columns.map(col => {
      let value = getNestedValue(item, col.key)
      if (value === null || value === undefined) {
        value = ''
      } else if (typeof value === 'object') {
        value = JSON.stringify(value)
      } else {
        value = String(value)
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`
        }
      }
      return value
    }).join(',')
  )

  const csvContent = [headers, ...rows].join('\n')
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `${filename}_${today()}.csv`)
}

/**
 * Exporta datos a Excel (.xlsx) usando exceljs
 * @param {Array} data - Array de objetos a exportar
 * @param {Array<{key: string, label: string}>} columns
 * @param {string} filename - Nombre del archivo sin extensión
 */
export async function exportToExcel(data, columns, filename = 'export') {
  if (!data || data.length === 0) {
    throw new Error('No hay datos para exportar')
  }

  const ExcelJS = (await import('exceljs')).default

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Datos')

  worksheet.columns = columns.map(col => ({
    header: col.label,
    key: col.key,
    width: 22,
  }))

  data.forEach(item => {
    const row = {}
    columns.forEach(col => {
      let value = getNestedValue(item, col.key)
      if (value === null || value === undefined) value = ''
      else if (typeof value === 'object') value = JSON.stringify(value)
      row[col.key] = value
    })
    worksheet.addRow(row)
  })

  // Cabeceras en negrita
  worksheet.getRow(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  triggerDownload(blob, `${filename}_${today()}.xlsx`)
}

// ── Helpers internos ────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0]
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function getNestedValue(obj, path) {
  if (!path) return obj
  return path.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) return acc[key]
    return null
  }, obj)
}
