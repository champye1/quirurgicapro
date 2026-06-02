import { supabase } from '../config/supabase'
import { logger } from './logger'

/**
 * Maneja errores de autenticación y red de forma consistente.
 * @returns true si el error fue manejado, false si debe manejarse normalmente
 */
export function handleMutationError(error: unknown, showError: (msg: string) => void): boolean {
  const errorMessage =
    error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ?? String(error) ?? 'Error desconocido'

  if (
    (error as { status?: number })?.status === 401 ||
    (error as { code?: string })?.code === 'PGRST301' ||
    errorMessage.includes('JWT') ||
    errorMessage.includes('expired') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('Invalid JWT')
  ) {
    logger.warn('Sesión expirada detectada. Redirigiendo al login...')
    supabase.auth.signOut().finally(() => { window.location.href = '/' })
    return true
  }

  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
    showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
    return true
  }

  return false
}
