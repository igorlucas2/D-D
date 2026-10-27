import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CatalogService } from './catalog.service';

@UseGuards(JwtAuthGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('items')
  listItems() {
    return this.catalogService.listItems();
  }

  @Get('spells')
  listSpells() {
    return this.catalogService.listSpells();
  }

  @Get('monsters')
  listMonsters() {
    return this.catalogService.listMonsters();
  }

  @Get('rules')
  listRules() {
    return this.catalogService.listRules();
  }
}
