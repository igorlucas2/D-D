import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JournalService } from './journal.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Get()
  findAll(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.journalService.findAll(campaignId, user.userId);
  }

  @Get('since-last-visit')
  sinceLastVisit(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.journalService.sinceLastVisit(campaignId, user.userId);
  }

  @Post('visit')
  markVisit(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.journalService.markVisit(campaignId, user.userId);
  }

  @Post()
  create(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.journalService.create(campaignId, user.userId, dto);
  }

  @Patch(':entryId')
  update(
    @Param('campaignId') campaignId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateJournalEntryDto,
  ) {
    return this.journalService.update(campaignId, entryId, user.userId, dto);
  }

  @Delete(':entryId')
  remove(
    @Param('campaignId') campaignId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.journalService.remove(campaignId, entryId, user.userId);
  }
}
