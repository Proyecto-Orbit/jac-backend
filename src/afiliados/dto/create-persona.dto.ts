import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsEmail,
  MinLength,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class CreatePersonaDto {
  @IsOptional()
  @IsInt()
  cargoId?: number;

  @IsOptional()
  @IsInt()
  municipioId?: number;

  @IsOptional()
  @IsInt()
  jacId?: number;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2)
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @MinLength(2)
  apellido!: string;

  @IsOptional()
  @IsString()
  cedula?: string;

  @IsOptional()
  @IsString()
  lugarExpedicionCedula?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  correo?: string;

  @IsOptional()
  @IsString()
  genero?: string;

  @IsOptional()
  @IsString()
  grupoEtnico?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  ocupacion?: string;

  @IsOptional()
  @IsString()
  estudiosRealizados?: string;

  @IsOptional()
  @IsBoolean()
  discapacitado?: boolean;
}
