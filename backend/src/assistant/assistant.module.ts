import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { WorldModule } from '../world/world.module';
import { AssistantController } from './assistant.controller';
import { ANTHROPIC_CLIENT, AssistantService } from './assistant.service';

@Module({
  imports: [WorldModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    {
      // Sem chave no backend/.env, o assistente fica indisponível e nenhuma
      // chamada externa é feita.
      provide: ANTHROPIC_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('ANTHROPIC_API_KEY');
        return apiKey ? new Anthropic({ apiKey }) : null;
      },
    },
  ],
})
export class AssistantModule {}
