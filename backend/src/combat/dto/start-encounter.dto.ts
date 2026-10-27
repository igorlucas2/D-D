import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StartEncounterDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
