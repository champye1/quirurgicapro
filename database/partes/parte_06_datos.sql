-- =====================================================================
-- PARTE 6 DE 6: DATOS INICIALES
-- Ejecutar después de parte_05_vistas_rls.sql
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
-- PASO FINAL: CREAR USUARIO PABELLÓN (manual)
-- =====================================================================
--
-- PASO 1: En Supabase Dashboard → Authentication → Users
--         Clic en "Add user" → "Create new user"
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
