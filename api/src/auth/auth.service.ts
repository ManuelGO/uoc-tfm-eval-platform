import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}

  generateLoginToken(email: string) {
    return this.jwt.sign({ email }, { expiresIn: '24h' });
  }

  verifyLoginToken(token: string): { email: string } {
    try {
      return this.jwt.verify(token);
    } catch (err) {
      console.error(err);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
