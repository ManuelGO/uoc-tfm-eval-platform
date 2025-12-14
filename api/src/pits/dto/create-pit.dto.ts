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
  testCommand?: string;

  @IsInt()
  @Min(1000)
  @IsOptional()
  maxTimeoutMs?: number;

  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  @IsOptional()
  setupCommands?: string[];
}
