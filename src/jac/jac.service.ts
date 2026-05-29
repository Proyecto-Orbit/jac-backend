import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoJAC, JAC, TipoJAC } from './entities/jac.entity';
import { CreateJACDto } from './dto/create-jac.dto';
import { UpdateJACDto } from './dto/update-jac.dto';
import { JACResponseDto } from './dto/jac-response.dto';
import { JacItemDto, JacListItemDto, JacPublicItemDto } from './dto/jac-item.dto';
import { SearchJACDto } from './dto/search-jac.dto';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { AsocomunalService } from '../asocomunal/asocomunal.service';
import { Persona } from '../afiliados/entities/persona.entity';

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
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly asocomunalService: AsocomunalService,
  ) {}

  /**
   * Crea una nueva JAC y notifica al microservicio de Asocomunales.
   *
   * @remarks
   * Toda JAC se crea con `estado = inactiva`. Solo se activa cuando
   * alcanza el mínimo legal de afiliados según la Ley 2166 de 2021,
   * Art. 11 (38 para barrio, 10 para vereda).
   *
   * @param createJACDto - Datos validados de la nueva JAC.
   * @returns La JAC recién creada como {@link JACResponseDto}.
   */
  async create(createJACDto: CreateJACDto): Promise<JACResponseDto> {
    const jac = this.jacRepository.create({
      ...createJACDto,
      estado: EstadoJAC.INACTIVA,
    });
    const saved = await this.jacRepository.save(jac);

    await this.rabbitMQService.notifyJACCreated({
      id: saved.id,
      nombre: saved.nombreCompleto,
      estado: String(saved.estado),
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
  async findAll(limite: number = 100): Promise<JacListItemDto[]> {
    const jacs = await this.jacRepository.find({
      where: { estado: EstadoJAC.ACTIVA },
      relations: ['asocomunal', 'personas'],
      order: { nombreCompleto: 'ASC' },
      take: limite,
    });
    return JacListItemDto.fromEntities(jacs);
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
  async search(filters: SearchJACDto): Promise<JacListItemDto[]> {
    const qb = this.jacRepository
      .createQueryBuilder('jac')
      .leftJoinAndSelect('jac.asocomunal', 'asocomunal')
      .leftJoinAndSelect('jac.personas', 'personas');

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

    if (filters.documental === 'Vigente') {
      qb.andWhere("jac.numero_ruc IS NOT NULL AND jac.numero_ruc <> ''");
    } else if (filters.documental === 'Vencida') {
      qb.andWhere("(jac.numero_ruc IS NULL OR jac.numero_ruc = '')");
    } else if (filters.documental === 'Por vencer') {
      // Categoría no producible desde los datos actuales: regresa lista vacía.
      qb.andWhere('1 = 0');
    }

    qb.orderBy('jac.nombreCompleto', 'ASC').take(filters.limite ?? 100);

    const jacs = await qb.getMany();
    return JacListItemDto.fromEntities(jacs);
  }

  /**
   * Actualiza los campos indicados de una JAC existente.
   *
   * @param id - Identificador de la JAC a actualizar.
   * @param updateJACDto - Campos a modificar (todos opcionales).
   * @returns La JAC actualizada como {@link JACResponseDto}.
   * @throws {NotFoundException} Si la JAC no existe.
   */
  async update(id: number, updateJACDto: UpdateJACDto): Promise<JacItemDto> {
    const jac = await this.jacRepository.findOne({ where: { id } });

    if (!jac) {
      throw new NotFoundException(`JAC con ID ${id} no encontrada`);
    }

    // Solo asignamos las propiedades del DTO que no sean undefined para evitar
    // sobrescribir valores existentes (como asocomunalId) con undefined.
    Object.keys(updateJACDto).forEach((key) => {
      const value = (updateJACDto as any)[key];
      if (value !== undefined) {
        (jac as any)[key] = value;
      }
    });
    await this.jacRepository.save(jac);

    await this.rabbitMQService.notifyJACUpdated({
      id: jac.id,
      nombre: jac.nombreCompleto,
      estado: String(jac.estado),
      asocomunalId: jac.asocomunalId,
    });

    // Recargar con relaciones para devolver el mismo formato que findOne()
    const updated = await this.jacRepository.findOne({
      where: { id },
      relations: ['asocomunal', 'personas', 'personas.cargo'],
    });

    return JacItemDto.fromEntity(updated!);
  }

  /**
   * Realiza la eliminación lógica de una JAC cambiando su `estado` a `cancelada`.
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

    jac.estado = EstadoJAC.CANCELADA;
    await this.jacRepository.save(jac);
    // Al cancelar la JAC, desvinculamos a sus afiliados (jac_id → null).
    // La persona sigue existiendo y puede afiliarse a otra JAC luego.
    await this.personaRepository.update({ jacId: jac.id }, { jacId: null });
    // Nota: notifyJACDeleted no necesita estado, ya que siempre es 'cancelada'
    await this.rabbitMQService.notifyJACDeleted(jac.id);

    this.logger.log(`JAC id=${id} desactivada`);
    return { message: `JAC "${jac.nombreCompleto}" desactivada correctamente` };
  }

  /**
   * Obtiene estadísticas agregadas y anónimas públicas para el Dashboard.
   *
   * @returns Un objeto con métricas consolidadas seguras.
   */
  async findAllPublic(limite: number = 100): Promise<JacListItemDto[]> {
    return this.findAll(limite);
  }

  async searchPublic(filters: SearchJACDto): Promise<JacListItemDto[]> {
    return this.search(filters);
  }

  async findOnePublic(id: number): Promise<JacPublicItemDto> {
    const jac = await this.jacRepository.findOne({
      where: { id },
      relations: ['asocomunal', 'personas'],
    });

    if (!jac) {
      throw new NotFoundException(`JAC con ID ${id} no encontrada`);
    }

    return JacPublicItemDto.fromEntity(jac);
  }

  async getPublicStats() {
    const activeJacsCount = await this.jacRepository.count({
      where: { estado: EstadoJAC.ACTIVA },
    });

    const totalJACS = await this.jacRepository.count();

    const rucCountResult = await this.jacRepository
      .createQueryBuilder('jac')
      .where('jac.estado = :estado', { estado: EstadoJAC.ACTIVA })
      .andWhere("jac.numero_ruc IS NOT NULL AND jac.numero_ruc <> ''")
      .getCount();

    const jacs = await this.jacRepository.find({
      where: { estado: EstadoJAC.ACTIVA },
      select: ['id', 'nombreCorto', 'tipo'],
    });
    console.log(
      jacs.slice(0, 20).map(j => ({
        nombre: j.nombreCorto,
        tipo: j.tipo,
        tipoReal: typeof j.tipo,
      })),
    );

    const urbanCount = jacs.filter(jac => jac.tipo === TipoJAC.BARRIO).length;
    const ruralCount = jacs.filter(jac => jac.tipo === TipoJAC.VEREDA).length;

    const asocomunales = await this.asocomunalService.findAll();
    const totalAsocomunales = asocomunales.length;

    const topMunicipios = await this.jacRepository
      .createQueryBuilder('jac')
      .innerJoin('jac.asocomunal', 'asocomunal')
      .select('asocomunal.municipio_nombre', 'municipio')
      .addSelect('COUNT(jac.id)', 'count')
      .where('jac.estado = :estado', { estado: EstadoJAC.ACTIVA })
      .groupBy('asocomunal.municipio_nombre')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      activeJacsCount,
      totalJACS,
      rucCount: rucCountResult,
      urbanCount,
      ruralCount,
      totalAsocomunales,
      topMunicipios: topMunicipios.map((item) => ({
        municipio: item.municipio || 'Otros',
        count: parseInt(item.count, 10),
      })),
    };
  }
}
