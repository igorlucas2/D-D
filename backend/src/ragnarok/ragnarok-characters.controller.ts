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

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.characters.remove(user.userId, id);
  }
}
