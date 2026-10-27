import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncSrdDto } from './dto/sync-srd.dto';
import { SrdService } from './srd.service';
import { SrdSyncService } from './srd-sync.service';

@UseGuards(JwtAuthGuard)
@Controller('catalog/srd')
export class SrdController {
  constructor(
    private readonly srdService: SrdService,
    private readonly srdSyncService: SrdSyncService,
  ) {}

  @Post('sync')
  sync(@Body() dto: SyncSrdDto) {
    return this.srdSyncService.syncAll(dto.endpoints);
  }

  @Get('endpoints')
  listEndpoints() {
    return this.srdService.listEndpoints();
  }

  @Get('resources')
  listResources(
    @Query('endpoint') endpoint?: string,
    @Query('search') search?: string,
  ) {
    return this.srdService.listResources(endpoint, search);
  }

  @Get('resources/:endpoint/:index')
  getResource(
    @Param('endpoint') endpoint: string,
    @Param('index') index: string,
  ) {
    return this.srdService.getResource(endpoint, index);
  }
}
