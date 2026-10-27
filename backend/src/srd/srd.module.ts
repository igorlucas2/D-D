import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { SrdController } from './srd.controller';
import { SrdService } from './srd.service';
import { SrdSyncService } from './srd-sync.service';

@Module({
  controllers: [SrdController],
  providers: [SrdService, SrdSyncService, AdminGuard],
  exports: [SrdSyncService],
})
export class SrdModule {}
