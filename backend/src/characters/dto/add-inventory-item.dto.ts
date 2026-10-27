import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddInventoryItemDto {
  @IsString()
  itemId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsBoolean()
  equipped?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;
}
