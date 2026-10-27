import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ASSISTANT_KINDS = ['scene', 'npc', 'names', 'free'] as const;
export type AssistantKind = (typeof ASSISTANT_KINDS)[number];

export class AskAssistantDto {
  @IsIn(ASSISTANT_KINDS)
  kind: AssistantKind;

  /** Detalhe do pedido (obrigatório em "names" e "free"). */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  prompt?: string;

  /** Mapa atual, para dar contexto de lugar. */
  @IsOptional()
  @IsString()
  mapId?: string;
}

export class UpdateAssistantSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  monthlyLimit?: number;
}
