import { IsInt, Min } from 'class-validator';

/** Movimento tatico de um participante no grid do mapa. */
export class MoveCombatParticipantDto {
  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;
}
