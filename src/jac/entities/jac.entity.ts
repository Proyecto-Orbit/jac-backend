/**
 * Entidad JAC - Junta de Acción Comunal
 * 
 * Esta clase representa la tabla 'jac' en la base de datos PostgreSQL.
 * Cada propiedad con decorador @Column() es una columna en la tabla.
 * 
 * @decorator @Entity('jac') - Define el nombre de la tabla en la BD
 * @decorator @PrimaryGeneratedColumn() - ID auto-generado (number, no UUID)
 * @decorator @Column() - Cada propiedad es una columna
 * 
 * NOTA: Usamos 'number' para IDs para compatibilidad con el microservicio de Asocomunales
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('jac') // Nombre de la tabla en PostgreSQL
export class JAC {
  /**
   * ID único de la JAC
   * Tipo: number (auto-incremental) para compatibilidad con Asocomunales
   */
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * Número de registro secuencial (del Excel fuente)
   */
  @Column({ 
    type: 'varchar', 
    length: 50, 
    nullable: true 
  })
  numero!: string | null;

  /**
   * Municipio donde se encuentra la JAC
   * Obligatorio para la asociación con Asocomunales
   */
  @Column({ nullable: false })
  MUNICIPIO!: string;

  /**
   * Nombre corto de la JAC
   */
  @Column({ name: 'nombre_corto_jac', type: 'varchar', length: 100, nullable: true })
  nombreCortoJAC!: string | null;

  /**
   * Nombre completo oficial de la JAC
   * Obligatorio
   */
  @Column({ type: 'varchar', length: 200, nullable: false })
  nombreCompletoJunta!: string;

  /**
   * Número de carpeta (archivo físico)
   */
  @Column({ name: 'no_carpeta', type: 'varchar', length: 50, nullable: true })
  noCarpeta!: string | null;

  /**
   * Número de caja (archivo físico)
   */
  @Column({ name: 'no_caja', type: 'varchar', length: 50, nullable: true })
  noCaja!: string | null;

  /**
   * Estado activo/inactivo (eliminación lógica)
   * Valores: 'SI' o 'NO'
   */
  @Column({ type: 'varchar', length: 10, nullable: true, default: 'SI' })
  ACTIVA!: string;

  /**
   * Observaciones del archivo digital
   */
  @Column({ type: 'text', nullable: true })
  observacionesArchivo!: string | null;

  /**
   * Observaciones del archivo físico
   */
  @Column({ type: 'text', nullable: true })
  observacionesArchivoFisico!: string | null;

  /**
   * Tipo de organismo comunal (JAC, ASOCOMUNAL, etc.)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  tipoDeOrganismoComunal!: string | null;

  /**
   * Información legal de personería jurídica
   */
  @Column({ type: 'text', nullable: true })
  primerConsiderandoPersoneriaJuridica!: string | null;

  /**
   * Cargo del presidente
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  cargo!: string | null;

  /**
   * Nombre del presidente de la JAC
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  nombreDePresidente!: string | null;

  /**
   * Número de identificación del presidente
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  numeroDeIdentificacion!: string | null;

  /**
   * Lugar de expedición del documento de identidad
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  lugarDeExpedicion!: string | null;

  /**
   * Indicador de cambio de presidente
   */
  @Column({ name: 'cambio_presidente', type: 'varchar', length: 10, nullable: true })
  cambioPresidente!: string | null;

  /**
   * Número telefónico de contacto
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  numeroTelefonico!: string | null;

  /**
   * Correo electrónico de contacto
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  correoElectronico!: string | null;

  /**
   * Estado de actualización de la JAC
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  estadoActualizacion!: string | null;

  /**
   * Nombre de los comités de la JAC
   */
  @Column({ type: 'text', nullable: true })
  nombreDeComites!: string | null;

  /**
   * Fecha de aprobación de la JAC
   */
  @Column({ type: 'date', nullable: true })
  fechaDeAprobacion!: Date | null;

  /**
   * Número de afiliados a la JAC
   */
  @Column({ type: 'int', nullable: true })
  numeroDeAfiliados!: number | null;

  /**
   * Número RUC/NIT de la JAC
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  numeroRUC!: string | null;

  /**
   * ID de la Asocomunal asociada (FK)
   * Este campo permite relacionar JAC → Asocomunal
   * Puede ser null si no está asociada o hay múltiples Asocomunales en el municipio
   */
  @Column({ name: 'asocomunal_id', type: 'int', nullable: true })
  asocomunalId!: number | null;

  /**
   * Usuario que creó el registro (auditoría - RF10)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  creadoPor!: string | null;

  /**
   * Usuario que actualizó por última vez (auditoría - RF10)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  actualizadoPor!: string | null;

  /**
   * Fecha de creación automática
   * TypeORM maneja esto automáticamente
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * Fecha de última actualización automática
   * TypeORM maneja esto automáticamente
   */
  @UpdateDateColumn()
  updatedAt!: Date;

  // =========================================================================
  // MÉTODOS DE NEGOCIO (Domain Logic)
  // Estos métodos permiten manipular la entidad con reglas de negocio
  // =========================================================================

  /**
   * Actualiza el estado de actualización de la JAC
   * @param nuevoEstado - Nuevo estado (ej. 'Al día', 'Desactualizada')
   */
  actualizarEstado(nuevoEstado: string): void {
    this.estadoActualizacion = nuevoEstado;
    this.updatedAt = new Date();
  }

  /**
   * Desactiva la JAC (eliminación lógica - RF11)
   * Cambia ACTIVA a 'NO' en lugar de borrar el registro
   * @param usuarioId - ID del usuario que realiza la acción
   */
  desactivar(usuarioId: string): void {
    this.ACTIVA = 'NO';
    this.actualizadoPor = usuarioId;
    this.updatedAt = new Date();
  }

  /**
   * Reactiva la JAC
   * @param usuarioId - ID del usuario que realiza la acción
   */
  reactivar(usuarioId: string): void {
    this.ACTIVA = 'SI';
    this.actualizadoPor = usuarioId;
    this.updatedAt = new Date();
  }

  /**
   * Asocia la JAC a una Asocomunal
   * @param asocomunalId - ID de la Asocomunal
   * @param usuarioId - ID del usuario que realiza la asociación
   */
  asociarAsocomunal(asocomunalId: number, usuarioId: string): void {
    this.asocomunalId = asocomunalId;
    this.actualizadoPor = usuarioId;
    this.updatedAt = new Date();
  }

  /**
   * Actualiza información básica de la JAC
   * @param datos - Objeto con los datos a actualizar
   * @param usuarioId - ID del usuario que realiza la actualización
   */
  actualizarInformacion(datos: Partial<JAC>, usuarioId: string): void {
    Object.assign(this, datos);
    this.actualizadoPor = usuarioId;
    this.updatedAt = new Date();
  }
}