// api/src/pits/dto/create-pit.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';

export class CreatePitDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  testCommand?: string; // e.g. "mvn -q test"

  @IsInt()
  @Min(1000)
  @IsOptional()
  maxTimeoutMs?: number; // e.g. 60000

  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  @IsOptional()
  setupCommands?: string[];
}
