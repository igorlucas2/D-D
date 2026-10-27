import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UseItemDto {
  @IsUUID()
  requestKey: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;

  @IsString()
  @MaxLength(191)
  inventoryItemId: string;

  @IsString()
  @MaxLength(191)
  characterId: string;
}
