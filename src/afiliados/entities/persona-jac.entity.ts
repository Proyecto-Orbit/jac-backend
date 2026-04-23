import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Persona } from './persona.entity';
import { JAC } from '../../jac/entities/jac.entity';

@Entity('PERSONA_JAC')
export class PersonaJAC {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'jac_id', type: 'int', nullable: false })
  jacId!: number;

  @Column({ name: 'persona_id', type: 'int', nullable: false })
  personaId!: number;

  @Column({ name: 'fecha_inicio', type: 'date', nullable: true })
  fechaInicio!: Date | null;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin!: Date | null;

  @ManyToOne(() => JAC)
  @JoinColumn({ name: 'jac_id' })
  jac!: JAC;

  @ManyToOne(() => Persona, (persona) => persona.personaJacs)
  @JoinColumn({ name: 'persona_id' })
  persona!: Persona;
}
