import { WorldEntryType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWorldEntryDto {
  @IsOptional()
  @IsEnum(WorldEntryType)
  type?: WorldEntryType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @IsOptional()
  @IsString()
  parentId?: string | null;
}
