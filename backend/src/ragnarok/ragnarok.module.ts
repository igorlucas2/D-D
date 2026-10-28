import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RagnarokController } from './ragnarok.controller';
import { RagnarokCharactersController } from './ragnarok-characters.controller';
import { RagnarokCharactersService } from './ragnarok-characters.service';
import { RagnarokService } from './ragnarok.service';

@Module({
  imports: [PrismaModule],
  controllers: [RagnarokController, RagnarokCharactersController],
  providers: [RagnarokService, RagnarokCharactersService],
})
export class RagnarokModule {}
