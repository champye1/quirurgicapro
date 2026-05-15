-- =====================================================================
-- PARTE 5 DE 6: VISTAS + ROW LEVEL SECURITY + REALTIME
-- Ejecutar después de parte_04_rpc.sql
-- =====================================================================

-- ─────────────────────────────────────────────
-- VISTAS
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_cirugias_hoy AS
SELECT s.id, s.fecha, s.hora_inicio, s.hora_fin, s.estado,
    d.nombre || ' ' || d.apellido AS doctor_nombre,
    p.nombre || ' ' || p.apellido AS paciente_nombre,
    or_nombre.nombre AS pabellon_nombre,
    sr.codigo_operacion
FROM public.surgeries s
JOIN public.doctors d ON s.doctor_id = d.id
JOIN public.patients p ON s.patient_id = p.id
JOIN public.operating_rooms or_nombre ON s.operating_room_id = or_nombre.id
JOIN public.surgery_requests sr ON s.surgery_request_id = sr.id
WHERE s.fecha = CURRENT_DATE AND s.deleted_at IS NULL
ORDER BY s.hora_inicio;

CREATE OR REPLACE VIEW v_ocupacion_hora AS
SELECT fecha, hora_inicio,
    COUNT(*) AS cirugias_programadas,
    COUNT(DISTINCT operating_room_id) AS pabellones_ocupados,
    (SELECT COUNT(*) FROM public.operating_rooms WHERE activo = true AND deleted_at IS NULL) AS total_pabellones
FROM public.surgeries
WHERE deleted_at IS NULL AND estado IN ('programada', 'en_proceso')
GROUP BY fecha, hora_inicio
ORDER BY fecha, hora_inicio;

CREATE OR REPLACE VIEW v_solicitudes_pendientes AS
SELECT sr.id, sr.codigo_operacion, sr.hora_recomendada, sr.observaciones, sr.created_at,
    d.nombre || ' ' || d.apellido AS doctor_nombre, d.especialidad,
    p.nombre || ' ' || p.apellido AS paciente_nombre, p.rut AS paciente_rut
FROM public.surgery_requests sr
JOIN public.doctors d ON sr.doctor_id = d.id
JOIN public.patients p ON sr.patient_id = p.id
WHERE sr.estado = 'pendiente' AND sr.deleted_at IS NULL
ORDER BY sr.created_at DESC;

CREATE OR REPLACE VIEW v_estados_horas AS
SELECT
    or_nombre.id AS operating_room_id,
    or_nombre.nombre AS pabellon_nombre,
    fecha_calendario.fecha,
    hora_calendario.hora,
    COALESCE(
        CASE
            WHEN cirugia.id IS NOT NULL THEN
                CASE WHEN cirugia.estado_hora = 'reagendado' THEN 'reagendado' ELSE 'agendado' END
            WHEN bloqueo.id IS NOT NULL THEN 'bloqueado'
            ELSE 'vacio'
        END, 'vacio'
    ) AS estado_hora,
    cirugia.id AS surgery_id,
    cirugia.patient_id,
    cirugia.doctor_id,
    cirugia.fecha_anterior,
    cirugia.hora_inicio_anterior,
    cirugia.fecha_ultimo_agendamiento,
    bloqueo.id AS block_id,
    bloqueo.motivo AS motivo_bloqueo,
    bloqueo.fecha_auto_liberacion
FROM public.operating_rooms or_nombre
CROSS JOIN (
    SELECT DISTINCT fecha::DATE AS fecha
    FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', INTERVAL '1 day') AS fecha
) fecha_calendario
CROSS JOIN (
    SELECT make_time(hora_num, 0, 0)::TIME AS hora FROM generate_series(8, 19) AS hora_num
) hora_calendario
LEFT JOIN public.surgeries cirugia ON
    cirugia.operating_room_id = or_nombre.id AND cirugia.fecha = fecha_calendario.fecha
    AND cirugia.hora_inicio <= hora_calendario.hora AND cirugia.hora_fin > hora_calendario.hora
    AND cirugia.deleted_at IS NULL AND cirugia.estado != 'cancelada'
    AND cirugia.estado_hora IN ('agendado', 'reagendado')
LEFT JOIN public.schedule_blocks bloqueo ON
    bloqueo.operating_room_id = or_nombre.id AND bloqueo.fecha = fecha_calendario.fecha
    AND bloqueo.hora_inicio <= hora_calendario.hora AND bloqueo.hora_fin > hora_calendario.hora
    AND bloqueo.deleted_at IS NULL
    AND (bloqueo.fecha_auto_liberacion IS NULL OR bloqueo.fecha_auto_liberacion >= fecha_calendario.fecha)
WHERE or_nombre.activo = true AND or_nombre.deleted_at IS NULL
ORDER BY or_nombre.nombre, fecha_calendario.fecha, hora_calendario.hora;


-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

ALTER TABLE public.users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplies                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_request_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeries                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_supplies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_movements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_supply_packs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_schedule_history ENABLE ROW LEVEL SECURITY;

-- Funciones auxiliares RLS
CREATE OR REPLACE FUNCTION is_pabellon() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'pabellon' AND deleted_at IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_doctor() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'doctor' AND deleted_at IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_doctor_id() RETURNS UUID AS $$
DECLARE doctor_uuid UUID;
BEGIN
    SELECT id INTO doctor_uuid FROM public.doctors WHERE user_id = auth.uid() AND deleted_at IS NULL;
    RETURN doctor_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION require_auth() RETURNS BOOLEAN AS $$
BEGIN RETURN auth.uid() IS NOT NULL; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas: USERS
CREATE POLICY "Pabellón puede ver todos los usuarios"    ON public.users FOR SELECT USING (is_pabellon());
CREATE POLICY "Pabellón puede crear usuarios"            ON public.users FOR INSERT WITH CHECK (is_pabellon());
CREATE POLICY "Pabellón puede actualizar usuarios"       ON public.users FOR UPDATE USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Usuarios pueden ver su propio registro"   ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuarios pueden actualizar su propio registro" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Políticas: DOCTORS
CREATE POLICY "Pabellón acceso total a doctores"         ON public.doctors FOR ALL USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Doctor puede ver su propio registro"      ON public.doctors FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY "Doctor puede actualizar su propio registro" ON public.doctors FOR UPDATE
    USING (user_id = auth.uid() AND deleted_at IS NULL)
    WITH CHECK (user_id = auth.uid() AND deleted_at IS NULL);

-- Políticas: OPERATING_ROOMS
CREATE POLICY "Pabellón acceso total a pabellones"       ON public.operating_rooms FOR ALL USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Doctor puede ver pabellones activos"      ON public.operating_rooms FOR SELECT USING (activo = true AND deleted_at IS NULL);

-- Políticas: PATIENTS
CREATE POLICY "Pabellón puede gestionar pacientes"       ON public.patients FOR ALL USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Doctor puede ver sus propios pacientes"   ON public.patients FOR SELECT USING (doctor_id = current_doctor_id() AND deleted_at IS NULL);
CREATE POLICY "Doctor puede crear sus propios pacientes" ON public.patients FOR INSERT WITH CHECK (doctor_id = current_doctor_id() AND deleted_at IS NULL);
CREATE POLICY "Doctor puede actualizar sus propios pacientes" ON public.patients FOR UPDATE
    USING (doctor_id = current_doctor_id() AND deleted_at IS NULL)
    WITH CHECK (doctor_id = current_doctor_id() AND deleted_at IS NULL);

-- Políticas: SUPPLIES
CREATE POLICY "Pabellón acceso total a insumos"          ON public.supplies FOR ALL USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Doctor puede ver insumos activos"         ON public.supplies FOR SELECT USING (activo = true AND deleted_at IS NULL);

-- Políticas: SURGERY_REQUESTS
CREATE POLICY "Pabellón puede ver todas las solicitudes" ON public.surgery_requests FOR SELECT USING (is_pabellon());
CREATE POLICY "Pabellón puede gestionar solicitudes"     ON public.surgery_requests FOR UPDATE USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Doctor puede ver sus propias solicitudes" ON public.surgery_requests FOR SELECT USING (doctor_id = current_doctor_id() AND deleted_at IS NULL);
CREATE POLICY "Doctor puede crear solicitudes propias"   ON public.surgery_requests FOR INSERT WITH CHECK (
    doctor_id = current_doctor_id() AND deleted_at IS NULL AND
    EXISTS (SELECT 1 FROM public.doctors WHERE id = current_doctor_id() AND estado = 'activo' AND deleted_at IS NULL)
);
CREATE POLICY "Doctor puede actualizar sus solicitudes pendientes" ON public.surgery_requests FOR UPDATE
    USING (doctor_id = current_doctor_id() AND estado = 'pendiente' AND deleted_at IS NULL)
    WITH CHECK (doctor_id = current_doctor_id() AND deleted_at IS NULL);

-- Políticas: SURGERY_REQUEST_SUPPLIES
CREATE POLICY "Pabellón acceso total a insumos de solicitudes" ON public.surgery_request_supplies FOR ALL USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Doctor puede ver insumos de sus solicitudes"    ON public.surgery_request_supplies FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.surgery_requests WHERE id = surgery_request_id AND doctor_id = current_doctor_id() AND deleted_at IS NULL)
);
CREATE POLICY "Doctor puede gestionar insumos de solicitudes pendientes" ON public.surgery_request_supplies FOR ALL
    USING (EXISTS (SELECT 1 FROM public.surgery_requests WHERE id = surgery_request_id AND doctor_id = current_doctor_id() AND estado = 'pendiente' AND deleted_at IS NULL))
    WITH CHECK (EXISTS (SELECT 1 FROM public.surgery_requests WHERE id = surgery_request_id AND doctor_id = current_doctor_id() AND estado = 'pendiente' AND deleted_at IS NULL));

-- Políticas: SURGERIES
CREATE POLICY "Pabellón acceso total a cirugías"         ON public.surgeries FOR ALL USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Doctor puede ver sus propias cirugías"    ON public.surgeries FOR SELECT USING (doctor_id = current_doctor_id() AND deleted_at IS NULL);
CREATE POLICY "Doctor puede cancelar sus propias cirugías programadas" ON public.surgeries FOR UPDATE
    USING (doctor_id = current_doctor_id() AND estado = 'programada' AND deleted_at IS NULL)
    WITH CHECK (doctor_id = current_doctor_id() AND deleted_at IS NULL AND estado = 'cancelada');

-- Políticas: SURGERY_SUPPLIES
CREATE POLICY "Pabellón acceso total a insumos de cirugías" ON public.surgery_supplies FOR ALL USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Doctor puede ver insumos de sus cirugías"    ON public.surgery_supplies FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.surgeries WHERE id = surgery_id AND doctor_id = current_doctor_id() AND deleted_at IS NULL)
);

-- Políticas: SCHEDULE_BLOCKS
CREATE POLICY "Pabellón acceso total a bloqueos"         ON public.schedule_blocks FOR ALL USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Doctor puede ver bloqueos"                ON public.schedule_blocks FOR SELECT USING (deleted_at IS NULL);

-- Políticas: REMINDERS
CREATE POLICY "Usuarios pueden ver sus propios recordatorios"    ON public.reminders FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY "Usuarios pueden crear sus propios recordatorios"  ON public.reminders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Usuarios pueden actualizar sus propios recordatorios" ON public.reminders FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Pabellón puede crear recordatorios"               ON public.reminders FOR INSERT WITH CHECK (is_pabellon());

-- Políticas: NOTIFICATIONS
CREATE POLICY "Usuarios pueden ver sus propias notificaciones"   ON public.notifications FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY "Usuarios pueden actualizar sus notificaciones"    ON public.notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Sistema puede crear notificaciones"               ON public.notifications FOR INSERT WITH CHECK (true);

-- Políticas: AUDIT_LOGS
CREATE POLICY "Pabellón puede ver logs de auditoría"     ON public.audit_logs FOR SELECT USING (is_pabellon());
CREATE POLICY "Sistema puede crear logs de auditoría"    ON public.audit_logs FOR INSERT WITH CHECK (true);
GRANT INSERT ON public.audit_logs TO postgres, anon, authenticated, service_role;

-- Políticas: EXTERNAL_MESSAGES
CREATE POLICY "external_messages_insert_anon"     ON public.external_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "external_messages_select_pabellon" ON public.external_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'pabellon'));
CREATE POLICY "external_messages_update_pabellon" ON public.external_messages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'pabellon'));

-- Políticas: SUPPLY_MOVEMENTS
CREATE POLICY "Pabellón acceso total a movimientos de inventario" ON public.supply_movements FOR ALL USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Doctor puede ver movimientos de sus cirugías"      ON public.supply_movements FOR SELECT USING (
    relacionado_tipo = 'cirugia' AND
    EXISTS (SELECT 1 FROM public.surgeries WHERE id = relacionado_con AND doctor_id = current_doctor_id() AND deleted_at IS NULL)
);

-- Políticas: OPERATION_SUPPLY_PACKS
CREATE POLICY "Doctores pueden ver packs por operación"  ON public.operation_supply_packs FOR SELECT USING (is_doctor());
CREATE POLICY "Pabellón puede ver packs por operación"   ON public.operation_supply_packs FOR SELECT USING (is_pabellon());
CREATE POLICY "Pabellón puede insertar packs"            ON public.operation_supply_packs FOR INSERT WITH CHECK (is_pabellon());
CREATE POLICY "Pabellón puede actualizar packs"          ON public.operation_supply_packs FOR UPDATE USING (is_pabellon()) WITH CHECK (is_pabellon());
CREATE POLICY "Pabellón puede eliminar packs"            ON public.operation_supply_packs FOR DELETE USING (is_pabellon());

-- Políticas: SURGERY_SCHEDULE_HISTORY
CREATE POLICY "Pabellón puede ver historial de reagendamientos"  ON public.surgery_schedule_history FOR SELECT USING (is_pabellon());
CREATE POLICY "Doctor puede ver historial de sus cirugías"       ON public.surgery_schedule_history FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.surgeries WHERE id = surgery_id AND doctor_id = current_doctor_id())
);
CREATE POLICY "Sistema puede crear historial"                    ON public.surgery_schedule_history FOR INSERT WITH CHECK (true);


-- ─────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.surgery_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.surgeries;
