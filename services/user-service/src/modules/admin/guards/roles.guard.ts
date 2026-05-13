import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const userRoles = normalizeRoles(user);
    const hasRole = requiredRoles.some((role) => userRoles.has(role));

    if (!hasRole) {
      throw new ForbiddenException(`Требуется одна из ролей: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}

function normalizeRoles(user: { role?: Role; roles?: Role[] }): Set<Role> {
  const roles = new Set<Role>();
  for (const role of user.roles ?? []) {
    roles.add(role);
  }
  if (user.role) {
    roles.add(user.role);
  }
  if (roles.size === 0) {
    roles.add(Role.USER);
  }
  return roles;
}
