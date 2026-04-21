/**
 * Controller de JAC - Endpoints HTTP
 * 
 * Define las rutas HTTP que el frontend puede consumir:
 * - POST /jac - Crear
 * - GET /jac - Listar
 * - GET /jac/:id - Obtener por ID
 * - PATCH /jac/:id - Actualizar
 * - DELETE /jac/:id - Eliminar (lógica)
 * 
 * @decorator @Controller('jac') - Prefijo de todas las rutas
 * @decorator @Post(), @Get(), @Patch(), @Delete() - Métodos HTTP
 */
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
import { JacService } from './jac.service';
import { CreateJACDto } from './dto/create-jac.dto';
import { UpdateJACDto } from './dto/update-jac.dto';
import { JACResponseDto } from './dto/jac-response.dto';
import { Auth } from '../auth/auth.decorator';
import { Role } from '../auth/role.enum';

@Controller('jac')
export class JacController {
  constructor(private readonly jacService: JacService) {}

  /**
   * POST /jac
   * Crear una nueva JAC
   */
  @Auth(Role.ADMIN)
  @Post()
  create(@Body() createJACDto: CreateJACDto): Promise<JACResponseDto> {
    return this.jacService.create(createJACDto);
  }

  /**
   * GET /jac
   * Listar todas las JACs activas
   */
  @Get()
  findAll(): Promise<JACResponseDto[]> {
    return this.jacService.findAll();
  }

  /**
   * GET /jac/:id
   * Obtener una JAC por ID
   */
  @Auth(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<JACResponseDto> {
    return this.jacService.findOne(id);
  }

  /**
   * PATCH /jac/:id
   * Actualizar una JAC
   */
  @Auth(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateJACDto: UpdateJACDto,
  ): Promise<JACResponseDto> {
    return this.jacService.update(id, updateJACDto);
  }

  /**
   * DELETE /jac/:id
   * Eliminación lógica de una JAC
   */
  @Auth(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.jacService.remove(id);
  }

  /**
   * POST /jac/:id/associate-asocomunal
   * Asociar JAC a una Asocomunal
   */
  @Auth(Role.ADMIN)
  @Post(':id/associate-asocomunal')
  associateAsocomunal(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { asocomunalId: number; usuarioId: string },
  ): Promise<JACResponseDto> {
    return this.jacService.associateAsocomunal(id, body.asocomunalId, body.usuarioId);
  }
}