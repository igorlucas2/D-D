import { IsIn, IsInt, Max, Min } from 'class-validator';

export const RAGNAROK_STATS = [
  'strength',
  'agility',
  'vitality',
  'intelligence',
  'dexterity',
  'luck',
] as const;

export type RagnarokStat = (typeof RAGNAROK_STATS)[number];

export class AllocateStatDto {
  @IsIn(RAGNAROK_STATS)
  stat!: RagnarokStat;

  @IsInt()
  @Min(1)
  @Max(10)
  amount!: number;
}
