import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVttTokenDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  characterId?: string;

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
  @Max(6)
  size?: number;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  /** Raio de luz emitida, em células (tocha ≈ 4). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  lightRadius?: number;

  /** Visão no escuro, em células. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  visionRadius?: number;
}
