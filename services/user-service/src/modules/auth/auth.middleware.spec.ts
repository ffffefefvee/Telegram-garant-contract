import { RequireAuthMiddleware } from './auth.middleware';
import { Role } from '../admin/enums/role.enum';

describe('RequireAuthMiddleware', () => {
  it('attaches active admin profile roles to the request user', async () => {
    const middleware = new RequireAuthMiddleware(
      { verifyToken: jest.fn().mockReturnValue({ sub: 'user-1' }) } as any,
      {
        findById: jest.fn().mockResolvedValue({
          id: 'user-1',
          telegramId: 123,
          telegramUsername: 'alice',
          telegramLanguageCode: 'en',
          roles: ['buyer', Role.ADMIN],
        }),
      } as any,
      {
        findOne: jest.fn().mockResolvedValue({
          userId: 'user-1',
          role: Role.SUPER_ADMIN,
          isActive: true,
        }),
      } as any,
    );
    const req = {
      headers: { authorization: 'Bearer signed-token' },
    } as any;
    const next = jest.fn();

    await middleware.use(req, {} as any, next);

    expect(req.user).toMatchObject({
      id: 'user-1',
      telegramId: 123,
      telegramUsername: 'alice',
      telegramLanguageCode: 'en',
      roles: [Role.ADMIN, Role.SUPER_ADMIN],
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
