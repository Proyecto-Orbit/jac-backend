/**
 * Detalle de un error detectado durante la validación del Excel de afiliados.
 * Permite al frontend ubicar la celda exacta que causó el problema.
 */
export interface ImportErrorDto {
  /** Nombre de la sheet donde ocurrió el error. */
  sheet: string;
  /** Fila del Excel (1-based, tal como la ve el usuario en Excel). */
  fila: number;
  /** Cédula de la persona involucrada, cuando aplica. */
  cedula?: string | null;
  /** Mensaje descriptivo del error. */
  motivo: string;
}

/**
 * Resultado de la importación masiva de afiliados desde Excel.
 *
 * @remarks
 * Si `errores` contiene elementos, NINGÚN dato fue persistido en la BD
 * y el endpoint responde con HTTP 400. Si está vacío, la transacción se
 * completó y los contadores reflejan lo realmente insertado.
 */
export class ImportarAfiliadosResultDto {
  jacId!: number;
  /** Cantidad de personas creadas nuevas en BD (cédula no existía). */
  afiliadosInsertados!: number;
  /** Cantidad de personas ya existentes cuyos datos se actualizaron. */
  afiliadosActualizados!: number;
  cargosAsignados!: number;
  cargosCreados!: string[];
  errores!: ImportErrorDto[];
}
