import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import {
  IsString,
  Matches,
  MaxLength,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoreService } from './lore.service';
import { LoreInstallService } from './lore-install.service';

export class PreviewLoreDto {
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9-]*$/)
  packId: string;
  @IsString()
  @MaxLength(30)
  @Matches(/^\d+\.\d+\.\d+$/)
  version: string;
}

export class InstallLoreDto extends PreviewLoreDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) expectedHash: string;
  @IsOptional() @IsBoolean() allowDraft?: boolean;
}
export class CreateLoreCampaignDto extends InstallLoreDto {
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsUUID() requestKey: string;
}
export class AttachLoreCharacterDto {
  @IsString() @MaxLength(191) characterId: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class LoreController {
  constructor(
    private readonly lore: LoreService,
    private readonly installer: LoreInstallService,
  ) {}

  @Post('lore-campaigns')
  @Header('Cache-Control', 'no-store')
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateLoreCampaignDto,
  ) {
    return this.installer.create(user.userId, dto);
  }

  @Post('campaigns/:id/lore/install')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  install(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: InstallLoreDto,
  ) {
    return this.installer.install(id, user.userId, dto);
  }

  @Get('campaigns/:id/lore/state')
  @Header('Cache-Control', 'no-store')
  state(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.installer.state(id, user.userId);
  }

  @Post('campaigns/:id/lore/characters')
  @Header('Cache-Control', 'no-store')
  attach(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: AttachLoreCharacterDto,
  ) {
    return this.installer.attachCharacter(id, user.userId, dto.characterId);
  }

  @Get('campaigns/:id/lore/maps/:mapId/image')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async image(
    @Param('id') id: string,
    @Param('mapId') mapId: string,
    @CurrentUser() user: { userId: string },
  ) {
    const buffer = await this.installer.image(id, mapId, user.userId);
    const type =
      buffer[0] === 0xff && buffer[1] === 0xd8
        ? 'image/jpeg'
        : buffer.subarray(0, 4).toString('ascii') === 'RIFF'
          ? 'image/webp'
          : 'image/png';
    return new StreamableFile(buffer, { type });
  }

  @Get('lore-packs')
  @Header('Cache-Control', 'no-store')
  list() {
    return this.lore.listPublic();
  }

  @Post('lore-packs/create-preview')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  creationPreview(@Body() dto: PreviewLoreDto) {
    return this.lore.creationPreview(dto.packId, dto.version);
  }

  @Post('campaigns/:id/lore/install-preview')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  preview(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: PreviewLoreDto,
  ) {
    return this.lore.preview(id, user.userId, dto.packId, dto.version);
  }
}
