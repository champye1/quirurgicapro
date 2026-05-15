-- Agregar teléfono a doctors
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS telefono TEXT;

-- Insertar configuración WhatsApp vacía en clinic_settings (si no existe)
INSERT INTO public.clinic_settings (key, value)
VALUES ('whatsapp_config', '{}')
ON CONFLICT (key) DO NOTHING;
