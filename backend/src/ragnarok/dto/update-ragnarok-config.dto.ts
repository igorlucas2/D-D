import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateRagnarokConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  baseExpRate?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  jobExpRate?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  dropRate?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  zenyRate?: number;

  @IsOptional()
  @IsIn(['FFA', 'KILLER', 'PARTY'])
  lootMode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  lootProtectionSeconds?: number;
}
