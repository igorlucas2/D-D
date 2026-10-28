"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Send, Sparkles } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { CharacterHud } from "@/components/table/character-hud";
import { Chronicle, type ChronicleEvent } from "@/components/table/chronicle";
import { ItemUseDialog } from "@/components/table/item-use-dialog";
import { MechanicalActionDialog } from "@/components/table/mechanical-action-dialog";
import { SpellDialog, type SpellCastInput } from "@/components/table/spell-dialog";
import {
  WeaponAttackDialog,
  type WeaponAttackInput,
} from "@/components/table/weapon-attack-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { CombatEncounter } from "@/lib/types";
import type {
  ActionTarget,
  CombatActionKind,
  CombatActionResult,
  HudCharacter,
  ItemUseResult,
  MechanicalActionInput,
  SpellCastResult,
  DeathSaveResult,
  TableActionResult,
  WeaponAttackResult,
} from "@/lib/table-types";
import { useStoryUpdates } from "@/lib/use-story-updates";
import { useAuthStore } from "@/stores/auth-store";

type AiMode = "OFF" | "COPILOT" | "AUTONOMOUS";

interface AiState {
  mode: AiMode;
  paused: boolean;
  revision: number;
  isMaster: boolean;
  storyReady: boolean;
  scene: {
    name: string;
    phase: string;
    gameMinute: number;
    weather: string;
  } | null;
  characters: HudCharacter[];
  events: ChronicleEvent[];
  provider: { available: boolean; model: string; reason?: string };
}

interface AiTurnResult {
  eventId: string | null;
  narration: string;
  ask: string | null;
  memory: { summary: string; openQuestions: string[] } | null;
  alreadyApplied: boolean;
  persisted: boolean;
  model: string | null;
  latencyMs: number | null;
}

const textareaClassName =
  "min-h-32 w-full resize-y rounded-xl border border-input bg-background/50 px-3.5 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function AiMasterContent() {
  const params = useParams<{ id: string }>();
  const token = useAuthStore((store) => store.token);
  const [state, setState] = useState<AiState | null>(null);
  const [combat, setCombat] = useState<CombatEncounter | null>(null);
  const [actions, setActions] = useState<TableActionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [mechanicalBusy, setMechanicalBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKind, setDialogKind] = useState<CombatActionKind>("DAMAGE");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemBusy, setItemBusy] = useState(false);
  const [spellDialogOpen, setSpellDialogOpen] = useState(false);
  const [spellBusy, setSpellBusy] = useState(false);
  const [attackDialogOpen, setAttackDialogOpen] = useState(false);
  const [attackBusy, setAttackBusy] = useState(false);
  const [turnBusy, setTurnBusy] = useState(false);
  const [deathBusy, setDeathBusy] = useState(false);
  const [concentrationBusy, setConcentrationBusy] = useState(false);
  const [narratingActionId, setNarratingActionId] = useState<string | null>(
    null,
  );
  const [lastResult, setLastResult] = useState<TableActionResult | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [next, encounter, recentActions] = await Promise.all([
        api.get<AiState>(`/campaigns/${params.id}/ai-master/state`, token),
        api
          .get<CombatEncounter | null>(`/campaigns/${params.id}/combat`, token)
          .catch(() => null),
        api
          .get<TableActionResult[]>(
            `/campaigns/${params.id}/combat/actions?take=12`,
            token,
          )
          .catch(() => []),
      ]);
      setState(next);
      setCombat(encounter);
      setActions(recentActions);
      setSelectedId((current) => {
        if (current && next.characters.some((item) => item.id === current)) {
          return current;
        }
        return (
          next.characters.find((item) => item.isMine)?.id ??
          next.characters[0]?.id ??
          ""
        );
      });
      setError(null);
      return recentActions;
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar a mesa.",
      );
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [params.id, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da tela
    void load();
  }, [load]);

  useStoryUpdates(params.id, token, load);

  const selectedCharacter =
    state?.characters.find((character) => character.id === selectedId) ??
    state?.characters[0] ??
    null;

  const targets = useMemo<ActionTarget[]>(() => {
    if (!state) return [];
    const result: ActionTarget[] = [];
    const seenCharacters = new Set<string>();
    if (combat) {
      for (const participant of combat.participants) {
        if (participant.characterId) seenCharacters.add(participant.characterId);
        if (!state.isMaster && !participant.characterId) continue;
        const own = state.characters.find(
          (character) => character.characterId === participant.characterId,
        );
        if (!state.isMaster && !own?.isMine) continue;
        result.push({
          kind: "PARTICIPANT",
          id: participant.id,
          name: participant.name,
          characterId: participant.characterId,
          currentHp: participant.currentHp,
          maxHp: participant.maxHp,
          isAlly: participant.isAlly,
        });
      }
    }
    for (const character of state.characters) {
      if (seenCharacters.has(character.characterId)) continue;
      if (!state.isMaster && !character.isMine) continue;
      result.push({
        kind: "CHARACTER",
        id: character.characterId,
        name: character.name,
        characterId: character.characterId,
        currentHp: character.currentHp,
        maxHp: character.maxHp,
      });
    }
    return result;
  }, [state, combat]);

  const defaultTargetId =
    targets.find(
      (target) => target.characterId === selectedCharacter?.characterId,
    )?.id ??
    targets[0]?.id ??
    "";

  const spellTargets = useMemo<ActionTarget[]>(() => {
    if (!state) return [];
    const result: ActionTarget[] = [];
    const seenCharacters = new Set<string>();
    if (combat) {
      for (const participant of combat.participants) {
        if (participant.characterId) seenCharacters.add(participant.characterId);
        result.push({
          kind: "PARTICIPANT",
          id: participant.id,
          name: participant.name,
          characterId: participant.characterId,
          currentHp: participant.currentHp,
          maxHp: participant.maxHp,
          isAlly: participant.isAlly,
        });
      }
    }
    for (const character of state.characters) {
      if (seenCharacters.has(character.characterId)) continue;
      result.push({
        kind: "CHARACTER",
        id: character.characterId,
        name: character.name,
        characterId: character.characterId,
        currentHp: character.currentHp,
        maxHp: character.maxHp,
      });
    }
    return result;
  }, [state, combat]);

  const active =
    Boolean(state?.storyReady) &&
    state?.mode === "AUTONOMOUS" &&
    !state.paused;

  const narratedActionId =
    state?.events.find((event) => event.sourceActionId)?.sourceActionId ?? null;

  async function changeMode(mode: AiMode, paused: boolean) {
    if (!token || !state || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(
        `/campaigns/${params.id}/ai-master/settings`,
        { mode, paused, expectedRevision: state.revision },
        token,
      );
      setNotice(
        mode === "AUTONOMOUS" && !paused
          ? "Mestre IA ligado. A crônica está pronta."
          : "Configuração do mestre atualizada.",
      );
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível configurar o mestre IA.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submitNarration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !state || busy || !action.trim() || !selectedCharacter) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.post<AiTurnResult>(
        `/campaigns/${params.id}/ai-master/act`,
        {
          requestKey: crypto.randomUUID(),
          action: action.trim(),
          characterId: selectedCharacter.id,
          expectedRevision: state.revision,
        },
        token,
      );
      setAction("");
      if (result.ask) setNotice(`O mestre pergunta: ${result.ask}`);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "O mestre IA não conseguiu responder.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  function openAction(kind: CombatActionKind) {
    setDialogKind(kind);
    setDialogOpen(true);
  }

  async function submitMechanical(input: MechanicalActionInput) {
    if (!token || !state) return;
    setMechanicalBusy(true);
    setError(null);
    try {
      const result = await api.post<CombatActionResult>(
        `/campaigns/${params.id}/combat/actions`,
        {
          ...input,
          requestKey: crypto.randomUUID(),
          expectedRevision: combat?.revision,
        },
        token,
      );
      setLastResult(result);
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível aplicar a ação.",
      );
      await load();
    } finally {
      setMechanicalBusy(false);
    }
  }

  async function submitItemUse(inventoryItemId: string) {
    if (!token || !state || !selectedCharacter) return;
    setItemBusy(true);
    setError(null);
    try {
      const result = await api.post<ItemUseResult>(
        `/campaigns/${params.id}/combat/items/use`,
        {
          requestKey: crypto.randomUUID(),
          inventoryItemId,
          characterId: selectedCharacter.characterId,
          expectedRevision: combat?.revision,
        },
        token,
      );
      setLastResult(result);
      setItemDialogOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível usar o item.",
      );
      await load();
    } finally {
      setItemBusy(false);
    }
  }

  async function submitSpellCast(input: SpellCastInput) {
    if (!token || !state) return;
    setSpellBusy(true);
    setError(null);
    try {
      const result = await api.post<SpellCastResult>(
        `/campaigns/${params.id}/combat/spells/cast`,
        {
          ...input,
          requestKey: crypto.randomUUID(),
          expectedRevision: combat?.revision,
        },
        token,
      );
      setLastResult(result);
      setSpellDialogOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível conjurar a magia.",
      );
      await load();
    } finally {
      setSpellBusy(false);
    }
  }

  async function narrateAction(actionId: string) {
    if (!token || !state || narratingActionId) return;
    setNarratingActionId(actionId);
    setError(null);
    try {
      await api.post(
        `/campaigns/${params.id}/ai-master/narrate-action`,
        { actionId, requestKey: crypto.randomUUID() },
        token,
      );
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível narrar a consequência.",
      );
    } finally {
      setNarratingActionId(null);
    }
  }

  async function submitWeaponAttack(input: WeaponAttackInput) {
    if (!token || !state) return;
    setAttackBusy(true);
    setError(null);
    try {
      const result = await api.post<WeaponAttackResult>(
        `/campaigns/${params.id}/combat/attacks`,
        {
          ...input,
          requestKey: crypto.randomUUID(),
          expectedRevision: combat?.revision,
        },
        token,
      );
      setLastResult(result);
      setAttackDialogOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível atacar.",
      );
      await load();
    } finally {
      setAttackBusy(false);
    }
  }

  async function endTurn() {
    if (!token || turnBusy) return;
    setTurnBusy(true);
    setError(null);
    try {
      await api.post(
        `/campaigns/${params.id}/combat/end-turn`,
        undefined,
        token,
      );
      const recent = await load();
      const latest = recent?.[0];
      if (latest?.kind === "DEATH_SAVE") setLastResult(latest);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível encerrar o turno.",
      );
      await load();
    } finally {
      setTurnBusy(false);
    }
  }

  async function rollDeathSave() {
    if (!token || deathBusy) return;
    setDeathBusy(true);
    setError(null);
    try {
      const result = await api.post<DeathSaveResult>(
        `/campaigns/${params.id}/combat/death-save`,
        { requestKey: crypto.randomUUID() },
        token,
      );
      setLastResult(result);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível rolar a salvaguarda contra morte.",
      );
      await load();
    } finally {
      setDeathBusy(false);
    }
  }

  async function endConcentration() {
    if (!token || !selectedCharacter || concentrationBusy) return;
    setConcentrationBusy(true);
    setError(null);
    try {
      await api.post(
        `/campaigns/${params.id}/combat/concentration/end`,
        { characterId: selectedCharacter.characterId },
        token,
      );
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível encerrar a concentração.",
      );
      await load();
    } finally {
      setConcentrationBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-16">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="h-96 animate-pulse rounded-2xl bg-muted/70" />
          <div className="h-80 animate-pulse rounded-2xl bg-muted/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,rgba(120,92,54,0.08),transparent_55%)]">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href={`/campaigns/${params.id}`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowLeft className="size-3.5" /> Voltar para a mesa
              </Link>
              <p className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                <Sparkles className="size-3.5" /> Mesa narrada
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                  A crônica continua
                </h1>
                {state?.scene ? (
                  <p className="text-sm text-muted-foreground">
                    {state.scene.name} · {state.scene.phase.toLowerCase()}
                  </p>
                ) : null}
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Leia a narração na coluna principal. Use o HUD ao lado para
                aplicar dano, cura, PV temporário ou condições — o motor
                calcula, o mestre narra.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap justify-end gap-2">
                <Badge variant={active ? "default" : "outline"}>
                  {state?.mode === "AUTONOMOUS"
                    ? state.paused
                      ? "Pausado"
                      : "Autônomo"
                    : state?.mode === "COPILOT"
                      ? "Copiloto"
                      : "Desligado"}
                </Badge>
                <Badge variant="outline">
                  {state?.provider.available
                    ? state.provider.model
                    : "Modelo indisponível"}
                </Badge>
              </div>
              {state?.isMaster ? (
                <details className="relative">
                  <summary className="cursor-pointer list-none rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                    Controles do mestre
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 flex w-52 flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-xl">
                    <Button
                      size="sm"
                      onClick={() => void changeMode("AUTONOMOUS", false)}
                      disabled={busy}
                    >
                      Ligar mestre IA
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void changeMode("AUTONOMOUS", !state.paused)
                      }
                      disabled={busy || state.mode !== "AUTONOMOUS"}
                    >
                      {state.paused ? "Retomar" : "Pausar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void changeMode("OFF", false)}
                      disabled={busy}
                    >
                      Desligar
                    </Button>
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground/90">
              {notice}
            </p>
          ) : null}
          {!state?.provider.available ? (
            <p className="text-xs text-amber-300/80">
              O modelo local não está disponível; a mesa mecânica continua
              funcionando, mas a narração automática pode falhar.
            </p>
          ) : null}
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <main className="flex min-w-0 flex-col gap-5">
            <Chronicle
              events={state?.events ?? []}
              actions={actions}
              latestAction={lastResult}
              sceneName={state?.scene?.name ?? null}
              pending={busy}
              onNarrate={(actionId) => void narrateAction(actionId)}
              narratedActionId={narratedActionId}
              narratingActionId={narratingActionId}
            />

            <section
              aria-labelledby="composer-title"
              className="rounded-2xl border border-border/70 bg-card/65 p-5 shadow-sm backdrop-blur sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                    Sua vez
                  </p>
                  <h2
                    id="composer-title"
                    className="mt-1 font-heading text-xl font-semibold"
                  >
                    O que você faz?
                  </h2>
                </div>
                {selectedCharacter ? (
                  <Badge variant="outline">como {selectedCharacter.name}</Badge>
                ) : null}
              </div>

              <form onSubmit={submitNarration} className="mt-4 flex flex-col gap-3">
                <textarea
                  className={textareaClassName}
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                  placeholder="Descreva a ação, a fala ou a pergunta do seu personagem. O mestre lê a cena e responde na crônica."
                  maxLength={1000}
                  disabled={!active || busy}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-xl text-xs leading-5 text-muted-foreground">
                    {!state?.storyReady
                      ? "Inicie a memória do cenário antes de jogar."
                      : active
                        ? "A narração é registrada no diário público. Para dano/cura, use o HUD ao lado."
                        : "O mestre precisa estar em modo autônomo e sem pausa."}
                  </p>
                  <Button
                    type="submit"
                    disabled={
                      !active ||
                      busy ||
                      !action.trim() ||
                      !selectedCharacter
                    }
                    className="min-w-36"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Narrando...
                      </>
                    ) : (
                      <>
                        <Send className="size-4" /> Enviar ação
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </section>
          </main>

          <CharacterHud
            characters={state?.characters ?? []}
            selectedId={selectedCharacter?.id ?? ""}
            onSelect={setSelectedId}
            combat={combat}
            isMaster={Boolean(state?.isMaster)}
            busy={
              mechanicalBusy ||
              itemBusy ||
              spellBusy ||
              attackBusy ||
              turnBusy ||
              deathBusy ||
              concentrationBusy ||
              busy
            }
            onAction={openAction}
            onUseItem={() => setItemDialogOpen(true)}
            onCastSpell={() => setSpellDialogOpen(true)}
            onAttack={() => setAttackDialogOpen(true)}
            onEndTurn={() => void endTurn()}
            onDeathSave={() => void rollDeathSave()}
            onEndConcentration={() => void endConcentration()}
          />
        </div>
      </div>

      {dialogOpen ? (
        <MechanicalActionDialog
          open
          kind={dialogKind}
          targets={targets}
          defaultTargetId={defaultTargetId}
          busy={mechanicalBusy}
          onOpenChange={setDialogOpen}
          onSubmit={submitMechanical}
        />
      ) : null}

      {itemDialogOpen && selectedCharacter ? (
        <ItemUseDialog
          items={selectedCharacter.items}
          characterName={selectedCharacter.name}
          busy={itemBusy}
          onOpenChange={setItemDialogOpen}
          onUse={submitItemUse}
        />
      ) : null}

      {spellDialogOpen && selectedCharacter ? (
        <SpellDialog
          character={selectedCharacter}
          targets={spellTargets}
          busy={spellBusy}
          onOpenChange={setSpellDialogOpen}
          onCast={submitSpellCast}
        />
      ) : null}

      {attackDialogOpen && selectedCharacter ? (
        <WeaponAttackDialog
          character={selectedCharacter}
          targets={spellTargets}
          busy={attackBusy}
          onOpenChange={setAttackDialogOpen}
          onAttack={submitWeaponAttack}
        />
      ) : null}
    </div>
  );
}

export default function AiMasterPage() {
  return (
    <RequireAuth>
      <AiMasterContent />
    </RequireAuth>
  );
}
