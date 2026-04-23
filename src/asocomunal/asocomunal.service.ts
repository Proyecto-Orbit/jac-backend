import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asocomunal } from './entities/asocomunal.entity';

/**
 * Datos recibidos del microservicio de Asocomunales vía RabbitMQ.
 */
export interface AsocomunalEventPayload {
  /** Identificador del registro en el sistema origen. */
  id: number;
  /** Nombre oficial de la Asocomunal. */
  nombre: string;
  /** ID del municipio asociado. */
  municipioId: number;
  /** Nombre del municipio asociado. */
  municipioNombre: string;
  /** Estado activo/inactivo en el sistema origen. */
  estado: boolean;
}

/**
 * Servicio interno para la réplica de Asocomunales.
 *
 * @remarks
 * Solo debe ser invocado por los consumidores de RabbitMQ.
 * No expone ningún endpoint HTTP.
 */
@Injectable()
export class AsocomunalService {
  private readonly logger = new Logger(AsocomunalService.name);

  constructor(
    @InjectRepository(Asocomunal)
    private readonly asocomunalRepository: Repository<Asocomunal>,
  ) {}

  /**
   * Crea o actualiza una Asocomunal a partir de un evento del microservicio.
   *
   * @remarks
   * Utiliza `save()` de TypeORM con la PK explícita, lo que ejecuta un
   * INSERT … ON CONFLICT DO UPDATE de forma transparente.
   *
   * @param payload - Datos del evento RabbitMQ.
   * @returns La entidad persistida.
   */
  async upsert(payload: AsocomunalEventPayload): Promise<Asocomunal> {
    this.logger.log(`Upsert Asocomunal id=${payload.id} — "${payload.nombre}"`);
    const entity = this.asocomunalRepository.create(payload);
    return this.asocomunalRepository.save(entity);
  }

  /**
   * Elimina la réplica local de una Asocomunal.
   *
   * @param id - Identificador de la Asocomunal a eliminar.
   * @throws {NotFoundException} Si no existe un registro con ese ID.
   */
  async remove(id: number): Promise<void> {
    const entity = await this.asocomunalRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Asocomunal con ID ${id} no encontrada en la réplica local`);
    }
    await this.asocomunalRepository.remove(entity);
    this.logger.log(`Asocomunal id=${id} eliminada de la réplica local`);
  }

  /**
   * Retorna todas las Asocomunales almacenadas en la réplica local.
   *
   * @returns Array de entidades {@link Asocomunal}.
   */
  async findAll(): Promise<Asocomunal[]> {
    return this.asocomunalRepository.find({ order: { nombre: 'ASC' } });
  }
}
