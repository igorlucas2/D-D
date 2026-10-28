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
import { CreateRagnarokCharacterDto } from './dto/create-ragnarok-character.dto';
import { UpdateRagnarokCharacterDto } from './dto/update-ragnarok-character.dto';
import { AddRagnarokSkillDto } from './dto/add-ragnarok-skill.dto';
import {
  AddRagnarokItemDto,
  UpdateRagnarokItemDto,
} from './dto/add-ragnarok-item.dto';
import { RagnarokCharactersService } from './ragnarok-characters.service';

@UseGuards(JwtAuthGuard)
@Controller('ragnarok/characters')
export class RagnarokCharactersController {
  constructor(private readonly characters: RagnarokCharactersService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.characters.list(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateRagnarokCharacterDto,
  ) {
    return this.characters.create(user.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateRagnarokCharacterDto,
  ) {
    return this.characters.update(user.userId, id, dto);
  }

  @Post(':id/skills')
  addSkill(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: AddRagnarokSkillDto,
  ) {
    return this.characters.addSkill(user.userId, id, dto);
  }

  @Delete(':id/skills/:skillId')
  removeSkill(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('skillId') skillId: string,
  ) {
    return this.characters.removeSkill(
      user.userId,
      id,
      Number.parseInt(skillId, 10),
    );
  }

  @Post(':id/items')
  addItem(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: AddRagnarokItemDto,
  ) {
    return this.characters.addItem(user.userId, id, dto);
  }

  @Patch(':id/items/:entryId')
  updateItem(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateRagnarokItemDto,
  ) {
    return this.characters.updateItem(user.userId, id, entryId, dto);
  }

  @Delete(':id/items/:entryId')
  removeItem(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ) {
    return this.characters.removeItem(user.userId, id, entryId);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.characters.remove(user.userId, id);
  }
}
