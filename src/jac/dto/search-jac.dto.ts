import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoJAC } from '../entities/jac.entity';

/**
 * DTO para filtrar JACs en el endpoint de búsqueda.
 *
 * @remarks
 * Todos los campos son opcionales. Si no se envía ningún filtro,
 * se devuelven todas las JACs independientemente de su estado.
 * El filtro `municipio` opera sobre el nombre del municipio de la
 * Asocomunal vinculada; las JACs sin Asocomunal asignada no aparecerán
 * al usar ese filtro.
 *
 * @example
 * GET /jac/buscar?nombre=comunal&estado=activa
 * GET /jac/buscar?municipio=bogot%C3%A1&estado=inactiva
 */
export class SearchJACDto {
  /**
   * Texto a buscar en `nombre_completo` o `nombre_corto`.
   * La búsqueda es parcial e insensible a mayúsculas.
   *
   * @example "el pino"
   */
  @IsOptional()
  @IsString()
  nombre?: string;

  /**
   * Nombre del municipio de la Asocomunal vinculada a la JAC.
   * La búsqueda es parcial e insensible a mayúsculas.
   *
   * @example "bogotá"
   */
  @IsOptional()
  @IsString()
  municipio?: string;

  /**
   * Estado de la JAC a filtrar.
   * Si se omite, se retornan JACs en cualquier estado.
   *
   * @see {@link EstadoJAC}
   */
  @IsOptional()
  @IsEnum(EstadoJAC, {
    message: 'El estado debe ser: activa, inactiva o cancelada',
  })
  estado?: EstadoJAC;
}
