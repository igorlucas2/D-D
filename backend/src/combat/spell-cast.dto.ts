import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SpellTargetDto {
  @IsIn(['CHARACTER', 'PARTICIPANT'])
  kind: 'CHARACTER' | 'PARTICIPANT';

  @IsString()
  @MaxLength(191)
  id: string;
}

export class CastSpellDto {
  @IsUUID()
  requestKey: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;

  @IsString()
  @MaxLength(191)
  characterSpellId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  slotLevel?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => SpellTargetDto)
  targets: SpellTargetDto[];
}
