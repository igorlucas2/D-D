import { IsString, MaxLength } from 'class-validator';

export class BindRagnarokCharacterDto {
  @IsString()
  @MaxLength(191)
  characterId!: string;
}
