import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AddParticipantDto {
  @IsOptional()
  @IsString()
  characterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  initiative?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxHp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentHp?: number;

  @IsOptional()
  @IsBoolean()
  isAlly?: boolean;
}
