import { IsUUID } from 'class-validator';

export class RequestUploadDto {
  @IsUUID()
  pitId: string;
}
