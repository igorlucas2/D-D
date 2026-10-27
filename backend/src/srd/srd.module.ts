import { Module } from '@nestjs/common';
import { SrdController } from './srd.controller';
import { SrdService } from './srd.service';
import { SrdSyncService } from './srd-sync.service';

@Module({
  controllers: [SrdController],
  providers: [SrdService, SrdSyncService],
  exports: [SrdSyncService],
})
export class SrdModule {}
