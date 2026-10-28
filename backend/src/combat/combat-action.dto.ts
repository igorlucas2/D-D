import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DAMAGE_TYPES,
  type CombatActionKind,
  type CombatTargetKind,
  type DamageType,
} from './combat-action.types';

export class CombatActionDto {
  @IsUUID()
  requestKey: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;

  @IsIn(['DAMAGE', 'HEAL', 'TEMP_HP', 'CONDITION'])
  kind: CombatActionKind;

  @IsIn(['CHARACTER', 'PARTICIPANT'])
  targetKind: CombatTargetKind;

  @IsString()
  @MaxLength(191)
  targetId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^\d{1,2}d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i)
  formula?: string;

  @IsOptional()
  @IsIn(DAMAGE_TYPES)
  damageType?: DamageType;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(/\S/)
  condition?: string;

  @IsOptional()
  @IsIn(['ADD', 'REMOVE'])
  conditionMode?: 'ADD' | 'REMOVE';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  durationRounds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/\S/)
  source?: string;
}
