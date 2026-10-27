import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { CombatHpDisplay } from '@prisma/client';

export class UpdateEncounterDto {
  @IsOptional()
  @IsEnum(CombatHpDisplay)
  hpDisplay?: CombatHpDisplay;

  /** Revisão que o cliente leu; divergência devolve 409 (P1-2). */
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;
}
