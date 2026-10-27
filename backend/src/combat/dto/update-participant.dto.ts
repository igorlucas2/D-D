import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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
}
