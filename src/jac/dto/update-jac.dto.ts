/**
 * DTO para actualizar una JAC
 * 
 * Extiende CreateJACDto haciendo todos los campos opcionales
 * Esto permite enviar solo los campos que se quieren actualizar
 * 
 * Campos NO editables:
 * - `tipo`: Define requisitos legales de afiliados (Ley 2166). Se define en creación.
 * 
 * @decorator @PartialType() - Hace todos los campos opcionales
 */
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateJACDto } from './create-jac.dto';
import { IsIn, IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateJACDto extends PartialType(OmitType(CreateJACDto, ['tipo'])) {
  @IsOptional()
  @IsString()
  actualizadoPor?: string;

  @IsOptional()
  @IsNumber()
  asocomunalId?: number;

  /**
   * Nuevo estado de la JAC.
   * Solo se puede cambiar mediante actualización explícita (no en creación).
   */
  @IsOptional()
  @IsIn(['activa', 'inactiva', 'cancelada'], { message: 'El estado debe ser: activa, inactiva o cancelada' })
  estado?: string;
}
