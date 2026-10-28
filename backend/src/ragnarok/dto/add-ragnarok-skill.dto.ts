import { IsInt, Max, Min } from 'class-validator';

export class AddRagnarokSkillDto {
  @IsInt()
  @Min(1)
  skillId!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  level!: number;
}
