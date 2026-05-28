import * as ExcelJS from 'exceljs';
import { ImportErrorDto } from '../dto/importar-afiliados-result.dto';
import { esCiudadColombianaValida } from './ciudades-colombia';

/**
 * Nombres oficiales de las sheets dentro del Excel de plantilla.
 */
export const SHEET_AFILIADOS = 'RELACION ASOCIADOS JAC';
export const SHEET_DIGNATARIOS = 'RELACION DIGNATARIOS';

/** Fila (1-based) donde inicia la data en la sheet de afiliados. */
const DATA_START_AFILIADOS = 3;

/** Índices (1-based) de las columnas relevantes en la sheet de afiliados. */
const COL_AFILIADOS = {
  nombreCompleto: 2,
  cedula: 3,
  lugarExpedicion: 4,
  fechaNacimiento: 5,
  telefono: 17,
  correo: 18,
} as const;

/** Mapeo de cargos individuales declarados con su nombre en la columna A. */
const CARGOS_DIRECTOS: Record<string, string> = {
  PRESIDENTE: 'Presidente',
  VICEPRESIDENTE: 'Vicepresidente',
  TESORERO: 'Tesorero',
  SECRETARIO: 'Secretario',
  'FISCAL PRINCIPAL': 'Fiscal Principal',
  'FISCAL SUPLENTE': 'Fiscal Suplente',
};

/**
 * Secciones reconocidas dentro de la sheet de dignatarios.
 * El parser usa la última sección vista para mapear filas numeradas o "DE:".
 */
enum Seccion {
  NINGUNA = 'NINGUNA',
  JUNTA = 'JUNTA',
  ORGANO = 'ORGANO',
  CONVIVENCIA = 'CONVIVENCIA',
  DELEGADOS = 'DELEGADOS',
  COMISIONES_TRABAJO = 'COMISIONES_TRABAJO',
}

export interface ParsedAfiliado {
  filaExcel: number;
  nombre: string;
  apellido: string;
  cedula: string;
  lugarExpedicionCedula: string | null;
  telefono: string | null;
  correo: string | null;
}

export interface ParsedDignatario {
  filaExcel: number;
  cedula: string;
  cargoNombre: string;
}

export interface ParsedExcel {
  afiliados: ParsedAfiliado[];
  dignatarios: ParsedDignatario[];
  errores: ImportErrorDto[];
}

/**
 * Convierte el valor crudo de una celda de ExcelJS a un string limpio.
 * Maneja fórmulas, números, fechas y celdas con formato `RichText`.
 */
function celdaATexto(valor: ExcelJS.CellValue): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') return valor.trim() || null;
  if (typeof valor === 'number') return String(valor).trim();
  if (typeof valor === 'boolean') return valor ? 'true' : 'false';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') {
    const obj = valor as unknown as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text.trim() || null;
    if (Array.isArray(obj.richText)) {
      const text = (obj.richText as { text?: string }[])
        .map((p) => p.text ?? '')
        .join('')
        .trim();
      return text || null;
    }
    if (obj.result !== undefined && obj.result !== null) {
      return celdaATexto(obj.result as ExcelJS.CellValue);
    }
    if (obj.formula !== undefined && obj.result === undefined) return null;
    if (obj.hyperlink !== undefined && typeof obj.text === 'string') {
      return (obj.text as string).trim() || null;
    }
  }
  return String(valor).trim() || null;
}

/**
 * Normaliza un texto para comparaciones case-insensitive y sin acentos.
 * Útil para detectar nombres de sección/cargo independientes del formato.
 */
function normalizar(texto: string | null): string {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Separa "NOMBRES Y APELLIDOS" en nombre + apellido.
 *
 * Reglas (idénticas a la migración Python):
 * - 1 palabra  → nombre.
 * - 2 palabras → primer nombre, primer apellido.
 * - 3 palabras → primer nombre, los demás como apellido.
 * - 4+ palabras → primeras 2 como nombre, el resto como apellido.
 */
function parsearNombre(nombreCompleto: string): { nombre: string; apellido: string } {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nombre: '', apellido: '' };
  if (partes.length === 1) return { nombre: partes[0], apellido: '' };
  if (partes.length === 2) return { nombre: partes[0], apellido: partes[1] };
  if (partes.length === 3) return { nombre: partes[0], apellido: partes.slice(1).join(' ') };
  return { nombre: partes.slice(0, 2).join(' '), apellido: partes.slice(2).join(' ') };
}

/**
 * Valida el formato de la fecha de nacimiento esperado: DD/MM/YYYY.
 *
 * @remarks
 * Acepta también celdas formateadas como fecha por Excel (Date object),
 * porque internamente representan una fecha válida. Si la celda viene
 * vacía retorna `{ valido: true }` (la fecha no es obligatoria).
 */
function validarFechaNacimiento(
  valor: ExcelJS.CellValue,
): { valido: boolean; motivo?: string } {
  if (valor === null || valor === undefined) return { valido: true };

  // Excel suele entregar fechas como Date object directamente.
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      return { valido: false, motivo: 'Fecha de nacimiento inválida' };
    }
    return { valido: true };
  }

  if (typeof valor === 'number') {
    return {
      valido: false,
      motivo: 'Fecha de nacimiento numérica; debe estar en formato DD/MM/YYYY',
    };
  }

  const texto = celdaATexto(valor);
  if (!texto) return { valido: true };

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!match) {
    return {
      valido: false,
      motivo: `Fecha de nacimiento "${texto}" no tiene el formato DD/MM/YYYY`,
    };
  }
  const dia = parseInt(match[1], 10);
  const mes = parseInt(match[2], 10);
  const anio = parseInt(match[3], 10);
  const fecha = new Date(anio, mes - 1, dia);
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return {
      valido: false,
      motivo: `Fecha de nacimiento "${texto}" no representa una fecha real`,
    };
  }
  return { valido: true };
}

/**
 * Verifica que la cédula esté compuesta exclusivamente por dígitos.
 * Permite que el valor venga como número desde Excel (sin decimales).
 */
function validarCedulaFormato(cedula: string): { valido: boolean; motivo?: string } {
  if (!/^\d+$/.test(cedula)) {
    return {
      valido: false,
      motivo: `La identificación "${cedula}" contiene caracteres no numéricos`,
    };
  }
  return { valido: true };
}

/**
 * Verifica que el teléfono no contenga letras.
 * Se permiten dígitos, espacios y los separadores comunes `+`, `-`, `(`, `)`.
 */
function validarTelefonoFormato(
  telefono: string,
): { valido: boolean; motivo?: string } {
  if (/[A-Za-z]/.test(telefono)) {
    return {
      valido: false,
      motivo: `El teléfono "${telefono}" contiene letras`,
    };
  }
  return { valido: true };
}

/**
 * Convierte "DE: deportes y juventud" → "Comisión de Deportes Y Juventud".
 * Capitaliza cada palabra del nombre de la comisión.
 */
function nombreComision(textoDespuesDe: string): string {
  const limpio = textoDespuesDe.trim();
  if (!limpio) return '';
  const titulado = limpio
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');
  return `Comisión de ${titulado}`;
}

/**
 * Parsea la sheet "RELACION ASOCIADOS JAC".
 * Solo extrae filas donde haya al menos cédula o nombre.
 */
function parsearAfiliados(
  ws: ExcelJS.Worksheet,
  errores: ImportErrorDto[],
): ParsedAfiliado[] {
  const afiliados: ParsedAfiliado[] = [];

  for (let r = DATA_START_AFILIADOS; r <= ws.actualRowCount; r++) {
    const row = ws.getRow(r);
    const nombreCompleto = celdaATexto(row.getCell(COL_AFILIADOS.nombreCompleto).value);
    const cedula = celdaATexto(row.getCell(COL_AFILIADOS.cedula).value);

    // Fila completamente vacía → la saltamos sin error.
    if (!nombreCompleto && !cedula) continue;

    if (!nombreCompleto) {
      errores.push({
        sheet: SHEET_AFILIADOS,
        fila: r,
        cedula,
        motivo: 'Falta el nombre completo del afiliado',
      });
      continue;
    }
    if (!cedula) {
      errores.push({
        sheet: SHEET_AFILIADOS,
        fila: r,
        cedula: null,
        motivo: `Falta la cédula del afiliado "${nombreCompleto}"`,
      });
      continue;
    }

    const { nombre, apellido } = parsearNombre(nombreCompleto);
    if (!nombre) {
      errores.push({
        sheet: SHEET_AFILIADOS,
        fila: r,
        cedula,
        motivo: 'Nombre inválido',
      });
      continue;
    }

    // Validaciones de formato — acumulan errores pero NO descartan la fila,
    // porque preferimos reportar todos los problemas detectables a la vez.
    let filaValida = true;

    const cedulaCheck = validarCedulaFormato(cedula);
    if (!cedulaCheck.valido) {
      errores.push({
        sheet: SHEET_AFILIADOS,
        fila: r,
        cedula,
        motivo: cedulaCheck.motivo!,
      });
      filaValida = false;
    }

    const fechaCheck = validarFechaNacimiento(
      row.getCell(COL_AFILIADOS.fechaNacimiento).value,
    );
    if (!fechaCheck.valido) {
      errores.push({
        sheet: SHEET_AFILIADOS,
        fila: r,
        cedula,
        motivo: fechaCheck.motivo!,
      });
      filaValida = false;
    }

    const lugar = celdaATexto(row.getCell(COL_AFILIADOS.lugarExpedicion).value);
    if (lugar && !esCiudadColombianaValida(lugar)) {
      errores.push({
        sheet: SHEET_AFILIADOS,
        fila: r,
        cedula,
        motivo: `Lugar de expedición "${lugar}" no corresponde a una ciudad de Colombia reconocida`,
      });
      filaValida = false;
    }

    const telefono = celdaATexto(row.getCell(COL_AFILIADOS.telefono).value);
    if (telefono) {
      const telCheck = validarTelefonoFormato(telefono);
      if (!telCheck.valido) {
        errores.push({
          sheet: SHEET_AFILIADOS,
          fila: r,
          cedula,
          motivo: telCheck.motivo!,
        });
        filaValida = false;
      }
    }

    const correo = celdaATexto(row.getCell(COL_AFILIADOS.correo).value);

    if (!filaValida) continue;

    afiliados.push({
      filaExcel: r,
      nombre: nombre.slice(0, 100),
      apellido: (apellido || '').slice(0, 100),
      cedula: cedula.slice(0, 20),
      lugarExpedicionCedula: lugar ? lugar.slice(0, 50) : null,
      telefono: telefono ? telefono.slice(0, 20) : null,
      correo: correo ? correo.slice(0, 150) : null,
    });
  }

  return afiliados;
}

/**
 * Detecta la sección a la que pertenece una fila a partir del texto de la columna A.
 * Retorna `null` cuando el texto no corresponde a una cabecera reconocida.
 */
function detectarSeccion(textoCol: string): Seccion | null {
  const n = normalizar(textoCol);
  if (n === 'JUNTA DIRECTIVA') return Seccion.JUNTA;
  if (n === 'ORGANO DE CONTROL') return Seccion.ORGANO;
  if (n.startsWith('COMISION DE CONVIVENCIA')) return Seccion.CONVIVENCIA;
  if (n === 'Y CONCILIACION') return null; // Continuación visual del header anterior
  if (n === 'DELEGADOS A LA ASOCIACION') return Seccion.DELEGADOS;
  if (n === 'COMISIONES DE TRABAJO') return Seccion.COMISIONES_TRABAJO;
  return null;
}

/**
 * Parsea la sheet "RELACION DIGNATARIOS".
 *
 * @remarks
 * Recorre las filas manteniendo la sección actual. Cada fila con cédula
 * en la columna B se traduce a un cargo canónico según la sección o el
 * nombre del cargo en la columna A.
 */
function parsearDignatarios(
  ws: ExcelJS.Worksheet,
  errores: ImportErrorDto[],
): ParsedDignatario[] {
  const dignatarios: ParsedDignatario[] = [];
  let seccion = Seccion.NINGUNA;

  for (let r = 3; r <= ws.actualRowCount; r++) {
    const row = ws.getRow(r);
    const colA = celdaATexto(row.getCell(1).value);
    const cedula = celdaATexto(row.getCell(2).value);

    if (!colA && !cedula) continue;

    // ¿Es una cabecera de sección? Si lo es, actualizar contexto y seguir.
    if (colA) {
      const nuevaSeccion = detectarSeccion(colA);
      if (nuevaSeccion !== null) {
        seccion = nuevaSeccion;
        continue;
      }
      // "Y CONCILIACION" es continuación visual de la cabecera anterior.
      if (normalizar(colA) === 'Y CONCILIACION') continue;
    }

    if (!cedula) {
      // Fila con texto en col A pero sin cédula: cargo declarado sin asignar → ignorar silenciosamente.
      continue;
    }

    let cargoNombre: string | null = null;
    const colAUpper = normalizar(colA);

    if (colAUpper && CARGOS_DIRECTOS[colAUpper]) {
      cargoNombre = CARGOS_DIRECTOS[colAUpper];
    } else if (colAUpper.startsWith('DE:')) {
      // "DE: deportes" dentro de COMISIONES DE TRABAJO
      const resto = colA!.slice(colA!.indexOf(':') + 1).trim();
      if (!resto) {
        errores.push({
          sheet: SHEET_DIGNATARIOS,
          fila: r,
          cedula,
          motivo: 'Comisión de trabajo sin nombre después de "DE:"',
        });
        continue;
      }
      cargoNombre = nombreComision(resto);
    } else if (seccion === Seccion.CONVIVENCIA) {
      cargoNombre = 'Comisión de Convivencia';
    } else if (seccion === Seccion.DELEGADOS) {
      cargoNombre = 'Delegado Asociación';
    } else if (seccion === Seccion.COMISIONES_TRABAJO) {
      errores.push({
        sheet: SHEET_DIGNATARIOS,
        fila: r,
        cedula,
        motivo:
          'Fila dentro de COMISIONES DE TRABAJO debe iniciar con "DE: <nombre de la comisión>"',
      });
      continue;
    } else {
      errores.push({
        sheet: SHEET_DIGNATARIOS,
        fila: r,
        cedula,
        motivo: `No se pudo determinar el cargo para la cédula ${cedula}`,
      });
      continue;
    }

    dignatarios.push({ filaExcel: r, cedula: cedula.slice(0, 20), cargoNombre });
  }

  return dignatarios;
}

/**
 * Punto de entrada del parser. Carga el workbook desde un buffer y extrae
 * ambas sheets. Los errores de formato/datos faltantes quedan acumulados
 * en `errores`; el servicio decide si abortar.
 */
export async function parsearExcelAfiliados(buffer: Buffer): Promise<ParsedExcel> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const errores: ImportErrorDto[] = [];

  const wsAfiliados = workbook.getWorksheet(SHEET_AFILIADOS);
  if (!wsAfiliados) {
    throw new Error(`El Excel no contiene la sheet "${SHEET_AFILIADOS}"`);
  }
  const wsDignatarios = workbook.getWorksheet(SHEET_DIGNATARIOS);
  if (!wsDignatarios) {
    throw new Error(`El Excel no contiene la sheet "${SHEET_DIGNATARIOS}"`);
  }

  const afiliados = parsearAfiliados(wsAfiliados, errores);
  const dignatarios = parsearDignatarios(wsDignatarios, errores);

  return { afiliados, dignatarios, errores };
}
