import { IsInt, Min } from 'class-validator';

export class GrantRagnarokClassDto {
  @IsInt()
  @Min(0)
  jobId!: number;
}
