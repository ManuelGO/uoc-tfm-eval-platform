// api/src/pits/dto/update-pit.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreatePitDto } from './create-pit.dto';

export class UpdatePitDto extends PartialType(CreatePitDto) {}
