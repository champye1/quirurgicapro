import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(s => s.trim()) ?? []
  const allowOrigin = allowed.length > 0 && origin && allowed.includes(origin) ? origin : (allowed[0] ?? '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl        = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Leer credenciales WhatsApp desde clinic_settings
    const { data: settingsRow } = await supabase
      .from('clinic_settings')
      .select('value')
      .eq('key', 'whatsapp_config')
      .maybeSingle()

    const cfg = settingsRow?.value || {}
    const phoneNumberId = cfg.phone_number_id || ''
    const accessToken   = cfg.access_token || ''

    if (!phoneNumberId || !accessToken) {
      return new Response(JSON.stringify({
        error: 'WhatsApp no configurado. Ve a Configuración → WhatsApp e ingresa las credenciales.',
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verificar que el llamador sea un usuario pabellón autenticado
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'No autorizado.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: userRole } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (userRole?.role !== 'pabellon') {
      return new Response(JSON.stringify({ error: 'Acceso denegado.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Body JSON inválido.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { to, tipo, destinatario, nombrePaciente, nombreDoctor, fechaCirugia, observaciones } = body

    if (!to || typeof to !== 'string') {
      return new Response(JSON.stringify({ error: 'Falta el número de teléfono destino (string).' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Normalizar y validar formato E.164
    const telefono = to.replace(/\s/g, '')
    if (!/^\+[1-9]\d{7,14}$/.test(telefono)) {
      return new Response(JSON.stringify({ error: 'Número de teléfono inválido. Use formato +56912345678.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const esAceptada = tipo === 'aceptada'
    const emoji      = esAceptada ? '✅' : '❌'

    // Mensaje diferente según si el destinatario es el médico o el paciente
    const esPaciente = destinatario === 'paciente'
    const mensaje = esPaciente
      ? [
          `${emoji} *Confirmación de Hora Quirúrgica*`,
          ``,
          `Estimado/a *${nombrePaciente}*,`,
          ``,
          `Le informamos que su hora quirúrgica ha sido *${esAceptada ? 'confirmada ✅' : 'rechazada ❌'}*.`,
          fechaCirugia ? `📅 *Fecha programada:* ${fechaCirugia}` : null,
          observaciones ? `📝 *Información adicional:* ${observaciones}` : null,
          ``,
          esAceptada
            ? `Por favor preséntese con anticipación en la clínica el día de su cirugía.`
            : `Para más información, comuníquese con su médico tratante.`,
          ``,
          `_Clínica SurgicalHub_`,
        ].filter(Boolean).join('\n')
      : [
          `${emoji} *Solicitud de Cirugía ${esAceptada ? 'CONFIRMADA' : 'RECHAZADA'}*`,
          ``,
          `Estimado/a Dr/a. *${nombreDoctor}*,`,
          ``,
          `Su solicitud quirúrgica ha sido *${esAceptada ? 'aceptada' : 'rechazada'}*.`,
          ``,
          `👤 *Paciente:* ${nombrePaciente || 'No especificado'}`,
          fechaCirugia ? `📅 *Fecha:* ${fechaCirugia}` : null,
          observaciones ? `📝 *Observaciones:* ${observaciones}` : null,
          ``,
          `_Portal Clínico SurgicalHub_`,
        ].filter(Boolean).join('\n')

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefono,
          type: 'text',
          text: { body: mensaje },
        }),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Error Meta API', details: data }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, messageId: data.messages?.[0]?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Error desconocido',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
