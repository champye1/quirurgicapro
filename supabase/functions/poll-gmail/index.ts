import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// =====================================================
// EDGE FUNCTION: poll-gmail
// Lee emails no leídos de pabellontest@gmail.com y
// los inserta en la tabla external_messages.
//
// Secrets requeridos en Supabase Dashboard:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   GMAIL_CLIENT_ID
//   GMAIL_CLIENT_SECRET
//   GMAIL_REFRESH_TOKEN
//
// Invocar vía cron (pg_cron) cada 5 min:
//   SELECT cron.schedule('poll-gmail', '*/5 * * * *',
//     $$SELECT net.http_post(
//       url := '<SUPABASE_URL>/functions/v1/poll-gmail',
//       headers := '{"Authorization":"Bearer <SUPABASE_ANON_KEY>"}'
//     )$$
//   );
// =====================================================

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API_BASE  = 'https://gmail.googleapis.com/gmail/v1/users/me'

/** Obtiene un access_token usando el refresh_token de OAuth2 */
async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Error obteniendo access_token: ${err}`)
  }
  const data = await res.json()
  return data.access_token as string
}

/** Obtiene los IDs de mensajes no leídos en el inbox */
async function getUnreadMessageIds(accessToken: string): Promise<string[]> {
  const url = `${GMAIL_API_BASE}/messages?q=is:unread&maxResults=20`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Error listando mensajes: ${await res.text()}`)
  const data = await res.json()
  return (data.messages || []).map((m: { id: string }) => m.id)
}

/** Decodifica base64url a string UTF-8 */
function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

/** Extrae el texto plano del cuerpo del email */
function extractBody(payload: GmailPayload): string {
  // Buscar parte text/plain primero, luego text/html como fallback
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part)
      if (text) return text
    }
  }
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  return ''
}

interface GmailPayload {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPayload[]
}

interface ParsedEmail {
  gmailMessageId: string
  from: string
  fromEmail: string
  subject: string
  body: string
  date: string
  // Campos extraídos del cuerpo
  nombrePaciente: string | null
  rutPaciente: string | null
  tipoCirugia: string | null
  fechaSolicitada: string | null
  telefono: string | null
  urgencia: 'urgente' | 'normal' | 'electiva'
}

/** Intenta extraer datos clínicos del cuerpo del email con regex */
function extractClinicalData(body: string): {
  nombrePaciente: string | null
  rutPaciente: string | null
  tipoCirugia: string | null
  fechaSolicitada: string | null
  telefono: string | null
  urgencia: 'urgente' | 'normal' | 'electiva'
} {
  const b = body

  // RUT chileno (con o sin puntos)
  const rutMatch = b.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/)
  const rutPaciente = rutMatch ? rutMatch[0].replace(/\./g, '') : null

  // Nombre paciente: busca patrones como "Paciente: Juan Pérez" o "Nombre: ..."
  const nombreMatch = b.match(/(?:paciente|nombre del paciente|nombre)\s*[:\-]\s*([A-Za-zÁÉÍÓÚáéíóúÑñ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+)+)/i)
  const nombrePaciente = nombreMatch ? nombreMatch[1].trim() : null

  // Tipo de cirugía
  const cirugiaMatch = b.match(/(?:cirug[ií]a|procedimiento|intervenci[oó]n|operaci[oó]n)\s*[:\-]\s*([^\n\r,\.]{5,80})/i)
  const tipoCirugia = cirugiaMatch ? cirugiaMatch[1].trim() : null

  // Fecha solicitada: dd/mm/yyyy o dd-mm-yyyy
  const fechaMatch = b.match(/(?:fecha|fecha solicitada|fecha preferida|disponible el|para el)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i)
  const fechaSolicitada = fechaMatch ? fechaMatch[1] : null

  // Teléfono chileno
  const telefonoMatch = b.match(/(?:\+?56\s?)?(?:9\s?\d{4}\s?\d{4}|\d{8,9})/)
  const telefono = telefonoMatch ? telefonoMatch[0].trim() : null

  // Urgencia
  const bodyLower = b.toLowerCase()
  const urgencia: 'urgente' | 'normal' | 'electiva' =
    bodyLower.includes('urgente') || bodyLower.includes('urgencia alta')
      ? 'urgente'
      : bodyLower.includes('electiv')
      ? 'electiva'
      : 'normal'

  return { nombrePaciente, rutPaciente, tipoCirugia, fechaSolicitada, telefono, urgencia }
}

/** Parsea un mensaje de Gmail completo */
async function parseMessage(accessToken: string, messageId: string): Promise<ParsedEmail> {
  const url = `${GMAIL_API_BASE}/messages/${messageId}?format=full`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Error obteniendo mensaje ${messageId}: ${await res.text()}`)
  const msg = await res.json()

  const headers: { name: string; value: string }[] = msg.payload?.headers || []
  const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

  const fromRaw = getHeader('From')
  const subject  = getHeader('Subject') || '(Sin asunto)'
  const date     = getHeader('Date') || new Date().toISOString()

  // Extraer email del campo From (puede ser "Nombre <email>" o solo "email")
  const emailMatch = fromRaw.match(/<([^>]+)>/)
  const rawEmail  = emailMatch ? emailMatch[1] : fromRaw.trim()
  // Validar formato para prevenir header/mailto injection
  const fromEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : ''
  const fromName  = emailMatch ? fromRaw.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, '') : fromEmail

  const body = extractBody(msg.payload as GmailPayload)
  const clinical = extractClinicalData(body)

  return {
    gmailMessageId: messageId,
    from: fromName || fromEmail,
    fromEmail,
    subject,
    body,
    date,
    ...clinical,
  }
}

/** Marca un mensaje como leído en Gmail */
async function markAsRead(accessToken: string, messageId: string): Promise<void> {
  await fetch(`${GMAIL_API_BASE}/messages/${messageId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  })
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Variables de entorno
    const supabaseUrl        = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Leer credenciales: primero desde clinic_settings (BD), luego desde secrets
    const { data: settingsRow } = await supabase
      .from('clinic_settings')
      .select('value')
      .eq('key', 'gmail_config')
      .maybeSingle()

    const cfg = settingsRow?.value || {}
    const gmailClientId     = cfg.client_id     || Deno.env.get('GMAIL_CLIENT_ID')     || ''
    const gmailClientSecret = cfg.client_secret || Deno.env.get('GMAIL_CLIENT_SECRET') || ''
    const gmailRefreshToken = cfg.refresh_token || Deno.env.get('GMAIL_REFRESH_TOKEN') || ''

    if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken) {
      return new Response(JSON.stringify({
        error: 'Gmail no configurado. Ve a Bandeja de Correos → Configurar Gmail e ingresa las credenciales.',
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Obtener access token
    const accessToken = await getAccessToken(gmailClientId, gmailClientSecret, gmailRefreshToken)

    // 2. Obtener IDs de mensajes no leídos
    // 3. Obtener IDs de mensajes no leídos
    const messageIds = await getUnreadMessageIds(accessToken)

    if (messageIds.length === 0) {
      return new Response(JSON.stringify({ success: true, inserted: 0, message: 'No hay mensajes no leídos en Gmail', debug: { credentialsSource: settingsRow ? 'db' : 'env', hasClientId: !!gmailClientId, hasRefreshToken: !!gmailRefreshToken } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Filtrar IDs ya procesados
    const { data: existing } = await supabase
      .from('external_messages')
      .select('gmail_message_id')
      .in('gmail_message_id', messageIds)
      .is('deleted_at', null)

    const existingIds = new Set((existing || []).map(r => r.gmail_message_id))
    const newIds = messageIds.filter(id => !existingIds.has(id))

    // 4. Parsear e insertar mensajes nuevos
    let inserted = 0
    const errors: string[] = []

    for (const msgId of newIds) {
      try {
        const parsed = await parseMessage(accessToken, msgId)

        const { error: insertError } = await supabase
          .from('external_messages')
          .insert({
            gmail_message_id: parsed.gmailMessageId,
            fuente: 'gmail',
            nombre_remitente: parsed.from,
            email_remitente: parsed.fromEmail,
            telefono_remitente: parsed.telefono,
            asunto: parsed.subject,
            mensaje: parsed.body.substring(0, 2000),
            nombre_paciente: parsed.nombrePaciente,
            rut_paciente: parsed.rutPaciente,
            tipo_cirugia: parsed.tipoCirugia,
            urgencia: parsed.urgencia,
            leido: false,
          })

        if (insertError) {
          // Ignorar duplicados (unique constraint gmail_message_id)
          if (insertError.code !== '23505') {
            errors.push(`Error insertando ${msgId}: ${insertError.message}`)
          }
        } else {
          inserted++
          // Marcar como leído en Gmail para no volver a procesarlo
          await markAsRead(accessToken, msgId)
        }
      } catch (e) {
        errors.push(`Error procesando ${msgId}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      inserted,
      skipped: messageIds.length - newIds.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error en poll-gmail:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Error desconocido',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
