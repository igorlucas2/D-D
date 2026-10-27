export interface SerializedCalendar {
  monthNames: string[];
  daysPerMonth: number[];
  weekdayNames: string[];
  totalMinutes: number;
  currentDay: number;
  currentMonth: number;
  currentYear: number;
  currentHour: number;
  currentMinute: number;
  currentWeekdayIndex: number;
  notes: string | null;
  realMinutesPerTick: number;
  gameMinutesPerTick: number;
  eventChancePercent: number;
  weather: Weather;
  /** Concorrência otimista (P1-2): muda a cada gravação do calendário. */
  revision: number;
}

// Clima global da campanha (IM-08). Manter em sincronia com
// frontend/src/lib/weather.ts.
export const WEATHERS = [
  'clear',
  'cloudy',
  'rain',
  'storm',
  'fog',
  'snow',
  'wind',
] as const;

export type Weather = (typeof WEATHERS)[number];

export function asWeather(value: string | null | undefined): Weather {
  return (WEATHERS as readonly string[]).includes(value ?? '')
    ? (value as Weather)
    : 'clear';
}
