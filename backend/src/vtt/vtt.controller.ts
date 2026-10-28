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
import { MoveVttTokenDto, ToggleVttDoorDto } from './dto/player-action.dto';
import { VttService } from './vtt.service';
import { CreateVttMapDto } from './dto/create-vtt-map.dto';
import { UpdateVttMapDto } from './dto/update-vtt-map.dto';
import { CreateVttTokenDto } from './dto/create-vtt-token.dto';
import { UpdateVttTokenDto } from './dto/update-vtt-token.dto';
import { SyncOwnTokenDto } from './dto/sync-own-token.dto';
import { CreateVttMarkerDto } from './dto/create-vtt-marker.dto';
import { UpdateVttMarkerDto } from './dto/update-vtt-marker.dto';
import { CreateVttMapHotspotDto } from './dto/create-vtt-map-hotspot.dto';
import { UpdateVttMapHotspotDto } from './dto/update-vtt-map-hotspot.dto';

@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/vtt/maps')
export class VttController {
  constructor(private readonly vttService: VttService) {}

  @Get()
  findMaps(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.vttService.findMaps(campaignId, user.userId);
  }

  @Audit('vtt.map.create', 'vtt-map')
  @Post()
  createMap(
    @Param('campaignId') campaignId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateVttMapDto,
  ) {
    return this.vttService.createMap(campaignId, user.userId, dto);
  }

  @Get(':mapId/player-view')
  playerView(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.vttService.playerView(campaignId, mapId, user.userId);
  }

  @Get(':mapId')
  findMap(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.vttService.findMap(campaignId, mapId, user.userId);
  }

  @Audit('vtt.map.update', 'vtt-map')
  @Patch(':mapId')
  updateMap(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateVttMapDto,
  ) {
    return this.vttService.updateMap(campaignId, mapId, user.userId, dto);
  }

  @Audit('vtt.map.delete', 'vtt-map')
  @Delete(':mapId')
  removeMap(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.vttService.removeMap(campaignId, mapId, user.userId);
  }

  @Audit('vtt.token.create', 'vtt-token')
  @Post(':mapId/tokens')
  createToken(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateVttTokenDto,
  ) {
    return this.vttService.createToken(campaignId, mapId, user.userId, dto);
  }

  @Audit('vtt.token.sync', 'vtt-token')
  @Put(':mapId/tokens/me')
  syncOwnToken(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SyncOwnTokenDto,
  ) {
    return this.vttService.syncOwnToken(campaignId, mapId, user.userId, dto);
  }

  @Audit('vtt.token.update', 'vtt-token')
  @Patch(':mapId/tokens/:tokenId')
  updateToken(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @Param('tokenId') tokenId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateVttTokenDto,
  ) {
    return this.vttService.updateToken(
      campaignId,
      mapId,
      tokenId,
      user.userId,
      dto,
    );
  }

  @Patch(':mapId/tokens/:tokenId/move')
  moveToken(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @Param('tokenId') tokenId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: MoveVttTokenDto,
  ) {
    return this.vttService.moveToken(
      campaignId,
      mapId,
      tokenId,
      user.userId,
      dto,
    );
  }

  @Post(':mapId/doors/toggle')
  toggleDoor(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: ToggleVttDoorDto,
  ) {
    return this.vttService.toggleDoor(campaignId, mapId, user.userId, dto);
  }

  @Audit('vtt.token.delete', 'vtt-token')
  @Delete(':mapId/tokens/:tokenId')
  removeToken(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @Param('tokenId') tokenId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.vttService.removeToken(campaignId, mapId, tokenId, user.userId);
  }

  @Audit('vtt.marker.create', 'vtt-marker')
  @Post(':mapId/markers')
  createMarker(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateVttMarkerDto,
  ) {
    return this.vttService.createMarker(campaignId, mapId, user.userId, dto);
  }

  @Audit('vtt.marker.update', 'vtt-marker')
  @Patch(':mapId/markers/:markerId')
  updateMarker(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @Param('markerId') markerId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateVttMarkerDto,
  ) {
    return this.vttService.updateMarker(
      campaignId,
      mapId,
      markerId,
      user.userId,
      dto,
    );
  }

  @Audit('vtt.marker.delete', 'vtt-marker')
  @Delete(':mapId/markers/:markerId')
  removeMarker(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @Param('markerId') markerId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.vttService.removeMarker(
      campaignId,
      mapId,
      markerId,
      user.userId,
    );
  }

  @Audit('vtt.hotspot.create', 'vtt-hotspot')
  @Post(':mapId/hotspots')
  createHotspot(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateVttMapHotspotDto,
  ) {
    return this.vttService.createHotspot(campaignId, mapId, user.userId, dto);
  }

  @Audit('vtt.hotspot.update', 'vtt-hotspot')
  @Patch(':mapId/hotspots/:hotspotId')
  updateHotspot(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @Param('hotspotId') hotspotId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateVttMapHotspotDto,
  ) {
    return this.vttService.updateHotspot(
      campaignId,
      mapId,
      hotspotId,
      user.userId,
      dto,
    );
  }

  @Audit('vtt.hotspot.delete', 'vtt-hotspot')
  @Delete(':mapId/hotspots/:hotspotId')
  removeHotspot(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @Param('hotspotId') hotspotId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.vttService.removeHotspot(
      campaignId,
      mapId,
      hotspotId,
      user.userId,
    );
  }

  @Audit('vtt.hotspot.target', 'vtt-hotspot')
  @Post(':mapId/hotspots/:hotspotId/target')
  createHotspotTarget(
    @Param('campaignId') campaignId: string,
    @Param('mapId') mapId: string,
    @Param('hotspotId') hotspotId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateVttMapDto,
  ) {
    return this.vttService.createHotspotTarget(
      campaignId,
      mapId,
      hotspotId,
      user.userId,
      dto,
    );
  }
}
