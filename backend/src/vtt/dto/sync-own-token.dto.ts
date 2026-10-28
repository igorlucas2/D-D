import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

/** Posicao do proprio personagem, enviada pelo viewer imersivo. */
export class SyncOwnTokenDto {
  @IsString()
  @IsNotEmpty()
  characterId!: string;

  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;
}
