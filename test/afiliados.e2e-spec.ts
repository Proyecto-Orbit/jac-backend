import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Reflector } from '@nestjs/core';
import { APP_GUARD } from '@nestjs/core';

import { AfiliadosController } from '../src/afiliados/afiliados.controller';
import { AfiliadosService } from '../src/afiliados/afiliados.service';
import { ImportarAfiliadosService } from '../src/afiliados/importar/importar-afiliados.service';
import { ROLES_KEY } from '../src/auth/auth.decorator';
import { Role } from '../src/auth/role.enum';
import { RolesGuard } from '../src/auth/roles.guard';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPersonaResponse = {
  id: 1,
  nombres: 'Juan',
  apellidos: 'Pérez',
  tipoDocumento: 'CC',
  numeroDocumento: '12345678',
  fechaNacimiento: '1990-01-01',
  lugarExpedicion: 'Bogotá',
  direccionResidencia: 'Calle 123',
  telefono: '3001234567',
  correo: 'juan@test.com',
  profesionOcupacion: 'Ingeniero',
  comisionTrabajo: 'Educación',
  jacId: 1,
};

const mockAfiliadosService = {
  create: jest.fn().mockResolvedValue(mockPersonaResponse),
  findAll: jest.fn().mockResolvedValue([mockPersonaResponse]),
  findAllCargos: jest.fn().mockResolvedValue([{ id: 1, nombre: 'Presidente' }]),
  findOne: jest.fn().mockResolvedValue(mockPersonaResponse),
  update: jest.fn().mockResolvedValue({ ...mockPersonaResponse, nombres: 'Editado' }),
  remove: jest.fn().mockResolvedValue({ message: 'Afiliado eliminado correctamente' }),
};

const mockImportarService = {
  importarExcel: jest.fn().mockResolvedValue({ agregados: 1, actualizados: 0 }),
};

// ─── Guard Simplificado ────────────────────────────────────────────────────

@Injectable()
class TestRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No requiere rol
    }

    const req = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const tokenParts = authHeader.split(' ');
    const rolSimulado = tokenParts[1] as Role;

    if (rolSimulado !== Role.SUPERADMIN && !requiredRoles.includes(rolSimulado)) {
      throw new ForbiddenException(`El rol '${rolSimulado}' no tiene permiso`);
    }

    (req as any).user = {
      sub: 'test-user',
      email: `${rolSimulado}@test.com`,
      nombre: `Usuario ${rolSimulado}`,
      rol: rolSimulado,
    };

    return true;
  }
}

// ─── Suite de integración ───────────────────────────────────────────────────

describe('AfiliadosController (Integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AfiliadosController],
      providers: [
        { provide: AfiliadosService, useValue: mockAfiliadosService },
        { provide: ImportarAfiliadosService, useValue: mockImportarService },
        Reflector,
        { provide: APP_GUARD, useClass: TestRolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Pruebas sin token (401 Unauthorized) ─────────────────────────────────
  
  describe('Pruebas sin token (401)', () => {
    it('GET /afiliados', () => request(app.getHttpServer()).get('/afiliados').expect(401));
    it('POST /afiliados', () => request(app.getHttpServer()).post('/afiliados').send({}).expect(401));
    it('GET /afiliados/1', () => request(app.getHttpServer()).get('/afiliados/1').expect(401));
  });

  // ── Pruebas con token (y roles) ─────────────────────────────────────────

  describe('Pruebas con tokens válidos y roles', () => {
    it('GET /afiliados → 200 (como operador)', async () => {
      const res = await request(app.getHttpServer())
        .get('/afiliados')
        .set('Authorization', `Bearer ${Role.OPERADOR}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(mockAfiliadosService.findAll).toHaveBeenCalledTimes(1);
    });

    it('GET /afiliados/catalogo/cargos → 200 (como operador)', async () => {
      const res = await request(app.getHttpServer())
        .get('/afiliados/catalogo/cargos')
        .set('Authorization', `Bearer ${Role.OPERADOR}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(mockAfiliadosService.findAllCargos).toHaveBeenCalledTimes(1);
    });

    it('GET /afiliados/1 → 200 (como operador)', async () => {
      const res = await request(app.getHttpServer())
        .get('/afiliados/1')
        .set('Authorization', `Bearer ${Role.OPERADOR}`)
        .expect(200);

      expect(res.body.id).toBe(1);
      expect(mockAfiliadosService.findOne).toHaveBeenCalledWith(1);
    });

    it('POST /afiliados → 403 (un operador no puede crear afiliados)', async () => {
      await request(app.getHttpServer())
        .post('/afiliados')
        .set('Authorization', `Bearer ${Role.OPERADOR}`)
        .send(mockPersonaResponse)
        .expect(403);
    });

    it('POST /afiliados → 201 (como admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/afiliados')
        .set('Authorization', `Bearer ${Role.ADMIN}`)
        .send(mockPersonaResponse)
        .expect(201);

      expect(res.body.id).toBe(1);
      expect(mockAfiliadosService.create).toHaveBeenCalled();
    });

    it('PATCH /afiliados/1 → 200 (como admin)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/afiliados/1')
        .set('Authorization', `Bearer ${Role.ADMIN}`)
        .send({ nombres: 'Editado' })
        .expect(200);

      expect(res.body.nombres).toBe('Editado');
      expect(mockAfiliadosService.update).toHaveBeenCalled();
    });

    it('DELETE /afiliados/1 → 200 (como admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/afiliados/1')
        .set('Authorization', `Bearer ${Role.ADMIN}`)
        .expect(200);

      expect(res.body.message).toBeDefined();
      expect(mockAfiliadosService.remove).toHaveBeenCalledWith(1);
    });
  });
});
