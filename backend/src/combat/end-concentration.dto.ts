import { IsString, MaxLength } from 'class-validator';

export class EndConcentrationDto {
  @IsString()
  @MaxLength(191)
  characterId: string;
}
