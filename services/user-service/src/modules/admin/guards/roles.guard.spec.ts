import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Repository } from 'typeorm';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AdminProfile } from '../entities/admin-profile.entity';
import { Role } from '../enums/role.enum';

describe('RolesGuard', () => {
  const handler = () => undefined;
  class TestController {}

  let findOne: jest.Mock;
  let guard: RolesGuard;

  const contextFor = (user?: { id: string }): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    Reflect.defineMetadata(ROLES_KEY, [Role.ADMIN, Role.SUPER_ADMIN], TestController);
    findOne = jest.fn();
    guard = new RolesGuard(
      new Reflector(),
      { findOne } as unknown as Repository<AdminProfile>,
    );
  });

  afterEach(() => {
    Reflect.deleteMetadata(ROLES_KEY, TestController);
  });

  it('denies authenticated users without an active admin profile', async () => {
    findOne.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor({ id: 'user-1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', isActive: true },
    });
  });

  it('allows active admin profiles with a required role', async () => {
    findOne.mockResolvedValue({ role: Role.ADMIN });

    await expect(guard.canActivate(contextFor({ id: 'admin-1' }))).resolves.toBe(true);
  });

  it('rejects requests without an authenticated user', async () => {
    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findOne).not.toHaveBeenCalled();
  });
});
