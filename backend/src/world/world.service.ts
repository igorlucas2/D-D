import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type CampaignCalendar } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorldEntryDto } from './dto/create-world-entry.dto';
import { UpdateWorldEntryDto } from './dto/update-world-entry.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import { AdvanceClockDto } from './dto/advance-clock.dto';
import { CreateWorldEventDto } from './dto/create-world-event.dto';
import { UpdateWorldEventDto } from './dto/update-world-event.dto';
import { WorldGateway } from './world.gateway';
import { planAutoTick } from './clock';
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

/** Campos escalares do calendário, prontos para create/update. */
interface CalendarData {
  monthNames: string;
  daysPerMonth: string;
  weekdayNames: string;
  totalMinutes: number;
  currentDay: number;
  currentMonth: number;
  currentYear: number;
  currentHour: number;
  currentMinute: number;
  notes: string | null;
  realMinutesPerTick: number;
  gameMinutesPerTick: number;
  eventChancePercent: number;
}

/** Entrada semântica do calendário (listas já desserializadas). */
interface CalendarInput {
  monthNames: string[];
  daysPerMonth: number[];
  weekdayNames: string[];
  totalMinutes: number;
  notes: string | null;
  realMinutesPerTick: number;
  gameMinutesPerTick: number;
  eventChancePercent: number;
}

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

    const existingRow = await this.ensureCalendar(campaignId);
    const existing = this.serializeRow(existingRow);

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

    const data = this.calendarData({
      monthNames,
      daysPerMonth,
      weekdayNames,
      totalMinutes,
      notes,
      realMinutesPerTick: dto.realMinutesPerTick ?? existing.realMinutesPerTick,
      gameMinutesPerTick: dto.gameMinutesPerTick ?? existing.gameMinutesPerTick,
      eventChancePercent: dto.eventChancePercent ?? existing.eventChancePercent,
    });

    const updated = await this.writeCalendar(
      campaignId,
      data,
      dto.expectedRevision,
    );
    const serialized = this.serializeRow(updated);

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
    await this.ensureCalendar(campaignId);

    const updated = await this.prisma.campaignCalendar.update({
      where: { campaignId },
      data: { weather, revision: { increment: 1 } },
    });

    const serialized = this.serializeRow(updated);
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
    await this.ensureCalendar(campaignId);

    // Incremento atômico: dois avanços simultâneos (tick + viagem) não perdem
    // minutos, ao contrário do antigo ler-somar-gravar.
    const updated = await this.prisma.campaignCalendar.update({
      where: { campaignId },
      data: {
        totalMinutes: { increment: minutes },
        revision: { increment: 1 },
      },
    });

    const serialized = this.serializeRow(updated);
    this.worldGateway.emitClockUpdated(campaignId, serialized);
    return serialized;
  }

  // Lista campanhas com avanco automatico do relogio habilitado, junto com
  // o intervalo configurado e o instante do ultimo tick — usado pelo
  // WorldTickService para decidir quando aplicar um tick.
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
        lastTickAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Aplica o tick automático se o intervalo venceu, com CAS em `lastTickAt`:
   * duas instâncias nunca somam o mesmo tick. Retorna null quando ainda não
   * venceu ou quando outra instância ganhou a corrida.
   */
  async advanceAutoTick(calendar: {
    campaignId: string;
    realMinutesPerTick: number;
    gameMinutesPerTick: number;
    eventChancePercent: number;
    lastTickAt: Date | null;
    updatedAt: Date;
  }): Promise<SerializedCalendar | null> {
    const plan = planAutoTick(calendar);
    if (!plan) return null;

    const claimed = await this.prisma.campaignCalendar.updateMany({
      where: {
        campaignId: calendar.campaignId,
        lastTickAt: calendar.lastTickAt,
      },
      data: {
        totalMinutes: { increment: plan.minutesToAdd },
        revision: { increment: 1 },
        lastTickAt: plan.nextTickAt,
      },
    });

    if (claimed.count === 0) return null;

    const updated = await this.prisma.campaignCalendar.findUnique({
      where: { campaignId: calendar.campaignId },
    });
    if (!updated) return null;

    const serialized = this.serializeRow(updated);
    this.worldGateway.emitClockUpdated(calendar.campaignId, serialized);
    return serialized;
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
        revision: 0,
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

    if (existing.totalMinutes === 0) {
      const backfilled = totalMinutesFromFields(
        existing.currentDay,
        existing.currentMonth,
        existing.currentYear,
        existing.currentHour,
        existing.currentMinute,
        daysPerMonth,
      );
      if (backfilled !== 0) {
        const updated = await this.persistCalendar(campaignId, {
          monthNames,
          daysPerMonth,
          weekdayNames,
          totalMinutes: backfilled,
          notes: existing.notes,
          realMinutesPerTick: existing.realMinutesPerTick,
          gameMinutesPerTick: existing.gameMinutesPerTick,
          eventChancePercent: existing.eventChancePercent,
        });
        return this.serializeRow(updated);
      }
    }

    return this.serializeRow(existing);
  }

  private serializeRow(row: CampaignCalendar): SerializedCalendar {
    return this.buildSerializedCalendar({
      monthNames: this.parseStringArray(row.monthNames, DEFAULT_MONTH_NAMES),
      daysPerMonth: this.parseNumberArray(
        row.daysPerMonth,
        DEFAULT_DAYS_PER_MONTH,
      ),
      weekdayNames: this.parseStringArray(
        row.weekdayNames,
        DEFAULT_WEEKDAY_NAMES,
      ),
      totalMinutes: row.totalMinutes,
      notes: row.notes,
      realMinutesPerTick: row.realMinutesPerTick,
      gameMinutesPerTick: row.gameMinutesPerTick,
      eventChancePercent: row.eventChancePercent,
      weather: asWeather(row.weather),
      revision: row.revision,
    });
  }

  /** Cria o calendário com os padrões quando a campanha ainda não tem um. */
  private async ensureCalendar(campaignId: string): Promise<CampaignCalendar> {
    const existing = await this.prisma.campaignCalendar.findUnique({
      where: { campaignId },
    });
    if (existing) return existing;

    try {
      return await this.persistCalendarData(
        campaignId,
        this.defaultCalendarData(),
      );
    } catch (error) {
      // Duas requisições criando o calendário ao mesmo tempo.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.campaignCalendar.findUnique({
          where: { campaignId },
        });
        if (raced) return raced;
      }
      throw error;
    }
  }

  private defaultCalendarData(): CalendarData {
    return this.calendarData({
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
    });
  }

  private calendarData(input: CalendarInput): CalendarData {
    const derived = deriveFieldsFromTotalMinutes(
      input.totalMinutes,
      input.daysPerMonth,
    );

    return {
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
  }

  /**
   * Grava o calendário. Com `expectedRevision`, só grava se a revisão ainda for
   * a que o cliente leu (senão 409); sem ela, mantém o comportamento antigo.
   */
  private async writeCalendar(
    campaignId: string,
    data: CalendarData,
    expectedRevision?: number,
  ): Promise<CampaignCalendar> {
    if (expectedRevision === undefined) {
      return this.persistCalendarData(campaignId, data);
    }

    const updated = await this.prisma.campaignCalendar.updateMany({
      where: { campaignId, revision: expectedRevision },
      data: { ...data, revision: { increment: 1 } },
    });

    if (updated.count === 0) {
      throw new ConflictException(
        'O calendário foi alterado por outra pessoa. Recarregue antes de salvar.',
      );
    }

    const row = await this.prisma.campaignCalendar.findUnique({
      where: { campaignId },
    });
    if (!row) throw new NotFoundException('Calendário não encontrado.');
    return row;
  }

  private async persistCalendarData(
    campaignId: string,
    data: CalendarData,
  ): Promise<CampaignCalendar> {
    return this.prisma.campaignCalendar.upsert({
      where: { campaignId },
      create: { campaignId, ...data },
      update: { ...data, revision: { increment: 1 } },
    });
  }

  private async persistCalendar(
    campaignId: string,
    input: CalendarInput,
  ): Promise<CampaignCalendar> {
    return this.persistCalendarData(campaignId, this.calendarData(input));
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
    revision: number;
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
      revision: input.revision,
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
