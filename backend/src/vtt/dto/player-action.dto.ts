import { IsInt, Min } from 'class-validator';

/** Jogador movendo o próprio token (MV-07). */
export class MoveVttTokenDto {
  @IsInt()
  @Min(0)
  x: number;

  @IsInt()
  @Min(0)
  y: number;
}

/** Porta a abrir ou fechar, identificada pela borda que ocupa. */
export class ToggleVttDoorDto {
  @IsInt()
  @Min(0)
  x1: number;

  @IsInt()
  @Min(0)
  y1: number;

  @IsInt()
  @Min(0)
  x2: number;

  @IsInt()
  @Min(0)
  y2: number;
}
