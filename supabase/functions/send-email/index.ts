import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// =====================================================
// EDGE FUNCTION: send-email
// Envía emails usando la cuenta Gmail configurada en
// clinic_settings (mismas credenciales que poll-gmail).
//
// El refresh_token debe tener scope: gmail.send o
// https://mail.google.com/
//
// POST body: { to, subject, html, text? }
// =====================================================

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API_BASE  = 'https://gmail.googleapis.com/gmail/v1/users/me'

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(s => s.trim()) ?? []
  const allowOrigin = allowed.length > 0 && origin && allowed.includes(origin) ? origin : (allowed[0] ?? '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

/** Elimina tags de script/iframe/evento del HTML para prevenir inyección */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/\bon\w+\s*=/gi, 'data-blocked=')
    .replace(/javascript\s*:/gi, '')
}

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Error obteniendo access_token: ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

/** Codifica un string UTF-8 a base64url (para el wrapper externo de la Gmail API) */
function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Codifica un string UTF-8 a base64 estándar (RFC 2045/2047 para partes MIME internas) */
function toBase64Standard(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary)
}

/** Codifica el Subject usando MIME encoded-word (UTF-8, base64 estándar per RFC 2047) */
function encodeMimeHeader(value: string): string {
  return `=?UTF-8?B?${toBase64Standard(value)}?=`
}

/** Construye el email RFC 2822 como string y lo codifica en base64url */
function buildRawEmail(params: {
  from: string
  to: string
  subject: string
  html: string
  text?: string
}): string {
  const boundary = `__boundary_${Date.now()}__`
  const parts: string[] = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${encodeMimeHeader(params.subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
  ]

  if (params.text) {
    parts.push(
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      toBase64Standard(params.text),
      '',
    )
  }

  parts.push(
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    toBase64Standard(params.html),
    '',
    `--${boundary}--`,
  )

  return toBase64Url(parts.join('\r\n'))
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const CORS_HEADERS = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseUrl        = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: 'Faltan variables de entorno de Supabase' }, 500, CORS_HEADERS)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Leer credenciales Gmail: primero cifradas (clinic_secrets), luego legacy (clinic_settings)
    let cfg: Record<string, string> = {}
    try {
      const { data: secretRow } = await supabase.rpc('read_clinic_secret', { p_key: 'gmail_config' })
      if (secretRow) cfg = JSON.parse(secretRow)
    } catch {
      const { data: settingsRow } = await supabase
        .from('clinic_settings').select('value').eq('key', 'gmail_config').maybeSingle()
      cfg = (settingsRow?.value as Record<string, string>) || {}
    }
    const gmailClientId     = cfg.client_id     || Deno.env.get('GMAIL_CLIENT_ID')     || ''
    const gmailClientSecret = cfg.client_secret || Deno.env.get('GMAIL_CLIENT_SECRET') || ''
    const gmailRefreshToken = cfg.refresh_token || Deno.env.get('GMAIL_REFRESH_TOKEN') || ''
    const gmailEmail        = cfg.email         || Deno.env.get('GMAIL_FROM_EMAIL')    || ''

    if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken || !gmailEmail) {
      return json({ error: 'Gmail no configurado. Ve a Correos → Configurar Gmail.' }, 500, CORS_HEADERS)
    }

    // Validar body
    let body: { to?: string; subject?: string; html?: string; text?: string }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Body JSON inválido' }, 400, CORS_HEADERS)
    }

    const { to, subject, html: rawHtml, text } = body
    if (!to || !subject || !rawHtml) {
      return json({ error: 'Faltan campos requeridos: to, subject, html' }, 400, CORS_HEADERS)
    }
    const html = sanitizeHtml(rawHtml)

    // Validar formato de email destino
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return json({ error: 'Dirección de destino inválida' }, 400, CORS_HEADERS)
    }

    const accessToken = await getAccessToken(gmailClientId, gmailClientSecret, gmailRefreshToken)

    // Leer nombre de clínica desde configuración (fallback a nombre genérico)
    const { data: clinicRow } = await supabase
      .from('clinic_settings')
      .select('value')
      .eq('key', 'clinic_info')
      .maybeSingle()
    const clinicNombre = (clinicRow?.value as Record<string, string>)?.nombre || 'Portal Clínico'

    const raw = buildRawEmail({
      from:    `${clinicNombre} <${gmailEmail}>`,
      to,
      subject,
      html,
      text,
    })

    const res = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      // Scope insuficiente: el refresh_token fue generado sin gmail.send
      if (res.status === 403) {
        throw new Error(
          'Permisos insuficientes. El refresh_token necesita el scope gmail.send. ' +
          'Regenera las credenciales OAuth con acceso completo a Gmail.'
        )
      }
      throw new Error(`Gmail API error ${res.status}: ${JSON.stringify(err)}`)
    }

    const data = await res.json()
    return json({ success: true, messageId: data.id }, 200, CORS_HEADERS)

  } catch (error) {
    console.error('Error en send-email:', error)
    return json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500, CORS_HEADERS)
  }
})

function json(data: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
