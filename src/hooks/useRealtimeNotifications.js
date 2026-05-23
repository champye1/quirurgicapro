import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../config/supabase'
import { logger } from '../utils/logger'
import { useNotifications } from './useNotifications'

/**
 * Hook para escuchar notificaciones en tiempo real usando Supabase Realtime
 * @param {string} userId - ID del usuario actual
 */
export function useRealtimeNotifications(userId) {
  const queryClient = useQueryClient()
  const { showSuccess, showInfo } = useNotifications()

  useEffect(() => {
    if (!userId) return

    // Canal para notificaciones
    const notificationsChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          logger.debug('Nueva notificación recibida:', payload.new)
          queryClient.invalidateQueries(['notifications'])
          showInfo(`Nueva notificación: ${payload.new.titulo}`)
        }
      )
      .subscribe()

    // Canal para cambios en solicitudes (solo para doctores)
    const requestsChannel = supabase
      .channel(`surgery_requests:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'surgery_requests',
        },
        (payload) => {
          logger.debug('Cambio en solicitud:', payload.new)
          queryClient.invalidateQueries(['solicitudes'])
          queryClient.invalidateQueries(['solicitudes-doctor'])
          queryClient.invalidateQueries(['solicitudes-pendientes'])
          
          // Notificar cambios de estado importantes
          if (payload.new?.estado === 'aceptada' && payload.old?.estado === 'pendiente') {
            showSuccess('Tu solicitud ha sido aceptada')
          } else if (payload.new?.estado === 'rechazada' && payload.old?.estado === 'pendiente') {
            showInfo('Tu solicitud ha sido rechazada')
          }
        }
      )
      .subscribe()

    // Canal para cambios en cirugías
    const surgeriesChannel = supabase
      .channel(`surgeries:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'surgeries',
        },
        (payload) => {
          logger.debug('Cambio en cirugía:', payload)
          queryClient.invalidateQueries(['cirugias-hoy'])
          queryClient.invalidateQueries(['cirugias-calendario'])
          queryClient.invalidateQueries(['calendario-anual-cirugias'])
          queryClient.invalidateQueries(['calendario-doctor-cirugias'])
          queryClient.invalidateQueries(['cirugias-dia-detalle'])
          queryClient.invalidateQueries(['cirugias-fecha'])
          
          // Notificar cancelaciones
          if (payload.eventType === 'UPDATE' && payload.new?.estado === 'cancelada' && payload.old?.estado === 'programada') {
            showInfo('Una cirugía ha sido cancelada')
          }
        }
      )
      .subscribe()

    // Cleanup
    return () => {
      supabase.removeChannel(notificationsChannel)
      supabase.removeChannel(requestsChannel)
      supabase.removeChannel(surgeriesChannel)
    }
  }, [userId, queryClient, showSuccess, showInfo])
}
