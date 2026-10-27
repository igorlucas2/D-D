import { JournalCategory } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateJournalEntryDto {
  @IsString()
  @MaxLength(150)
  title: string;

  @IsString()
  @MaxLength(10000)
  content: string;

  @IsOptional()
  @IsEnum(JournalCategory)
  category?: JournalCategory;

  @IsOptional()
  @IsDateString()
  sessionDate?: string;
}
