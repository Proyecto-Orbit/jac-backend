-- Active: @5432@jac_cauca_db
-- =============================================================
-- DELETE: Eliminación de fila mal cargada en la tabla JAC en la migracion de datos.
-- =============================================================
-- Una fila quedo cargada la cual esta totalmente vacia y tiene como nombre el numero de fila, lo cual es un error. Se elimina esta fila para evitar confusiones.
-- Ejecutar UNA sola vez DESPUES de correr la migración de datos.
-- =============================================================
DELETE FROM public."JAC" WHERE nombre_completo='385';
DELETE FROM public."JAC" WHERE nombre_completo='111';
DELETE FROM public."JAC" WHERE nombre_completo='245';
DELETE FROM public."JAC" WHERE nombre_completo='29';