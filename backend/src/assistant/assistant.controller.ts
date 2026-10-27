import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AssistantService } from './assistant.service';
import {
  AskAssistantDto,
  UpdateAssistantSettingsDto,
} from './dto/assistant.dto';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get()
  status(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.assistantService.status(campaignId, user.userId);
  }

  @Patch()
  updateSettings(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateAssistantSettingsDto,
  ) {
    return this.assistantService.updateSettings(campaignId, user.userId, dto);
  }

  @Post()
  ask(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: AskAssistantDto,
  ) {
    return this.assistantService.ask(campaignId, user.userId, dto);
  }
}
