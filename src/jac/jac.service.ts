import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoJAC, JAC, TipoJAC } from './entities/jac.entity';
import { CreateJACDto } from './dto/create-jac.dto';
import { UpdateJACDto } from './dto/update-jac.dto';
import { JACResponseDto } from './dto/jac-response.dto';
import {
  EstadoOrganizativo,
  JacItemDto,
  JacListItemDto,
  JacPublicItemDto,
  MINIMO_AFILIADOS_BARRIO,
  MINIMO_AFILIADOS_VEREDA,
} from './dto/jac-item.dto';
import { SearchJACDto } from './dto/search-jac.dto';
import {
  AlertaJacItem,
  AlertasJacPage,
  AlertasQueryDto,
  AlertasResumen,
  ALERTAS_LIMIT_DEFAULT,
  ALERTAS_LIMIT_MAX,
  ALERTAS_PAGE_DEFAULT,
  CategoriaAlerta,
} from './dto/alertas.dto';
import { EstadosJacResumen } from './dto/estados-resumen.dto';
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
    // El número de personería jurídica es obligatorio al crear una JAC.
    // Se valida aquí (no con decoradores) porque la migración de datos
    // reales carga JACs sin este campo.
    if (
      !createJACDto.numeroPersoneriaJuridica ||
      createJACDto.numeroPersoneriaJuridica.trim() === ''
    ) {
      throw new BadRequestException(
        'El número de personería jurídica es obligatorio',
      );
    }

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

  /**
   * Resumen público de conteos de JAC por estado organizativo.
   *
   * @remarks
   * Cuenta TODAS las JAC (sin filtrar por estado) agrupando por `estado`.
   * No expone PII. Pensado para el dashboard público.
   *
   * @returns {@link EstadosJacResumen} con activa, inactiva, cancelada y total.
   */
  async getEstadosResumen(): Promise<EstadosJacResumen> {
    const rows = await this.jacRepository
      .createQueryBuilder('jac')
      .select('jac.estado', 'estado')
      .addSelect('COUNT(*)', 'count')
      .groupBy('jac.estado')
      .getRawMany<{ estado: string; count: string }>();

    const resumen: EstadosJacResumen = {
      activa: 0,
      inactiva: 0,
      cancelada: 0,
      total: 0,
    };

    for (const row of rows) {
      const cantidad = parseInt(row.count, 10) || 0;
      if (row.estado === EstadoJAC.ACTIVA) resumen.activa = cantidad;
      else if (row.estado === EstadoJAC.INACTIVA) resumen.inactiva = cantidad;
      else if (row.estado === EstadoJAC.CANCELADA) resumen.cancelada = cantidad;
    }

    resumen.total = resumen.activa + resumen.inactiva + resumen.cancelada;
    return resumen;
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

  // ───────────────────────────────────────────────────────────────────────
  //  Módulo de alertas
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Conteos agregados de alertas en una sola consulta.
   *
   * @remarks
   * El cómputo de "en riesgo" compara los afiliados de cada JAC contra su
   * mínimo según el tipo (`barrio` → {@link MINIMO_AFILIADOS_BARRIO},
   * `vereda` → {@link MINIMO_AFILIADOS_VEREDA}), resuelto con un `CASE` en SQL.
   *
   * @returns Objeto {@link AlertasResumen} con los seis contadores.
   */
  async getAlertasResumen(): Promise<AlertasResumen> {
    const rows = (await this.jacRepository.query(
      `SELECT
          COUNT(*)::int AS "totalJacs",
          COUNT(*) FILTER (WHERE sub.estado = 'activa'   AND sub.afiliados < sub.minimo)::int AS "riesgoActiva",
          COUNT(*) FILTER (WHERE sub.estado = 'inactiva' AND sub.afiliados < sub.minimo)::int AS "riesgoInactiva",
          COUNT(*) FILTER (WHERE sub.sin_ruc)::int AS "sinRuc",
          COUNT(*) FILTER (WHERE sub.sin_nit)::int AS "sinNit",
          COUNT(*) FILTER (WHERE sub.sin_ruc AND sub.sin_nit)::int AS "sinRucNit"
        FROM (
          SELECT
            j.estado,
            CASE WHEN j.tipo = $1 THEN $2::int ELSE $3::int END AS minimo,
            (SELECT COUNT(*) FROM "PERSONA" p WHERE p."JAC_id" = j.id)::int AS afiliados,
            (j.numero_ruc IS NULL OR j.numero_ruc = '') AS sin_ruc,
            (j.nit IS NULL OR j.nit = '') AS sin_nit
          FROM "JAC" j
        ) sub`,
      [TipoJAC.VEREDA, MINIMO_AFILIADOS_VEREDA, MINIMO_AFILIADOS_BARRIO],
    )) as Array<Record<string, number>>;

    const r = rows[0] ?? {};
    return {
      riesgoActiva: r.riesgoActiva ?? 0,
      riesgoInactiva: r.riesgoInactiva ?? 0,
      sinRuc: r.sinRuc ?? 0,
      sinNit: r.sinNit ?? 0,
      sinRucNit: r.sinRucNit ?? 0,
      totalJacs: r.totalJacs ?? 0,
    };
  }

  /**
   * Detalle paginado de una categoría de alerta.
   *
   * @remarks
   * - El filtro de categoría se aplica en SQL (no en memoria).
   * - `limit` se acota a {@link ALERTAS_LIMIT_MAX} para proteger el servidor.
   * - `busqueda` filtra por nombre de la JAC o municipio (ILIKE, insensible
   *   a mayúsculas).
   *
   * @param query - Parámetros validados de {@link AlertasQueryDto}.
   * @returns Página {@link AlertasJacPage}.
   */
  async getAlertas(query: AlertasQueryDto): Promise<AlertasJacPage> {
    const page = query.page && query.page > 0 ? query.page : ALERTAS_PAGE_DEFAULT;
    const limitSolicitado =
      query.limit && query.limit > 0 ? query.limit : ALERTAS_LIMIT_DEFAULT;
    const limit = Math.min(limitSolicitado, ALERTAS_LIMIT_MAX);
    const offset = (page - 1) * limit;

    // Condición de categoría (texto estático, sin entrada del usuario).
    const categoriaSql = this.construirFiltroCategoria(query.categoria);

    // Parámetros compartidos por la query de total y la de items.
    const baseParams: unknown[] = [
      TipoJAC.VEREDA,
      MINIMO_AFILIADOS_VEREDA,
      MINIMO_AFILIADOS_BARRIO,
    ];

    let busquedaSql = '';
    if (query.busqueda && query.busqueda.trim() !== '') {
      baseParams.push(`%${query.busqueda.trim()}%`);
      const idx = baseParams.length;
      busquedaSql = ` AND (j.nombre_completo ILIKE $${idx} OR a.municipio_nombre ILIKE $${idx})`;
    }

    // Subconsulta que materializa afiliados y mínimo por JAC, reutilizada por
    // la condición de categoría y el filtro de búsqueda.
    const fromSql = `
      FROM (
        SELECT jj.*,
          (SELECT COUNT(*) FROM "PERSONA" p WHERE p."JAC_id" = jj.id)::int AS afiliados,
          CASE WHEN jj.tipo = $1 THEN $2::int ELSE $3::int END AS minimo
        FROM "JAC" jj
      ) j
      LEFT JOIN "ASOCOMUNAL" a ON a.id = j.asocomunal_id
      WHERE ${categoriaSql}${busquedaSql}
    `;

    // 1) Total de la categoría (para la paginación).
    const totalRows = (await this.jacRepository.query(
      `SELECT COUNT(*)::int AS total ${fromSql}`,
      baseParams,
    )) as Array<{ total: number }>;
    const total = totalRows[0]?.total ?? 0;

    // 2) Página de items.
    const itemsParams = [...baseParams, limit, offset];
    const limIdx = itemsParams.length - 1;
    const offIdx = itemsParams.length;
    const rows = (await this.jacRepository.query(
      `SELECT
          j.id,
          j.nombre_completo AS nombre,
          COALESCE(a.municipio_nombre, '') AS municipio,
          COALESCE(j.nombre_corto, '') AS barrio,
          j.tipo,
          j.estado,
          j.numero_ruc AS "numeroRUC",
          j.nit,
          j.afiliados,
          j.minimo AS "minimoAfiliados"
        ${fromSql}
        ORDER BY j.nombre_completo ASC
        LIMIT $${limIdx} OFFSET $${offIdx}`,
      itemsParams,
    )) as Array<{
      id: number;
      nombre: string;
      municipio: string;
      barrio: string;
      tipo: string;
      estado: string;
      numeroRUC: string | null;
      nit: string | null;
      afiliados: number;
      minimoAfiliados: number;
    }>;

    const items: AlertaJacItem[] = rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      municipio: row.municipio,
      barrio: row.barrio,
      tipo: row.tipo === TipoJAC.VEREDA ? 'Vereda' : 'Barrio',
      afiliados: Number(row.afiliados),
      minimoAfiliados: Number(row.minimoAfiliados),
      estado: this.mapEstadoOrganizativo(row.estado),
      numeroRUC:
        row.numeroRUC && String(row.numeroRUC).trim() !== '' ? row.numeroRUC : null,
      nit: row.nit && String(row.nit).trim() !== '' ? row.nit : null,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  /**
   * Devuelve la condición SQL (sin parámetros) que define cada categoría.
   * El texto es estático y no incorpora entrada del usuario → libre de inyección.
   */
  private construirFiltroCategoria(categoria: CategoriaAlerta): string {
    switch (categoria) {
      case 'riesgo_activa':
        return `j.estado = 'activa' AND j.afiliados < j.minimo`;
      case 'riesgo_inactiva':
        return `j.estado = 'inactiva' AND j.afiliados < j.minimo`;
      case 'sin_ruc':
        return `(j.numero_ruc IS NULL OR j.numero_ruc = '')`;
      case 'sin_nit':
        return `(j.nit IS NULL OR j.nit = '')`;
      case 'sin_ruc_nit':
        return `(j.numero_ruc IS NULL OR j.numero_ruc = '') AND (j.nit IS NULL OR j.nit = '')`;
    }
  }

  /** Traduce el estado almacenado en BD a su forma legible. */
  private mapEstadoOrganizativo(estado: string): EstadoOrganizativo {
    if (estado === EstadoJAC.ACTIVA) return 'Activa';
    if (estado === EstadoJAC.INACTIVA) return 'Inactiva';
    return 'Cancelada';
  }
}
