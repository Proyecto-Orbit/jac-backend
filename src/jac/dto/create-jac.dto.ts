import { IsString, IsNotEmpty, IsOptional, IsInt, MinLength } from 'class-validator';

export class CreateJACDto {
  @IsOptional()
  @IsInt()
  tipoOrganismoId?: number;

  @IsOptional()
  @IsInt()
  estadoId?: number;

  @IsOptional()
  @IsString()
  nombreCorto?: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es obligatorio' })
  @MinLength(3, { message: 'El nombre completo debe tener al menos 3 caracteres' })
  nombreCompleto!: string;

  @IsOptional()
  @IsString()
  nit?: string;

  @IsOptional()
  @IsString()
  numeroRUC?: string;
}
