import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Variables de entorno no configuradas' }, 500, corsHeaders)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── Verificar que el caller sea un usuario pabellón autenticado ───────────
    const authHeader = req.headers.get('Authorization') || ''
    const callerToken = authHeader.replace('Bearer ', '').trim()
    if (!callerToken) return json({ error: 'No autorizado.' }, 401, corsHeaders)

    const { data: { user: caller }, error: callerErr } = await supabase.auth.getUser(callerToken)
    if (callerErr || !caller) return json({ error: 'No autorizado.' }, 401, corsHeaders)

    const { data: callerRow } = await supabase
      .from('users').select('role').eq('id', caller.id).maybeSingle()
    if (callerRow?.role !== 'pabellon') {
      return json({ error: 'Acceso denegado. Solo el equipo de pabellón puede cambiar contraseñas.' }, 403, corsHeaders)
    }
    // ─────────────────────────────────────────────────────────────────────────

    const { doctorId, password } = await req.json()

    if (!doctorId || !password) {
      return json({ error: 'Faltan datos requeridos (doctorId, password)' }, 400, corsHeaders)
    }

    if (typeof password !== 'string' || password.length < 8) {
      return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400, corsHeaders)
    }

    // Obtener user_id del doctor
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('user_id, nombre, apellido')
      .eq('id', doctorId)
      .is('deleted_at', null)
      .single()

    if (doctorError || !doctor) {
      return json({ error: 'Doctor no encontrado' }, 404, corsHeaders)
    }

    // Actualizar contraseña
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      doctor.user_id,
      { password }
    )

    if (updateError) throw updateError

    return json({ success: true }, 200, corsHeaders)

  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      500,
      getCorsHeaders(req.headers.get('origin'))
    )
  }
})
