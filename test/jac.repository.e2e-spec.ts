import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { JAC, EstadoJAC, TipoJAC } from '../src/jac/entities/jac.entity';
import { Persona } from '../src/afiliados/entities/persona.entity';
import { Asocomunal } from '../src/asocomunal/entities/asocomunal.entity';
import { Cargo } from '../src/afiliados/entities/cargo.entity';

describe('JacRepository (Integration with DB)', () => {
  let moduleFixture: TestingModule;
  let jacRepository: Repository<JAC>;
  let personaRepository: Repository<Persona>;
  let asocomunalRepository: Repository<Asocomunal>;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:', // Base de datos efímera en RAM
          dropSchema: true,
          entities: [JAC, Persona, Asocomunal, Cargo],
          synchronize: true, // Crea las tablas automáticamente
        }),
        TypeOrmModule.forFeature([JAC, Persona, Asocomunal, Cargo]),
      ],
    }).compile();

    jacRepository = moduleFixture.get<Repository<JAC>>(getRepositoryToken(JAC));
    personaRepository = moduleFixture.get<Repository<Persona>>(getRepositoryToken(Persona));
    asocomunalRepository = moduleFixture.get<Repository<Asocomunal>>(getRepositoryToken(Asocomunal));
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  beforeEach(async () => {
    await personaRepository.query('DELETE FROM persona;');
    await jacRepository.query('DELETE FROM JAC;');
    await asocomunalRepository.query('DELETE FROM ASOCOMUNAL;');
  });

  it('Debe guardar una JAC en la base de datos (create)', async () => {
    const jac = new JAC();
    jac.nombreCompleto = 'JAC Barrio El Pino';
    jac.nombreCorto = 'El Pino';
    jac.tipo = TipoJAC.BARRIO;
    jac.estado = EstadoJAC.ACTIVA;
    jac.numeroRUC = 'RUC-12345';
    jac.numeroPersoneriaJuridica = 'PJ-987';

    const saved = await jacRepository.save(jac);

    expect(saved.id).toBeDefined();
    expect(saved.nombreCompleto).toBe('JAC Barrio El Pino');

    const count = await jacRepository.count();
    expect(count).toBe(1);
  });

  it('Debe permitir asociar una JAC a una Asocomunal (FK)', async () => {
    const aso = await asocomunalRepository.save({
      id: 999, // PrimaryColumn needs explicit ID
      nombre: 'Asocomunal Popayán',
      municipioId: 1,
      estado: true,
    });

    const jac = await jacRepository.save({
      nombreCompleto: 'JAC Centro',
      tipo: TipoJAC.BARRIO,
      estado: EstadoJAC.ACTIVA,
      asocomunalId: aso.id,
    });

    const result = await jacRepository.findOne({
      where: { id: jac.id },
      relations: ['asocomunal'],
    });

    expect(result).not.toBeNull();
    expect(result?.asocomunal).toBeDefined();
    expect(result?.asocomunal?.nombre).toBe('Asocomunal Popayán');
  });

  it('Debe ejecutar consultas complejas con QueryBuilder (filtros)', async () => {
    await jacRepository.save([
      { nombreCompleto: 'JAC Norte', estado: EstadoJAC.ACTIVA, tipo: TipoJAC.BARRIO, numeroRUC: 'R1' },
      { nombreCompleto: 'JAC Sur', estado: EstadoJAC.INACTIVA, tipo: TipoJAC.BARRIO, numeroRUC: null },
      { nombreCompleto: 'JAC Este', estado: EstadoJAC.ACTIVA, tipo: TipoJAC.VEREDA, numeroRUC: 'R3' },
    ]);

    // Buscar activas con RUC
    const countQuery = await jacRepository
      .createQueryBuilder('jac')
      .where('jac.estado = :estado', { estado: EstadoJAC.ACTIVA })
      .andWhere("jac.numero_ruc IS NOT NULL")
      .getCount();

    expect(countQuery).toBe(2); // Norte y Este
  });

  it('Debe guardar y recuperar personas afiliadas a la JAC (OneToMany)', async () => {
    const jac = await jacRepository.save({
      nombreCompleto: 'JAC Los Álamos',
      tipo: TipoJAC.BARRIO,
    });

    await personaRepository.save({
      nombre: 'María',
      apellido: 'Gómez',
      cedula: '1111',
      jacId: jac.id,
    });

    const result = await jacRepository.findOne({
      where: { id: jac.id },
      relations: ['personas'],
    });

    expect(result?.personas).toHaveLength(1);
    expect(result?.personas[0].nombre).toBe('María');
  });
});
