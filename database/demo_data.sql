-- =====================================================================
-- DATOS DE DEMO – Clínica Dental
-- Ejecutar una sola vez en el proyecto Supabase vinculado.
-- Se puede re-ejecutar de forma segura (limpia y recrea los datos).
-- =====================================================================

DO $$
DECLARE
  v_pab1 UUID; v_pab2 UUID; v_pab3 UUID; v_pab4 UUID;
  v_m1   UUID; v_m2   UUID; v_m3   UUID; v_m4   UUID; v_m5   UUID;
  v_p01  UUID; v_p02  UUID; v_p03  UUID; v_p04  UUID; v_p05  UUID;
  v_p06  UUID; v_p07  UUID; v_p08  UUID; v_p09  UUID; v_p10  UUID;
  v_p11  UUID; v_p12  UUID; v_p13  UUID; v_p14  UUID; v_p15  UUID;
  v_s01  UUID; v_s02  UUID; v_s03  UUID; v_s04  UUID; v_s05  UUID;
BEGIN

  -- ===== LIMPIEZA (permite re-ejecutar sin conflictos) =====
  DELETE FROM public.surgeries
    WHERE doctor_id IN (
      SELECT id FROM public.doctors
      WHERE email LIKE '%@clinicademo.cl'
         OR rut IN ('11111111-1','22222222-2','12345678-5','13456789-9','14567890-0')
    );
  DELETE FROM public.surgery_requests
    WHERE doctor_id IN (
      SELECT id FROM public.doctors
      WHERE email LIKE '%@clinicademo.cl'
         OR rut IN ('11111111-1','22222222-2','12345678-5','13456789-9','14567890-0')
    );
  DELETE FROM public.patients
    WHERE doctor_id IN (
      SELECT id FROM public.doctors
      WHERE email LIKE '%@clinicademo.cl'
         OR rut IN ('11111111-1','22222222-2','12345678-5','13456789-9','14567890-0')
    );
  DELETE FROM public.doctors
  WHERE email LIKE '%@clinicademo.cl'
     OR rut IN ('11111111-1','22222222-2','12345678-5','13456789-9','14567890-0');

  -- ===== PABELLONES – nombres dentales =====
  UPDATE public.operating_rooms SET nombre = 'Pabellón Dental 1 – Cirugía Oral'
    WHERE nombre = 'Pabellón 1' AND deleted_at IS NULL;
  UPDATE public.operating_rooms SET nombre = 'Pabellón Dental 2 – Endodoncia'
    WHERE nombre = 'Pabellón 2' AND deleted_at IS NULL;
  UPDATE public.operating_rooms SET nombre = 'Sala de Urgencias Dentales'
    WHERE nombre = 'Pabellón 3' AND deleted_at IS NULL;
  UPDATE public.operating_rooms SET nombre = 'Pabellón de Implantes y Periodoncia'
    WHERE nombre = 'Pabellón 4' AND deleted_at IS NULL;

  SELECT id INTO v_pab1 FROM public.operating_rooms WHERE nombre = 'Pabellón Dental 1 – Cirugía Oral'   AND deleted_at IS NULL;
  SELECT id INTO v_pab2 FROM public.operating_rooms WHERE nombre = 'Pabellón Dental 2 – Endodoncia'     AND deleted_at IS NULL;
  SELECT id INTO v_pab3 FROM public.operating_rooms WHERE nombre = 'Sala de Urgencias Dentales'         AND deleted_at IS NULL;
  SELECT id INTO v_pab4 FROM public.operating_rooms WHERE nombre = 'Pabellón de Implantes y Periodoncia' AND deleted_at IS NULL;

  -- ===== INSUMOS DENTALES =====
  INSERT INTO public.supplies (nombre, codigo, grupo_prestacion, activo, stock_actual, stock_minimo, unidad_medida, proveedor)
  VALUES
    ('Anestesia Lidocaína 2% con Epinefrina', 'DEN-001', 'Anestesia Dental',              true, 150, 30, 'cartucho', 'Dentsply Sirona'),
    ('Hilo de Sutura Seda 3/0',               'DEN-002', 'Suturas y Hemostasia',           true,  80, 20, 'sobre',    'Ethicon'),
    ('Jeringa Dental 1.8ml',                  'DEN-003', 'Instrumental Desechable',        true, 200, 50, 'unidad',   'Dentsply Sirona'),
    ('Fórceps Dental #150 Maxilar Superior',  'DEN-004', 'Instrumental Quirúrgico Dental', true,  10,  2, 'unidad',   'Hu-Friedy'),
    ('Implante Titanio 3.75x10mm',            'DEN-005', 'Implantología',                  true,  25,  5, 'unidad',   'Nobel Biocare'),
    ('Membrana de Colágeno Reabsorbible',     'DEN-006', 'Regeneración Ósea',              true,  15,  3, 'unidad',   'Geistlich'),
    ('Hoja de Bisturí #15',                   'DEN-007', 'Instrumental Desechable',        true, 100, 20, 'unidad',   'Swann-Morton'),
    ('Gasas Estériles Dentales 5x5cm',        'DEN-008', 'Hemostasia',                     true, 500,100, 'paquete',  'Hartmann'),
    ('Ácido Fosfórico 37% Grabado Adamantino','DEN-009', 'Endodoncia y Operatoria',        true,  40, 10, 'jeringa',  'Ultradent'),
    ('Lima Rotatoria NiTi ProTaper Next',     'DEN-010', 'Endodoncia',                     true,  30, 10, 'set',      'Dentsply Sirona')
  ON CONFLICT (codigo) DO NOTHING;

  -- ===== MÉDICOS =====
  INSERT INTO public.doctors (nombre, apellido, rut, email, especialidad, estado, acceso_web_enabled)
  VALUES ('Oliver',   'Silva',      '11111111-1', 'oliver.silva@clinicademo.cl',      'otra', 'activo', false)
  RETURNING id INTO v_m1;

  INSERT INTO public.doctors (nombre, apellido, rut, email, especialidad, estado, acceso_web_enabled)
  VALUES ('Moncerat', 'Rantul',     '22222222-2', 'moncerat.rantul@clinicademo.cl',   'otra', 'activo', false)
  RETURNING id INTO v_m2;

  INSERT INTO public.doctors (nombre, apellido, rut, email, especialidad, estado, acceso_web_enabled)
  VALUES ('Gabriela', 'Venegas',    '12345678-5', 'gabriela.venegas@clinicademo.cl',  'otra', 'activo', false)
  RETURNING id INTO v_m3;

  INSERT INTO public.doctors (nombre, apellido, rut, email, especialidad, estado, acceso_web_enabled)
  VALUES ('Carmen',   'Cantillano', '13456789-9', 'carmen.cantillano@clinicademo.cl', 'otra', 'activo', false)
  RETURNING id INTO v_m4;

  INSERT INTO public.doctors (nombre, apellido, rut, email, especialidad, estado, acceso_web_enabled)
  VALUES ('Javier',   'Argomedo',   '14567890-0', 'javier.argomedo@clinicademo.cl',   'otra', 'activo', false)
  RETURNING id INTO v_m5;

  -- ===== PACIENTES (3 por médico) =====
  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m1, 'Rodrigo',  'Fuentes',   '8765432-K') RETURNING id INTO v_p01;
  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m1, 'Ana María', 'Torres',    '9876543-3') RETURNING id INTO v_p02;
  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m1, 'Carlos',   'Muñoz',     '7654321-6') RETURNING id INTO v_p03;

  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m2, 'Valentina','Herrera',   '6543210-2') RETURNING id INTO v_p04;
  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m2, 'Luis',     'Contreras', '5432109-0') RETURNING id INTO v_p05;
  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m2, 'Patricia', 'Rojas',     '4321098-K') RETURNING id INTO v_p06;

  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m3, 'Diego',    'Morales',   '3210987-K') RETURNING id INTO v_p07;
  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m3, 'Sofía',    'Díaz',      '2109876-0') RETURNING id INTO v_p08;
  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m3, 'Andrés',   'Castro',    '1098765-2') RETURNING id INTO v_p09;

  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m4, 'Claudia',  'Pérez',     '9087654-6') RETURNING id INTO v_p10;
  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m4, 'Tomás',    'Rivera',    '8076543-6') RETURNING id INTO v_p11;
  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m4, 'Catalina', 'Lagos',     '7065432-6') RETURNING id INTO v_p12;

  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m5, 'Felipe',   'Molina',    '6054321-6') RETURNING id INTO v_p13;
  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m5, 'Isidora',  'Soto',      '5043210-6') RETURNING id INTO v_p14;
  INSERT INTO public.patients (doctor_id, nombre, apellido, rut) VALUES (v_m5, 'Matías',   'Vargas',    '4032109-8') RETURNING id INTO v_p15;

  -- Desactivar trigger de notificaciones (doctores demo no tienen cuenta de usuario)
  EXECUTE 'ALTER TABLE public.surgeries DISABLE TRIGGER trigger_notificar_cirugia_programada';

  -- ===== SOLICITUDES Y CIRUGÍAS =====

  -- Dr. Oliver Silva – 1 aceptada + 2 pendientes
  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m1, v_p01, 'EXT-TERCER', '09:00', '10:00',
    'Extracción tercer molar inferior derecho impactado. Requiere sedación leve. Rx panorámica adjunta.',
    'aceptada', '2026-05-20')
  RETURNING id INTO v_s01;

  INSERT INTO public.surgeries
    (surgery_request_id, doctor_id, patient_id, operating_room_id, fecha, hora_inicio, hora_fin, estado, estado_hora, observaciones)
  VALUES (v_s01, v_m1, v_p01, v_pab1, '2026-05-20', '09:00', '10:00', 'programada', 'agendado',
    'Extracción tercer molar inferior derecho impactado');

  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m1, v_p02, 'ENDO-UNI', '10:30', '12:00',
    'Endodoncia uniradicular pieza 16. Conducto calcificado, requiere microscopio quirúrgico.',
    'pendiente', '2026-05-22');

  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m1, v_p03, 'CIR-PERI', '15:00', '16:00',
    'Gingivectomía cuadrante superior derecho. Hiperplasia gingival. Paciente con hipertensión controlada.',
    'pendiente', '2026-05-28');

  -- Dra. Moncerat Rantul – 1 aceptada + 2 pendientes
  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m2, v_p04, 'IMPL-UNIT', '08:30', '10:30',
    'Implante unitario pieza 21. Injerto previo ya integrado. Torque esperado 35 Ncm. Sistema Nobel Active.',
    'aceptada', '2026-05-21')
  RETURNING id INTO v_s02;

  INSERT INTO public.surgeries
    (surgery_request_id, doctor_id, patient_id, operating_room_id, fecha, hora_inicio, hora_fin, estado, estado_hora, observaciones)
  VALUES (v_s02, v_m2, v_p04, v_pab4, '2026-05-21', '08:30', '10:30', 'programada', 'agendado',
    'Implante unitario pieza 21 – Nobel Active 3.5x11.5mm');

  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m2, v_p05, 'EXT-SIMPLE', '11:00', '11:30',
    'Extracción pieza 35 con fractura coronal extensa. Sin complicaciones previstas. Anestesia troncular.',
    'pendiente', '2026-05-23');

  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m2, v_p06, 'IMP-OSEO', '14:00', '16:00',
    'Injerto óseo sector anterior maxilar superior para futuro implante. Uso de membrana reabsorbible y Bio-Oss.',
    'pendiente', '2026-05-30');

  -- Dra. Gabriela Venegas – 1 aceptada + 2 pendientes
  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m3, v_p07, 'EXT-TERCER', '09:00', '10:30',
    'Extracción tercer molar superior izquierdo semi-impactado. Posición mesioangular grado II.',
    'aceptada', '2026-05-22')
  RETURNING id INTO v_s03;

  INSERT INTO public.surgeries
    (surgery_request_id, doctor_id, patient_id, operating_room_id, fecha, hora_inicio, hora_fin, estado, estado_hora, observaciones)
  VALUES (v_s03, v_m3, v_p07, v_pab1, '2026-05-22', '09:00', '10:30', 'programada', 'agendado',
    'Extracción tercer molar superior izquierdo semi-impactado');

  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m3, v_p08, 'FREN-LAB', '11:00', '11:45',
    'Frenectomía labial superior. Diastema 3mm entre piezas 11 y 21. Tratamiento post-ortodóntico.',
    'pendiente', '2026-05-27');

  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m3, v_p09, 'ENDO-BI', '13:00', '15:00',
    'Endodoncia birradicular pieza 36. Necrosis pulpar con lesión periapical. Conductos MB y DB afectados.',
    'pendiente', '2026-06-03');

  -- Dra. Carmen Cantillano – 1 aceptada + 2 pendientes
  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m4, v_p10, 'CIR-ORTO', '08:00', '12:00',
    'Cirugía ortognática bimaxilar (Le Fort I + BSSO). Ortodoncia presurgical completada. Coordinada con Dr. Pérez.',
    'aceptada', '2026-05-27')
  RETURNING id INTO v_s04;

  INSERT INTO public.surgeries
    (surgery_request_id, doctor_id, patient_id, operating_room_id, fecha, hora_inicio, hora_fin, estado, estado_hora, observaciones)
  VALUES (v_s04, v_m4, v_p10, v_pab2, '2026-05-27', '08:00', '12:00', 'programada', 'agendado',
    'Cirugía ortognática bimaxilar Le Fort I + BSSO');

  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m4, v_p11, 'IMPL-UNIT', '14:00', '15:30',
    'Implante pieza 46 en hueso tipo II. No requiere injerto previo. Carga diferida a 3 meses.',
    'pendiente', '2026-06-04');

  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m4, v_p12, 'EXT-TERCER', '10:00', '11:00',
    'Extracción tercer molar inferior izquierdo posición horizontal grado III. Alta complejidad quirúrgica.',
    'pendiente', '2026-06-10');

  -- Dr. Javier Argomedo – 1 aceptada + 2 pendientes
  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m5, v_p13, 'CIR-PERI', '09:30', '10:30',
    'Cirugía periodontal regenerativa pieza 26. Bolsa de 7mm con dehiscencia ósea. Uso de membrana + injerto.',
    'aceptada', '2026-05-28')
  RETURNING id INTO v_s05;

  INSERT INTO public.surgeries
    (surgery_request_id, doctor_id, patient_id, operating_room_id, fecha, hora_inicio, hora_fin, estado, estado_hora, observaciones)
  VALUES (v_s05, v_m5, v_p13, v_pab3, '2026-05-28', '09:30', '10:30', 'programada', 'agendado',
    'Cirugía periodontal regenerativa pieza 26');

  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m5, v_p14, 'ENDO-UNI', '11:00', '12:00',
    'Endodoncia urgente pieza 11. Trauma dentoalveolar reciente, luxación intrusiva. Ápex en desarrollo.',
    'pendiente', '2026-05-20');

  INSERT INTO public.surgery_requests
    (doctor_id, patient_id, codigo_operacion, hora_recomendada, hora_fin_recomendada, observaciones, estado, fecha_preferida)
  VALUES (v_m5, v_p15, 'EXT-SIMPLE', '13:30', '14:00',
    'Extracción pieza 75 resto radicular (molar temporal). Paciente 12 años. Espacio para erupción pieza 35.',
    'pendiente', '2026-05-22');

  -- Reactivar trigger
  EXECUTE 'ALTER TABLE public.surgeries ENABLE TRIGGER trigger_notificar_cirugia_programada';

  RAISE NOTICE 'Demo cargado correctamente: 4 pabellones, 10 insumos dentales, 5 medicos, 15 pacientes, 10 solicitudes pendientes, 5 aceptadas con cirugia programada.';
END $$;
