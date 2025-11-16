import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('submissions')
export class SubmissionsController {
  constructor(private service: SubmissionsService) {}

  @UseGuards(AuthGuard)
  @Post('request-upload')
  requestUpload(@Body() dto: RequestUploadDto, @Req() req: any) {
    return this.service.requestUpload(dto, req.user.id);
  }

  @UseGuards(AuthGuard)
  @Post('confirm')
  confirmUpload(@Body() dto: ConfirmUploadDto, @Req() req: any) {
    return this.service.confirmUpload(dto, req.user.id);
  }
}
