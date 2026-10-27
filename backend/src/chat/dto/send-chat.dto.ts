import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ChatKind } from '@prisma/client';

export class SendChatDto {
  @IsEnum(ChatKind)
  kind: ChatKind;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  /** Personagem que fala (precisa ser de quem envia). */
  @IsOptional()
  @IsString()
  characterId?: string;

  /** Entrada IDIOMA do mundo; ausente = língua comum. */
  @IsOptional()
  @IsString()
  languageId?: string;

  /** Só para sussurro. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  recipientIds?: string[];
}
