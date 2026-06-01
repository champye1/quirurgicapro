-- ============================================================
-- PARTE 14: Cifrado de secretos en clinic_settings con pgcrypto
-- Requiere variable de entorno en Supabase: CLINIC_SECRETS_KEY
-- ============================================================

-- Habilitar extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla dedicada para configuración cifrada (separada de clinic_settings general)
CREATE TABLE IF NOT EXISTS public.clinic_secrets (
  key         TEXT PRIMARY KEY,
  value_enc   BYTEA NOT NULL,           -- valor cifrado con pgp_sym_encrypt
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Solo service_role puede leer/escribir
ALTER TABLE public.clinic_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo service_role accede a clinic_secrets"
  ON public.clinic_secrets
  FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Función para guardar un secreto cifrado (llamada desde edge functions con service_role)
CREATE OR REPLACE FUNCTION public.save_clinic_secret(p_key TEXT, p_value TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enc_key TEXT := current_setting('app.clinic_secrets_key', true);
BEGIN
  IF v_enc_key IS NULL OR LENGTH(TRIM(v_enc_key)) < 16 THEN
    RAISE EXCEPTION 'CLINIC_SECRETS_KEY no configurada o demasiado corta';
  END IF;
  INSERT INTO public.clinic_secrets (key, value_enc, updated_at)
    VALUES (p_key, pgp_sym_encrypt(p_value, v_enc_key), NOW())
  ON CONFLICT (key) DO UPDATE
    SET value_enc = pgp_sym_encrypt(p_value, v_enc_key), updated_at = NOW();
END;
$$;

-- Función para leer un secreto descifrado
CREATE OR REPLACE FUNCTION public.read_clinic_secret(p_key TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enc_key TEXT := current_setting('app.clinic_secrets_key', true);
  v_row     clinic_secrets%ROWTYPE;
BEGIN
  IF v_enc_key IS NULL OR LENGTH(TRIM(v_enc_key)) < 16 THEN
    RAISE EXCEPTION 'CLINIC_SECRETS_KEY no configurada';
  END IF;
  SELECT * INTO v_row FROM clinic_secrets WHERE key = p_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(v_row.value_enc, v_enc_key);
END;
$$;

-- Grants solo para service_role (las edge functions usan service_role)
GRANT EXECUTE ON FUNCTION public.save_clinic_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_clinic_secret(TEXT)       TO service_role;

-- ── Instrucciones de configuración ───────────────────────────────────────────
-- 1. En Supabase Dashboard → Settings → Database → Configuration, agregar:
--    ALTER DATABASE postgres SET "app.clinic_secrets_key" = 'TU_CLAVE_ALEATORIA_32_CHARS';
-- 2. En Supabase Dashboard → Edge Functions → Secrets, agregar:
--    CLINIC_SECRETS_KEY=TU_CLAVE_ALEATORIA_32_CHARS  (misma que arriba)
-- 3. Migrar datos existentes ejecutando save_clinic_secret() para cada config sensible.
