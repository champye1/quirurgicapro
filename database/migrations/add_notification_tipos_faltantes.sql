-- =====================================================
-- Agrega tipos de notificación faltantes que el código
-- frontend usa pero no estaban en el CHECK constraint.
--
-- Ejecutar en Supabase SQL Editor antes de desplegar.
-- =====================================================

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_tipo_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_tipo_check CHECK (
    tipo IN (
      'solicitud_aceptada',
      'solicitud_rechazada',
      'operacion_programada',
      'bloqueo_creado',
      'recordatorio',
      'solicitud_reagendamiento',
      'operacion_reagendada',
      'solicitud_cancelada',
      'orden_sin_agendar'
    )
  );
