import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Persona } from './persona.entity';
import { PersonaCargo } from './persona-cargo.entity';

@Entity('CARGO')
export class Cargo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  nombre!: string;

  @OneToMany(() => Persona, (persona) => persona.cargo)
  personas!: Persona[];

  @OneToMany(() => PersonaCargo, (pc) => pc.cargo)
  personaCargos!: PersonaCargo[];
}
