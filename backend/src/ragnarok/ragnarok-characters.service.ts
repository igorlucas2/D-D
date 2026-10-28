import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddRagnarokSkillDto } from './dto/add-ragnarok-skill.dto';
import { CreateRagnarokCharacterDto } from './dto/create-ragnarok-character.dto';
import { UpdateRagnarokCharacterDto } from './dto/update-ragnarok-character.dto';

const INCLUDE = {
  job: true,
  skills: { include: { skill: true }, orderBy: { createdAt: 'asc' } },
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
        ...stats,
        currentHp: Math.min(stats.maxHp, current.currentHp),
        currentSp: Math.min(stats.maxSp, current.currentSp),
      },
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
    await this.prisma.ragnarokCharacterSkill.upsert({
      where: {
        characterId_skillId: {
          characterId: character.id,
          skillId: dto.skillId,
        },
      },
      update: { level },
      create: { characterId: character.id, skillId: dto.skillId, level },
    });
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

  async remove(userId: string, id: string) {
    await this.owned(userId, id);
    await this.prisma.ragnarokCharacter.delete({ where: { id } });
    return { success: true };
  }

  private async owned(userId: string, id: string) {
    const character = await this.prisma.ragnarokCharacter.findFirst({
      where: { id, userId },
      select: { id: true },
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
