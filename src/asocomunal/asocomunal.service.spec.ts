import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AsocomunalService, AsocomunalEventPayload } from './asocomunal.service';
import { Asocomunal } from './entities/asocomunal.entity';
import { NotFoundException } from '@nestjs/common';

describe('AsocomunalService', () => {
  let service: AsocomunalService;
  let repository: Repository<Asocomunal>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsocomunalService,
        {
          provide: getRepositoryToken(Asocomunal),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AsocomunalService>(AsocomunalService);
    repository = module.get<Repository<Asocomunal>>(getRepositoryToken(Asocomunal));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsert', () => {
    it('should create and save an asocomunal', async () => {
      const payload: AsocomunalEventPayload = {
        id: 1,
        nombre: 'Asocomunal Test',
        municipioId: 10,
        municipioNombre: 'Municipio Test',
        estado: true,
      };

      const entity = { ...payload } as Asocomunal;
      mockRepository.create.mockReturnValue(entity);
      mockRepository.save.mockResolvedValue(entity);

      const result = await service.upsert(payload);

      expect(repository.create).toHaveBeenCalledWith(payload);
      expect(repository.save).toHaveBeenCalledWith(entity);
      expect(result).toEqual(entity);
    });
  });

  describe('remove', () => {
    it('should remove an existing asocomunal', async () => {
      const id = 1;
      const entity = { id, nombre: 'Test' } as Asocomunal;
      mockRepository.findOne.mockResolvedValue(entity);
      mockRepository.remove.mockResolvedValue(entity);

      await service.remove(id);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(repository.remove).toHaveBeenCalledWith(entity);
    });

    it('should throw NotFoundException if asocomunal does not exist', async () => {
      const id = 999;
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(id)).rejects.toThrow(NotFoundException);
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all asocomunales ordered by name', async () => {
      const entities = [{ id: 1, nombre: 'A' }, { id: 2, nombre: 'B' }];
      mockRepository.find.mockResolvedValue(entities);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({ order: { nombre: 'ASC' } });
      expect(result).toEqual(entities);
    });
  });
});
