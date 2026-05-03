"""
Migración de datos desde el Excel fuente hacia PostgreSQL.

Flujo:
  1. Carga semilla de ASOCOMUNALES.
  2. Migra JACs desde la sheet "JAC CAUCA".
  3. Migra JACs desde la sheet "JAC POPAYAN".
  4. Actualiza a estado 'cancelada' las JACs listadas en la sheet "CANCELADAS".
  5. Cada JAC queda relacionada con la asocomunal de su municipio,
     excepto en municipios con varias asocomunales (Argelia, Buenos Aires, Santa Rosa).

Requisitos:
    pip install psycopg2-binary pandas openpyxl python-dotenv

Pre-requisito en la BD:
    Ejecutar seed-cargo.sql (los CARGO ya deben existir).
"""

import os
import re
import json
import math
import unicodedata
import pandas as pd
import psycopg2
from dotenv import load_dotenv

# ── Sheets ────────────────────────────────────────────────────────────────────
SHEET_JAC_CAUCA   = 'JAC CAUCA'
SHEET_JAC_POPAYAN = 'JAC POPAYAN'
SHEET_CANCELADAS  = 'CANCELADAS'

# ── Índices de columnas: sheet "JAC CAUCA" (header en fila 4 del Excel) ──────
COLS_CAUCA = {
    'municipio':       1,
    'nombre_corto':    2,
    'estado':          4,
    'nombre_completo': 6,
    'ruc':             8,
    'cargo':           9,
    'nombre_pres':     10,
    'cedula':          11,
    'lugar_exp':       12,
    'telefono':        13,
    'correo':          14,
}

# ── Índices de columnas: sheet "JAC POPAYAN" (header en fila 2 del Excel) ────
COLS_POPAYAN = {
    'nombre_completo': 1,
    'estado':          2,
    'nombre_pres':     3,
    'telefono':        4,
    'telefono_alt':    5,
    'correo':          6,
}

# ── Índices de columnas: sheet "CANCELADAS" (header en fila 2 del Excel) ─────
COLS_CANCEL = {
    'flag':            1,   # "cancelada" / "no cancelada" / NaN
    'municipio':       2,
    'nombre_corto':    3,
    'nombre_completo': 7,
}

# ── Datos de los Municipios (ID auto-incremental desde 1) ────────────────────
MUNICIPIOS = [
    'Almaguer', 'Argelia', 'Balboa', 'Bolívar', 'Buenos Aires', 'Cajibío', 'Caldono',
    'Caloto', 'Corinto', 'El Tambo', 'Florencia', 'Guachené', 'Guapi', 'Inzá',
    'Jambaló', 'La Sierra', 'La Vega', 'López de Micay', 'Mercaderes', 'Miranda',
    'Morales', 'Padilla', 'Páez', 'Patía', 'Piamonte', 'Piendamó', 'Popayán',
    'Puerto Tejada', 'Puracé', 'Rosas', 'San Sebastián', 'Santa Rosa',
    'Santander de Quilichao', 'Silvia', 'Sotará', 'Suárez', 'Sucre', 'Timbío',
    'Timbiquí', 'Toribío', 'Totoró', 'Villa Rica',
]
POPAYAN_MUNICIPIO_ID = 27  # 'Popayán'

# Municipios con MÚLTIPLES asocomunales: no relacionar JACs con ninguna.
ASOCOMUNAL_EXCLUIDOS = {2, 5, 32}  # Argelia, Buenos Aires, Santa Rosa

# ── Datos de ASOCOMUNALES a insertar ─────────────────────────────────────────
ASOCOMUNALES_DATA = [
    { "nombre": 'Asocomunal Almaguer', "municipioId": 1, "estado": True },
    { "nombre": 'Asocomunal Argelia Cabecera', "municipioId": 2, "estado": True },
    { "nombre": 'Asocomunal Cgtos. El Plateado la Emboscada y S.', "municipioId": 2, "estado": True },
    { "nombre": 'Asocomunal Balboa', "municipioId": 3, "estado": True },
    { "nombre": 'Asocomunal Bolivar', "municipioId": 4, "estado": True },
    { "nombre": 'Asocomunal Buenos Aires', "municipioId": 5, "estado": True },
    { "nombre": 'Asocomunal Alto Naya', "municipioId": 5, "estado": True },
    { "nombre": 'Asocomunal Cajibio', "municipioId": 6, "estado": True },
    { "nombre": 'Asocomunal Caldono', "municipioId": 7, "estado": True },
    { "nombre": 'Asocomunal Caloto', "municipioId": 8, "estado": True },
    { "nombre": 'Asocomunal Corinto', "municipioId": 9, "estado": True },
    { "nombre": 'Asocomunal El Tambo', "municipioId": 10, "estado": True },
    { "nombre": 'Asocomunal Florencia', "municipioId": 11, "estado": False },
    { "nombre": 'Asocomunal Guachene', "municipioId": 12, "estado": True },
    { "nombre": 'Asocomunal Guapi', "municipioId": 13, "estado": True },
    { "nombre": 'Asocomunal Inza', "municipioId": 14, "estado": True },
    { "nombre": 'Asocomunal Jambalo', "municipioId": 15, "estado": True },
    { "nombre": 'Asocomunal La Sierra', "municipioId": 16, "estado": True },
    { "nombre": 'Asocomunal La Vega', "municipioId": 17, "estado": True },
    { "nombre": 'Asocomunal López de Micay', "municipioId": 18, "estado": False },
    { "nombre": 'Asocomunal Mercaderes', "municipioId": 19, "estado": True },
    { "nombre": 'Asocomunal Miranda', "municipioId": 20, "estado": True },
    { "nombre": 'Asocomunal Morales', "municipioId": 21, "estado": True },
    { "nombre": 'Asocomunal Padilla', "municipioId": 22, "estado": False },
    { "nombre": 'Asocomunal Paez', "municipioId": 23, "estado": True },
    { "nombre": 'Asocomunal Patia', "municipioId": 24, "estado": True },
    { "nombre": 'Asocomunal Piamonte', "municipioId": 25, "estado": True },
    { "nombre": 'Asocomunal Piendamo', "municipioId": 26, "estado": True },
    { "nombre": 'Asocomunal Popayan', "municipioId": 27, "estado": True },
    { "nombre": 'Asocomunal Puerto Tejada', "municipioId": 28, "estado": True },
    { "nombre": 'Asocomunal Purace', "municipioId": 29, "estado": True },
    { "nombre": 'Asocomunal Rosas', "municipioId": 30, "estado": True },
    { "nombre": 'Asocomunal San Sebastian', "municipioId": 31, "estado": True },
    { "nombre": 'Asocomunal Santa Rosa Cabecera', "municipioId": 32, "estado": True },
    { "nombre": 'Asocomunal Santa Rosa Media Bota', "municipioId": 32, "estado": True },
    { "nombre": 'Asocomunal Santa Rosa Villalobos', "municipioId": 32, "estado": True },
    { "nombre": 'Asocomunal Santander de Quilichao', "municipioId": 33, "estado": True },
    { "nombre": 'Asocomunal Silvia', "municipioId": 34, "estado": True },
    { "nombre": 'Asocomunal Sotara', "municipioId": 35, "estado": True },
    { "nombre": 'Asocomunal Suarez', "municipioId": 36, "estado": True },
    { "nombre": 'Asocomunal Sucre', "municipioId": 37, "estado": True },
    { "nombre": 'Asocomunal Timbio', "municipioId": 38, "estado": True },
    { "nombre": 'Asocomunal Timbiqui', "municipioId": 39, "estado": False },
    { "nombre": 'Asocomunal Toribio', "municipioId": 40, "estado": True },
    { "nombre": 'Asocomunal Totoro', "municipioId": 41, "estado": True },
    { "nombre": 'Asocomunal Villa Rica', "municipioId": 42, "estado": True },
]

# ── Helpers ──────────────────────────────────────────────────────────────────
def es_nan(valor) -> bool:
    if valor is None:
        return True
    if isinstance(valor, float) and math.isnan(valor):
        return True
    return False

def limpiar(valor, max_len: int | None = None) -> str | None:
    if es_nan(valor):
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    if max_len:
        texto = texto[:max_len]
    return texto

def normalizar(texto: str | None) -> str:
    """Mayúsculas, sin acentos, espacios colapsados. Para comparar nombres."""
    if not texto:
        return ''
    texto = unicodedata.normalize('NFD', str(texto))
    texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', texto).strip().upper()

def mapear_estado(valor_raw) -> str:
    if es_nan(valor_raw):
        return 'activa'
    valor = normalizar(valor_raw)
    if valor == 'ACTIVA':
        return 'activa'
    if valor == 'CANCELADA':
        return 'cancelada'
    return 'inactiva'

def es_ruc_valido(valor) -> bool:
    if es_nan(valor):
        return False
    texto = str(valor).strip()
    return bool(re.match(r'^[\d-]+$', texto))

def parsear_nombre(nombre_completo: str) -> tuple[str, str]:
    partes = nombre_completo.strip().split()
    n = len(partes)
    if n == 0: return ('', '')
    if n == 1: return (partes[0], '')
    if n == 2: return (partes[0], partes[1])
    if n == 3: return (partes[0], ' '.join(partes[1:]))
    return (' '.join(partes[:2]), ' '.join(partes[2:]))

def num_a_str(valor) -> str | None:
    """Convierte un valor (a veces float por pandas) a string sin '.0'."""
    if es_nan(valor):
        return None
    if isinstance(valor, float):
        return str(int(valor)) if not math.isnan(valor) else None
    return str(valor)

def quitar_marcador_cancelada(texto: str) -> str:
    """Remueve sufijos del tipo '(CANCELADA)', '- CANCELADA', 'CANCELADAS'."""
    if not texto:
        return ''
    t = texto
    t = re.sub(r'\s*[\(\-]\s*CANCELADAS?\s*\)?\s*$', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s+CANCELADAS?\s*$', '', t, flags=re.IGNORECASE)
    return t.strip()

def construir_lookup_municipios() -> dict[str, int]:
    return {normalizar(n): i + 1 for i, n in enumerate(MUNICIPIOS)}

def construir_mapa_asocomunal(asocomunales: list[dict]) -> dict[int, int]:
    """municipio_id → asocomunal_id, sólo cuando hay UNA asocomunal por municipio
    y el municipio NO está en la lista de exclusión."""
    conteos: dict[int, int] = {}
    for a in asocomunales:
        conteos[a['municipioId']] = conteos.get(a['municipioId'], 0) + 1
    mapa: dict[int, int] = {}
    for i, a in enumerate(asocomunales):
        mid = a['municipioId']
        if mid in ASOCOMUNAL_EXCLUIDOS:
            continue
        if conteos[mid] != 1:
            continue
        mapa[mid] = i + 1
    return mapa

# ── Operaciones de BD ────────────────────────────────────────────────────────
def insertar_asocomunales(cursor, conn) -> int:
    print('⏳ Migrando Asocomunales...')
    insertadas = 0
    for i, asoc in enumerate(ASOCOMUNALES_DATA):
        asoc_id = i + 1  # PK manual (no auto)
        municipio_id = asoc['municipioId']
        municipio_nombre = MUNICIPIOS[municipio_id - 1] if 1 <= municipio_id <= len(MUNICIPIOS) else None
        try:
            cursor.execute(
                """
                INSERT INTO public."ASOCOMUNAL"
                    (id, nombre, municipio_id, municipio_nombre, estado)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (asoc_id, asoc['nombre'], municipio_id, municipio_nombre, asoc['estado']),
            )
            insertadas += cursor.rowcount
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"❌ Error insertando Asocomunal '{asoc['nombre']}': {e}")
    print(f'✅ Asocomunales insertadas: {insertadas}')
    return insertadas

def obtener_cargo_presidente_id(cursor) -> int | None:
    cursor.execute('SELECT id FROM public."CARGO" WHERE nombre = %s', ('Presidente',))
    fila = cursor.fetchone()
    return fila[0] if fila else None

def insertar_persona_presidente(cursor, jac_id: int, cargo_pres_id: int,
                                municipio_id: int | None,
                                nombre_pres_raw: str,
                                cedula: str | None = None,
                                lugar_exp: str | None = None,
                                telefono: str | None = None,
                                correo: str | None = None) -> int:
    nombre, apellido = parsear_nombre(nombre_pres_raw)
    cursor.execute(
        """
        INSERT INTO public."PERSONA"
            ("JAC_id", cargo_id, municipio_id, nombre, apellido,
             cedula, lugar_expedicion_cedula, telefono, correo)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (jac_id, cargo_pres_id, municipio_id,
         nombre[:100], (apellido[:100] if apellido else ''),
         cedula, lugar_exp, telefono, correo),
    )
    persona_id = cursor.fetchone()[0]

    cursor.execute(
        'INSERT INTO public."PERSONA_JAC" (jac_id, persona_id) VALUES (%s, %s)',
        (jac_id, persona_id),
    )
    cursor.execute(
        """
        INSERT INTO public."PERSONA_CARGO" (persona_id, cargo_id, estado_id)
        VALUES (%s, %s, 1)
        """,
        (persona_id, cargo_pres_id),
    )
    return persona_id

def migrar_sheet_jac_cauca(cursor, conn, df, asoc_map, municipio_lookup, cargo_pres_id):
    print(f'\n⏳ Migrando sheet "{SHEET_JAC_CAUCA}" ({len(df)} filas)...')
    total_jac, total_persona = 0, 0
    errores = []
    for index, row in df.iterrows():
        try:
            nombre_corto    = limpiar(row.iloc[COLS_CAUCA['nombre_corto']],    100)
            nombre_completo = limpiar(row.iloc[COLS_CAUCA['nombre_completo']], 100)
            if not nombre_corto and not nombre_completo:
                continue
            if not nombre_completo:
                nombre_completo = nombre_corto
            if not nombre_corto:
                nombre_corto = None

            estado = mapear_estado(row.iloc[COLS_CAUCA['estado']])

            municipio_nombre = limpiar(row.iloc[COLS_CAUCA['municipio']])
            municipio_id     = municipio_lookup.get(normalizar(municipio_nombre)) if municipio_nombre else None
            asocomunal_id    = asoc_map.get(municipio_id) if municipio_id else None

            ruc_raw = row.iloc[COLS_CAUCA['ruc']]
            numero_ruc = limpiar(ruc_raw, 30) if es_ruc_valido(ruc_raw) else None

            cursor.execute(
                """
                INSERT INTO public."JAC"
                    (asocomunal_id, estado, nombre_corto, nombre_completo, numero_ruc)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (asocomunal_id, estado, nombre_corto, nombre_completo, numero_ruc),
            )
            jac_id = cursor.fetchone()[0]
            total_jac += 1

            nombre_pres_raw = limpiar(row.iloc[COLS_CAUCA['nombre_pres']])
            if nombre_pres_raw:
                cedula    = limpiar(num_a_str(row.iloc[COLS_CAUCA['cedula']]),    20)
                telefono  = limpiar(num_a_str(row.iloc[COLS_CAUCA['telefono']]), 20)
                lugar_exp = limpiar(row.iloc[COLS_CAUCA['lugar_exp']], 50)
                correo    = limpiar(row.iloc[COLS_CAUCA['correo']],   150)

                insertar_persona_presidente(
                    cursor, jac_id, cargo_pres_id, municipio_id,
                    nombre_pres_raw, cedula, lugar_exp, telefono, correo,
                )
                total_persona += 1

            conn.commit()
        except Exception as e:
            conn.rollback()
            errores.append({
                'sheet': SHEET_JAC_CAUCA,
                'fila_excel': int(index) + 5,  # header en fila 4 (1-based)
                'error': str(e),
            })
    print(f'✅ {SHEET_JAC_CAUCA}: JACs={total_jac}, presidentes={total_persona}')
    return total_jac, total_persona, errores

def migrar_sheet_jac_popayan(cursor, conn, df, asoc_map, cargo_pres_id):
    print(f'\n⏳ Migrando sheet "{SHEET_JAC_POPAYAN}" ({len(df)} filas)...')
    municipio_id  = POPAYAN_MUNICIPIO_ID
    asocomunal_id = asoc_map.get(municipio_id)
    total_jac, total_persona = 0, 0
    errores = []
    for index, row in df.iterrows():
        try:
            nombre_completo = limpiar(row.iloc[COLS_POPAYAN['nombre_completo']], 100)
            if not nombre_completo:
                continue
            estado = mapear_estado(row.iloc[COLS_POPAYAN['estado']])

            cursor.execute(
                """
                INSERT INTO public."JAC"
                    (asocomunal_id, estado, nombre_corto, nombre_completo, numero_ruc)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (asocomunal_id, estado, None, nombre_completo, None),
            )
            jac_id = cursor.fetchone()[0]
            total_jac += 1

            nombre_pres_raw = limpiar(row.iloc[COLS_POPAYAN['nombre_pres']])
            if nombre_pres_raw:
                tel_raw = row.iloc[COLS_POPAYAN['telefono']]
                if es_nan(tel_raw):
                    tel_raw = row.iloc[COLS_POPAYAN['telefono_alt']]
                telefono = limpiar(num_a_str(tel_raw), 20)
                correo   = limpiar(row.iloc[COLS_POPAYAN['correo']], 150)

                insertar_persona_presidente(
                    cursor, jac_id, cargo_pres_id, municipio_id,
                    nombre_pres_raw, None, None, telefono, correo,
                )
                total_persona += 1

            conn.commit()
        except Exception as e:
            conn.rollback()
            errores.append({
                'sheet': SHEET_JAC_POPAYAN,
                'fila_excel': int(index) + 3,  # header en fila 2 (1-based)
                'error': str(e),
            })
    print(f'✅ {SHEET_JAC_POPAYAN}: JACs={total_jac}, presidentes={total_persona}')
    return total_jac, total_persona, errores

def actualizar_canceladas(cursor, conn, df, asoc_map, municipio_lookup):
    print(f'\n⏳ Procesando sheet "{SHEET_CANCELADAS}" ({len(df)} filas)...')
    actualizadas = 0
    insertadas   = 0
    omitidas     = 0
    errores      = []
    for index, row in df.iterrows():
        try:
            flag = limpiar(row.iloc[COLS_CANCEL['flag']])
            # Sólo procesar las marcadas explícitamente como 'cancelada'
            if not flag or normalizar(flag) != 'CANCELADA':
                omitidas += 1
                continue

            municipio_nombre = limpiar(row.iloc[COLS_CANCEL['municipio']])
            nombre_corto_raw = limpiar(row.iloc[COLS_CANCEL['nombre_corto']])
            nombre_completo  = limpiar(row.iloc[COLS_CANCEL['nombre_completo']], 100)
            if not nombre_corto_raw and not nombre_completo:
                continue

            nombre_corto = quitar_marcador_cancelada(nombre_corto_raw or '')[:100] or None
            municipio_id = municipio_lookup.get(normalizar(municipio_nombre)) if municipio_nombre else None
            asoc_id      = asoc_map.get(municipio_id) if municipio_id else None

            # Intentar UPDATE por nombre_corto (case-insensitive, sin acentos)
            updated = 0
            if nombre_corto:
                cursor.execute(
                    """
                    UPDATE public."JAC"
                       SET estado = 'cancelada'
                     WHERE UPPER(TRIM(nombre_corto)) = UPPER(TRIM(%s))
                    """,
                    (nombre_corto,),
                )
                updated = cursor.rowcount

            if updated > 0:
                actualizadas += updated
            else:
                # No existe → insertar como nueva con estado 'cancelada'
                nc_final = nombre_completo or nombre_corto or 'JAC CANCELADA'
                cursor.execute(
                    """
                    INSERT INTO public."JAC"
                        (asocomunal_id, estado, nombre_corto, nombre_completo, numero_ruc)
                    VALUES (%s, 'cancelada', %s, %s, NULL)
                    """,
                    (asoc_id, nombre_corto, nc_final[:100]),
                )
                insertadas += 1

            conn.commit()
        except Exception as e:
            conn.rollback()
            errores.append({
                'sheet': SHEET_CANCELADAS,
                'fila_excel': int(index) + 3,
                'error': str(e),
            })
    print(f'✅ {SHEET_CANCELADAS}: actualizadas={actualizadas}, '
          f'insertadas={insertadas}, omitidas={omitidas}')
    return actualizadas, insertadas, errores

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    load_dotenv()
    DB_HOST     = os.getenv('DB_HOST', 'localhost')
    DB_PORT     = os.getenv('DB_PORT', '5432')
    DB_NAME     = os.getenv('DB_NAME', 'jac_cauca_db')
    DB_USER     = os.getenv('DB_USER')
    DB_PASSWORD = os.getenv('DB_PASSWORD')

    if not DB_USER or not DB_PASSWORD:
        print('❌ Faltan credenciales en .env (DB_USER o DB_PASSWORD)')
        return

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

    # 1. Cargo Presidente (debe existir vía seed-cargo.sql)
    cargo_pres_id = obtener_cargo_presidente_id(cursor)
    if not cargo_pres_id:
        print('❌ No se encontró el cargo "Presidente". Corre seed-cargo.sql primero.')
        cursor.close(); conn.close()
        return

    # 2. ASOCOMUNALES
    insertar_asocomunales(cursor, conn)

    asoc_map         = construir_mapa_asocomunal(ASOCOMUNALES_DATA)
    municipio_lookup = construir_lookup_municipios()

    archivo = './statics/datos.xlsx'
    if not os.path.exists(archivo):
        print(f'⚠️ Archivo {archivo} no encontrado. Finalizando.')
        cursor.close(); conn.close()
        return

    print(f'\n⏳ Leyendo {archivo}...')
    df_cauca   = pd.read_excel(archivo, sheet_name=SHEET_JAC_CAUCA,   header=3)
    df_popayan = pd.read_excel(archivo, sheet_name=SHEET_JAC_POPAYAN, header=1)
    df_cancel  = pd.read_excel(archivo, sheet_name=SHEET_CANCELADAS,  header=1)

    todos_errores: list[dict] = []

    # 3. JAC CAUCA
    _, _, e1 = migrar_sheet_jac_cauca(cursor, conn, df_cauca, asoc_map, municipio_lookup, cargo_pres_id)
    todos_errores.extend(e1)

    # 4. JAC POPAYAN
    _, _, e2 = migrar_sheet_jac_popayan(cursor, conn, df_popayan, asoc_map, cargo_pres_id)
    todos_errores.extend(e2)

    # 5. CANCELADAS
    _, _, e3 = actualizar_canceladas(cursor, conn, df_cancel, asoc_map, municipio_lookup)
    todos_errores.extend(e3)

    if todos_errores:
        reporte = 'errores_importacion.json'
        with open(reporte, 'w', encoding='utf-8') as f:
            json.dump(todos_errores, f, ensure_ascii=False, indent=4)
        print(f'\n⚠️  {len(todos_errores)} filas con error → ver {reporte}')
    else:
        print('\n✅ Sin errores en la importación global.')

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
