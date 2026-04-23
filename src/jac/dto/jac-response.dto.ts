import { EstadoJAC, JAC } from '../entities/jac.entity';

/**
 * Representación anidada de la Asocomunal dentro de la respuesta de JAC.
 */
export interface AsocomunalResumen {
  /** Identificador de la Asocomunal. */
  id: number;
  /** Nombre oficial de la Asocomunal. */
  nombre: string;
  /** ID del municipio al que pertenece. */
  municipioId: number | null;
  /** Nombre legible del municipio. */
  municipioNombre: string | null;
  /** Estado activo/inactivo en el sistema origen. */
  estado: boolean;
}

/**
 * DTO de respuesta para operaciones sobre JAC.
 *
 * @remarks
 * El campo `asocomunal` solo está presente cuando la relación fue cargada
 * explícitamente por el servicio (con `relations` o QueryBuilder).
 */
export class JACResponseDto {
  /** Identificador único de la JAC. */
  id!: number;

  /** FK hacia la Asocomunal vinculada, o `null` si no tiene. */
  asocomunalId!: number | null;

  /**
   * Estado actual de la JAC.
   *
   * @see {@link EstadoJAC}
   */
  estado!: EstadoJAC;

  /** Nombre abreviado de la JAC. */
  nombreCorto!: string | null;

  /** Nombre completo oficial de la JAC. */
  nombreCompleto!: string;

  /** Número de RUC de la JAC. */
  numeroRUC!: string | null;

  /**
   * Datos de la Asocomunal vinculada.
   * - `null` → JAC sin Asocomunal asignada.
   * - `undefined` → relación no cargada en esta consulta.
   */
  asocomunal?: AsocomunalResumen | null;

  /**
   * Convierte una entidad {@link JAC} en un {@link JACResponseDto}.
   *
   * @param jac - Entidad recuperada de la base de datos.
   * @returns Objeto plano listo para serializar en la respuesta HTTP.
   */
  static fromEntity(jac: JAC): JACResponseDto {
    const dto: JACResponseDto = {
      id: jac.id,
      asocomunalId: jac.asocomunalId,
      estado: jac.estado,
      nombreCorto: jac.nombreCorto,
      nombreCompleto: jac.nombreCompleto,
      numeroRUC: jac.numeroRUC,
    };

    if (jac.asocomunal !== undefined) {
      dto.asocomunal = jac.asocomunal
        ? {
            id: jac.asocomunal.id,
            nombre: jac.asocomunal.nombre,
            municipioId: jac.asocomunal.municipioId,
            municipioNombre: jac.asocomunal.municipioNombre,
            estado: jac.asocomunal.estado,
          }
        : null;
    }

    return dto;
  }

  /**
   * Convierte un array de entidades en un array de DTOs.
   *
   * @param jacs - Array de entidades {@link JAC}.
   * @returns Array de {@link JACResponseDto}.
   */
  static fromEntities(jacs: JAC[]): JACResponseDto[] {
    return jacs.map((jac) => JACResponseDto.fromEntity(jac));
  }
}
