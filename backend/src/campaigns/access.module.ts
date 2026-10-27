import { Global, Module } from '@nestjs/common';
import { RequestContextService } from '../common/request-context.service';
import { CampaignAccessService } from './campaign-access.service';

@Global()
@Module({
  providers: [RequestContextService, CampaignAccessService],
  exports: [RequestContextService, CampaignAccessService],
})
export class AccessModule {}
