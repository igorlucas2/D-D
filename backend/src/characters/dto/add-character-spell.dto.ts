import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AddCharacterSpellDto {
  @IsString()
  spellId: string;
}

export class UpdateCharacterSpellDto {
  @IsOptional()
  @IsBoolean()
  prepared?: boolean;
}
