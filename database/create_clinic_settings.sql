CREATE TABLE IF NOT EXISTS public.clinic_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

-- Pabellón puede leer solo claves no sensibles (configuración de UI, etc.)
-- Las credenciales (gmail_config, whatsapp_config) solo son leídas por Edge Functions via service_role
CREATE POLICY "Pabellon puede leer config no sensible" ON public.clinic_settings
  FOR SELECT USING (
    is_pabellon() AND key NOT IN ('gmail_config', 'whatsapp_config')
  );

CREATE POLICY "Pabellon puede escribir configuracion" ON public.clinic_settings
  FOR INSERT WITH CHECK (is_pabellon());

CREATE POLICY "Pabellon puede actualizar configuracion" ON public.clinic_settings
  FOR UPDATE USING (is_pabellon()) WITH CHECK (is_pabellon());
