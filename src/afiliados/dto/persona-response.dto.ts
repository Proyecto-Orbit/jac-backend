import { Persona } from '../entities/persona.entity';

export class PersonaResponseDto {
  id!: number;
  cargoId!: number | null;
  municipioId!: number | null;
  jacId!: number | null;
  nombre!: string;
  apellido!: string;
  cedula!: string | null;
  lugarExpedicionCedula!: string | null;
  telefono!: string | null;
  correo!: string | null;

  static fromEntity(persona: Persona): PersonaResponseDto {
    return {
      id: persona.id,
      cargoId: persona.cargoId,
      municipioId: persona.municipioId,
      jacId: persona.jacId,
      nombre: persona.nombre,
      apellido: persona.apellido,
      cedula: persona.cedula,
      lugarExpedicionCedula: persona.lugarExpedicionCedula,
      telefono: persona.telefono,
      correo: persona.correo,
    };
  }

  static fromEntities(personas: Persona[]): PersonaResponseDto[] {
    return personas.map((p) => PersonaResponseDto.fromEntity(p));
  }
}
