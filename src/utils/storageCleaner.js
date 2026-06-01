/**
 * Utilidad para limpiar datos almacenados en localStorage y sessionStorage.
 * Se usa al cerrar sesión para prevenir exposición de datos sensibles.
 */

import { clearAllLoginAttempts } from './rateLimiter'
import { STORAGE_KEYS } from './storageKeys'
import { logger } from './logger'

/**
 * Limpia todos los datos de la aplicación almacenados en el navegador,
 * incluyendo los tokens de sesión de Supabase.
 */
export function clearAllAppData() {
  try {
    clearAllLoginAttempts()

    sessionStorage.removeItem('solicitud_gestionando')
    sessionStorage.removeItem('slot_seleccionado')
    sessionStorage.removeItem('validating_login')
    sessionStorage.removeItem('reagendar_solicitud_id')
    sessionStorage.removeItem('calendario_ir_hoy')
    sessionStorage.removeItem('session_expired')

    localStorage.removeItem(STORAGE_KEYS.RECORDATORIO_TEMPORAL)
    localStorage.removeItem('onboarding_medico_completed')

    // Limpiar tokens de sesión de Supabase (formato: sb-<project-ref>-auth-token)
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))

  } catch (error) {
    logger.errorWithContext('Error al limpiar datos de almacenamiento', error)
  }
}
