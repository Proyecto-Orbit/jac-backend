/**
 * DTO para respuestas de la API
 * 
 * Define la estructura de datos que se devuelve al cliente
 * Esto oculta campos sensibles y estandariza la respuesta
 */
import { JAC } from '../entities/jac.entity';

export class JACResponseDto {
  id!: number;
  numero!: string | null;
  MUNICIPIO!: string;
  nombreCortoJAC!: string | null;
  nombreCompletoJunta!: string;
  noCarpeta!: string | null;
  noCaja!: string | null;
  ACTIVA!: string;
  observacionesArchivo!: string | null;
  observacionesArchivoFisico!: string | null;
  tipoDeOrganismoComunal!: string | null;
  primerConsiderandoPersoneriaJuridica!: string | null;
  cargo!: string | null;
  nombreDePresidente!: string | null;
  numeroDeIdentificacion!: string | null;
  lugarDeExpedicion!: string | null;
  cambioPresidente!: string | null;
  numeroTelefonico!: string | null;
  correoElectronico!: string | null;
  estadoActualizacion!: string | null;
  nombreDeComites!: string | null;
  fechaDeAprobacion!: Date | null;
  numeroDeAfiliados!: number | null;
  numeroRUC!: string | null;
  asocomunalId!: number | null;
  creadoPor!: string | null;
  actualizadoPor!: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  /**
   * Convierte una entidad JAC a DTO de respuesta
   * @param jac - Entidad desde la base de datos
   * @returns Objeto plano listo para enviar en la respuesta HTTP
   */
  static fromEntity(jac: JAC): JACResponseDto {
    return {
      id: jac.id,
      numero: jac.numero,
      MUNICIPIO: jac.MUNICIPIO,
      nombreCortoJAC: jac.nombreCortoJAC,
      nombreCompletoJunta: jac.nombreCompletoJunta,
      noCarpeta: jac.noCarpeta,
      noCaja: jac.noCaja,
      ACTIVA: jac.ACTIVA,
      observacionesArchivo: jac.observacionesArchivo,
      observacionesArchivoFisico: jac.observacionesArchivoFisico,
      tipoDeOrganismoComunal: jac.tipoDeOrganismoComunal,
      primerConsiderandoPersoneriaJuridica: jac.primerConsiderandoPersoneriaJuridica,
      cargo: jac.cargo,
      nombreDePresidente: jac.nombreDePresidente,
      numeroDeIdentificacion: jac.numeroDeIdentificacion,
      lugarDeExpedicion: jac.lugarDeExpedicion,
      cambioPresidente: jac.cambioPresidente,
      numeroTelefonico: jac.numeroTelefonico,
      correoElectronico: jac.correoElectronico,
      estadoActualizacion: jac.estadoActualizacion,
      nombreDeComites: jac.nombreDeComites,
      fechaDeAprobacion: jac.fechaDeAprobacion,
      numeroDeAfiliados: jac.numeroDeAfiliados,
      numeroRUC: jac.numeroRUC,
      asocomunalId: jac.asocomunalId,
      creadoPor: jac.creadoPor,
      actualizadoPor: jac.actualizadoPor,
      createdAt: jac.createdAt,
      updatedAt: jac.updatedAt,
    };
  }

  /**
   * Convierte un array de entidades a array de DTOs
   */
  static fromEntities(jacs: JAC[]): JACResponseDto[] {
    return jacs.map(jac => JACResponseDto.fromEntity(jac));
  }
}