import { Module } from '@nestjs/common';
import { ConsequencesController } from './consequences.controller';
import { ConsequencesService } from './consequences.service';
@Module({
  controllers: [ConsequencesController],
  providers: [ConsequencesService],
})
export class ConsequencesModule {}
