import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateVttMarkerDto {
  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;

  @IsString()
  @MaxLength(80)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
