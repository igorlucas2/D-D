"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { RequireAuth } from "@/components/auth/require-auth";
import { InventoryTab } from "@/components/character/inventory-tab";
import { SpellsTab } from "@/components/character/spells-tab";
import { AmbientParticles } from "@/components/ornamental/ambient-particles";
import { Crest, OrnateDivider } from "@/components/ornamental/ornate-divider";
import { OrnateFrame } from "@/components/ornamental/ornate-frame";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import { ATTRIBUTE_LABELS, type Character } from "@/lib/types";
import { formatModifier } from "@/lib/character-rules";
import { useAuthStore } from "@/stores/auth-store";

const DiceRoller = dynamic(
  () => import("@/components/ornamental/dice-roller").then((mod) => mod.DiceRoller),
  { ssr: false },
);

const ATTRIBUTE_KEYS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

function FadeIn({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-primary/20 bg-background/35 px-2 py-3 text-center">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="font-heading text-2xl font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function AbilityScore({ label, score, modifier }: { label: string; score: number; modifier: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/65 px-3 py-3 sm:flex-col sm:justify-center sm:gap-2 sm:py-4">
      <span className="min-w-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:text-center">{label}</span>
      <div className="flex shrink-0 items-baseline gap-2 sm:flex-col sm:items-center sm:gap-0">
        <span className="font-heading text-2xl font-bold leading-none tabular-nums">{score}</span>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">{modifier}</span>
      </div>
    </div>
  );
}

function CharacterSheetContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["character", userId, params.id],
    queryFn: ({ signal }) =>
      api.get<Character>(`/characters/${params.id}`, token, signal),
    enabled: Boolean(token && params.id),
    // O mestre pode mudar o PV no combate enquanto a ficha está aberta. O
    // socket da mesa não cobre esta tela, então fica uma leitura de segurança.
    refetchInterval: 30_000,
  });

  const character = query.data ?? null;
  const [resistanceType, setResistanceType] = useState("fogo");
  const [resistanceKind, setResistanceKind] = useState<
    "RESISTANCE" | "IMMUNITY" | "VULNERABILITY"
  >("RESISTANCE");
  const [resistanceError, setResistanceError] = useState<string | null>(null);
  const updateCharacter = (updated: Character) => {
    queryClient.setQueryData(["character", userId, params.id], updated);
  };
  const loading = query.isLoading;
  const error =
    query.error instanceof ApiError
      ? query.error.message
      : query.error
        ? "Não foi possível carregar o personagem."
        : null;

  async function adjustResource(field: "currentHp" | "tempHp", delta: number) {
    if (!token || !character) return;
    const max = field === "currentHp" ? character.maxHp : Infinity;
    const next = Math.max(0, Math.min(max, character[field] + delta));
    if (next === character[field]) return;
    const updated = await api.patch<Character>(
      `/characters/${character.id}`,
      { [field]: next },
      token,
    );
    queryClient.setQueryData(["character", userId, params.id], updated);
  }

  async function handleDelete() {
    if (!token || !character) return;
    if (!confirm(`Excluir ${character.name}? Esta ação não pode ser desfeita.`)) return;
    await api.delete(`/characters/${character.id}`, token);
    router.push("/characters");
  }

  async function saveResistances(
    resistances: Array<{
      damageType: string;
      type: "RESISTANCE" | "IMMUNITY" | "VULNERABILITY";
    }>,
  ) {
    if (!token || !character) return;
    setResistanceError(null);
    try {
      const updated = await api.put<Character>(
        `/characters/${character.id}/resistances`,
        { resistances },
        token,
      );
      queryClient.setQueryData(["character", userId, params.id], updated);
    } catch (err) {
      setResistanceError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar as resistências.",
      );
    }
  }

  async function addResistance() {
    if (!character) return;
    const damageType = resistanceType.trim();
    if (!damageType) return;
    const current = (character.resistances ?? []).map((entry) => ({
      damageType: entry.damageType,
      type: entry.type,
    }));
    await saveResistances([
      ...current.filter(
        (entry) =>
          entry.damageType.toLowerCase() !== damageType.toLowerCase() ||
          entry.type !== resistanceKind,
      ),
      { damageType, type: resistanceKind },
    ]);
  }

  async function removeResistance(damageType: string, type: string) {
    if (!character) return;
    await saveResistances(
      (character.resistances ?? [])
        .filter(
          (entry) => !(entry.damageType === damageType && entry.type === type),
        )
        .map((entry) => ({
          damageType: entry.damageType,
          type: entry.type,
        })),
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-destructive">
        {error ?? "Personagem não encontrado."}
      </div>
    );
  }

  const spellSlots = character.spellSlots ?? [];
  const visibleSpellSlots = spellSlots.filter((slot) => slot.total > 0);
  const totalSpellSlots = visibleSpellSlots.reduce((sum, slot) => sum + slot.total, 0);
  const usedSpellSlots = visibleSpellSlots.reduce((sum, slot) => sum + slot.used, 0);
  const availableSpellSlots = Math.max(0, totalSpellSlots - usedSpellSlots);
  const spellSlotProgress =
    totalSpellSlots > 0 ? (availableSpellSlots / totalSpellSlots) * 100 : 0;

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <AmbientParticles className="-z-10" />

      <header className="relative overflow-hidden rounded-2xl border border-primary/35 bg-card/95 p-4 shadow-xl shadow-black/20 sm:p-6">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/40 to-transparent" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-5">
            <OrnateFrame className="shrink-0 bg-background p-1">
              <Avatar className="h-16 w-16 rounded-lg sm:h-24 sm:w-24">
                {character.portraitUrl ? (
                  <AvatarImage src={character.portraitUrl} alt={character.name} className="object-cover" />
                ) : null}
                <AvatarFallback className="rounded-lg text-xl">
                  {character.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </OrnateFrame>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <Crest className="h-4 w-4" />
                Ficha do aventureiro
              </div>
              <h1 className="min-w-0 break-words font-heading text-2xl font-bold tracking-wide text-foreground sm:text-4xl">
                {character.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {character.race} • {character.class}
                {character.subclass ? ` (${character.subclass})` : ""} • Nível {character.level}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {character.background ? <Badge variant="outline">{character.background}</Badge> : null}
                {character.alignment ? <Badge variant="outline">{character.alignment}</Badge> : null}
                {character.deity ? <Badge variant="outline">{character.deity}</Badge> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <DiceRoller />
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete}>
              Excluir personagem
            </Button>
          </div>
        </div>
      </header>

      <OrnateDivider />

      <section aria-label="Recursos do personagem" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="order-1 border border-primary/30 bg-card/95">
          <CardContent className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pontos de vida</span>
              <span aria-live="polite" className="font-heading text-xl font-bold tabular-nums sm:text-2xl">
                {character.currentHp} / {character.maxHp}
                {character.tempHp > 0 ? ` (+${character.tempHp})` : ""}
              </span>
            </div>
            <Progress aria-label="Pontos de vida" value={character.maxHp > 0 ? (character.currentHp / character.maxHp) * 100 : 0} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Ajustar PV</span>
              <div className="flex gap-2">
                <Button aria-label="Diminuir pontos de vida em 1" variant="outline" size="icon" className="size-11 text-lg" onClick={() => adjustResource("currentHp", -1)}>
                  -
                </Button>
                <Button aria-label="Aumentar pontos de vida em 1" variant="outline" size="icon" className="size-11 text-lg" onClick={() => adjustResource("currentHp", 1)}>
                  +
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="order-3 border border-primary/20 bg-card/95 lg:order-3">
          <CardContent className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Slots de magia</span>
              <span className="font-heading text-xl font-bold tabular-nums sm:text-2xl">
                {availableSpellSlots} / {totalSpellSlots}
              </span>
            </div>
            <Progress aria-label="Slots de magia disponíveis" value={spellSlotProgress} />
            <div className="flex min-h-8 flex-wrap gap-1">
              {visibleSpellSlots.length === 0 ? (
                <span className="text-xs text-muted-foreground">Sem slots neste nivel</span>
              ) : (
                visibleSpellSlots.map((slot) => (
                  <Badge key={slot.id} variant="outline">
                    Nv {slot.level}: {slot.total - slot.used}/{slot.total}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="order-2 border border-primary/20 bg-card/95">
          <CardContent className="grid h-full grid-cols-3 gap-2">
            <StatBadge label="CA" value={String(character.armorClass)} />
            <StatBadge label="Iniciativa" value={formatModifier(character.initiative)} />
            <StatBadge label="Proficiência" value={formatModifier(character.proficiencyBonus)} />
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="attributes" className="parchment frame-ornate min-w-0 rounded-xl p-3 sm:p-5">
        <TabsList aria-label="Seções da ficha" className="flex h-auto w-full min-w-0 justify-start overflow-x-auto rounded-lg border border-border/50 bg-muted/60 p-1">
          <TabsTrigger className="min-h-10 flex-none px-4" value="attributes">Atributos</TabsTrigger>
          <TabsTrigger className="min-h-10 flex-none px-4" value="inventory">Inventário</TabsTrigger>
          <TabsTrigger className="min-h-10 flex-none px-4" value="spells">Magias</TabsTrigger>
          <TabsTrigger className="min-h-10 flex-none px-4" value="story">História</TabsTrigger>
        </TabsList>

        <TabsContent value="attributes" className="pt-4">
          <FadeIn>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {ATTRIBUTE_KEYS.map((key) => (
                <AbilityScore
                  key={key}
                  label={ATTRIBUTE_LABELS[key]}
                  score={character[key]}
                  modifier={formatModifier(Math.floor((character[key] - 10) / 2))}
                />
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border/70 bg-card/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Resistências
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(character.resistances ?? []).map((resistance) => (
                  <Badge
                    key={resistance.id}
                    variant="secondary"
                    className="gap-1"
                  >
                    {resistance.damageType}:{" "}
                    {resistance.type === "RESISTANCE"
                      ? "resistência"
                      : resistance.type === "IMMUNITY"
                        ? "imunidade"
                        : "vulnerabilidade"}
                    <button
                      type="button"
                      aria-label={`Remover ${resistance.damageType}`}
                      onClick={() =>
                        removeResistance(resistance.damageType, resistance.type)
                      }
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </Badge>
                ))}
                {!character.resistances?.length ? (
                  <span className="text-xs text-muted-foreground">
                    Nenhuma resistência cadastrada.
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  value={resistanceType}
                  onChange={(event) => setResistanceType(event.target.value)}
                  placeholder="Tipo (fogo, gelo...)"
                  className="h-8 w-36"
                  maxLength={30}
                />
                <select
                  value={resistanceKind}
                  onChange={(event) =>
                    setResistanceKind(
                      event.target.value as
                        | "RESISTANCE"
                        | "IMMUNITY"
                        | "VULNERABILITY",
                    )
                  }
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  <option value="RESISTANCE">resistência</option>
                  <option value="IMMUNITY">imunidade</option>
                  <option value="VULNERABILITY">vulnerabilidade</option>
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addResistance}
                >
                  Adicionar
                </Button>
              </div>
              {resistanceError ? (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  {resistanceError}
                </p>
              ) : null}
            </div>
          </FadeIn>
        </TabsContent>

        <TabsContent value="inventory" className="pt-4">
          <FadeIn>
            <InventoryTab character={character} onChange={updateCharacter} />
          </FadeIn>
        </TabsContent>

        <TabsContent value="spells" className="pt-4">
          <FadeIn>
            <SpellsTab character={character} onChange={updateCharacter} />
          </FadeIn>
        </TabsContent>

        <TabsContent value="story" className="pt-4">
          <FadeIn>
            <OrnateFrame className="overflow-hidden bg-card/60">
              <div className="flex flex-col gap-4 p-6">
                <div>
                  <h3 className="font-heading text-lg font-semibold">Aparência</h3>
                  <OrnateDivider className="my-2" />
                  <p className="text-sm">{character.appearance || "Nenhuma descrição."}</p>
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold">História</h3>
                  <OrnateDivider className="my-2" />
                  <p className="text-sm">{character.backstory || "Nenhuma história registrada."}</p>
                </div>
              </div>
            </OrnateFrame>
          </FadeIn>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CharacterSheetPage() {
  return (
    <RequireAuth>
      <CharacterSheetContent />
    </RequireAuth>
  );
}
