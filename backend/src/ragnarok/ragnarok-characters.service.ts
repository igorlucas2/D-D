import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddRagnarokSkillDto } from './dto/add-ragnarok-skill.dto';
import {
  AddRagnarokItemDto,
  UpdateRagnarokItemDto,
} from './dto/add-ragnarok-item.dto';
import { CreateRagnarokCharacterDto } from './dto/create-ragnarok-character.dto';
import { AllocateStatDto } from './dto/allocate-stat.dto';
import { UpdateRagnarokCharacterDto } from './dto/update-ragnarok-character.dto';

const INCLUDE = {
  job: true,
  skills: { include: { skill: true }, orderBy: { createdAt: 'asc' } },
  equipment: { include: { item: true }, orderBy: { createdAt: 'asc' } },
} as const;

function derived(level: number, vitality: number, intelligence: number) {
  return {
    maxHp: 40 + level * 10 + vitality * 5,
    maxSp: 10 + level * 2 + intelligence * 3,
  };
}

@Injectable()
export class RagnarokCharactersService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.ragnarokCharacter.findMany({
      where: { userId },
      include: INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, dto: CreateRagnarokCharacterDto) {
    await this.assertJob(dto.jobId);
    const stats = derived(
      dto.level ?? 1,
      dto.vitality ?? 1,
      dto.intelligence ?? 1,
    );
    return this.prisma.ragnarokCharacter.create({
      data: {
        userId,
        jobId: dto.jobId,
        name: dto.name.trim(),
        level: dto.level ?? 1,
        strength: dto.strength ?? 1,
        agility: dto.agility ?? 1,
        vitality: dto.vitality ?? 1,
        intelligence: dto.intelligence ?? 1,
        dexterity: dto.dexterity ?? 1,
        luck: dto.luck ?? 1,
        appearance: dto.appearance ?? null,
        ...stats,
        currentHp: stats.maxHp,
        currentSp: stats.maxSp,
        statPoints: (dto.level ?? 1) > 1 ? (dto.level ?? 1) * 3 : 15,
        skillPoints: (dto.level ?? 1) > 1 ? (dto.level ?? 1) : 1,
      },
      include: INCLUDE,
    });
  }

  async update(userId: string, id: string, dto: UpdateRagnarokCharacterDto) {
    const current = await this.prisma.ragnarokCharacter.findFirst({
      where: { id, userId },
    });
    if (!current) throw new NotFoundException('Ficha Ragnarok não encontrada.');
    if (dto.jobId !== undefined) await this.assertJob(dto.jobId);
    const stats = derived(
      dto.level ?? current.level,
      dto.vitality ?? current.vitality,
      dto.intelligence ?? current.intelligence,
    );
    const levelGain = Math.max(0, (dto.level ?? current.level) - current.level);
    return this.prisma.ragnarokCharacter.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.jobId !== undefined ? { jobId: dto.jobId } : {}),
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(dto.strength !== undefined ? { strength: dto.strength } : {}),
        ...(dto.agility !== undefined ? { agility: dto.agility } : {}),
        ...(dto.vitality !== undefined ? { vitality: dto.vitality } : {}),
        ...(dto.intelligence !== undefined
          ? { intelligence: dto.intelligence }
          : {}),
        ...(dto.dexterity !== undefined ? { dexterity: dto.dexterity } : {}),
        ...(dto.luck !== undefined ? { luck: dto.luck } : {}),
        ...(dto.appearance !== undefined
          ? { appearance: dto.appearance || null }
          : {}),
        ...(levelGain
          ? {
              statPoints: { increment: levelGain * 3 },
              skillPoints: { increment: levelGain },
            }
          : {}),
        ...stats,
        currentHp: Math.min(stats.maxHp, current.currentHp),
        currentSp: Math.min(stats.maxSp, current.currentSp),
      },
      include: INCLUDE,
    });
  }

  async allocateStat(userId: string, id: string, dto: AllocateStatDto) {
    const current = await this.owned(userId, id);
    if (current[dto.stat] + dto.amount > 99) {
      throw new BadRequestException('Atributo máximo é 99.');
    }
    if (current.statPoints < dto.amount) {
      throw new BadRequestException('Pontos de atributo insuficientes.');
    }
    const result = await this.prisma.ragnarokCharacter.updateMany({
      where: { id, userId, statPoints: { gte: dto.amount } },
      data: {
        [dto.stat]: { increment: dto.amount },
        statPoints: { decrement: dto.amount },
      },
    });
    if (result.count === 0) {
      throw new BadRequestException('Pontos de atributo insuficientes.');
    }
    const updated = await this.owned(userId, id);
    const stats = derived(
      updated.level,
      updated.vitality,
      updated.intelligence,
    );
    await this.prisma.ragnarokCharacter.update({
      where: { id },
      data: {
        ...stats,
        currentHp: Math.min(stats.maxHp, updated.currentHp),
        currentSp: Math.min(stats.maxSp, updated.currentSp),
      },
    });
    return this.prisma.ragnarokCharacter.findUnique({
      where: { id },
      include: INCLUDE,
    });
  }

  async addSkill(userId: string, id: string, dto: AddRagnarokSkillDto) {
    const character = await this.owned(userId, id);
    const skill = await this.prisma.ragnarokSkill.findUnique({
      where: { id: dto.skillId },
      select: { id: true, maxLevel: true },
    });
    if (!skill) throw new NotFoundException('Skill Ragnarok não encontrada.');
    const level = Math.max(1, Math.min(dto.level, skill.maxLevel));
    const existing = await this.prisma.ragnarokCharacterSkill.findUnique({
      where: {
        characterId_skillId: {
          characterId: character.id,
          skillId: dto.skillId,
        },
      },
      select: { level: true },
    });
    const cost = Math.max(0, level - (existing?.level ?? 0));
    if (cost > character.skillPoints) {
      throw new BadRequestException('Pontos de skill insuficientes.');
    }
    await this.prisma.$transaction([
      this.prisma.ragnarokCharacterSkill.upsert({
        where: {
          characterId_skillId: {
            characterId: character.id,
            skillId: dto.skillId,
          },
        },
        update: { level },
        create: { characterId: character.id, skillId: dto.skillId, level },
      }),
      ...(cost
        ? [
            this.prisma.ragnarokCharacter.update({
              where: { id: character.id },
              data: { skillPoints: { decrement: cost } },
            }),
          ]
        : []),
    ]);
    return this.prisma.ragnarokCharacter.findUnique({
      where: { id },
      include: INCLUDE,
    });
  }

  async removeSkill(userId: string, id: string, skillId: number) {
    const character = await this.owned(userId, id);
    await this.prisma.ragnarokCharacterSkill.deleteMany({
      where: { characterId: character.id, skillId },
    });
    return this.prisma.ragnarokCharacter.findUnique({
      where: { id },
      include: INCLUDE,
    });
  }

  async addItem(userId: string, id: string, dto: AddRagnarokItemDto) {
    const character = await this.owned(userId, id);
    const item = await this.prisma.ragnarokItem.findUnique({
      where: { id: dto.itemId },
      select: { id: true, viewKind: true, equipSlots: true },
    });
    if (!item) throw new NotFoundException('Item Ragnarok não encontrado.');
    const slot =
      dto.slot?.trim() ||
      item.viewKind ||
      (Array.isArray(item.equipSlots)
        ? item.equipSlots.map(String).join('/')
        : '') ||
      'Geral';
    const equipped = dto.equipped ?? false;
    const entry = await this.prisma.ragnarokCharacterItem.upsert({
      where: {
        characterId_itemId: { characterId: character.id, itemId: item.id },
      },
      update: { slot, equipped },
      create: {
        characterId: character.id,
        itemId: item.id,
        slot,
        equipped,
      },
    });
    if (equipped) {
      await this.prisma.ragnarokCharacterItem.updateMany({
        where: {
          characterId: character.id,
          slot,
          equipped: true,
          id: { not: entry.id },
        },
        data: { equipped: false },
      });
    }
    return this.prisma.ragnarokCharacter.findUnique({
      where: { id },
      include: INCLUDE,
    });
  }

  async updateItem(
    userId: string,
    id: string,
    entryId: string,
    dto: UpdateRagnarokItemDto,
  ) {
    const character = await this.owned(userId, id);
    const entry = await this.prisma.ragnarokCharacterItem.findFirst({
      where: { id: entryId, characterId: character.id },
    });
    if (!entry) throw new NotFoundException('Equipamento não encontrado.');
    const equipped = dto.equipped ?? entry.equipped;
    const slot = dto.slot !== undefined ? dto.slot || entry.slot : entry.slot;
    await this.prisma.ragnarokCharacterItem.update({
      where: { id: entryId },
      data: { equipped, slot },
    });
    if (equipped && slot) {
      await this.prisma.ragnarokCharacterItem.updateMany({
        where: {
          characterId: character.id,
          slot,
          equipped: true,
          id: { not: entryId },
        },
        data: { equipped: false },
      });
    }
    return this.prisma.ragnarokCharacter.findUnique({
      where: { id },
      include: INCLUDE,
    });
  }

  async removeItem(userId: string, id: string, entryId: string) {
    const character = await this.owned(userId, id);
    const entry = await this.prisma.ragnarokCharacterItem.findFirst({
      where: { id: entryId, characterId: character.id },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException('Equipamento não encontrado.');
    await this.prisma.ragnarokCharacterItem.delete({ where: { id: entryId } });
    return this.prisma.ragnarokCharacter.findUnique({
      where: { id },
      include: INCLUDE,
    });
  }

  async remove(userId: string, id: string) {
    await this.owned(userId, id);
    await this.prisma.ragnarokCharacter.delete({ where: { id } });
    return { success: true };
  }

  private async owned(userId: string, id: string) {
    const character = await this.prisma.ragnarokCharacter.findFirst({
      where: { id, userId },
    });
    if (!character)
      throw new NotFoundException('Ficha Ragnarok não encontrada.');
    return character;
  }

  private async assertJob(jobId: number) {
    const job = await this.prisma.ragnarokJob.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    if (!job) throw new NotFoundException('Classe Ragnarok não encontrada.');
  }
}
