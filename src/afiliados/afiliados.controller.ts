import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import { AfiliadosService } from './afiliados.service';
import { ImportarAfiliadosService } from './importar/importar-afiliados.service';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import { ImportarAfiliadosDto } from './dto/importar-afiliados.dto';
import { ImportarAfiliadosResultDto } from './dto/importar-afiliados-result.dto';
import { PersonaResponseDto } from './dto/persona-response.dto';
import { Cargo } from './entities/cargo.entity';
import { Auth } from '../auth/auth.decorator';
import { Role } from '../auth/role.enum';

@Controller('afiliados')
export class AfiliadosController {
  constructor(
    private readonly afiliadosService: AfiliadosService,
    private readonly importarAfiliadosService: ImportarAfiliadosService,
  ) {}

  @Auth(Role.ADMIN)
  @Post()
  create(@Body() createPersonaDto: CreatePersonaDto): Promise<PersonaResponseDto> {
    return this.afiliadosService.create(createPersonaDto);
  }

  /**
   * Importa afiliados y dignatarios de una JAC desde un Excel (.xlsx).
   *
   * @remarks
   * Recibe `multipart/form-data` con:
   *  - `archivo`: el .xlsx con las sheets "RELACION ASOCIADOS JAC" y
   *    "RELACION DIGNATARIOS".
   *  - `jacId`: ID de la JAC a la que se asociarán las personas.
   *
   * Si alguna validación falla (cédulas duplicadas, persona afiliada a otra
   * JAC, formato inválido, lugar de expedición no reconocido, JAC inexistente,
   * cargos inválidos), responde 400 con la lista completa de errores y NO
   * persiste nada. En éxito, todo se inserta/actualiza dentro de una sola
   * transacción.
   */
  @Auth(Role.ADMIN)
  @Post('importar-excel')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async importarExcel(
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
      }),
    )
    archivo: Express.Multer.File,
    @Body() body: ImportarAfiliadosDto,
  ): Promise<ImportarAfiliadosResultDto> {
    const nombre = (archivo.originalname || '').toLowerCase();
    if (!nombre.endsWith('.xlsx')) {
      throw new BadRequestException('El archivo debe tener extensión .xlsx');
    }
    return this.importarAfiliadosService.importarExcel(
      archivo.buffer,
      body.jacId,
    );
  }

  @Auth(Role.ADMIN)
  @Get()
  findAll(): Promise<PersonaResponseDto[]> {
    return this.afiliadosService.findAll();
  }

  @Auth(Role.ADMIN)
  @Get('catalogo/cargos')
  findAllCargos(): Promise<Cargo[]> {
    return this.afiliadosService.findAllCargos();
  }

  @Auth(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PersonaResponseDto> {
    return this.afiliadosService.findOne(id);
  }

  @Auth(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePersonaDto: UpdatePersonaDto,
  ): Promise<PersonaResponseDto> {
    return this.afiliadosService.update(id, updatePersonaDto);
  }

  @Auth(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.afiliadosService.remove(id);
  }
}
