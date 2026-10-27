import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorldEntryDto } from './dto/create-world-entry.dto';
import { UpdateWorldEntryDto } from './dto/update-world-entry.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import { AdvanceClockDto } from './dto/advance-clock.dto';
import { CreateWorldEventDto } from './dto/create-world-event.dto';
import { UpdateWorldEventDto } from './dto/update-world-event.dto';
import { WorldGateway } from './world.gateway';
import {
  asWeather,
  type SerializedCalendar,
  type Weather,
} from './world.types';

const DEFAULT_MONTH_NAMES = [
  'Mês 1',
  'Mês 2',
  'Mês 3',
  'Mês 4',
  'Mês 5',
  'Mês 6',
  'Mês 7',
  'Mês 8',
  'Mês 9',
  'Mês 10',
  'Mês 11',
  'Mês 12',
];
const DEFAULT_DAYS_PER_MONTH = Array.from({ length: 12 }, () => 30);
const DEFAULT_WEEKDAY_NAMES = [
  'Dia 1',
  'Dia 2',
  'Dia 3',
  'Dia 4',
  'Dia 5',
  'Dia 6',
  'Dia 7',
];

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;

export function totalMinutesFromFields(
  currentDay: number,
  currentMonth: number,
  currentYear: number,
  currentHour: number,
  currentMinute: number,
  daysPerMonth: number[],
): number {
  const daysInYear = daysPerMonth.reduce((sum, days) => sum + days, 0) || 1;
  const monthsElapsed = Math.max(0, currentMonth - 1);
  const daysBeforeMonth = daysPerMonth
    .slice(0, monthsElapsed)
    .reduce((sum, days) => sum + days, 0);
  const yearsElapsed = Math.max(0, currentYear - 1);
  const totalDays =
    yearsElapsed * daysInYear + daysBeforeMonth + Math.max(0, currentDay - 1);

  return (
    totalDays * MINUTES_PER_DAY + currentHour * MINUTES_PER_HOUR + currentMinute
  );
}

export function deriveFieldsFromTotalMinutes(
  totalMinutes: number,
  daysPerMonth: number[],
) {
  const safeMinutes = Math.max(0, totalMinutes);
  const totalDaysElapsed = Math.floor(safeMinutes / MINUTES_PER_DAY);
  const minutesOfDay = safeMinutes % MINUTES_PER_DAY;
  const currentHour = Math.floor(minutesOfDay / MINUTES_PER_HOUR);
  const currentMinute = minutesOfDay % MINUTES_PER_HOUR;

  const daysInYear = daysPerMonth.reduce((sum, days) => sum + days, 0) || 1;
  const yearsElapsed = Math.floor(totalDaysElapsed / daysInYear);
  let dayOfYear = totalDaysElapsed % daysInYear;
  let monthIndex = 0;
  while (
    monthIndex < daysPerMonth.length - 1 &&
    dayOfYear >= (daysPerMonth[monthIndex] ?? 30)
  ) {
    dayOfYear -= daysPerMonth[monthIndex] ?? 30;
    monthIndex += 1;
  }

  return {
    currentYear: yearsElapsed + 1,
    currentMonth: monthIndex + 1,
    currentDay: dayOfYear + 1,
    currentHour,
    currentMinute,
    totalDaysElapsed,
  };
}

@Injectable()
export class WorldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly worldGateway: WorldGateway,
  ) {}

  async findEntries(campaignId: string, userId: string) {
    await this.assertIsMember(campaignId, userId);

    return this.prisma.campaignWorldEntry.findMany({
      where: { campaignId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async createEntry(
    campaignId: string,
    userId: string,
    dto: CreateWorldEntryDto,
  ) {
    await this.assertIsMaster(campaignId, userId);

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Informe um nome para a entrada.');
    }

    if (dto.parentId) {
      await this.getOwnedEntry(campaignId, dto.parentId);
    }

    return this.prisma.campaignWorldEntry.create({
      data: {
        campaignId,
        type: dto.type,
        name,
        summary: dto.summary?.trim() || null,
        description: dto.description?.trim() || null,
        parentId: dto.parentId ?? null,
      },
    });
  }

  async updateEntry(
    campaignId: string,
    entryId: string,
    userId: string,
    dto: UpdateWorldEntryDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    await this.getOwnedEntry(campaignId, entryId);

    if (dto.parentId) {
      if (dto.parentId === entryId) {
        throw new BadRequestException(
          'Uma entrada não pode ser sua própria categoria pai.',
        );
      }
      await this.getOwnedEntry(campaignId, dto.parentId);
    }

    const data: Record<string, unknown> = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Informe um nome para a entrada.');
      }
      data.name = name;
    }
    if (dto.summary !== undefined) data.summary = dto.summary?.trim() || null;
    if (dto.description !== undefined)
      data.description = dto.description?.trim() || null;
    if (dto.parentId !== undefined) data.parentId = dto.parentId || null;

    return this.prisma.campaignWorldEntry.update({
      where: { id: entryId },
      data,
    });
  }

  async removeEntry(campaignId: string, entryId: string, userId: string) {
    await this.assertIsMaster(campaignId, userId);
    await this.getOwnedEntry(campaignId, entryId);
    await this.prisma.campaignWorldEntry.delete({ where: { id: entryId } });
    return { success: true };
  }

  async getCalendar(campaignId: string, userId: string) {
    await this.assertIsMember(campaignId, userId);
    return this.loadCalendar(campaignId);
  }

  async updateCalendar(
    campaignId: string,
    userId: string,
    dto: UpdateCalendarDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    await this.assertLegacyClock(campaignId);

    const existing = await this.loadCalendar(campaignId);

    const monthNames = dto.monthNames ?? existing.monthNames;
    const daysPerMonth = dto.daysPerMonth ?? existing.daysPerMonth;
    const weekdayNames = dto.weekdayNames ?? existing.weekdayNames;

    if (monthNames.length !== daysPerMonth.length) {
      throw new BadRequestException(
        'A quantidade de meses deve ser igual à quantidade de durações informadas.',
      );
    }

    const currentMonth = dto.currentMonth ?? existing.currentMonth;
    if (currentMonth > monthNames.length) {
      throw new BadRequestException('Mês atual fora do calendário definido.');
    }

    const maxDay = daysPerMonth[currentMonth - 1] ?? 30;
    const currentDay = dto.currentDay ?? existing.currentDay;
    if (currentDay > maxDay) {
      throw new BadRequestException('Dia atual fora do mês definido.');
    }

    const currentYear = dto.currentYear ?? existing.currentYear;
    const currentHour = dto.currentHour ?? existing.currentHour;
    const currentMinute = dto.currentMinute ?? existing.currentMinute;

    const dateChanged =
      dto.currentDay !== undefined ||
      dto.currentMonth !== undefined ||
      dto.currentYear !== undefined ||
      dto.currentHour !== undefined ||
      dto.currentMinute !== undefined;

    const totalMinutes = dateChanged
      ? totalMinutesFromFields(
          currentDay,
          currentMonth,
          currentYear,
          currentHour,
          currentMinute,
          daysPerMonth,
        )
      : existing.totalMinutes;

    const notes =
      dto.notes !== undefined ? dto.notes.trim() || null : existing.notes;

    const realMinutesPerTick =
      dto.realMinutesPerTick ?? existing.realMinutesPerTick;
    const gameMinutesPerTick =
      dto.gameMinutesPerTick ?? existing.gameMinutesPerTick;
    const eventChancePercent =
      dto.eventChancePercent ?? existing.eventChancePercent;

    await this.persistCalendar(campaignId, {
      monthNames,
      daysPerMonth,
      weekdayNames,
      totalMinutes,
      notes,
      realMinutesPerTick,
      gameMinutesPerTick,
      eventChancePercent,
    });

    const serialized = this.buildSerializedCalendar({
      monthNames,
      daysPerMonth,
      weekdayNames,
      totalMinutes,
      notes,
      realMinutesPerTick,
      gameMinutesPerTick,
      eventChancePercent,
      weather: existing.weather,
    });

    this.worldGateway.emitClockUpdated(campaignId, serialized);
    return serialized;
  }

  async setWeather(campaignId: string, userId: string, weather: Weather) {
    await this.assertIsMaster(campaignId, userId);
    return this.applyWeather(campaignId, weather);
  }

  /** Grava o clima global e avisa a mesa pelo mesmo evento do relógio. */
  private async applyWeather(campaignId: string, weather: Weather) {
    await this.assertLegacyClock(campaignId);
    const existing = await this.loadCalendar(campaignId);
    // Garante o registro do calendário antes de gravar o clima.
    await this.persistCalendar(campaignId, existing);
    await this.prisma.campaignCalendar.update({
      where: { campaignId },
      data: { weather },
    });
    const serialized = { ...existing, weather };
    this.worldGateway.emitClockUpdated(campaignId, serialized);
    return serialized;
  }

  async advanceClock(campaignId: string, userId: string, dto: AdvanceClockDto) {
    await this.assertIsMaster(campaignId, userId);
    return this.addMinutes(campaignId, dto.minutes);
  }

  // Avanca o relogio do mundo sem checagem de permissao — usado tambem pelo
  // modulo de exploracao quando um personagem viaja ou descansa.
  async addMinutes(
    campaignId: string,
    minutes: number,
  ): Promise<SerializedCalendar> {
    await this.assertLegacyClock(campaignId);
    const existing = await this.loadCalendar(campaignId);
    const totalMinutes = existing.totalMinutes + minutes;

    await this.persistCalendar(campaignId, {
      monthNames: existing.monthNames,
      daysPerMonth: existing.daysPerMonth,
      weekdayNames: existing.weekdayNames,
      totalMinutes,
      notes: existing.notes,
      realMinutesPerTick: existing.realMinutesPerTick,
      gameMinutesPerTick: existing.gameMinutesPerTick,
      eventChancePercent: existing.eventChancePercent,
    });

    const serialized = this.buildSerializedCalendar({
      monthNames: existing.monthNames,
      daysPerMonth: existing.daysPerMonth,
      weekdayNames: existing.weekdayNames,
      totalMinutes,
      notes: existing.notes,
      realMinutesPerTick: existing.realMinutesPerTick,
      gameMinutesPerTick: existing.gameMinutesPerTick,
      eventChancePercent: existing.eventChancePercent,
      weather: existing.weather,
    });

    this.worldGateway.emitClockUpdated(campaignId, serialized);
    return serialized;
  }

  // Lista campanhas com avanco automatico do relogio habilitado, junto com
  // o intervalo configurado e a data da ultima atualizacao do calendario —
  // usado pelo WorldTickService para decidir quando aplicar um tick.
  async findCampaignsWithAutoTick() {
    return this.prisma.campaignCalendar.findMany({
      where: {
        realMinutesPerTick: { gt: 0 },
        campaign: { lore: { is: null } },
      },
      select: {
        campaignId: true,
        realMinutesPerTick: true,
        gameMinutesPerTick: true,
        eventChancePercent: true,
        updatedAt: true,
      },
    });
  }

  // Sorteia um evento ativo da tabela de eventos da campanha (ponderado por
  // `weight`) e cria uma entrada de diario automaticamente — usado pelo
  // WorldTickService quando o sorteio de chance do tick e bem-sucedido.
  async rollWorldEvent(campaignId: string) {
    await this.assertLegacyClock(campaignId);
    const events = await this.prisma.campaignWorldEvent.findMany({
      where: { campaignId, isActive: true },
    });
    if (events.length === 0) return null;

    const totalWeight = events.reduce((sum, event) => sum + event.weight, 0);
    if (totalWeight <= 0) return null;

    let roll = Math.random() * totalWeight;
    let chosen = events[0];
    for (const event of events) {
      roll -= event.weight;
      if (roll <= 0) {
        chosen = event;
        break;
      }
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) return null;

    const entry = await this.prisma.campaignJournalEntry.create({
      data: {
        campaignId,
        authorId: campaign.masterId,
        title: chosen.title,
        content: chosen.content,
        category: chosen.category,
      },
    });

    const weather = chosen.weatherEffect
      ? asWeather(chosen.weatherEffect)
      : null;
    if (weather) await this.applyWeather(campaignId, weather);

    // O conteúdo já é público no diário; aqui só vira um momento ao vivo.
    this.worldGateway.emitWorldEvent(campaignId, {
      title: chosen.title,
      content: chosen.content,
      category: chosen.category,
      weather,
      journalEntryId: entry.id,
    });
    return entry;
  }

  private async assertLegacyClock(campaignId: string) {
    if (await this.prisma.campaignLore.findUnique({ where: { campaignId } }))
      throw new ConflictException(
        'Este cenário usa o relógio dos comandos de grupo. Abra Comandos na mesa; calendário, clima e ticks livres não fazem parte deste perfil.',
      );
  }

  async findEvents(campaignId: string, userId: string) {
    await this.assertIsMaster(campaignId, userId);
    return this.prisma.campaignWorldEvent.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createEvent(
    campaignId: string,
    userId: string,
    dto: CreateWorldEventDto,
  ) {
    await this.assertIsMaster(campaignId, userId);

    const title = dto.title.trim();
    const content = dto.content.trim();
    if (!title || !content) {
      throw new BadRequestException(
        'Informe um título e uma descrição para o evento.',
      );
    }

    return this.prisma.campaignWorldEvent.create({
      data: {
        campaignId,
        title,
        content,
        category: dto.category ?? 'EVENTO',
        weight: dto.weight ?? 1,
        isActive: dto.isActive ?? true,
        weatherEffect: dto.weatherEffect ?? null,
      },
    });
  }

  async updateEvent(
    campaignId: string,
    eventId: string,
    userId: string,
    dto: UpdateWorldEventDto,
  ) {
    await this.assertIsMaster(campaignId, userId);
    await this.getOwnedEvent(campaignId, eventId);

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) {
        throw new BadRequestException('Informe um título para o evento.');
      }
      data.title = title;
    }
    if (dto.content !== undefined) {
      const content = dto.content.trim();
      if (!content) {
        throw new BadRequestException('Informe uma descrição para o evento.');
      }
      data.content = content;
    }
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.weight !== undefined) data.weight = dto.weight;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.weatherEffect !== undefined) data.weatherEffect = dto.weatherEffect;

    return this.prisma.campaignWorldEvent.update({
      where: { id: eventId },
      data,
    });
  }

  async removeEvent(campaignId: string, eventId: string, userId: string) {
    await this.assertIsMaster(campaignId, userId);
    await this.getOwnedEvent(campaignId, eventId);
    await this.prisma.campaignWorldEvent.delete({ where: { id: eventId } });
    return { success: true };
  }

  private async getOwnedEvent(campaignId: string, eventId: string) {
    const event = await this.prisma.campaignWorldEvent.findUnique({
      where: { id: eventId },
    });

    if (!event || event.campaignId !== campaignId) {
      throw new NotFoundException('Evento não encontrado.');
    }

    return event;
  }

  private async loadCalendar(campaignId: string): Promise<SerializedCalendar> {
    const existing = await this.prisma.campaignCalendar.findUnique({
      where: { campaignId },
    });

    if (!existing) {
      return this.buildSerializedCalendar({
        monthNames: DEFAULT_MONTH_NAMES,
        daysPerMonth: DEFAULT_DAYS_PER_MONTH,
        weekdayNames: DEFAULT_WEEKDAY_NAMES,
        totalMinutes: totalMinutesFromFields(
          1,
          1,
          1,
          8,
          0,
          DEFAULT_DAYS_PER_MONTH,
        ),
        notes: null,
        realMinutesPerTick: 0,
        gameMinutesPerTick: 60,
        eventChancePercent: 0,
        weather: 'clear',
      });
    }

    const monthNames = this.parseStringArray(
      existing.monthNames,
      DEFAULT_MONTH_NAMES,
    );
    const daysPerMonth = this.parseNumberArray(
      existing.daysPerMonth,
      DEFAULT_DAYS_PER_MONTH,
    );
    const weekdayNames = this.parseStringArray(
      existing.weekdayNames,
      DEFAULT_WEEKDAY_NAMES,
    );

    let totalMinutes = existing.totalMinutes;
    if (totalMinutes === 0) {
      const backfilled = totalMinutesFromFields(
        existing.currentDay,
        existing.currentMonth,
        existing.currentYear,
        existing.currentHour,
        existing.currentMinute,
        daysPerMonth,
      );
      if (backfilled !== 0) {
        totalMinutes = backfilled;
        await this.persistCalendar(campaignId, {
          monthNames,
          daysPerMonth,
          weekdayNames,
          totalMinutes,
          notes: existing.notes,
          realMinutesPerTick: existing.realMinutesPerTick,
          gameMinutesPerTick: existing.gameMinutesPerTick,
          eventChancePercent: existing.eventChancePercent,
        });
      }
    }

    return this.buildSerializedCalendar({
      monthNames,
      daysPerMonth,
      weekdayNames,
      totalMinutes,
      notes: existing.notes,
      realMinutesPerTick: existing.realMinutesPerTick,
      gameMinutesPerTick: existing.gameMinutesPerTick,
      eventChancePercent: existing.eventChancePercent,
      weather: asWeather(existing.weather),
    });
  }

  private async persistCalendar(
    campaignId: string,
    input: {
      monthNames: string[];
      daysPerMonth: number[];
      weekdayNames: string[];
      totalMinutes: number;
      notes: string | null;
      realMinutesPerTick: number;
      gameMinutesPerTick: number;
      eventChancePercent: number;
    },
  ) {
    const derived = deriveFieldsFromTotalMinutes(
      input.totalMinutes,
      input.daysPerMonth,
    );

    const data = {
      monthNames: JSON.stringify(input.monthNames),
      daysPerMonth: JSON.stringify(input.daysPerMonth),
      weekdayNames: JSON.stringify(input.weekdayNames),
      totalMinutes: input.totalMinutes,
      currentDay: derived.currentDay,
      currentMonth: derived.currentMonth,
      currentYear: derived.currentYear,
      currentHour: derived.currentHour,
      currentMinute: derived.currentMinute,
      notes: input.notes,
      realMinutesPerTick: input.realMinutesPerTick,
      gameMinutesPerTick: input.gameMinutesPerTick,
      eventChancePercent: input.eventChancePercent,
    };

    await this.prisma.campaignCalendar.upsert({
      where: { campaignId },
      create: { campaignId, ...data },
      update: data,
    });
  }

  private buildSerializedCalendar(input: {
    monthNames: string[];
    daysPerMonth: number[];
    weekdayNames: string[];
    totalMinutes: number;
    notes: string | null;
    realMinutesPerTick: number;
    gameMinutesPerTick: number;
    eventChancePercent: number;
    weather: Weather;
  }): SerializedCalendar {
    const derived = deriveFieldsFromTotalMinutes(
      input.totalMinutes,
      input.daysPerMonth,
    );
    const weekdayCount = input.weekdayNames.length || 1;

    return {
      monthNames: input.monthNames,
      daysPerMonth: input.daysPerMonth,
      weekdayNames: input.weekdayNames,
      totalMinutes: input.totalMinutes,
      currentDay: derived.currentDay,
      currentMonth: derived.currentMonth,
      currentYear: derived.currentYear,
      currentHour: derived.currentHour,
      currentMinute: derived.currentMinute,
      currentWeekdayIndex: derived.totalDaysElapsed % weekdayCount,
      notes: input.notes,
      realMinutesPerTick: input.realMinutesPerTick,
      gameMinutesPerTick: input.gameMinutesPerTick,
      eventChancePercent: input.eventChancePercent,
      weather: input.weather,
    };
  }

  private parseStringArray(value: string, fallback: string[]) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) &&
        parsed.every((item) => typeof item === 'string')
        ? parsed
        : fallback;
    } catch {
      return fallback;
    }
  }

  private parseNumberArray(value: string, fallback: number[]) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) &&
        parsed.every((item) => typeof item === 'number')
        ? parsed
        : fallback;
    } catch {
      return fallback;
    }
  }

  private async getOwnedEntry(campaignId: string, entryId: string) {
    const entry = await this.prisma.campaignWorldEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry || entry.campaignId !== campaignId) {
      throw new NotFoundException('Entrada do mundo não encontrada.');
    }

    return entry;
  }

  private async assertIsMember(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { members: { select: { userId: true } } },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }

    const isMember =
      campaign.masterId === userId ||
      campaign.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Você não tem acesso a esta campanha.');
    }

    return campaign;
  }

  private async assertIsMaster(campaignId: string, userId: string) {
    const campaign = await this.assertIsMember(campaignId, userId);
    if (campaign.masterId !== userId) {
      throw new ForbiddenException('Apenas o mestre pode realizar esta ação.');
    }
    return campaign;
  }
}
