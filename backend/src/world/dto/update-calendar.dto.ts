import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdateCalendarDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @IsString({ each: true })
  monthNames?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @IsInt({ each: true })
  @Min(1, { each: true })
  daysPerMonth?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(14)
  @IsString({ each: true })
  weekdayNames?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  currentDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  currentMonth?: number;

  @IsOptional()
  @IsInt()
  currentYear?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  currentHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  currentMinute?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  realMinutesPerTick?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  gameMinutesPerTick?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  eventChancePercent?: number;

  /** Revisão que o cliente leu; divergência devolve 409. */
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;
}
