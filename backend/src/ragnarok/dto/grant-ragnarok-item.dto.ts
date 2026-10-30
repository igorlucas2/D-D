import { IsInt, Max, Min } from 'class-validator';

export class GrantRagnarokItemDto {
  @IsInt()
  @Min(1)
  itemId!: number;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class GrantRagnarokZenyDto {
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amount!: number;
}
