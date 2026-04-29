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

interface JwtPayload {
  sub: string;
  email: string;
  nombre: string;
  rol: string;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const cookieName = process.env.COOKIE_NAME ?? 'token';
    const token: string | undefined = (request.cookies as Record<string, string>)?.[cookieName];

    if (!token) {
      throw new UnauthorizedException('Token de autenticación no proporcionado');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const userRole = payload.rol as Role;

    if (!userRole) {
      throw new UnauthorizedException('No se encontró el rol en el token');
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        `El rol '${userRole}' no tiene permiso para realizar esta acción`,
      );
    }

    (request as Request & { user: JwtPayload }).user = payload;
    return true;
  }
}
