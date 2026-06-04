import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { JacService } from './jac.service';
import { CreateJACDto } from './dto/create-jac.dto';
import { UpdateJACDto } from './dto/update-jac.dto';
import { SearchJACDto } from './dto/search-jac.dto';
import { JACResponseDto } from './dto/jac-response.dto';
import { JacItemDto, JacListItemDto, JacPublicItemDto } from './dto/jac-item.dto';
import {
  AlertasJacPage,
  AlertasQueryDto,
  AlertasResumen,
} from './dto/alertas.dto';
import { EstadosJacResumen } from './dto/estados-resumen.dto';
import { Auth } from '../auth/auth.decorator';
import { Role } from '../auth/role.enum';

/**
 * Controlador HTTP para el recurso JAC.
 *
 * @remarks
 * Todos los endpoints requieren que la cookie `rol` contenga un rol
 * autorizado (actualmente `admin`). Los roles pueden ajustarse en el
 * decorador {@link Auth} de cada método.
 *
 * Base URL: `/jac`
 */
@Controller('jac')
export class JacController {
  constructor(private readonly jacService: JacService) { }

  /**
   * `POST /jac`
   *
   * Crea una nueva JAC.
   *
   * @param createJACDto - Cuerpo de la petición con los datos de la JAC.
   * @returns La JAC creada.
   */
  @Auth(Role.ADMIN)
  @Post()
  create(@Body() createJACDto: CreateJACDto): Promise<JACResponseDto> {
    return this.jacService.create(createJACDto);
  }

  /**
   * `GET /jac/public/stats`
   *
   * Retorna estadísticas consolidadas públicas y anónimas de JACs.
   * Este endpoint es público y accesible por usuarios invitados.
   */
  @Get('public/stats')
async getPublicStats() {
  const stats = await this.jacService.getPublicStats();

  console.log(
    '📊 Public Stats Response:',
    JSON.stringify(stats, null, 2)
  );

  return stats;
}

  /**
   * `GET /jac/public/estados/resumen`
   *
   * Resumen público de conteos de JAC por estado organizativo
   * (activa, inactiva, cancelada y total). Sin PII y sin token.
   */
  @Get('public/estados/resumen')
  getEstadosResumen(): Promise<EstadosJacResumen> {
    return this.jacService.getEstadosResumen();
  }

  /**
   * `GET /jac/public/buscar`
   *
   * Búsqueda de JACs con datos públicos (sin PII).
   */
  @Get('public/buscar')
  searchPublic(@Query() filters: SearchJACDto): Promise<JacListItemDto[]> {
    return this.jacService.searchPublic(filters);
  }

  /**
   * `GET /jac/public`
   *
   * Lista JACs activas con datos públicos (sin PII).
   */
  @Get('public')
  findAllPublic(
    @Query('limite', new DefaultValuePipe(100), ParseIntPipe) limite: number,
  ): Promise<JacListItemDto[]> {
    return this.jacService.findAllPublic(limite);
  }

  /**
   * `GET /jac/public/:id`
   *
   * Detalle de una JAC sin miembros ni RUC.
   */
  @Get('public/:id')
  findOnePublic(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<JacPublicItemDto> {
    return this.jacService.findOnePublic(id);
  }

  /**
   * `GET /jac`
   *
   * Lista todas las JACs activas ordenadas por nombre completo.
   * Incluye datos de la Asocomunal vinculada cuando existe.
   *
   * @returns Array de JACs activas.
   */
  @Auth(Role.ADMIN, Role.OPERADOR)
  @Get()
  findAll(
    @Query('limite', new DefaultValuePipe(100), ParseIntPipe) limite: number,
  ): Promise<JacListItemDto[]> {
    return this.jacService.findAll(limite);
  }

  /**
   * `GET /jac/buscar`
   *
   * Busca JACs con filtros opcionales de nombre, municipio y estado.
   *
   * @param filters - Query params definidos en {@link SearchJACDto}.
   * @returns Array de JACs que coinciden con los filtros aplicados.
   *
   * @example
   * GET /jac/buscar?nombre=el+pino&estado=activa
   * GET /jac/buscar?municipio=bogot%C3%A1
   */
  @Auth(Role.ADMIN, Role.OPERADOR)
  @Get('buscar')
  search(@Query() filters: SearchJACDto): Promise<JacListItemDto[]> {
    return this.jacService.search(filters);
  }

  /**
   * `GET /jac/alertas/resumen`
   *
   * Conteos agregados de alertas (JACs en riesgo, sin RUC, sin NIT, etc.).
   * Una sola consulta agregada; sin parámetros.
   */
  @Auth(Role.ADMIN, Role.OPERADOR)
  @Get('alertas/resumen')
  getAlertasResumen(): Promise<AlertasResumen> {
    return this.jacService.getAlertasResumen();
  }

  /**
   * `GET /jac/alertas`
   *
   * Detalle paginado de una categoría de alerta.
   *
   * @param query - `categoria` (requerido), `page`, `limit`, `busqueda`.
   * @returns Página de JACs que cumplen la categoría.
   *
   * @example
   * GET /jac/alertas?categoria=riesgo_activa&page=1&limit=10
   * GET /jac/alertas?categoria=sin_nit&busqueda=popay%C3%A1n
   */
  @Auth(Role.ADMIN, Role.OPERADOR)
  @Get('alertas')
  getAlertas(@Query() query: AlertasQueryDto): Promise<AlertasJacPage> {
    return this.jacService.getAlertas(query);
  }

  /**
   * `GET /jac/:id`
   *
   * Retorna una JAC activa por su identificador.
   *
   * @param id - ID de la JAC (entero positivo).
   * @returns La JAC encontrada con datos de su Asocomunal.
   */
  @Auth(Role.ADMIN, Role.OPERADOR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<JacItemDto> {
    return this.jacService.findOne(id);
  }

  /**
   * `PATCH /jac/:id`
   *
   * Actualiza los campos enviados de una JAC existente.
   *
   * @param id - ID de la JAC a actualizar.
   * @param updateJACDto - Campos a modificar (todos opcionales).
   * @returns La JAC con los datos actualizados.
   */
  @Auth(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateJACDto: UpdateJACDto,
  ): Promise<JacItemDto> {
    return this.jacService.update(id, updateJACDto);
  }

  /**
   * `DELETE /jac/:id`
   *
   * Realiza la eliminación lógica de una JAC (cambia su estado a inactiva).
   * El registro permanece en la base de datos para mantener el historial.
   *
   * @param id - ID de la JAC a desactivar.
   * @returns Mensaje de confirmación.
   */
  @Auth(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.jacService.remove(id);
  }
}
