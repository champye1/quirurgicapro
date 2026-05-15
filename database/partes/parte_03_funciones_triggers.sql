-- =====================================================================
-- PARTE 3 DE 6: FUNCIONES Y TRIGGERS
-- Ejecutar después de parte_02_tablas.sql
-- =====================================================================

-- updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at            BEFORE UPDATE ON public.users            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doctors_updated_at          BEFORE UPDATE ON public.doctors          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_operating_rooms_updated_at  BEFORE UPDATE ON public.operating_rooms  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at         BEFORE UPDATE ON public.patients         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_supplies_updated_at         BEFORE UPDATE ON public.supplies         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_surgery_requests_updated_at BEFORE UPDATE ON public.surgery_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_surgeries_updated_at        BEFORE UPDATE ON public.surgeries        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schedule_blocks_updated_at  BEFORE UPDATE ON public.schedule_blocks  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reminders_updated_at        BEFORE UPDATE ON public.reminders        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calcular fecha_auto_liberacion en bloqueos
CREATE OR REPLACE FUNCTION calcular_fecha_auto_liberacion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.dias_auto_liberacion IS NOT NULL THEN
        NEW.fecha_auto_liberacion := NEW.fecha + (NEW.dias_auto_liberacion || ' days')::INTERVAL;
    ELSE
        IF NEW.vigencia_hasta IS NOT NULL THEN
            NEW.fecha_auto_liberacion := NEW.vigencia_hasta;
        ELSE
            NEW.fecha_auto_liberacion := NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calcular_fecha_auto_liberacion ON public.schedule_blocks;
CREATE TRIGGER trigger_calcular_fecha_auto_liberacion
    BEFORE INSERT OR UPDATE ON public.schedule_blocks
    FOR EACH ROW EXECUTE FUNCTION calcular_fecha_auto_liberacion();

-- Estado y reagendamiento al crear/actualizar cirugía
CREATE OR REPLACE FUNCTION actualizar_fecha_ultimo_agendamiento()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        NEW.fecha_ultimo_agendamiento := NOW();
        NEW.estado_hora := 'agendado';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.estado != 'programada' THEN
            RAISE EXCEPTION 'Solo se pueden reagendar cirugías en estado "programada". Estado actual: %', OLD.estado;
        END IF;
        IF NEW.fecha < CURRENT_DATE THEN
            RAISE EXCEPTION 'No se puede reagendar una cirugía a una fecha pasada';
        END IF;
        IF (OLD.fecha != NEW.fecha OR OLD.hora_inicio != NEW.hora_inicio OR OLD.hora_fin != NEW.hora_fin) THEN
            NEW.fecha_anterior := OLD.fecha;
            NEW.hora_inicio_anterior := OLD.hora_inicio;
            NEW.hora_fin_anterior := OLD.hora_fin;
            NEW.estado_hora := 'reagendado';
            NEW.fecha_ultimo_agendamiento := NOW();
            INSERT INTO public.surgery_schedule_history (
                surgery_id, fecha_anterior, hora_inicio_anterior, hora_fin_anterior,
                fecha_nueva, hora_inicio_nueva, hora_fin_nueva, created_by
            ) VALUES (
                NEW.id, OLD.fecha, OLD.hora_inicio, OLD.hora_fin,
                NEW.fecha, NEW.hora_inicio, NEW.hora_fin, v_user_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_fecha_ultimo_agendamiento ON public.surgeries;
CREATE TRIGGER trigger_actualizar_fecha_ultimo_agendamiento
    BEFORE INSERT OR UPDATE ON public.surgeries
    FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_ultimo_agendamiento();

-- Validación de solapamiento y tiempo de limpieza
CREATE OR REPLACE FUNCTION validar_solapamiento_cirugia()
RETURNS TRIGGER AS $$
DECLARE
    solapamiento_count INTEGER;
    tiempo_limpieza_minutos INTEGER;
    cirugia_vecina RECORD;
    tiempo_disponible_minutos INTEGER;
BEGIN
    SELECT or_table.tiempo_limpieza_minutos INTO tiempo_limpieza_minutos
    FROM public.operating_rooms or_table WHERE or_table.id = NEW.operating_room_id;
    IF tiempo_limpieza_minutos IS NULL THEN tiempo_limpieza_minutos := 30; END IF;

    -- Solapamiento directo
    SELECT COUNT(*) INTO solapamiento_count
    FROM public.surgeries
    WHERE operating_room_id = NEW.operating_room_id
      AND fecha = NEW.fecha
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND deleted_at IS NULL
      AND estado != 'cancelada'
      AND estado_hora IN ('agendado', 'reagendado')
      AND (
          (hora_inicio <= NEW.hora_inicio AND hora_fin > NEW.hora_inicio) OR
          (hora_inicio < NEW.hora_fin AND hora_fin >= NEW.hora_fin) OR
          (hora_inicio >= NEW.hora_inicio AND hora_fin <= NEW.hora_fin)
      );
    IF solapamiento_count > 0 THEN
        RAISE EXCEPTION 'Ya existe una cirugía programada en este pabellón en el mismo horario';
    END IF;

    -- Tiempo de limpieza con cirugía anterior
    SELECT * INTO cirugia_vecina
    FROM public.surgeries
    WHERE operating_room_id = NEW.operating_room_id AND fecha = NEW.fecha
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND deleted_at IS NULL AND estado != 'cancelada' AND estado_hora IN ('agendado', 'reagendado')
      AND hora_fin <= NEW.hora_inicio
    ORDER BY hora_fin DESC LIMIT 1;
    IF FOUND THEN
        tiempo_disponible_minutos := EXTRACT(EPOCH FROM (NEW.hora_inicio - cirugia_vecina.hora_fin)) / 60;
        IF tiempo_disponible_minutos < tiempo_limpieza_minutos THEN
            RAISE EXCEPTION 'Debe haber al menos % minutos de limpieza entre cirugías. Disponible: % minutos',
                tiempo_limpieza_minutos, tiempo_disponible_minutos;
        END IF;
    END IF;

    -- Tiempo de limpieza con cirugía siguiente
    SELECT * INTO cirugia_vecina
    FROM public.surgeries
    WHERE operating_room_id = NEW.operating_room_id AND fecha = NEW.fecha
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND deleted_at IS NULL AND estado != 'cancelada' AND estado_hora IN ('agendado', 'reagendado')
      AND hora_inicio >= NEW.hora_fin
    ORDER BY hora_inicio ASC LIMIT 1;
    IF FOUND THEN
        tiempo_disponible_minutos := EXTRACT(EPOCH FROM (cirugia_vecina.hora_inicio - NEW.hora_fin)) / 60;
        IF tiempo_disponible_minutos < tiempo_limpieza_minutos THEN
            RAISE EXCEPTION 'Debe haber al menos % minutos de limpieza entre cirugías. Disponible: % minutos',
                tiempo_limpieza_minutos, tiempo_disponible_minutos;
        END IF;
    END IF;

    -- Bloqueos activos
    SELECT COUNT(*) INTO solapamiento_count
    FROM public.schedule_blocks
    WHERE operating_room_id = NEW.operating_room_id AND fecha = NEW.fecha AND deleted_at IS NULL
      AND (
          (fecha_auto_liberacion IS NULL AND vigencia_hasta IS NULL) OR
          (vigencia_hasta IS NOT NULL AND vigencia_hasta >= NEW.fecha) OR
          (fecha_auto_liberacion IS NOT NULL AND fecha_auto_liberacion >= NEW.fecha)
      )
      AND (
          (hora_inicio <= NEW.hora_inicio AND hora_fin > NEW.hora_inicio) OR
          (hora_inicio < NEW.hora_fin AND hora_fin >= NEW.hora_fin) OR
          (hora_inicio >= NEW.hora_inicio AND hora_fin <= NEW.hora_fin)
      );
    IF solapamiento_count > 0 THEN
        RAISE EXCEPTION 'El horario seleccionado está bloqueado';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_solapamiento_cirugia ON public.surgeries;
CREATE TRIGGER trigger_validar_solapamiento_cirugia
    BEFORE INSERT OR UPDATE ON public.surgeries
    FOR EACH ROW EXECUTE FUNCTION validar_solapamiento_cirugia();

-- Notificación: solicitud aceptada
CREATE OR REPLACE FUNCTION notificar_solicitud_aceptada()
RETURNS TRIGGER AS $$
DECLARE doctor_user_id UUID;
BEGIN
    IF OLD.estado = 'pendiente' AND NEW.estado = 'aceptada' THEN
        SELECT user_id INTO doctor_user_id FROM public.doctors WHERE id = NEW.doctor_id;
        INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, relacionado_con)
        VALUES (doctor_user_id, 'solicitud_aceptada', 'Solicitud Quirúrgica Aceptada',
                'Su solicitud quirúrgica ha sido aceptada y está siendo programada.', NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notificar_solicitud_aceptada
    AFTER UPDATE ON public.surgery_requests
    FOR EACH ROW WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
    EXECUTE FUNCTION notificar_solicitud_aceptada();

-- Validar doctor activo al crear solicitud
CREATE OR REPLACE FUNCTION validar_doctor_activo()
RETURNS TRIGGER AS $$
DECLARE doctor_estado doctor_status;
BEGIN
    SELECT estado INTO doctor_estado FROM public.doctors WHERE id = NEW.doctor_id;
    IF doctor_estado != 'activo' THEN
        RAISE EXCEPTION 'El doctor debe estar activo para crear solicitudes quirúrgicas';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validar_doctor_activo
    BEFORE INSERT ON public.surgery_requests
    FOR EACH ROW EXECUTE FUNCTION validar_doctor_activo();

-- Notificación: cirugía programada
CREATE OR REPLACE FUNCTION notificar_cirugia_programada()
RETURNS TRIGGER AS $$
DECLARE doctor_user_id UUID;
BEGIN
    SELECT user_id INTO doctor_user_id FROM public.doctors WHERE id = NEW.doctor_id;
    INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, relacionado_con)
    VALUES (doctor_user_id, 'operacion_programada', 'Cirugía Programada',
        format('Su cirugía ha sido programada para el %s a las %s en el pabellón %s',
               NEW.fecha::text, NEW.hora_inicio::text,
               (SELECT nombre FROM public.operating_rooms WHERE id = NEW.operating_room_id)),
        NEW.id);
    INSERT INTO public.reminders (user_id, titulo, contenido, tipo, relacionado_con)
    VALUES (doctor_user_id, 'Cirugía Programada',
        format('Cirugía programada para el %s a las %s', NEW.fecha::text, NEW.hora_inicio::text),
        'operacion_aceptada', NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notificar_cirugia_programada
    AFTER INSERT ON public.surgeries
    FOR EACH ROW EXECUTE FUNCTION notificar_cirugia_programada();

-- Notificación: cirugía reagendada
CREATE OR REPLACE FUNCTION public.notificar_operacion_reagendada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_doctor_user_id UUID;
    v_paciente_nombre TEXT;
    v_doctor_nombre TEXT;
    v_user RECORD;
BEGIN
    IF OLD.fecha IS NOT DISTINCT FROM NEW.fecha
       AND OLD.hora_inicio IS NOT DISTINCT FROM NEW.hora_inicio
       AND OLD.hora_fin IS NOT DISTINCT FROM NEW.hora_fin
       AND OLD.operating_room_id IS NOT DISTINCT FROM NEW.operating_room_id THEN
        RETURN NEW;
    END IF;

    SELECT d.user_id, d.nombre || ' ' || d.apellido INTO v_doctor_user_id, v_doctor_nombre
    FROM public.doctors d WHERE d.id = NEW.doctor_id;

    SELECT p.nombre || ' ' || p.apellido INTO v_paciente_nombre
    FROM public.patients p WHERE p.id = NEW.patient_id;

    v_paciente_nombre := COALESCE(v_paciente_nombre, 'Paciente');
    v_doctor_nombre   := COALESCE(v_doctor_nombre, 'Doctor');

    IF v_doctor_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, relacionado_con)
        VALUES (v_doctor_user_id, 'operacion_reagendada', 'Operación reagendada',
            'La cirugía de ' || v_paciente_nombre
            || ' fue reagendada del ' || to_char(OLD.fecha,'DD/MM/YYYY') || ' ' || to_char(OLD.hora_inicio,'HH24:MI')
            || ' al ' || to_char(NEW.fecha,'DD/MM/YYYY') || ' ' || to_char(NEW.hora_inicio,'HH24:MI') || '.',
            NEW.id);
    END IF;

    FOR v_user IN SELECT id FROM public.users WHERE role = 'pabellon' AND deleted_at IS NULL LOOP
        INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, relacionado_con)
        VALUES (v_user.id, 'operacion_reagendada', 'Operación reagendada',
            'Cirugía de ' || v_paciente_nombre || ' (Dr. ' || v_doctor_nombre
            || ') reagendada del ' || to_char(OLD.fecha,'DD/MM/YYYY') || ' ' || to_char(OLD.hora_inicio,'HH24:MI')
            || ' al ' || to_char(NEW.fecha,'DD/MM/YYYY') || ' ' || to_char(NEW.hora_inicio,'HH24:MI') || '.',
            NEW.id);
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notificar_operacion_reagendada ON public.surgeries;
CREATE TRIGGER trigger_notificar_operacion_reagendada
    AFTER UPDATE ON public.surgeries FOR EACH ROW
    WHEN (
        OLD.fecha IS DISTINCT FROM NEW.fecha OR
        OLD.hora_inicio IS DISTINCT FROM NEW.hora_inicio OR
        OLD.hora_fin IS DISTINCT FROM NEW.hora_fin OR
        OLD.operating_room_id IS DISTINCT FROM NEW.operating_room_id
    )
    EXECUTE FUNCTION notificar_operacion_reagendada();

-- Auditoría (SECURITY DEFINER para evitar errores de RLS en audit_logs)
CREATE OR REPLACE FUNCTION registrar_auditoria()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (user_id, accion, tabla_afectada, registro_id, datos_anteriores)
        VALUES (current_user_id, 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (user_id, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos)
        VALUES (current_user_id, 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (user_id, accion, tabla_afectada, registro_id, datos_nuevos)
        VALUES (current_user_id, 'INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER audit_surgeries
    AFTER INSERT OR UPDATE OR DELETE ON public.surgeries
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER audit_surgery_requests
    AFTER INSERT OR UPDATE OR DELETE ON public.surgery_requests
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

DROP TRIGGER IF EXISTS audit_doctors ON public.doctors;
CREATE TRIGGER audit_doctors
    AFTER INSERT OR UPDATE OR DELETE ON public.doctors
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

DROP TRIGGER IF EXISTS audit_users ON public.users;
CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Stock: actualizar al insertar movimiento
CREATE OR REPLACE FUNCTION public.update_supply_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo = 'entrada' THEN
        UPDATE public.supplies SET stock_actual = stock_actual + NEW.cantidad, updated_at = NOW() WHERE id = NEW.supply_id;
    ELSIF NEW.tipo = 'salida' THEN
        UPDATE public.supplies SET stock_actual = GREATEST(0, stock_actual - NEW.cantidad), updated_at = NOW() WHERE id = NEW.supply_id;
    ELSIF NEW.tipo = 'ajuste' THEN
        UPDATE public.supplies SET updated_at = NOW() WHERE id = NEW.supply_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_supply_stock ON public.supply_movements;
CREATE TRIGGER trigger_update_supply_stock
    AFTER INSERT ON public.supply_movements FOR EACH ROW
    WHEN (NEW.deleted_at IS NULL)
    EXECUTE FUNCTION public.update_supply_stock();

-- Stock: salida automática al programar cirugía
CREATE OR REPLACE FUNCTION public.create_supply_movements_from_surgery()
RETURNS TRIGGER AS $$
DECLARE supply_record RECORD;
BEGIN
    IF NEW.estado IN ('programada', 'en_proceso') AND (OLD.estado IS NULL OR OLD.estado != NEW.estado) THEN
        FOR supply_record IN
            SELECT ss.supply_id, ss.cantidad FROM public.surgery_supplies ss WHERE ss.surgery_id = NEW.id
        LOOP
            INSERT INTO public.supply_movements (supply_id, tipo, cantidad, motivo, relacionado_con, relacionado_tipo, created_by)
            VALUES (supply_record.supply_id, 'salida', supply_record.cantidad,
                    'Uso en cirugía programada', NEW.id, 'cirugia', NEW.doctor_id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_supply_movements_from_surgery ON public.surgeries;
CREATE TRIGGER trigger_supply_movements_from_surgery
    AFTER INSERT OR UPDATE ON public.surgeries FOR EACH ROW
    WHEN (NEW.deleted_at IS NULL)
    EXECUTE FUNCTION public.create_supply_movements_from_surgery();

-- updated_at para operation_supply_packs
CREATE OR REPLACE FUNCTION public.update_operation_supply_packs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_osp_updated_at ON public.operation_supply_packs;
CREATE TRIGGER trigger_osp_updated_at
    BEFORE UPDATE ON public.operation_supply_packs
    FOR EACH ROW EXECUTE FUNCTION public.update_operation_supply_packs_updated_at();
