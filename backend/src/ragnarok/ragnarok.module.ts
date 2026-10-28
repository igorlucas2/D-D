import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RagnarokController } from './ragnarok.controller';
import { RagnarokService } from './ragnarok.service';

@Module({
  imports: [PrismaModule],
  controllers: [RagnarokController],
  providers: [RagnarokService],
})
export class RagnarokModule {}
