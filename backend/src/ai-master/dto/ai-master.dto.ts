import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class AiSettingsDto {
  @IsIn(['OFF', 'COPILOT', 'AUTONOMOUS'])
  mode: 'OFF' | 'COPILOT' | 'AUTONOMOUS';

  @IsBoolean()
  paused: boolean;

  @IsInt()
  @Min(1)
  expectedRevision: number;
}

export class AiActDto {
  @IsUUID()
  requestKey: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(1000)
  action: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  characterId?: string;

  @IsInt()
  @Min(1)
  expectedRevision: number;
}
