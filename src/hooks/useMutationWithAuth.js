import { useMutation } from '@tanstack/react-query'
import { supabase } from '../config/supabase'
import { logger } from '../utils/logger'
import { useNotifications } from './useNotifications'

/**
 * Hook personalizado que envuelve useMutation con manejo automático de errores de autenticación
 * Maneja errores 401 (sesión expirada) y errores de red automáticamente
 */
export function useMutationWithAuth(options = {}) {
  const { showError } = useNotifications()

  // Manejar errores de autenticación y red
  const handleError = (error) => {
    const errorMessage = error?.message || error?.toString() || 'Error desconocido'
    
    // Manejar sesión expirada (401)
    if (error?.status === 401 || errorMessage?.includes('JWT') || errorMessage?.includes('expired') || errorMessage?.includes('unauthorized')) {
      logger.warn('Sesión expirada detectada en mutación')
      supabase.auth.signOut().then(() => {
        window.location.href = '/'
      })
      return
    }

    // Manejar errores de red
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      showError('Error de conexión. Verifique su conexión a internet e intente nuevamente.')
      return
    }

    // Llamar al handler de error personalizado si existe
    if (options.onError) {
      options.onError(error)
    } else {
      // Handler por defecto
      showError(`Error: ${errorMessage}`)
    }
  }

  return useMutation({
    ...options,
    onError: handleError,
  })
}
