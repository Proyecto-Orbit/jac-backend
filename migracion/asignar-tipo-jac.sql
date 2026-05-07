-- Active: @5432@jac_cauca_db
-- =============================================================
-- ASIGNACIÓN DE TIPO (BARRIO/VEREDA) A LAS JACs MIGRADAS
-- =============================================================
-- El Excel de migración no incluye el tipo de territorio que cubre cada JAC,
-- por lo que se asume "barrio" para todas las filas migradas. Las JACs
-- rurales deberán reasignarse manualmente caso por caso (UPDATE puntual)
-- o vía la interfaz administrativa.
--
-- Marco legal: Ley 2166 de 2021, Art. 11. El tipo determina el mínimo de
-- afiliados activos necesarios para que la JAC se mantenga vigente:
--   - barrio (urbano):  38 afiliados
--   - vereda (rural):   10 afiliados
--
-- Ejecutar UNA sola vez DESPUÉS de la migración inicial. En entornos con
-- TypeORM `synchronize: true` (development) la columna y el enum ya existen,
-- por lo que solo el UPDATE final es estrictamente necesario.
-- =============================================================

-- 1) Crear el tipo enum si aún no existe (entornos sin synchronize).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JAC_tipo_enum') THEN
        CREATE TYPE "JAC_tipo_enum" AS ENUM ('barrio', 'vereda');
    END IF;
END $$;

-- 2) Agregar la columna si aún no existe (entornos sin synchronize).
ALTER TABLE public."JAC"
    ADD COLUMN IF NOT EXISTS tipo "JAC_tipo_enum" NOT NULL DEFAULT 'barrio';

-- 3) Asegurar que toda JAC migrada tenga el tipo asignado.
UPDATE public."JAC" SET tipo = 'barrio' WHERE tipo IS NULL;
