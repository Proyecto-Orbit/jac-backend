import { EstadoJAC, JAC, TipoJAC } from '../entities/jac.entity';
import { Persona } from '../../afiliados/entities/persona.entity';

export type EstadoDocumental = 'Vigente' | 'Vencida' | 'Por vencer';
export type EstadoOrganizativo = 'Activa' | 'Inactiva' | 'Cancelada';
export type EstadoAprobacion = 'Activo' | 'Pendiente' | 'Rechazado';
export type TipoJac = 'Barrio' | 'Vereda';
export type RolAfiliado =
  | 'Presidente'
  | 'Vicepresidente'
  | 'Secretario'
  | 'Tesorero'
  | 'Fiscal'
  | 'Afiliado';

/**
 * Mínimo legal de afiliados para que una JAC permanezca activa.
 * Equivale al 50 % del mínimo de constitución según la Ley 2166 de 2021 (Art. 11).
 */
export const MINIMO_AFILIADOS_BARRIO = 38;
export const MINIMO_AFILIADOS_VEREDA = 10;

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
  tipo!: TipoJac;
  /**
   * Mínimo legal de afiliados para sostener la JAC activa según su tipo.
   */
  minimoAfiliados!: number;
  /**
   * `true` cuando la JAC está activa y no alcanza el mínimo legal de afiliados.
   * Permite al frontend mostrar una alerta de riesgo.
   */
  enRiesgo!: boolean;
  miembros!: AfiliadoItemDto[];
  asocomunalId?: number | null;

  static fromEntity(jac: JAC): JacItemDto {
    const dto = new JacItemDto();
    dto.id = jac.id;
    dto.nombre = jac.nombreCompleto;
    dto.municipio = jac.asocomunal?.municipioNombre ?? '';
    dto.barrio = jac.nombreCorto ?? '';
    dto.asocomunalId = jac.asocomunalId;
    dto.documental = jac.numeroRUC ? 'Vigente' : 'Vencida';
    dto.organizativo = jac.estado === 'activa' ? 'Activa' : jac.estado === 'inactiva' ? 'Inactiva' : 'Cancelada';
    dto.aprobacion = 'Rechazado';
    dto.miembros = (jac.personas ?? []).map(AfiliadoItemDto.fromEntity);
    dto.afiliados = dto.miembros.length;

    const esVereda = jac.tipo === TipoJAC.VEREDA;
    dto.tipo = esVereda ? 'Vereda' : 'Barrio';
    dto.minimoAfiliados = esVereda ? MINIMO_AFILIADOS_VEREDA : MINIMO_AFILIADOS_BARRIO;
    dto.enRiesgo = jac.estado === EstadoJAC.ACTIVA && dto.afiliados < dto.minimoAfiliados;

    return dto;
  }

  static fromEntities(jacs: JAC[]): JacItemDto[] {
    return jacs.map(JacItemDto.fromEntity);
  }
}
