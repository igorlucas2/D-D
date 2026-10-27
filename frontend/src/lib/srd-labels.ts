// Traduções para valores em inglês que vêm da SRD 5e API (dnd5eapi.co).
// Conteúdo cadastrado manualmente já usa os termos em português abaixo,
// então os mapas funcionam como passagem direta (fallback) nesses casos.

export const SCHOOL_LABELS: Record<string, string> = {
  Abjuration: "Abjuração",
  Conjuration: "Conjuração",
  Divination: "Adivinhação",
  Enchantment: "Encantamento",
  Evocation: "Evocação",
  Illusion: "Ilusão",
  Necromancy: "Necromancia",
  Transmutation: "Transmutação",
};

export function translateSchool(school: string): string {
  return SCHOOL_LABELS[school] ?? school;
}

export const MONSTER_TYPE_LABELS: Record<string, string> = {
  aberration: "Aberração",
  beast: "Fera",
  celestial: "Celestial",
  construct: "Constructo",
  dragon: "Dragão",
  elemental: "Elemental",
  fey: "Feérico",
  fiend: "Demônio",
  giant: "Gigante",
  humanoid: "Humanoide",
  monstrosity: "Monstruosidade",
  ooze: "Limo",
  plant: "Planta",
  undead: "Morto-vivo",
  "swarm of Tiny beasts": "Enxame de feras minúsculas",
};

export function translateMonsterType(type: string): string {
  return MONSTER_TYPE_LABELS[type] ?? type;
}

export const MONSTER_SIZE_LABELS: Record<string, string> = {
  Tiny: "Minúsculo",
  Small: "Pequeno",
  Medium: "Médio",
  Large: "Grande",
  Huge: "Enorme",
  Gargantuan: "Gigantesco",
};

export function translateMonsterSize(size: string): string {
  return MONSTER_SIZE_LABELS[size] ?? size;
}

export const ITEM_CATEGORY_LABELS: Record<string, string> = {
  "Adventuring Gear": "Equipamento de Aventureiro",
  Ammunition: "Munição",
  Armor: "Armadura",
  "Mounts and Vehicles": "Montarias e Veículos",
  Potion: "Poção",
  Ring: "Anel",
  Rod: "Cetro",
  Scroll: "Pergaminho",
  Staff: "Bastão",
  Tools: "Ferramentas",
  Wand: "Varinha",
  Weapon: "Arma",
  "Wondrous Items": "Itens Maravilhosos",
};

export function translateItemCategory(category: string): string {
  return ITEM_CATEGORY_LABELS[category] ?? category;
}
