import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendNarrationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;

  /** Vazio ou ausente: toda a mesa. Caso contrário, só estes jogadores. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  recipientIds?: string[];

  @IsOptional()
  @IsBoolean()
  recordInJournal?: boolean;
}

export class SaveNarrationDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;

  /** Mapa em que a narração é sugerida ao mestre quando alguém chega. */
  @IsOptional()
  @IsString()
  mapId?: string | null;
}
