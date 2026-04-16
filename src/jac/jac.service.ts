/**
 * Servicio de JAC - Lógica de Negocio
 * 
 * Este servicio contiene toda la lógica para operar con JACs:
 * - Crear, leer, actualizar, eliminar (CRUD)
 * - Notificar a Asocomunales vía RabbitMQ
 * - Validaciones de negocio
 * 
 * Principios SOLID aplicados:
 * - Single Responsibility: Solo maneja lógica de JACs
 * - Dependency Inversion: Depende de abstracciones (Repository, RabbitMQService)
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JAC } from './entities/jac.entity';
import { CreateJACDto } from './dto/create-jac.dto';
import { UpdateJACDto } from './dto/update-jac.dto';
import { JACResponseDto } from './dto/jac-response.dto';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class JacService {
  constructor(
    @InjectRepository(JAC)
    private readonly jacRepository: Repository<JAC>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  /**
   * Crear una nueva JAC
   * 
   * @param createJACDto - Datos de la JAC desde el frontend
   * @returns JAC creada con ID generado
   */
  async create(createJACDto: CreateJACDto): Promise<JACResponseDto> {
    // 1. Crear entidad desde el DTO
    const jac = this.jacRepository.create(createJACDto);
    
    // 2. Guardar en la base de datos
    const savedJac = await this.jacRepository.save(jac);
    
    // 3. Notificar a Asocomunales (asíncrono, no bloquea)
    await this.rabbitMQService.notifyJACCreated({
      id: savedJac.id,
      nombre: savedJac.nombreCompletoJunta,
      asocomunalId: savedJac.asocomunalId,
    });
    
    // 4. Retornar DTO de respuesta
    return JACResponseDto.fromEntity(savedJac);
  }

  /**
   * Listar todas las JACs
   * 
   * @returns Array de JACs activas ordenadas por municipio
   */
  async findAll(): Promise<JACResponseDto[]> {
    const jacs = await this.jacRepository.find({
      where: { ACTIVA: 'SI' }, // Solo activas por defecto
      order: { MUNICIPIO: 'ASC', nombreCompletoJunta: 'ASC' },
    });
    
    return JACResponseDto.fromEntities(jacs);
  }

  /**
   * Obtener una JAC por ID
   * 
   * @param id - ID de la JAC
   * @returns JAC encontrada
   * @throws NotFoundException si no existe
   */
  async findOne(id: number): Promise<JACResponseDto> {
    const jac = await this.jacRepository.findOne({
      where: { id, ACTIVA: 'SI' },
    });

    if (!jac) {
      throw new NotFoundException(`JAC con ID ${id} no encontrada`);
    }

    return JACResponseDto.fromEntity(jac);
  }

  /**
   * Actualizar una JAC
   * 
   * @param id - ID de la JAC
   * @param updateJACDto - Campos a actualizar
   * @returns JAC actualizada
   */
  async update(id: number, updateJACDto: UpdateJACDto): Promise<JACResponseDto> {
    // 1. Buscar la JAC existente
    const jac = await this.jacRepository.findOne({ where: { id } });

    if (!jac) {
      throw new NotFoundException(`JAC con ID ${id} no encontrada`);
    }
    
    // 2. Actualizar solo los campos proporcionados
    Object.assign(jac, updateJACDto);
    
    // 3. Guardar cambios
    const updatedJac = await this.jacRepository.save(jac);
    
    // 4. Notificar a Asocomunales
    await this.rabbitMQService.notifyJACUpdated({
      id: updatedJac.id,
      nombre: updatedJac.nombreCompletoJunta,
      asocomunalId: updatedJac.asocomunalId,
    });
    
    return JACResponseDto.fromEntity(updatedJac);
  }

  /**
   * Eliminación lógica de una JAC
   * 
   * No borra el registro, solo cambia ACTIVA a 'NO'
   * Esto permite mantener historial (RF11)
   * 
   * @param id - ID de la JAC
   * @returns Mensaje de confirmación
   */
  async remove(id: number): Promise<{ message: string }> {
    const jac = await this.jacRepository.findOne({ where: { id } });
    
    if (!jac) {
      throw new NotFoundException(`JAC con ID ${id} no encontrada`);
    }
    
    // Eliminación lógica
    jac.ACTIVA = 'NO';
    jac.actualizadoPor = 'system';
    jac.updatedAt = new Date();
    
    await this.jacRepository.save(jac);
    
    // Notificar a Asocomunales
    await this.rabbitMQService.notifyJACDeleted(jac.id);
    
    return { 
      message: `JAC "${jac.nombreCompletoJunta}" desactivada correctamente` 
    };
  }

  /**
   * Asociar JAC a una Asocomunal
   * 
   * @param jacId - ID de la JAC
   * @param asocomunalId - ID de la Asocomunal
   * @param usuarioId - ID del usuario que realiza la asociación
   * @returns JAC actualizada
   */
  async associateAsocomunal(
    jacId: number,
    asocomunalId: number,
    usuarioId: string,
  ): Promise<JACResponseDto> {
    const jac = await this.jacRepository.findOne({ where: { id: jacId } });
    
    if (!jac) {
      throw new NotFoundException(`JAC con ID ${jacId} no encontrada`);
    }

    jac.asociarAsocomunal(asocomunalId, usuarioId);
    const updatedJac = await this.jacRepository.save(jac);
    
    // Notificar cambio de asociación
    await this.rabbitMQService.notifyJACUpdated({
      id: updatedJac.id,
      nombre: updatedJac.nombreCompletoJunta,
      asocomunalId: updatedJac.asocomunalId,
    });
    
    return JACResponseDto.fromEntity(updatedJac);
  }
}