import {
  IsArray,
  IsEnum,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VttMapKind } from '@prisma/client';

export class CreateVttMapDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsEnum(VttMapKind)
  kind?: VttMapKind;

  @IsOptional()
  @IsString()
  parentMapId?: string;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(80)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(60)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  gridSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsHexColor()
  gridColor?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fogCells?: string[];
}
