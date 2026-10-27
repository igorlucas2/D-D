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
import { AdminGuard } from '../auth/admin.guard';
import { Throttle } from '@nestjs/throttler';
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

  // Sincronização é cara (centenas de requisições externas): 2 por 10 minutos
  // e, quando ADMIN_EMAILS está configurado, apenas administradores.
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 2, ttl: 600_000 } })
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
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = take ? Number.parseInt(take, 10) : undefined;
    return this.srdService.listResources(endpoint, search, {
      take:
        parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
      cursor: cursor || undefined,
    });
  }

  @Get('resources/:endpoint/:index')
  getResource(
    @Param('endpoint') endpoint: string,
    @Param('index') index: string,
  ) {
    return this.srdService.getResource(endpoint, index);
  }
}
