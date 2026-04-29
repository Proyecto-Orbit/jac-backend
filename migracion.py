"""
Migración de datos desde el Excel fuente hacia PostgreSQL,
incluyendo la carga semilla de ASOCOMUNALES y MUNICIPIOS.

Requisitos:
pip install psycopg2-binary pandas openpyxl python-dotenv
"""

import os
import re
import json
import math
import pandas as pd
import psycopg2
from dotenv import load_dotenv

# ── Índices de columnas en el Excel ─────────────────────────────────────────
COL_MUNICIPIO       = 1
COL_NOMBRE_CORTO    = 2
COL_ACTIVA          = 5
COL_NOMBRE_COMPLETO = 10
COL_CARGO_EXCEL     = 12
COL_NOMBRE_PRES     = 13
COL_CEDULA          = 14
COL_LUGAR_EXP       = 15
COL_TELEFONO        = 17
COL_CORREO          = 18
COL_RUC             = 24

# ── Datos de los Municipios (Auto incremental ID desde 1) ─────────────────
MUNICIPIOS =[
    'Almaguer', 'Argelia', 'Balboa', 'Bolívar', 'Buenos Aires', 'Cajibío', 'Caldono', 
    'Caloto', 'Corinto', 'El Tambo', 'Florencia', 'Guachené', 'Guapi', 'Inzá', 
    'Jambaló', 'La Sierra', 'La Vega', 'López de Micay', 'Mercaderes', 'Miranda', 
    'Morales', 'Padilla', 'Páez', 'Patía', 'Piamonte', 'Piendamó', 'Popayán', 
    'Puerto Tejada', 'Puracé', 'Rosas', 'San Sebastián', 'Santa Rosa', 
    'Santander de Quilichao', 'Silvia', 'Sotará', 'Suárez', 'Sucre', 'Timbío', 
    'Timbiquí', 'Toribío', 'Totoró', 'Villa Rica'
]

def obtener_nombre_municipio(municipio_id: int) -> str | None:
    if not municipio_id or municipio_id < 1 or municipio_id > len(MUNICIPIOS):
        return None
    return MUNICIPIOS[municipio_id - 1]

# ── Datos de ASOCOMUNALES a insertar ──────────────────────────────────────
# Nota: Los campos de presidente, teléfono y correo se dejan en el diccionario 
#       por si deseas cruzarlos con la tabla PERSONA, pero no se insertan en 
#       la tabla ASOCOMUNAL según tu definición estricta.
ASOCOMUNALES_DATA =[
    { "nombre": 'Asocomunal Almaguer', "municipioId": 1, "estado": True, "presidente": 'Carlos Hoyos Ruano', "telefono": '3208932387', "correo": 'asociacioncomunalalmaguer@gmail.com' },
    { "nombre": 'Asocomunal Argelia Cabecera', "municipioId": 2, "estado": True, "presidente": 'Eyder Muñoz Rosero', "telefono": '3117115155', "correo": 'asocomunalargelia74@gmail.com' },
    { "nombre": 'Asocomunal Cgtos. El Plateado la Emboscada y S.', "municipioId": 2, "estado": True, "presidente": 'Eliver Arboleda Bermudez', "telefono": '3187421622', "correo": 'promotoriargeliacauca@gmail.com;promotoriadejuntas@argelia-cauca.gov.co' },
    { "nombre": 'Asocomunal Balboa', "municipioId": 3, "estado": True, "presidente": 'Andres Felipe Suarez Dorado', "telefono": '3106153184', "correo": 'asocomunalbalboa@gmail.com' },
    { "nombre": 'Asocomunal Bolivar', "municipioId": 4, "estado": True, "presidente": 'Fredy Yobany Zemanate', "telefono": '3122871156', "correo": 'asocomunalbolivarc@hotmail.com' },
    { "nombre": 'Asocomunal Buenos Aires', "municipioId": 5, "estado": True, "presidente": 'Manuel Cortes Salinas', "telefono": '3146436320', "correo": 'asocomunalbuenosaires2225@gmail.com' },
    { "nombre": 'Asocomunal Alto Naya', "municipioId": 5, "estado": True, "presidente": 'Manuel Tenorio Yonda', "telefono": '3027830505;3153933757', "correo": 'desarrollocomunitario@buenosaires-cauca.gov.co;greysigomez1986@gmail.com' },
    { "nombre": 'Asocomunal Cajibio', "municipioId": 6, "estado": True, "presidente": 'Margarett Garcia Guardo', "telefono": '3137486215', "correo": 'asocomunalcajibio@gmail.com' },
    { "nombre": 'Asocomunal Caldono', "municipioId": 7, "estado": True, "presidente": 'Silvio Bomba Campo', "telefono": '3104337775', "correo": 'asocomunalcaldonocauca@gmail.com' },
    { "nombre": 'Asocomunal Caloto', "municipioId": 8, "estado": True, "presidente": 'Oswaldo Velasco Daza', "telefono": '3216455133', "correo": 'asoc.caloto@hotmail.com' },
    { "nombre": 'Asocomunal Corinto', "municipioId": 9, "estado": True, "presidente": 'Vilma Lorena Motta', "telefono": '3148856543', "correo": 'jacasocomunalcorinto@gmail.com' },
    { "nombre": 'Asocomunal El Tambo', "municipioId": 10, "estado": True, "presidente": 'Jesus Antonio Caicedo', "telefono": '3126004342', "correo": 'asocomunaleltambocauca@gmail.com' },
    { "nombre": 'Asocomunal Florencia', "municipioId": 11, "estado": False, "presidente": 'No Eligio', "telefono": None, "correo": None },
    { "nombre": 'Asocomunal Guachene', "municipioId": 12, "estado": True, "presidente": 'Oscar Cantoñi Mina', "telefono": '3207092039', "correo": 'asocomunalg@gmail.com' },
    { "nombre": 'Asocomunal Guapi', "municipioId": 13, "estado": True, "presidente": 'Daniel Solís Sinisterra', "telefono": '3136088967', "correo": 'asocomunalguapi@gmail.com' },
    { "nombre": 'Asocomunal Inza', "municipioId": 14, "estado": True, "presidente": 'Astrid Sanchez Campos', "telefono": '3133150133', "correo": 'asocomunalinzacauca@gmail.com' },
    { "nombre": 'Asocomunal Jambalo', "municipioId": 15, "estado": True, "presidente": 'Brandon Velasco Valencia', "telefono": '3206838330', "correo": 'asocomunal.jambalo@gmail.com' },
    { "nombre": 'Asocomunal La Sierra', "municipioId": 16, "estado": True, "presidente": 'Heriberto López Albán', "telefono": '3113538554', "correo": 'asocomunallasierra@gmail.com' },
    { "nombre": 'Asocomunal La Vega', "municipioId": 17, "estado": True, "presidente": 'Mancer Gerardo Muñoz', "telefono": '3175584072', "correo": 'asocomunallavega@gmail.com' },
    { "nombre": 'Asocomunal López de Micay', "municipioId": 18, "estado": False, "presidente": 'No Eligio', "telefono": None, "correo": None },
    { "nombre": 'Asocomunal Mercaderes', "municipioId": 19, "estado": True, "presidente": 'Enrique Aldivar Angulo Velasco', "telefono": '3207402971', "correo": 'asocomunal.mercaderes2022@gmail.com' },
    { "nombre": 'Asocomunal Miranda', "municipioId": 20, "estado": True, "presidente": 'Martha Cecilia Valencia Cabezas', "telefono": '3117965806', "correo": 'asocomunaldemirada@gmail.com' },
    { "nombre": 'Asocomunal Morales', "municipioId": 21, "estado": True, "presidente": 'Luis Eduardo Valencia Vergara', "telefono": '3103734753', "correo": 'desarrollocomunitario@morales-cauca.gov.co' },
    { "nombre": 'Asocomunal Padilla', "municipioId": 22, "estado": False, "presidente": None, "telefono": None, "correo": None },
    { "nombre": 'Asocomunal Paez', "municipioId": 23, "estado": True, "presidente": 'Celestino Ortiz Mera', "telefono": '3113789142', "correo": 'asocomunalpaezcauca@hotmail.com' },
    { "nombre": 'Asocomunal Patia', "municipioId": 24, "estado": True, "presidente": 'Maria del Pilar Lopez Herrera', "telefono": '3127888725', "correo": 'secretariaasojuntaspatia@gmail.com;presidenciaasojuntas@gmail.com' },
    { "nombre": 'Asocomunal Piamonte', "municipioId": 25, "estado": True, "presidente": 'Gildardo Pastrana', "telefono": '3115324001', "correo": 'asocomunalpiamonte@gmail.com' },
    { "nombre": 'Asocomunal Piendamo', "municipioId": 26, "estado": True, "presidente": 'Jose Aymer Mosquera Ramirez', "telefono": '3113293768', "correo": 'piendamoasocomunal@gmail.com' },
    { "nombre": 'Asocomunal Popayan', "municipioId": 27, "estado": True, "presidente": 'Jhonatan Constain', "telefono": '3122639348', "correo": 'asocomunalpopayancauca@gmail.com' },
    { "nombre": 'Asocomunal Puerto Tejada', "municipioId": 28, "estado": True, "presidente": 'Carlos Arturo Lasso Vasquez', "telefono": '3184212320', "correo": 'ptotejadaasojuntas@gmail.com' },
    { "nombre": 'Asocomunal Purace', "municipioId": 29, "estado": True, "presidente": 'Oscar Joel Cuchumbe Chantre', "telefono": '3216410316', "correo": 'juntaspurace@gmail.com' },
    { "nombre": 'Asocomunal Rosas', "municipioId": 30, "estado": True, "presidente": 'Eduardo Narvaez', "telefono": '3216410316', "correo": 'asocomunalrosas@gmail.com;asocomunalrosascauca2023@hotmail.com' },
    { "nombre": 'Asocomunal San Sebastian', "municipioId": 31, "estado": True, "presidente": 'Felio Roldan Timana Anacona', "telefono": '3206995085', "correo": 'contador1@caminosdeoportunidades.com.co;jesusarbeym2@hotmail.com' },
    { "nombre": 'Asocomunal Santa Rosa Cabecera', "municipioId": 32, "estado": True, "presidente": 'Nelson Joaqui', "telefono": '3148570441', "correo": 'asojuntassantarosacabecera25@gmail.com' },
    { "nombre": 'Asocomunal Santa Rosa Media Bota', "municipioId": 32, "estado": True, "presidente": 'Edelmo Calvahce', "telefono": '3212476240', "correo": 'asojuntassantarosacabecera25@gmail.com' },
    { "nombre": 'Asocomunal Santa Rosa Villalobos', "municipioId": 32, "estado": True, "presidente": 'Alejandro Piamba Jimenez', "telefono": '3213418027', "correo": 'asojuntasvillaloboscauca@gmail.com' },
    { "nombre": 'Asocomunal Santander de Quilichao', "municipioId": 33, "estado": True, "presidente": 'Jessica Lasso Choco', "telefono": '3113643059', "correo": 'asocomunalquilichao@gmail.com' },
    { "nombre": 'Asocomunal Silvia', "municipioId": 34, "estado": True, "presidente": 'Wilson Ferney Chilo Pito', "telefono": '3216413372', "correo": 'asocomunalsilviacauca@gmail.com' },
    { "nombre": 'Asocomunal Sotara', "municipioId": 35, "estado": True, "presidente": 'Vilma Yamileth Astaiza Rivera', "telefono": '3184512686', "correo": 'sotaraasociaciondejuntas@gmail.com' },
    { "nombre": 'Asocomunal Suarez', "municipioId": 36, "estado": True, "presidente": 'Gersain Soscue Zambrano', "telefono": '3174914030', "correo": 'asojuntassuarez@gmail.com' },
    { "nombre": 'Asocomunal Sucre', "municipioId": 37, "estado": True, "presidente": 'Lorena Carvajal Martinez', "telefono": '3108218229', "correo": 'asocomunalsucre2023@gmail.com' },
    { "nombre": 'Asocomunal Timbio', "municipioId": 38, "estado": True, "presidente": 'Alfonso Truque Diaz', "telefono": '3127029949', "correo": 'asocomunal.timbiocauca@gmail.com' },
    { "nombre": 'Asocomunal Timbiqui', "municipioId": 39, "estado": False, "presidente": 'No Eligio', "telefono": None, "correo": None },
    { "nombre": 'Asocomunal Toribio', "municipioId": 40, "estado": True, "presidente": 'Lirio Velez Noscue Mijera', "telefono": '3207441313', "correo": 'asociacionjactoribio@gmail.com' },
    { "nombre": 'Asocomunal Totoro', "municipioId": 41, "estado": True, "presidente": 'Marleny Estela Ibarra M.', "telefono": '3114831001', "correo": 'asocomunaltotoro2026@outlook.com' },
    { "nombre": 'Asocomunal Villa Rica', "municipioId": 42, "estado": True, "presidente": 'Jhoan A. Montes Usme', "telefono": '3216134066', "correo": 'asocomunalvillarica@hotmail.com' }
]

# ── Helpers ─────────────────────────────────────────────────────────────────
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

def mapear_estado(activa_raw) -> str:
    if es_nan(activa_raw):
        return 'activa'
    valor = str(activa_raw).strip().upper()
    if valor == 'ACTIVA':
        return 'activa'
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

def col(row, indice):
    return row.iloc[indice]

# ── Main ────────────────────────────────────────────────────────────────────
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
    cargos_base =[
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

    cursor.execute('SELECT id FROM public."CARGO" WHERE nombre = %s', ('Presidente',))
    fila_cargo = cursor.fetchone()
    if not fila_cargo:
        print('❌ No se encontró el cargo "Presidente". Abortando.')
        cursor.close(); conn.close()
        return
    cargo_presidente_id: int = fila_cargo[0]

    # ── 4. MIGRACIÓN DE ASOCOMUNALES ────────────────────────────────────────
    print('⏳ Migrando Asocomunales...')
    total_asoc_insertadas = 0
    for i, asoc in enumerate(ASOCOMUNALES_DATA):
        # PK no es auto incremental en ASOCOMUNAL, la definimos nosotros empezando desde 1.
        asoc_id = i + 1 
        nombre = asoc['nombre']
        municipio_id = asoc['municipioId']
        municipio_nombre = obtener_nombre_municipio(municipio_id)
        estado = asoc['estado']
        
        try:
            cursor.execute(
                """
                INSERT INTO public."ASOCOMUNAL"
                    (id, nombre, municipio_id, municipio_nombre, estado)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (asoc_id, nombre, municipio_id, municipio_nombre, estado),
            )
            total_asoc_insertadas += cursor.rowcount
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"❌ Error insertando Asocomunal '{nombre}': {e}")
            
    print(f'✅ Asocomunales validadas/insertadas: {total_asoc_insertadas}')

    # ── 5. Cargar el Excel (JAC) ──────────────────────────────────────────────
    archivo = './statics/datos.xlsx'
    if not os.path.exists(archivo):
        print(f'⚠️ Archivo {archivo} no encontrado. Finalizando proceso temprano.')
        cursor.close(); conn.close()
        return

    print(f'\n⏳ Leyendo {archivo}...')
    df = pd.read_excel(archivo, header=3)
    print(f'ℹ️  Total filas encontradas en Excel: {len(df)}')

    # ── 6. Migración fila a fila (JACs) ───────────────────────────────────────
    total_jac     = 0
    total_persona = 0
    errores       =[]

    for index, row in df.iterrows():
        try:
            # ── 6.1 Datos de la JAC ───────────────────────────────────────────
            nombre_corto    = limpiar(col(row, COL_NOMBRE_CORTO),    max_len=100)
            nombre_completo = limpiar(col(row, COL_NOMBRE_COMPLETO), max_len=100)

            if not nombre_corto and not nombre_completo:
                continue

            if not nombre_completo: nombre_completo = nombre_corto
            if not nombre_corto:    nombre_corto = None

            estado  = mapear_estado(col(row, COL_ACTIVA))
            ruc_raw = col(row, COL_RUC)
            numero_ruc = limpiar(ruc_raw, max_len=30) if es_ruc_valido(ruc_raw) else None

            # ── 6.2 Insertar JAC ──────────────────────────────────────────────
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

            # ── 6.3 Datos del presidente ──────────────────────────────────────
            nombre_pres_raw = limpiar(col(row, COL_NOMBRE_PRES))

            if nombre_pres_raw:
                nombre, apellido = parsear_nombre(nombre_pres_raw)

                cedula_raw = col(row, COL_CEDULA)
                cedula = limpiar(str(int(cedula_raw)) if isinstance(cedula_raw, float) and not math.isnan(cedula_raw) else cedula_raw, max_len=20)

                telefono_raw = col(row, COL_TELEFONO)
                telefono = limpiar(str(int(telefono_raw)) if isinstance(telefono_raw, float) and not math.isnan(telefono_raw) else telefono_raw, max_len=20)

                lugar_exp = limpiar(col(row, COL_LUGAR_EXP), max_len=50)
                correo    = limpiar(col(row, COL_CORREO),     max_len=100)

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
            for c in[COL_NOMBRE_CORTO, COL_NOMBRE_COMPLETO, COL_ACTIVA,
                       COL_NOMBRE_PRES, COL_CEDULA]:
                val = row.iloc[c]
                if not es_nan(val):
                    fila_dict[str(c)] = str(val)

            errores.append({
                'fila_excel': int(index) + 5,
                'error': str(e),
                'datos_fila': fila_dict,
            })

    # ── 7. Reporte final ──────────────────────────────────────────────────────
    print(f'\n✅ JACs insertadas desde Excel:      {total_jac}')
    print(f'✅ Presidentes de JAC migrados:      {total_persona}')

    if errores:
        reporte = 'errores_importacion.json'
        with open(reporte, 'w', encoding='utf-8') as f:
            json.dump(errores, f, ensure_ascii=False, indent=4)
        print(f'⚠️  {len(errores)} filas del excel con error → ver {reporte}')
    else:
        print('✅ Sin errores en la importación global.')

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()