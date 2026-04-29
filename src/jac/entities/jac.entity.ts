import {
  Column,
  Entity,
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
 * Entidad que representa una Junta de Acción Comunal (JAC).
 *
 * @remarks
 * Mapea la tabla `JAC` en PostgreSQL. La relación con {@link Asocomunal}
 * es opcional: una JAC puede existir sin estar vinculada a ninguna
 * Asocomunal. La eliminación es **lógica** cambiando `estado` a `inactiva`.
 */
@Entity('JAC')
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
    type: 'enum',
    enum: EstadoJAC,
    default: EstadoJAC.ACTIVA,
  })
  estado!: EstadoJAC;

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
