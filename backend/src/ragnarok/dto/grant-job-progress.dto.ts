import { IsInt, Max, Min } from 'class-validator';

export class GrantJobLevelDto {
  @IsInt()
  @Min(1)
  @Max(70)
  level!: number;
}

export class GrantJobExpDto {
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount!: number;
}
