/**
 * Utilidad para limpiar datos almacenados en localStorage y sessionStorage
 * Se usa al cerrar sesión para prevenir exposición de datos sensibles
 */

import { clearAllLoginAttempts } from './rateLimiter'
import { logger } from './logger'

/**
 * Limpia todos los datos de la aplicación almacenados en el navegador
 * Se debe llamar al cerrar sesión
 */
export function clearAllAppData() {
  try {
    // Limpiar intentos de login
    clearAllLoginAttempts()

    // Limpiar datos de solicitudes quirúrgicas
    sessionStorage.removeItem('solicitud_gestionando')
    sessionStorage.removeItem('slot_seleccionado')
    sessionStorage.removeItem('validating_login')

    // Limpiar recordatorios temporales
    localStorage.removeItem('recordatorio-temporal')

    // El tema se mantiene (no es sensible)
    // localStorage.removeItem('app-theme') // Opcional: descomentar si quieres resetear el tema también
  } catch (error) {
    logger.errorWithContext('Error al limpiar datos de almacenamiento', error)
  }
}

