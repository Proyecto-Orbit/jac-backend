import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { AfiliadosService } from './afiliados.service';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import { AssignCargoDto } from './dto/assign-cargo.dto';
import { PersonaResponseDto } from './dto/persona-response.dto';
import { PersonaCargo } from './entities/persona-cargo.entity';
import { Cargo } from './entities/cargo.entity';
import { Auth } from '../auth/auth.decorator';
import { Role } from '../auth/role.enum';

@Controller('afiliados')
export class AfiliadosController {
  constructor(private readonly afiliadosService: AfiliadosService) {}

  @Auth(Role.ADMIN)
  @Post()
  create(@Body() createPersonaDto: CreatePersonaDto): Promise<PersonaResponseDto> {
    return this.afiliadosService.create(createPersonaDto);
  }

  @Auth(Role.ADMIN)
  @Post('bulk')
  createBulk(
    @Body('data') data: any[],
    @Body('jacId') jacId: number,
  ): Promise<any> {
    return this.afiliadosService.createBulk(data, jacId);
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

  @Auth(Role.ADMIN)
  @Post(':id/cargo')
  assignCargo(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignCargoDto: AssignCargoDto,
  ): Promise<PersonaCargo> {
    return this.afiliadosService.assignCargo(id, assignCargoDto);
  }

  @Auth(Role.ADMIN)
  @Get(':id/cargos')
  findCargos(@Param('id', ParseIntPipe) id: number): Promise<PersonaCargo[]> {
    return this.afiliadosService.findCargos(id);
  }
}
