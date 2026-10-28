import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GrantItemDto {
  @IsString()
  @MaxLength(191)
  characterId!: string;

  @IsString()
  @MaxLength(191)
  itemId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;
}

export class LevelUpDto {
  @IsString()
  @MaxLength(191)
  characterId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  level!: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  className?: string;
}
