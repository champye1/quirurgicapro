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

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { doctorId, password } = await req.json()

    if (!doctorId || !password) {
      throw new Error('Faltan datos requeridos (doctorId, password)')
    }

    // 1. Obtener el user_id del doctor
    const { data: doctor, error: doctorError } = await supabaseClient
      .from('doctors')
      .select('user_id')
      .eq('id', doctorId)
      .single()

    if (doctorError || !doctor) {
      throw new Error('Doctor no encontrado')
    }

    // 2. Actualizar contraseña del usuario
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      doctor.user_id,
      { password: password }
    )

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      },
    )
  }
})
