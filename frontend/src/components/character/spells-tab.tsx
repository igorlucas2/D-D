"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { getSpellIcon } from "@/lib/game-icons";
import { translateSchool } from "@/lib/srd-labels";
import type { Character, CharacterSpell, CharacterSpellSlot, Spell } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

interface SpellsTabProps {
  character: Character;
  onChange: (character: Character) => void;
}

const CLASS_SPELL_ALIASES: Record<string, string[]> = {
  Bardo: ["Bardo", "Bard"],
  Bruxo: ["Bruxo", "Warlock"],
  Clerigo: ["Clerigo", "Cleric"],
  Druida: ["Druida", "Druid"],
  Feiticeiro: ["Feiticeiro", "Sorcerer"],
  Mago: ["Mago", "Wizard"],
  Paladino: ["Paladino", "Paladin"],
  Patrulheiro: ["Patrulheiro", "Ranger"],
};

function parseSpellClasses(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function canLearnSpell(className: string, spell: Spell) {
  const classes = parseSpellClasses(spell.classes);
  if (classes.length === 0) return true;
  const aliases = CLASS_SPELL_ALIASES[className] ?? [className];
  return classes.some((spellClass) =>
    aliases.some((alias) => alias.toLowerCase() === spellClass.toLowerCase()),
  );
}

function hasAvailableSlot(slots: CharacterSpellSlot[], spellLevel: number) {
  if (spellLevel === 0) return true;
  return slots.some((slot) => slot.level >= spellLevel && slot.total > slot.used);
}

function SlotPips({ slot }: { slot: CharacterSpellSlot }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: slot.total }, (_, index) => (
        <span
          key={index}
          className={`h-2.5 w-2.5 rounded-full border ${
            index < slot.used ? "border-muted-foreground bg-muted" : "border-primary bg-primary"
          }`}
        />
      ))}
    </div>
  );
}

export function SpellsTab({ character, onChange }: SpellsTabProps) {
  const token = useAuthStore((state) => state.token);
  const [catalog, setCatalog] = useState<Spell[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("Todos");
  const [error, setError] = useState<string | null>(null);

  const spellSlots = useMemo(
    () => (character.spellSlots ?? []).filter((slot) => slot.total > 0),
    [character.spellSlots],
  );
  const spells = useMemo(() => character.spells ?? [], [character.spells]);
  const knownSpellIds = useMemo(() => new Set(spells.map((spell) => spell.spellId)), [spells]);

  const availableCatalog = useMemo(() => {
    return catalog
      .filter((spell) => canLearnSpell(character.class, spell))
      .filter((spell) => !knownSpellIds.has(spell.id))
      .filter((spell) => spellSlots.length > 0 || spell.level === 0)
      .filter(
        (spell) =>
          spellSlots.length === 0 || levelFilter === "Todos" || String(spell.level) === levelFilter,
      )
      .filter((spell) => spell.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [catalog, character.class, knownSpellIds, levelFilter, search, spellSlots.length]);

  useEffect(() => {
    if (!token || !open || catalog.length > 0) return;
    api.get<Spell[]>("/catalog/spells", token).then(setCatalog);
  }, [token, open, catalog.length]);

  async function refresh() {
    if (!token) return;
    const updated = await api.get<Character>(`/characters/${character.id}`, token);
    onChange(updated);
  }

  async function handleAdd(spellId: string) {
    if (!token) return;
    setError(null);
    try {
      await api.post(`/characters/${character.id}/spells`, { spellId }, token);
      await refresh();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel adicionar a magia.");
    }
  }

  async function togglePrepared(characterSpell: CharacterSpell) {
    if (!token) return;
    await api.patch(
      `/characters/${character.id}/spells/${characterSpell.id}`,
      { prepared: !characterSpell.prepared },
      token,
    );
    await refresh();
  }

  async function castSpell(characterSpell: CharacterSpell) {
    if (!token) return;
    setError(null);
    try {
      const updated = await api.post<Character>(
        `/characters/${character.id}/spells/${characterSpell.id}/cast`,
        {},
        token,
      );
      onChange(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel conjurar a magia.");
    }
  }

  async function adjustSlot(slot: CharacterSpellSlot, action: "use" | "restore") {
    if (!token) return;
    const updated = await api.post<Character>(
      `/characters/${character.id}/spell-slots/${slot.level}/${action}`,
      {},
      token,
    );
    onChange(updated);
  }

  async function resetSlots() {
    if (!token) return;
    const updated = await api.post<Character>(`/characters/${character.id}/spell-slots/reset`, {}, token);
    onChange(updated);
  }

  async function removeSpell(characterSpell: CharacterSpell) {
    if (!token) return;
    await api.delete(`/characters/${character.id}/spells/${characterSpell.id}`, token);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {spellSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {character.class} ainda nao possui slots de magia neste nivel.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {spellSlots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5"
              >
                <Badge variant="outline">Nv {slot.level}</Badge>
                <SlotPips slot={slot} />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {slot.total - slot.used}/{slot.total}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => adjustSlot(slot, "use")}
                  disabled={slot.used >= slot.total}
                  title="Marcar usado"
                >
                  -
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => adjustSlot(slot, "restore")}
                  disabled={slot.used <= 0}
                  title="Restaurar"
                >
                  +
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {spellSlots.length > 0 ? (
            <Button variant="outline" size="sm" onClick={resetSlots}>
              Descanso longo
            </Button>
          ) : null}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              {spellSlots.length === 0 ? "Adicionar truque" : "Adicionar magia"}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar magia</DialogTitle>
                <DialogDescription>Escolha uma magia disponivel para a classe.</DialogDescription>
              </DialogHeader>
              <SpellPicker
                spells={availableCatalog}
                search={search}
                levelFilter={levelFilter}
                cantripOnly={spellSlots.length === 0}
                onSearchChange={setSearch}
                onLevelChange={setLevelFilter}
                onAdd={handleAdd}
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {spells.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma magia conhecida.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {spells.map((characterSpell) => {
            const SpellIcon = getSpellIcon(characterSpell.spell.school);
            const canCast = hasAvailableSlot(spellSlots, characterSpell.spell.level);
            return (
              <div
                key={characterSpell.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <SpellIcon className="h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">
                      {characterSpell.spell.name}{" "}
                      <Badge variant="outline">
                        {characterSpell.spell.level === 0 ? "Truque" : `Nv ${characterSpell.spell.level}`}
                      </Badge>
                      {characterSpell.spell.concentration ? (
                        <Badge variant="secondary" className="ml-1">
                          Concentracao
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {translateSchool(characterSpell.spell.school)} - {characterSpell.spell.range} -{" "}
                      {characterSpell.spell.duration}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => castSpell(characterSpell)}
                    disabled={!canCast}
                  >
                    Conjurar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => togglePrepared(characterSpell)}>
                    {characterSpell.prepared ? "Preparada" : "Preparar"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeSpell(characterSpell)}>
                    Remover
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SpellPicker({
  spells,
  search,
  levelFilter,
  cantripOnly = false,
  onSearchChange,
  onLevelChange,
  onAdd,
}: {
  spells: Spell[];
  search: string;
  levelFilter: string;
  cantripOnly?: boolean;
  onSearchChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onAdd: (spellId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar magia..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="max-w-xs"
        />
        {cantripOnly ? (
          <span className="flex h-8 items-center rounded-lg border border-border/60 px-2.5 text-xs text-muted-foreground">
            Truques
          </span>
        ) : (
          <select
            value={levelFilter}
            onChange={(event) => onLevelChange(event.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="Todos">Todos</option>
            <option value="0">Truques</option>
            {Array.from({ length: 9 }, (_, index) => (
              <option key={index + 1} value={String(index + 1)}>
                Nivel {index + 1}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {spells.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma magia disponivel.</p>
        ) : (
          spells.map((spell) => {
            const SpellIcon = getSpellIcon(spell.school);
            return (
              <button
                key={spell.id}
                type="button"
                onClick={() => onAdd(spell.id)}
                className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-left hover:bg-accent"
              >
                <SpellIcon className="h-6 w-6 shrink-0 text-primary" />
                <div className="flex flex-col">
                  <span className="font-medium">{spell.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {translateSchool(spell.school)} - {spell.level === 0 ? "truque" : `nivel ${spell.level}`} -{" "}
                    {spell.range}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
