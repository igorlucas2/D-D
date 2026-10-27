import { Module } from '@nestjs/common';
import { LoreController } from './lore.controller';
import { LorePackLoader } from './lore.loader';
import { LoreService } from './lore.service';
import { LoreInstallService } from './lore-install.service';

@Module({
  controllers: [LoreController],
  providers: [
    LoreInstallService,
    LoreService,
    { provide: LorePackLoader, useFactory: () => new LorePackLoader() },
  ],
})
export class LoreModule {}
