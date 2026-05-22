import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ROLES_KEY } from './auth.decorator';
import { Role } from './role.enum';
import { KeycloakKeyService } from './keycloak-key.service';

interface JwtPayload {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly keycloakKeyService: KeycloakKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    const token = this.extractToken(authHeader);

    if (!token) {
      throw new UnauthorizedException('Token de autenticación no proporcionado');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: await this.keycloakKeyService.getPublicKey(),
        algorithms: ['RS256'],
      });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const roles = payload.realm_access?.roles ?? [];
    const role: Role = this.mapRole(roles);

    if (!role) {
      throw new UnauthorizedException('No se encontró el rol en el token');
    }

    // superadmin tiene acceso a todo; otros roles se verifican contra la lista requerida
    if (role !== Role.SUPERADMIN && !requiredRoles.includes(role)) {
      throw new ForbiddenException(
        `El rol '${role}' no tiene permiso para realizar esta acción`,
      );
    }

    (request as Request & { user: { sub: string; email?: string; nombre: string; rol: Role } }).user = {
      sub: payload.sub,
      email: payload.email,
      nombre: payload.name ?? payload.preferred_username ?? payload.email ?? '',
      rol: role,
    };

    return true;
  }

  private extractToken(authHeader?: string): string | null {
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');
    if (type === 'Bearer' && token) {
      return token;
    }

    return null;
  }

  private mapRole(roles: string[]): Role {
    if (roles.includes('superadmin')) return Role.SUPERADMIN;
    if (roles.includes('admin')) return Role.ADMIN;
    if (roles.includes('operador')) return Role.OPERADOR;
    return Role.USUARIO;
  }
}
