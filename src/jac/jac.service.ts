import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoJAC, JAC } from './entities/jac.entity';
import { CreateJACDto } from './dto/create-jac.dto';
import { UpdateJACDto } from './dto/update-jac.dto';
import { JACResponseDto } from './dto/jac-response.dto';
import { JacItemDto } from './dto/jac-item.dto';
import { SearchJACDto } from './dto/search-jac.dto';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

/**
 * Servicio de negocio para la gestión de JACs.
 *
 * @remarks
 * Implementa CRUD completo más búsqueda filtrada.
 * Notifica al microservicio de Asocomunales vía RabbitMQ en cada
 * operación de escritura (create / update / remove).
 */
@Injectable()
export class JacService {
  private readonly logger = new Logger(JacService.name);

  constructor(
    @InjectRepository(JAC)
    private readonly jacRepository: Repository<JAC>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  /**
   * Crea una nueva JAC y notifica al microservicio de Asocomunales.
   *
   * @param createJACDto - Datos validados de la nueva JAC.
   * @returns La JAC recién creada como {@link JACResponseDto}.
   */
  async create(createJACDto: CreateJACDto): Promise<JACResponseDto> {
    const jac = this.jacRepository.create({
      ...createJACDto,
      estado: createJACDto.estado ?? EstadoJAC.ACTIVA,
    });
    const saved = await this.jacRepository.save(jac);

    await this.rabbitMQService.notifyJACCreated({
      id: saved.id,
      nombre: saved.nombreCompleto,
      asocomunalId: saved.asocomunalId,
    });

    return JACResponseDto.fromEntity(saved);
  }

  /**
   * Retorna todas las JACs **activas** ordenadas por nombre completo.
   *
   * @remarks
   * Incluye los datos de la Asocomunal vinculada cuando existe.
   *
   * @returns Array de {@link JACResponseDto}.
   */
  async findAll(limite: number = 100): Promise<JacItemDto[]> {
    const jacs = await this.jacRepository.find({
      where: { estado: EstadoJAC.ACTIVA },
      relations: ['asocomunal', 'personas', 'personas.cargo'],
      order: { nombreCompleto: 'ASC' },
      take: limite,
    });
    return JacItemDto.fromEntities(jacs);
  }

  /**
   * Recupera una JAC **activa** por su identificador.
   *
   * @param id - Identificador de la JAC.
   * @returns La JAC encontrada como {@link JACResponseDto}.
   * @throws {NotFoundException} Si no existe o su estado no es `activa`.
   */
  async findOne(id: number): Promise<JacItemDto> {
    const jac = await this.jacRepository.findOne({
      where: { id },
      relations: ['asocomunal', 'personas', 'personas.cargo'],
    });

    if (!jac) {
      throw new NotFoundException(`JAC con ID ${id} no encontrada`);
    }

    return JacItemDto.fromEntity(jac);
  }

  /**
   * Busca JACs aplicando filtros opcionales.
   *
   * @remarks
   * - `nombre`: LIKE parcial en `nombre_completo` y `nombre_corto`.
   * - `municipio`: LIKE parcial en `municipio_nombre` de la Asocomunal vinculada.
   *   Las JACs sin Asocomunal asignada no aparecerán al usar este filtro.
   * - `estado`: si se omite se retornan JACs en cualquier estado.
   *
   * @param filters - Criterios de búsqueda definidos en {@link SearchJACDto}.
   * @returns Array de {@link JACResponseDto} que coinciden con los filtros.
   */
  async search(filters: SearchJACDto): Promise<JacItemDto[]> {
    const qb = this.jacRepository
      .createQueryBuilder('jac')
      .leftJoinAndSelect('jac.asocomunal', 'asocomunal')
      .leftJoinAndSelect('jac.personas', 'personas')
      .leftJoinAndSelect('personas.cargo', 'cargo');

    if (filters.nombre) {
      const termino = `%${filters.nombre.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(jac.nombre_completo) LIKE :termino OR LOWER(jac.nombre_corto) LIKE :termino)',
        { termino },
      );
    }

    if (filters.municipio) {
      qb.andWhere('LOWER(asocomunal.municipio_nombre) LIKE :municipio', {
        municipio: `%${filters.municipio.toLowerCase()}%`,
      });
    }

    if (filters.estado) {
      qb.andWhere('jac.estado = :estado', { estado: filters.estado });
    }

    qb.orderBy('jac.nombreCompleto', 'ASC').take(filters.limite ?? 100);

    const jacs = await qb.getMany();
    return JacItemDto.fromEntities(jacs);
  }

  /**
   * Actualiza los campos indicados de una JAC existente.
   *
   * @param id - Identificador de la JAC a actualizar.
   * @param updateJACDto - Campos a modificar (todos opcionales).
   * @returns La JAC actualizada como {@link JACResponseDto}.
   * @throws {NotFoundException} Si la JAC no existe.
   */
  async update(id: number, updateJACDto: UpdateJACDto): Promise<JACResponseDto> {
    const jac = await this.jacRepository.findOne({ where: { id } });

    if (!jac) {
      throw new NotFoundException(`JAC con ID ${id} no encontrada`);
    }

    Object.assign(jac, updateJACDto);
    const updated = await this.jacRepository.save(jac);

    await this.rabbitMQService.notifyJACUpdated({
      id: updated.id,
      nombre: updated.nombreCompleto,
      asocomunalId: updated.asocomunalId,
    });

    return JACResponseDto.fromEntity(updated);
  }

  /**
   * Realiza la eliminación lógica de una JAC cambiando su `estado` a `inactiva`.
   *
   * @remarks
   * El registro no se borra de la base de datos para mantener historial.
   *
   * @param id - Identificador de la JAC a desactivar.
   * @returns Mensaje de confirmación.
   * @throws {NotFoundException} Si la JAC no existe.
   */
  async remove(id: number): Promise<{ message: string }> {
    const jac = await this.jacRepository.findOne({ where: { id } });

    if (!jac) {
      throw new NotFoundException(`JAC con ID ${id} no encontrada`);
    }

    jac.estado = EstadoJAC.INACTIVA;
    await this.jacRepository.save(jac);
    await this.rabbitMQService.notifyJACDeleted(jac.id);

    this.logger.log(`JAC id=${id} desactivada`);
    return { message: `JAC "${jac.nombreCompleto}" desactivada correctamente` };
  }
}
