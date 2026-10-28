import { Module } from '@nestjs/common';
import { VttModule } from '../vtt/vtt.module';
import { WorldModule } from '../world/world.module';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { MasterActionsService } from './master-actions.service';
import { MasterActionsController } from './master-actions.controller';

@Module({
  imports: [VttModule, WorldModule],
  providers: [CampaignsService, MasterActionsService],
  controllers: [CampaignsController, MasterActionsController],
})
export class CampaignsModule {}
