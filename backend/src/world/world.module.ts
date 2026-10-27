import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorldService } from './world.service';
import { WorldController } from './world.controller';
import { WorldGateway } from './world.gateway';
import { WorldTickService } from './world-tick.service';

@Module({
  imports: [AuthModule],
  providers: [WorldService, WorldGateway, WorldTickService],
  controllers: [WorldController],
  exports: [WorldService, WorldGateway],
})
export class WorldModule {}
