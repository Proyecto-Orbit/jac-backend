import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Persona } from '../src/afiliados/entities/persona.entity';
import { Cargo } from '../src/afiliados/entities/cargo.entity';
import { JAC } from '../src/jac/entities/jac.entity';
import { Asocomunal } from '../src/asocomunal/entities/asocomunal.entity';

describe('AfiliadosRepository (Integration with DB)', () => {
  let moduleFixture: TestingModule;
  let personaRepository: Repository<Persona>;
  let cargoRepository: Repository<Cargo>;
  let jacRepository: Repository<JAC>;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:', // Base de datos efímera en RAM
          dropSchema: true,
          entities: [Persona, Cargo, JAC, Asocomunal],
          synchronize: true, // Crea las tablas automáticamente
        }),
        TypeOrmModule.forFeature([Persona, Cargo, JAC, Asocomunal]),
      ],
    }).compile();

    personaRepository = moduleFixture.get<Repository<Persona>>(getRepositoryToken(Persona));
    cargoRepository = moduleFixture.get<Repository<Cargo>>(getRepositoryToken(Cargo));
    jacRepository = moduleFixture.get<Repository<JAC>>(getRepositoryToken(JAC));
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  beforeEach(async () => {
    await personaRepository.query('DELETE FROM persona;');
    await cargoRepository.query('DELETE FROM CARGO;');
    await jacRepository.query('DELETE FROM JAC;');
  });

  it('Debe guardar una Persona en la base de datos (create)', async () => {
    const persona = new Persona();
    persona.nombre = 'Ana';
    persona.apellido = 'Martínez';
    persona.cedula = '100200300';
    persona.correo = 'ana@test.com';
    persona.activo = true;

    const saved = await personaRepository.save(persona);

    expect(saved.id).toBeDefined();
    expect(saved.nombre).toBe('Ana');

    const count = await personaRepository.count();
    expect(count).toBe(1);
  });

  it('Debe permitir asociar un Cargo a una Persona (ManyToOne)', async () => {
    const cargo = await cargoRepository.save({
      nombre: 'Tesorero',
    });

    const persona = await personaRepository.save({
      nombre: 'Luis',
      apellido: 'Pérez',
      cedula: '555555',
      cargoId: cargo.id,
      activo: true,
    });

    const result = await personaRepository.findOne({
      where: { id: persona.id },
      relations: ['cargo'],
    });

    expect(result).not.toBeNull();
    expect(result?.cargo).toBeDefined();
    expect(result?.cargo?.nombre).toBe('Tesorero');
  });

  it('Debe ejecutar consultas complejas con QueryBuilder (buscar por cédula y estado)', async () => {
    await personaRepository.save([
      { nombre: 'Juan', apellido: 'Gómez', cedula: '111', activo: true },
      { nombre: 'Pedro', apellido: 'López', cedula: '222', activo: false },
      { nombre: 'Juanita', apellido: 'Pérez', cedula: '333', activo: true },
    ]);

    // Buscar personas activas cuyo nombre empieza por 'Juan'
    const resultados = await personaRepository
      .createQueryBuilder('persona')
      .where('persona.activo = :activo', { activo: true })
      .andWhere("persona.nombre LIKE 'Juan%'")
      .getMany();

    expect(resultados).toHaveLength(2); // Juan y Juanita
  });

  it('Debe actualizar el estado a falso para borrado lógico', async () => {
    const persona = await personaRepository.save({
      nombre: 'Carlos',
      apellido: 'Ruiz',
      cedula: '9999',
      activo: true as boolean,
    });

    // Simular soft delete
    persona.activo = false;
    await personaRepository.save(persona);

    const bdItem = await personaRepository.findOne({ where: { id: persona.id } });
    expect(bdItem?.activo).toBe(false);
  });
});
