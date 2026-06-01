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
    const supabaseUrl        = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ success: false, error: 'Variables de entorno no configuradas' }, 500, corsHeaders)
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── Verificar que el caller sea un usuario pabellón autenticado ──────────
    const authHeader = req.headers.get('Authorization') || ''
    const callerToken = authHeader.replace('Bearer ', '').trim()
    if (!callerToken) {
      return json({ success: false, error: 'No autorizado.' }, 401, corsHeaders)
    }
    const { data: { user: callerUser }, error: callerErr } = await supabaseAdmin.auth.getUser(callerToken)
    if (callerErr || !callerUser) {
      return json({ success: false, error: 'No autorizado.' }, 401, corsHeaders)
    }
    const { data: callerRole } = await supabaseAdmin
      .from('users').select('role').eq('id', callerUser.id).maybeSingle()
    if (callerRole?.role !== 'pabellon') {
      return json({ success: false, error: 'Acceso denegado. Solo el equipo de pabellón puede eliminar usuarios.' }, 403, corsHeaders)
    }
    // ─────────────────────────────────────────────────────────────────────────

    const body = await req.json().catch(() => ({}))
    const { userId, email, force } = body

    if (!userId && !email) {
      return json({ success: false, error: 'Debes proporcionar userId o email' }, 400, corsHeaders)
    }

    let targetUserId = userId as string | undefined

    if (!targetUserId && email) {
      const { data: users, error: searchError } = await supabaseAdmin.auth.admin.listUsers()
      if (searchError) return json({ success: false, error: `Error al buscar usuario: ${searchError.message}` }, 500, corsHeaders)
      const user = users.users.find((u: { email?: string }) => u.email?.toLowerCase() === (email as string).toLowerCase())
      if (!user) return json({ success: false, error: `No se encontró usuario con el email indicado` }, 404, corsHeaders)
      targetUserId = user.id
    }

    const { data: userData } = await supabaseAdmin
      .from('users').select('id, role').eq('id', targetUserId).single()

    if (userData?.role === 'doctor') {
      const { data: doctorData } = await supabaseAdmin
        .from('doctors').select('id').eq('user_id', targetUserId).single()

      if (doctorData) {
        const doctorId = doctorData.id
        const [{ count: p }, { count: r }, { count: s }] = await Promise.all([
          supabaseAdmin.from('patients').select('*', { count: 'exact', head: true }).eq('doctor_id', doctorId),
          supabaseAdmin.from('surgery_requests').select('*', { count: 'exact', head: true }).eq('doctor_id', doctorId),
          supabaseAdmin.from('surgeries').select('*', { count: 'exact', head: true }).eq('doctor_id', doctorId),
        ])
        if (((p ?? 0) > 0 || (r ?? 0) > 0 || (s ?? 0) > 0) && !force) {
          return json({
            success: false,
            error: 'El usuario tiene datos relacionados. Envíe force: true para confirmar la eliminación.',
            details: { pacientes: p ?? 0, solicitudes: r ?? 0, cirugias: s ?? 0 },
          }, 409, corsHeaders)
        }
      }
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId!)
    if (deleteError) return json({ success: false, error: `Error al eliminar: ${deleteError.message}` }, 500, corsHeaders)

    return json({ success: true, message: 'Usuario eliminado exitosamente' }, 200, corsHeaders)

  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : 'Error desconocido' }, 500, corsHeaders)
  }
})
