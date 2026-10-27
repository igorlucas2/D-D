import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './observability/all-exceptions.filter';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AuditModule } from './audit/audit.module';
import { CampaignChangedInterceptor } from './realtime/campaign-changed.interceptor';
import { LoggingModule } from './observability/logging';
import { ObservabilityModule } from './observability/observability.module';
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
import { AccessModule } from './campaigns/access.module';
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
    LoggingModule,
    ObservabilityModule,
    // Limite global por IP; rotas sensíveis (login, cadastro, dados, IA e
    // sincronização) apertam o limite com @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AccessModule,
    AuditModule,
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
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CampaignChangedInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
