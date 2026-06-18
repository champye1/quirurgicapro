import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../config/supabase'
import { logger } from '../utils/logger'
import { useNotifications } from './useNotifications'

export function useRealtimeNotifications(userId, doctorId = null) {
  const queryClient = useQueryClient()
  const { showInfo } = useNotifications()

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    let notificationsChannel, requestsChannel, surgeriesChannel

    const onStatus = (status, err) => {
      if (err) logger.warn('Realtime:', status, err.message)
    }

    const init = async () => {
      // Verificar que REST funciona antes de abrir WebSockets
      const { error } = await supabase.from('users').select('id').limit(1)
      if (error || cancelled) return

      notificationsChannel = supabase
        .channel(`notifications:${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        }, (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
          showInfo(`Nueva notificación: ${payload.new?.titulo ?? 'Sin título'}`)
        })
        .subscribe(onStatus)

      requestsChannel = supabase
        .channel(`surgery_requests:${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'surgery_requests',
          ...(doctorId ? { filter: `doctor_id=eq.${doctorId}` } : {}),
        }, () => {
          queryClient.invalidateQueries({ queryKey: ['solicitudes'] })
          queryClient.invalidateQueries({ queryKey: ['solicitudes-doctor'] })
          queryClient.invalidateQueries({ queryKey: ['solicitudes-pendientes'] })
        })
        .subscribe(onStatus)

      surgeriesChannel = supabase
        .channel(`surgeries:${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'surgeries',
        }, (payload) => {
          queryClient.invalidateQueries({ queryKey: ['cirugias-hoy'] })
          queryClient.invalidateQueries({ queryKey: ['cirugias-calendario'] })
          queryClient.invalidateQueries({ queryKey: ['calendario-anual-cirugias'] })
          queryClient.invalidateQueries({ queryKey: ['calendario-doctor-cirugias'] })
          queryClient.invalidateQueries({ queryKey: ['cirugias-dia-detalle'] })
          queryClient.invalidateQueries({ queryKey: ['cirugias-fecha'] })
          if (payload.eventType === 'UPDATE' && payload.new?.estado === 'cancelada' && payload.old?.estado === 'programada') {
            showInfo('Una cirugía ha sido cancelada')
          }
        })
        .subscribe(onStatus)
    }

    init()

    return () => {
      cancelled = true
      if (notificationsChannel) supabase.removeChannel(notificationsChannel)
      if (requestsChannel) supabase.removeChannel(requestsChannel)
      if (surgeriesChannel) supabase.removeChannel(surgeriesChannel)
    }
  }, [userId, doctorId, queryClient, showInfo])
}
