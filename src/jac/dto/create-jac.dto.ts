/**
 * DTO para crear una nueva JAC
 * 
 * Los DTOs definen qué datos se esperan en las peticiones HTTP
 * y aplican validaciones automáticas con class-validator
 * 
 * @decorator @IsString() - Valida que sea texto
 * @decorator @IsNotEmpty() - Valida que no esté vacío
 * @decorator @IsOptional() - El campo es opcional
 * @decorator @IsEmail() - Valida formato de email
 * @decorator @IsInt() - Valida que sea número entero
 */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsInt,
  MinLength,
  IsNumber,
} from 'class-validator';

export class CreateJACDto {
  @IsOptional()
  @IsString()
  numero?: string;

  @IsString()
  @IsNotEmpty({ message: 'El municipio es obligatorio' })
  @MinLength(2, { message: 'El municipio debe tener al menos 2 caracteres' })
  MUNICIPIO!: string;

  @IsOptional()
  @IsString()
  nombreCortoJAC?: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es obligatorio' })
  @MinLength(5, { message: 'El nombre debe tener al menos 5 caracteres' })
  nombreCompletoJunta!: string;

  @IsOptional()
  @IsString()
  noCarpeta?: string;

  @IsOptional()
  @IsString()
  noCaja?: string;

  @IsOptional()
  @IsString()
  ACTIVA?: string;

  @IsOptional()
  @IsString()
  observacionesArchivo?: string;

  @IsOptional()
  @IsString()
  observacionesArchivoFisico?: string;

  @IsOptional()
  @IsString()
  tipoDeOrganismoComunal?: string;

  @IsOptional()
  @IsString()
  primerConsiderandoPersoneriaJuridica?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsString()
  nombreDePresidente?: string;

  @IsOptional()
  @IsString()
  numeroDeIdentificacion?: string;

  @IsOptional()
  @IsString()
  lugarDeExpedicion?: string;

  @IsOptional()
  @IsString()
  cambioPresidente?: string;

  @IsOptional()
  @IsString()
  numeroTelefonico?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  correoElectronico?: string;

  @IsOptional()
  @IsString()
  estadoActualizacion?: string;

  @IsOptional()
  @IsString()
  nombreDeComites?: string;

  @IsOptional()
  @IsInt()
  fechaDeAprobacion?: number;

  @IsOptional()
  @IsInt()
  numeroDeAfiliados?: number;

  @IsOptional()
  @IsString()
  numeroRUC?: string;

  @IsOptional()
  @IsNumber()
  asocomunalId?: number;

  @IsOptional()
  @IsString()
  creadoPor?: string;
}