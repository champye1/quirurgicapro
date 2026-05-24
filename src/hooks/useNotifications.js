import { useCallback } from 'react'
import toast from 'react-hot-toast'

export function useNotifications() {
  const showSuccess = useCallback((message) => {
    toast.success(message, {
      icon: '✅',
      duration: 4000,
    })
  }, [])

  const showError = useCallback((message) => {
    toast.error(message, {
      icon: '❌',
      duration: 5000,
    })
  }, [])

  const showLoading = useCallback((message) => {
    return toast.loading(message)
  }, [])

  const dismiss = useCallback((toastId) => {
    toast.dismiss(toastId)
  }, [])

  const showInfo = useCallback((message) => {
    toast(message, {
      icon: 'ℹ️',
      duration: 4000,
    })
  }, [])

  return { showSuccess, showError, showLoading, dismiss, showInfo }
}
