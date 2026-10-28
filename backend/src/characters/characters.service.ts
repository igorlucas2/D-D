import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CombatService } from '../combat/combat.service';
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
import {
  calculateDerivedStats,
  calculateSpellSlots,
} from './rules/character-rules';

const CHARACTER_INCLUDE = {
  resistances: true,
  inventory: { include: { item: true } },
  spells: { include: { spell: true } },
  spellSlots: { orderBy: { level: 'asc' } },
} satisfies Prisma.CharacterInclude;

const CLASS_SPELL_ALIASES: Record<string, string[]> = {
  Bardo: ['Bardo', 'Bard'],
  Bruxo: ['Bruxo', 'Warlock'],
  Clerigo: ['Clerigo', 'Cleric'],
  Druida: ['Druida', 'Druid'],
  Feiticeiro: ['Feiticeiro', 'Sorcerer'],
  Mago: ['Mago', 'Wizard'],
  Paladino: ['Paladino', 'Paladin'],
  Patrulheiro: ['Patrulheiro', 'Ranger'],
};

@Injectable()
export class CharactersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly combatService: CombatService,
  ) {}

  async findAllForUser(userId: string) {
    return this.prisma.character.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const character = await this.assertOwnedCharacter(id, userId);
    await this.syncSpellSlots(character.id, character.class, character.level);

    const fullCharacter = await this.prisma.character.findUnique({
      where: { id: character.id },
      include: CHARACTER_INCLUDE,
    });

    if (!fullCharacter) {
      throw new NotFoundException('Personagem nao encontrado.');
    }

    return fullCharacter;
  }

  async create(userId: string, dto: CreateCharacterDto) {
    const derived = calculateDerivedStats(
      {
        strength: dto.strength,
        dexterity: dto.dexterity,
        constitution: dto.constitution,
        intelligence: dto.intelligence,
        wisdom: dto.wisdom,
        charisma: dto.charisma,
      },
      1,
      dto.class,
    );

    const character = await this.prisma.character.create({
      data: {
        userId,
        name: dto.name,
        race: dto.race,
        class: dto.class,
        subclass: dto.subclass,
        background: dto.background,
        alignment: dto.alignment,
        deity: dto.deity,
        appearance: dto.appearance,
        backstory: dto.backstory,
        portraitUrl: dto.portraitUrl,
        strength: dto.strength,
        dexterity: dto.dexterity,
        constitution: dto.constitution,
        intelligence: dto.intelligence,
        wisdom: dto.wisdom,
        charisma: dto.charisma,
        level: 1,
        xp: 0,
        maxHp: derived.maxHp,
        currentHp: derived.maxHp,
        maxMana: 0,
        currentMana: 0,
        armorClass: derived.armorClass,
        initiative: derived.initiative,
        proficiencyBonus: derived.proficiencyBonus,
      },
    });

    await this.syncSpellSlots(character.id, character.class, character.level);
    return this.findOne(character.id, userId);
  }

  async update(id: string, userId: string, dto: UpdateCharacterDto) {
    const character = await this.findOne(id, userId);

    const attributes = {
      strength: dto.strength ?? character.strength,
      dexterity: dto.dexterity ?? character.dexterity,
      constitution: dto.constitution ?? character.constitution,
      intelligence: dto.intelligence ?? character.intelligence,
      wisdom: dto.wisdom ?? character.wisdom,
      charisma: dto.charisma ?? character.charisma,
    };
    const level = dto.level ?? character.level;
    const className = dto.class ?? character.class;
    const derived = calculateDerivedStats(attributes, level, className);
    const currentHp = Math.min(
      dto.currentHp ?? character.currentHp,
      derived.maxHp,
    );

    const updated = await this.prisma.character.update({
      where: { id },
      data: {
        ...dto,
        ...attributes,
        level,
        class: className,
        maxHp: derived.maxHp,
        maxMana: 0,
        currentHp,
        currentMana: 0,
        armorClass: derived.armorClass,
        initiative: derived.initiative,
        proficiencyBonus: derived.proficiencyBonus,
      },
    });

    await this.syncSpellSlots(updated.id, updated.class, updated.level);
    await this.combatService.syncCharacterHp(updated.id);
    return this.findOne(updated.id, userId);
  }

  async setResistances(id: string, userId: string, dto: SetResistancesDto) {
    await this.findOne(id, userId);
    const unique = new Map<string, { damageType: string; type: string }>();
    for (const entry of dto.resistances) {
      const key = `${entry.type}:${entry.damageType.trim().toLowerCase()}`;
      unique.set(key, {
        damageType: entry.damageType.trim(),
        type: entry.type,
      });
    }
    await this.prisma.$transaction([
      this.prisma.characterResistance.deleteMany({
        where: { characterId: id },
      }),
      this.prisma.characterResistance.createMany({
        data: [...unique.values()].map((entry) => ({
          characterId: id,
          damageType: entry.damageType,
          type: entry.type as 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY',
        })),
      }),
    ]);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.character.delete({ where: { id } });
    return { success: true };
  }

  async addInventoryItem(
    characterId: string,
    userId: string,
    dto: AddInventoryItemDto,
  ) {
    await this.findOne(characterId, userId);

    const item = await this.prisma.item.findUnique({
      where: { id: dto.itemId },
    });
    if (!item) {
      throw new NotFoundException('Item nao encontrado.');
    }

    const quantity = dto.quantity ?? 1;
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { characterId, itemId: dto.itemId },
    });

    if (existing) {
      return this.prisma.inventoryItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
        include: { item: true },
      });
    }

    return this.prisma.inventoryItem.create({
      data: {
        characterId,
        itemId: dto.itemId,
        quantity,
      },
      include: { item: true },
    });
  }

  async updateInventoryItem(
    characterId: string,
    inventoryItemId: string,
    userId: string,
    dto: UpdateInventoryItemDto,
  ) {
    await this.findOne(characterId, userId);

    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });
    if (!inventoryItem || inventoryItem.characterId !== characterId) {
      throw new NotFoundException('Item de inventario nao encontrado.');
    }

    return this.prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: dto,
      include: { item: true },
    });
  }

  async removeInventoryItem(
    characterId: string,
    inventoryItemId: string,
    userId: string,
  ) {
    await this.findOne(characterId, userId);

    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });
    if (!inventoryItem || inventoryItem.characterId !== characterId) {
      throw new NotFoundException('Item de inventario nao encontrado.');
    }

    await this.prisma.inventoryItem.delete({ where: { id: inventoryItemId } });
    return { success: true };
  }

  async getSpells(characterId: string, userId: string) {
    await this.findOne(characterId, userId);

    return this.prisma.characterSpell.findMany({
      where: { characterId },
      include: { spell: true },
    });
  }

  async addSpell(
    characterId: string,
    userId: string,
    dto: AddCharacterSpellDto,
  ) {
    const character = await this.findOne(characterId, userId);

    const spell = await this.prisma.spell.findUnique({
      where: { id: dto.spellId },
    });
    if (!spell) {
      throw new NotFoundException('Magia nao encontrada.');
    }
    if (!this.canCharacterLearnSpell(character.class, spell)) {
      throw new BadRequestException(
        'Esta magia nao esta disponivel para a classe do personagem.',
      );
    }

    const existing = await this.prisma.characterSpell.findFirst({
      where: { characterId, spellId: dto.spellId },
    });
    if (existing) {
      throw new BadRequestException('O personagem ja conhece esta magia.');
    }

    return this.prisma.characterSpell.create({
      data: { characterId, spellId: dto.spellId },
      include: { spell: true },
    });
  }

  async updateSpell(
    characterId: string,
    characterSpellId: string,
    userId: string,
    dto: UpdateCharacterSpellDto,
  ) {
    await this.findOne(characterId, userId);

    const characterSpell = await this.prisma.characterSpell.findUnique({
      where: { id: characterSpellId },
    });
    if (!characterSpell || characterSpell.characterId !== characterId) {
      throw new NotFoundException('Magia do personagem nao encontrada.');
    }

    return this.prisma.characterSpell.update({
      where: { id: characterSpellId },
      data: dto,
      include: { spell: true },
    });
  }

  async removeSpell(
    characterId: string,
    characterSpellId: string,
    userId: string,
  ) {
    await this.findOne(characterId, userId);

    const characterSpell = await this.prisma.characterSpell.findUnique({
      where: { id: characterSpellId },
    });
    if (!characterSpell || characterSpell.characterId !== characterId) {
      throw new NotFoundException('Magia do personagem nao encontrada.');
    }

    await this.prisma.characterSpell.delete({
      where: { id: characterSpellId },
    });
    return { success: true };
  }

  async castSpell(
    characterId: string,
    characterSpellId: string,
    userId: string,
    dto: CastCharacterSpellDto,
  ) {
    await this.findOne(characterId, userId);

    const characterSpell = await this.prisma.characterSpell.findUnique({
      where: { id: characterSpellId },
      include: { spell: true },
    });

    if (!characterSpell || characterSpell.characterId !== characterId) {
      throw new NotFoundException('Magia do personagem nao encontrada.');
    }

    const spellLevel = characterSpell.spell.level;
    if (spellLevel === 0) {
      return this.findOne(characterId, userId);
    }

    const minSlotLevel = Math.max(spellLevel, dto.slotLevel ?? spellLevel);
    const slots = await this.prisma.characterSpellSlot.findMany({
      where: {
        characterId,
        level: { gte: minSlotLevel },
        total: { gt: 0 },
      },
      orderBy: { level: 'asc' },
    });
    const slot = slots.find((candidate) => candidate.used < candidate.total);

    if (!slot) {
      throw new BadRequestException(
        'Nao ha slots disponiveis para conjurar esta magia.',
      );
    }

    await this.prisma.characterSpellSlot.update({
      where: { id: slot.id },
      data: { used: slot.used + 1 },
    });

    return this.findOne(characterId, userId);
  }

  async adjustSpellSlot(
    characterId: string,
    userId: string,
    level: number,
    delta: number,
  ) {
    if (!Number.isInteger(level) || level < 1 || level > 9) {
      throw new BadRequestException('Nivel de slot invalido.');
    }

    await this.findOne(characterId, userId);
    const slot = await this.prisma.characterSpellSlot.findUnique({
      where: { characterId_level: { characterId, level } },
    });

    if (!slot || slot.total === 0) {
      throw new NotFoundException('Slot de magia nao encontrado.');
    }

    await this.prisma.characterSpellSlot.update({
      where: { id: slot.id },
      data: { used: Math.max(0, Math.min(slot.total, slot.used + delta)) },
    });

    return this.findOne(characterId, userId);
  }

  async resetSpellSlots(characterId: string, userId: string) {
    await this.findOne(characterId, userId);
    await this.prisma.characterSpellSlot.updateMany({
      where: { characterId },
      data: { used: 0 },
    });

    return this.findOne(characterId, userId);
  }

  async longRest(characterId: string, userId: string) {
    const character = await this.findOne(characterId, userId);
    if (
      await this.prisma.campaignCharacter.findUnique({ where: { characterId } })
    )
      throw new BadRequestException(
        'Use o descanso coletivo em Comandos da campanha deste personagem.',
      );

    await this.prisma.character.update({
      where: { id: characterId },
      data: {
        currentHp: character.maxHp,
        tempHp: 0,
        concentration: null,
      },
    });
    await this.combatService.syncCharacterHp(characterId);
    await this.prisma.characterSpellSlot.updateMany({
      where: { characterId },
      data: { used: 0 },
    });

    return this.findOne(characterId, userId);
  }

  private async assertOwnedCharacter(id: string, userId: string) {
    const character = await this.prisma.character.findUnique({ where: { id } });

    if (!character) {
      throw new NotFoundException('Personagem nao encontrado.');
    }
    if (character.userId !== userId) {
      throw new ForbiddenException('Voce nao tem acesso a este personagem.');
    }

    return character;
  }

  private async syncSpellSlots(
    characterId: string,
    className: string,
    level: number,
  ) {
    const progression = calculateSpellSlots(className, level);

    for (const slot of progression) {
      const existing = await this.prisma.characterSpellSlot.findUnique({
        where: { characterId_level: { characterId, level: slot.level } },
      });

      await this.prisma.characterSpellSlot.upsert({
        where: { characterId_level: { characterId, level: slot.level } },
        create: {
          characterId,
          level: slot.level,
          total: slot.total,
          used: 0,
        },
        update: {
          total: slot.total,
          used: Math.min(existing?.used ?? 0, slot.total),
        },
      });
    }
  }

  private canCharacterLearnSpell(
    className: string,
    spell: { classes: string | null },
  ) {
    if (!spell.classes) return true;
    const classNames = this.parseSpellClasses(spell.classes);
    if (classNames.length === 0) return true;

    const aliases = CLASS_SPELL_ALIASES[className] ?? [className];
    return classNames.some((spellClass) =>
      aliases.some((alias) => alias.toLowerCase() === spellClass.toLowerCase()),
    );
  }

  private parseSpellClasses(value: string) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }
}
