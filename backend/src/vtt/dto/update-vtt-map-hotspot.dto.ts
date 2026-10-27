import { JournalCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdateVttMapHotspotDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  x?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  y?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  color?: string;

  @IsOptional()
  @IsString()
  targetMapId?: string | null;

  @IsOptional()
  @IsBoolean()
  visibleToPlayers?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  travelActionCost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  travelMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  eventNote?: string | null;

  @IsOptional()
  @IsEnum(JournalCategory)
  triggerJournalCategory?: JournalCategory | null;
}
