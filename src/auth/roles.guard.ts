import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from './auth.decorator';
import { Role } from './role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      throw new UnauthorizedException('No se encontró la cookie de autenticación');
    }

    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [key, ...val] = c.trim().split('=');
        return [key.trim(), decodeURIComponent(val.join('='))];
      }),
    );

    const userRole = cookies['rol'] as Role;

    if (!userRole) {
      throw new UnauthorizedException('No se encontró el rol en la cookie');
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        `El rol '${userRole}' no tiene permiso para realizar esta acción`,
      );
    }

    return true;
  }
}
