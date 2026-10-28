import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateDerivedStats } from '../characters/rules/character-rules';
import type { GrantItemDto, LevelUpDto } from './dto/master-actions.dto';

@Injectable()
export class MasterActionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMaster(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { masterId: true },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.masterId !== userId)
      throw new ForbiddenException('Somente o mestre pode usar este comando.');
    return campaign;
  }

  private async boundCharacter(campaignId: string, characterId: string) {
    const link = await this.prisma.campaignCharacter.findFirst({
      where: { campaignId, characterId },
      select: { entityId: true },
    });
    if (!link)
      throw new NotFoundException('Personagem não vinculado a esta campanha.');
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
    });
    if (!character) throw new NotFoundException('Personagem não encontrado.');
    return character;
  }

  async grantItem(campaignId: string, userId: string, dto: GrantItemDto) {
    await this.assertMaster(campaignId, userId);
    const character = await this.boundCharacter(campaignId, dto.characterId);
    const item = await this.prisma.item.findUnique({
      where: { id: dto.itemId },
      select: { id: true, name: true },
    });
    if (!item) throw new NotFoundException('Item não encontrado.');
    const quantity = dto.quantity ?? 1;
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { characterId: character.id, itemId: item.id },
    });
    const inventory = existing
      ? await this.prisma.inventoryItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + quantity },
        })
      : await this.prisma.inventoryItem.create({
          data: { characterId: character.id, itemId: item.id, quantity },
        });
    return {
      characterId: character.id,
      characterName: character.name,
      item,
      inventoryItemId: inventory.id,
      quantity: inventory.quantity,
    };
  }

  async levelUp(campaignId: string, userId: string, dto: LevelUpDto) {
    await this.assertMaster(campaignId, userId);
    const character = await this.boundCharacter(campaignId, dto.characterId);
    const className = dto.className?.trim() || character.class;
    const derived = calculateDerivedStats(
      {
        strength: character.strength,
        dexterity: character.dexterity,
        constitution: character.constitution,
        intelligence: character.intelligence,
        wisdom: character.wisdom,
        charisma: character.charisma,
      },
      dto.level,
      className,
    );
    const updated = await this.prisma.character.update({
      where: { id: character.id },
      data: {
        level: dto.level,
        class: className,
        maxHp: derived.maxHp,
        currentHp: Math.min(character.currentHp, derived.maxHp),
        armorClass: derived.armorClass,
        initiative: derived.initiative,
        proficiencyBonus: derived.proficiencyBonus,
      },
      select: {
        id: true,
        name: true,
        level: true,
        class: true,
        maxHp: true,
        currentHp: true,
        armorClass: true,
        proficiencyBonus: true,
      },
    });
    return updated;
  }
}
