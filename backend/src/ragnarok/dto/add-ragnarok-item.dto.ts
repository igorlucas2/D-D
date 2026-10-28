import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AddRagnarokItemDto {
  @IsInt()
  @Min(1)
  itemId!: number;

  @IsOptional()
  @IsBoolean()
  equipped?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  slot?: string;
}

export class UpdateRagnarokItemDto {
  @IsOptional()
  @IsBoolean()
  equipped?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  slot?: string;
}
