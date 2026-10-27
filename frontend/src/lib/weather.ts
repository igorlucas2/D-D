import { Cloud, CloudFog, CloudLightning, CloudRain, Snowflake, Sun, Wind, type LucideIcon } from "lucide-react";

// Clima global da campanha (IM-08). Manter em sincronia com WEATHERS em
// backend/src/world/world.types.ts.
export const WEATHERS = ["clear", "cloudy", "rain", "storm", "fog", "snow", "wind"] as const;

export type Weather = (typeof WEATHERS)[number];

export const WEATHER_LABELS: Record<Weather, string> = {
  clear: "Céu limpo",
  cloudy: "Nublado",
  rain: "Chuva",
  storm: "Tempestade",
  fog: "Neblina",
  snow: "Neve",
  wind: "Ventania",
};

export const WEATHER_ICONS: Record<Weather, LucideIcon> = {
  clear: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  storm: CloudLightning,
  fog: CloudFog,
  snow: Snowflake,
  wind: Wind,
};

export type WeatherParticles = "full" | "reduced" | "off";

export const WEATHER_PARTICLE_LABELS: Record<WeatherParticles, string> = {
  full: "completas",
  reduced: "reduzidas",
  off: "desligadas",
};
