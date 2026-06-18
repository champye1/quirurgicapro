import { createClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger'

// IMPORTANTE: Reemplazar con tus credenciales de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tu-proyecto.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'tu-anon-key'

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('tu-proyecto')) {
  logger.warn('⚠️ Configura las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    // Backoff exponencial: 2s, 4s, 8s... máx 30s — evita spam de reintentos
    reconnectAfterMs: (tries) => Math.min(Math.pow(2, tries) * 2000, 30000),
    // Máximo 5 reintentos antes de rendirse
    timeout: 10000,
  },
})
