"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import {
  ALIGNMENT_INFO,
  BACKGROUND_INFO,
  CLASS_INFO,
  HIT_DIE_BY_CLASS,
  RACE_INFO,
  SUBCLASS_INFO,
} from "@/lib/character-options";
import {
  abilityModifier,
  calculateDerivedStats,
  calculateSpellSlots,
  formatModifier,
  pointBuyCost,
  POINT_BUY_BUDGET,
  type BaseAttributes,
} from "@/lib/character-rules";
import {
  ALIGNMENTS,
  ATTRIBUTE_LABELS,
  BACKGROUNDS,
  CLASSES,
  DEITIES,
  RACES,
  SUBCLASSES,
  type Character,
} from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

const STEPS = ["Identidade", "Atributos", "Aparência e história", "Revisão"];

const ATTRIBUTE_KEYS: (keyof BaseAttributes)[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

interface FormState extends BaseAttributes {
  name: string;
  race: string;
  class: string;
  subclass: string;
  background: string;
  alignment: string;
  deity: string;
  appearance: string;
  backstory: string;
  portraitUrl: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  race: RACES[0],
  class: CLASSES[0],
  subclass: SUBCLASSES[CLASSES[0]][0],
  background: BACKGROUNDS[0],
  alignment: ALIGNMENTS[0],
  deity: DEITIES[DEITIES.length - 1],
  appearance: "",
  backstory: "",
  portraitUrl: "",
  strength: 8,
  dexterity: 8,
  constitution: 8,
  intelligence: 8,
  wisdom: 8,
  charisma: 8,
};

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm";

const textareaClassName =
  "min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm";

function NewCharacterContent() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailRace, setDetailRace] = useState<string | null>(null);
  const [detailClass, setDetailClass] = useState<string | null>(null);
  const [detailSubclass, setDetailSubclass] = useState<string | null>(null);
  const [detailBackground, setDetailBackground] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateClass(nextClass: string) {
    setForm((prev) => ({
      ...prev,
      class: nextClass,
      subclass: SUBCLASSES[nextClass]?.[0] ?? "",
    }));
  }

  function adjustAttribute(key: keyof BaseAttributes, delta: number) {
    setForm((prev) => {
      const nextValue = prev[key] + delta;
      if (nextValue < 8 || nextValue > 15) return prev;
      const next = { ...prev, [key]: nextValue };
      if (pointBuyCost(next) > POINT_BUY_BUDGET) return prev;
      return next;
    });
  }

  const spentPoints = pointBuyCost(form);
  const remainingPoints = POINT_BUY_BUDGET - spentPoints;

  const derived = calculateDerivedStats(form, 1, form.class);
  const previewSpellSlots = calculateSpellSlots(form.class, 1).filter((slot) => slot.total > 0);

  const canGoNext = (() => {
    if (step === 0) return form.name.trim().length > 0;
    return true;
  })();

  async function handleCreate() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const character = await api.post<Character>(
        "/characters",
        {
          name: form.name,
          race: form.race,
          class: form.class,
          subclass: form.subclass || undefined,
          background: form.background || undefined,
          alignment: form.alignment || undefined,
          deity: form.deity || undefined,
          appearance: form.appearance || undefined,
          backstory: form.backstory || undefined,
          portraitUrl: form.portraitUrl || undefined,
          strength: form.strength,
          dexterity: form.dexterity,
          constitution: form.constitution,
          intelligence: form.intelligence,
          wisdom: form.wisdom,
          charisma: form.charisma,
        },
        token,
      );
      router.push(`/characters/${character.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o personagem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Criar personagem</h1>
        <p className="text-muted-foreground">
          Etapa {step + 1} de {STEPS.length}: {STEPS[step]}
        </p>
      </div>

      <Card className="parchment frame-ornate">
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
          {step === 1 ? (
            <CardDescription>
              Distribua os pontos entre os atributos (sistema de compra de pontos). Pontos
              restantes: {remainingPoints} / {POINT_BUY_BUDGET}
            </CardDescription>
          ) : null}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {step === 0 ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Nome do personagem</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Raça</Label>
                <p className="text-xs text-muted-foreground">
                  Toque em uma raça para ver seus traços e confirmar a escolha.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {RACES.map((race) => (
                    <button
                      key={race}
                      type="button"
                      data-selected={form.race === race}
                      className="option-card flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left"
                      onClick={() => setDetailRace(race)}
                    >
                      <span className="text-sm font-medium">{race}</span>
                      <span className="text-xs text-muted-foreground">
                        {RACE_INFO[race]?.abilityBonus}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Classe</Label>
                <p className="text-xs text-muted-foreground">
                  Toque em uma classe para ver detalhes, atributos e características.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CLASSES.map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      data-selected={form.class === cls}
                      className="option-card flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left"
                      onClick={() => setDetailClass(cls)}
                    >
                      <span className="text-sm font-medium">{cls}</span>
                      <span className="text-xs text-muted-foreground">
                        {CLASS_INFO[cls]?.primaryAbility} • d{HIT_DIE_BY_CLASS[cls] ?? 8}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Subclasse</Label>
                <p className="text-xs text-muted-foreground">
                  Toque em uma subclasse para ver suas características.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(SUBCLASSES[form.class] ?? []).map((subclass) => (
                    <button
                      key={subclass}
                      type="button"
                      data-selected={form.subclass === subclass}
                      className="option-card flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left"
                      onClick={() => setDetailSubclass(subclass)}
                    >
                      <span className="text-sm font-medium">{subclass}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Antecedente</Label>
                <p className="text-xs text-muted-foreground">
                  Toque em um antecedente para ver perícias e características.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {BACKGROUNDS.map((background) => (
                    <button
                      key={background}
                      type="button"
                      data-selected={form.background === background}
                      className="option-card flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left"
                      onClick={() => setDetailBackground(background)}
                    >
                      <span className="text-sm font-medium">{background}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="alignment">Alinhamento</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ALIGNMENTS.map((alignment) => (
                    <button
                      key={alignment}
                      type="button"
                      data-selected={form.alignment === alignment}
                      className="option-card flex flex-col gap-1 rounded-lg px-3 py-2 text-left"
                      onClick={() => update("alignment", alignment)}
                    >
                      <span className="text-sm font-medium">{alignment}</span>
                      <span className="text-xs text-muted-foreground">
                        {ALIGNMENT_INFO[alignment]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="deity">Divindade</Label>
                <select
                  id="deity"
                  className={selectClassName}
                  value={form.deity}
                  onChange={(event) => update("deity", event.target.value)}
                >
                  {DEITIES.map((deity) => (
                    <option key={deity} value={deity}>
                      {deity}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-3">
              {ATTRIBUTE_KEYS.map((key) => {
                const value = form[key];
                const modifier = abilityModifier(value);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                  >
                    <span className="font-medium">{ATTRIBUTE_LABELS[key]}</span>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => adjustAttribute(key, -1)}
                        disabled={value <= 8}
                      >
                        -
                      </Button>
                      <span className="w-16 text-center tabular-nums">
                        {value} ({formatModifier(modifier)})
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => adjustAttribute(key, 1)}
                        disabled={value >= 15 || remainingPoints <= 0}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {step === 2 ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="portraitUrl">URL do retrato (opcional)</Label>
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    {form.portraitUrl ? (
                      <AvatarImage src={form.portraitUrl} alt="Pré-visualização do retrato" />
                    ) : null}
                    <AvatarFallback>{form.name.slice(0, 2).toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <Input
                    id="portraitUrl"
                    value={form.portraitUrl}
                    onChange={(event) => update("portraitUrl", event.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="appearance">Aparência</Label>
                <textarea
                  id="appearance"
                  className={textareaClassName}
                  value={form.appearance}
                  onChange={(event) => update("appearance", event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="backstory">História</Label>
                <textarea
                  id="backstory"
                  className={textareaClassName}
                  value={form.backstory}
                  onChange={(event) => update("backstory", event.target.value)}
                />
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="font-semibold">{form.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {form.race} • {form.class}
                  {form.subclass ? ` (${form.subclass})` : ""} • Nível 1
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
                {ATTRIBUTE_KEYS.map((key) => (
                  <div key={key} className="rounded-lg border border-border/60 p-2">
                    <p className="text-xs text-muted-foreground">{ATTRIBUTE_LABELS[key]}</p>
                    <p className="font-semibold">{form[key]}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatModifier(derived.modifiers[key])}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border/60 p-2 text-center">
                  <p className="text-xs text-muted-foreground">Pontos de vida</p>
                  <p className="font-semibold">{derived.maxHp}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-2 text-center">
                  <p className="text-xs text-muted-foreground">Classe de armadura</p>
                  <p className="font-semibold">{derived.armorClass}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-2 text-center">
                  <p className="text-xs text-muted-foreground">Iniciativa</p>
                  <p className="font-semibold">{formatModifier(derived.initiative)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-2 text-center">
                  <p className="text-xs text-muted-foreground">Proficiência</p>
                  <p className="font-semibold">{formatModifier(derived.proficiencyBonus)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-2 text-center">
                  <p className="text-xs text-muted-foreground">Slots de magia</p>
                  <p className="font-semibold">
                    {previewSpellSlots.length > 0
                      ? previewSpellSlots
                          .map((slot) => `Nv ${slot.level}: ${slot.total}`)
                          .join(" / ")
                      : "Sem slots"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>

        <CardFooter className="mt-4 flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((prev) => Math.max(0, prev - 1))}
            disabled={step === 0}
          >
            Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep((prev) => prev + 1)} disabled={!canGoNext}>
              Próximo
            </Button>
          ) : (
            <Button type="button" onClick={handleCreate} disabled={loading}>
              {loading ? "Criando..." : "Criar personagem"}
            </Button>
          )}
        </CardFooter>
      </Card>

      <Dialog
        open={detailRace !== null}
        onOpenChange={(open) => {
          if (!open) setDetailRace(null);
        }}
      >
        <DialogContent className="parchment frame-ornate sm:max-w-lg">
          {detailRace ? (
            <>
              <DialogHeader>
                <DialogTitle>{detailRace}</DialogTitle>
                <DialogDescription>{RACE_INFO[detailRace]?.description}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Atributos: {RACE_INFO[detailRace]?.abilityBonus}</Badge>
                <Badge variant="outline">Deslocamento: {RACE_INFO[detailRace]?.speed}</Badge>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {RACE_INFO[detailRace]?.traits.map((trait) => <li key={trait}>{trait}</li>)}
              </ul>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDetailRace(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    update("race", detailRace);
                    setDetailRace(null);
                  }}
                >
                  Selecionar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailClass !== null}
        onOpenChange={(open) => {
          if (!open) setDetailClass(null);
        }}
      >
        <DialogContent className="parchment frame-ornate sm:max-w-lg">
          {detailClass ? (
            <>
              <DialogHeader>
                <DialogTitle>{detailClass}</DialogTitle>
                <DialogDescription>{CLASS_INFO[detailClass]?.description}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Atributo principal: {CLASS_INFO[detailClass]?.primaryAbility}
                </Badge>
                <Badge variant="outline">Dado de vida: d{HIT_DIE_BY_CLASS[detailClass] ?? 8}</Badge>
                <Badge variant="outline">
                  Resistências: {CLASS_INFO[detailClass]?.savingThrows.join(" e ")}
                </Badge>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Características de nível 1
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {CLASS_INFO[detailClass]?.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDetailClass(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    updateClass(detailClass);
                    setDetailClass(null);
                  }}
                >
                  Selecionar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailSubclass !== null}
        onOpenChange={(open) => {
          if (!open) setDetailSubclass(null);
        }}
      >
        <DialogContent className="parchment frame-ornate sm:max-w-lg">
          {detailSubclass ? (
            <>
              <DialogHeader>
                <DialogTitle>{detailSubclass}</DialogTitle>
                <DialogDescription>
                  {SUBCLASS_INFO[form.class]?.[detailSubclass]?.description}
                </DialogDescription>
              </DialogHeader>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {SUBCLASS_INFO[form.class]?.[detailSubclass]?.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDetailSubclass(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    update("subclass", detailSubclass);
                    setDetailSubclass(null);
                  }}
                >
                  Selecionar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailBackground !== null}
        onOpenChange={(open) => {
          if (!open) setDetailBackground(null);
        }}
      >
        <DialogContent className="parchment frame-ornate sm:max-w-lg">
          {detailBackground ? (
            <>
              <DialogHeader>
                <DialogTitle>{detailBackground}</DialogTitle>
                <DialogDescription>
                  {BACKGROUND_INFO[detailBackground]?.description}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Perícias: {BACKGROUND_INFO[detailBackground]?.skillProficiencies.join(" e ")}
                </Badge>
              </div>
              <p className="text-sm">{BACKGROUND_INFO[detailBackground]?.feature}</p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDetailBackground(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    update("background", detailBackground);
                    setDetailBackground(null);
                  }}
                >
                  Selecionar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NewCharacterPage() {
  return (
    <RequireAuth>
      <NewCharacterContent />
    </RequireAuth>
  );
}
