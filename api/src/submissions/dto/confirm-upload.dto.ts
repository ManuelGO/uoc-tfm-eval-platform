import { IsUUID, IsString } from 'class-validator';

export class ConfirmUploadDto {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @IsUUID()
  pitId: string;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @IsString()
  fileKey: string;
}
