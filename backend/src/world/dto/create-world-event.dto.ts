import { JournalCategory } from '@prisma/client';
import { WEATHERS, type Weather } from '../world.types';
import {
  IsBoolean,
  IsIn,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWorldEventDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsEnum(JournalCategory)
  category?: JournalCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Clima aplicado à campanha quando o evento é sorteado; null = nenhum. */
  @IsOptional()
  @IsIn([...WEATHERS, null])
  weatherEffect?: Weather | null;
}
