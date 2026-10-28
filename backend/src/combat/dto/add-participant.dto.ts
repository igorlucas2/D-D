import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParticipantDefenseDto } from './participant-defense.dto';

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDefenseDto)
  damageDefenses?: ParticipantDefenseDto[];
}
