/**
 * Resumen de conteos de JAC por estado organizativo.
 *
 * @remarks
 * Salida del endpoint público `GET /jac/public/estados/resumen`.
 * No contiene PII; solo agregados sobre la tabla JAC.
 */
export interface EstadosJacResumen {
  /** Número de JAC en estado Activa. */
  activa: number;
  /** Número de JAC en estado Inactiva. */
  inactiva: number;
  /** Número de JAC en estado Cancelada. */
  cancelada: number;
  /** Total = activa + inactiva + cancelada. */
  total: number;
}
