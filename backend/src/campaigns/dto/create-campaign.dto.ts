import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
