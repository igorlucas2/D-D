"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { DAY_PHASE_STYLES, getDayPhase, type DayPhase } from "@/lib/day-phase";
import { WEATHERS, WEATHER_ICONS, WEATHER_LABELS, type Weather } from "@/lib/weather";
import type { CampaignCalendar } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import { useWorldCalendar } from "@/stores/world-calendar-store";
import { Clock, Moon, Sun, Sunrise, Sunset, type LucideIcon } from "lucide-react";

const DAY_PHASE_ICONS: Record<DayPhase, LucideIcon> = {
  MADRUGADA: Moon,
  ALVORADA: Sunrise,
  DIA: Sun,
  CREPUSCULO: Sunset,
  NOITE: Moon,
};

const ADVANCE_OPTIONS: { label: string; minutes: number }[] = [
  { label: "+10 min", minutes: 10 },
  { label: "+30 min", minutes: 30 },
  { label: "+1 h", minutes: 60 },
  { label: "+8 h", minutes: 480 },
  { label: "+1 dia", minutes: 1440 },
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

interface WorldClockWidgetProps {
  campaignId: string;
  isMaster: boolean;
}

export function WorldClockWidget({ campaignId, isMaster }: WorldClockWidgetProps) {
  const token = useAuthStore((state) => state.token);
  const { calendar, error, setCalendar, setError } = useWorldCalendar(campaignId);
  const [advancing, setAdvancing] = useState<number | null>(null);
  const [changingWeather, setChangingWeather] = useState(false);

  async function handleWeather(weather: Weather) {
    if (!token) return;
    setChangingWeather(true);
    setError(null);
    try {
      setCalendar(await api.post<CampaignCalendar>(`/campaigns/${campaignId}/world/weather`, { weather }, token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível mudar o clima.");
    } finally {
      setChangingWeather(false);
    }
  }

  async function handleAdvance(minutes: number) {
    if (!token) return;
    setAdvancing(minutes);
    setError(null);
    try {
      const updated = await api.post<CampaignCalendar>(
        `/campaigns/${campaignId}/world/clock/advance`,
        { minutes },
        token,
      );
      setCalendar(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível avançar o tempo.");
    } finally {
      setAdvancing(null);
    }
  }

  if (!calendar) return null;

  const monthName = calendar.monthNames[calendar.currentMonth - 1] ?? `Mês ${calendar.currentMonth}`;
  const weekdayName = calendar.weekdayNames[calendar.currentWeekdayIndex] ?? "";
  const phase = getDayPhase(calendar.currentHour);
  const PhaseIcon = DAY_PHASE_ICONS[phase];
  const weather = calendar.weather ?? "clear";
  const WeatherIcon = WEATHER_ICONS[weather];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" /> Relógio do mundo
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {weekdayName ? <Badge variant="outline">{weekdayName}</Badge> : null}
          <Badge variant="outline">
            Dia {calendar.currentDay} de {monthName}, ano {calendar.currentYear}
          </Badge>
          <Badge variant="outline">
            {pad(calendar.currentHour)}:{pad(calendar.currentMinute)}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <PhaseIcon className="size-3.5" aria-hidden="true" /> {DAY_PHASE_STYLES[phase].label}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <WeatherIcon className="size-3.5" aria-hidden="true" /> {WEATHER_LABELS[weather]}
          </Badge>
        </div>
      </CardHeader>
      {isMaster ? (
        <CardContent className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Avançar tempo:</span>
          {ADVANCE_OPTIONS.map((option) => (
            <Button
              key={option.minutes}
              size="sm"
              variant="outline"
              disabled={advancing !== null}
              onClick={() => handleAdvance(option.minutes)}
            >
              {advancing === option.minutes ? "..." : option.label}
            </Button>
          ))}
          <label className="flex w-full flex-wrap items-center gap-2 text-sm text-muted-foreground">
            Clima da campanha:
            <select
              aria-label="Clima da campanha"
              value={weather}
              disabled={changingWeather}
              onChange={(event) => void handleWeather(event.target.value as Weather)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {WEATHERS.map((option) => (
                <option key={option} value={option}>
                  {WEATHER_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
