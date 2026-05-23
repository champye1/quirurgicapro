// Utilidad para probar la conexión con Supabase
import { supabase } from '../config/supabase'

export async function testSupabaseConnection() {
  try {
    console.log('🔍 Probando conexión con Supabase...')
    
    // Verificar configuración
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    console.log('URL:', url ? '✅ Configurada' : '❌ No configurada')
    console.log('Key:', key ? '✅ Configurada' : '❌ No configurada')
    
    if (!url || !key || url.includes('tu-proyecto')) {
      return {
        connected: false,
        error: 'Las credenciales de Supabase no están configuradas correctamente',
        details: {
          url: url,
          keyConfigured: !!key && !key.includes('tu-anon-key')
        }
      }
    }
    
    // Intentar una consulta simple
    const { error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Error de conexión:', error)
      return {
        connected: false,
        error: error.message,
        code: error.code
      }
    }
    
    console.log('✅ Conexión exitosa con Supabase')
    return {
      connected: true,
      message: 'Conexión exitosa'
    }
  } catch (err) {
    console.error('❌ Error:', err)
    return {
      connected: false,
      error: err.message
    }
  }
}
