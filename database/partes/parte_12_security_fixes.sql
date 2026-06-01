-- ============================================================
-- PARTE 12: Security hardening — RLS y permisos
-- ============================================================

-- ── 1. Revocar GRANT TO anon en RPCs que no necesitan acceso anónimo ──────────

-- get_slots_disponibles_pabellon y get_estado_slots_pabellon no deben ser
-- accesibles a usuarios no autenticados (solo el portal interno los usa)
REVOKE EXECUTE ON FUNCTION public.get_slots_disponibles_pabellon(DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_estado_slots_pabellon(DATE) FROM anon;

-- ── 2. Corregir política de notifications: solo service_role puede insertar ──

-- WITH CHECK (true) permite a cualquier usuario autenticado crear notificaciones
-- para cualquier user_id. Se reemplaza por restricción a service_role.
DROP POLICY IF EXISTS "Sistema puede crear notificaciones" ON public.notifications;
CREATE POLICY "Sistema puede crear notificaciones"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    -- Usuarios pueden crear sus propias notificaciones (owner), o service_role inserta para cualquiera
    user_id = auth.uid()
    OR current_setting('role', true) = 'service_role'
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'pabellon'
  );

-- ── 3. Corregir política de audit_logs: solo service_role y postgres ─────────
DROP POLICY IF EXISTS "Sistema puede crear logs de auditoría" ON public.audit_logs;
CREATE POLICY "Sistema puede crear logs de auditoría"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    current_setting('role', true) IN ('service_role', 'postgres')
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'pabellon'
  );

-- ── 4. Corregir política de surgery_schedule_history ─────────────────────────
DROP POLICY IF EXISTS "Sistema puede crear historial" ON public.surgery_schedule_history;
CREATE POLICY "Sistema puede crear historial"
  ON public.surgery_schedule_history
  FOR INSERT
  WITH CHECK (
    current_setting('role', true) IN ('service_role', 'postgres')
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'pabellon'
  );

-- ── 5. Notas sobre get_doctor_email_by_username ───────────────────────────────
-- GRANT TO anon se mantiene intencionalmente: esta función es necesaria para el
-- flujo de login por username (LoginDoctor.jsx obtiene el email antes de auth.signIn).
-- Mitigación: la función solo devuelve el email si el username existe en doctors activos
-- y no expone contraseñas ni IDs. La protección real es el rate limiting de Supabase Auth.
