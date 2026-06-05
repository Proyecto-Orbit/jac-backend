import { Test, TestingModule } from '@nestjs/testing';
import { AfiliadosService } from './afiliados.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Persona } from './entities/persona.entity';
import { Cargo } from './entities/cargo.entity';
import { NotFoundException } from '@nestjs/common';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';

describe('AfiliadosService', () => {
  let service: AfiliadosService;

  // Mocks de repositorios
  const mockPersonaRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockCargoRepository = {
    find: jest.fn(),
  };

  // Datos simulados
  const mockCargo = {
    id: 1,
    nombre: 'Presidente',
  };

  const mockPersonaEntity = {
    id: 1,
    nombre: 'Juan',
    apellido: 'Perez',
    cedula: '123456789',
    lugarExpedicionCedula: 'Bogota',
    telefono: '3001234567',
    correo: 'juan@test.com',
    genero: 'M',
    grupoEtnico: 'Ninguno',
    fechaNacimiento: new Date('1990-01-01'),
    ocupacion: 'Ingeniero',
    estudiosRealizados: 'Pregrado',
    discapacitado: false,
    activo: true,
    cargoId: 1,
    jacId: 1,
    municipioId: 1,
    cargo: mockCargo,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AfiliadosService,
        {
          provide: getRepositoryToken(Persona),
          useValue: mockPersonaRepository,
        },
        {
          provide: getRepositoryToken(Cargo),
          useValue: mockCargoRepository,
        },
      ],
    }).compile();

    service = module.get<AfiliadosService>(AfiliadosService);
    
    // Limpiar mocks antes de cada prueba
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debe crear un afiliado correctamente y retornarlo como DTO', async () => {
      const createDto: CreatePersonaDto = {
        nombre: 'Juan',
        apellido: 'Perez',
        cedula: '123456789',
      };

      mockPersonaRepository.create.mockReturnValue(createDto);
      mockPersonaRepository.save.mockResolvedValue({ id: 1, ...createDto });
      mockPersonaRepository.findOne.mockResolvedValue(mockPersonaEntity);

      const result = await service.create(createDto);

      expect(mockPersonaRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockPersonaRepository.save).toHaveBeenCalledWith(createDto);
      expect(mockPersonaRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['cargo'],
      });
      
      expect(result).toBeDefined();
      expect(result.id).toEqual(1);
      expect(result.nombre).toEqual('Juan');
      expect(result.rol).toEqual('Presidente'); // Viene del mockCargo
    });
  });

  describe('findAll', () => {
    it('debe retornar un arreglo de afiliados', async () => {
      mockPersonaRepository.find.mockResolvedValue([mockPersonaEntity]);

      const result = await service.findAll();

      expect(mockPersonaRepository.find).toHaveBeenCalledWith({
        relations: ['cargo'],
        order: { apellido: 'ASC', nombre: 'ASC' },
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].nombre).toEqual('Juan');
    });
  });

  describe('findOne', () => {
    it('debe retornar un afiliado si existe', async () => {
      mockPersonaRepository.findOne.mockResolvedValue(mockPersonaEntity);

      const result = await service.findOne(1);

      expect(mockPersonaRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['cargo'],
      });
      expect(result).toBeDefined();
      expect(result.id).toEqual(1);
    });

    it('debe lanzar NotFoundException si el afiliado no existe', async () => {
      mockPersonaRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('debe actualizar el afiliado correctamente', async () => {
      const updateDto: UpdatePersonaDto = { nombre: 'Juan Modificado' };
      
      mockPersonaRepository.findOne
        .mockResolvedValueOnce(mockPersonaEntity) // Para verificar si existe
        .mockResolvedValueOnce({ ...mockPersonaEntity, nombre: 'Juan Modificado' }); // Para retornar el actualizado

      mockPersonaRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, updateDto);

      expect(mockPersonaRepository.update).toHaveBeenCalledWith({ id: 1 }, { nombre: 'Juan Modificado' });
      expect(result.nombre).toEqual('Juan Modificado');
    });

    it('debe retornar el mismo afiliado si no se envían datos', async () => {
      mockPersonaRepository.findOne.mockResolvedValue(mockPersonaEntity);

      const result = await service.update(1, {}); // DTO vacío

      expect(mockPersonaRepository.update).not.toHaveBeenCalled();
      expect(result.id).toEqual(1);
    });

    it('debe lanzar NotFoundException si se intenta actualizar a un afiliado que no existe', async () => {
      const updateDto: UpdatePersonaDto = { nombre: 'Juan Modificado' };
      mockPersonaRepository.findOne.mockResolvedValue(null);

      await expect(service.update(999, updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('debe desvincular a la persona de la JAC y el Cargo', async () => {
      mockPersonaRepository.findOne.mockResolvedValue(mockPersonaEntity);
      mockPersonaRepository.save.mockResolvedValue({ ...mockPersonaEntity, jacId: null, cargoId: null });

      const result = await service.remove(1);

      expect(mockPersonaRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPersonaRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        jacId: null,
        cargoId: null
      }));
      expect(result.message).toContain('desvinculado de la JAC correctamente');
    });

    it('debe lanzar NotFoundException si se intenta desvincular un afiliado que no existe', async () => {
      mockPersonaRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllCargos', () => {
    it('debe retornar el catálogo de cargos', async () => {
      mockCargoRepository.find.mockResolvedValue([mockCargo]);

      const result = await service.findAllCargos();

      expect(mockCargoRepository.find).toHaveBeenCalledWith({
        order: { nombre: 'ASC' },
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].nombre).toEqual('Presidente');
    });
  });
});
