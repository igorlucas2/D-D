import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class WeaponAttackDto {
  @IsUUID()
  requestKey: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;

  @IsString()
  @MaxLength(191)
  inventoryItemId: string;

  @IsIn(['CHARACTER', 'PARTICIPANT'])
  targetKind: 'CHARACTER' | 'PARTICIPANT';

  @IsString()
  @MaxLength(191)
  targetId: string;
}
