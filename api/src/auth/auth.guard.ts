import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization format');
    }

    try {
      const payload = this.jwt.verify<{ email: string }>(token);

      if (!payload?.email) {
        throw new UnauthorizedException('Invalid token payload');
      }

      const user = await this.users.findOrCreateByEmail(payload.email);

      request.user = {
        id: user.id,
        email: user.email,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
