import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCharacterDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsString()
  race: string;

  @IsString()
  class: string;

  @IsOptional()
  @IsString()
  subclass?: string;

  @IsOptional()
  @IsString()
  background?: string;

  @IsOptional()
  @IsString()
  alignment?: string;

  @IsOptional()
  @IsString()
  deity?: string;

  @IsOptional()
  @IsString()
  appearance?: string;

  @IsOptional()
  @IsString()
  backstory?: string;

  @IsOptional()
  @IsString()
  portraitUrl?: string;

  @IsInt()
  @Min(3)
  @Max(20)
  strength: number;

  @IsInt()
  @Min(3)
  @Max(20)
  dexterity: number;

  @IsInt()
  @Min(3)
  @Max(20)
  constitution: number;

  @IsInt()
  @Min(3)
  @Max(20)
  intelligence: number;

  @IsInt()
  @Min(3)
  @Max(20)
  wisdom: number;

  @IsInt()
  @Min(3)
  @Max(20)
  charisma: number;
}
