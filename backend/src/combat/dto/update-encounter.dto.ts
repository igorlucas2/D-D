import { IsEnum, IsOptional } from 'class-validator';
import { CombatHpDisplay } from '@prisma/client';

export class UpdateEncounterDto {
  @IsOptional()
  @IsEnum(CombatHpDisplay)
  hpDisplay?: CombatHpDisplay;
}
