import { JAC } from '../entities/jac.entity';

export class JACResponseDto {
  id!: number;
  tipoOrganismoId!: number | null;
  estadoId!: number | null;
  nombreCorto!: string | null;
  nombreCompleto!: string;
  nit!: string | null;
  numeroRUC!: string | null;

  static fromEntity(jac: JAC): JACResponseDto {
    return {
      id: jac.id,
      tipoOrganismoId: jac.tipoOrganismoId,
      estadoId: jac.estadoId,
      nombreCorto: jac.nombreCorto,
      nombreCompleto: jac.nombreCompleto,
      nit: jac.nit,
      numeroRUC: jac.numeroRUC,
    };
  }

  static fromEntities(jacs: JAC[]): JACResponseDto[] {
    return jacs.map((jac) => JACResponseDto.fromEntity(jac));
  }
}
