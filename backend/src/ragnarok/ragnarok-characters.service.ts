import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRagnarokCharacterDto } from './dto/create-ragnarok-character.dto';
import { UpdateRagnarokCharacterDto } from './dto/update-ragnarok-character.dto';

const INCLUDE = { job: true } as const;

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
      },
      include: INCLUDE,
    });
  }

  async remove(userId: string, id: string) {
    const current = await this.prisma.ragnarokCharacter.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('Ficha Ragnarok não encontrada.');
    await this.prisma.ragnarokCharacter.delete({ where: { id } });
    return { success: true };
  }

  private async assertJob(jobId: number) {
    const job = await this.prisma.ragnarokJob.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    if (!job) throw new NotFoundException('Classe Ragnarok não encontrada.');
  }
}
