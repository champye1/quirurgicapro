import * as Sentry from '@sentry/react'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  const env = import.meta.env.VITE_APP_ENV || 'development'

  // Solo inicializar en producción y cuando haya DSN configurado
  if (!dsn || env !== 'production') return

  Sentry.init({
    dsn,
    environment: env,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Capturar 10% de transacciones para performance monitoring
    tracesSampleRate: 0.1,
    // No enviar errores en desarrollo
    beforeSend(event) {
      if (env !== 'production') return null
      return event
    },
  })
}

export { Sentry }
