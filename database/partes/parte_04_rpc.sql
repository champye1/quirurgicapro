-- =====================================================================
-- PARTE 4 DE 6: FUNCIONES RPC (llamadas desde el frontend)
-- Ejecutar después de parte_03_funciones_triggers.sql
-- =====================================================================

-- Programar cirugía completa (transacción atómica)
CREATE OR REPLACE FUNCTION programar_cirugia_completa(
    p_surgery_request_id UUID,
    p_operating_room_id UUID,
    p_fecha DATE,
    p_hora_inicio TIME,
    p_hora_fin TIME,
    p_observaciones TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_surgery_id UUID;
    v_surgery_request RECORD;
    v_operating_room RECORD;
    v_supply_record RECORD;
BEGIN
    SELECT * INTO v_surgery_request FROM public.surgery_requests
    WHERE id = p_surgery_request_id AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud quirúrgica no existe o ha sido eliminada'; END IF;
    IF v_surgery_request.estado != 'pendiente' THEN
        RAISE EXCEPTION 'La solicitud debe estar en estado pendiente. Estado actual: %', v_surgery_request.estado;
    END IF;

    SELECT * INTO v_operating_room FROM public.operating_rooms
    WHERE id = p_operating_room_id AND activo = true AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'El pabellón no existe o no está activo'; END IF;

    IF p_hora_fin <= p_hora_inicio THEN RAISE EXCEPTION 'La hora de fin debe ser mayor que la de inicio'; END IF;
    IF p_fecha < CURRENT_DATE THEN RAISE EXCEPTION 'No se puede programar en una fecha pasada'; END IF;

    INSERT INTO public.surgeries (
        surgery_request_id, doctor_id, patient_id, operating_room_id,
        fecha, hora_inicio, hora_fin, observaciones, estado
    ) VALUES (
        p_surgery_request_id, v_surgery_request.doctor_id, v_surgery_request.patient_id,
        p_operating_room_id, p_fecha, p_hora_inicio, p_hora_fin, p_observaciones, 'programada'
    ) RETURNING id INTO v_surgery_id;

    FOR v_supply_record IN
        SELECT supply_id, cantidad FROM public.surgery_request_supplies WHERE surgery_request_id = p_surgery_request_id
    LOOP
        INSERT INTO public.surgery_supplies (surgery_id, supply_id, cantidad)
        VALUES (v_surgery_id, v_supply_record.supply_id, v_supply_record.cantidad);
    END LOOP;

    UPDATE public.surgery_requests SET estado = 'aceptada', updated_at = NOW() WHERE id = p_surgery_request_id;

    RETURN jsonb_build_object('success', true, 'surgery_id', v_surgery_id,
        'surgery_request_id', p_surgery_request_id, 'message', 'Cirugía programada exitosamente');
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al programar cirugía: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION programar_cirugia_completa(UUID, UUID, DATE, TIME, TIME, TEXT) TO authenticated;

-- Liberar bloqueos expirados (solo si el slot no se llenó)
DROP FUNCTION IF EXISTS liberar_bloqueos_expirados();
CREATE OR REPLACE FUNCTION liberar_bloqueos_expirados()
RETURNS TABLE(bloqueos_liberados INTEGER, mensaje TEXT) AS $$
DECLARE v_count INTEGER := 0;
BEGIN
    UPDATE public.schedule_blocks b
    SET deleted_at = NOW()
    WHERE b.deleted_at IS NULL
      AND (
          (b.vigencia_hasta IS NOT NULL AND b.vigencia_hasta < CURRENT_DATE) OR
          (b.fecha_auto_liberacion IS NOT NULL AND b.fecha_auto_liberacion < CURRENT_DATE) OR
          (b.fecha < CURRENT_DATE)
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.surgeries s
          WHERE s.operating_room_id = b.operating_room_id AND s.fecha = b.fecha
            AND s.deleted_at IS NULL AND s.estado != 'cancelada'
            AND s.hora_inicio < b.hora_fin AND s.hora_fin > b.hora_inicio
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT v_count,
        format('Se liberaron %s bloqueos expirados (solo los que no tenían cirugía en el slot)', v_count)::TEXT;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION liberar_bloqueos_expirados() TO authenticated;

-- Verificar disponibilidad con tiempo de limpieza
CREATE OR REPLACE FUNCTION verificar_disponibilidad_con_limpieza(
    p_operating_room_id UUID, p_fecha DATE, p_hora_inicio TIME, p_hora_fin TIME
)
RETURNS JSONB AS $$
DECLARE
    v_tiempo_limpieza_minutos INTEGER;
    v_cirugia RECORD;
    v_tiempo_disponible INTEGER;
    v_bloqueo_count INTEGER;
BEGIN
    SELECT or_table.tiempo_limpieza_minutos INTO v_tiempo_limpieza_minutos
    FROM public.operating_rooms or_table WHERE or_table.id = p_operating_room_id;
    IF v_tiempo_limpieza_minutos IS NULL THEN v_tiempo_limpieza_minutos := 30; END IF;

    SELECT * INTO v_cirugia FROM public.surgeries
    WHERE operating_room_id = p_operating_room_id AND fecha = p_fecha AND deleted_at IS NULL
      AND estado != 'cancelada' AND estado_hora IN ('agendado', 'reagendado')
      AND (hora_inicio <= p_hora_inicio AND hora_fin > p_hora_inicio OR
           hora_inicio < p_hora_fin AND hora_fin >= p_hora_fin OR
           hora_inicio >= p_hora_inicio AND hora_fin <= p_hora_fin) LIMIT 1;
    IF FOUND THEN RETURN jsonb_build_object('disponible', false, 'mensaje', 'El horario se solapa con otra cirugía'); END IF;

    SELECT * INTO v_cirugia FROM public.surgeries
    WHERE operating_room_id = p_operating_room_id AND fecha = p_fecha AND deleted_at IS NULL
      AND estado != 'cancelada' AND estado_hora IN ('agendado', 'reagendado')
      AND hora_fin <= p_hora_inicio ORDER BY hora_fin DESC LIMIT 1;
    IF FOUND THEN
        v_tiempo_disponible := EXTRACT(EPOCH FROM (p_hora_inicio - v_cirugia.hora_fin)) / 60;
        IF v_tiempo_disponible < v_tiempo_limpieza_minutos THEN
            RETURN jsonb_build_object('disponible', false, 'mensaje',
                format('Faltan %s min de limpieza (disponible: %s min)', v_tiempo_limpieza_minutos, v_tiempo_disponible));
        END IF;
    END IF;

    SELECT * INTO v_cirugia FROM public.surgeries
    WHERE operating_room_id = p_operating_room_id AND fecha = p_fecha AND deleted_at IS NULL
      AND estado != 'cancelada' AND estado_hora IN ('agendado', 'reagendado')
      AND hora_inicio >= p_hora_fin ORDER BY hora_inicio ASC LIMIT 1;
    IF FOUND THEN
        v_tiempo_disponible := EXTRACT(EPOCH FROM (v_cirugia.hora_inicio - p_hora_fin)) / 60;
        IF v_tiempo_disponible < v_tiempo_limpieza_minutos THEN
            RETURN jsonb_build_object('disponible', false, 'mensaje',
                format('Faltan %s min de limpieza con cirugía siguiente (disponible: %s min)', v_tiempo_limpieza_minutos, v_tiempo_disponible));
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_bloqueo_count FROM public.schedule_blocks
    WHERE operating_room_id = p_operating_room_id AND fecha = p_fecha AND deleted_at IS NULL
      AND ((fecha_auto_liberacion IS NULL AND vigencia_hasta IS NULL) OR
           (vigencia_hasta IS NOT NULL AND vigencia_hasta >= p_fecha) OR
           (fecha_auto_liberacion IS NOT NULL AND fecha_auto_liberacion >= p_fecha))
      AND (hora_inicio <= p_hora_inicio AND hora_fin > p_hora_inicio OR
           hora_inicio < p_hora_fin AND hora_fin >= p_hora_fin OR
           hora_inicio >= p_hora_inicio AND hora_fin <= p_hora_fin);
    IF v_bloqueo_count > 0 THEN
        RETURN jsonb_build_object('disponible', false, 'mensaje', 'El horario está bloqueado');
    END IF;

    RETURN jsonb_build_object('disponible', true, 'mensaje', 'Horario disponible', 'tiempo_limpieza_minutos', v_tiempo_limpieza_minutos);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION verificar_disponibilidad_con_limpieza(UUID, DATE, TIME, TIME) TO authenticated;

-- Slots disponibles para el doctor (sin reservas ni bloqueos)
CREATE OR REPLACE FUNCTION public.get_slots_disponibles_pabellon(p_fecha DATE)
RETURNS TABLE(operating_room_id UUID, nombre_pabellon TEXT, hora_inicio TIME, hora_fin TIME)
AS $$
DECLARE
    v_hora TIME; v_hora_fin TIME; v_room RECORD;
BEGIN
    IF p_fecha < CURRENT_DATE THEN RETURN; END IF;
    FOR v_room IN SELECT id, nombre FROM public.operating_rooms WHERE activo = true AND deleted_at IS NULL LOOP
        v_hora := '08:00'::TIME;
        WHILE v_hora < '19:00'::TIME LOOP
            v_hora_fin := v_hora + INTERVAL '1 hour';
            IF NOT EXISTS (
                SELECT 1 FROM public.surgeries s
                WHERE s.operating_room_id = v_room.id AND s.fecha = p_fecha
                  AND s.deleted_at IS NULL AND s.estado NOT IN ('cancelada')
                  AND s.hora_inicio < v_hora_fin AND s.hora_fin > v_hora
            ) AND NOT EXISTS (
                SELECT 1 FROM public.schedule_blocks b
                WHERE b.operating_room_id = v_room.id AND b.fecha = p_fecha
                  AND b.deleted_at IS NULL
                  AND (b.fecha_auto_liberacion IS NULL OR b.fecha_auto_liberacion >= p_fecha)
                  AND (b.vigencia_hasta IS NULL OR b.vigencia_hasta >= p_fecha)
                  AND b.hora_inicio < v_hora_fin AND b.hora_fin > v_hora
            ) THEN
                operating_room_id := v_room.id;
                nombre_pabellon := v_room.nombre;
                hora_inicio := v_hora;
                hora_fin := v_hora_fin;
                RETURN NEXT;
            END IF;
            v_hora := v_hora_fin;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_slots_disponibles_pabellon(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_slots_disponibles_pabellon(DATE) TO anon;

-- Estado de slots por pabellón: libre / ocupado / bloqueado / solicitado
CREATE OR REPLACE FUNCTION public.get_estado_slots_pabellon(p_fecha DATE)
RETURNS TABLE(operating_room_id UUID, nombre_pabellon TEXT, hora_inicio TIME, hora_fin TIME, estado TEXT)
AS $$
DECLARE
    v_hora TIME; v_hora_fin TIME; v_room RECORD;
    v_ocupado BOOLEAN; v_bloqueado BOOLEAN; v_solicitado BOOLEAN;
BEGIN
    IF p_fecha < CURRENT_DATE THEN RETURN; END IF;
    FOR v_room IN SELECT id, nombre FROM public.operating_rooms WHERE activo = true AND deleted_at IS NULL LOOP
        v_hora := '08:00'::TIME;
        WHILE v_hora < '19:00'::TIME LOOP
            v_hora_fin := v_hora + INTERVAL '1 hour';

            v_ocupado := EXISTS (
                SELECT 1 FROM public.surgeries s
                WHERE s.operating_room_id = v_room.id AND s.fecha = p_fecha
                  AND s.deleted_at IS NULL AND s.estado NOT IN ('cancelada')
                  AND s.hora_inicio < v_hora_fin AND s.hora_fin > v_hora
            );
            v_bloqueado := EXISTS (
                SELECT 1 FROM public.schedule_blocks b
                WHERE b.operating_room_id = v_room.id AND b.fecha = p_fecha AND b.deleted_at IS NULL
                  AND (b.fecha_auto_liberacion IS NULL OR b.fecha_auto_liberacion >= p_fecha)
                  AND (b.vigencia_hasta IS NULL OR b.vigencia_hasta >= p_fecha)
                  AND b.hora_inicio < v_hora_fin AND b.hora_fin > v_hora
            );
            v_solicitado := NOT v_ocupado AND NOT v_bloqueado AND EXISTS (
                SELECT 1 FROM public.surgery_requests sr
                WHERE sr.operating_room_id_preferido = v_room.id AND sr.fecha_preferida = p_fecha
                  AND sr.deleted_at IS NULL AND sr.estado IN ('pendiente', 'aceptada')
                  AND sr.hora_recomendada IS NOT NULL
                  AND sr.hora_recomendada < v_hora_fin
                  AND (sr.hora_fin_recomendada IS NULL OR sr.hora_fin_recomendada > v_hora)
            );

            operating_room_id := v_room.id; nombre_pabellon := v_room.nombre;
            hora_inicio := v_hora; hora_fin := v_hora_fin;
            IF v_ocupado THEN estado := 'ocupado';
            ELSIF v_bloqueado THEN estado := 'bloqueado';
            ELSIF v_solicitado THEN estado := 'solicitado';
            ELSE estado := 'libre'; END IF;
            RETURN NEXT;
            v_hora := v_hora_fin;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_estado_slots_pabellon(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_estado_slots_pabellon(DATE) TO anon;

-- Notificar a pabellón que el doctor solicita reagendamiento
CREATE OR REPLACE FUNCTION public.notificar_reagendamiento_a_pabellon(p_surgery_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_doctor_user_id UUID; v_doctor_nombre TEXT; v_paciente_nombre TEXT;
    v_user RECORD; v_count INTEGER := 0;
BEGIN
    SELECT d.user_id, d.nombre || ' ' || d.apellido INTO v_doctor_user_id, v_doctor_nombre
    FROM public.surgery_requests sr JOIN public.doctors d ON d.id = sr.doctor_id
    WHERE sr.id = p_surgery_request_id AND sr.deleted_at IS NULL;

    IF v_doctor_user_id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada o no autorizado'; END IF;
    IF v_doctor_user_id != auth.uid() THEN RAISE EXCEPTION 'No puede solicitar reagendamiento de una solicitud que no es suya'; END IF;

    SELECT p.nombre || ' ' || p.apellido INTO v_paciente_nombre
    FROM public.surgery_requests sr JOIN public.patients p ON p.id = sr.patient_id WHERE sr.id = p_surgery_request_id;
    v_paciente_nombre := COALESCE(v_paciente_nombre, 'Paciente');

    FOR v_user IN SELECT id FROM public.users WHERE role = 'pabellon' AND deleted_at IS NULL LOOP
        INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, relacionado_con)
        VALUES (v_user.id, 'solicitud_reagendamiento', 'Solicitud de reagendamiento',
            'El paciente ' || v_paciente_nombre || ' (Dr. ' || COALESCE(v_doctor_nombre, '') || ') solicitó reagendar.',
            p_surgery_request_id);
        v_count := v_count + 1;
    END LOOP;

    UPDATE public.surgery_requests SET reagendamiento_notificado_at = now(), updated_at = now()
    WHERE id = p_surgery_request_id;

    RETURN jsonb_build_object('success', true, 'notificaciones_enviadas', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notificar_reagendamiento_a_pabellon(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_reagendamiento_a_pabellon(UUID) TO service_role;

-- Login por username (sin exponer tabla users a anon)
CREATE OR REPLACE FUNCTION public.get_doctor_email_by_username(p_username TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email TEXT;
BEGIN
    IF p_username IS NULL OR trim(p_username) = '' THEN RETURN NULL; END IF;
    SELECT email INTO v_email FROM public.users
    WHERE role = 'doctor' AND deleted_at IS NULL AND username IS NOT NULL
      AND lower(trim(username)) = lower(trim(p_username)) LIMIT 1;
    RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_email_by_username(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_doctor_email_by_username(TEXT) TO authenticated;
