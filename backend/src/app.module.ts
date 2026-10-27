import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { HealthController } from './health/health.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CharactersModule } from './characters/characters.module';
import { DiceModule } from './dice/dice.module';
import { CatalogModule } from './catalog/catalog.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { CombatModule } from './combat/combat.module';
import { JournalModule } from './journal/journal.module';
import { VttModule } from './vtt/vtt.module';
import { SrdModule } from './srd/srd.module';
import { WorldModule } from './world/world.module';
import { ExplorationModule } from './exploration/exploration.module';
import { NarrationModule } from './narration/narration.module';
import { ChatModule } from './chat/chat.module';
import { AssistantModule } from './assistant/assistant.module';
import { LoreModule } from './lore/lore.module';
import { StoryModule } from './story/story.module';
import { GameActionsModule } from './game-actions/game-actions.module';
import { GameMasterModule } from './game-master/game-master.module';
import { ConsequencesModule } from './consequences/consequences.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    CharactersModule,
    DiceModule,
    CatalogModule,
    CampaignsModule,
    CombatModule,
    JournalModule,
    VttModule,
    SrdModule,
    WorldModule,
    ExplorationModule,
    NarrationModule,
    ChatModule,
    AssistantModule,
    LoreModule,
    StoryModule,
    GameActionsModule,
    GameMasterModule,
    ConsequencesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
