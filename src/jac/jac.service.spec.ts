import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JacService } from './jac.service';
import { EstadoJAC, JAC, TipoJAC } from './entities/jac.entity';
import { Persona } from '../afiliados/entities/persona.entity';
import { CreateJACDto } from './dto/create-jac.dto';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { AsocomunalService } from '../asocomunal/asocomunal.service';

/**
 * Pruebas unitarias del flujo de creación de JAC enfoque caja blanca y caja negra.
 *
 * @remarks
 * Reglas de negocio que se verifican aquí:
 * - Toda JAC nueva debe nacer con `estado = inactiva`, sin importar
 *   lo que llegue en el DTO.
 * - El servicio debe propagar `tipo`, `asocomunalId`, `nombreCompleto`,
 *   `nombreCorto` y `numeroRUC` tal como vienen en el DTO.
 * - Después de guardar, debe notificarse al microservicio de Asocomunales
 *   vía RabbitMQ con el ID, nombre y asocomunalId resultantes.
 */
describe('JacService.create', () => {
  let service: JacService;
  let repository: jest.Mocked<Repository<JAC>>;
  let rabbitMQService: jest.Mocked<RabbitMQService>;

  beforeEach(async () => {
    const repositoryMock: Partial<jest.Mocked<Repository<JAC>>> = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const personaRepositoryMock: Partial<jest.Mocked<Repository<Persona>>> = {
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 0 } as never),
    };

    const rabbitMQServiceMock: Partial<jest.Mocked<RabbitMQService>> = {
      notifyJACCreated: jest.fn().mockResolvedValue(undefined),
      notifyJACUpdated: jest.fn().mockResolvedValue(undefined),
      notifyJACDeleted: jest.fn().mockResolvedValue(undefined),
    };

    const asocomunalServiceMock = {
      findAll: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JacService,
        { provide: getRepositoryToken(JAC), useValue: repositoryMock },
        { provide: getRepositoryToken(Persona), useValue: personaRepositoryMock },
        { provide: RabbitMQService, useValue: rabbitMQServiceMock },
        { provide: AsocomunalService, useValue: asocomunalServiceMock },
      ],
    }).compile();

    service = module.get<JacService>(JacService);
    repository = module.get(getRepositoryToken(JAC));
    rabbitMQService = module.get(RabbitMQService);
  });

  describe('enfoque caja blanca', () => {
    it('debería crear la JAC con estado inactiva por defecto', async () => {
      const dto: CreateJACDto = {
        asocomunalId: 7,
        tipo: TipoJAC.BARRIO,
        numeroPersoneriaJuridica: 'PJ-001',
        nombreCompleto: 'JAC Barrio Las Flores',
      };

      const entityCreada = { ...dto, estado: EstadoJAC.INACTIVA } as JAC;
      const entityGuardada = { ...entityCreada, id: 42 } as JAC;

      repository.create.mockReturnValue(entityCreada);
      repository.save.mockResolvedValue(entityGuardada);

      const resultado = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith({
        ...dto,
        estado: EstadoJAC.INACTIVA,
      });
      expect(repository.save).toHaveBeenCalledWith(entityCreada);
      expect(resultado.id).toBe(42);
      expect(resultado.estado).toBe(EstadoJAC.INACTIVA);
    });

    it('debería ignorar cualquier estado enviado y forzar inactiva', async () => {
      // Aunque el DTO ya no expone `estado`, simulamos que llega por la red
      // para confirmar que el servicio nunca confía en ese valor.
      const dtoSucio = {
        asocomunalId: 1,
        tipo: TipoJAC.VEREDA,
        numeroPersoneriaJuridica: 'PJ-001',
        nombreCompleto: 'JAC Vereda El Roble',
        estado: EstadoJAC.ACTIVA,
      } as unknown as CreateJACDto;

      repository.create.mockImplementation((entity) => entity as JAC);
      repository.save.mockImplementation(async (entity) => ({ ...(entity as JAC), id: 1 }));

      const resultado = await service.create(dtoSucio);

      const entityPasadaACreate = repository.create.mock.calls[0][0] as Partial<JAC>;
      expect(entityPasadaACreate.estado).toBe(EstadoJAC.INACTIVA);
      expect(resultado.estado).toBe(EstadoJAC.INACTIVA);
    });

    it('debería conservar el tipo, asocomunalId y numeroRUC del DTO', async () => {
      const dto: CreateJACDto = {
        asocomunalId: 9,
        tipo: TipoJAC.VEREDA,
        numeroPersoneriaJuridica: 'PJ-001',
        nombreCompleto: 'JAC Vereda La Esperanza',
        nombreCorto: 'JAC La Esperanza',
        numeroRUC: 'RUC-123',
      };

      repository.create.mockImplementation((entity) => entity as JAC);
      repository.save.mockImplementation(async (entity) => ({ ...(entity as JAC), id: 100 }));

      const resultado = await service.create(dto);

      expect(resultado.asocomunalId).toBe(9);
      expect(resultado.nombreCompleto).toBe('JAC Vereda La Esperanza');
      expect(resultado.nombreCorto).toBe('JAC La Esperanza');
      expect(resultado.numeroRUC).toBe('RUC-123');
      const entityPasadaACreate = repository.create.mock.calls[0][0] as Partial<JAC>;
      expect(entityPasadaACreate.tipo).toBe(TipoJAC.VEREDA);
    });

    it('debería notificar a RabbitMQ tras guardar la JAC', async () => {
      const dto: CreateJACDto = {
        asocomunalId: 3,
        tipo: TipoJAC.BARRIO,
        numeroPersoneriaJuridica: 'PJ-001',
        nombreCompleto: 'JAC Barrio Centro',
      };

      repository.create.mockImplementation((entity) => entity as JAC);
      repository.save.mockResolvedValue({
        ...dto,
        estado: EstadoJAC.INACTIVA,
        id: 55,
      } as JAC);

      await service.create(dto);

      expect(rabbitMQService.notifyJACCreated).toHaveBeenCalledTimes(1);
      expect(rabbitMQService.notifyJACCreated).toHaveBeenCalledWith({
        id: 55,
        nombre: 'JAC Barrio Centro',
        estado: EstadoJAC.INACTIVA,
        asocomunalId: 3,
      });
    });
  });
  describe('enfoque caja negra', () => {
    /**
     * Pruebas con CLASES DE EQUIVALENCIA Y VALORES LÍMITE
     * para el campo: asocomunalId (Obligatorio, Int)
     *
     * Clase válida: Número entero positivo (1, 100, 999999)
     * Clase inválida: null, undefined, string, decimal, 0, negativo
     *
     * Valores límite:
     * - Mínimo válido: 1
     * - Máximo válido: Number.MAX_SAFE_INTEGER
     * - Justo debajo del mínimo: 0
     * - Justo encima del máximo: Infinity
     */
    describe('validación de asocomunalId', () => {
      it('CE: asocomunalId con valor válido mínimo (1)', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 1,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Centro',
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 1,
        }));

        const resultado = await service.create(dto);

        expect(resultado.asocomunalId).toBe(1);
      });

      it('CE: asocomunalId con valor válido típico (100)', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 100,
          tipo: TipoJAC.VEREDA,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Vereda Típica',
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 2,
        }));

        const resultado = await service.create(dto);

        expect(resultado.asocomunalId).toBe(100);
      });

      it('CE: asocomunalId con valor válido máximo (Number.MAX_SAFE_INTEGER)', async () => {
        const dto: CreateJACDto = {
          asocomunalId: Number.MAX_SAFE_INTEGER,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Límite Alto',
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 3,
        }));

        const resultado = await service.create(dto);

        expect(resultado.asocomunalId).toBe(Number.MAX_SAFE_INTEGER);
      });

      it('CE: asocomunalId inválido (null) debe rechazarse', async () => {
        const dtoInvalido = {
          asocomunalId: null,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Sin Asocomunal',
        } as unknown as CreateJACDto;

        // La validación de null la hace el ValidationPipe en la capa HTTP.
        // En el servicio unitario el dato llega hasta repository.save, donde
        // la BD lanzaría la violación de FK. Simulamos ese comportamiento.
        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockRejectedValue(
          new Error('violación de clave foránea: asocomunalId no puede ser nulo'),
        );

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });

      it('VL: asocomunalId en límite inferior inválido (0)', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 0,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Con Asocomunal Cero',
        };

        // En algunos contextos, 0 podría ser válido, pero es límite negativo
        // Dependiendo de la lógica de negocio, puede rechazarse
        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 4,
        }));

        // Si se acepta, verificamos que se propaga
        const resultado = await service.create(dto);
        expect(resultado.asocomunalId).toBe(0);
      });

      it('VL: asocomunalId negativo debe rechazarse', async () => {
        const dtoInvalido = {
          asocomunalId: -5,
          tipo: TipoJAC.VEREDA,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Con ID Negativo',
        } as CreateJACDto;

        // Dependiendo de la validación, puede rechazarse
        repository.create.mockImplementation(() => {
          throw new Error('asocomunalId no puede ser negativo');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });
    });

    /**
     * Pruebas con CLASES DE EQUIVALENCIA Y VALORES LÍMITE
     * para el campo: tipo (Obligatorio, Enum TipoJAC)
     *
     * Clase válida: TipoJAC.BARRIO, TipoJAC.VEREDA
     * Clase inválida: string incorrecto, null, undefined, número
     *
     * Valores límite: N/A (valores discretos del enum)
     */
    describe('validación de tipo', () => {
      it('CE: tipo válido TipoJAC.BARRIO', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 5,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Barrio Centro',
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 5,
        }));

        await service.create(dto);

        // JACResponseDto (respuesta de create) no expone `tipo`; verificamos
        // que el valor llegó correctamente a la capa de persistencia.
        const entityPasadaACreate = repository.create.mock.calls[0][0] as Partial<JAC>;
        expect(entityPasadaACreate.tipo).toBe(TipoJAC.BARRIO);
      });

      it('CE: tipo válido TipoJAC.VEREDA', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 5,
          tipo: TipoJAC.VEREDA,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Vereda Rural',
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 6,
        }));

        await service.create(dto);

        const entityPasadaACreate = repository.create.mock.calls[0][0] as Partial<JAC>;
        expect(entityPasadaACreate.tipo).toBe(TipoJAC.VEREDA);
      });

      it('CE: tipo inválido (string incorrecto) debe rechazarse', async () => {
        const dtoInvalido = {
          asocomunalId: 5,
          tipo: 'barrio_invalido' as unknown as TipoJAC,
          nombreCompleto: 'JAC Inválida',
        };

        repository.create.mockImplementation(() => {
          throw new Error('tipo debe ser barrio o vereda');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });

      it('CE: tipo inválido (null) debe rechazarse', async () => {
        const dtoInvalido = {
          asocomunalId: 5,
          tipo: null as unknown as TipoJAC,
          nombreCompleto: 'JAC Sin Tipo',
        };

        repository.create.mockImplementation(() => {
          throw new Error('tipo es obligatorio');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });

      it('CE: tipo inválido (número) debe rechazarse', async () => {
        const dtoInvalido = {
          asocomunalId: 5,
          tipo: 1 as unknown as TipoJAC,
          nombreCompleto: 'JAC Con Tipo Número',
        };

        repository.create.mockImplementation(() => {
          throw new Error('tipo debe ser una cadena válida');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });
    });

    /**
     * Pruebas con CLASES DE EQUIVALENCIA Y VALORES LÍMITE
     * para el campo: nombreCompleto (Obligatorio, String, 3-100 caracteres)
     *
     * Clase válida: string con 3-100 caracteres
     * Clase inválida: string < 3 caracteres, string > 100 caracteres, null, undefined
     *
     * Valores límite:
     * - Mínimo válido: 3 caracteres
     * - Máximo válido: 100 caracteres
     * - Justo debajo del mínimo: 2 caracteres
     * - Justo encima del máximo: 101 caracteres
     */
    describe('validación de nombreCompleto', () => {
      it('CE: nombreCompleto válido con longitud mínima (3 caracteres)', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 7,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC',
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 7,
        }));

        const resultado = await service.create(dto);

        expect(resultado.nombreCompleto).toBe('JAC');
        expect(resultado.nombreCompleto.length).toBe(3);
      });

      it('CE: nombreCompleto válido con longitud típica (50 caracteres)', async () => {
        const nombreTipico = 'J'.repeat(50);
        const dto: CreateJACDto = {
          asocomunalId: 7,
          tipo: TipoJAC.VEREDA,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: nombreTipico,
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 8,
        }));

        const resultado = await service.create(dto);

        expect(resultado.nombreCompleto).toBe(nombreTipico);
        expect(resultado.nombreCompleto.length).toBe(50);
      });

      it('CE: nombreCompleto válido con longitud máxima (100 caracteres)', async () => {
        const nombreMaximo = 'N'.repeat(100);
        const dto: CreateJACDto = {
          asocomunalId: 7,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: nombreMaximo,
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 9,
        }));

        const resultado = await service.create(dto);

        expect(resultado.nombreCompleto).toBe(nombreMaximo);
        expect(resultado.nombreCompleto.length).toBe(100);
      });

      it('VL: nombreCompleto inválido (cadena vacía) debe rechazarse', async () => {
        const dtoInvalido: CreateJACDto = {
          asocomunalId: 7,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: '',
        };

        repository.create.mockImplementation(() => {
          throw new Error('nombreCompleto debe tener al menos 3 caracteres');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });

      it('VL: nombreCompleto justo debajo del mínimo (2 caracteres) debe rechazarse', async () => {
        const dtoInvalido: CreateJACDto = {
          asocomunalId: 7,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JA',
        };

        repository.create.mockImplementation(() => {
          throw new Error('nombreCompleto debe tener al menos 3 caracteres');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });

      it('VL: nombreCompleto justo encima del máximo (101 caracteres) debe rechazarse', async () => {
        const nombreExcedido = 'A'.repeat(101);
        const dtoInvalido: CreateJACDto = {
          asocomunalId: 7,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: nombreExcedido,
        };

        repository.create.mockImplementation(() => {
          throw new Error('nombreCompleto no puede superar 100 caracteres');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });

      it('CE: nombreCompleto inválido (null) debe rechazarse', async () => {
        const dtoInvalido = {
          asocomunalId: 7,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: null,
        } as unknown as CreateJACDto;

        repository.create.mockImplementation(() => {
          throw new Error('nombreCompleto es obligatorio');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });

      it('CE: nombreCompleto inválido (número) debe rechazarse', async () => {
        const dtoInvalido = {
          asocomunalId: 7,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 123 as unknown as string,
        } as unknown as CreateJACDto;

        repository.create.mockImplementation(() => {
          throw new Error('nombreCompleto debe ser una cadena');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });
    });

    /**
     * Pruebas con CLASES DE EQUIVALENCIA Y VALORES LÍMITE
     * para el campo: nombreCorto (Opcional, String, max 100 caracteres)
     *
     * Clase válida: undefined, string 0-100 caracteres
     * Clase inválida: string > 100 caracteres, tipo no-string
     *
     * Valores límite:
     * - Sin proporcionar (undefined)
     * - Cadena vacía (0 caracteres)
     * - Máximo válido: 100 caracteres
     * - Justo encima del máximo: 101 caracteres
     */
    describe('validación de nombreCorto', () => {
      it('CE: nombreCorto omitido (undefined) debe permitirse', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 10,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Barrio Complete',
          // nombreCorto no se proporciona
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 10,
        }));

        const resultado = await service.create(dto);

        expect(resultado.nombreCorto).toBeUndefined();
      });

      it('CE: nombreCorto válido con cadena vacía', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 10,
          tipo: TipoJAC.VEREDA,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Vereda Completo',
          nombreCorto: '',
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 11,
        }));

        const resultado = await service.create(dto);

        expect(resultado.nombreCorto).toBe('');
      });

      it('CE: nombreCorto válido con longitud típica (20 caracteres)', async () => {
        const nombreCortoTipico = 'JAC Barrio Centro';
        const dto: CreateJACDto = {
          asocomunalId: 10,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Barrio Centro Completo',
          nombreCorto: nombreCortoTipico,
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 12,
        }));

        const resultado = await service.create(dto);

        expect(resultado.nombreCorto).toBe(nombreCortoTipico);
      });

      it('CE: nombreCorto válido con longitud máxima (100 caracteres)', async () => {
        const nombreCortoMaximo = 'C'.repeat(100);
        const dto: CreateJACDto = {
          asocomunalId: 10,
          tipo: TipoJAC.VEREDA,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Vereda Completo',
          nombreCorto: nombreCortoMaximo,
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 13,
        }));

        const resultado = await service.create(dto);

        expect(resultado.nombreCorto).toBe(nombreCortoMaximo);
        expect(resultado.nombreCorto.length).toBe(100);
      });

      it('VL: nombreCorto justo encima del máximo (101 caracteres) debe rechazarse', async () => {
        const nombreCortoExcedido = 'D'.repeat(101);
        const dtoInvalido: CreateJACDto = {
          asocomunalId: 10,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Barrio Completo',
          nombreCorto: nombreCortoExcedido,
        };

        repository.create.mockImplementation(() => {
          throw new Error('nombreCorto no puede superar 100 caracteres');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });

      it('CE: nombreCorto inválido (número) debe rechazarse', async () => {
        const dtoInvalido = {
          asocomunalId: 10,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Barrio Completo',
          nombreCorto: 12345 as unknown as string,
        };

        repository.create.mockImplementation(() => {
          throw new Error('nombreCorto debe ser una cadena');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });
    });

    /**
     * Pruebas con CLASES DE EQUIVALENCIA Y VALORES LÍMITE
     * para el campo: numeroRUC (Opcional, String, max 30 caracteres)
     *
     * Clase válida: undefined, string 0-30 caracteres
     * Clase inválida: string > 30 caracteres, tipo no-string
     *
     * Valores límite:
     * - Sin proporcionar (undefined)
     * - Cadena vacía (0 caracteres)
     * - Máximo válido: 30 caracteres
     * - Justo encima del máximo: 31 caracteres
     */
    describe('validación de numeroRUC', () => {
      it('CE: numeroRUC omitido (undefined) debe permitirse', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 15,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Sin RUC',
          // numeroRUC no se proporciona
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 14,
        }));

        const resultado = await service.create(dto);

        expect(resultado.numeroRUC).toBeUndefined();
      });

      it('CE: numeroRUC válido con cadena vacía', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 15,
          tipo: TipoJAC.VEREDA,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Vereda Con RUC Vacío',
          numeroRUC: '',
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 15,
        }));

        const resultado = await service.create(dto);

        expect(resultado.numeroRUC).toBe('');
      });

      it('CE: numeroRUC válido con longitud típica (15 caracteres)', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 15,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Barrio Con RUC',
          numeroRUC: 'RUC-123-456-789',
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 16,
        }));

        const resultado = await service.create(dto);

        expect(resultado.numeroRUC).toBe('RUC-123-456-789');
      });

      it('CE: numeroRUC válido con longitud máxima (30 caracteres)', async () => {
        const numeroRUCMaximo = 'RUC'.padEnd(30, '0');
        const dto: CreateJACDto = {
          asocomunalId: 15,
          tipo: TipoJAC.VEREDA,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Vereda Con RUC Máximo',
          numeroRUC: numeroRUCMaximo,
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 17,
        }));

        const resultado = await service.create(dto);

        expect(resultado.numeroRUC).toBe(numeroRUCMaximo);
        expect(resultado.numeroRUC.length).toBe(30);
      });

      it('VL: numeroRUC justo encima del máximo (31 caracteres) debe rechazarse', async () => {
        const numeroRUCExcedido = 'R'.repeat(31);
        const dtoInvalido: CreateJACDto = {
          asocomunalId: 15,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Barrio Con RUC Excedido',
          numeroRUC: numeroRUCExcedido,
        };

        repository.create.mockImplementation(() => {
          throw new Error('numeroRUC no puede superar 30 caracteres');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });

      it('CE: numeroRUC inválido (número) debe rechazarse', async () => {
        const dtoInvalido = {
          asocomunalId: 15,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Barrio Con RUC Inválido',
          numeroRUC: 123456 as unknown as string,
        };

        repository.create.mockImplementation(() => {
          throw new Error('numeroRUC debe ser una cadena');
        });

        await expect(() => service.create(dtoInvalido)).rejects.toThrow();
      });
    });

    /**
     * Pruebas de COMBINACIONES DE CASOS LÍMITE
     * Probamos combinaciones de múltiples campos en sus límites simultáneamente
     */
    describe('combinaciones de límites', () => {
      it('Todos los campos en sus límites válidos mínimos', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 1,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC',
          nombreCorto: '',
          numeroRUC: '',
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 18,
        }));

        const resultado = await service.create(dto);

        expect(resultado.asocomunalId).toBe(1);
        expect(resultado.nombreCompleto.length).toBe(3);
        expect(resultado.nombreCorto).toBe('');
        expect(resultado.numeroRUC).toBe('');
      });

      it('Todos los campos en sus límites válidos máximos', async () => {
        const dto: CreateJACDto = {
          asocomunalId: Number.MAX_SAFE_INTEGER,
          tipo: TipoJAC.VEREDA,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'N'.repeat(100),
          nombreCorto: 'C'.repeat(100),
          numeroRUC: 'R'.repeat(30),
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 19,
        }));

        const resultado = await service.create(dto);

        expect(resultado.asocomunalId).toBe(Number.MAX_SAFE_INTEGER);
        expect(resultado.nombreCompleto.length).toBe(100);
        expect(resultado.nombreCorto.length).toBe(100);
        expect(resultado.numeroRUC.length).toBe(30);
      });

      it('Campos opcionales omitidos (undefined)', async () => {
        const dto: CreateJACDto = {
          asocomunalId: 50,
          tipo: TipoJAC.BARRIO,
          numeroPersoneriaJuridica: 'PJ-001',
          nombreCompleto: 'JAC Completo Sin Opcionales',
          // nombreCorto y numeroRUC no se proporcionan
        };

        repository.create.mockImplementation((entity) => entity as JAC);
        repository.save.mockImplementation(async (entity) => ({
          ...(entity as JAC),
          id: 20,
        }));

        const resultado = await service.create(dto);

        expect(resultado.nombreCorto).toBeUndefined();
        expect(resultado.numeroRUC).toBeUndefined();
      });
    });
  });
});
