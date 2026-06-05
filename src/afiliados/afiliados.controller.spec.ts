import { Test, TestingModule } from '@nestjs/testing';
import { AfiliadosController } from './afiliados.controller';
import { AfiliadosService } from './afiliados.service';
import { ImportarAfiliadosService } from './importar/importar-afiliados.service';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import { PersonaResponseDto } from './dto/persona-response.dto';
import { Cargo } from './entities/cargo.entity';
import { BadRequestException } from '@nestjs/common';

describe('AfiliadosController', () => {
  let controller: AfiliadosController;
  let afiliadosService: AfiliadosService;
  let importarAfiliadosService: ImportarAfiliadosService;

  const mockPersonaResponse: PersonaResponseDto = {
    id: 1,
    nombre: 'Juan',
    apellido: 'Perez',
    cedula: '123456789',
    lugarExpedicionCedula: null,
    telefono: null,
    correo: null,
    documento: null,
    municipioId: null,
    jacId: 1,
    cargoId: 1,
    rol: 'Presidente',
    genero: null,
    grupoEtnico: null,
    fechaNacimiento: null,
    ocupacion: null,
    estudiosRealizados: null,
    discapacitado: null,
  };

  const mockCargo: Cargo = {
    id: 1,
    nombre: 'Presidente',
    personas: []
  };

  const mockAfiliadosService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findAllCargos: jest.fn(),
  };

  const mockImportarAfiliadosService = {
    importarExcel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AfiliadosController],
      providers: [
        {
          provide: AfiliadosService,
          useValue: mockAfiliadosService,
        },
        {
          provide: ImportarAfiliadosService,
          useValue: mockImportarAfiliadosService,
        },
      ],
    }).compile();

    controller = module.get<AfiliadosController>(AfiliadosController);
    afiliadosService = module.get<AfiliadosService>(AfiliadosService);
    importarAfiliadosService = module.get<ImportarAfiliadosService>(ImportarAfiliadosService);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('debe llamar a afiliadosService.create y retornar el resultado', async () => {
      const createDto: CreatePersonaDto = { nombre: 'Juan', apellido: 'Perez', cedula: '123456789' };
      mockAfiliadosService.create.mockResolvedValue(mockPersonaResponse);

      const result = await controller.create(createDto);

      expect(afiliadosService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockPersonaResponse);
    });
  });

  describe('findAll', () => {
    it('debe llamar a afiliadosService.findAll y retornar un arreglo', async () => {
      mockAfiliadosService.findAll.mockResolvedValue([mockPersonaResponse]);

      const result = await controller.findAll();

      expect(afiliadosService.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockPersonaResponse]);
    });
  });

  describe('findAllCargos', () => {
    it('debe llamar a afiliadosService.findAllCargos y retornar catálogo', async () => {
      mockAfiliadosService.findAllCargos.mockResolvedValue([mockCargo]);

      const result = await controller.findAllCargos();

      expect(afiliadosService.findAllCargos).toHaveBeenCalled();
      expect(result).toEqual([mockCargo]);
    });
  });

  describe('findOne', () => {
    it('debe llamar a afiliadosService.findOne con el id correcto', async () => {
      mockAfiliadosService.findOne.mockResolvedValue(mockPersonaResponse);

      const result = await controller.findOne(1);

      expect(afiliadosService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockPersonaResponse);
    });
  });

  describe('update', () => {
    it('debe llamar a afiliadosService.update con el id y dto correctos', async () => {
      const updateDto: UpdatePersonaDto = { nombre: 'Juan Editado' };
      mockAfiliadosService.update.mockResolvedValue({ ...mockPersonaResponse, nombre: 'Juan Editado' });

      const result = await controller.update(1, updateDto);

      expect(afiliadosService.update).toHaveBeenCalledWith(1, updateDto);
      expect(result.nombre).toEqual('Juan Editado');
    });
  });

  describe('remove', () => {
    it('debe llamar a afiliadosService.remove con el id correcto', async () => {
      const mockResponse = { message: 'Desvinculado correctamente' };
      mockAfiliadosService.remove.mockResolvedValue(mockResponse);

      const result = await controller.remove(1);

      expect(afiliadosService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('importarExcel', () => {
    it('debe llamar a importarAfiliadosService.importarExcel si es un archivo xlsx', async () => {
      const fileMock = { originalname: 'datos.xlsx', buffer: Buffer.from('test') } as Express.Multer.File;
      const bodyMock = { jacId: 1 };
      const expectedResult = { agregados: 5, actualizados: 0, errores: [] };

      mockImportarAfiliadosService.importarExcel.mockResolvedValue(expectedResult);

      const result = await controller.importarExcel(fileMock, bodyMock);

      expect(importarAfiliadosService.importarExcel).toHaveBeenCalledWith(fileMock.buffer, 1);
      expect(result).toEqual(expectedResult);
    });

    it('debe lanzar BadRequestException si el archivo no es .xlsx', async () => {
      const fileMock = { originalname: 'documento.pdf', buffer: Buffer.from('test') } as Express.Multer.File;
      const bodyMock = { jacId: 1 };

      await expect(controller.importarExcel(fileMock, bodyMock)).rejects.toThrow(BadRequestException);
      expect(importarAfiliadosService.importarExcel).not.toHaveBeenCalled();
    });
  });
});
