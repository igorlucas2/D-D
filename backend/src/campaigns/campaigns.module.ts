import { Module } from '@nestjs/common';
import { VttModule } from '../vtt/vtt.module';
import { WorldModule } from '../world/world.module';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';

@Module({
  imports: [VttModule, WorldModule],
  providers: [CampaignsService],
  controllers: [CampaignsController],
})
export class CampaignsModule {}
