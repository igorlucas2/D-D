import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Audit } from '../audit/audit.decorator';
import { WorldService } from './world.service';
import { CreateWorldEntryDto } from './dto/create-world-entry.dto';
import { UpdateWorldEntryDto } from './dto/update-world-entry.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import { AdvanceClockDto } from './dto/advance-clock.dto';
import { SetWeatherDto } from './dto/set-weather.dto';
import { CreateWorldEventDto } from './dto/create-world-event.dto';
import { UpdateWorldEventDto } from './dto/update-world-event.dto';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/world')
export class WorldController {
  constructor(private readonly worldService: WorldService) {}

  @Get('entries')
  findEntries(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.worldService.findEntries(campaignId, user.userId);
  }

  @Audit('world.entry.create', 'world-entry')
  @Post('entries')
  createEntry(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateWorldEntryDto,
  ) {
    return this.worldService.createEntry(campaignId, user.userId, dto);
  }

  @Audit('world.entry.update', 'world-entry')
  @Patch('entries/:entryId')
  updateEntry(
    @Param('campaignId') campaignId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateWorldEntryDto,
  ) {
    return this.worldService.updateEntry(campaignId, entryId, user.userId, dto);
  }

  @Audit('world.entry.delete', 'world-entry')
  @Delete('entries/:entryId')
  removeEntry(
    @Param('campaignId') campaignId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.worldService.removeEntry(campaignId, entryId, user.userId);
  }

  @Get('calendar')
  getCalendar(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.worldService.getCalendar(campaignId, user.userId);
  }

  @Audit('world.calendar.update', 'calendar')
  @Put('calendar')
  updateCalendar(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateCalendarDto,
  ) {
    return this.worldService.updateCalendar(campaignId, user.userId, dto);
  }

  @Audit('world.weather.set', 'calendar')
  @Post('weather')
  setWeather(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SetWeatherDto,
  ) {
    return this.worldService.setWeather(campaignId, user.userId, dto.weather);
  }

  @Audit('world.clock.advance', 'calendar')
  @Post('clock/advance')
  advanceClock(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: AdvanceClockDto,
  ) {
    return this.worldService.advanceClock(campaignId, user.userId, dto);
  }

  @Get('events')
  findEvents(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.worldService.findEvents(campaignId, user.userId);
  }

  @Audit('world.event.create', 'world-event')
  @Post('events')
  createEvent(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateWorldEventDto,
  ) {
    return this.worldService.createEvent(campaignId, user.userId, dto);
  }

  @Audit('world.event.update', 'world-event')
  @Patch('events/:eventId')
  updateEvent(
    @Param('campaignId') campaignId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateWorldEventDto,
  ) {
    return this.worldService.updateEvent(campaignId, eventId, user.userId, dto);
  }

  @Audit('world.event.delete', 'world-event')
  @Delete('events/:eventId')
  removeEvent(
    @Param('campaignId') campaignId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.worldService.removeEvent(campaignId, eventId, user.userId);
  }
}
