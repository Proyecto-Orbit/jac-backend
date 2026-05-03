-- =============================================================
-- SEED: Tabla CARGO
-- Cargos estándar de la junta directiva de una JAC en Colombia.
-- Ejecutar UNA sola vez antes de correr la migración de datos.
-- =============================================================

INSERT INTO public."CARGO" (nombre) VALUES
  ('Presidente'),
  ('Vicepresidente'),
  ('Tesorero'),
  ('Secretario'),
  ('Fiscal Principal'),
  ('Fiscal Suplente'),
  ('Comisión de Convivencia'),
  ('Delegado Asociación'),
  ('Comisión del Deporte'),
  ('Promotor')
ON CONFLICT DO NOTHING;
