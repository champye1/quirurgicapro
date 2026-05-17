-- =====================================================================
-- CUENTAS DE ACCESO PARA MÉDICOS DEMO
-- Contraseña: Demo1234! para todos
-- Se puede re-ejecutar de forma segura
-- =====================================================================

DO $$
DECLARE
  r      RECORD;
  v_id   UUID;
BEGIN
  -- ===== LIMPIEZA PREVIA =====
  -- Desvincular doctores antes de borrar public.users (evitar CASCADE que borraría los doctors)
  UPDATE public.doctors SET user_id = NULL, acceso_web_enabled = false
  WHERE user_id IN (
    SELECT id FROM public.users
    WHERE email LIKE '%@clinicademo.cl'
       OR username IN ('osilva','mrantul','gvenegas','ccantillano','jargomedo')
  );

  -- Borrar public.users por email o username demo
  DELETE FROM public.users
  WHERE email LIKE '%@clinicademo.cl'
     OR username IN ('osilva','mrantul','gvenegas','ccantillano','jargomedo');

  -- Borrar auth.users por email (cascadea auth.identities automáticamente)
  DELETE FROM auth.users WHERE email LIKE '%@clinicademo.cl';

  FOR r IN
    SELECT * FROM (VALUES
      ('oliver.silva@clinicademo.cl',      'osilva'),
      ('moncerat.rantul@clinicademo.cl',   'mrantul'),
      ('gabriela.venegas@clinicademo.cl',  'gvenegas'),
      ('carmen.cantillano@clinicademo.cl', 'ccantillano'),
      ('javier.argomedo@clinicademo.cl',   'jargomedo')
    ) AS t(email, username)
  LOOP

    -- Si ya existe auth user, solo actualizar contraseña y continuar
    SELECT id INTO v_id FROM auth.users WHERE email = r.email;

    IF v_id IS NOT NULL THEN
      UPDATE auth.users
      SET encrypted_password = crypt('Demo1234!', gen_salt('bf')),
          updated_at          = NOW()
      WHERE id = v_id;

      INSERT INTO public.users (id, email, role, username)
      VALUES (v_id, r.email, 'doctor', r.username)
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

      UPDATE public.doctors
      SET user_id = v_id, acceso_web_enabled = true
      WHERE email = r.email;

      CONTINUE;
    END IF;

    -- Crear auth user nuevo
    v_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id,
      email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      aud, role, is_sso_user
    ) VALUES (
      v_id,
      '00000000-0000-0000-0000-000000000000',
      r.email,
      crypt('Demo1234!', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      'authenticated', 'authenticated',
      false
    );

    -- Identity necesaria para que el login funcione
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at, provider_id
    ) VALUES (
      gen_random_uuid(), v_id,
      jsonb_build_object('sub', v_id::text, 'email', r.email),
      'email',
      NOW(), NOW(), NOW(),
      r.email
    );

    -- Registro en tabla pública
    INSERT INTO public.users (id, email, role, username)
    VALUES (v_id, r.email, 'doctor', r.username);

    -- Vincular doctor existente
    UPDATE public.doctors
    SET user_id = v_id, acceso_web_enabled = true
    WHERE email = r.email;

  END LOOP;

  RAISE NOTICE 'Listo. 5 medicos con acceso web. Contrasena: Demo1234!';
END $$;
