import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RagnarokController } from './ragnarok.controller';
import { RagnarokCharactersController } from './ragnarok-characters.controller';
import { RagnarokCharactersService } from './ragnarok-characters.service';
import { RagnarokCampaignController } from './ragnarok-campaign.controller';
import { RagnarokCampaignService } from './ragnarok-campaign.service';
import { RagnarokConfigController } from './ragnarok-config.controller';
import { RagnarokService } from './ragnarok.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    RagnarokController,
    RagnarokCharactersController,
    RagnarokCampaignController,
    RagnarokConfigController,
  ],
  providers: [
    RagnarokService,
    RagnarokCharactersService,
    RagnarokCampaignService,
  ],
})
export class RagnarokModule {}
