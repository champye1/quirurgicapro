import { supabase } from '../config/supabase'

export async function testSupabaseConnection() {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (!url || !key || url.includes('tu-proyecto')) {
      return {
        connected: false,
        error: 'Las credenciales de Supabase no están configuradas correctamente',
      }
    }

    const { error } = await supabase.from('users').select('count').limit(1)

    if (error) {
      return { connected: false, error: error.message, code: error.code }
    }

    return { connected: true }
  } catch (err) {
    return { connected: false, error: err.message }
  }
}
