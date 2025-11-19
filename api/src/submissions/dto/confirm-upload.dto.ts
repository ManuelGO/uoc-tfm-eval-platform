import { IsUUID, IsString } from 'class-validator';

export class ConfirmUploadDto {
  @IsUUID()
  pitId: string;

  @IsString()
  fileKey: string;
}
