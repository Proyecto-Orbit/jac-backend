import { IsInt, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class AssignCargoDto {
  @IsInt()
  @IsNotEmpty()
  cargoId!: number;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
