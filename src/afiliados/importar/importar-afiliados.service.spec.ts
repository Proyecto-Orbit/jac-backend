import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ImportarAfiliadosService } from './importar-afiliados.service';
import { Persona } from '../entities/persona.entity';
import { Cargo } from '../entities/cargo.entity';
import { JAC } from '../../jac/entities/jac.entity';
import {
  parsearExcelAfiliados,
  ParsedAfiliado,
  ParsedDignatario,
  ParsedExcel,
} from './excel-parser';

/**
 * Mock parcial del parser: conservamos las constantes reales
 * (SHEET_AFILIADOS, etc.) pero reemplazamos `parsearExcelAfiliados` por
 * un jest.fn() para controlar la entrada "parseada" sin construir un
 * archivo .xlsx real. Así la prueba se enfoca SOLO en la lógica del servicio.
 */
jest.mock('./excel-parser', () => {
  const actual = jest.requireActual('./excel-parser');
  return {
    ...actual,
    parsearExcelAfiliados: jest.fn(),
  };
});

const parsearMock = parsearExcelAfiliados as jest.MockedFunction<
  typeof parsearExcelAfiliados
>;

/**
 * Pruebas unitarias de ImportarAfiliadosService.importarExcel.
 *
 * @remarks
 * Estrategia de aislamiento:
 *  - `parsearExcelAfiliados` está mockeado → controlamos el contenido del
 *    Excel sin tocar ExcelJS.
 *  - `DataSource` está mockeado (getRepository + transaction) → sin BD real,
 *    igual que el patrón de mocks de repositorios en jac.service.spec.ts.
 *
 * División por técnica:
 *  - CAJA BLANCA: se verifican los caminos de control internos del método
 *    (JAC inexistente, acumulación de errores, ejecución de la transacción).
 *  - CAJA NEGRA: clases de equivalencia sobre el resultado de negocio
 *    (entrada parseada → contadores o excepción), sin mirar el flujo interno.
 */
describe('ImportarAfiliadosService.importarExcel', () => {
  let service: ImportarAfiliadosService;

  // Repos individuales mockeados.
  let jacRepo: { findOne: jest.Mock };
  let cargoRepo: { find: jest.Mock };
  let personaRepo: { find: jest.Mock };

  // Manager y transacción.
  let managerMock: { create: jest.Mock; save: jest.Mock };
  let transactionMock: jest.Mock;

  const BUFFER = Buffer.from('xlsx-dummy');
  const JAC_ID = 1;

  /** Construye un ParsedAfiliado completo con overrides. */
  function afiliado(over: Partial<ParsedAfiliado> = {}): ParsedAfiliado {
    return {
      filaExcel: 4,
      nombre: 'Juan',
      apellido: 'Pérez',
      cedula: '123',
      lugarExpedicionCedula: 'POPAYAN',
      fechaNacimiento: null,
      estudiosRealizados: null,
      ocupacion: null,
      genero: null,
      grupoEtnico: null,
      discapacitado: null,
      telefono: null,
      correo: null,
      ...over,
    };
  }

  /** Construye un ParsedDignatario con overrides. */
  function dignatario(over: Partial<ParsedDignatario> = {}): ParsedDignatario {
    return { filaExcel: 4, cedula: '123', cargoNombre: 'Presidente', ...over };
  }

  /** Configura el valor que devolverá el parser mockeado. */
  function setParsed(parcial: Partial<ParsedExcel>): void {
    parsearMock.mockResolvedValue({
      afiliados: [],
      dignatarios: [],
      errores: [],
      ...parcial,
    });
  }

  beforeEach(async () => {
    jacRepo = { findOne: jest.fn().mockResolvedValue({ id: JAC_ID } as JAC) };
    cargoRepo = { find: jest.fn().mockResolvedValue([]) };
    personaRepo = { find: jest.fn().mockResolvedValue([]) };

    managerMock = {
      create: jest.fn((_entity: unknown, data: Record<string, unknown>) => data),
      save: jest.fn(async (data: Record<string, unknown>) => ({
        id: (data.id as number) ?? 999,
        ...data,
      })),
    };

    transactionMock = jest.fn(
      async (cb: (m: typeof managerMock) => unknown) => cb(managerMock),
    );

    const dataSourceMock = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === JAC) return jacRepo;
        if (entity === Cargo) return cargoRepo;
        if (entity === Persona) return personaRepo;
        throw new Error('Repositorio no mockeado');
      }),
      transaction: transactionMock,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportarAfiliadosService,
        { provide: getDataSourceToken(), useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<ImportarAfiliadosService>(ImportarAfiliadosService);
    parsearMock.mockReset();
  });

  // ════════════════════════════════════════════════════════════════════
  //  ENFOQUE CAJA BLANCA
  //  Verificamos los caminos de control internos conociendo la estructura.
  // ════════════════════════════════════════════════════════════════════
  describe('enfoque caja blanca', () => {
    it('camino "JAC inexistente": lanza NotFoundException y NO ejecuta la transacción', async () => {
      jacRepo.findOne.mockResolvedValue(null);
      setParsed({ afiliados: [afiliado()] });

      await expect(service.importarExcel(BUFFER, JAC_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('camino "con errores": lanza BadRequestException y NO ejecuta la transacción', async () => {
      // Dos afiliados con la misma cédula → error de duplicado interno.
      setParsed({
        afiliados: [
          afiliado({ cedula: '123', filaExcel: 4 }),
          afiliado({ cedula: '123', filaExcel: 5 }),
        ],
      });

      await expect(service.importarExcel(BUFFER, JAC_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('camino "sin errores": ejecuta dataSource.transaction exactamente una vez', async () => {
      setParsed({ afiliados: [afiliado()] });

      await service.importarExcel(BUFFER, JAC_ID);

      expect(transactionMock).toHaveBeenCalledTimes(1);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  //  ENFOQUE CAJA NEGRA
  //  Clases de equivalencia sobre el resultado: entrada (parsed) → salida.
  // ════════════════════════════════════════════════════════════════════
  describe('enfoque caja negra', () => {
    it('CE válida: 1 afiliado nuevo + 1 cargo existente → contadores correctos', async () => {
      cargoRepo.find.mockResolvedValue([{ id: 10, nombre: 'Presidente' } as Cargo]);
      setParsed({
        afiliados: [afiliado({ cedula: '123' })],
        dignatarios: [dignatario({ cedula: '123', cargoNombre: 'Presidente' })],
      });

      const res = await service.importarExcel(BUFFER, JAC_ID);

      expect(res.afiliadosInsertados).toBe(1);
      expect(res.afiliadosActualizados).toBe(0);
      expect(res.cargosAsignados).toBe(1);
      expect(res.cargosCreados).toEqual([]);
      expect(res.errores).toEqual([]);
    });

    it('CE inválida: cédula duplicada dentro del Excel → BadRequestException', async () => {
      setParsed({
        afiliados: [
          afiliado({ cedula: '123', filaExcel: 4 }),
          afiliado({ cedula: '123', filaExcel: 5 }),
        ],
      });

      await expect(service.importarExcel(BUFFER, JAC_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('CE inválida: persona ya afiliada a OTRA JAC → BadRequestException', async () => {
      // La persona existe en BD con jacId distinto al de importación.
      personaRepo.find.mockResolvedValue([
        { id: 5, cedula: '123', jacId: 99 } as Persona,
      ]);
      setParsed({ afiliados: [afiliado({ cedula: '123' })] });

      await expect(service.importarExcel(BUFFER, JAC_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('CE inválida: cargo inexistente que NO es comisión → BadRequestException', async () => {
      cargoRepo.find.mockResolvedValue([]); // no hay cargos
      setParsed({
        afiliados: [afiliado({ cedula: '123' })],
        dignatarios: [dignatario({ cedula: '123', cargoNombre: 'Director' })],
      });

      await expect(service.importarExcel(BUFFER, JAC_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('CE límite: cargo "Comisión de ..." inexistente → se crea automáticamente', async () => {
      cargoRepo.find.mockResolvedValue([]); // el cargo aún no existe
      setParsed({
        afiliados: [afiliado({ cedula: '123' })],
        dignatarios: [
          dignatario({ cedula: '123', cargoNombre: 'Comisión de Deportes' }),
        ],
      });

      const res = await service.importarExcel(BUFFER, JAC_ID);

      expect(res.cargosCreados).toEqual(['Comisión de Deportes']);
      expect(res.cargosAsignados).toBe(1);
    });

    it('CE: persona ya existente sin afiliación → se actualiza (no se inserta)', async () => {
      personaRepo.find.mockResolvedValue([
        { id: 7, cedula: '123', jacId: null } as Persona,
      ]);
      setParsed({ afiliados: [afiliado({ cedula: '123' })] });

      const res = await service.importarExcel(BUFFER, JAC_ID);

      expect(res.afiliadosActualizados).toBe(1);
      expect(res.afiliadosInsertados).toBe(0);
    });
  });
});
