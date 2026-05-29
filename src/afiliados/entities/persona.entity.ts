import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cargo } from './cargo.entity';
import { JAC } from '../../jac/entities/jac.entity';

/**
 * Entidad que representa a una persona afiliada a una JAC.
 *
 * @remarks
 * La relación con {@link JAC} y {@link Cargo} es 1-N directa: una persona
 * pertenece a UNA JAC y ocupa UN cargo a la vez. No se conserva historial
 * de afiliaciones ni de cargos en tablas intermedias.
 */
@Entity('PERSONA')
export class Persona {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'cargo_id', type: 'int', nullable: true })
  cargoId!: number | null;

  @Column({ name: 'municipio_id', type: 'int', nullable: true })
  municipioId!: number | null;

  @Column({ name: 'JAC_id', type: 'int', nullable: true })
  jacId!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: false })
  nombre!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  apellido!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cedula!: string | null;

  @Column({ name: 'lugar_expedicion_cedula', type: 'varchar', length: 50, nullable: true })
  lugarExpedicionCedula!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  correo!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  genero!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'grupo_etnico' })
  grupoEtnico!: string | null;

  @Column({ type: 'date', nullable: true, name: 'fecha_nacimiento' })
  fechaNacimiento!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ocupacion!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'estudios_realizados' })
  estudiosRealizados!: string | null;

  @Column({ type: 'boolean', nullable: true })
  discapacitado!: boolean | null;

  @Column({ type: 'boolean', default: true, nullable: false })
  activo!: boolean;

  @ManyToOne(() => Cargo, (cargo) => cargo.personas, { nullable: true })
  @JoinColumn({ name: 'cargo_id' })
  cargo!: Cargo | null;

  @ManyToOne(() => JAC, (jac) => jac.personas, { nullable: true, eager: false })
  @JoinColumn({ name: 'JAC_id' })
  jac!: JAC | null;
}
