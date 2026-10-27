"use client";

import Link from "next/link";
import {
  ExternalLink,
  HeartPulse,
  Shield,
  ShieldPlus,
  Sparkles,
  Swords,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CombatEncounter } from "@/lib/types";
import type { CombatActionKind, HudCharacter } from "@/lib/table-types";

const ACTIONS: Array<{
  kind: CombatActionKind;
  label: string;
  icon: typeof Swords;
  className: string;
}> = [
  {
    kind: "DAMAGE",
    label: "Dano",
    icon: Swords,
    className: "border-[#9d4f52]/35 bg-[#9d4f52]/10 hover:bg-[#9d4f52]/20",
  },
  {
    kind: "HEAL",
    label: "Cura",
    icon: HeartPulse,
    className: "border-[#5f8a62]/35 bg-[#5f8a62]/10 hover:bg-[#5f8a62]/20",
  },
  {
    kind: "TEMP_HP",
    label: "PV temp.",
    icon: ShieldPlus,
    className: "border-[#5e7e9f]/35 bg-[#5e7e9f]/10 hover:bg-[#5e7e9f]/20",
  },
  {
    kind: "CONDITION",
    label: "Condição",
    icon: Sparkles,
    className: "border-[#9b7b49]/35 bg-[#9b7b49]/10 hover:bg-[#9b7b49]/20",
  },
];

function barColor(ratio: number) {
  if (ratio <= 0.25) return "bg-[#b65c61]";
  if (ratio <= 0.5) return "bg-[#b58a4e]";
  return "bg-[#6f9a73]";
}

export function CharacterHud({
  characters,
  selectedId,
  onSelect,
  combat,
  isMaster,
  busy,
  onAction,
}: {
  characters: HudCharacter[];
  selectedId: string;
  onSelect: (characterId: string) => void;
  combat: CombatEncounter | null;
  isMaster: boolean;
  busy: boolean;
  onAction: (kind: CombatActionKind) => void;
}) {
  const options = isMaster
    ? characters
    : characters.filter((character) => character.isMine);
  const character =
    options.find((item) => item.id === selectedId) ?? options[0] ?? null;
  const participant = character
    ? combat?.participants.find(
        (item) => item.characterId === character.characterId,
      )
    : null;
  const currentTurn = combat?.participants[combat.turnIndex] ?? null;
  const isMyTurn = Boolean(
    participant && currentTurn && currentTurn.id === participant.id,
  );
  const ratio = character
    ? Math.max(0, Math.min(1, character.currentHp / Math.max(character.maxHp, 1)))
    : 0;

  return (
    <aside aria-label="HUD do personagem" className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/75 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.85)] backdrop-blur">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" aria-hidden="true" />
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.18em]">
              Seu personagem
            </h2>
          </div>
          {character ? (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              className="h-7 px-2 text-[11px] text-muted-foreground"
              render={<Link href={`/characters/${character.characterId}`} />}
            >
              Ficha <ExternalLink className="size-3" />
            </Button>
          ) : null}
        </div>

        {character ? (
          <div className="p-4">
            {options.length > 1 ? (
              <label className="mb-4 flex flex-col gap-1 text-[11px] text-muted-foreground">
                Personagem
                <select
                  className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground dark:bg-input/30"
                  value={character.id}
                  onChange={(event) => onSelect(event.target.value)}
                >
                  {options.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="flex items-baseline justify-between gap-2">
              <h3 className="truncate font-heading text-xl font-semibold">
                {character.name}
              </h3>
              <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                CA {character.armorClass}
              </Badge>
            </div>

            <div className="mt-4">
              <div className="flex items-end justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Pontos de vida
                </p>
                <p className="font-mono text-sm text-foreground">
                  {character.currentHp}
                  <span className="text-muted-foreground">/{character.maxHp}</span>
                  {character.tempHp > 0 ? (
                    <span className="ml-2 text-[#9fc0df]">
                      +{character.tempHp}
                    </span>
                  ) : null}
                </p>
              </div>
              <div
                role="progressbar"
                aria-label="Pontos de vida"
                aria-valuemin={0}
                aria-valuemax={character.maxHp}
                aria-valuenow={character.currentHp}
                className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={`h-full rounded-full transition-[width] ${barColor(ratio)}`}
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Condições
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {character.conditions.length ? (
                  character.conditions.slice(0, 6).map((condition) => (
                    <Badge key={condition} variant="outline" className="text-[10px]">
                      {condition}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Nenhuma condição ativa
                  </span>
                )}
                {character.conditions.length > 6 ? (
                  <Badge variant="outline" className="text-[10px]">
                    +{character.conditions.length - 6}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.kind}
                    type="button"
                    variant="outline"
                    className={`h-10 justify-start gap-2 text-xs ${action.className}`}
                    onClick={() => onAction(action.kind)}
                    disabled={busy}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhum personagem disponível nesta campanha.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/55 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Combate
          </p>
          {combat ? (
            <Badge variant={isMyTurn ? "default" : "outline"} className="text-[10px]">
              {isMyTurn ? "Seu turno" : `Rodada ${combat.round}`}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Fora de combate
            </Badge>
          )}
        </div>
        {combat ? (
          <div className="mt-3 text-sm">
            <p className="font-medium text-foreground">
              {currentTurn?.name ?? "Sem turno ativo"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {combat.name} · {combat.participants.length} participantes
            </p>
            {participant ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Iniciativa {participant.initiative}
                {participant.tempHp ? ` · ${participant.tempHp} PV temp.` : ""}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            As ações do HUD funcionam mesmo fora de combate; condições exigem um
            combate ativo.
          </p>
        )}
      </section>
    </aside>
  );
}
