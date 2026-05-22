import { Persona } from '../entities/persona.entity';

export class PersonaResponseDto {
  id!: number;
  cargoId!: number | null;
  rol!: string | null; // Nombre del cargo
  municipioId!: number | null;
  jacId!: number | null;
  nombre!: string;
  apellido!: string;
  cedula!: string | null;
  lugarExpedicionCedula!: string | null;
  telefono!: string | null;
  correo!: string | null;
  documento!: string | null; // Alias para cedula

  static fromEntity(persona: Persona): PersonaResponseDto {
    return {
      id: persona.id,
      cargoId: persona.cargoId,
      rol: persona.cargo?.nombre || 'Afiliado', // Nombre del cargo o "Afiliado" por defecto
      municipioId: persona.municipioId,
      jacId: persona.jacId,
      nombre: persona.nombre,
      apellido: persona.apellido,
      cedula: persona.cedula,
      lugarExpedicionCedula: persona.lugarExpedicionCedula,
      telefono: persona.telefono,
      correo: persona.correo,
      documento: persona.cedula || null, // Alias para que el frontend use documento
    };
  }

  static fromEntities(personas: Persona[]): PersonaResponseDto[] {
    return personas.map((p) => PersonaResponseDto.fromEntity(p));
  }
}
