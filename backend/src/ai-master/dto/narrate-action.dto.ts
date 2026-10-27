import { IsString, IsUUID, MaxLength } from 'class-validator';

export class NarrateActionDto {
  @IsUUID()
  requestKey: string;

  @IsString()
  @MaxLength(191)
  actionId: string;
}
