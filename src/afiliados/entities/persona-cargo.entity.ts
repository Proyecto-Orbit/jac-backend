import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Persona } from './persona.entity';
import { Cargo } from './cargo.entity';

@Entity('PERSONA_CARGO')
export class PersonaCargo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'estado_id', type: 'int', nullable: true })
  estadoId!: number | null;

  @Column({ name: 'persona_id', type: 'int', nullable: false })
  personaId!: number;

  @Column({ name: 'cargo_id', type: 'int', nullable: false })
  cargoId!: number;

  @Column({ name: 'fecha_inicio', type: 'date', nullable: true })
  fechaInicio!: Date | null;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin!: Date | null;

  @ManyToOne(() => Persona, (persona) => persona.personaCargos)
  @JoinColumn({ name: 'persona_id' })
  persona!: Persona;

  @ManyToOne(() => Cargo, (cargo) => cargo.personaCargos)
  @JoinColumn({ name: 'cargo_id' })
  cargo!: Cargo;
}
