"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { acquireVtt } from "@/lib/realtime-client";
import { abilityModifier } from "@/lib/character-rules";
import {
  HP_STATUS_LABELS,
  type CombatEncounter,
  type CombatHpDisplay,
  type CombatParticipant,
  type HpStatus,
  type Monster,
} from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import { ChevronRight, Minus, Plus, Swords, X } from "lucide-react";

interface CombatListen {
  connect: () => void;
  "table:combat": (payload: { encounter: CombatEncounter | null }) => void;
}

interface CombatSend {
  "vtt:join": (payload: { campaignId: string; presence?: boolean }) => void;
}

function hpBarColor(current: number, max: number) {
  if (max <= 0) return "bg-muted-foreground";
  const ratio = current / max;
  if (ratio <= 0.25) return "bg-destructive";
  if (ratio <= 0.5) return "bg-amber-500";
  return "bg-primary";
}

// Sem PV exato, a barra mostra só a faixa do estado: não revela mais que o rótulo.
const STATUS_BAR: Record<HpStatus, { width: number; color: string }> = {
  UNHURT: { width: 100, color: "bg-primary" },
  WOUNDED: { width: 70, color: "bg-primary" },
  BADLY_WOUNDED: { width: 40, color: "bg-amber-500" },
  NEAR_DEATH: { width: 12, color: "bg-destructive" },
  DOWN: { width: 0, color: "bg-muted-foreground" },
};

interface CombatPanelProps {
  campaignId: string;
  isMaster: boolean;
}

export function CombatPanel({ campaignId, isMaster }: CombatPanelProps) {
  const token = useAuthStore((state) => state.token);
  const [encounter, setEncounter] = useState<CombatEncounter | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const [startOpen, setStartOpen] = useState(false);
  const [encounterName, setEncounterName] = useState("");
  const [starting, setStarting] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [participantName, setParticipantName] = useState("");
  const [initiative, setInitiative] = useState("0");
  const [maxHp, setMaxHp] = useState("10");
  const [side, setSide] = useState("ally");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [selectedMonsterId, setSelectedMonsterId] = useState("");

  const [hpDelta, setHpDelta] = useState<Record<string, string>>({});
  const [conditionInput, setConditionInput] = useState<Record<string, string>>({});

  async function refresh() {
    if (!token) return;
    const data = await api.get<CombatEncounter | null>(`/campaigns/${campaignId}/combat`, token);
    setEncounter(data);
  }

  // Tempo real (MV-09): o servidor envia o combate já projetado para o papel de
  // quem recebe. Conexão auxiliar, sem contar presença na mesa.
  useEffect(() => {
    if (!token) return;
    const channel = acquireVtt<CombatListen, CombatSend>(token);
    channel.join(campaignId);
    let connectedBefore = false;
    channel.on("connect", () => {
      if (connectedBefore) {
        api.get<CombatEncounter | null>(`/campaigns/${campaignId}/combat`, token).then(setEncounter).catch(() => undefined);
      }
      connectedBefore = true;
    });
    channel.on("table:combat", (payload) => setEncounter(payload.encounter));
    return () => channel.close();
  }, [token, campaignId]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadEncounter() {
      try {
        const data = await api.get<CombatEncounter | null>(`/campaigns/${campaignId}/combat`, token);
        if (!cancelled) setEncounter(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Erro ao carregar combate.");
        }
      }
    }

    void loadEncounter();

    return () => {
      cancelled = true;
    };
  }, [token, campaignId]);

  useEffect(() => {
    if (!token || !isMaster) return;
    api
      .get<Monster[]>("/catalog/monsters", token)
      .then(setMonsters)
      .catch(() => undefined);
  }, [token, isMaster]);

  function handleSelectMonster(monsterId: string) {
    setSelectedMonsterId(monsterId);
    if (!monsterId) return;
    const monster = monsters.find((item) => item.id === monsterId);
    if (!monster) return;
    const roll = Math.floor(Math.random() * 20) + 1;
    setParticipantName(monster.name);
    setMaxHp(String(monster.maxHp));
    setInitiative(String(roll + abilityModifier(monster.dexterity)));
    setSide("enemy");
  }

  async function handleStart() {
    if (!token) return;
    setStarting(true);
    setError(null);
    try {
      await api.post(`/campaigns/${campaignId}/combat`, { name: encounterName || undefined }, token);
      setStartOpen(false);
      setEncounterName("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível iniciar o combate.");
    } finally {
      setStarting(false);
    }
  }

  async function handleEnd() {
    if (!token) return;
    await api.delete(`/campaigns/${campaignId}/combat`, token);
    await refresh();
  }

  async function handleNextTurn() {
    if (!token) return;
    await api.post(`/campaigns/${campaignId}/combat/next-turn`, undefined, token);
    await refresh();
  }

  async function handleAddParticipant() {
    if (!token) return;
    setAddError(null);
    setAdding(true);
    try {
      await api.post(
        `/campaigns/${campaignId}/combat/participants`,
        {
          name: participantName,
          initiative: Number(initiative) || 0,
          maxHp: Number(maxHp) || 1,
          isAlly: side === "ally",
        },
        token,
      );
      setAddOpen(false);
      setParticipantName("");
      setInitiative("0");
      setMaxHp("10");
      setSide("ally");
      setSelectedMonsterId("");
      await refresh();
    } catch (err) {
      setAddError(
        err instanceof ApiError ? err.message : "Não foi possível adicionar o participante.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveParticipant(participantId: string) {
    if (!token) return;
    await api.delete(`/campaigns/${campaignId}/combat/participants/${participantId}`, token);
    await refresh();
  }

  async function handleApplyHp(participant: CombatParticipant, sign: 1 | -1) {
    if (!token) return;
    const amount = Number(hpDelta[participant.id]);
    if (!amount || Number.isNaN(amount)) return;
    if (participant.currentHp === null || participant.maxHp === null) return;
    const next = participant.currentHp + sign * amount;
    await api.patch(
      `/campaigns/${campaignId}/combat/participants/${participant.id}`,
      { currentHp: Math.max(0, Math.min(next, participant.maxHp)) },
      token,
    );
    setHpDelta((prev) => ({ ...prev, [participant.id]: "" }));
    await refresh();
  }

  async function handleHpDisplay(hpDisplay: CombatHpDisplay) {
    if (!token) return;
    setError(null);
    try {
      const updated = await api.patch<CombatEncounter>(`/campaigns/${campaignId}/combat`, { hpDisplay, expectedRevision: encounter?.revision }, token);
      setEncounter(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível alterar a exibição de PV.");
    }
  }

  async function handleAddCondition(participant: CombatParticipant) {
    if (!token) return;
    const value = conditionInput[participant.id]?.trim();
    if (!value) return;
    await api.patch(
      `/campaigns/${campaignId}/combat/participants/${participant.id}`,
      { conditions: [...participant.conditions, value] },
      token,
    );
    setConditionInput((prev) => ({ ...prev, [participant.id]: "" }));
    await refresh();
  }

  async function handleRemoveCondition(participant: CombatParticipant, condition: string) {
    if (!token) return;
    await api.patch(
      `/campaigns/${campaignId}/combat/participants/${participant.id}`,
      { conditions: participant.conditions.filter((item) => item !== condition) },
      token,
    );
    await refresh();
  }

  if (encounter === undefined) {
    return (
      <Card>
        <CardHeader><CardTitle>Combate</CardTitle></CardHeader>
        <CardContent>
          {error ? (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={async () => {
                setError(null);
                try { await refresh(); }
                catch (err) { setError(err instanceof ApiError ? err.message : "Erro ao carregar combate."); }
              }}>Tentar novamente</Button>
            </div>
          ) : <p role="status" className="text-sm text-muted-foreground">Carregando combate...</p>}
        </CardContent>
      </Card>
    );
  }

  if (!encounter) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" /> Combate
          </CardTitle>
          <CardDescription>Nenhum combate em andamento nesta campanha.</CardDescription>
        </CardHeader>
        {isMaster ? (
          <CardContent>
            <Dialog open={startOpen} onOpenChange={setStartOpen}>
              <DialogTrigger render={<Button />}>Iniciar combate</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Iniciar combate</DialogTitle>
                  <DialogDescription>
                    Crie um rastreador de iniciativa para esta campanha.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="encounterName">Nome do combate (opcional)</Label>
                  <Input
                    id="encounterName"
                    value={encounterName}
                    onChange={(event) => setEncounterName(event.target.value)}
                    placeholder="Emboscada na floresta"
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <DialogFooter>
                  <Button onClick={handleStart} disabled={starting}>
                    {starting ? "Iniciando..." : "Iniciar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" /> {encounter.name}
          </CardTitle>
          <CardDescription>Rodada {encounter.round}</CardDescription>
          {isMaster ? (
            <div role="group" aria-label="PV dos inimigos para os jogadores" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">PV dos inimigos:</span>
              {(["DESCRIPTIVE", "NUMERIC"] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={encounter.hpDisplay === mode ? "default" : "outline"}
                  aria-pressed={encounter.hpDisplay === mode}
                  onClick={() => encounter.hpDisplay !== mode && void handleHpDisplay(mode)}
                >
                  {mode === "DESCRIPTIVE" ? "Descritivo" : "Numérico"}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        {isMaster ? (
          <div className="flex flex-wrap gap-2">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                Adicionar participante
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar participante</DialogTitle>
                  <DialogDescription>
                    Adicione um personagem, monstro ou NPC à ordem de iniciativa.
                  </DialogDescription>
                </DialogHeader>
                {monsters.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="monsterSelect">Adicionar do bestiário (opcional)</Label>
                    <select
                      id="monsterSelect"
                      value={selectedMonsterId}
                      onChange={(event) => handleSelectMonster(event.target.value)}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      <option value="">Personalizado</option>
                      {monsters.map((monster) => (
                        <option key={monster.id} value={monster.id}>
                          {monster.name} (CD {monster.challengeRating})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="participantName">Nome</Label>
                  <Input
                    id="participantName"
                    value={participantName}
                    onChange={(event) => setParticipantName(event.target.value)}
                    placeholder="Goblin batedor"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="participantInitiative">Iniciativa</Label>
                    <Input
                      id="participantInitiative"
                      type="number"
                      value={initiative}
                      onChange={(event) => setInitiative(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="participantHp">PV máximo</Label>
                    <Input
                      id="participantHp"
                      type="number"
                      min={1}
                      value={maxHp}
                      onChange={(event) => setMaxHp(event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="participantSide">Lado</Label>
                  <select
                    id="participantSide"
                    value={side}
                    onChange={(event) => setSide(event.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    <option value="ally">Aliado</option>
                    <option value="enemy">Inimigo</option>
                  </select>
                </div>
                {addError ? <p className="text-sm text-destructive">{addError}</p> : null}
                <DialogFooter>
                  <Button onClick={handleAddParticipant} disabled={adding || !participantName.trim()}>
                    {adding ? "Adicionando..." : "Adicionar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              onClick={handleNextTurn}
              disabled={encounter.participants.length === 0}
            >
              <ChevronRight className="h-4 w-4" /> Avançar turno
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={handleEnd}>
              Encerrar combate
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {encounter.participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum participante adicionado.</p>
        ) : (
          encounter.participants.map((participant, index) => {
            const isCurrent = index === encounter.turnIndex;
            const exactHp = participant.currentHp !== null && participant.maxHp !== null;
            const hpPercent = exactHp
              ? Math.max(0, Math.min(100, (participant.currentHp! / Math.max(participant.maxHp!, 1)) * 100))
              : STATUS_BAR[participant.hpStatus].width;
            const barColor = exactHp
              ? hpBarColor(participant.currentHp!, participant.maxHp!)
              : STATUS_BAR[participant.hpStatus].color;
            const statusLabel = HP_STATUS_LABELS[participant.hpStatus];

            return (
              <div
                key={participant.id}
                className={`flex flex-col gap-2 rounded-lg border px-3 py-2 ${
                  isCurrent ? "border-primary bg-primary/10" : "border-border/60"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Iniciativa {participant.initiative}</Badge>
                    <span className="font-medium">{participant.name}</span>
                    <Badge variant={participant.isAlly ? "secondary" : "destructive"}>
                      {participant.isAlly ? "Aliado" : "Inimigo"}
                    </Badge>
                    {isCurrent ? <Badge>Turno atual</Badge> : null}
                  </div>
                  {isMaster ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveParticipant(participant.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className={`h-full transition-all ${barColor}`} style={{ width: `${hpPercent}%` }} />
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {exactHp ? `${participant.currentHp}/${participant.maxHp}` : statusLabel}
                  </span>
                </div>
                {isMaster && !participant.isAlly && encounter.hpDisplay === "DESCRIPTIVE" ? (
                  <p className="text-xs text-muted-foreground">Jogadores veem: {statusLabel}</p>
                ) : null}

                {participant.conditions.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {participant.conditions.map((condition) => (
                      <Badge key={condition} variant="outline" className="gap-1">
                        {condition}
                        {isMaster ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveCondition(participant, condition)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        ) : null}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {isMaster ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Quantidade"
                      value={hpDelta[participant.id] ?? ""}
                      onChange={(event) =>
                        setHpDelta((prev) => ({ ...prev, [participant.id]: event.target.value }))
                      }
                      className="h-7 w-24"
                    />
                    <Button
                      size="icon-sm"
                      variant="outline"
                      title="Aplicar dano"
                      onClick={() => handleApplyHp(participant, -1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      title="Aplicar cura"
                      onClick={() => handleApplyHp(participant, 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      placeholder="Condição (ex: Envenenado)"
                      value={conditionInput[participant.id] ?? ""}
                      onChange={(event) =>
                        setConditionInput((prev) => ({ ...prev, [participant.id]: event.target.value }))
                      }
                      className="h-7 min-w-32 flex-1"
                    />
                    <Button size="sm" variant="outline" onClick={() => handleAddCondition(participant)}>
                      Adicionar condição
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
