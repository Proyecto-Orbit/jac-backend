import { EstadoJAC, JAC, TipoJAC } from '../entities/jac.entity';
import { Persona } from '../../afiliados/entities/persona.entity';

export type EstadoDocumental = 'Vigente' | 'Vencida' | 'Por vencer';
export type EstadoOrganizativo = 'Activa' | 'Inactiva' | 'Cancelada';
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

/**
 * Vista ligera para listados (`GET /jac` y `GET /jac/buscar`).
 *
 * @remarks
 * Contiene solo lo que la tabla principal necesita renderizar. Los filtros
 * `documental`, `municipio` y `estado` ya se aplican en backend, por lo que
 * no es necesario exponerlos aquí.
 */
export class JacListItemDto {
  id!: number;
  nombre!: string;
  municipio!: string;
  barrio!: string;
  afiliados!: number;
  organizativo!: EstadoOrganizativo;

  static fromEntity(jac: JAC): JacListItemDto {
    const dto = new JacListItemDto();
    dto.id = jac.id;
    dto.nombre = jac.nombreCompleto;
    dto.municipio = jac.asocomunal?.municipioNombre ?? '';
    dto.barrio = jac.nombreCorto ?? '';
    dto.afiliados = jac.personas?.length ?? 0;
    dto.organizativo = jac.estado === 'activa' ? 'Activa' : jac.estado === 'inactiva' ? 'Inactiva' : 'Cancelada';
    return dto;
  }

  static fromEntities(jacs: JAC[]): JacListItemDto[] {
    return jacs.map((jac) => JacListItemDto.fromEntity(jac));
  }
}

/**
 * Vista de detalle (`GET /jac/:id`) con miembros, tipo y reglas de negocio aplicadas.
 */
export class JacItemDto {
  id!: number;
  nombre!: string;
  municipio!: string;
  barrio!: string;
  afiliados!: number;
  documental!: EstadoDocumental;
  organizativo!: EstadoOrganizativo;
  tipo!: TipoJac;
  /** Número de RUC tal como está en BD; `null` cuando la JAC no lo tiene registrado. */
  numeroRuc!: string | null;
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

  static fromEntity(jac: JAC): JacItemDto {
    const dto = new JacItemDto();
    dto.id = jac.id;
    dto.nombre = jac.nombreCompleto;
    dto.municipio = jac.asocomunal?.municipioNombre ?? '';
    dto.barrio = jac.nombreCorto ?? '';
    dto.numeroRuc = jac.numeroRUC && jac.numeroRUC.trim() !== '' ? jac.numeroRUC : null;
    dto.documental = dto.numeroRuc ? 'Vigente' : 'Vencida';
    dto.organizativo = jac.estado === 'activa' ? 'Activa' : jac.estado === 'inactiva' ? 'Inactiva' : 'Cancelada';
    dto.miembros = (jac.personas ?? []).map((persona) => AfiliadoItemDto.fromEntity(persona));
    dto.afiliados = dto.miembros.length;

    const esVereda = jac.tipo === TipoJAC.VEREDA;
    dto.tipo = esVereda ? 'Vereda' : 'Barrio';
    dto.minimoAfiliados = esVereda ? MINIMO_AFILIADOS_VEREDA : MINIMO_AFILIADOS_BARRIO;
    dto.enRiesgo = jac.estado === EstadoJAC.ACTIVA && dto.afiliados < dto.minimoAfiliados;

    return dto;
  }

  static fromEntities(jacs: JAC[]): JacItemDto[] {
    return jacs.map((jac) => JacItemDto.fromEntity(jac));
  }
}
