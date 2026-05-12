import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JacService } from './jac.service';
import { EstadoJAC, JAC, TipoJAC } from './entities/jac.entity';
import { CreateJACDto } from './dto/create-jac.dto';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

/**
 * Pruebas unitarias del flujo de creación de JAC.
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

    const rabbitMQServiceMock: Partial<jest.Mocked<RabbitMQService>> = {
      notifyJACCreated: jest.fn().mockResolvedValue(undefined),
      notifyJACUpdated: jest.fn().mockResolvedValue(undefined),
      notifyJACDeleted: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JacService,
        { provide: getRepositoryToken(JAC), useValue: repositoryMock },
        { provide: RabbitMQService, useValue: rabbitMQServiceMock },
      ],
    }).compile();

    service = module.get<JacService>(JacService);
    repository = module.get(getRepositoryToken(JAC));
    rabbitMQService = module.get(RabbitMQService);
  });

  it('debería crear la JAC con estado inactiva por defecto', async () => {
    const dto: CreateJACDto = {
      asocomunalId: 7,
      tipo: TipoJAC.BARRIO,
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
