import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums/role.enum';

describe('RolesGuard', () => {
  const handler = () => undefined;
  class Controller {}

  let getAllAndOverride: jest.Mock;
  let guard: RolesGuard;

  const contextFor = (user: unknown): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => Controller,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    getAllAndOverride = jest.fn();
    guard = new RolesGuard({
      getAllAndOverride,
    } as unknown as Reflector);
  });

  it('allows a user whose roles array contains an allowed role', () => {
    getAllAndOverride.mockReturnValue([Role.ADMIN, Role.SUPER_ADMIN]);

    expect(guard.canActivate(contextFor({ roles: [Role.ADMIN] }))).toBe(true);
  });

  it('allows the legacy singular role field for existing request mocks', () => {
    getAllAndOverride.mockReturnValue([Role.SUPER_ADMIN]);

    expect(guard.canActivate(contextFor({ role: Role.SUPER_ADMIN }))).toBe(true);
  });

  it('denies normal users from admin-only routes', () => {
    getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(() => guard.canActivate(contextFor({ roles: [Role.USER] }))).toThrow(
      ForbiddenException,
    );
  });
});
