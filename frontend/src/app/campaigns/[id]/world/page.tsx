"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import { WEATHERS, WEATHER_LABELS, type Weather } from "@/lib/weather";
import {
  JOURNAL_CATEGORIES,
  JOURNAL_CATEGORY_LABELS,
  WORLD_ENTRY_TYPES,
  WORLD_ENTRY_TYPE_LABELS,
  type Campaign,
  type CampaignCalendar,
  type JournalCategory,
  type WorldEntry,
  type WorldEntryType,
  type WorldEvent,
} from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import { ArrowLeft, CalendarDays, Dices, Globe, Pencil, Plus, Trash2 } from "lucide-react";

const textareaClassName =
  "min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

interface EntryFormState {
  type: WorldEntryType;
  name: string;
  summary: string;
  description: string;
  parentId: string;
}

const EMPTY_ENTRY_FORM: EntryFormState = {
  type: "OUTRO",
  name: "",
  summary: "",
  description: "",
  parentId: "",
};

interface CalendarFormState {
  monthNames: string;
  daysPerMonth: string;
  weekdayNames: string;
  currentDay: string;
  currentMonth: string;
  currentYear: string;
  currentHour: string;
  currentMinute: string;
  notes: string;
  realMinutesPerTick: string;
  gameMinutesPerTick: string;
  eventChancePercent: string;
}

function calendarToForm(calendar: CampaignCalendar): CalendarFormState {
  return {
    monthNames: calendar.monthNames.join(", "),
    daysPerMonth: calendar.daysPerMonth.join(", "),
    weekdayNames: calendar.weekdayNames.join(", "),
    currentDay: String(calendar.currentDay),
    currentMonth: String(calendar.currentMonth),
    currentYear: String(calendar.currentYear),
    currentHour: String(calendar.currentHour),
    currentMinute: String(calendar.currentMinute),
    notes: calendar.notes ?? "",
    realMinutesPerTick: String(calendar.realMinutesPerTick),
    gameMinutesPerTick: String(calendar.gameMinutesPerTick),
    eventChancePercent: String(calendar.eventChancePercent),
  };
}

interface EventFormState {
  title: string;
  content: string;
  category: JournalCategory;
  weight: string;
  isActive: boolean;
  weatherEffect: Weather | "";
}

const EMPTY_EVENT_FORM: EventFormState = {
  title: "",
  content: "",
  category: "EVENTO",
  weight: "1",
  isActive: true,
  weatherEffect: "",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function WorldContent() {
  const params = useParams<{ id: string }>();
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [entries, setEntries] = useState<WorldEntry[]>([]);
  const [calendar, setCalendar] = useState<CampaignCalendar | null>(null);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorldEntry | null>(null);
  const [entryForm, setEntryForm] = useState<EntryFormState>(EMPTY_ENTRY_FORM);
  const [savingEntry, setSavingEntry] = useState(false);
  const [entryFormError, setEntryFormError] = useState<string | null>(null);

  const [calendarFormOpen, setCalendarFormOpen] = useState(false);
  const [calendarForm, setCalendarForm] = useState<CalendarFormState | null>(null);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [calendarFormError, setCalendarFormError] = useState<string | null>(null);

  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<WorldEvent | null>(null);
  const [eventForm, setEventForm] = useState<EventFormState>(EMPTY_EVENT_FORM);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventFormError, setEventFormError] = useState<string | null>(null);

  async function refresh() {
    if (!token || !campaign) return;
    const isMasterUser = campaign.masterId === userId;
    const [entriesData, calendarData, eventsData] = await Promise.all([
      api.get<WorldEntry[]>(`/campaigns/${params.id}/world/entries`, token),
      api.get<CampaignCalendar>(`/campaigns/${params.id}/world/calendar`, token),
      isMasterUser
        ? api.get<WorldEvent[]>(`/campaigns/${params.id}/world/events`, token)
        : Promise.resolve(events),
    ]);
    setEntries(entriesData);
    setCalendar(calendarData);
    setEvents(eventsData);
  }

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadWorld() {
      try {
        const campaignData = await api.get<Campaign>(`/campaigns/${params.id}`, token);
        const isMasterUser = campaignData.masterId === userId;
        const [entriesData, calendarData, eventsData] = await Promise.all([
          api.get<WorldEntry[]>(`/campaigns/${params.id}/world/entries`, token),
          api.get<CampaignCalendar>(`/campaigns/${params.id}/world/calendar`, token),
          isMasterUser
            ? api.get<WorldEvent[]>(`/campaigns/${params.id}/world/events`, token)
            : Promise.resolve<WorldEvent[]>([]),
        ]);
        if (cancelled) return;
        setCampaign(campaignData);
        setEntries(entriesData);
        setCalendar(calendarData);
        setEvents(eventsData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Erro ao carregar o mundo da campanha.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadWorld();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, params.id]);

  function openCreateEntryDialog() {
    setEditingEntry(null);
    setEntryForm(EMPTY_ENTRY_FORM);
    setEntryFormError(null);
    setEntryFormOpen(true);
  }

  function openEditEntryDialog(entry: WorldEntry) {
    setEditingEntry(entry);
    setEntryForm({
      type: entry.type,
      name: entry.name,
      summary: entry.summary ?? "",
      description: entry.description ?? "",
      parentId: entry.parentId ?? "",
    });
    setEntryFormError(null);
    setEntryFormOpen(true);
  }

  async function handleSaveEntry() {
    if (!token) return;
    setSavingEntry(true);
    setEntryFormError(null);
    try {
      const body = {
        type: entryForm.type,
        name: entryForm.name,
        summary: entryForm.summary || undefined,
        description: entryForm.description || undefined,
        parentId: entryForm.parentId || null,
      };
      if (editingEntry) {
        await api.patch(`/campaigns/${params.id}/world/entries/${editingEntry.id}`, body, token);
      } else {
        await api.post(`/campaigns/${params.id}/world/entries`, body, token);
      }
      setEntryFormOpen(false);
      await refresh();
    } catch (err) {
      setEntryFormError(err instanceof ApiError ? err.message : "Não foi possível salvar a entrada.");
    } finally {
      setSavingEntry(false);
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!token) return;
    await api.delete(`/campaigns/${params.id}/world/entries/${entryId}`, token);
    await refresh();
  }

  function openCalendarDialog() {
    if (!calendar) return;
    setCalendarForm(calendarToForm(calendar));
    setCalendarFormError(null);
    setCalendarFormOpen(true);
  }

  async function handleSaveCalendar() {
    if (!token || !calendarForm) return;
    setSavingCalendar(true);
    setCalendarFormError(null);
    try {
      const monthNames = calendarForm.monthNames
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const daysPerMonth = calendarForm.daysPerMonth
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => !Number.isNaN(value));
      const weekdayNames = calendarForm.weekdayNames
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      const body = {
        monthNames,
        daysPerMonth,
        weekdayNames,
        currentDay: Number(calendarForm.currentDay),
        currentMonth: Number(calendarForm.currentMonth),
        currentYear: Number(calendarForm.currentYear),
        currentHour: Number(calendarForm.currentHour),
        currentMinute: Number(calendarForm.currentMinute),
        notes: calendarForm.notes || undefined,
        realMinutesPerTick: Math.max(0, Number(calendarForm.realMinutesPerTick) || 0),
        gameMinutesPerTick: Math.max(1, Number(calendarForm.gameMinutesPerTick) || 1),
        eventChancePercent: Math.max(0, Math.min(100, Number(calendarForm.eventChancePercent) || 0)),
      };

      const updated = await api.put<CampaignCalendar>(`/campaigns/${params.id}/world/calendar`, body, token);
      setCalendar(updated);
      setCalendarFormOpen(false);
    } catch (err) {
      setCalendarFormError(err instanceof ApiError ? err.message : "Não foi possível salvar o calendário.");
    } finally {
      setSavingCalendar(false);
    }
  }

  function openCreateEventDialog() {
    setEditingEvent(null);
    setEventForm(EMPTY_EVENT_FORM);
    setEventFormError(null);
    setEventFormOpen(true);
  }

  function openEditEventDialog(event: WorldEvent) {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      content: event.content,
      category: event.category,
      weight: String(event.weight),
      isActive: event.isActive,
      weatherEffect: event.weatherEffect ?? "",
    });
    setEventFormError(null);
    setEventFormOpen(true);
  }

  async function handleSaveEvent() {
    if (!token) return;
    setSavingEvent(true);
    setEventFormError(null);
    try {
      const body = {
        title: eventForm.title,
        content: eventForm.content,
        category: eventForm.category,
        weight: Math.max(1, Math.min(100, Number(eventForm.weight) || 1)),
        isActive: eventForm.isActive,
        weatherEffect: eventForm.weatherEffect || null,
      };
      if (editingEvent) {
        await api.patch(`/campaigns/${params.id}/world/events/${editingEvent.id}`, body, token);
      } else {
        await api.post(`/campaigns/${params.id}/world/events`, body, token);
      }
      setEventFormOpen(false);
      await refresh();
    } catch (err) {
      setEventFormError(err instanceof ApiError ? err.message : "Não foi possível salvar o evento.");
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!token) return;
    await api.delete(`/campaigns/${params.id}/world/events/${eventId}`, token);
    await refresh();
  }

  async function handleToggleEventActive(event: WorldEvent) {
    if (!token) return;
    await api.patch(`/campaigns/${params.id}/world/events/${event.id}`, { isActive: !event.isActive }, token);
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-destructive">
        {error ?? "Campanha não encontrada."}
      </div>
    );
  }

  const isMaster = campaign.masterId === userId;

  const entriesByType = WORLD_ENTRY_TYPES.map((type) => ({
    type,
    items: entries.filter((entry) => entry.type === type),
  })).filter((group) => group.items.length > 0);

  const monthName = calendar?.monthNames[calendar.currentMonth - 1] ?? `Mês ${calendar?.currentMonth}`;
  const weekdayName = calendar?.weekdayNames[calendar.currentWeekdayIndex] ?? "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <Link
          href={`/campaigns/${campaign.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para {campaign.name}
        </Link>
        <div className="mt-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Globe className="h-6 w-6" /> Mundo da Campanha
          </h1>
          <p className="text-muted-foreground">{campaign.name}</p>
        </div>
      </div>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">Lugares e Facções</TabsTrigger>
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
          {isMaster ? <TabsTrigger value="events">Eventos</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="entries" className="mt-4 flex flex-col gap-4">
          {isMaster ? (
            <div className="flex justify-end">
              <Dialog open={entryFormOpen} onOpenChange={setEntryFormOpen}>
                <DialogTrigger render={<Button onClick={openCreateEntryDialog} />}>
                  <Plus className="h-4 w-4" /> Nova entrada
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingEntry ? "Editar entrada" : "Nova entrada"}</DialogTitle>
                    <DialogDescription>
                      Registre continentes, reinos, facções, religiões, idiomas e outros elementos do mundo.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="entryType">Tipo</Label>
                      <select
                        id="entryType"
                        value={entryForm.type}
                        onChange={(event) =>
                          setEntryForm((prev) => ({ ...prev, type: event.target.value as WorldEntryType }))
                        }
                        className={selectClassName}
                      >
                        {WORLD_ENTRY_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {WORLD_ENTRY_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="entryParent">Categoria pai</Label>
                      <select
                        id="entryParent"
                        value={entryForm.parentId}
                        onChange={(event) =>
                          setEntryForm((prev) => ({ ...prev, parentId: event.target.value }))
                        }
                        className={selectClassName}
                      >
                        <option value="">Nenhuma</option>
                        {entries
                          .filter((entry) => !editingEntry || entry.id !== editingEntry.id)
                          .map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {WORLD_ENTRY_TYPE_LABELS[entry.type]}: {entry.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="entryName">Nome</Label>
                    <Input
                      id="entryName"
                      value={entryForm.name}
                      onChange={(event) => setEntryForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="entrySummary">Resumo</Label>
                    <Input
                      id="entrySummary"
                      value={entryForm.summary}
                      onChange={(event) => setEntryForm((prev) => ({ ...prev, summary: event.target.value }))}
                      placeholder="Uma frase curta sobre esta entrada"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="entryDescription">Descrição</Label>
                    <textarea
                      id="entryDescription"
                      className={textareaClassName}
                      value={entryForm.description}
                      onChange={(event) =>
                        setEntryForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="História, geografia, cultura, costumes..."
                    />
                  </div>
                  {entryFormError ? <p className="text-sm text-destructive">{entryFormError}</p> : null}
                  <DialogFooter>
                    <Button onClick={handleSaveEntry} disabled={savingEntry || !entryForm.name.trim()}>
                      {savingEntry ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : null}

          {entriesByType.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground">Nenhuma entrada do mundo registrada ainda.</p>
              </CardContent>
            </Card>
          ) : (
            entriesByType.map((group) => (
              <div key={group.type} className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {WORLD_ENTRY_TYPE_LABELS[group.type]}
                </h2>
                <div className="flex flex-col gap-3">
                  {group.items.map((entry) => {
                    const parent = entries.find((candidate) => candidate.id === entry.parentId);
                    return (
                      <Card key={entry.id}>
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                          <div>
                            <CardTitle>{entry.name}</CardTitle>
                            <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
                              {entry.summary ? <span>{entry.summary}</span> : null}
                              {parent ? (
                                <Badge variant="outline">
                                  {WORLD_ENTRY_TYPE_LABELS[parent.type]}: {parent.name}
                                </Badge>
                              ) : null}
                            </CardDescription>
                          </div>
                          {isMaster ? (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => openEditEntryDialog(entry)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => handleDeleteEntry(entry.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null}
                        </CardHeader>
                        {entry.description ? (
                          <CardContent>
                            <p className="whitespace-pre-wrap text-sm text-foreground">{entry.description}</p>
                          </CardContent>
                        ) : null}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" /> Data atual
                </CardTitle>
                <CardDescription>
                  {calendar
                    ? `${weekdayName ? `${weekdayName}, ` : ""}dia ${calendar.currentDay} de ${monthName}, ano ${calendar.currentYear} — ${pad(calendar.currentHour)}:${pad(calendar.currentMinute)}`
                    : "—"}
                </CardDescription>
              </div>
              {isMaster ? (
                <Dialog open={calendarFormOpen} onOpenChange={setCalendarFormOpen}>
                  <DialogTrigger render={<Button variant="outline" onClick={openCalendarDialog} />}>
                    <Pencil className="h-4 w-4" /> Editar calendário
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Editar calendário</DialogTitle>
                      <DialogDescription>
                        Defina os meses, a duração de cada um, os dias da semana e a data atual da campanha.
                      </DialogDescription>
                    </DialogHeader>
                    {calendarForm ? (
                      <>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="calMonthNames">Nomes dos meses (separados por vírgula)</Label>
                          <textarea
                            id="calMonthNames"
                            className={textareaClassName}
                            value={calendarForm.monthNames}
                            onChange={(event) =>
                              setCalendarForm((prev) => prev && { ...prev, monthNames: event.target.value })
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="calDaysPerMonth">Dias por mês (separados por vírgula)</Label>
                          <Input
                            id="calDaysPerMonth"
                            value={calendarForm.daysPerMonth}
                            onChange={(event) =>
                              setCalendarForm((prev) => prev && { ...prev, daysPerMonth: event.target.value })
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="calWeekdayNames">Dias da semana (separados por vírgula)</Label>
                          <Input
                            id="calWeekdayNames"
                            value={calendarForm.weekdayNames}
                            onChange={(event) =>
                              setCalendarForm((prev) => prev && { ...prev, weekdayNames: event.target.value })
                            }
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="calCurrentDay">Dia atual</Label>
                            <Input
                              id="calCurrentDay"
                              type="number"
                              min={1}
                              value={calendarForm.currentDay}
                              onChange={(event) =>
                                setCalendarForm((prev) => prev && { ...prev, currentDay: event.target.value })
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="calCurrentMonth">Mês atual</Label>
                            <Input
                              id="calCurrentMonth"
                              type="number"
                              min={1}
                              value={calendarForm.currentMonth}
                              onChange={(event) =>
                                setCalendarForm((prev) => prev && { ...prev, currentMonth: event.target.value })
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="calCurrentYear">Ano atual</Label>
                            <Input
                              id="calCurrentYear"
                              type="number"
                              value={calendarForm.currentYear}
                              onChange={(event) =>
                                setCalendarForm((prev) => prev && { ...prev, currentYear: event.target.value })
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="calCurrentHour">Hora atual</Label>
                            <Input
                              id="calCurrentHour"
                              type="number"
                              min={0}
                              max={23}
                              value={calendarForm.currentHour}
                              onChange={(event) =>
                                setCalendarForm((prev) => prev && { ...prev, currentHour: event.target.value })
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="calCurrentMinute">Minuto atual</Label>
                            <Input
                              id="calCurrentMinute"
                              type="number"
                              min={0}
                              max={59}
                              value={calendarForm.currentMinute}
                              onChange={(event) =>
                                setCalendarForm((prev) => prev && { ...prev, currentMinute: event.target.value })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="calNotes">Notas</Label>
                          <textarea
                            id="calNotes"
                            className={textareaClassName}
                            value={calendarForm.notes}
                            onChange={(event) =>
                              setCalendarForm((prev) => prev && { ...prev, notes: event.target.value })
                            }
                            placeholder="Eventos sazonais, festivais, fenômenos recorrentes..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="calRealMinutesPerTick">Avanço automático (minutos reais)</Label>
                            <Input
                              id="calRealMinutesPerTick"
                              type="number"
                              min={0}
                              value={calendarForm.realMinutesPerTick}
                              onChange={(event) =>
                                setCalendarForm(
                                  (prev) => prev && { ...prev, realMinutesPerTick: event.target.value },
                                )
                              }
                              placeholder="0 = desligado"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="calGameMinutesPerTick">Tempo de jogo por avanço (minutos)</Label>
                            <Input
                              id="calGameMinutesPerTick"
                              type="number"
                              min={1}
                              value={calendarForm.gameMinutesPerTick}
                              onChange={(event) =>
                                setCalendarForm(
                                  (prev) => prev && { ...prev, gameMinutesPerTick: event.target.value },
                                )
                              }
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="calEventChancePercent">Chance de evento aleatório por avanço (%)</Label>
                          <Input
                            id="calEventChancePercent"
                            type="number"
                            min={0}
                            max={100}
                            value={calendarForm.eventChancePercent}
                            onChange={(event) =>
                              setCalendarForm(
                                (prev) => prev && { ...prev, eventChancePercent: event.target.value },
                              )
                            }
                            placeholder="0 = desligado"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Ex.: 60 minutos reais = 240 minutos de jogo faz o relógio do mundo avançar 4h a
                          cada 1h real, mesmo sem jogadores conectados. Defina 0 para desligar o avanço
                          automático. A cada avanço automático, há a chance configurada de sortear um
                          evento da tabela e registrá-lo no diário da campanha.
                        </p>
                      </>
                    ) : null}
                    {calendarFormError ? <p className="text-sm text-destructive">{calendarFormError}</p> : null}
                    <DialogFooter>
                      <Button onClick={handleSaveCalendar} disabled={savingCalendar}>
                        {savingCalendar ? "Salvando..." : "Salvar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : null}
            </CardHeader>
            {calendar ? (
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{calendar.monthNames.length} meses</Badge>
                  <Badge variant="outline">{calendar.weekdayNames.length} dias por semana</Badge>
                  {calendar.realMinutesPerTick > 0 ? (
                    <Badge variant="outline">
                      Avanço automático: {calendar.realMinutesPerTick}min reais ={" "}
                      {calendar.gameMinutesPerTick}min de jogo
                    </Badge>
                  ) : null}
                  {calendar.eventChancePercent > 0 ? (
                    <Badge variant="outline">
                      Chance de evento: {calendar.eventChancePercent}%
                    </Badge>
                  ) : null}
                </div>
                {calendar.notes ? (
                  <CardFooter className="flex-col items-start gap-1 px-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notas</p>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{calendar.notes}</p>
                  </CardFooter>
                ) : null}
              </CardContent>
            ) : null}
          </Card>
        </TabsContent>

        {isMaster ? (
          <TabsContent value="events" className="mt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Eventos ativos entram no sorteio realizado a cada avanço automático do relógio, conforme a
                chance configurada no calendário. O resultado é registrado no diário da campanha.
              </p>
              <Dialog open={eventFormOpen} onOpenChange={setEventFormOpen}>
                <DialogTrigger render={<Button onClick={openCreateEventDialog} />}>
                  <Plus className="h-4 w-4" /> Novo evento
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingEvent ? "Editar evento" : "Novo evento"}</DialogTitle>
                    <DialogDescription>
                      Defina o título, o texto e a categoria do evento que será registrado no diário quando
                      sorteado, e o peso relativo dele no sorteio.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="eventTitle">Título</Label>
                    <Input
                      id="eventTitle"
                      value={eventForm.title}
                      onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="eventContent">Conteúdo</Label>
                    <textarea
                      id="eventContent"
                      className={textareaClassName}
                      value={eventForm.content}
                      onChange={(event) => setEventForm((prev) => ({ ...prev, content: event.target.value }))}
                      placeholder="Descreva o que acontece quando este evento é sorteado..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="eventCategory">Categoria</Label>
                      <select
                        id="eventCategory"
                        value={eventForm.category}
                        onChange={(event) =>
                          setEventForm((prev) => ({ ...prev, category: event.target.value as JournalCategory }))
                        }
                        className={selectClassName}
                      >
                        {JOURNAL_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {JOURNAL_CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="eventWeight">Peso (1-100)</Label>
                      <Input
                        id="eventWeight"
                        type="number"
                        min={1}
                        max={100}
                        value={eventForm.weight}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, weight: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="eventWeather">Muda o clima para</Label>
                    <select
                      id="eventWeather"
                      value={eventForm.weatherEffect}
                      onChange={(event) =>
                        setEventForm((prev) => ({ ...prev, weatherEffect: event.target.value as Weather | "" }))
                      }
                      className={selectClassName}
                    >
                      <option value="">Não altera o clima</option>
                      {WEATHERS.map((weather) => (
                        <option key={weather} value={weather}>
                          {WEATHER_LABELS[weather]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={eventForm.isActive}
                      onChange={(event) => setEventForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                    />
                    Ativo (participa do sorteio)
                  </label>
                  {eventFormError ? <p className="text-sm text-destructive">{eventFormError}</p> : null}
                  <DialogFooter>
                    <Button
                      onClick={handleSaveEvent}
                      disabled={savingEvent || !eventForm.title.trim() || !eventForm.content.trim()}
                    >
                      {savingEvent ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {events.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-muted-foreground">Nenhum evento cadastrado ainda.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {events.map((eventItem) => (
                  <Card key={eventItem.id}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Dices className="h-4 w-4" /> {eventItem.title}
                        </CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
                          <Badge variant="outline">{JOURNAL_CATEGORY_LABELS[eventItem.category]}</Badge>
                          <Badge variant="outline">Peso {eventItem.weight}</Badge>
                          <Badge variant={eventItem.isActive ? "default" : "secondary"}>
                            {eventItem.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleToggleEventActive(eventItem)}>
                          {eventItem.isActive ? "Desativar" : "Ativar"}
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditEventDialog(eventItem)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          onClick={() => handleDeleteEvent(eventItem.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{eventItem.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

export default function WorldPage() {
  return (
    <RequireAuth>
      <WorldContent />
    </RequireAuth>
  );
}
