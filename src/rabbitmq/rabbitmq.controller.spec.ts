import { Test, TestingModule } from '@nestjs/testing';
import { RabbitMQController } from './rabbitmq.controller';
import { AsocomunalService } from '../asocomunal/asocomunal.service';
import { JacService } from '../jac/jac.service';

describe('RabbitMQController', () => {
  let controller: RabbitMQController;
  let service: AsocomunalService;

  const mockAsocomunalService = {
    upsert: jest.fn(),
    remove: jest.fn(),
  };

  const mockJacService = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RabbitMQController],
      providers: [
        {
          provide: AsocomunalService,
          useValue: mockAsocomunalService,
        },
        {
          provide: JacService,
          useValue: mockJacService,
        },
      ],
    }).compile();

    controller = module.get<RabbitMQController>(RabbitMQController);
    service = module.get<AsocomunalService>(AsocomunalService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleAsocomunalEvent', () => {
    const basePayload = {
      id: 1,
      nombre: 'Test Asocomunal',
      municipioId: 5,
      municipioNombre: 'Test Municipio',
      estado: true,
    };

    it('should call upsert for "created" action', async () => {
      const data = { ...basePayload, action: 'created' as const };
      await controller.handleAsocomunalEvent(data);

      expect(service.upsert).toHaveBeenCalledWith({
        id: data.id,
        nombre: data.nombre,
        municipioId: data.municipioId,
        municipioNombre: data.municipioNombre,
        estado: data.estado,
      });
    });

    it('should call upsert for "updated" action', async () => {
      const data = { ...basePayload, action: 'updated' as const };
      await controller.handleAsocomunalEvent(data);

      expect(service.upsert).toHaveBeenCalledWith({
        id: data.id,
        nombre: data.nombre,
        municipioId: data.municipioId,
        municipioNombre: data.municipioNombre,
        estado: data.estado,
      });
    });

    it('should call remove for "deleted" action', async () => {
      const data = { ...basePayload, action: 'deleted' as const };
      await controller.handleAsocomunalEvent(data);

      expect(service.remove).toHaveBeenCalledWith(data.id);
    });

    it('should log warning for unknown action', async () => {
      const data = { ...basePayload, action: 'unknown' as any };
      const loggerSpy = jest.spyOn((controller as any).logger, 'warn');
      
      await controller.handleAsocomunalEvent(data);

      expect(service.upsert).not.toHaveBeenCalled();
      expect(service.remove).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should catch and log errors without throwing', async () => {
      const data = { ...basePayload, action: 'created' as const };
      mockAsocomunalService.upsert.mockRejectedValue(new Error('DB Error'));
      const loggerSpy = jest.spyOn((controller as any).logger, 'error');

      await expect(controller.handleAsocomunalEvent(data)).resolves.not.toThrow();
      expect(loggerSpy).toHaveBeenCalled();
    });
  });
});
