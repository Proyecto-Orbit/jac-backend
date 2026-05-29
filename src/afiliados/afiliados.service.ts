import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Persona } from './entities/persona.entity';
import { Cargo } from './entities/cargo.entity';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import { PersonaResponseDto } from './dto/persona-response.dto';

/**
 * Servicio CRUD de afiliados (Personas).
 *
 * @remarks
 * La relación con JAC y Cargo es 1-N directa vía `persona.jacId` y
 * `persona.cargoId`. NO se mantiene historial en tablas intermedias —
 * cualquier cambio sobrescribe el valor actual.
 */
@Injectable()
export class AfiliadosService {
  constructor(
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    @InjectRepository(Cargo)
    private readonly cargoRepository: Repository<Cargo>,
  ) {}

  async create(createPersonaDto: CreatePersonaDto): Promise<PersonaResponseDto> {
    const persona = this.personaRepository.create(createPersonaDto);
    const saved = await this.personaRepository.save(persona);
    const personaWithCargo = await this.personaRepository.findOne({
      where: { id: saved.id },
      relations: ['cargo'],
    });
    return PersonaResponseDto.fromEntity(personaWithCargo!);
  }

  async findAll(): Promise<PersonaResponseDto[]> {
    const personas = await this.personaRepository.find({
      relations: ['cargo'],
      order: { apellido: 'ASC', nombre: 'ASC' },
    });
    return PersonaResponseDto.fromEntities(personas);
  }

  async findOne(id: number): Promise<PersonaResponseDto> {
    const persona = await this.personaRepository.findOne({
      where: { id },
      relations: ['cargo'],
    });

    if (!persona) {
      throw new NotFoundException(`Afiliado con ID ${id} no encontrado`);
    }

    return PersonaResponseDto.fromEntity(persona);
  }

  async update(id: number, updatePersonaDto: UpdatePersonaDto): Promise<PersonaResponseDto> {
    // Filtrar solo los campos definidos (no undefined)
    const updateData = Object.fromEntries(
      Object.entries(updatePersonaDto).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updateData).length === 0) {
      return this.findOne(id);
    }

    const persona = await this.personaRepository.findOne({ where: { id } });
    if (!persona) {
      throw new NotFoundException(`Afiliado con ID ${id} no encontrado`);
    }

    await this.personaRepository.update({ id }, updateData);

    const personaWithCargo = await this.personaRepository.findOne({
      where: { id },
      relations: ['cargo'],
    });
    return PersonaResponseDto.fromEntity(personaWithCargo!);
  }

  /**
   * Desvincula a la persona de su JAC y cargo actuales.
   * No elimina el registro: la persona permanece en BD pero queda
   * disponible para una nueva afiliación posterior.
   */
  async remove(id: number): Promise<{ message: string }> {
    const persona = await this.personaRepository.findOne({ where: { id } });

    if (!persona) {
      throw new NotFoundException(`Afiliado con ID ${id} no encontrado`);
    }

    persona.jacId = null;
    persona.cargoId = null;
    await this.personaRepository.save(persona);

    return {
      message: `Afiliado "${persona.nombre} ${persona.apellido}" desvinculado de la JAC correctamente`,
    };
  }

  async findAllCargos(): Promise<Cargo[]> {
    return this.cargoRepository.find({
      order: { nombre: 'ASC' },
    });
  }
}
