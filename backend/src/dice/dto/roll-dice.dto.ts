import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DiceVisibility } from '@prisma/client';

export class RollDiceDto {
  /** Ex.: "1d20+5", "2d6", "4d6-1", "1d100" */
  @IsString()
  @MaxLength(50)
  @Matches(/^\d+d(4|6|8|10|12|20|100)([+-]\d+)?$/i, {
    message: 'Fórmula inválida. Use o formato NdM[+/-K], ex.: 2d6+3.',
  })
  formula: string;

  @IsOptional()
  @IsString()
  characterId?: string;

  /** Rolagem feita na mesa: é transmitida conforme `visibility`. */
  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsEnum(DiceVisibility)
  visibility?: DiceVisibility;
}
