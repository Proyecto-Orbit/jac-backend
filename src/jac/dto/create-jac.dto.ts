import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { EstadoJAC } from '../entities/jac.entity';

/**
 * DTO para crear una nueva JAC.
 *
 * @remarks
 * El `id` es generado automáticamente por la base de datos.
 * Si no se envía `estado`, la JAC se crea como `activa` por defecto.
 */
export class CreateJACDto {
  /**
   * ID de la Asocomunal a la que pertenece esta JAC (opcional al crear).
   * La asociación puede realizarse o actualizarse posteriormente.
   */
  @IsOptional()
  @IsInt()
  asocomunalId?: number;

  /**
   * Estado inicial de la JAC.
   * Si se omite, se establece `activa` automáticamente.
   *
   * @see {@link EstadoJAC}
   */
  @IsOptional()
  @IsEnum(EstadoJAC, {
    message: 'El estado debe ser: activa, inactiva o cancelada',
  })
  estado?: EstadoJAC;

  /**
   * Nombre abreviado de la JAC.
   *
   * @example "JAC El Pino"
   */
  @IsOptional()
  @IsString()
  nombreCorto?: string;

  /**
   * Nombre completo oficial de la JAC. Campo obligatorio.
   *
   * @example "Junta de Acción Comunal Barrio El Pino"
   */
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es obligatorio' })
  @MinLength(3, { message: 'El nombre completo debe tener al menos 3 caracteres' })
  nombreCompleto!: string;

  /**
   * Número de RUC (Registro Único Comunal) de la JAC.
   */
  @IsOptional()
  @IsString()
  numeroRUC?: string;
}
