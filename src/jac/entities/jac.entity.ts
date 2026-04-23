import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('JAC')
export class JAC {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'tipo_organismo_id', type: 'int', nullable: true })
  tipoOrganismoId!: number | null;

  @Column({ name: 'estado_id', type: 'int', nullable: true, default: 1 })
  estadoId!: number | null;

  @Column({ name: 'nombre_corto', type: 'varchar', length: 100, nullable: true })
  nombreCorto!: string | null;

  @Column({ name: 'nombre_completo', type: 'varchar', length: 100, nullable: false })
  nombreCompleto!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  nit!: string | null;

  @Column({ name: 'numero_RUC', type: 'varchar', length: 20, nullable: true })
  numeroRUC!: string | null;
}
