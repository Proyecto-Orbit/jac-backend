import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Cargo } from './cargo.entity';
import { PersonaCargo } from './persona-cargo.entity';
import { PersonaJAC } from './persona-jac.entity';

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

  @Column({ type: 'varchar', length: 20, nullable: true })
  correo!: string | null;

  @ManyToOne(() => Cargo, (cargo) => cargo.personas, { nullable: true })
  @JoinColumn({ name: 'cargo_id' })
  cargo!: Cargo | null;

  @OneToMany(() => PersonaCargo, (pc) => pc.persona)
  personaCargos!: PersonaCargo[];

  @OneToMany(() => PersonaJAC, (pj) => pj.persona)
  personaJacs!: PersonaJAC[];
}
