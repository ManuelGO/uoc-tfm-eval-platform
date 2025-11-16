import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SesService } from './ses.service';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private ses: SesService,
  ) {}

  @Post('request')
  async requestLogin(@Body('email') email: string) {
    const token = this.auth.generateLoginToken(email);
    await this.ses.sendLoginEmail(email, token);
    return { message: 'Login email sent' };
  }

  @Get('verify')
  async verify(@Query('token') token: string) {
    const payload = this.auth.verifyLoginToken(token);

    // TODO: create or fetch user from DB (in API-3)
    const user = {
      id: 1,
      email: payload.email,
    };

    const sessionToken = this.auth.generateLoginToken(user.email);

    return {
      message: 'Authenticated',
      token: sessionToken,
      user,
    };
  }
}
