import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  EstadoOrganizativo,
  TipoJac,
} from './jac-item.dto';

/**
 * Categorías de alerta soportadas por `GET /jac/alertas`.
 *
 * - `riesgo_activa`   — JAC activa con afiliados por debajo del mínimo.
 * - `riesgo_inactiva` — JAC inactiva con afiliados por debajo del mínimo.
 * - `sin_ruc`         — JAC sin número de RUC registrado.
 * - `sin_nit`         — JAC sin NIT registrado.
 * - `sin_ruc_nit`     — JAC sin RUC y sin NIT.
 */
export const CATEGORIAS_ALERTA = [
  'riesgo_activa',
  'riesgo_inactiva',
  'sin_ruc',
  'sin_nit',
  'sin_ruc_nit',
] as const;

export type CategoriaAlerta = (typeof CATEGORIAS_ALERTA)[number];

/** Tope máximo de `limit` para proteger el servidor. */
export const ALERTAS_LIMIT_MAX = 50;
/** Valores por defecto de paginación. */
export const ALERTAS_PAGE_DEFAULT = 1;
export const ALERTAS_LIMIT_DEFAULT = 10;

/**
 * Conteos agregados de alertas (`GET /jac/alertas/resumen`).
 */
export interface AlertasResumen {
  riesgoActiva: number;
  riesgoInactiva: number;
  sinRuc: number;
  sinNit: number;
  sinRucNit: number;
  totalJacs: number;
}

/**
 * Query params validados de `GET /jac/alertas`.
 */
export class AlertasQueryDto {
  @IsIn(CATEGORIAS_ALERTA, {
    message: `categoria debe ser una de: ${CATEGORIAS_ALERTA.join(', ')}`,
  })
  categoria!: CategoriaAlerta;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1, { message: 'page debe ser >= 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser >= 1' })
  limit?: number;

  @IsOptional()
  @IsString()
  busqueda?: string;
}

/**
 * Item del detalle de alertas.
 */
export interface AlertaJacItem {
  id: number;
  nombre: string;
  municipio: string;
  barrio: string;
  tipo: TipoJac;
  afiliados: number;
  minimoAfiliados: number;
  estado: EstadoOrganizativo;
  numeroRUC: string | null;
  nit: string | null;
}

/**
 * Página de resultados del detalle de alertas (`GET /jac/alertas`).
 */
export interface AlertasJacPage {
  items: AlertaJacItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
