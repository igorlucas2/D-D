import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CatalogService } from './catalog.service';

@UseGuards(JwtAuthGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('items')
  listItems(@Query('take') take?: string) {
    return this.catalogService.listItems(parseTake(take));
  }

  @Get('spells')
  listSpells(@Query('take') take?: string) {
    return this.catalogService.listSpells(parseTake(take));
  }

  @Get('monsters')
  listMonsters(@Query('take') take?: string) {
    return this.catalogService.listMonsters(parseTake(take));
  }

  @Get('rules')
  listRules(@Query('take') take?: string) {
    return this.catalogService.listRules(parseTake(take));
  }
}

function parseTake(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
