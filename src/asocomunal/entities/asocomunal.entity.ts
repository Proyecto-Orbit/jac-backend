import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Entidad réplica de Asocomunal.
 *
 * @remarks
 * Esta tabla se sincroniza exclusivamente a través de eventos RabbitMQ
 * publicados por el microservicio de Asocomunales. No existe un endpoint
 * HTTP que permita crear o modificar estos registros directamente.
 * Las operaciones de escritura ocurren en {@link AsocomunalService}.
 *
 * @see {@link AsocomunalService}
 */
@Entity('ASOCOMUNAL')
export class Asocomunal {
  /**
   * Identificador primario proveniente del microservicio de Asocomunales.
   * No es auto-generado: el valor llega desde el evento RabbitMQ.
   */
  @PrimaryColumn({ type: 'int' })
  id!: number;

  /** Nombre oficial de la Asocomunal. */
  @Column({ type: 'varchar', length: 150, nullable: false })
  nombre!: string;

  /** ID del municipio al que pertenece la Asocomunal (referencia externa). */
  @Column({ name: 'municipio_id', type: 'int', nullable: true })
  municipioId!: number | null;

  /** Nombre legible del municipio, desnormalizado para evitar JOINs adicionales. Esto se puede hacer porque como tal este microservicio no mantiene una relación directa con la tabla de municipios. */
  @Column({ name: 'municipio_nombre', type: 'varchar', length: 100, nullable: true })
  municipioNombre!: string | null;

  /** Indica si la Asocomunal está activa según el microservicio origen. */
  @Column({ type: 'boolean', nullable: false, default: true })
  estado!: boolean;
}
