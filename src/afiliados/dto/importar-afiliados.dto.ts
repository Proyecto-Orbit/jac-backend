import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

/**
 * Cuerpo (multipart/form-data) del endpoint POST /afiliados/importar-excel.
 * El archivo viaja en el campo `archivo`; este DTO valida sólo los campos
 * de texto que acompañan al archivo.
 */
export class ImportarAfiliadosDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  jacId!: number;
}
