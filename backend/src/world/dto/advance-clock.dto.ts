import { IsInt, Max, Min } from 'class-validator';

export class AdvanceClockDto {
  @IsInt()
  @Min(1)
  @Max(525600)
  minutes!: number;
}
