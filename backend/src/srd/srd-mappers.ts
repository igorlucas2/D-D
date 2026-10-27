import { EquipmentSlot, ItemRarity } from '@prisma/client';

const SOURCE = 'dnd5eapi-2014';

type DataRecord = Record<string, unknown>;

interface CatalogFeature {
  name: string;
  description: string;
}

export function asRecord(value: unknown): DataRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as DataRecord)
    : null;
}

export function stringField(record: DataRecord, key: string, fallback = '') {
  const value = record[key];
  return typeof value === 'string' ? value : fallback;
}

export function numberField(record: DataRecord, key: string, fallback = 0) {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function booleanField(
  record: DataRecord,
  key: string,
  fallback = false,
) {
  const value = record[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function stringArrayField(record: DataRecord, key: string) {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function recordArrayField(record: DataRecord, key: string) {
  const value = record[key];
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is DataRecord => Boolean(item))
    : [];
}

export function referenceName(value: unknown, fallback = '') {
  const record = asRecord(value);
  return record ? stringField(record, 'name', fallback) : fallback;
}

export function referenceIndex(value: unknown, fallback = '') {
  const record = asRecord(value);
  return record ? stringField(record, 'index', fallback) : fallback;
}

export function sourceUrl(record: DataRecord) {
  const url = stringField(record, 'url');
  return url ? `https://www.dnd5eapi.co${url}` : null;
}

export function imageUrl(record: DataRecord) {
  const image = stringField(record, 'image');
  return image ? `https://www.dnd5eapi.co${image}` : null;
}

// Blocos de NPC genéricos do SRD (Apêndice de Personagens Não-Jogadores).
const NPC_NAMES = new Set([
  'acolyte',
  'bandit',
  'bandit captain',
  'berserker',
  'commoner',
  'cult fanatic',
  'cultist',
  'druid',
  'gladiator',
  'guard',
  'knight',
  'mage',
  'noble',
  'priest',
  'scout',
  'spy',
  'thug',
  'tribal warrior',
  'veteran',
]);

export function isNpcName(name: string) {
  return NPC_NAMES.has(name.trim().toLowerCase());
}

// Traduções de valores categóricos da SRD (em inglês) para português,
// alinhadas com os termos já usados no conteúdo cadastrado manualmente.
const MONSTER_TYPE_PT: Record<string, string> = {
  aberration: 'Aberração',
  beast: 'Fera',
  celestial: 'Celestial',
  construct: 'Constructo',
  dragon: 'Dragão',
  elemental: 'Elemental',
  fey: 'Feérico',
  fiend: 'Demônio',
  giant: 'Gigante',
  humanoid: 'Humanoide',
  monstrosity: 'Monstruosidade',
  ooze: 'Limo',
  plant: 'Planta',
  undead: 'Morto-vivo',
  'swarm of tiny beasts': 'Enxame de feras minúsculas',
};

const MONSTER_SIZE_PT: Record<string, string> = {
  Tiny: 'Minúsculo',
  Small: 'Pequeno',
  Medium: 'Médio',
  Large: 'Grande',
  Huge: 'Enorme',
  Gargantuan: 'Gigantesco',
};

const SCHOOL_PT: Record<string, string> = {
  Abjuration: 'Abjuração',
  Conjuration: 'Conjuração',
  Divination: 'Adivinhação',
  Enchantment: 'Encantamento',
  Evocation: 'Evocação',
  Illusion: 'Ilusão',
  Necromancy: 'Necromancia',
  Transmutation: 'Transmutação',
};

const ITEM_CATEGORY_PT: Record<string, string> = {
  'Adventuring Gear': 'Equipamento de Aventureiro',
  Ammunition: 'Munição',
  Armor: 'Armadura',
  'Magic Item': 'Item Mágico',
  'Mounts and Vehicles': 'Montarias e Veículos',
  Potion: 'Poção',
  Ring: 'Anel',
  Rod: 'Cetro',
  Scroll: 'Pergaminho',
  Staff: 'Bastão',
  Tools: 'Ferramentas',
  Wand: 'Varinha',
  Weapon: 'Arma',
  Equipment: 'Equipamento',
  'Wondrous Items': 'Itens Maravilhosos',
};

const ALIGNMENT_PT: Record<string, string> = {
  'lawful good': 'leal e bom',
  'neutral good': 'neutro e bom',
  'chaotic good': 'caótico e bom',
  'lawful neutral': 'leal e neutro',
  'true neutral': 'neutro',
  neutral: 'neutro',
  'chaotic neutral': 'caótico e neutro',
  'lawful evil': 'leal e mau',
  'neutral evil': 'neutro e mau',
  'chaotic evil': 'caótico e mau',
  unaligned: 'sem alinhamento',
  'any alignment': 'qualquer alinhamento',
  'any chaotic alignment': 'qualquer alinhamento caótico',
  'any evil alignment': 'qualquer alinhamento mau',
  'any non-good alignment': 'qualquer alinhamento não-bom',
  'any non-lawful alignment': 'qualquer alinhamento não-leal',
};

const LANGUAGE_PT: Record<string, string> = {
  Common: 'Comum',
  Dwarvish: 'Anão',
  Elvish: 'Élfico',
  Giant: 'Gigante',
  Gnomish: 'Gnômico',
  Goblin: 'Goblin',
  Halfling: 'Halfling',
  Orc: 'Orc',
  Abyssal: 'Abissal',
  Celestial: 'Celestial',
  Draconic: 'Dracônico',
  'Deep Speech': 'Discurso Profundo',
  Infernal: 'Infernal',
  Primordial: 'Primordial',
  Sylvan: 'Silvestre',
  Undercommon: 'Subcomum',
  Aquan: 'Aquano',
  Auran: 'Aurano',
  Ignan: 'Ígneo',
  Terran: 'Terrano',
  Druidic: 'Druídico',
  Gnoll: 'Gnoll',
  Sphinx: 'Esfinge',
  Otyugh: 'Otyugh',
  Sahuagin: 'Sahuagin',
  'Blink Dog': 'Cão Piscante',
  'Giant Eagle': 'Águia Gigante',
  'Giant Elk': 'Alce Gigante',
  'Giant Owl': 'Coruja Gigante',
  'Winter Wolf': 'Lobo do Inverno',
  Worg: 'Worg',
  "Thieves' cant": 'Cant dos Ladrões',
  Telepathy: 'Telepatia',
  all: 'todos os idiomas',
  '--': '--',
};

const LANGUAGE_NUMBER_PT: Record<string, string> = {
  one: 'um',
  two: 'dois',
  three: 'três',
  four: 'quatro',
  five: 'cinco',
  six: 'seis',
};

const CLASS_NAME_PT: Record<string, string> = {
  Barbarian: 'Barbaro',
  Bard: 'Bardo',
  Cleric: 'Clerigo',
  Druid: 'Druida',
  Fighter: 'Guerreiro',
  Monk: 'Monge',
  Paladin: 'Paladino',
  Ranger: 'Patrulheiro',
  Rogue: 'Ladino',
  Sorcerer: 'Feiticeiro',
  Warlock: 'Bruxo',
  Wizard: 'Mago',
};

const DAMAGE_TYPE_PT: Record<string, string> = {
  Bludgeoning: 'Concussão',
  Piercing: 'Perfuração',
  Slashing: 'Corte',
};

const WEAPON_PROPERTY_PT: Record<string, string> = {
  Ammunition: 'Munição',
  Finesse: 'Acuidade',
  Heavy: 'Pesada',
  Light: 'Leve',
  Loading: 'Recarga',
  Monk: 'Monge',
  Reach: 'Alcance',
  Special: 'Especial',
  Thrown: 'Arremessável',
  'Two-Handed': 'Duas Mãos',
  Versatile: 'Versátil',
};

const SPELL_RANGE_PT: Record<string, string> = {
  Self: 'Pessoal',
  Touch: 'Toque',
  Sight: 'Visão',
  Special: 'Especial',
  Unlimited: 'Ilimitado',
};

const SPELL_DURATION_PT: Record<string, string> = {
  Instantaneous: 'Instantânea',
  Special: 'Especial',
  'Until dispelled': 'Até ser dissipada',
};

const TIME_UNIT_PT: Record<string, string> = {
  round: 'rodada',
  rounds: 'rodadas',
  minute: 'minuto',
  minutes: 'minutos',
  hour: 'hora',
  hours: 'horas',
  day: 'dia',
  days: 'dias',
};

export function translateMonsterType(type: string): string {
  return MONSTER_TYPE_PT[type.toLowerCase()] ?? type;
}

export function translateMonsterSize(size: string): string {
  return MONSTER_SIZE_PT[size] ?? size;
}

export function translateSchool(school: string): string {
  return SCHOOL_PT[school] ?? school;
}

export function translateItemCategory(category: string): string {
  return ITEM_CATEGORY_PT[category] ?? category;
}

export function translateClassName(name: string): string {
  return CLASS_NAME_PT[name] ?? name;
}

export function translateDamageType(value: string): string {
  return DAMAGE_TYPE_PT[value] ?? value;
}

export function translateWeaponProperty(value: string): string {
  return WEAPON_PROPERTY_PT[value] ?? value;
}

// Traduz o campo "range" da SRD ("Self", "Touch", "120 feet", "1 mile"...).
export function translateRange(value: string): string {
  const trimmed = value.trim();
  if (SPELL_RANGE_PT[trimmed]) return SPELL_RANGE_PT[trimmed];

  const feetMatch = trimmed.match(/^(\d+)\s*feet$/i);
  if (feetMatch) return `${ftToMeters(feetMatch[1])} metros`;

  const mileMatch = trimmed.match(/^(\d+)\s*miles?$/i);
  if (mileMatch) {
    const km = Math.round(Number(mileMatch[1]) * 1.60934 * 10) / 10;
    return `${km} km`;
  }

  return trimmed;
}

// Traduz o campo "duration" da SRD ("Instantaneous", "1 round", "Up to 1 minute"...).
export function translateDuration(value: string): string {
  const trimmed = value.trim();
  if (SPELL_DURATION_PT[trimmed]) return SPELL_DURATION_PT[trimmed];

  const upToMatch = trimmed.match(
    /^Up to (\d+) (round|rounds|minute|minutes|hour|hours|day|days)$/i,
  );
  if (upToMatch) {
    const [, amount, unit] = upToMatch;
    return `Até ${amount} ${TIME_UNIT_PT[unit.toLowerCase()]}`;
  }

  const plainMatch = trimmed.match(
    /^(\d+) (round|rounds|minute|minutes|hour|hours|day|days)$/i,
  );
  if (plainMatch) {
    const [, amount, unit] = plainMatch;
    return `${amount} ${TIME_UNIT_PT[unit.toLowerCase()]}`;
  }

  return trimmed;
}

function translateAlignment(value: string): string {
  const percentMatch = value.match(/^(.+?) \((\d+)%\) or (.+?) \((\d+)%\)$/i);
  if (percentMatch) {
    const [, first, firstPct, second, secondPct] = percentMatch;
    return `${translateAlignment(first)} (${firstPct}%) ou ${translateAlignment(second)} (${secondPct}%)`;
  }

  return value
    .split(/\s*,\s*or\s*|\s*,\s*/i)
    .map((part) => ALIGNMENT_PT[part.trim().toLowerCase()] ?? part.trim())
    .join(' ou ');
}

function ftToMeters(value: string): number {
  return Math.round(Number(value) * 0.3048);
}

const SPEED_TYPE_PT: Record<string, string> = {
  walk: 'andando',
  fly: 'voando',
  swim: 'nadando',
  climb: 'escalando',
  burrow: 'escavando',
};

// Traduz o objeto "speed" da SRD (ex: { walk: "30 ft.", fly: "60 ft.", hover: true })
// para um texto como "andando 9 m, voando 18 m (pairando)".
function translateSpeed(speed: DataRecord): string {
  return Object.entries(speed)
    .filter(([key]) => key !== 'hover')
    .map(([key, value]) => {
      const label = SPEED_TYPE_PT[key] ?? key;
      const feet =
        typeof value === 'string' ? value.match(/\d+/)?.[0] : undefined;
      const meters = feet ? ftToMeters(feet) : 0;
      const hover = key === 'fly' && speed.hover ? ' (pairando)' : '';
      return `${label} ${meters} m${hover}`;
    })
    .join(', ');
}

// Traduz o nome de um único idioma/dialeto, preservando texto desconhecido.
function translateLanguageName(name: string): string {
  const trimmed = name.trim();
  return LANGUAGE_PT[trimmed] ?? trimmed;
}

// Traduz uma lista "X, Y and Z" / "X, Y, and Z" de idiomas.
function translateLanguageList(value: string): string {
  return value
    .split(/\s*,\s*and\s*|\s*,\s*|\s+and\s+/i)
    .filter(Boolean)
    .map(translateLanguageName)
    .join(', ');
}

// Traduz o campo "languages" da SRD, que mistura nomes de idiomas com
// frases livres em inglês (telepatia, restrições de fala, escolhas, etc.).
function translateLanguages(value: string): string {
  let text = value.trim();

  const exactPhrases: Record<string, string> = {
    'any languages it knew in life': 'os idiomas que conhecia em vida',
    'the languages it knew in life': 'os idiomas que conhecia em vida',
    "understands all languages it knew in life but can't speak":
      'entende todos os idiomas que conhecia em vida, mas não consegue falar',
    "understands all languages it spoke in life but can't speak":
      'entende todos os idiomas que falava em vida, mas não consegue falar',
    'one language known by its creator': 'um idioma conhecido por seu criador',
    "understands the languages of its creator but can't speak":
      'entende os idiomas de seu criador, mas não consegue falar',
    "understands commands given in any language but can't speak":
      'entende comandos dados em qualquer idioma, mas não consegue falar',
    'any one language': 'um idioma à escolha',
    'any one language (usually Common)':
      'um idioma à escolha (normalmente Comum)',
    'Common plus up to five other languages':
      'Comum, mais até cinco outros idiomas à escolha',
    'Druidic plus any two languages': 'Druídico, mais dois idiomas à escolha',
    "Thieves' cant plus any two languages":
      'Cant dos Ladrões, mais dois idiomas à escolha',
  };
  if (exactPhrases[text]) return exactPhrases[text];

  const anyNMatch = text.match(
    /^any (one|two|three|four|five|six) languages?$/i,
  );
  if (anyNMatch) {
    return `${LANGUAGE_NUMBER_PT[anyNMatch[1].toLowerCase()]} idiomas à escolha`;
  }

  const plusAnyMatch = text.match(
    /^(.+) plus any (one|two|three|four|five|six) languages?$/i,
  );
  if (plusAnyMatch) {
    const [, base, count] = plusAnyMatch;
    return `${translateLanguageName(base)}, mais ${LANGUAGE_NUMBER_PT[count.toLowerCase()]} idiomas à escolha`;
  }

  // "X, telepathy N ft." ou "X, telepathy N ft. (works only with creatures that understand Y)"
  text = text.replace(
    /telepathy (\d+) ft\.(?: \(works only with creatures that understand ([^)]+)\))?/gi,
    (_match, ft: string, restriction?: string) => {
      const base = `telepatia (${ftToMeters(ft)} m)`;
      return restriction
        ? `${base} (funciona apenas com criaturas que entendem ${translateLanguageList(restriction)})`
        : base;
    },
  );

  // "X (can't speak in Y form)"
  const formMatch = text.match(/^(.+) \(can't speak in (.+) form\)$/i);
  if (formMatch) {
    return `${translateLanguageName(formMatch[1])} (não consegue falar em forma de ${translateLanguageName(formMatch[2])})`;
  }

  // "X, understands Y but can't/doesn't speak [it]" — divide na primeira ocorrência de "understands".
  const understandsSplit = text.match(
    /^(.*?),?\s*understands (.+?) but (?:can't|doesn't) speak(?: it)?$/i,
  );
  if (understandsSplit) {
    const [, prefix, understood] = understandsSplit;
    const understoodPt = `entende ${translateLanguageList(understood)}, mas não fala`;
    return prefix
      ? `${translateLanguageName(prefix)}, ${understoodPt}`
      : understoodPt;
  }

  // "X (can't speak in boar form)" já tratado acima; demais frases entre parênteses ficam como estão.
  return text
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed || trimmed.toLowerCase().startsWith('telepatia'))
        return trimmed;
      const match = trimmed.match(/^([^()]+?)(\s*\(.*\))?$/);
      const base = match ? match[1].trim() : trimmed;
      const suffix = match?.[2] ?? '';
      return translateLanguageName(base) + suffix;
    })
    .join(', ');
}

export function parseSrdDate(record: DataRecord) {
  const value = stringField(record, 'updated_at');
  return value ? new Date(value) : null;
}

export function mapMonster(data: DataRecord) {
  const armorClass = recordArrayField(data, 'armor_class')[0];
  const traits = recordArrayField(data, 'special_abilities').map(mapFeature);
  const actions = recordArrayField(data, 'actions').map(mapFeature);
  const reactions = recordArrayField(data, 'reactions').map(mapFeature);
  const legendaryActions = recordArrayField(data, 'legendary_actions').map(
    mapFeature,
  );
  const speed = asRecord(data.speed);
  const description = [
    stringField(data, 'alignment')
      ? `Alinhamento: ${translateAlignment(stringField(data, 'alignment'))}.`
      : null,
    stringField(data, 'languages')
      ? `Idiomas: ${translateLanguages(stringField(data, 'languages'))}.`
      : null,
    speed ? `Deslocamento: ${translateSpeed(speed)}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    srdIndex: stringField(data, 'index'),
    source: SOURCE,
    sourceUrl: sourceUrl(data),
    srdUpdatedAt: parseSrdDate(data),
    name: stringField(data, 'name'),
    type: translateMonsterType(stringField(data, 'type', 'unknown')),
    size: translateMonsterSize(stringField(data, 'size', 'Medium')),
    armorClass: armorClass ? numberField(armorClass, 'value', 10) : 10,
    maxHp: numberField(data, 'hit_points', 1),
    speed: parseFeetToMeters(
      speed ? stringField(speed, 'walk', '30 ft.') : '30 ft.',
    ),
    strength: numberField(data, 'strength', 10),
    dexterity: numberField(data, 'dexterity', 10),
    constitution: numberField(data, 'constitution', 10),
    intelligence: numberField(data, 'intelligence', 10),
    wisdom: numberField(data, 'wisdom', 10),
    charisma: numberField(data, 'charisma', 10),
    challengeRating: formatChallengeRating(
      numberField(data, 'challenge_rating', 0),
    ),
    xp: numberField(data, 'xp', 0),
    traits: traits.length ? JSON.stringify(traits) : null,
    actions: [...actions, ...reactions, ...legendaryActions].length
      ? JSON.stringify([...actions, ...reactions, ...legendaryActions])
      : null,
    description: description || null,
    imageUrl: imageUrl(data),
    isNpc: isNpcName(stringField(data, 'name')),
  };
}

export function mapRuleSection(data: DataRecord) {
  return {
    srdIndex: stringField(data, 'index'),
    source: SOURCE,
    sourceUrl: sourceUrl(data),
    srdUpdatedAt: parseSrdDate(data),
    name: stringField(data, 'name'),
    description: stringField(data, 'desc') || null,
  };
}

export function mapSpell(data: DataRecord) {
  const school = asRecord(data.school);
  const description = [
    ...stringArrayField(data, 'desc'),
    ...stringArrayField(data, 'higher_level'),
  ].join('\n\n');
  const classes = recordArrayField(data, 'classes').map((item) =>
    stringField(item, 'name'),
  );

  return {
    srdIndex: stringField(data, 'index'),
    source: SOURCE,
    sourceUrl: sourceUrl(data),
    srdUpdatedAt: parseSrdDate(data),
    name: stringField(data, 'name'),
    school: translateSchool(
      school ? stringField(school, 'name', 'Unknown') : 'Unknown',
    ),
    level: numberField(data, 'level', 0),
    range: translateRange(stringField(data, 'range', 'Self')),
    duration: translateDuration(stringField(data, 'duration', 'Instantaneous')),
    concentration: booleanField(data, 'concentration'),
    description: description || null,
    classes: classes.length
      ? JSON.stringify(classes.map(translateClassName))
      : null,
  };
}

export function mapEquipment(data: DataRecord, endpoint: string) {
  const category = translateItemCategory(
    referenceName(
      data.equipment_category,
      endpoint === 'magic-items' ? 'Magic Item' : 'Equipment',
    ),
  );
  const cost = asRecord(data.cost);
  const damage = asRecord(data.damage);
  const armorClass = asRecord(data.armor_class);
  const rarity = asRecord(data.rarity);
  const properties = {
    srdIndex: stringField(data, 'index'),
    equipmentCategory: referenceIndex(data.equipment_category),
    weaponCategory: stringField(data, 'weapon_category') || undefined,
    weaponRange: stringField(data, 'weapon_range') || undefined,
    damage: damage ? stringField(damage, 'damage_dice') : undefined,
    damageType: damage
      ? translateDamageType(referenceName(damage.damage_type))
      : undefined,
    armorClass: armorClass ? numberField(armorClass, 'base') : undefined,
    strengthMinimum: numberField(data, 'str_minimum') || undefined,
    stealthDisadvantage:
      booleanField(data, 'stealth_disadvantage') || undefined,
    rarity: rarity ? stringField(rarity, 'name') : undefined,
    properties: recordArrayField(data, 'properties').map((item) =>
      translateWeaponProperty(stringField(item, 'name')),
    ),
    special: stringArrayField(data, 'special'),
  };

  return {
    srdIndex: `${endpoint}:${stringField(data, 'index')}`,
    source: SOURCE,
    sourceUrl: sourceUrl(data),
    srdUpdatedAt: parseSrdDate(data),
    name: stringField(data, 'name'),
    description:
      [
        ...stringArrayField(data, 'desc'),
        ...stringArrayField(data, 'special'),
      ].join('\n\n') || null,
    weight: poundsToKilograms(numberField(data, 'weight')),
    value: cost
      ? costToGold(numberField(cost, 'quantity'), stringField(cost, 'unit'))
      : 0,
    rarity: mapRarity(rarity ? stringField(rarity, 'name') : null),
    category,
    slot: mapEquipmentSlot(category, stringField(data, 'armor_category')),
    properties: JSON.stringify(removeUndefined(properties)),
    imageUrl: imageUrl(data),
  };
}

function mapFeature(record: DataRecord): CatalogFeature {
  return {
    name: stringField(record, 'name'),
    description: stringField(record, 'desc'),
  };
}

function parseFeetToMeters(value: string) {
  const match = value.match(/(\d+)/);
  if (!match) return 9;
  return Math.round(Number(match[1]) * 0.3048);
}

function poundsToKilograms(value: number) {
  return Math.round(value * 0.453592 * 10) / 10;
}

function costToGold(quantity: number, unit: string) {
  const multiplier: Record<string, number> = {
    cp: 0.01,
    sp: 0.1,
    ep: 0.5,
    gp: 1,
    pp: 10,
  };

  return Math.round(quantity * (multiplier[unit] ?? 1));
}

function formatChallengeRating(value: number) {
  if (value === 0.125) return '1/8';
  if (value === 0.25) return '1/4';
  if (value === 0.5) return '1/2';
  return Number.isInteger(value) ? String(value) : String(value);
}

function mapRarity(value: string | null): ItemRarity {
  const normalized = value?.toLowerCase() ?? '';
  if (normalized.includes('artifact')) return ItemRarity.ARTIFACT;
  if (normalized.includes('legendary')) return ItemRarity.LEGENDARY;
  if (normalized.includes('very rare')) return ItemRarity.VERY_RARE;
  if (normalized.includes('rare')) return ItemRarity.RARE;
  if (normalized.includes('uncommon')) return ItemRarity.UNCOMMON;
  return ItemRarity.COMMON;
}

function mapEquipmentSlot(
  category: string,
  armorCategory: string,
): EquipmentSlot {
  const normalized = category.toLowerCase();
  const armor = armorCategory.toLowerCase();
  if (normalized.includes('weapon')) return EquipmentSlot.MAIN_HAND;
  if (armor.includes('shield')) return EquipmentSlot.OFF_HAND;
  if (normalized.includes('armor')) return EquipmentSlot.CHEST;
  return EquipmentSlot.NONE;
}

function removeUndefined(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}
