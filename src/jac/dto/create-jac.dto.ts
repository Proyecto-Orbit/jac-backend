import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoJAC } from '../entities/jac.entity';

/**
 * DTO para crear una nueva JAC.
 *
 * @remarks
 * Reglas de negocio aplicadas:
 * - El `id` lo genera la base de datos.
 * - El `estado` NO se acepta en la creación: toda JAC nueva nace como
 *   `inactiva` y se activa cuando alcanza el mínimo legal de afiliados
 *   (Ley 2166 de 2021, Art. 11).
 * - La asociación con una Asocomunal es obligatoria.
 * - El `tipo` (barrio o vereda) es obligatorio porque determina el
 *   umbral mínimo de afiliados para mantenerla activa.
 * - El `numeroRUC` es opcional.
 */
export class CreateJACDto {
  /**
   * ID de la Asocomunal a la que pertenece esta JAC. Obligatorio.
   */
  @Type(() => Number)
  @IsInt({ message: 'asocomunalId debe ser un número entero' })
  @IsNotEmpty({ message: 'La Asocomunal responsable es obligatoria' })
  asocomunalId!: number;

  /**
   * Tipo de territorio que cubre la JAC.
   * Determina el mínimo legal de afiliados para sostenerla activa.
   *
   * @see {@link TipoJAC}
   */
  @IsEnum(TipoJAC, {
    message: 'El tipo debe ser: barrio o vereda',
  })
  tipo!: TipoJAC;

  /**
   * Nombre abreviado de la JAC (opcional).
   *
   * @example "JAC El Pino"
   */
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'El nombre corto no puede superar 100 caracteres'
  })
  nombreCorto?: string;

  /**
   * Nombre completo oficial de la JAC. Campo obligatorio.
   *
   * @example "Junta de Acción Comunal Barrio El Pino"
   */
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es obligatorio' })
  @MinLength(3, { message: 'El nombre completo debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre completo no puede superar 100 caracteres' })
  nombreCompleto!: string;

  /**
   * Número de RUC (Registro Único Comunal) de la JAC. Opcional.
   */
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'El número de RUC no puede superar 30 caracteres' })
  numeroRUC?: string;
}
