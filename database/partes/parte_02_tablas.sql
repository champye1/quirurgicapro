-- =====================================================================
-- PARTE 2 DE 6: TABLAS E ÍNDICES
-- Ejecutar después de parte_01_enums.sql
-- =====================================================================

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

CREATE INDEX IF NOT EXISTS idx_doctors_user_id      ON public.doctors(user_id)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doctors_rut          ON public.doctors(rut)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doctors_estado       ON public.doctors(estado)       WHERE deleted_at IS NULL;
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
COMMENT ON COLUMN public.supplies.grupos_fonasa  IS 'Grupos Fonasa para los que aplica este insumo. Vacío = aplica a todas las cirugías.';
COMMENT ON COLUMN public.supplies.proveedor      IS 'Proveedor del insumo.';

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

CREATE INDEX IF NOT EXISTS idx_surgery_requests_doctor_id  ON public.surgery_requests(doctor_id)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgery_requests_estado     ON public.surgery_requests(estado)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgery_requests_created_at ON public.surgery_requests(created_at DESC) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.surgery_requests.fecha_preferida               IS 'Fecha preferida por el doctor para la cirugía';
COMMENT ON COLUMN public.surgery_requests.hora_fin_recomendada          IS 'Hora fin del slot preferido';
COMMENT ON COLUMN public.surgery_requests.operating_room_id_preferido   IS 'Pabellón preferido por el doctor al solicitar el horario';
COMMENT ON COLUMN public.surgery_requests.fecha_preferida_2             IS 'Segunda fecha preferida (alternativa)';
COMMENT ON COLUMN public.surgery_requests.hora_recomendada_2            IS 'Hora inicio del segundo horario preferido';
COMMENT ON COLUMN public.surgery_requests.hora_fin_recomendada_2        IS 'Hora fin del segundo horario preferido';
COMMENT ON COLUMN public.surgery_requests.operating_room_id_preferido_2 IS 'Segundo pabellón preferido (alternativa)';
COMMENT ON COLUMN public.surgery_requests.dejar_fecha_a_pabellon        IS 'Si true, el doctor deja que pabellón asigne la fecha/hora';
COMMENT ON COLUMN public.surgery_requests.horarios_preferidos_extra     IS 'Array JSON de horarios adicionales';
COMMENT ON COLUMN public.surgery_requests.reagendamiento_notificado_at  IS 'Fecha/hora en que se notificó a pabellón sobre la solicitud de reagendamiento.';

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

CREATE INDEX IF NOT EXISTS idx_surgeries_doctor_id         ON public.surgeries(doctor_id)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_operating_room_id ON public.surgeries(operating_room_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_fecha             ON public.surgeries(fecha)              WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_fecha_hora        ON public.surgeries(fecha, hora_inicio) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_estado            ON public.surgeries(estado)             WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_estado_hora       ON public.surgeries(estado_hora)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_surgeries_fecha_anterior    ON public.surgeries(fecha_anterior)     WHERE deleted_at IS NULL AND fecha_anterior IS NOT NULL;

COMMENT ON COLUMN public.surgeries.estado_hora              IS 'Estado de la hora: vacio, agendado, reagendado, bloqueado';
COMMENT ON COLUMN public.surgeries.fecha_anterior           IS 'Fecha anterior cuando fue reagendada';
COMMENT ON COLUMN public.surgeries.hora_inicio_anterior     IS 'Hora de inicio anterior cuando fue reagendada';
COMMENT ON COLUMN public.surgeries.hora_fin_anterior        IS 'Hora de fin anterior cuando fue reagendada';
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

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_doctor_id         ON public.schedule_blocks(doctor_id)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_operating_room_id ON public.schedule_blocks(operating_room_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_fecha             ON public.schedule_blocks(fecha)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_vigencia          ON public.schedule_blocks(vigencia_hasta)   WHERE deleted_at IS NULL AND vigencia_hasta IS NOT NULL;
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

CREATE INDEX IF NOT EXISTS idx_reminders_user_id    ON public.reminders(user_id)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_visto      ON public.reminders(visto)             WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_created_at ON public.reminders(created_at DESC)   WHERE deleted_at IS NULL;

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
        'operacion_reagendada',
        'solicitud_cancelada',
        'orden_sin_agendar'
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
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC)  WHERE deleted_at IS NULL;

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

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id        ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tabla_afectada ON public.audit_logs(tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at     ON public.audit_logs(created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_external_messages_leido      ON public.external_messages(leido)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_external_messages_created_at ON public.external_messages(created_at DESC)  WHERE deleted_at IS NULL;
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
