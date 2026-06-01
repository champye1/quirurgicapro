-- ============================================================
-- PARTE 13: Seguridad — TTL tokens de paciente + RLS chat
-- ============================================================

-- ── 1. TTL en patient_access_tokens ──────────────────────────────────────────
-- Agregar columna expires_at si no existe (por defecto 30 días desde creación)
ALTER TABLE public.patient_access_tokens
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days');

-- Función RPC que valida token Y verifica expiración
CREATE OR REPLACE FUNCTION public.get_surgery_by_patient_token(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token_row  patient_access_tokens%ROWTYPE;
  v_request    surgery_requests%ROWTYPE;
  v_surgery    surgeries%ROWTYPE;
  v_patient    patients%ROWTYPE;
  v_doctor     doctors%ROWTYPE;
  v_room       operating_rooms%ROWTYPE;
BEGIN
  -- Validar formato del token
  IF p_token IS NULL OR LENGTH(TRIM(p_token)) < 8 THEN
    RETURN jsonb_build_object('token_valido', false, 'motivo', 'Token inválido');
  END IF;

  -- Buscar token
  SELECT * INTO v_token_row FROM patient_access_tokens WHERE token = TRIM(p_token) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('token_valido', false, 'motivo', 'Token no encontrado');
  END IF;

  -- Verificar expiración
  IF v_token_row.expires_at < NOW() THEN
    RETURN jsonb_build_object('token_valido', false, 'motivo', 'Token expirado');
  END IF;

  -- Obtener datos de la solicitud
  SELECT * INTO v_request FROM surgery_requests
    WHERE id = v_token_row.surgery_request_id AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('token_valido', false, 'motivo', 'Solicitud no encontrada');
  END IF;

  SELECT * INTO v_patient  FROM patients         WHERE id = v_request.patient_id   LIMIT 1;
  SELECT * INTO v_doctor   FROM doctors          WHERE id = v_request.doctor_id    LIMIT 1;
  SELECT * INTO v_surgery  FROM surgeries        WHERE surgery_request_id = v_request.id AND deleted_at IS NULL LIMIT 1;
  IF FOUND THEN
    SELECT * INTO v_room FROM operating_rooms WHERE id = v_surgery.operating_room_id LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'token_valido',       true,
    'estado_solicitud',   v_request.estado,
    'codigo_operacion',   v_request.codigo_operacion,
    'motivo_rechazo',     v_request.motivo_rechazo,
    'observaciones',      v_request.observaciones,
    'nombre_paciente',    COALESCE(v_patient.nombre, ''),
    'apellido_paciente',  COALESCE(v_patient.apellido, ''),
    'nombre_doctor',      COALESCE(v_doctor.nombre, ''),
    'apellido_doctor',    COALESCE(v_doctor.apellido, ''),
    'especialidad_doctor',COALESCE(v_doctor.especialidad, ''),
    'fecha_cirugia',      v_surgery.fecha,
    'hora_inicio',        v_surgery.hora_inicio,
    'hora_fin',           v_surgery.hora_fin,
    'estado_cirugia',     v_surgery.estado,
    'nombre_pabellon',    v_room.nombre,
    'expires_at',         v_token_row.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_surgery_by_patient_token(TEXT) TO anon, authenticated;

-- ── 2. RLS para chat_messages — evitar IDOR en threads de chat ───────────────
-- Política SELECT: doctor solo ve mensajes de canal general O sus propias solicitudes
DROP POLICY IF EXISTS "chat_messages_select_doctor" ON public.chat_messages;
CREATE POLICY "chat_messages_select_doctor"
  ON public.chat_messages
  FOR SELECT
  USING (
    -- Pabellón ve todo
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'pabellon')
    OR
    -- Canal general (sin surgery_request_id): cualquier autenticado
    surgery_request_id IS NULL
    OR
    -- Mensajes de solicitudes propias del doctor
    EXISTS (
      SELECT 1 FROM public.surgery_requests sr
      JOIN public.doctors d ON d.id = sr.doctor_id
      WHERE sr.id = chat_messages.surgery_request_id
        AND d.user_id = auth.uid()
        AND sr.deleted_at IS NULL
    )
  );

-- ── 3. Trigger: validar sender_role en INSERT de chat_messages ───────────────
CREATE OR REPLACE FUNCTION public.validate_chat_sender_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  SELECT role INTO v_user_role FROM public.users WHERE id = auth.uid();

  -- Médico solo puede enviar con role 'doctor'
  IF v_user_role = 'doctor' AND NEW.sender_role <> 'doctor' THEN
    RAISE EXCEPTION 'sender_role inválido para el rol de usuario';
  END IF;

  -- Pabellón solo puede enviar con role 'pabellon'
  IF v_user_role = 'pabellon' AND NEW.sender_role <> 'pabellon' THEN
    RAISE EXCEPTION 'sender_role inválido para el rol de usuario';
  END IF;

  -- Asegurar que el sender_id coincide con el usuario autenticado
  IF NEW.sender_id <> auth.uid() THEN
    RAISE EXCEPTION 'sender_id debe coincidir con el usuario autenticado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_chat_sender_role ON public.chat_messages;
CREATE TRIGGER trg_validate_chat_sender_role
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.validate_chat_sender_role();

-- ── 4. Limpiar tokens expirados (función para ejecutar periódicamente) ────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_access_tokens()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.patient_access_tokens WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_access_tokens() TO service_role;
