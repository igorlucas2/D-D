import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VttLightingMode, VttMapKind, VttVisionMode } from '@prisma/client';
import { AMBIENCE_PRESETS } from '../vtt.types';

export class UpdateVttMapDto {
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(VttMapKind)
  kind?: VttMapKind;

  @IsOptional()
  @IsEnum(VttLightingMode)
  lightingMode?: VttLightingMode;

  // null volta ao padrao pelo tipo de mapa.
  @IsOptional()
  @IsIn([...AMBIENCE_PRESETS, null])
  ambiencePreset?: string | null;

  @IsOptional()
  @IsString()
  parentMapId?: string | null;

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

  @IsOptional()
  @IsEnum(VttVisionMode)
  vision?: VttVisionMode;

  /** Segmentos de parede/porta; cada um é validado em sanitizeWalls. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  walls?: unknown[];
}
