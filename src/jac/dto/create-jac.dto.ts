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
 * - El `numeroRUC` y el `nit` son opcionales.
 * - El `numeroPersoneriaJuridica` es obligatorio, pero esa obligatoriedad
 *   se valida en la capa de servicio (no con decoradores) porque la
 *   migración de datos reales no incluye este campo.
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

  /**
   * NIT de la JAC. Opcional.
   */
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'El NIT no puede superar 30 caracteres' })
  nit?: string;

  /**
   * Número de personería jurídica de la JAC.
   *
   * @remarks
   * Obligatorio en la creación, pero la validación de presencia se hace en
   * el servicio (no con decoradores) para no romper la migración de datos
   * reales, donde este campo puede venir vacío.
   */
  @IsOptional()
  @IsString()
  @MaxLength(50, {
    message: 'El número de personería jurídica no puede superar 50 caracteres',
  })
  numeroPersoneriaJuridica?: string;
}
