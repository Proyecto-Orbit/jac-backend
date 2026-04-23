"""
Migración de datos desde el Excel fuente hacia PostgreSQL.

Tablas destino
--------------
- JAC          → nombre_corto, nombre_completo, estado, numero_RUC
- PERSONA      → datos del presidente de cada JAC
- PERSONA_JAC  → vincula al presidente con su JAC
- PERSONA_CARGO→ asigna al presidente el cargo correspondiente

Estructura del Excel (./statics/datos.xlsx)
-------------------------------------------
Las primeras 3 filas son cabeceras agrupadas; la fila 4 (index 3)
contiene los nombres de columna reales → se usa header=3.

Columnas relevantes (índice 0-based):
  1  → MUNICIPIO
  2  → NOMBRE CORTO DE LA JUNTA DE ACCIÓN COMUNAL
  5  → ACTIVA  ('ACTIVA' | 'INACTIVA' | 'INACTIVA ')
  10 → NOMBRE COMPLETO JUNTA DE ACCIÓN COMUNAL
  12 → CARGO  (en el Excel siempre 'PRESIDENTE (A)')
  13 → NOMBRE DE PRESIDENTE 2022-2026
  14 → Nº DE IDENTIFICACIÓN
  15 → LUGAR DE EXPEDICIÓN
  17 → Nº TELEFONICO
  18 → CORREO ELECTRONICO
  24 → Nº RUC  (puede tener valores como 'NO PRESENTA' — se descartan)

Uso
---
  python migracion.py

Requisitos
----------
  pip install psycopg2-binary pandas openpyxl python-dotenv
  (o usar el entorno virtual: migracino_env)
"""

import os
import re
import json
import math

import pandas as pd
import psycopg2
from dotenv import load_dotenv

# ─── Índices de columnas en el Excel ─────────────────────────────────────────
COL_MUNICIPIO        = 1
COL_NOMBRE_CORTO     = 2
COL_ACTIVA           = 5
COL_NOMBRE_COMPLETO  = 10
COL_CARGO_EXCEL      = 12
COL_NOMBRE_PRES      = 13
COL_CEDULA           = 14
COL_LUGAR_EXP        = 15
COL_TELEFONO         = 17
COL_CORREO           = 18
COL_RUC              = 24

# ─── Helpers ─────────────────────────────────────────────────────────────────

def es_nan(valor) -> bool:
    """Retorna True si el valor es NaN o None."""
    if valor is None:
        return True
    if isinstance(valor, float) and math.isnan(valor):
        return True
    return False


def limpiar(valor, max_len: int | None = None) -> str | None:
    """
    Convierte un valor a cadena limpia (sin espacios extremos).
    Retorna None si el valor está vacío o es NaN.
    """
    if es_nan(valor):
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    if max_len:
        texto = texto[:max_len]
    return texto


def mapear_estado(activa_raw) -> str:
    """
    Mapea el valor de la columna ACTIVA del Excel al enum de la BD.

    - 'ACTIVA'   → 'activa'
    - 'INACTIVA' → 'inactiva'
    - cualquier otro → 'inactiva' (conservador)
    """
    if es_nan(activa_raw):
        return 'activa'
    valor = str(activa_raw).strip().upper()
    if valor == 'ACTIVA':
        return 'activa'
    return 'inactiva'


def es_ruc_valido(valor) -> bool:
    """
    Valida que el valor parezca un RUC real (contiene dígitos y guiones).
    Descarta textos como 'NO PRESENTA', 'FALTA CONFIRMACIÓN', etc.
    """
    if es_nan(valor):
        return False
    texto = str(valor).strip()
    return bool(re.match(r'^[\d\-]+$', texto))


def parsear_nombre(nombre_completo: str) -> tuple[str, str]:
    """
    Divide un nombre completo en (nombre, apellido).

    Heurística para nombres colombianos:
      - 4+ palabras → primeras 2 = nombre, últimas 2 = apellido
      - 3 palabras  → primera = nombre, últimas 2 = apellido
      - 2 palabras  → primera = nombre, segunda = apellido
      - 1 palabra   → nombre = palabra, apellido = ''
    """
    partes = nombre_completo.strip().split()
    n = len(partes)
    if n == 0:
        return ('', '')
    if n == 1:
        return (partes[0], '')
    if n == 2:
        return (partes[0], partes[1])
    if n == 3:
        return (partes[0], ' '.join(partes[1:]))
    # 4 o más palabras
    return (' '.join(partes[:2]), ' '.join(partes[2:]))


def col(row, indice):
    """Accede a una celda por índice de columna."""
    return row.iloc[indice]


# ─── Main ────────────────────────────────────────────────────────────────────

def main():

    # ── 1. Variables de entorno ───────────────────────────────────────────────
    load_dotenv()
    DB_HOST     = os.getenv('DB_HOST', 'localhost')
    DB_PORT     = os.getenv('DB_PORT', '5432')
    DB_NAME     = os.getenv('DB_NAME', 'jac_cauca_db')
    DB_USER     = os.getenv('DB_USER')
    DB_PASSWORD = os.getenv('DB_PASSWORD')

    if not DB_USER or not DB_PASSWORD:
        print('❌ Faltan credenciales en .env (DB_USER o DB_PASSWORD)')
        return

    # ── 2. Conexión a la base de datos ────────────────────────────────────────
    try:
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT,
            dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
        )
        cursor = conn.cursor()
        print('✅ Conexión a la base de datos exitosa.')
    except Exception as e:
        print(f'❌ Error al conectar a PostgreSQL: {e}')
        return

    # ── 3. Asegurar cargos base (idempotente) ─────────────────────────────────
    cargos_base = [
        'Presidente', 'Vicepresidente', 'Tesorero', 'Secretario',
        'Fiscal Principal', 'Fiscal Suplente', 'Comisión de Convivencia',
        'Delegado Asociación', 'Comisión del Deporte', 'Promotor',
    ]
    for cargo_nombre in cargos_base:
        cursor.execute(
            'INSERT INTO public."CARGO" (nombre) VALUES (%s) ON CONFLICT DO NOTHING',
            (cargo_nombre,),
        )
    conn.commit()
    print('✅ Cargos base verificados/insertados.')

    # Obtener el id del cargo 'Presidente' para usarlo en cada fila
    cursor.execute('SELECT id FROM public."CARGO" WHERE nombre = %s', ('Presidente',))
    fila_cargo = cursor.fetchone()
    if not fila_cargo:
        print('❌ No se encontró el cargo "Presidente". Abortando.')
        cursor.close(); conn.close()
        return
    cargo_presidente_id: int = fila_cargo[0]
    print(f'ℹ️  cargo_id de Presidente = {cargo_presidente_id}')

    # ── 4. Cargar el Excel ────────────────────────────────────────────────────
    archivo = './statics/datos.xlsx'
    print(f'⏳ Leyendo {archivo}...')
    df = pd.read_excel(archivo, header=3)   # La fila 4 del Excel tiene los nombres de columna
    print(f'ℹ️  Total filas encontradas: {len(df)}')

    # ── 5. Migración fila a fila ──────────────────────────────────────────────
    total_jac     = 0
    total_persona = 0
    errores       = []

    for index, row in df.iterrows():
        try:

            # ── 5.1 Datos de la JAC ───────────────────────────────────────────
            nombre_corto    = limpiar(col(row, COL_NOMBRE_CORTO),    max_len=100)
            nombre_completo = limpiar(col(row, COL_NOMBRE_COMPLETO), max_len=100)

            # Si no hay ningún nombre, la fila está vacía → saltar
            if not nombre_corto and not nombre_completo:
                continue

            # Fallback: si falta uno de los dos, usar el que existe
            if not nombre_completo:
                nombre_completo = nombre_corto
            if not nombre_corto:
                nombre_corto = None   # permitido en BD (nullable)

            estado  = mapear_estado(col(row, COL_ACTIVA))
            ruc_raw = col(row, COL_RUC)
            numero_ruc = limpiar(ruc_raw, max_len=30) if es_ruc_valido(ruc_raw) else None

            # ── 5.2 Insertar JAC ──────────────────────────────────────────────
            cursor.execute(
                """
                INSERT INTO public."JAC"
                    (estado, nombre_corto, nombre_completo, numero_RUC)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (estado, nombre_corto, nombre_completo, numero_ruc),
            )
            jac_id: int = cursor.fetchone()[0]
            total_jac += 1

            # ── 5.3 Datos del presidente ──────────────────────────────────────
            nombre_pres_raw = limpiar(col(row, COL_NOMBRE_PRES))

            if nombre_pres_raw:
                nombre, apellido = parsear_nombre(nombre_pres_raw)

                cedula_raw = col(row, COL_CEDULA)
                cedula = limpiar(str(int(cedula_raw)) if isinstance(cedula_raw, float) and not math.isnan(cedula_raw) else cedula_raw, max_len=20)

                telefono_raw = col(row, COL_TELEFONO)
                telefono = limpiar(str(int(telefono_raw)) if isinstance(telefono_raw, float) and not math.isnan(telefono_raw) else telefono_raw, max_len=20)

                lugar_exp = limpiar(col(row, COL_LUGAR_EXP),  max_len=50)
                correo    = limpiar(col(row, COL_CORREO),      max_len=100)

                # Insertar persona
                cursor.execute(
                    """
                    INSERT INTO public."PERSONA"
                        ("JAC_id", cargo_id, nombre, apellido,
                         cedula, lugar_expedicion_cedula, telefono, correo)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (jac_id, cargo_presidente_id,
                     nombre[:100], apellido[:100] if apellido else '',
                     cedula, lugar_exp, telefono, correo),
                )
                persona_id: int = cursor.fetchone()[0]

                # Vincular persona ↔ JAC
                cursor.execute(
                    'INSERT INTO public."PERSONA_JAC" (jac_id, persona_id) VALUES (%s, %s)',
                    (jac_id, persona_id),
                )

                # Registrar cargo histórico
                cursor.execute(
                    """
                    INSERT INTO public."PERSONA_CARGO"
                        (persona_id, cargo_id, estado_id)
                    VALUES (%s, %s, 1)
                    """,
                    (persona_id, cargo_presidente_id),
                )
                total_persona += 1

            conn.commit()

        except Exception as e:
            conn.rollback()
            fila_dict = {}
            for c in [COL_NOMBRE_CORTO, COL_NOMBRE_COMPLETO, COL_ACTIVA,
                       COL_NOMBRE_PRES, COL_CEDULA]:
                val = row.iloc[c]
                if not es_nan(val):
                    fila_dict[str(c)] = str(val)

            errores.append({
                'fila_excel': int(index) + 5,   # +5 porque header=3 + 1 de offset
                'error': str(e),
                'datos_fila': fila_dict,
            })

    # ── 6. Reporte final ──────────────────────────────────────────────────────
    print(f'\n✅ JACs insertadas:      {total_jac}')
    print(f'✅ Presidentes migrados: {total_persona}')

    if errores:
        reporte = 'errores_importacion.json'
        with open(reporte, 'w', encoding='utf-8') as f:
            json.dump(errores, f, ensure_ascii=False, indent=4)
        print(f'⚠️  {len(errores)} filas con error → ver {reporte}')
    else:
        print('✅ Sin errores en la importación.')

    cursor.close()
    conn.close()


if __name__ == '__main__':
    main()
