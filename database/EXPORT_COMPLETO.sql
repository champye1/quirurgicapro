-- =====================================================================
-- EXPORT COMPLETO - SISTEMA CLÍNICO QUIRÚRGICO
-- Clínica Privada Viña del Mar
-- =====================================================================
-- INSTRUCCIONES:
-- 1. Abre el SQL Editor de tu nuevo proyecto en Supabase.
-- 2. Ejecuta PARTE 1 completa (schema + funciones + triggers + RLS).
-- 3. Ejecuta PARTE 2 (datos iniciales: pabellones e insumos básicos).
-- 4. Sigue las instrucciones de PARTE 3 para crear el usuario pabellón.
-- =====================================================================


-- =====================================================================
-- PARTE 1: SCHEMA COMPLETO
-- =====================================================================

-- ─────────────────────────────────────────────
-- 2. TIPOS ENUM
-- ─────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE doctor_status AS ENUM ('activo', 'vacaciones');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('pendiente', 'aceptada', 'rechazada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE surgery_status AS ENUM ('programada', 'en_proceso', 'completada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE medical_specialty AS ENUM (
        'cirugia_general',
        'cirugia_cardiovascular',
        'cirugia_plastica',
        'cirugia_ortopedica',
        'neurocirugia',
        'cirugia_oncologica',
        'urologia',
        'ginecologia',
        'otorrinolaringologia',
        'oftalmologia',
        'otra'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE hour_state AS ENUM ('vacio', 'agendado', 'reagendado', 'bloqueado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────
-- 3. TABLAS (en orden de dependencias)
-- ─────────────────────────────────────────────

-- TABLA: USUARIOS
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('pabellon', 'doctor')),
    username TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role     ON public.users(role)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email    ON public.users(email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
    ON public.users(username) WHERE username IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.users.username IS 'Nombre de usuario para login alternativo al email';

-- TABLA: DOCTORES
CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    rut TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    especialidad medical_specialty NOT NULL,
    estado doctor_status NOT NULL DEFAULT 'activo',
    acceso_web_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT rut_format CHECK (rut ~ '^[0-9]{7,8}-[0-9kK]{1}$')
);

CREATE INDEX IF NOT EXISTS idx_doctors_user_id     ON public.doctors(user_id)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doctors_rut         ON public.doctors(rut)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doctors_estado      ON public.doctors(estado)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doctors_especialidad ON public.doctors(especialidad) WHERE deleted_at IS NULL;

-- TABLA: PABELLONES QUIRÚRGICOS
CREATE TABLE IF NOT EXISTS public.operating_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL UNIQUE,
    camillas_disponibles INTEGER NOT NULL DEFAULT 1 CHECK (camillas_disponibles > 0),
    activo BOOLEAN NOT NULL DEFAULT true,
    tiempo_limpieza_minutos INTEGER NOT NULL DEFAULT 30 CHECK (tiempo_limpieza_minutos >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_operating_rooms_activo ON public.operating_rooms(activo) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.operating_rooms.tiempo_limpieza_minutos IS 'Tiempo requerido para limpieza entre cirugías (en minutos)';

-- TABLA: PACIENTES
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    rut TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    UNIQUE(doctor_id, rut)
);

CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON public.patients(doctor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_rut       ON public.patients(rut)       WHERE deleted_at IS NULL;

-- TABLA: INSUMOS
CREATE TABLE IF NOT EXISTS public.supplies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    codigo TEXT NOT NULL UNIQUE,
    grupo_prestacion TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    stock_actual INTEGER NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo INTEGER NOT NULL DEFAULT 10 CHECK (stock_minimo >= 0),
    unidad_medida TEXT NOT NULL DEFAULT 'unidad',
    grupos_fonasa TEXT NULL DEFAULT NULL,
    proveedor TEXT NULL DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_supplies_codigo      ON public.supplies(codigo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_supplies_activo      ON public.supplies(activo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_supplies_stock_bajo
    ON public.supplies(stock_actual)
    WHERE deleted_at IS NULL AND activo = true AND stock_actual <= stock_minimo;

COMMENT ON COLUMN public.supplies.stock_actual   IS 'Cantidad actual disponible en inventario';
COMMENT ON COLUMN public.supplies.stock_minimo   IS 'Cantidad mínima antes de generar alerta';
COMMENT ON COLUMN public.supplies.unidad_medida  IS 'Unidad de medida (unidad, caja, litro, etc.)';
COMMENT ON COLUMN public.supplies.grupos_fonasa  IS 'Grupos Fonasa para los que aplica este insumo. Vacío = aplica a todas las cirugías. Valores separados por coma.';
COMMENT ON COLUMN public.supplies.proveedor      IS 'Proveedor del insumo (quien proveyó el item).';

-- TABLA: SOLICITUDES QUIRÚRGICAS
CREATE TABLE IF NOT EXISTS public.surgery_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    codigo_operacion TEXT NOT NULL,
    hora_recomendada TIME NULL,
    hora_fin_recomendada TIME NULL,
    observaciones TEXT,
    estado request_status NOT NULL DEFAULT 'pendiente',
    fecha_preferida DATE NULL,
    operating_room_id_preferido UUID NULL REFERENCES public.operating_rooms(id) ON DELETE SET NULL,
    fecha_preferida_2 DATE NULL,
    hora_recomendada_2 TIME NULL,
    hora_fin_recomendada_2 TIME NULL,
    operating_room_id_preferido_2 UUID NULL REFERENCES public.operating_rooms(id) ON DELETE SET NULL,
    dejar_fecha_a_pabellon BOOLEAN NOT NULL DEFAULT false,
    horarios_preferidos_extra JSONB NULL,
    reagendamiento_notificado_at TIMESTAMPTZ NULL DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_surgery_requests_doctor_id  ON public.surgery_requests(doctor_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgery_requests_estado     ON public.surgery_requests(estado)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgery_requests_created_at ON public.surgery_requests(created_at DESC) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.surgery_requests.fecha_preferida              IS 'Fecha preferida por el doctor para la cirugía';
COMMENT ON COLUMN public.surgery_requests.hora_fin_recomendada         IS 'Hora fin del slot preferido';
COMMENT ON COLUMN public.surgery_requests.operating_room_id_preferido  IS 'Pabellón preferido por el doctor al solicitar el horario';
COMMENT ON COLUMN public.surgery_requests.fecha_preferida_2            IS 'Segunda fecha preferida (alternativa) por el doctor';
COMMENT ON COLUMN public.surgery_requests.hora_recomendada_2           IS 'Hora inicio del segundo horario preferido';
COMMENT ON COLUMN public.surgery_requests.hora_fin_recomendada_2       IS 'Hora fin del segundo horario preferido';
COMMENT ON COLUMN public.surgery_requests.operating_room_id_preferido_2 IS 'Segundo pabellón preferido (alternativa)';
COMMENT ON COLUMN public.surgery_requests.dejar_fecha_a_pabellon       IS 'Si true, el doctor deja que pabellón asigne la fecha/hora';
COMMENT ON COLUMN public.surgery_requests.horarios_preferidos_extra    IS 'Array JSON de horarios adicionales: [{fecha_preferida, operating_room_id, hora_recomendada, hora_fin_recomendada}]';
COMMENT ON COLUMN public.surgery_requests.reagendamiento_notificado_at IS 'Fecha/hora en que se notificó a pabellón sobre la solicitud de reagendamiento.';

-- TABLA: INSUMOS POR SOLICITUD
CREATE TABLE IF NOT EXISTS public.surgery_request_supplies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_request_id UUID NOT NULL REFERENCES public.surgery_requests(id) ON DELETE CASCADE,
    supply_id UUID NOT NULL REFERENCES public.supplies(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(surgery_request_id, supply_id)
);

CREATE INDEX IF NOT EXISTS idx_srs_surgery_request_id ON public.surgery_request_supplies(surgery_request_id);
CREATE INDEX IF NOT EXISTS idx_srs_supply_id          ON public.surgery_request_supplies(supply_id);

-- TABLA: CIRUGÍAS PROGRAMADAS
CREATE TABLE IF NOT EXISTS public.surgeries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_request_id UUID NOT NULL UNIQUE REFERENCES public.surgery_requests(id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    operating_room_id UUID NOT NULL REFERENCES public.operating_rooms(id) ON DELETE RESTRICT,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    estado surgery_status NOT NULL DEFAULT 'programada',
    estado_hora hour_state NOT NULL DEFAULT 'agendado',
    fecha_anterior DATE NULL,
    hora_inicio_anterior TIME NULL,
    hora_fin_anterior TIME NULL,
    fecha_ultimo_agendamiento TIMESTAMPTZ NULL,
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT hora_valida CHECK (hora_fin > hora_inicio),
    CONSTRAINT fecha_futura CHECK (fecha >= CURRENT_DATE),
    CONSTRAINT check_reagendado_tiene_fecha_anterior CHECK (
        (estado_hora != 'reagendado') OR
        (estado_hora = 'reagendado' AND fecha_anterior IS NOT NULL AND hora_inicio_anterior IS NOT NULL AND hora_fin_anterior IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_surgeries_doctor_id        ON public.surgeries(doctor_id)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_operating_room_id ON public.surgeries(operating_room_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_fecha             ON public.surgeries(fecha)             WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_fecha_hora        ON public.surgeries(fecha, hora_inicio) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_estado            ON public.surgeries(estado)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_estado_hora       ON public.surgeries(estado_hora)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_fecha_anterior    ON public.surgeries(fecha_anterior)    WHERE deleted_at IS NULL AND fecha_anterior IS NOT NULL;

COMMENT ON COLUMN public.surgeries.estado_hora             IS 'Estado de la hora: vacio, agendado, reagendado, bloqueado';
COMMENT ON COLUMN public.surgeries.fecha_anterior          IS 'Fecha anterior cuando fue reagendada';
COMMENT ON COLUMN public.surgeries.hora_inicio_anterior    IS 'Hora de inicio anterior cuando fue reagendada';
COMMENT ON COLUMN public.surgeries.hora_fin_anterior       IS 'Hora de fin anterior cuando fue reagendada';
COMMENT ON COLUMN public.surgeries.fecha_ultimo_agendamiento IS 'Fecha y hora del último agendamiento';

-- TABLA: INSUMOS POR CIRUGÍA
CREATE TABLE IF NOT EXISTS public.surgery_supplies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_id UUID NOT NULL REFERENCES public.surgeries(id) ON DELETE CASCADE,
    supply_id UUID NOT NULL REFERENCES public.supplies(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(surgery_id, supply_id)
);

CREATE INDEX IF NOT EXISTS idx_ss_surgery_id ON public.surgery_supplies(surgery_id);
CREATE INDEX IF NOT EXISTS idx_ss_supply_id  ON public.surgery_supplies(supply_id);

-- TABLA: BLOQUEOS DE HORARIO
CREATE TABLE IF NOT EXISTS public.schedule_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    operating_room_id UUID NOT NULL REFERENCES public.operating_rooms(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    motivo TEXT,
    vigencia_hasta DATE NULL,
    dias_auto_liberacion INTEGER NULL CHECK (dias_auto_liberacion IS NULL OR dias_auto_liberacion > 0),
    fecha_auto_liberacion DATE NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT hora_valida_block CHECK (hora_fin > hora_inicio),
    CONSTRAINT vigencia_valida CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= fecha)
);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_doctor_id        ON public.schedule_blocks(doctor_id)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_operating_room_id ON public.schedule_blocks(operating_room_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_fecha            ON public.schedule_blocks(fecha)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_vigencia         ON public.schedule_blocks(vigencia_hasta)   WHERE deleted_at IS NULL AND vigencia_hasta IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_fecha_auto_liberacion
    ON public.schedule_blocks(fecha_auto_liberacion)
    WHERE deleted_at IS NULL AND fecha_auto_liberacion IS NOT NULL;

COMMENT ON COLUMN public.schedule_blocks.dias_auto_liberacion  IS 'Días hacia adelante para auto-liberación. NULL = sin auto-liberación';
COMMENT ON COLUMN public.schedule_blocks.fecha_auto_liberacion IS 'Fecha calculada de auto-liberación (fecha + dias_auto_liberacion)';

-- TABLA: RECORDATORIOS
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('aviso', 'operacion_aceptada', 'recordatorio_general')),
    relacionado_con UUID NULL,
    visto BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_user_id   ON public.reminders(user_id)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_visto     ON public.reminders(visto)             WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_created_at ON public.reminders(created_at DESC) WHERE deleted_at IS NULL;

-- TABLA: NOTIFICACIONES
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN (
        'solicitud_aceptada',
        'solicitud_rechazada',
        'operacion_programada',
        'bloqueo_creado',
        'recordatorio',
        'solicitud_reagendamiento',
        'operacion_reagendada'
    )),
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    relacionado_con UUID NULL,
    vista BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON public.notifications(user_id)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_vista      ON public.notifications(vista)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC) WHERE deleted_at IS NULL;

-- TABLA: AUDITORÍA
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    accion TEXT NOT NULL,
    tabla_afectada TEXT NOT NULL,
    registro_id UUID NULL,
    datos_anteriores JSONB NULL,
    datos_nuevos JSONB NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id       ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tabla_afectada ON public.audit_logs(tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at    ON public.audit_logs(created_at DESC);

-- TABLA: MENSAJES EXTERNOS (doctores sin cuenta)
CREATE TABLE IF NOT EXISTS public.external_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_remitente TEXT NOT NULL,
    email_remitente TEXT NOT NULL,
    telefono_remitente TEXT,
    especialidad_remitente TEXT,
    institucion_remitente TEXT,
    asunto TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    nombre_paciente TEXT,
    rut_paciente TEXT,
    tipo_cirugia TEXT,
    urgencia TEXT NOT NULL DEFAULT 'normal' CHECK (urgencia IN ('normal', 'urgente', 'electiva')),
    leido BOOLEAN NOT NULL DEFAULT false,
    leido_at TIMESTAMPTZ,
    leido_por UUID REFERENCES public.users(id),
    archivado BOOLEAN NOT NULL DEFAULT false,
    notas_internas TEXT,
    gmail_message_id TEXT UNIQUE,
    fuente TEXT NOT NULL DEFAULT 'formulario' CHECK (fuente IN ('formulario', 'gmail')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_external_messages_leido      ON public.external_messages(leido)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_external_messages_created_at ON public.external_messages(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_external_messages_gmail_id   ON public.external_messages(gmail_message_id) WHERE gmail_message_id IS NOT NULL;

-- TABLA: MOVIMIENTOS DE INVENTARIO
CREATE TABLE IF NOT EXISTS public.supply_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supply_id UUID NOT NULL REFERENCES public.supplies(id) ON DELETE RESTRICT,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    motivo TEXT,
    relacionado_con UUID NULL,
    relacionado_tipo TEXT NULL CHECK (relacionado_tipo IN ('cirugia', 'solicitud', 'ajuste_manual', 'compra')),
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_supply_movements_supply_id  ON public.supply_movements(supply_id)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_supply_movements_tipo       ON public.supply_movements(tipo)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_supply_movements_created_at ON public.supply_movements(created_at DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.supply_movements IS 'Registro de todos los movimientos de inventario de insumos';

-- TABLA: PACKS DE INSUMOS POR CÓDIGO DE OPERACIÓN
CREATE TABLE IF NOT EXISTS public.operation_supply_packs (
    codigo_operacion TEXT NOT NULL,
    supply_id UUID NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (codigo_operacion, supply_id)
);

CREATE INDEX IF NOT EXISTS idx_osp_codigo    ON public.operation_supply_packs(codigo_operacion);
CREATE INDEX IF NOT EXISTS idx_osp_supply_id ON public.operation_supply_packs(supply_id);

COMMENT ON TABLE public.operation_supply_packs IS 'Packs de insumos por código de operación. cantidad>=1 = pack (autoañadir); cantidad=0 = solo recomendado.';

-- TABLA: HISTORIAL DE REAGENDAMIENTOS
CREATE TABLE IF NOT EXISTS public.surgery_schedule_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_id UUID NOT NULL REFERENCES public.surgeries(id) ON DELETE CASCADE,
    fecha_anterior DATE NOT NULL,
    hora_inicio_anterior TIME NOT NULL,
    hora_fin_anterior TIME NOT NULL,
    fecha_nueva DATE NOT NULL,
    hora_inicio_nueva TIME NOT NULL,
    hora_fin_nueva TIME NOT NULL,
    motivo TEXT NULL,
    created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surgery_schedule_history_surgery_id
    ON public.surgery_schedule_history(surgery_id);
CREATE INDEX IF NOT EXISTS idx_surgery_schedule_history_created_at
    ON public.surgery_schedule_history(created_at DESC);

COMMENT ON TABLE public.surgery_schedule_history IS 'Historial completo de todos los reagendamientos de cirugías.';


-- ─────────────────────────────────────────────
-- 4. FUNCIONES Y TRIGGERS
-- ─────────────────────────────────────────────

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

-- Estado y reagendamiento al crear/actualizar cirugía (versión final con validaciones)
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

-- Validación de solapamiento y tiempo de limpieza (versión final)
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

-- Auditoría (versión final con SECURITY DEFINER)
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


-- ─────────────────────────────────────────────
-- 5. FUNCIONES RPC (llamadas desde el frontend)
-- ─────────────────────────────────────────────

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

-- Liberar bloqueos expirados (versión final: solo si el slot no se llenó)
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


-- ─────────────────────────────────────────────
-- 6. VISTAS
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
-- 7. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

ALTER TABLE public.users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplies                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_request_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeries               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_supplies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_supply_packs  ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "external_messages_insert_anon"    ON public.external_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
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
-- 8. REALTIME
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.surgery_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.surgeries;


-- =====================================================================
-- PARTE 2: DATOS INICIALES
-- =====================================================================

-- Pabellones básicos (4 quirófanos)
INSERT INTO public.operating_rooms (nombre, camillas_disponibles, activo, tiempo_limpieza_minutos)
VALUES
    ('Pabellón 1', 1, true, 30),
    ('Pabellón 2', 1, true, 30),
    ('Pabellón 3', 1, true, 30),
    ('Pabellón 4', 1, true, 30)
ON CONFLICT (nombre) DO NOTHING;

-- Insumos básicos
INSERT INTO public.supplies (nombre, codigo, grupo_prestacion, activo) VALUES
('Guantes quirúrgicos estériles talla 6.5', 'INS-001', 'Protección y Asepsia', true),
('Guantes quirúrgicos estériles talla 7',   'INS-002', 'Protección y Asepsia', true),
('Guantes quirúrgicos estériles talla 7.5', 'INS-003', 'Protección y Asepsia', true),
('Guantes quirúrgicos estériles talla 8',   'INS-004', 'Protección y Asepsia', true),
('Guantes quirúrgicos estériles talla 8.5', 'INS-005', 'Protección y Asepsia', true),
('Mascarilla quirúrgica desechable',         'INS-006', 'Protección y Asepsia', true),
('Mascarilla N95',                           'INS-007', 'Protección y Asepsia', true),
('Gorro quirúrgico desechable',              'INS-008', 'Protección y Asepsia', true),
('Bata quirúrgica estéril talla S',          'INS-009', 'Protección y Asepsia', true),
('Bata quirúrgica estéril talla M',          'INS-010', 'Protección y Asepsia', true),
('Bata quirúrgica estéril talla L',          'INS-011', 'Protección y Asepsia', true),
('Bata quirúrgica estéril talla XL',         'INS-012', 'Protección y Asepsia', true),
('Cubrecalzado desechable',                  'INS-013', 'Protección y Asepsia', true),
('Antiséptico yodado (Povidona yodada)',      'INS-014', 'Protección y Asepsia', true),
('Alcohol al 70%',                           'INS-015', 'Protección y Asepsia', true),
('Clorhexidina al 2%',                       'INS-016', 'Protección y Asepsia', true),
('Solución salina estéril 500ml',            'INS-017', 'Protección y Asepsia', true),
('Solución salina estéril 1000ml',           'INS-018', 'Protección y Asepsia', true)
ON CONFLICT (codigo) DO NOTHING;


-- =====================================================================
-- PARTE 3: CREAR USUARIO PABELLÓN (seguir estos pasos manualmente)
-- =====================================================================
--
-- PASO 1: En Supabase Dashboard → Authentication → Users
--         Crea un usuario con:
--           - Email:    pabellon@tuclinica.cl  (usa el email real)
--           - Password: (contraseña segura)
--           - Marca "Auto Confirm User"
--         Copia el UUID generado.
--
-- PASO 2: Ejecuta este bloque reemplazando UUID y email:
--
-- INSERT INTO public.users (id, email, role)
-- VALUES (
--     'PEGA-AQUI-EL-UUID-DEL-AUTH',
--     'pabellon@tuclinica.cl',
--     'pabellon'
-- )
-- ON CONFLICT (id) DO UPDATE SET role = 'pabellon', email = EXCLUDED.email;
--
-- PASO 3: Para crear doctores usa la Edge Function create-doctor
--         o el formulario de Médicos dentro de la aplicación.
-- =====================================================================
