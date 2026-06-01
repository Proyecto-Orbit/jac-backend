import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Asocomunal } from '../../asocomunal/entities/asocomunal.entity';
import { Persona } from '../../afiliados/entities/persona.entity';

/**
 * Valores posibles para el estado de una JAC.
 *
 * @remarks
 * Se almacena como enum nativo de PostgreSQL.
 * - `activa` — JAC vigente y operativa.
 * - `inactiva` — JAC desactivada (eliminación lógica).
 * - `cancelada` — JAC con personería jurídica cancelada definitivamente.
 */
export enum EstadoJAC {
  ACTIVA = 'activa',
  INACTIVA = 'inactiva',
  CANCELADA = 'cancelada',
}

/**
 * Tipo de territorio en el que opera la JAC.
 *
 * @remarks
 * El tipo determina el número mínimo de afiliados necesarios para
 * que la JAC se mantenga activa según la Ley 2166 de 2021 (Art. 11):
 * - `barrio` (zona urbana): mínimo 38 afiliados para subsistir.
 * - `vereda` (zona rural): mínimo 10 afiliados para subsistir.
 */
export enum TipoJAC {
  BARRIO = 'barrio',
  VEREDA = 'vereda',
}

/**
 * Entidad que representa una Junta de Acción Comunal (JAC).
 *
 * @remarks
 * Mapea la tabla `JAC` en PostgreSQL. La relación con {@link Asocomunal}
 * es opcional: una JAC puede existir sin estar vinculada a ninguna
 * Asocomunal. La eliminación es **lógica** cambiando `estado` a `inactiva`.
 */
@Entity('JAC')
// Índices que aceleran los conteos y filtros del módulo de alertas
// (evitan full scans al filtrar por estado, tipo o presencia de RUC/NIT).
@Index('idx_jac_estado', ['estado'])
@Index('idx_jac_tipo', ['tipo'])
@Index('idx_jac_numero_ruc', ['numeroRUC'])
@Index('idx_jac_nit', ['nit'])
export class JAC {
  /**
   * Identificador primario auto-incremental de la JAC.
   */
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * FK hacia la tabla ASOCOMUNAL.
   * Puede ser `null` si la JAC aún no ha sido asociada.
   */
  @Column({ name: 'asocomunal_id', type: 'int', nullable: true })
  asocomunalId!: number | null;

  /**
   * Estado actual de la JAC.
   *
   * @see {@link EstadoJAC}
   */
  @Column({
    type: 'varchar',
    length: 50,
    default: EstadoJAC.ACTIVA,
  })
  estado!: string;

  /**
   * Tipo de territorio que cubre la JAC (barrio urbano o vereda rural).
   *
   * @remarks
   * Determina el umbral legal de afiliados activos. Por defecto se asume
   * `barrio`, ya que el conjunto migrado desde Excel no incluyó esta
   * información y la mayoría de JACs registradas son urbanas.
   *
   * @see {@link TipoJAC}
   */
  @Column({
    type: 'varchar',
    length: 50,
    default: TipoJAC.BARRIO,
  })
  tipo!: string;

  /**
   * Nombre abreviado o coloquial de la JAC (opcional).
   *
   * @example "JAC El Pino"
   */
  @Column({ name: 'nombre_corto', type: 'varchar', length: 100, nullable: true })
  nombreCorto!: string | null;

  /**
   * Nombre completo oficial de la JAC.
   *
   * @example "Junta de Acción Comunal Barrio El Pino"
   */
  @Column({ name: 'nombre_completo', type: 'varchar', length: 100, nullable: false })
  nombreCompleto!: string;

  /**
   * Número de RUC (Registro Único Comunal) de la JAC.
   * Opcional, ya que no todas las JAC lo tienen registrado.
   */
  @Column({ name: 'numero_ruc', type: 'varchar', length: 30, nullable: true })
  numeroRUC!: string | null;

  /**
   * NIT (Número de Identificación Tributaria) de la JAC.
   *
   * @remarks
   * Opcional a nivel de base de datos: la migración de datos reales no
   * incluye este valor para las JAC existentes. La obligatoriedad en la
   * creación se valida en la capa de servicio, no aquí.
   */
  @Column({ name: 'nit', type: 'varchar', length: 30, nullable: true })
  nit!: string | null;

  /**
   * Número de personería jurídica de la JAC.
   *
   * @remarks
   * Opcional a nivel de base de datos por la misma razón que el NIT.
   * Es obligatorio al crear una JAC nueva, regla validada en el servicio.
   */
  @Column({ name: 'numero_personeria_juridica', type: 'varchar', length: 50, nullable: true })
  numeroPersoneriaJuridica!: string | null;

  /**
   * Relación ManyToOne opcional hacia {@link Asocomunal}.
   *
   * @remarks
   * No se carga por defecto. Se solicita con `relations: ['asocomunal']`
   * o mediante QueryBuilder con `leftJoinAndSelect`.
   */
  @ManyToOne(() => Asocomunal, { nullable: true, eager: false })
  @JoinColumn({ name: 'asocomunal_id' })
  asocomunal!: Asocomunal | null;

  @OneToMany(() => Persona, (persona) => persona.jac)
  personas!: Persona[];
}
