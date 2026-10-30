import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/** Posicao do proprio personagem, enviada pelo viewer imersivo. */
export class SyncOwnTokenDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  characterId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ragnarokCharacterId?: string;

  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;
}
