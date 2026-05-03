import { EstadoJAC, JAC } from '../entities/jac.entity';
import { Persona } from '../../afiliados/entities/persona.entity';

export type EstadoDocumental = 'Vigente' | 'Vencida' | 'Por vencer';
export type EstadoOrganizativo = 'Activa' | 'Inactiva' | 'Cancelada';
export type EstadoAprobacion = 'Activo' | 'Pendiente' | 'Rechazado';
export type RolAfiliado =
  | 'Presidente'
  | 'Vicepresidente'
  | 'Secretario'
  | 'Tesorero'
  | 'Fiscal'
  | 'Afiliado';

export class AfiliadoItemDto {
  id!: number;
  nombre!: string;
  documento!: string;
  telefono!: string;
  rol!: RolAfiliado;

  static fromEntity(persona: Persona): AfiliadoItemDto {
    const dto = new AfiliadoItemDto();
    dto.id = persona.id;
    dto.nombre = `${persona.nombre} ${persona.apellido}`;
    dto.documento = persona.cedula ?? '';
    dto.telefono = persona.telefono ?? '';
    dto.rol = (persona.cargo?.nombre as RolAfiliado) ?? 'Afiliado';
    return dto;
  }
}

export class JacItemDto {
  id!: number;
  nombre!: string;
  municipio!: string;
  barrio!: string;
  afiliados!: number;
  documental!: EstadoDocumental;
  organizativo!: EstadoOrganizativo;
  aprobacion!: EstadoAprobacion;
  miembros!: AfiliadoItemDto[];

  static fromEntity(jac: JAC): JacItemDto {
    const dto = new JacItemDto();
    dto.id = jac.id;
    dto.nombre = jac.nombreCompleto;
    dto.municipio = jac.asocomunal?.municipioNombre ?? '';
    dto.barrio = jac.nombreCorto ?? '';
    dto.documental = jac.numeroRUC ? 'Vigente' : 'Vencida';
    dto.organizativo = jac.estado === 'activa' ? 'Activa' : jac.estado === 'inactiva' ? 'Inactiva' : 'Cancelada';
    dto.aprobacion = 'Rechazado';
    dto.miembros = (jac.personas ?? []).map(AfiliadoItemDto.fromEntity);
    dto.afiliados = dto.miembros.length;
    return dto;
  }

  static fromEntities(jacs: JAC[]): JacItemDto[] {
    return jacs.map(JacItemDto.fromEntity);
  }
}
