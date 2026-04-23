import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JAC } from './entities/jac.entity';
import { CreateJACDto } from './dto/create-jac.dto';
import { UpdateJACDto } from './dto/update-jac.dto';
import { JACResponseDto } from './dto/jac-response.dto';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

const ESTADO_ACTIVA = 1;
const ESTADO_INACTIVA = 2;

@Injectable()
export class JacService {
  constructor(
    @InjectRepository(JAC)
    private readonly jacRepository: Repository<JAC>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async create(createJACDto: CreateJACDto): Promise<JACResponseDto> {
    const jac = this.jacRepository.create({
      ...createJACDto,
      estadoId: createJACDto.estadoId ?? ESTADO_ACTIVA,
    });
    const savedJac = await this.jacRepository.save(jac);

    await this.rabbitMQService.notifyJACCreated({
      id: savedJac.id,
      nombre: savedJac.nombreCompleto,
      asocomunalId: null,
    });

    return JACResponseDto.fromEntity(savedJac);
  }

  async findAll(): Promise<JACResponseDto[]> {
    const jacs = await this.jacRepository.find({
      where: { estadoId: ESTADO_ACTIVA },
      order: { nombreCompleto: 'ASC' },
    });
    return JACResponseDto.fromEntities(jacs);
  }

  async findOne(id: number): Promise<JACResponseDto> {
    const jac = await this.jacRepository.findOne({
      where: { id, estadoId: ESTADO_ACTIVA },
    });

    if (!jac) {
      throw new NotFoundException(`JAC con ID ${id} no encontrada`);
    }

    return JACResponseDto.fromEntity(jac);
  }

  async update(id: number, updateJACDto: UpdateJACDto): Promise<JACResponseDto> {
    const jac = await this.jacRepository.findOne({ where: { id } });

    if (!jac) {
      throw new NotFoundException(`JAC con ID ${id} no encontrada`);
    }

    Object.assign(jac, updateJACDto);
    const updatedJac = await this.jacRepository.save(jac);

    await this.rabbitMQService.notifyJACUpdated({
      id: updatedJac.id,
      nombre: updatedJac.nombreCompleto,
      asocomunalId: null,
    });

    return JACResponseDto.fromEntity(updatedJac);
  }

  async remove(id: number): Promise<{ message: string }> {
    const jac = await this.jacRepository.findOne({ where: { id } });

    if (!jac) {
      throw new NotFoundException(`JAC con ID ${id} no encontrada`);
    }

    jac.estadoId = ESTADO_INACTIVA;
    await this.jacRepository.save(jac);

    await this.rabbitMQService.notifyJACDeleted(jac.id);

    return { message: `JAC "${jac.nombreCompleto}" desactivada correctamente` };
  }
}
