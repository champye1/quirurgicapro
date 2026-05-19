import { supabase } from '../config/supabase'

/**
 * Envía un email usando la edge function send-email (Gmail OAuth).
 * @param {Object} params
 * @param {string} params.to        - Destinatario (email)
 * @param {string} params.subject   - Asunto
 * @param {string} params.html      - Cuerpo HTML
 * @param {string} [params.text]    - Cuerpo texto plano (opcional, fallback)
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendEmail({ to, subject, html, text }) {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, subject, html, text },
  })

  if (error) throw new Error(error.message || 'Error al enviar email')
  if (data?.error) throw new Error(data.error)

  return data
}

// ── Plantillas predefinidas ────────────────────────────────────────────────

export function templateConfirmacionCirugia({ nombreDoctor, nombrePaciente, fechaCirugia, tipoCirugia, pabellon }) {
  const subject = `Confirmación de cirugía — ${nombrePaciente}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e3a5f; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">QuirúrgicaPro</h1>
        <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Sistema de Gestión Quirúrgica</p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151;">Estimado/a Dr/a. <strong>${nombreDoctor}</strong>,</p>
        <p style="color: #374151;">Su cirugía ha sido <strong style="color: #16a34a;">confirmada</strong> con los siguientes detalles:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; background: #f1f5f9; color: #64748b; font-size: 13px; width: 40%;">Paciente</td><td style="padding: 8px; font-weight: 600; color: #1e293b;">${nombrePaciente}</td></tr>
          <tr><td style="padding: 8px; background: #f1f5f9; color: #64748b; font-size: 13px;">Tipo de cirugía</td><td style="padding: 8px; font-weight: 600; color: #1e293b;">${tipoCirugia}</td></tr>
          <tr><td style="padding: 8px; background: #f1f5f9; color: #64748b; font-size: 13px;">Fecha y hora</td><td style="padding: 8px; font-weight: 600; color: #1e293b;">${fechaCirugia}</td></tr>
          <tr><td style="padding: 8px; background: #f1f5f9; color: #64748b; font-size: 13px;">Pabellón</td><td style="padding: 8px; font-weight: 600; color: #1e293b;">${pabellon}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Este es un mensaje automático de QuirúrgicaPro. Por favor no responda a este correo.
        </p>
      </div>
    </div>
  `
  const text = `Confirmación de cirugía\n\nPaciente: ${nombrePaciente}\nTipo: ${tipoCirugia}\nFecha: ${fechaCirugia}\nPabellón: ${pabellon}`
  return { subject, html, text }
}

export function templateRechazoSolicitud({ nombreDoctor, nombrePaciente, motivo }) {
  const subject = `Solicitud rechazada — ${nombrePaciente}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e3a5f; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">QuirúrgicaPro</h1>
        <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Sistema de Gestión Quirúrgica</p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151;">Estimado/a Dr/a. <strong>${nombreDoctor}</strong>,</p>
        <p style="color: #374151;">Lamentamos informarle que su solicitud de cirugía para el paciente <strong>${nombrePaciente}</strong> no pudo ser aprobada.</p>
        ${motivo ? `<p style="color: #374151;"><strong>Motivo:</strong> ${motivo}</p>` : ''}
        <p style="color: #374151;">Si tiene consultas, comuníquese directamente con el equipo de pabellón.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Este es un mensaje automático de QuirúrgicaPro.
        </p>
      </div>
    </div>
  `
  const text = `Solicitud rechazada\n\nPaciente: ${nombrePaciente}\n${motivo ? `Motivo: ${motivo}` : ''}`
  return { subject, html, text }
}
