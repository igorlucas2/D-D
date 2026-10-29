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

export class CreateRagnarokCharacterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  // Mantido por compatibilidade; o servidor sempre cria Aprendiz.
  @IsOptional()
  @IsInt()
  @Min(0)
  jobId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  level?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  strength?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  agility?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  vitality?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  intelligence?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  dexterity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  luck?: number;

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
