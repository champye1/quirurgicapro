import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../config/supabase'
import { logger } from '../utils/logger'
import { useNotifications } from './useNotifications'

/**
 * Hook para escuchar notificaciones en tiempo real usando Supabase Realtime
 * @param {string} userId - ID del usuario actual
 */
export function useRealtimeNotifications(userId, doctorId = null) {
  const queryClient = useQueryClient()
  const { showInfo } = useNotifications()

  useEffect(() => {
    if (!userId) return

    const onRealtimeError = (status, err) => {
      if (err) logger.warn('Realtime:', status, err.message)
    }

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
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
          showInfo(`Nueva notificación: ${payload.new?.titulo ?? 'Sin título'}`)
        }
      )
      .subscribe(onRealtimeError)

    // Canal para cambios en solicitudes — filtrado por doctor cuando es posible
    const requestsChannel = supabase
      .channel(`surgery_requests:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'surgery_requests',
          ...(doctorId ? { filter: `doctor_id=eq.${doctorId}` } : {}),
        },
        (payload) => {
          logger.debug('Cambio en solicitud:', payload.new)
          queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
          queryClient.invalidateQueries({ queryKey: ['solicitudes-doctor'] })
          queryClient.invalidateQueries({ queryKey: ['solicitudes-pendientes'] })
        }
      )
      .subscribe(onRealtimeError)

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
          queryClient.invalidateQueries({ queryKey: ['cirugias-hoy'] })
          queryClient.invalidateQueries({ queryKey: ['cirugias-calendario'] })
          queryClient.invalidateQueries({ queryKey: ['calendario-anual-cirugias'] })
          queryClient.invalidateQueries({ queryKey: ['calendario-doctor-cirugias'] })
          queryClient.invalidateQueries({ queryKey: ['cirugias-dia-detalle'] })
          queryClient.invalidateQueries({ queryKey: ['cirugias-fecha'] })

          if (payload.eventType === 'UPDATE' && payload.new?.estado === 'cancelada' && payload.old?.estado === 'programada') {
            showInfo('Una cirugía ha sido cancelada')
          }
        }
      )
      .subscribe(onRealtimeError)

    // Cleanup
    return () => {
      supabase.removeChannel(notificationsChannel)
      supabase.removeChannel(requestsChannel)
      supabase.removeChannel(surgeriesChannel)
    }
  }, [userId, doctorId, queryClient, showInfo])
}
