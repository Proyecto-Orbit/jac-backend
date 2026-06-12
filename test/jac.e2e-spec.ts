import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Reflector } from '@nestjs/core';
import { APP_GUARD } from '@nestjs/core';

import { JacController } from '../src/jac/jac.controller';
import { JacService } from '../src/jac/jac.service';
import { ROLES_KEY } from '../src/auth/auth.decorator';
import { Role } from '../src/auth/role.enum';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockJacItem = {
  id: 1,
  nombre: 'JAC El Carmelo',
  estado: 'activa',
  municipio: { id: 1, nombre: 'Popayán' },
};

const mockJacService = {
  create: jest.fn().mockResolvedValue(mockJacItem),
  getPublicStats: jest.fn().mockResolvedValue({ totalJacs: 10 }),
  getEstadosResumen: jest.fn().mockResolvedValue({ activa: 5, inactiva: 5 }),
  searchPublic: jest.fn().mockResolvedValue([mockJacItem]),
  findAllPublic: jest.fn().mockResolvedValue([mockJacItem]),
  findAllWithAsocomunalNull: jest.fn().mockResolvedValue([mockJacItem]),
  findOnePublic: jest.fn().mockResolvedValue(mockJacItem),
  findAll: jest.fn().mockResolvedValue([mockJacItem]),
  search: jest.fn().mockResolvedValue([mockJacItem]),
  getAlertasResumen: jest.fn().mockResolvedValue({ riesgo_activa: 2 }),
  getAlertas: jest.fn().mockResolvedValue({ data: [mockJacItem], total: 1 }),
  findOne: jest.fn().mockResolvedValue(mockJacItem),
  update: jest.fn().mockResolvedValue({ ...mockJacItem, nombre: 'JAC Editada' }),
  remove: jest.fn().mockResolvedValue({ message: 'JAC eliminada' }),
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
      return true; // Endpoints públicos
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

describe('JacController (Integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [JacController],
      providers: [
        { provide: JacService, useValue: mockJacService },
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

  // ── Pruebas Endpoints Públicos (Sin Token) ────────────────────────────────
  
  describe('Endpoints Públicos (No requieren token)', () => {
    it('GET /jac/public/stats → 200', () => 
      request(app.getHttpServer()).get('/jac/public/stats').expect(200));

    it('GET /jac/public/estados/resumen → 200', () => 
      request(app.getHttpServer()).get('/jac/public/estados/resumen').expect(200));

    it('GET /jac/public/buscar → 200', () => 
      request(app.getHttpServer()).get('/jac/public/buscar?nombre=Test').expect(200));

    it('GET /jac/public → 200', () => 
      request(app.getHttpServer()).get('/jac/public').expect(200));

    it('GET /jac/public/1 → 200', () => 
      request(app.getHttpServer()).get('/jac/public/1').expect(200));
  });

  // ── Pruebas Endpoints Privados sin token (401) ───────────────────────────

  describe('Endpoints Privados sin token (401)', () => {
    it('GET /jac → 401', () => request(app.getHttpServer()).get('/jac').expect(401));
    it('POST /jac → 401', () => request(app.getHttpServer()).post('/jac').send({}).expect(401));
    it('PATCH /jac/1 → 401', () => request(app.getHttpServer()).patch('/jac/1').send({}).expect(401));
    it('DELETE /jac/1 → 401', () => request(app.getHttpServer()).delete('/jac/1').expect(401));
  });

  // ── Pruebas con token (y roles) ─────────────────────────────────────────

  describe('Pruebas con tokens válidos y roles', () => {
    it('GET /jac → 200 (como operador)', async () => {
      const res = await request(app.getHttpServer())
        .get('/jac')
        .set('Authorization', `Bearer ${Role.OPERADOR}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(mockJacService.findAll).toHaveBeenCalledTimes(1);
    });

    it('GET /jac/without-asocomunal → 200 (como operador)', async () => {
      await request(app.getHttpServer())
        .get('/jac/without-asocomunal')
        .set('Authorization', `Bearer ${Role.OPERADOR}`)
        .expect(200);
      expect(mockJacService.findAllWithAsocomunalNull).toHaveBeenCalledTimes(1);
    });

    it('GET /jac/alertas/resumen → 200 (como operador)', async () => {
      await request(app.getHttpServer())
        .get('/jac/alertas/resumen')
        .set('Authorization', `Bearer ${Role.OPERADOR}`)
        .expect(200);
      expect(mockJacService.getAlertasResumen).toHaveBeenCalled();
    });

    it('GET /jac/alertas → 200 (como operador)', async () => {
      await request(app.getHttpServer())
        .get('/jac/alertas?categoria=riesgo_activa')
        .set('Authorization', `Bearer ${Role.OPERADOR}`)
        .expect(200);
      expect(mockJacService.getAlertas).toHaveBeenCalled();
    });

    it('POST /jac → 201 (como admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/jac')
        .set('Authorization', `Bearer ${Role.ADMIN}`)
        .send(mockJacItem)
        .expect(201);

      expect(res.body.id).toBe(1);
      expect(mockJacService.create).toHaveBeenCalled();
    });

    it('PATCH /jac/1 → 403 (un operador no puede editar)', async () => {
      await request(app.getHttpServer())
        .patch('/jac/1')
        .set('Authorization', `Bearer ${Role.OPERADOR}`)
        .send({ nombre: 'Editado' })
        .expect(403);
    });

    it('PATCH /jac/1 → 200 (como admin)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/jac/1')
        .set('Authorization', `Bearer ${Role.ADMIN}`)
        .send({ nombre: 'Editado' })
        .expect(200);

      expect(res.body.nombre).toBe('JAC Editada');
      expect(mockJacService.update).toHaveBeenCalled();
    });

    it('DELETE /jac/1 → 200 (como admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/jac/1')
        .set('Authorization', `Bearer ${Role.ADMIN}`)
        .expect(200);

      expect(res.body.message).toBeDefined();
      expect(mockJacService.remove).toHaveBeenCalledWith(1);
    });
  });
});
