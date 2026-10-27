import { IsString } from 'class-validator';

export class JoinCampaignDto {
  @IsString()
  inviteCode: string;
}
