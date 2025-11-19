import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  @UseGuards(AuthGuard)
  @Post('request-upload')
  requestUpload(
    @Body() dto: RequestUploadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user?.id) {
      throw new Error('Missing authenticated user');
    }

    return this.service.requestUpload(dto, req.user.id);
  }

  @UseGuards(AuthGuard)
  @Post('confirm')
  confirmUpload(
    @Body() dto: ConfirmUploadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user?.id) {
      throw new Error('Missing authenticated user');
    }

    return this.service.confirmUpload(dto, req.user.id);
  }
}
