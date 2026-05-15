-- =====================================================================
-- PARTE 1 DE 6: TIPOS ENUM
-- Ejecutar primero. No depende de nada.
-- =====================================================================

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
