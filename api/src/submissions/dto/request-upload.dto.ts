import { IsUUID } from 'class-validator';

export class RequestUploadDto {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @IsUUID()
  pitId: string;
}
