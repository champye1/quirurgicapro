import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../config/supabase'
import { logger } from '../utils/logger'

/**
 * Hook para obtener la lista de notificaciones del usuario
 */
export function useNotificationsList(userId, options = {}) {
  const queryClient = useQueryClient()
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('notifications')
        .select('id, tipo, titulo, mensaje, vista, created_at, relacionado_con')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) {
        logger.errorWithContext('Error al obtener notificaciones', error)
        return []
      }
      return data || []
    },
    enabled: !!userId && (options.enabled !== false),
  })

  const markAsRead = useMutation({
    mutationFn: async (notificationId) => {
      const { error } = await supabase
        .from('notifications')
        .update({ vista: true })
        .eq('id', notificationId)
        .eq('user_id', userId)
      if (error) throw error
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', userId] })
      const previous = queryClient.getQueryData(['notifications', userId])
      queryClient.setQueryData(['notifications', userId], (old) =>
        (old ?? []).map(n => n.id === notificationId ? { ...n, vista: true } : n)
      )
      queryClient.setQueryData(['unread-notifications-count', userId], (old) =>
        Math.max(0, (old ?? 1) - 1)
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications', userId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count', userId] })
    },
  })

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ vista: true })
        .eq('user_id', userId)
        .eq('vista', false)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications', userId] })
      const previous = queryClient.getQueryData(['notifications', userId])
      queryClient.setQueryData(['notifications', userId], (old) =>
        (old ?? []).map(n => ({ ...n, vista: true }))
      )
      queryClient.setQueryData(['unread-notifications-count', userId], 0)
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications', userId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count', userId] })
    },
  })

  return { notifications, isLoading, markAsRead, markAllAsRead }
}
