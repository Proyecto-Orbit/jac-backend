import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Persona } from './entities/persona.entity';
import { PersonaCargo } from './entities/persona-cargo.entity';
import { Cargo } from './entities/cargo.entity';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import { AssignCargoDto } from './dto/assign-cargo.dto';
import { PersonaResponseDto } from './dto/persona-response.dto';

@Injectable()
export class AfiliadosService {
  constructor(
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    @InjectRepository(PersonaCargo)
    private readonly personaCargoRepository: Repository<PersonaCargo>,
    @InjectRepository(Cargo)
    private readonly cargoRepository: Repository<Cargo>,
  ) {}

  async create(createPersonaDto: CreatePersonaDto): Promise<PersonaResponseDto> {
    const persona = this.personaRepository.create(createPersonaDto);
    const saved = await this.personaRepository.save(persona);
    // Cargar relación cargo después de guardar
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
    const persona = await this.personaRepository.findOne({
      where: { id },
      relations: ['cargo'],
    });

    if (!persona) {
      throw new NotFoundException(`Afiliado con ID ${id} no encontrado`);
    }

    Object.assign(persona, updatePersonaDto);
    const updated = await this.personaRepository.save(persona);
    // Recargar para obtener relación actualizada
    const personaWithCargo = await this.personaRepository.findOne({
      where: { id: updated.id },
      relations: ['cargo'],
    });
    return PersonaResponseDto.fromEntity(personaWithCargo!);
  }

  async remove(id: number): Promise<{ message: string }> {
    const persona = await this.personaRepository.findOne({ where: { id } });

    if (!persona) {
      throw new NotFoundException(`Afiliado con ID ${id} no encontrado`);
    }

    await this.personaRepository.remove(persona);
    return { message: `Afiliado "${persona.nombre} ${persona.apellido}" eliminado correctamente` };
  }

  async assignCargo(id: number, assignCargoDto: AssignCargoDto): Promise<PersonaCargo> {
    const persona = await this.personaRepository.findOne({ where: { id } });

    if (!persona) {
      throw new NotFoundException(`Afiliado con ID ${id} no encontrado`);
    }

    const personaCargo = this.personaCargoRepository.create({
      personaId: id,
      cargoId: assignCargoDto.cargoId,
      fechaInicio: assignCargoDto.fechaInicio ? new Date(assignCargoDto.fechaInicio) : null,
      fechaFin: assignCargoDto.fechaFin ? new Date(assignCargoDto.fechaFin) : null,
      estadoId: 1,
    });

    return this.personaCargoRepository.save(personaCargo);
  }

  async findCargos(id: number): Promise<PersonaCargo[]> {
    const persona = await this.personaRepository.findOne({ where: { id } });

    if (!persona) {
      throw new NotFoundException(`Afiliado con ID ${id} no encontrado`);
    }

    return this.personaCargoRepository.find({
      where: { personaId: id },
      relations: ['cargo'],
      order: { fechaInicio: 'DESC' },
    });
  }

  async findAllCargos(): Promise<Cargo[]> {
    return this.cargoRepository.find({
      order: { nombre: 'ASC' },
    });
  }
}
