import { Module } from '@nestjs/common';
import { WorldModule } from '../world/world.module';
import { JournalService } from './journal.service';
import { JournalController } from './journal.controller';

@Module({
  imports: [WorldModule],
  providers: [JournalService],
  controllers: [JournalController],
})
export class JournalModule {}
