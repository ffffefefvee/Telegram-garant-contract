import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AdminProfile } from '../entities/admin-profile.entity';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(AdminProfile)
    private readonly adminProfiles: Repository<AdminProfile>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Предполагается, что user уже добавлен в request после AuthMiddleware

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const profile = await this.adminProfiles.findOne({
      where: { userId: user.id, isActive: true },
    });
    const userRole: Role = profile?.role || Role.USER;

    const hasRole = requiredRoles.some((role) => userRole === role);
    
    if (!hasRole) {
      throw new ForbiddenException(`Требуется одна из ролей: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
