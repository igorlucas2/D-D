"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { abilityModifier, formatModifier } from "@/lib/character-rules";
import { api, ApiError } from "@/lib/api";
import { getItemIcon, getRarityBorderColor, getRarityColor, getSpellIcon } from "@/lib/game-icons";
import {
  ITEM_CATEGORY_LABELS,
  MONSTER_TYPE_LABELS,
  SCHOOL_LABELS,
  translateItemCategory,
  translateMonsterSize,
  translateMonsterType,
  translateSchool,
} from "@/lib/srd-labels";
import {
  challengeRatingToNumber,
  type Item,
  type Monster,
  type RuleSection,
  type Spell,
  type SrdEndpointSummary,
  type SrdResourcePage,
  type SrdResourceSummary,
  type SrdSyncResult,
} from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import {
  BookMarked,
  Database,
  RefreshCw,
  ScrollText,
  Skull,
  Users,
  type LucideIcon,
} from "lucide-react";

const ABILITY_LABELS: { key: keyof Pick<Monster, "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma">; label: string }[] = [
  { key: "strength", label: "FOR" },
  { key: "dexterity", label: "DES" },
  { key: "constitution", label: "CON" },
  { key: "intelligence", label: "INT" },
  { key: "wisdom", label: "SAB" },
  { key: "charisma", label: "CAR" },
];

const RARITY_LABELS: Record<string, string> = {
  COMMON: "Comum",
  UNCOMMON: "Incomum",
  RARE: "Raro",
  VERY_RARE: "Muito raro",
  LEGENDARY: "Lendário",
  ARTIFACT: "Artefato",
};

const PROPERTY_LABELS: Record<string, string> = {
  damage: "Dano",
  damageType: "Tipo de dano",
  armorBonus: "Bônus de CA",
  healing: "Cura",
  extraCapacity: "Capacidade extra",
};

function formatProperties(properties: string | null): string[] {
  if (!properties) return [];
  try {
    const parsed = JSON.parse(properties) as Record<string, unknown>;
    return Object.entries(parsed).map(([key, value]) => `${PROPERTY_LABELS[key] ?? key}: ${value}`);
  } catch {
    return [];
  }
}

function StatBox({ label, value, modifier }: { label: string; value: string; modifier?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 px-2 py-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-heading text-lg font-bold leading-none">{value}</span>
      {modifier ? <span className="text-xs text-muted-foreground">{modifier}</span> : null}
    </div>
  );
}

// Seção do bloco de status (ex: "Características", "Ações"), com sublinhado dourado
// inspirado nas fichas clássicas de D&D.
function StatBlockSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="border-b-2 border-primary/40 pb-1 font-heading text-sm font-bold uppercase tracking-wider text-primary">
        {title}
      </h3>
      {children}
    </div>
  );
}

// Retrato grande para monstros/itens, com ícone de fallback quando não há imagem.
function Portrait({
  src,
  alt,
  icon: Icon,
  size = "h-16 w-16",
  iconClassName = "text-muted-foreground",
}: {
  src?: string | null;
  alt: string;
  icon: LucideIcon;
  size?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-border bg-muted/40`}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <Icon className={`h-1/2 w-1/2 ${iconClassName}`} />
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  labels,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function MonstersTab({ monsters, hideTypeFilter = false }: { monsters: Monster[]; hideTypeFilter?: boolean }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");

  const types = useMemo(() => {
    const unique = Array.from(new Set(monsters.map((monster) => monster.type))).sort();
    return ["Todos", ...unique];
  }, [monsters]);

  const filtered = useMemo(() => {
    return monsters
      .filter((monster) => hideTypeFilter || typeFilter === "Todos" || monster.type === typeFilter)
      .filter((monster) => monster.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => challengeRatingToNumber(a.challengeRating) - challengeRatingToNumber(b.challengeRating));
  }, [monsters, search, typeFilter, hideTypeFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-xs"
        />
        {hideTypeFilter ? null : (
          <FilterSelect value={typeFilter} onChange={setTypeFilter} options={types} labels={MONSTER_TYPE_LABELS} />
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground">Nenhuma criatura encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        filtered.map((monster) => (
          <Card key={monster.id} className="overflow-hidden border-l-4 border-l-primary/50">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              <Portrait src={monster.imageUrl} alt={monster.name} icon={Skull} size="h-20 w-20" />
              <div className="flex flex-1 flex-col gap-1">
                <CardTitle className="font-heading text-xl">{monster.name}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <span className="italic">
                    {translateMonsterSize(monster.size)} {translateMonsterType(monster.type)}
                  </span>
                  <Badge variant="outline">CD {monster.challengeRating}</Badge>
                  <Badge variant="outline">{monster.xp} XP</Badge>
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {monster.description ? (
                <p className="text-muted-foreground">{monster.description}</p>
              ) : null}

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
                <StatBox label="CA" value={String(monster.armorClass)} />
                <StatBox label="PV" value={String(monster.maxHp)} />
                <StatBox label="Desloc." value={`${monster.speed} m`} />
                {ABILITY_LABELS.map(({ key, label }) => (
                  <StatBox
                    key={key}
                    label={label}
                    value={String(monster[key])}
                    modifier={formatModifier(abilityModifier(monster[key]))}
                  />
                ))}
              </div>

              {monster.traits.length > 0 ? (
                <StatBlockSection title="Características">
                  {monster.traits.map((trait) => (
                    <p key={trait.name}>
                      <span className="font-semibold">{trait.name}.</span> {trait.description}
                    </p>
                  ))}
                </StatBlockSection>
              ) : null}

              {monster.actions.length > 0 ? (
                <StatBlockSection title="Ações">
                  {monster.actions.map((action) => (
                    <p key={action.name}>
                      <span className="font-semibold">{action.name}.</span> {action.description}
                    </p>
                  ))}
                </StatBlockSection>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function ItemsTab({ items }: { items: Item[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [rarityFilter, setRarityFilter] = useState("Todas");

  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.category))).sort();
    return ["Todas", ...unique];
  }, [items]);

  const rarities = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.rarity)));
    return ["Todas", ...unique];
  }, [items]);

  const filtered = useMemo(() => {
    return items
      .filter((item) => categoryFilter === "Todas" || item.category === categoryFilter)
      .filter((item) => rarityFilter === "Todas" || item.rarity === rarityFilter)
      .filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  }, [items, search, categoryFilter, rarityFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-xs"
        />
        <FilterSelect
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categories}
          labels={ITEM_CATEGORY_LABELS}
        />
        <FilterSelect
          value={rarityFilter}
          onChange={setRarityFilter}
          options={rarities}
          labels={RARITY_LABELS}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground">Nenhum item encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        filtered.map((item) => {
          const ItemIcon = getItemIcon(item.category);
          const properties = formatProperties(item.properties);
          return (
            <Card key={item.id} className={`overflow-hidden border-l-4 ${getRarityBorderColor(item.rarity)}`}>
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <Portrait
                  src={item.imageUrl}
                  alt={item.name}
                  icon={ItemIcon}
                  size="h-16 w-16"
                  iconClassName={getRarityColor(item.rarity)}
                />
                <div className="flex flex-1 flex-col gap-1">
                  <CardTitle className="font-heading text-lg">{item.name}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    <span className="italic">{translateItemCategory(item.category)}</span>
                    <Badge variant="outline">{RARITY_LABELS[item.rarity] ?? item.rarity}</Badge>
                    <Badge variant="outline">peso {item.weight}</Badge>
                    <Badge variant="outline">{item.value} po</Badge>
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {item.description ? (
                  <p className="text-muted-foreground">{item.description}</p>
                ) : null}
                {properties.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {properties.map((property) => (
                      <Badge key={property} variant="secondary">
                        {property}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function SpellsTab({ spells }: { spells: Spell[] }) {
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("Todas");
  const [levelFilter, setLevelFilter] = useState("Todos");

  const schools = useMemo(() => {
    const unique = Array.from(new Set(spells.map((spell) => spell.school))).sort();
    return ["Todas", ...unique];
  }, [spells]);

  const levels = useMemo(() => {
    const unique = Array.from(new Set(spells.map((spell) => String(spell.level)))).sort(
      (a, b) => Number(a) - Number(b),
    );
    return ["Todos", ...unique];
  }, [spells]);

  const filtered = useMemo(() => {
    return spells
      .filter((spell) => schoolFilter === "Todas" || spell.school === schoolFilter)
      .filter((spell) => levelFilter === "Todos" || String(spell.level) === levelFilter)
      .filter((spell) => spell.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.level - b.level);
  }, [spells, search, schoolFilter, levelFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-xs"
        />
        <FilterSelect value={schoolFilter} onChange={setSchoolFilter} options={schools} labels={SCHOOL_LABELS} />
        <FilterSelect
          value={levelFilter}
          onChange={setLevelFilter}
          options={levels}
          labels={{ "0": "Truque" }}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground">Nenhuma magia encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        filtered.map((spell) => {
          const SpellIcon = getSpellIcon(spell.school);
          return (
            <Card key={spell.id} className="overflow-hidden border-l-4 border-l-primary/50">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10">
                  <SpellIcon className="h-8 w-8 text-primary" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <CardTitle className="font-heading text-lg">{spell.name}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    <span className="italic">{translateSchool(spell.school)}</span>
                    <Badge variant="outline">{spell.level === 0 ? "Truque" : `Nível ${spell.level}`}</Badge>
                    <Badge variant="outline">{spell.range}</Badge>
                    <Badge variant="outline">{spell.duration}</Badge>
                    {spell.concentration ? <Badge variant="secondary">Concentração</Badge> : null}
                  </CardDescription>
                </div>
              </CardHeader>
              {spell.description ? (
                <CardContent className="text-sm text-muted-foreground">{spell.description}</CardContent>
              ) : null}
            </Card>
          );
        })
      )}
    </div>
  );
}

// Renderiza um texto markdown simples (cabeçalhos, listas e parágrafos) vindo da SRD.
function renderRuleMarkdown(text: string) {
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    if (trimmed.startsWith("### ")) {
      flushList();
      blocks.push(
        <h4 key={index} className="font-heading text-sm font-semibold">
          {trimmed.slice(4)}
        </h4>,
      );
    } else if (trimmed.startsWith("## ")) {
      flushList();
      blocks.push(
        <h3 key={index} className="font-heading text-base font-semibold">
          {trimmed.slice(3)}
        </h3>,
      );
    } else if (trimmed.startsWith("# ")) {
      flushList();
      blocks.push(
        <h2 key={index} className="font-heading text-lg font-semibold">
          {trimmed.slice(2)}
        </h2>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
    } else {
      flushList();
      blocks.push(<p key={index}>{trimmed}</p>);
    }
  });
  flushList();

  return blocks;
}

function RulesTab({ rules }: { rules: RuleSection[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return rules.filter((rule) => rule.name.toLowerCase().includes(search.toLowerCase()));
  }, [rules, search]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Buscar por nome..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-xs"
      />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground">Nenhuma regra encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        filtered.map((rule) => (
          <Card key={rule.id}>
            <details>
              <summary className="cursor-pointer list-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ScrollText className="h-5 w-5" /> {rule.name}
                  </CardTitle>
                </CardHeader>
              </summary>
              {rule.description ? (
                <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {renderRuleMarkdown(rule.description)}
                </CardContent>
              ) : null}
            </details>
          </Card>
        ))
      )}
    </div>
  );
}

function SrdTab({
  endpoints,
  resources,
  endpointFilter,
  search,
  syncing,
  syncResult,
  nextCursor,
  loadingMore,
  onEndpointChange,
  onSearchChange,
  onSync,
  onLoadMore,
}: {
  endpoints: SrdEndpointSummary[];
  resources: SrdResourceSummary[];
  endpointFilter: string;
  search: string;
  syncing: boolean;
  syncResult: SrdSyncResult | null;
  nextCursor: string | null;
  loadingMore: boolean;
  onEndpointChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSync: () => void;
  onLoadMore: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar recurso SRD..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="max-w-xs"
        />
        <FilterSelect
          value={endpointFilter}
          onChange={onEndpointChange}
          options={["Todos", ...endpoints.map((endpoint) => endpoint.endpoint)]}
        />
        <Button variant="outline" onClick={onSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar SRD"}
        </Button>
      </div>

      {syncResult ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 py-3 text-sm">
            <Badge>{syncResult.imported} recursos importados</Badge>
            <span className="text-muted-foreground">
              {syncResult.endpoints.length} endpoint
              {syncResult.endpoints.length === 1 ? "" : "s"} sincronizado
              {syncResult.endpoints.length === 1 ? "" : "s"}
            </span>
          </CardContent>
        </Card>
      ) : null}

      {endpoints.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {endpoints.map((endpoint) => (
            <Badge key={endpoint.endpoint} variant="outline">
              {endpoint.endpoint}: {endpoint.count}
            </Badge>
          ))}
        </div>
      ) : null}

      {resources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              Nenhum recurso SRD local. Use a sincronizacao para popular o banco.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {resources.map((resource) => (
            <Card key={resource.id}>
              <CardHeader>
                <CardTitle className="text-base">{resource.name}</CardTitle>
                <CardDescription className="flex flex-wrap gap-2">
                  <Badge variant="outline">{resource.endpoint}</Badge>
                  <span>{resource.index}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-primary hover:underline"
                >
                  {resource.url}
                </a>
                <span className="text-xs text-muted-foreground">
                  Importado em {new Date(resource.importedAt).toLocaleString("pt-BR")}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {nextCursor ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function LibraryContent() {
  const token = useAuthStore((state) => state.token);
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [spells, setSpells] = useState<Spell[]>([]);
  const [rules, setRules] = useState<RuleSection[]>([]);
  const [srdEndpoints, setSrdEndpoints] = useState<SrdEndpointSummary[]>([]);
  const [srdResources, setSrdResources] = useState<SrdResourceSummary[]>([]);
  const [srdNextCursor, setSrdNextCursor] = useState<string | null>(null);
  const [srdLoadingMore, setSrdLoadingMore] = useState(false);
  const [srdEndpointFilter, setSrdEndpointFilter] = useState("Todos");
  const [srdSearch, setSrdSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SrdSyncResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get<Monster[]>("/catalog/monsters", token),
      api.get<Item[]>("/catalog/items", token),
      api.get<Spell[]>("/catalog/spells", token),
      api.get<RuleSection[]>("/catalog/rules", token),
      api.get<SrdEndpointSummary[]>("/catalog/srd/endpoints", token),
    ])
      .then(([monstersData, itemsData, spellsData, rulesData, endpointData]) => {
        setMonsters(monstersData);
        setItems(itemsData);
        setSpells(spellsData);
        setRules(rulesData);
        setSrdEndpoints(endpointData);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar a biblioteca."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // Pequena espera para não disparar uma busca por tecla digitada.
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ take: "50" });
      if (srdEndpointFilter !== "Todos") params.set("endpoint", srdEndpointFilter);
      if (srdSearch.trim()) params.set("search", srdSearch.trim());

      api
        .get<SrdResourcePage>(`/catalog/srd/resources?${params.toString()}`, token)
        .then((page) => {
          if (cancelled) return;
          setSrdResources(page.items);
          setSrdNextCursor(page.nextCursor);
        })
        .catch(() => undefined);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, srdEndpointFilter, srdSearch]);

  async function loadMoreSrd() {
    if (!token || !srdNextCursor || srdLoadingMore) return;
    setSrdLoadingMore(true);
    try {
      const params = new URLSearchParams({ take: "50", cursor: srdNextCursor });
      if (srdEndpointFilter !== "Todos") params.set("endpoint", srdEndpointFilter);
      if (srdSearch.trim()) params.set("search", srdSearch.trim());
      const page = await api.get<SrdResourcePage>(
        `/catalog/srd/resources?${params.toString()}`,
        token,
      );
      setSrdResources((current) => [...current, ...page.items]);
      setSrdNextCursor(page.nextCursor);
    } catch {
      // Mantém a página já carregada; o usuário pode tentar de novo.
    } finally {
      setSrdLoadingMore(false);
    }
  }

  async function handleSyncSrd() {
    if (!token) return;
    setSyncing(true);
    setError(null);
    try {
      const result = await api.post<SrdSyncResult>("/catalog/srd/sync", {}, token);
      const [monstersData, itemsData, spellsData, rulesData, endpointData, resourcesPage] = await Promise.all([
        api.get<Monster[]>("/catalog/monsters", token),
        api.get<Item[]>("/catalog/items", token),
        api.get<Spell[]>("/catalog/spells", token),
        api.get<RuleSection[]>("/catalog/rules", token),
        api.get<SrdEndpointSummary[]>("/catalog/srd/endpoints", token),
        api.get<SrdResourcePage>("/catalog/srd/resources?take=50", token),
      ]);
      setSyncResult(result);
      setMonsters(monstersData);
      setItems(itemsData);
      setSpells(spellsData);
      setRules(rulesData);
      setSrdEndpoints(endpointData);
      setSrdResources(resourcesPage.items);
      setSrdNextCursor(resourcesPage.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao sincronizar SRD.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <span className="font-heading text-sm font-medium uppercase tracking-[0.3em] text-primary">
          Biblioteca
        </span>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight">
          <BookMarked className="h-7 w-7" /> Biblioteca
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Bestiário, itens e magias de referência para suas campanhas, com estatísticas baseadas no SRD de D&D 5ª edição.
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : (
        <Tabs defaultValue="monsters">
          <TabsList>
            <TabsTrigger value="monsters">Bestiário</TabsTrigger>
            <TabsTrigger value="npcs">
              <Users className="h-4 w-4" /> NPCs
            </TabsTrigger>
            <TabsTrigger value="items">Itens</TabsTrigger>
            <TabsTrigger value="spells">Magias</TabsTrigger>
            <TabsTrigger value="rules">
              <ScrollText className="h-4 w-4" /> Regras
            </TabsTrigger>
            <TabsTrigger value="srd">SRD</TabsTrigger>
          </TabsList>

          <TabsContent value="monsters" className="pt-4">
            <MonstersTab monsters={monsters} />
          </TabsContent>
          <TabsContent value="npcs" className="pt-4">
            <MonstersTab monsters={monsters.filter((monster) => monster.isNpc)} hideTypeFilter />
          </TabsContent>
          <TabsContent value="items" className="pt-4">
            <ItemsTab items={items} />
          </TabsContent>
          <TabsContent value="spells" className="pt-4">
            <SpellsTab spells={spells} />
          </TabsContent>
          <TabsContent value="rules" className="pt-4">
            <RulesTab rules={rules} />
          </TabsContent>
          <TabsContent value="srd" className="pt-4">
            <SrdTab
              endpoints={srdEndpoints}
              resources={srdResources}
              endpointFilter={srdEndpointFilter}
              search={srdSearch}
              syncing={syncing}
              syncResult={syncResult}
              nextCursor={srdNextCursor}
              loadingMore={srdLoadingMore}
              onEndpointChange={setSrdEndpointFilter}
              onSearchChange={setSrdSearch}
              onSync={handleSyncSrd}
              onLoadMore={loadMoreSrd}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <RequireAuth>
      <LibraryContent />
    </RequireAuth>
  );
}
