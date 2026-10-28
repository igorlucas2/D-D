import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CharacterResistanceDto {
  @IsString()
  @MaxLength(30)
  damageType!: string;

  @IsIn(['RESISTANCE', 'IMMUNITY', 'VULNERABILITY'])
  type!: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY';
}

export class SetResistancesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CharacterResistanceDto)
  resistances!: CharacterResistanceDto[];
}
