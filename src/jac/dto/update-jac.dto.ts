/**
 * DTO para actualizar una JAC
 * 
 * Extiende CreateJACDto haciendo todos los campos opcionales
 * Esto permite enviar solo los campos que se quieren actualizar
 * 
 * @decorator @PartialType() - Hace todos los campos opcionales
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateJACDto } from './create-jac.dto';
import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import { EstadoJAC } from '../entities/jac.entity';

export class UpdateJACDto extends PartialType(CreateJACDto) {
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
  @IsEnum(EstadoJAC, { message: 'El estado debe ser: activa, inactiva o cancelada' })
  estado?: EstadoJAC;
}