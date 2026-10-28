import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParticipantDefenseDto } from './participant-defense.dto';

export class UpdateParticipantDto {
  @IsOptional()
  @IsInt()
  initiative?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentHp?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxHp?: number;

  @IsOptional()
  @IsBoolean()
  isAlly?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  conditions?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDefenseDto)
  damageDefenses?: ParticipantDefenseDto[];
}
