import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpdateVttMarkerDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  x?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  y?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
