import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// =====================================================
// EDGE FUNCTION: save-clinic-secret
// Guarda configuración sensible (Gmail, WhatsApp) cifrada en clinic_secrets.
// El cifrado ocurre en PostgreSQL con pgcrypto + clave maestra server-side.
//
// POST body: { key: string, value: Record<string, unknown> }
// key: 'gmail_config' | 'whatsapp_config'
// =====================================================

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(s => s.trim()) ?? []
  const allowOrigin = allowed.length > 0 && origin && allowed.includes(origin) ? origin : (allowed[0] ?? '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

const ALLOWED_KEYS = ['gmail_config', 'whatsapp_config']

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const secretsKey  = Deno.env.get('CLINIC_SECRETS_KEY') ?? ''

    if (!supabaseUrl || !serviceKey) return json({ error: 'Variables de entorno no configuradas' }, 500, corsHeaders)
    if (!secretsKey || secretsKey.length < 16) {
      return json({ error: 'CLINIC_SECRETS_KEY no configurada. Agrégala en Supabase → Edge Functions → Secrets.' }, 500, corsHeaders)
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // Verificar caller es pabellón
    const callerToken = req.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? ''
    if (!callerToken) return json({ error: 'No autorizado.' }, 401, corsHeaders)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(callerToken)
    if (authErr || !user) return json({ error: 'No autorizado.' }, 401, corsHeaders)
    const { data: row } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    if (row?.role !== 'pabellon') return json({ error: 'Acceso denegado.' }, 403, corsHeaders)

    const body = await req.json().catch(() => null)
    if (!body?.key || !body?.value) return json({ error: 'Faltan campos: key, value' }, 400, corsHeaders)
    if (!ALLOWED_KEYS.includes(body.key)) return json({ error: `key inválida. Permitidas: ${ALLOWED_KEYS.join(', ')}` }, 400, corsHeaders)

    const valueStr = JSON.stringify(body.value)

    // Cifrar y guardar usando función SQL (pgcrypto con clave server-side)
    const { error: rpcErr } = await supabase.rpc('save_clinic_secret', {
      p_key: body.key,
      p_value: valueStr,
    })

    if (rpcErr) {
      // Fallback: si pgcrypto no está configurado, guardar en clinic_settings sin cifrar (legacy)
      console.warn('pgcrypto no disponible, guardando sin cifrar:', rpcErr.message)
      const { error: upsertErr } = await supabase
        .from('clinic_settings')
        .upsert({ key: body.key, value: body.value }, { onConflict: 'key' })
      if (upsertErr) throw upsertErr
      return json({ success: true, encrypted: false, warning: 'pgcrypto no configurado — datos sin cifrar' }, 200, corsHeaders)
    }

    return json({ success: true, encrypted: true }, 200, corsHeaders)

  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500, corsHeaders)
  }
})
