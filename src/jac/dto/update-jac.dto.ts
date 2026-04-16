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
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateJACDto extends PartialType(CreateJACDto) {
  @IsOptional()
  @IsString()
  actualizadoPor?: string;

  @IsOptional()
  @IsNumber()
  asocomunalId?: number;
}