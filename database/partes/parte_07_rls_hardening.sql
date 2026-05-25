-- =====================================================================
-- PARTE 7: HARDENING DE RLS Y VISTAS
-- Ejecutar después de parte_06_datos.sql
-- Correcciones de seguridad identificadas en auditoría 2026-05-25
-- =====================================================================

-- ─────────────────────────────────────────────
-- 1. VISTAS: activar security_invoker
--    Sin esto las vistas corren con los permisos
--    del dueño (postgres) y omiten las políticas
--    RLS del usuario que consulta.
-- ─────────────────────────────────────────────
ALTER VIEW public.v_cirugias_hoy         SET (security_invoker = on);
ALTER VIEW public.v_ocupacion_hora       SET (security_invoker = on);
ALTER VIEW public.v_solicitudes_pendientes SET (security_invoker = on);
ALTER VIEW public.v_estados_horas        SET (security_invoker = on);

-- ─────────────────────────────────────────────
-- 2. AUDIT_LOGS: restringir INSERT
--    El GRANT INSERT TO anon permite a usuarios
--    no autenticados escribir logs falsos vía API.
--    Los triggers son SECURITY DEFINER y no
--    necesitan este permiso.
-- ─────────────────────────────────────────────
REVOKE INSERT ON public.audit_logs FROM anon;

-- Reemplazar política de INSERT sin restricción por una acotada:
-- solo service_role (edge functions / triggers) puede insertar
-- directamente via API. Los triggers DB bypasean RLS de todas formas.
DROP POLICY IF EXISTS "Sistema puede crear logs de auditoría" ON public.audit_logs;

CREATE POLICY "Solo service_role puede insertar logs de auditoría"
    ON public.audit_logs FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 3. NOTIFICATIONS: evitar que un rol autenticado
--    cree notificaciones para cualquier user_id.
--    Los doctores no deben poder crear notificaciones
--    para pabellón ni para otros doctores.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Sistema puede crear notificaciones" ON public.notifications;

-- Pabellón puede crear notificaciones (útil para avisos manuales)
CREATE POLICY "Pabellón puede crear notificaciones"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (is_pabellon());

-- service_role (edge functions) puede crear para cualquier usuario
CREATE POLICY "Service role puede crear notificaciones"
    ON public.notifications FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 4. SURGERY_SCHEDULE_HISTORY: acotar INSERT
--    Los reagendamientos los inserta un trigger
--    SECURITY DEFINER, no el frontend directamente.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Sistema puede crear historial" ON public.surgery_schedule_history;

CREATE POLICY "Service role puede crear historial de reagendamientos"
    ON public.surgery_schedule_history FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Pabellón también puede insertar (en caso de flujos manuales)
CREATE POLICY "Pabellón puede crear historial de reagendamientos"
    ON public.surgery_schedule_history FOR INSERT
    TO authenticated
    WITH CHECK (is_pabellon());

-- ─────────────────────────────────────────────
-- 5. REMINDERS: eliminar política duplicada
--    Existían dos INSERT policies solapadas.
--    Se unifican: usuario propio O pabellón (para avisos cruzados).
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Usuarios pueden crear sus propios recordatorios" ON public.reminders;
DROP POLICY IF EXISTS "Pabellón puede crear recordatorios"              ON public.reminders;

CREATE POLICY "Usuarios crean sus propios recordatorios"
    ON public.reminders FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Pabellón puede crear recordatorios para cualquier usuario"
    ON public.reminders FOR INSERT
    TO authenticated
    WITH CHECK (is_pabellon());

-- ─────────────────────────────────────────────
-- 6. Confirmar que RLS sigue habilitado en todas
--    las tablas (idempotente — no hace daño re-ejecutar)
-- ─────────────────────────────────────────────
ALTER TABLE public.users                    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.doctors                  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.patients                 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_requests         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.surgeries                FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_schedule_history FORCE ROW LEVEL SECURITY;
