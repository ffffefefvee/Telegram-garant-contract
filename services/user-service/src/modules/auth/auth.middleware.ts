import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response, NextFunction } from 'express';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { AdminProfile } from '../admin/entities/admin-profile.entity';
import { Role } from '../admin/enums/role.enum';

export interface UserPayload {
  id: string;
  telegramId: number | null;
  telegramUsername: string | null;
  telegramLanguageCode: string | null;
  roles: Role[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

/**
 * Backend auth middleware. Expects every protected request to carry a
 * `Authorization: Bearer <jwt>` header issued by `POST /api/auth/telegram`.
 *
 * The JWT carries `{ sub: userUuid, tg: telegramId }`. We verify the
 * signature, then load the User record by `sub` to attach the canonical
 * payload (including `walletAddress`, which is the most-frequently-needed
 * extra field for downstream handlers).
 *
 * In tests / dev where the User table is in-memory, callers can disable the
 * middleware by leaving the header unset on the route; we 401 in that case.
 */
@Injectable()
export class RequireAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequireAuthMiddleware.name);

  constructor(
    private readonly auth: AuthService,
    private readonly users: UserService,
    @InjectRepository(AdminProfile)
    private readonly adminProfiles: Repository<AdminProfile>,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Empty Bearer token');
    }

    const payload = this.auth.verifyToken(token);
    const user = await this.users.findById(payload.sub).catch(() => null);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roles = new Set<Role>();
    for (const role of user.roles ?? []) {
      if (isKnownRole(role)) {
        roles.add(role);
      }
    }

    const adminProfile = await this.adminProfiles.findOne({
      where: { userId: user.id, isActive: true },
    });
    if (adminProfile) {
      roles.add(adminProfile.role);
    }

    req.user = {
      id: user.id,
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      telegramLanguageCode: user.telegramLanguageCode,
      roles: [...roles],
    };
    next();
  }
}

function isKnownRole(role: string): role is Role {
  return Object.values(Role).includes(role as Role);
}
