import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VttController } from './vtt.controller';
import { VttGateway } from './vtt.gateway';
import { VttService } from './vtt.service';

@Module({
  imports: [AuthModule],
  controllers: [VttController],
  providers: [VttService, VttGateway],
  exports: [VttGateway],
})
export class VttModule {}
