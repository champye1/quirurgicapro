import { createClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger'

// IMPORTANTE: Reemplazar con tus credenciales de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yeruyhsbextzziaxtdzg.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllcnV5aHNiZXh0enppYXh0ZHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2OTk3OTYsImV4cCI6MjA4NDI3NTc5Nn0.Xy4FIOGSRY1qBGdUv8xs09OjDfJBHX1eNc3y9Nqw3bI'

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
