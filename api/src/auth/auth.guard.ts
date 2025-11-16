import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'] || request.headers['Authorization'];

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

      // Recuperar el usuario desde la BD
      const user = await this.users.findOrCreateByEmail(payload.email);

      // Adjuntar el usuario a la request para usarlo en los controladores
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
