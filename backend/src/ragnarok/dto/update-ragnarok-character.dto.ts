import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateRagnarokCharacterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  appearance?: string;

  @IsOptional()
  @IsIn(['M', 'F'])
  gender?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(15)
  hairStyle?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(15)
  hairColor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(15)
  clothesColor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  skinTone?: number;
}
