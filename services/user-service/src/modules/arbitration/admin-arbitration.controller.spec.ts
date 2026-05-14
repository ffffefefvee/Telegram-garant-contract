import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminArbitrationController } from './admin-arbitration.controller';
import { ROLES_KEY } from '../admin/decorators/roles.decorator';
import { Role } from '../admin/enums/role.enum';
import { RolesGuard } from '../admin/guards/roles.guard';

describe('AdminArbitrationController', () => {
  it('requires an admin role guard for every route', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminArbitrationController,
    ) as unknown[];

    expect(guards).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_KEY, AdminArbitrationController)).toEqual([
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);
  });
});
