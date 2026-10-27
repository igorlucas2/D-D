import {
  Backpack,
  BookOpen,
  Drama,
  Eye,
  Flame,
  FlaskConical,
  Gem,
  Heart,
  Package,
  Shield,
  Skull,
  Sparkles,
  Sword,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { translateItemCategory, translateSchool } from "./srd-labels";

const ITEM_CATEGORY_ICONS: Record<string, LucideIcon> = {
  Arma: Sword,
  Armadura: Shield,
  Consumível: FlaskConical,
  Equipamento: Backpack,
  Tesouro: Gem,
  Munição: Backpack,
  Poção: FlaskConical,
  Anel: Gem,
  Cetro: Wand2,
  Pergaminho: BookOpen,
  Bastão: Wand2,
  Ferramentas: Backpack,
  Varinha: Wand2,
  "Itens Maravilhosos": Gem,
};

export function getItemIcon(category: string): LucideIcon {
  return ITEM_CATEGORY_ICONS[translateItemCategory(category)] ?? Package;
}

const RARITY_COLORS: Record<string, string> = {
  COMMON: "text-foreground",
  UNCOMMON: "text-green-400",
  RARE: "text-blue-400",
  VERY_RARE: "text-purple-400",
  LEGENDARY: "text-primary",
  ARTIFACT: "text-destructive",
};

export function getRarityColor(rarity: string): string {
  return RARITY_COLORS[rarity] ?? "text-foreground";
}

const RARITY_BORDER_COLORS: Record<string, string> = {
  COMMON: "border-l-border",
  UNCOMMON: "border-l-green-400",
  RARE: "border-l-blue-400",
  VERY_RARE: "border-l-purple-400",
  LEGENDARY: "border-l-primary",
  ARTIFACT: "border-l-destructive",
};

export function getRarityBorderColor(rarity: string): string {
  return RARITY_BORDER_COLORS[rarity] ?? "border-l-border";
}

const SCHOOL_ICONS: Record<string, LucideIcon> = {
  Abjuração: Shield,
  Adivinhação: Eye,
  Conjuração: Sparkles,
  Encantamento: Heart,
  Evocação: Flame,
  Ilusão: Drama,
  Necromancia: Skull,
  Transmutação: Wand2,
};

export function getSpellIcon(school: string): LucideIcon {
  return SCHOOL_ICONS[translateSchool(school)] ?? BookOpen;
}
