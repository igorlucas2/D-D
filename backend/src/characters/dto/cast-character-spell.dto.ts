import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CastCharacterSpellDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  slotLevel?: number;
}
