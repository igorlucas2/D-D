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
import { CharactersService } from './characters.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { SetResistancesDto } from './dto/set-resistances.dto';
import {
  AddInventoryItemDto,
  UpdateInventoryItemDto,
} from './dto/add-inventory-item.dto';
import {
  AddCharacterSpellDto,
  UpdateCharacterSpellDto,
} from './dto/add-character-spell.dto';
import { CastCharacterSpellDto } from './dto/cast-character-spell.dto';

@UseGuards(JwtAuthGuard)
@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.charactersService.findAllForUser(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCharacterDto,
  ) {
    return this.charactersService.create(user.userId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.charactersService.findOne(id, user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateCharacterDto,
  ) {
    return this.charactersService.update(id, user.userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.charactersService.remove(id, user.userId);
  }

  @Put(':id/resistances')
  setResistances(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SetResistancesDto,
  ) {
    return this.charactersService.setResistances(id, user.userId, dto);
  }

  @Get(':id/spells')
  getSpells(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.charactersService.getSpells(id, user.userId);
  }

  @Post(':id/inventory')
  addInventoryItem(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: AddInventoryItemDto,
  ) {
    return this.charactersService.addInventoryItem(id, user.userId, dto);
  }

  @Patch(':id/inventory/:inventoryItemId')
  updateInventoryItem(
    @Param('id') id: string,
    @Param('inventoryItemId') inventoryItemId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.charactersService.updateInventoryItem(
      id,
      inventoryItemId,
      user.userId,
      dto,
    );
  }

  @Delete(':id/inventory/:inventoryItemId')
  removeInventoryItem(
    @Param('id') id: string,
    @Param('inventoryItemId') inventoryItemId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.charactersService.removeInventoryItem(
      id,
      inventoryItemId,
      user.userId,
    );
  }

  @Post(':id/spells')
  addSpell(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: AddCharacterSpellDto,
  ) {
    return this.charactersService.addSpell(id, user.userId, dto);
  }

  @Patch(':id/spells/:characterSpellId')
  updateSpell(
    @Param('id') id: string,
    @Param('characterSpellId') characterSpellId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateCharacterSpellDto,
  ) {
    return this.charactersService.updateSpell(
      id,
      characterSpellId,
      user.userId,
      dto,
    );
  }

  @Post(':id/spells/:characterSpellId/cast')
  castSpell(
    @Param('id') id: string,
    @Param('characterSpellId') characterSpellId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CastCharacterSpellDto,
  ) {
    return this.charactersService.castSpell(
      id,
      characterSpellId,
      user.userId,
      dto,
    );
  }

  @Delete(':id/spells/:characterSpellId')
  removeSpell(
    @Param('id') id: string,
    @Param('characterSpellId') characterSpellId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.charactersService.removeSpell(
      id,
      characterSpellId,
      user.userId,
    );
  }

  @Post(':id/spell-slots/reset')
  resetSpellSlots(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.charactersService.resetSpellSlots(id, user.userId);
  }

  @Post(':id/spell-slots/:level/use')
  useSpellSlot(
    @Param('id') id: string,
    @Param('level') level: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.charactersService.adjustSpellSlot(
      id,
      user.userId,
      Number(level),
      1,
    );
  }

  @Post(':id/spell-slots/:level/restore')
  restoreSpellSlot(
    @Param('id') id: string,
    @Param('level') level: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.charactersService.adjustSpellSlot(
      id,
      user.userId,
      Number(level),
      -1,
    );
  }
}
