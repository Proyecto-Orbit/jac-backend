import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Persona } from './entities/persona.entity';
import { PersonaCargo } from './entities/persona-cargo.entity';
import { PersonaJAC } from './entities/persona-jac.entity';
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
    let saved!: Persona;

    await this.personaRepository.manager.transaction(async (manager) => {
      // 1. Guardar la persona en la tabla principal
      saved = await manager.save(persona);

      // 2. Si tiene JAC asignada, crear el registro histórico en PERSONA_JAC
      if (saved.jacId) {
        const personaJac = manager.create(PersonaJAC, {
          personaId: saved.id,
          jacId: saved.jacId,
          fechaInicio: new Date(),
        });
        await manager.save(personaJac);
      }

      // 3. Si tiene un Cargo asignado, crear el registro histórico en PERSONA_CARGO
      if (saved.cargoId) {
        const personaCargo = manager.create(PersonaCargo, {
          personaId: saved.id,
          cargoId: saved.cargoId,
          fechaInicio: new Date(),
          estadoId: 1, // 1 = Activo
        });
        await manager.save(personaCargo);
      }
    });

    const personaWithCargo = await this.personaRepository.findOne({
      where: { id: saved.id },
      relations: ['cargo'],
    });
    return PersonaResponseDto.fromEntity(personaWithCargo!);
  }

  async createBulk(data: any[], jacId: number): Promise<any> {
    const results = {
      total: data.length,
      creados: 0,
      actualizados: 0,
      errores: 0,
      advertencias: 0,
      detalles: [] as any[],
      validas: 0
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        await this.personaRepository.manager.transaction(async (manager) => {
          let persona: Persona | null = null;

          if (row.cedula) {
            persona = await manager.findOne(Persona, { where: { cedula: row.cedula } });
          } else if (row.nombre && row.apellido) {
            persona = await manager.findOne(Persona, { 
              where: { nombre: row.nombre, apellido: row.apellido } 
            });
          }

          if (persona) {
            // Actualizar campos vacíos
            const updateData: any = {};
            const campos = ['genero', 'grupoEtnico', 'fechaNacimiento', 'rangoEdad', 'ocupacion', 'direccion', 'estudiosRealizados', 'discapacitado', 'correo', 'telefono', 'lugarExpedicionCedula'];
            let hasUpdates = false;
            for (const campo of campos) {
              if (row[campo] !== undefined && row[campo] !== null && row[campo] !== '') {
                if (!persona[campo as keyof Persona]) {
                  updateData[campo] = row[campo];
                  hasUpdates = true;
                }
              }
            }

            // Manejar Cargo
            let cargoChanged = false;
            if (row.cargoId && persona.cargoId !== row.cargoId) {
                updateData.cargoId = row.cargoId;
                hasUpdates = true;
                cargoChanged = true;
            }

            // Manejar JAC
            let jacChanged = false;
            if (jacId && persona.jacId !== jacId) {
                updateData.jacId = jacId;
                hasUpdates = true;
                jacChanged = true;
            }

            if (hasUpdates) {
              await manager.update(Persona, { id: persona.id }, updateData);
              results.actualizados++;
              results.validas++;
            } else {
              results.advertencias++;
              results.detalles.push({ fila: i + 2, asocomunal: `${row.nombre} ${row.apellido}`, error: 'Ya existe y no hay campos nuevos' });
            }

            const hoy = new Date();

            if (cargoChanged) {
              if (persona.cargoId) {
                const activeCargoHistory = await manager.findOne(PersonaCargo, {
                  where: { personaId: persona.id, cargoId: persona.cargoId },
                  order: { fechaInicio: 'DESC' }
                });
                if (activeCargoHistory && !activeCargoHistory.fechaFin) {
                  activeCargoHistory.fechaFin = hoy;
                  activeCargoHistory.estadoId = 2;
                  await manager.save(activeCargoHistory);
                }
              }
              const newPersonaCargo = manager.create(PersonaCargo, {
                personaId: persona.id,
                cargoId: row.cargoId,
                fechaInicio: hoy,
                estadoId: 1,
              });
              await manager.save(newPersonaCargo);
            }

            if (jacChanged) {
              if (persona.jacId) {
                const activeJac = await manager.findOne(PersonaJAC, {
                  where: { personaId: persona.id, jacId: persona.jacId },
                  order: { fechaInicio: 'DESC' },
                });
                if (activeJac && !activeJac.fechaFin) {
                  activeJac.fechaFin = hoy;
                  await manager.save(activeJac);
                }
              }
              const personaJac = manager.create(PersonaJAC, {
                personaId: persona.id,
                jacId: jacId,
                fechaInicio: hoy,
              });
              await manager.save(personaJac);
            }

          } else {
            // Crear nueva persona
            const newPersonaData = { ...row, jacId };
            const nuevaPersona = manager.create(Persona, newPersonaData);
            const saved = await manager.save(nuevaPersona);

            if (jacId) {
              const personaJac = manager.create(PersonaJAC, {
                personaId: saved.id,
                jacId: jacId,
                fechaInicio: new Date(),
              });
              await manager.save(personaJac);
            }

            if (saved.cargoId) {
              const personaCargo = manager.create(PersonaCargo, {
                personaId: saved.id,
                cargoId: saved.cargoId,
                fechaInicio: new Date(),
                estadoId: 1,
              });
              await manager.save(personaCargo);
            }
            results.creados++;
            results.validas++;
          }
        });
      } catch (err: any) {
        results.errores++;
        results.detalles.push({ fila: i + 2, asocomunal: `${row.nombre || ''} ${row.apellido || ''}`, error: err.message });
      }
    }

    return results;
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
      Object.entries(updatePersonaDto).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updateData).length === 0) {
      return this.findOne(id);
    }

    await this.personaRepository.manager.transaction(async (manager) => {
      // 1. Obtener la persona actual para comparar
      const currentPersona = await manager.findOne(Persona, { where: { id } });
      if (!currentPersona) {
        throw new NotFoundException(`Afiliado con ID ${id} no encontrado`);
      }

      // 2. Revisar si el cargoId va a cambiar
      if (updateData.cargoId !== undefined && updateData.cargoId !== currentPersona.cargoId) {
        // Cerrar el cargo activo anterior (si tenía)
        if (currentPersona.cargoId) {
          // Buscamos el registro activo en PERSONA_CARGO (asumiendo que los que no tienen fecha_fin son los activos)
          const activeCargoHistory = await manager.findOne(PersonaCargo, {
            where: { personaId: id, cargoId: currentPersona.cargoId },
            order: { fechaInicio: 'DESC' }
          });
          
          if (activeCargoHistory && !activeCargoHistory.fechaFin) {
            activeCargoHistory.fechaFin = new Date();
            activeCargoHistory.estadoId = 2; // 2 = Inactivo, o lo que se maneje
            await manager.save(activeCargoHistory);
          }
        }

        // Crear el nuevo historial para el nuevo cargo (si no es nulo/vacío)
        if (updateData.cargoId) {
          const newPersonaCargo = manager.create(PersonaCargo, {
            personaId: id,
            cargoId: updateData.cargoId as number,
            fechaInicio: new Date(),
            estadoId: 1, // 1 = Activo
          });
          await manager.save(newPersonaCargo);
        }
      }

      // 3. Actualizar la tabla principal
      await manager.update(Persona, { id }, updateData);
    });

    // Recargar con relaciones para responder
    const personaWithCargo = await this.personaRepository.findOne({
      where: { id },
      relations: ['cargo'],
    });

    if (!personaWithCargo) {
      throw new NotFoundException(`Afiliado con ID ${id} no encontrado`);
    }

    return PersonaResponseDto.fromEntity(personaWithCargo);
  }

  async remove(id: number): Promise<{ message: string }> {
    const persona = await this.personaRepository.findOne({ where: { id } });

    if (!persona) {
      throw new NotFoundException(`Afiliado con ID ${id} no encontrado`);
    }

    // Concepto 2: Desvincular persona de su JAC y cargo actual.
    // La persona sigue existiendo en el sistema y puede unirse a otra JAC.
    await this.personaRepository.manager.transaction(async (manager) => {
      const hoy = new Date();

      // 1. Cerrar el cargo activo más reciente en el historial
      if (persona.cargoId) {
        const activeCargo = await manager.findOne(PersonaCargo, {
          where: { personaId: id, cargoId: persona.cargoId },
          order: { fechaInicio: 'DESC' },
        });
        if (activeCargo && !activeCargo.fechaFin) {
          activeCargo.fechaFin = hoy;
          activeCargo.estadoId = 2; // Inactivo
          await manager.save(activeCargo);
        }
      }

      // 2. Cerrar el registro de asociación con la JAC en el historial
      if (persona.jacId) {
        const activeJac = await manager.findOne(PersonaJAC, {
          where: { personaId: id, jacId: persona.jacId },
          order: { fechaInicio: 'DESC' },
        });
        if (activeJac && !activeJac.fechaFin) {
          activeJac.fechaFin = hoy;
          await manager.save(activeJac);
        }
      }

      // 3. Desvincular: quitar jacId y cargoId de la tabla principal
      //    La persona sigue en el sistema (activo = true) y puede unirse a otra JAC
      persona.jacId = null;
      persona.cargoId = null;
      await manager.save(persona);
    });

    return { message: `Afiliado "${persona.nombre} ${persona.apellido}" desvinculado de la JAC correctamente` };
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
