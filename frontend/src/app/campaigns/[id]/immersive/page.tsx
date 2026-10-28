"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Compass,
  HeartPulse,
  MapPin,
  Plus,
  RefreshCw,
  ScrollText,
  Swords,
  Trash2,
  Users,
} from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { CombatPanel } from "@/components/campaigns/combat-panel";
import {
  WeaponAttackDialog,
  type WeaponAttackInput,
} from "@/components/table/weapon-attack-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { Campaign, Character, CombatEncounter, VttMap } from "@/lib/types";
import type { ActionTarget, HudCharacter } from "@/lib/table-types";
import { useAuthStore } from "@/stores/auth-store";

const LIVE_SLUG: Record<string, string> = {
  Prontera: "prontera",
  Izlude: "izlude",
  Alberta: "alberta",
  Geffen: "geffen",
  Payon: "payon",
  Morroc: "morocc",
  "Al De Baran": "aldebaran",
  Comodo: "comodo",
  Juno: "yuno",
  Umbala: "umbala",
  Niflheim: "niflheim",
  "Glast Heim": "glast_01",
  "Torre do Relógio": "c_tower1",
  "Caverna de Payon": "pay_dun00",
  "Campos de Prontera": "prt_fild01",
  "Floresta de Payon": "pay_fild01",
  "Deserto de Morroc": "moc_fild01",
  "Pântano de Comodo": "cmd_fild01",
  "Campos de Geffen": "gef_fild01",
  "Minas de Glast Heim": "gl_dun01",
  "Estrada de Juno": "yuno_fild01",
  "Passo de Moscóvia": "xmas",
};

const NPC_IMAGES = [
  "https://assets.latam-tools.com.br/image?job=1&action=0&frame=0",
  "https://assets.latam-tools.com.br/image?job=2&action=0&frame=0",
  "https://assets.latam-tools.com.br/image?job=1002&action=0&frame=0",
];

const AMBIENT: Record<
  string,
  Array<{ name: string; x: number; y: number; job: number }>
> = {
  Prontera: [
    { name: "Guarda de Prata", x: 0.46, y: 0.51, job: 1 },
    { name: "Pregoeiro", x: 0.54, y: 0.47, job: 2 },
    { name: "Cidadã", x: 0.51, y: 0.55, job: 0 },
  ],
  Geffen: [
    { name: "Aprendiz da Torre", x: 0.48, y: 0.5, job: 1 },
    { name: "Boticário", x: 0.53, y: 0.47, job: 2 },
  ],
  Payon: [
    { name: "Caçador", x: 0.47, y: 0.53, job: 1 },
    { name: "Guarda do Bosque", x: 0.54, y: 0.48, job: 2 },
  ],
  Morroc: [
    { name: "Mercador de Água", x: 0.46, y: 0.51, job: 1 },
    { name: "Guia do Deserto", x: 0.54, y: 0.49, job: 2 },
  ],
  Juno: [
    { name: "Escriba", x: 0.42, y: 0.5, job: 1 },
    { name: "Sábio", x: 0.58, y: 0.45, job: 2 },
  ],
  Comodo: [
    { name: "Pescador", x: 0.48, y: 0.55, job: 1 },
    { name: "Músico", x: 0.54, y: 0.47, job: 2 },
  ],
};

interface PartyCharacter {
  id: string;
  characterId: string;
  name: string;
  currentHp: number;
  maxHp: number;
  conditions: string[];
}

interface PartyState {
  scene: { name: string } | null;
  characters: PartyCharacter[];
  events: Array<{
    sequence: number;
    summary: string;
    narration?: string | null;
  }>;
}

interface ImmersiveWindow extends Window {
  __eldoria?: {
    setActors: (
      actors: Array<{
        id: string;
        x: number;
        y: number;
        imageUrl: string;
        size?: number;
      }>,
    ) => void;
    setLocked: (locked: boolean) => void;
    hidePlayer: () => void;
    isReady: () => boolean;
    getPlayerPosition: () => { x: number; y: number } | null;
    setPlayerCell: (
      x: number,
      y: number,
      mapWidth: number,
      mapHeight: number,
    ) => void;
    onActorClick?: (id: string) => void;
    setRange: (
      x: number | null,
      y: number | null,
      cells: number,
      mapWidth: number,
      mapHeight: number,
    ) => void;
    setSelectedActor: (id: string | null) => void;
  };
}

type SideTab = "party" | "chronicle" | "combat" | "npc";

function frameCss() {
  return `
    body *:not(canvas):not(#eldoria-lock) { visibility: hidden !important; }
    body canvas { visibility: visible !important; }
    #eldoria-lock { visibility: visible !important; }
  `;
}

function ImmersiveContent() {
  const params = useParams<{ id: string }>();
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [maps, setMaps] = useState<VttMap[]>([]);
  const [myCharacter, setMyCharacter] = useState<Character | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [party, setParty] = useState<PartyState | null>(null);
  const [combat, setCombat] = useState<CombatEncounter | null>(null);
  const combatActive = Boolean(combat);
  const [tab, setTab] = useState<SideTab>("party");
  const [error, setError] = useState<string | null>(null);
  const [npcName, setNpcName] = useState("");
  const [npcX, setNpcX] = useState("10");
  const [npcY, setNpcY] = useState("10");
  const [npcJob, setNpcJob] = useState("0");
  const [busy, setBusy] = useState(false);
  const [attackOpen, setAttackOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const iframe = useRef<HTMLIFrameElement>(null);
  const lastSentPosition = useRef("");
  const lastCombatTurn = useRef("");

  const selected = maps.find((map) => map.id === selectedId) ?? null;
  const slug = selected ? (LIVE_SLUG[selected.name] ?? null) : null;
  const buildCode = useMemo(() => {
    const raw = myCharacter?.appearance;
    if (!raw) return null;
    try {
      const url = new URL(raw);
      if (url.hostname !== "visuais.latam-tools.com.br") return null;
      return url.searchParams.get("b");
    } catch {
      return null;
    }
  }, [myCharacter]);
  const frameSrc = slug
    ? `/immersive/index.html${buildCode ? `?b=${encodeURIComponent(buildCode)}` : ""}#play/${slug}`
    : null;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [campaignData, mapData, partyData, charactersData] =
        await Promise.all([
          api.get<Campaign>(`/campaigns/${params.id}`, token),
          api.get<VttMap[]>(`/campaigns/${params.id}/vtt/maps`, token),
          api.get<PartyState>(`/campaigns/${params.id}/ai-master/state`, token),
          api.get<Character[]>("/characters", token),
        ]);
      setCampaign(campaignData);
      setMaps(mapData);
      setParty(partyData);
      const primary = charactersData[0] ?? null;
      if (primary) {
        try {
          setMyCharacter(
            await api.get<Character>(`/characters/${primary.id}`, token),
          );
        } catch {
          setMyCharacter(primary);
        }
      } else {
        setMyCharacter(null);
      }
      setSelectedId((current) => {
        if (current && mapData.some((map) => map.id === current))
          return current;
        const scene = partyData.scene?.name ?? "";
        return (
          mapData.find((map) => scene.includes(map.name))?.id ??
          mapData.find((map) => LIVE_SLUG[map.name])?.id ??
          null
        );
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao carregar a mesa.",
      );
    }
  }, [params.id, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da mesa
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(async () => {
      try {
        const encounter = await api.get<CombatEncounter | null>(
          `/campaigns/${params.id}/combat`,
          token,
        );
        setCombat(encounter);
      } catch {
        // sem combate
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [params.id, token]);

  const npcTokens = useMemo(
    () =>
      (selected?.tokens ?? []).filter(
        (token) => !token.characterId && token.visible,
      ),
    [selected],
  );

  const otherPlayerTokens = useMemo(
    () =>
      (selected?.tokens ?? []).filter(
        (entry) =>
          entry.characterId &&
          entry.characterId !== myCharacter?.id &&
          entry.visible,
      ),
    [myCharacter?.id, selected],
  );

  const actors = useMemo(() => {
    if (!selected) return [];
    if (combat) {
      const byCharacter = new Map(
        selected.tokens
          .filter((entry) => entry.characterId)
          .map((entry) => [entry.characterId, entry]),
      );
      const currentId = combat.participants[combat.turnIndex]?.id;
      const ownId = myCharacter
        ? combat.participants.find(
            (participant) => participant.characterId === myCharacter.id,
          )?.id
        : null;
      return combat.participants
        .filter((participant) => participant.id !== ownId)
        .map((participant, index) => {
          const entry = participant.characterId
            ? byCharacter.get(participant.characterId)
            : null;
          const isCurrent = participant.id === currentId;
          return {
            id: `combat-${participant.id}`,
            x:
              participant.x != null
                ? (participant.x + 0.5) / selected.width
                : entry
                  ? (entry.x + 0.5) / selected.width
                  : 0.48 + (index % 2) * 0.035,
            y:
              participant.y != null
                ? (participant.y + 0.5) / selected.height
                : entry
                  ? (entry.y + 0.5) / selected.height
                  : 0.47 + Math.floor(index / 2) * 0.035,
            imageUrl: entry?.imageUrl ?? NPC_IMAGES[participant.isAlly ? 0 : 2],
            size: isCurrent ? 2.5 : 2,
          };
        });
    }
    const tokens = npcTokens.map((npc) => ({
      id: npc.id,
      x: (npc.x + 0.5) / selected.width,
      y: (npc.y + 0.5) / selected.height,
      imageUrl: npc.imageUrl ?? NPC_IMAGES[2],
      size: 1.8,
    }));
    const players = otherPlayerTokens.map((entry) => ({
      id: entry.id,
      x: (entry.x + 0.5) / selected.width,
      y: (entry.y + 0.5) / selected.height,
      imageUrl: entry.imageUrl ?? NPC_IMAGES[0],
      size: 1.8,
    }));
    const ambient = (
      AMBIENT[selected.name] ?? [
        { name: "Morador", x: 0.48, y: 0.55, job: 0 },
        { name: "Viajante", x: 0.58, y: 0.45, job: 1 },
      ]
    ).map((npc, index) => ({
      id: `ambient-${selected.id}-${index}`,
      x: npc.x,
      y: npc.y,
      imageUrl: NPC_IMAGES[npc.job] ?? NPC_IMAGES[0],
      size: 1.7,
    }));
    return [...tokens, ...players, ...ambient];
  }, [combat, myCharacter, npcTokens, otherPlayerTokens, selected]);

  const myCombatTurn = Boolean(
    combat &&
    myCharacter &&
    combat.participants[combat.turnIndex]?.characterId === myCharacter.id,
  );

  const applyFrame = useCallback(() => {
    const win = iframe.current?.contentWindow as ImmersiveWindow | null;
    const doc = iframe.current?.contentDocument;
    if (!win || !doc) return false;
    if (!win.__eldoria) return false;
    if (!win.__eldoria.isReady()) return false;
    if (!doc.getElementById("eldoria-immersive-frame-style")) {
      const style = doc.createElement("style");
      style.id = "eldoria-immersive-frame-style";
      style.textContent = frameCss();
      doc.head.appendChild(style);
    }
    win.__eldoria.setActors(actors);
    win.__eldoria.setLocked(combatActive && !myCombatTurn);
    return true;
  }, [actors, combatActive, myCombatTurn]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (cancelled) return;
      if (applyFrame()) {
        setFrameReady(true);
        window.clearInterval(timer);
      }
    }, 500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [slug, applyFrame]);

  useEffect(() => {
    if (!frameReady) return;
    const win = iframe.current?.contentWindow as ImmersiveWindow | null;
    if (!win?.__eldoria) return;
    // eslint-disable-next-line react-hooks/immutability -- ponte intencional com o iframe same-origin
    win.__eldoria.onActorClick = (id) => {
      setSelectedTargetId(id.startsWith("combat-") ? id.slice(7) : id);
    };
    return () => {
      if (win.__eldoria) win.__eldoria.onActorClick = undefined;
    };
  }, [frameReady]);

  useEffect(() => {
    if (!frameReady) return;
    const win = iframe.current?.contentWindow as ImmersiveWindow | null;
    if (!win?.__eldoria) return;
    const current = combat?.participants[combat.turnIndex];
    if (
      !combat ||
      !selected ||
      !current ||
      current.x == null ||
      current.y == null
    ) {
      win.__eldoria.setRange(null, null, 0, 1, 1);
      return;
    }
    const remainingCells = Math.max(
      0,
      Math.floor(((current.speed ?? 30) - (current.movementUsed ?? 0)) / 5),
    );
    win.__eldoria.setRange(
      current.x,
      current.y,
      remainingCells,
      selected.width,
      selected.height,
    );
  }, [combat, frameReady, selected]);

  useEffect(() => {
    if (!frameReady) return;
    const win = iframe.current?.contentWindow as ImmersiveWindow | null;
    win?.__eldoria?.setSelectedActor(
      selectedTargetId ? `combat-${selectedTargetId}` : null,
    );
  }, [frameReady, selectedTargetId]);

  useEffect(() => {
    if (!frameReady) return;
    applyFrame();
  }, [frameReady, applyFrame]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(timer);
  }, [load, token]);

  useEffect(() => {
    if (!frameReady || !myCharacter || !selected || !token) return;
    let cancelled = false;

    const send = async () => {
      const win = iframe.current?.contentWindow as ImmersiveWindow | null;
      const position = win?.__eldoria?.getPlayerPosition?.();
      if (!position) return;
      const x = Math.max(
        0,
        Math.min(selected.width - 1, Math.floor(position.x * selected.width)),
      );
      const y = Math.max(
        0,
        Math.min(selected.height - 1, Math.floor(position.y * selected.height)),
      );

      if (combat) {
        if (!myCombatTurn) return;
        const current = combat.participants[combat.turnIndex];
        if (!current || (current.x === x && current.y === y)) return;
        if (current.x != null && current.y != null) {
          const distance =
            Math.max(Math.abs(current.x - x), Math.abs(current.y - y)) * 5;
          const remaining = (current.speed ?? 30) - (current.movementUsed ?? 0);
          if (distance > remaining) {
            win?.__eldoria?.setPlayerCell(
              current.x,
              current.y,
              selected.width,
              selected.height,
            );
            lastSentPosition.current = "";
            setError(
              `Movimento insuficiente: restam ${remaining} pés para este turno.`,
            );
            return;
          }
        }
        const key = `combat:${combat.id}:${current.id}:${x}:${y}`;
        if (lastSentPosition.current === key) return;
        lastSentPosition.current = key;
        if (cancelled) return;
        try {
          const updated = await api.patch<CombatEncounter>(
            `/campaigns/${params.id}/combat/participants/${current.id}/move`,
            { x, y },
            token,
          );
          setCombat(updated);
        } catch (err) {
          if (current.x != null && current.y != null) {
            win?.__eldoria?.setPlayerCell(
              current.x,
              current.y,
              selected.width,
              selected.height,
            );
          }
          lastSentPosition.current = "";
          setError(
            err instanceof ApiError
              ? err.message
              : "Movimento recusado pelo mestre.",
          );
        }
        return;
      }

      const key = `${myCharacter.id}:${selected.id}:${x}:${y}`;
      if (lastSentPosition.current === key) return;
      lastSentPosition.current = key;
      if (cancelled) return;
      try {
        await api.put(
          `/campaigns/${params.id}/vtt/maps/${selected.id}/tokens/me`,
          { characterId: myCharacter.id, x, y },
          token,
        );
      } catch {
        // posição será tentada de novo no próximo segundo
      }
    };

    void send();
    const timer = window.setInterval(() => void send(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    combat,
    frameReady,
    myCharacter,
    myCombatTurn,
    params.id,
    selected,
    token,
  ]);

  useEffect(() => {
    if (!frameReady || !combat || !myCombatTurn || !selected) return;
    const current = combat.participants[combat.turnIndex];
    if (!current || current.x == null || current.y == null) return;
    const key = `${combat.id}:${combat.turnIndex}:${current.id}`;
    if (lastCombatTurn.current === key) return;
    lastCombatTurn.current = key;
    const win = iframe.current?.contentWindow as ImmersiveWindow | null;
    win?.__eldoria?.setPlayerCell(
      current.x,
      current.y,
      selected.width,
      selected.height,
    );
  }, [combat, frameReady, myCombatTurn, selected]);

  async function summonNpc() {
    if (!token || !selected || !campaign?.masterId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/campaigns/${params.id}/vtt/maps/${selected.id}/tokens`,
        {
          name: npcName.trim() || "NPC",
          x: Number(npcX) || 0,
          y: Number(npcY) || 0,
          imageUrl: NPC_IMAGES[Number(npcJob)] ?? NPC_IMAGES[0],
          color: "#c28b45",
          visible: true,
        },
        token,
      );
      setNpcName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao invocar NPC.");
    } finally {
      setBusy(false);
    }
  }

  async function moveNpc(id: string, x: number, y: number) {
    if (!token || !selected) return;
    try {
      await api.patch(
        `/campaigns/${params.id}/vtt/maps/${selected.id}/tokens/${id}`,
        { x, y },
        token,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao mover NPC.");
    }
  }

  async function removeNpc(id: string) {
    if (!token || !selected) return;
    try {
      await api.delete(
        `/campaigns/${params.id}/vtt/maps/${selected.id}/tokens/${id}`,
        token,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao remover NPC.");
    }
  }

  async function advanceTurn() {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.post<CombatEncounter>(
        `/campaigns/${params.id}/combat/next-turn`,
        undefined,
        token,
      );
      setCombat(updated);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao avançar o turno.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function moveCurrentCombatant(dx: number, dy: number) {
    if (!token || !selected || !currentCombatant || busy) return;
    const fromX = currentCombatant.x ?? Math.floor(selected.width * 0.48);
    const fromY = currentCombatant.y ?? Math.floor(selected.height * 0.47);
    const x = Math.max(0, Math.min(selected.width - 1, fromX + dx));
    const y = Math.max(0, Math.min(selected.height - 1, fromY + dy));
    if (x === fromX && y === fromY) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<CombatEncounter>(
        `/campaigns/${params.id}/combat/participants/${currentCombatant.id}/move`,
        { x, y },
        token,
      );
      setCombat(updated);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao mover no combate.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitAttack(input: WeaponAttackInput) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/campaigns/${params.id}/combat/attacks`,
        { ...input, requestKey: crypto.randomUUID() },
        token,
      );
      setAttackOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao atacar.");
    } finally {
      setBusy(false);
    }
  }

  const hudCharacter = useMemo<HudCharacter | null>(() => {
    if (!myCharacter) return null;
    return {
      id: myCharacter.id,
      characterId: myCharacter.id,
      name: myCharacter.name,
      isMine: true,
      currentHp: myCharacter.currentHp,
      maxHp: myCharacter.maxHp,
      tempHp: myCharacter.tempHp,
      armorClass: myCharacter.armorClass,
      conditions: [],
      conditionTimers: [],
      concentration: null,
      items: (myCharacter.inventory ?? []).map((entry) => ({
        inventoryItemId: entry.id,
        itemId: entry.itemId,
        name: entry.item.name,
        quantity: entry.quantity,
        category: /weapon|arma/i.test(entry.item.category)
          ? "Arma"
          : entry.item.category,
        properties: entry.item.properties,
        description: entry.item.description,
        effectKind: null,
      })),
      spells: [],
      spellSlots: [],
    };
  }, [myCharacter]);

  const combatTargets = useMemo<ActionTarget[]>(
    () =>
      (combat?.participants ?? []).map((participant) => ({
        kind: "PARTICIPANT",
        id: participant.id,
        name: participant.name,
        characterId: participant.characterId,
        currentHp: participant.currentHp,
        maxHp: participant.maxHp,
        isAlly: participant.isAlly,
      })),
    [combat?.participants],
  );

  const isMaster = campaign?.masterId === currentUserId;
  const currentCombatant = combat?.participants[combat.turnIndex] ?? null;
  const canMoveCurrent =
    Boolean(currentCombatant) &&
    (isMaster ||
      (Boolean(myCharacter) &&
        currentCombatant?.characterId === myCharacter?.id));
  const canAttackCurrent =
    Boolean(hudCharacter && currentCombatant) &&
    currentCombatant?.characterId === myCharacter?.id;

  return (
    <main className="fixed inset-x-0 bottom-0 top-[4.25rem] overflow-hidden bg-[#171816]">
      {selected && slug ? (
        <iframe
          key={`${selected.id}-${buildCode ?? "default"}`}
          ref={iframe}
          src={frameSrc ?? undefined}
          title={`Mapa imersivo: ${selected.name}`}
          className="absolute inset-0 h-full w-full border-0"
          allow="fullscreen; autoplay"
        />
      ) : (
        <div className="grid h-full place-items-center text-muted-foreground">
          Nenhum mapa 3D disponível nesta campanha.
        </div>
      )}

      <header className="absolute left-3 right-3 top-3 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-card/90 p-2 shadow-xl backdrop-blur">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          nativeButton={false}
          render={<Link href={`/campaigns/${params.id}`} />}
        >
          <ArrowLeft className="size-4" /> Mesa
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm">
            {campaign?.name ?? "Mesa imersiva"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {party?.scene?.name ?? "Exploração"} ·{" "}
            {combatActive ? "combate em turnos" : "movimento livre"}
          </p>
        </div>
        <select
          aria-label="Mapa imersivo"
          className="h-9 max-w-44 rounded-md border border-input bg-background px-2 text-xs"
          value={selectedId ?? ""}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setFrameReady(false);
          }}
        >
          {maps
            .filter((map) => LIVE_SLUG[map.name])
            .map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
        </select>
        <Badge
          variant={combatActive ? "default" : "outline"}
          className="gap-1 text-[10px]"
        >
          {combatActive ? (
            <Swords className="size-3" />
          ) : (
            <Compass className="size-3" />
          )}
          {combatActive ? "Turnos" : "Livre"}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => void load()}
        >
          <RefreshCw className="size-3.5" /> Atualizar
        </Button>
        <Button
          size="sm"
          className="gap-1"
          nativeButton={false}
          render={<Link href={`/campaigns/${params.id}/play`} />}
        >
          <ScrollText className="size-4" /> Crônica
        </Button>
      </header>

      {combat ? (
        <section className="absolute left-3 top-20 z-30 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-primary/40 bg-card/94 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
            <div>
              <p className="font-heading text-sm">
                Combate · rodada {combat.round}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {currentCombatant
                  ? `Turno de ${currentCombatant.name}`
                  : "Aguardando participantes"}
              </p>
            </div>
            <Swords className="size-4 text-primary" aria-hidden="true" />
          </div>
          <ol className="max-h-72 space-y-0.5 overflow-y-auto p-2">
            {combat.participants.map((participant, index) => {
              const isCurrent = index === combat.turnIndex;
              const current = combat.participants[combat.turnIndex];
              const feet =
                current?.x != null &&
                current.y != null &&
                participant.x != null &&
                participant.y != null
                  ? Math.max(
                      Math.abs(current.x - participant.x),
                      Math.abs(current.y - participant.y),
                    ) * 5
                  : null;
              return (
                <li
                  key={participant.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTargetId(participant.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedTargetId(participant.id);
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                    isCurrent ? "bg-primary/15 ring-1 ring-primary/40" : ""
                  } ${
                    selectedTargetId === participant.id
                      ? "ring-2 ring-amber-400/80"
                      : ""
                  }`}
                >
                  <span className="w-5 text-center font-mono text-[9px] text-muted-foreground">
                    {participant.initiative}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {participant.name}
                    {participant.isAlly ? "" : " · inimigo"}
                  </span>
                  <span className="w-9 text-right font-mono text-[9px] text-muted-foreground">
                    {feet != null ? `${feet}p` : "—"}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {participant.currentHp ?? "?"}/{participant.maxHp ?? "?"}
                  </span>
                </li>
              );
            })}
          </ol>
          {currentCombatant ? (
            <div className="border-t border-border/70 p-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Deslocamento</span>
                <span className="font-mono">
                  {currentCombatant.movementUsed ?? 0}/
                  {currentCombatant.speed ?? 30} pés
                </span>
              </div>
              {canMoveCurrent ? (
                <div className="mx-auto mt-1 grid w-28 grid-cols-3 gap-1">
                  <span />
                  <Button
                    size="icon-sm"
                    variant="outline"
                    disabled={busy}
                    aria-label="Mover para cima"
                    onClick={() => void moveCurrentCombatant(0, -1)}
                  >
                    ↑
                  </Button>
                  <span />
                  <Button
                    size="icon-sm"
                    variant="outline"
                    disabled={busy}
                    aria-label="Mover para esquerda"
                    onClick={() => void moveCurrentCombatant(-1, 0)}
                  >
                    ←
                  </Button>
                  <span className="grid place-items-center text-[9px] text-muted-foreground">
                    5p
                  </span>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    disabled={busy}
                    aria-label="Mover para direita"
                    onClick={() => void moveCurrentCombatant(1, 0)}
                  >
                    →
                  </Button>
                  <span />
                  <Button
                    size="icon-sm"
                    variant="outline"
                    disabled={busy}
                    aria-label="Mover para baixo"
                    onClick={() => void moveCurrentCombatant(0, 1)}
                  >
                    ↓
                  </Button>
                  <span />
                </div>
              ) : (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Movimento do turno de outro participante.
                </p>
              )}
              {canAttackCurrent ? (
                <Button
                  size="sm"
                  className="mt-2 w-full gap-1"
                  onClick={() => setAttackOpen(true)}
                  disabled={busy}
                >
                  <Swords className="size-3.5" /> Atacar
                </Button>
              ) : null}
            </div>
          ) : null}
          {isMaster ? (
            <div className="border-t border-border/70 p-2">
              <Button
                size="sm"
                className="w-full gap-1"
                onClick={() => void advanceTurn()}
                disabled={busy}
              >
                <Swords className="size-3.5" /> Próximo turno
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <aside className="absolute bottom-3 right-3 top-20 z-30 flex w-[min(23rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-primary/30 bg-card/92 shadow-2xl backdrop-blur">
        <div className="flex gap-1 border-b border-border/70 p-2">
          {(
            [
              ["party", Users, "Party"],
              ["chronicle", ScrollText, "Crônica"],
              ["combat", Swords, "Combate"],
              ["npc", MapPin, "NPCs"],
            ] as const
          ).map(([id, Icon, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "default" : "ghost"}
              className="h-8 flex-1 gap-1 px-1 text-[10px]"
              onClick={() => setTab(id)}
            >
              <Icon className="size-3.5" /> {label}
            </Button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {error ? (
            <p role="alert" className="mb-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          {tab === "party" ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Companhia
              </p>
              {(party?.characters ?? []).length ? (
                party!.characters.map((character) => (
                  <div
                    key={character.id}
                    className="rounded-lg border border-border/60 bg-background/50 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {character.name}
                      </span>
                      <span className="font-mono text-[10px]">
                        {character.currentHp}/{character.maxHp}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.max(0, Math.min(1, character.currentHp / Math.max(character.maxHp, 1))) * 100}%`,
                        }}
                      />
                    </div>
                    {character.conditions.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {character.conditions.map((condition) => (
                          <Badge
                            key={condition}
                            variant="outline"
                            className="text-[9px]"
                          >
                            {condition}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhum personagem vinculado.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1"
                nativeButton={false}
                render={<Link href={`/campaigns/${params.id}/play`} />}
              >
                <HeartPulse className="size-3.5" /> Abrir HUD completo
              </Button>
            </div>
          ) : null}

          {tab === "chronicle" ? (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Última cena
              </p>
              <p className="whitespace-pre-line font-narrative text-sm leading-6">
                {party?.events?.[0]?.narration?.trim() ||
                  party?.events?.[0]?.summary ||
                  "A crônica começa na primeira ação."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                nativeButton={false}
                render={<Link href={`/campaigns/${params.id}/play`} />}
              >
                Abrir mesa narrada
              </Button>
            </div>
          ) : null}

          {tab === "combat" ? (
            <CombatPanel campaignId={params.id} isMaster={Boolean(isMaster)} />
          ) : null}

          {tab === "npc" ? (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Vida da cena
              </p>
              <p className="text-xs text-muted-foreground">
                {(
                  AMBIENT[selected?.name ?? ""] ?? [
                    { name: "Morador" },
                    { name: "Viajante" },
                  ]
                )
                  .map((npc) => npc.name)
                  .join(" · ")}
              </p>
              {isMaster && selected ? (
                <div className="space-y-2 rounded-lg border border-primary/25 p-2">
                  <p className="text-xs font-semibold">Invocar NPC</p>
                  <Input
                    value={npcName}
                    onChange={(event) => setNpcName(event.target.value)}
                    placeholder="Nome do NPC"
                    className="h-8 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      value={npcX}
                      onChange={(event) => setNpcX(event.target.value)}
                      type="number"
                      min={0}
                      max={selected.width - 1}
                      className="h-8 text-xs"
                      aria-label="X do NPC"
                    />
                    <Input
                      value={npcY}
                      onChange={(event) => setNpcY(event.target.value)}
                      type="number"
                      min={0}
                      max={selected.height - 1}
                      className="h-8 text-xs"
                      aria-label="Y do NPC"
                    />
                  </div>
                  <select
                    value={npcJob}
                    onChange={(event) => setNpcJob(event.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="0">Cidadão</option>
                    <option value="1">Aventureiro</option>
                    <option value="2">Criatura</option>
                  </select>
                  <Button
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => void summonNpc()}
                    disabled={busy}
                  >
                    <Plus className="size-3.5" /> Invocar
                  </Button>
                </div>
              ) : null}
              <div className="space-y-2">
                {npcTokens.map((npc) => (
                  <div
                    key={npc.id}
                    className="rounded-lg border border-border/60 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">
                        {npc.name}
                      </span>
                      {isMaster ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive"
                          onClick={() => void removeNpc(npc.id)}
                          aria-label={`Remover ${npc.name}`}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <Input
                        defaultValue={npc.x}
                        type="number"
                        min={0}
                        max={selected?.width ?? 1}
                        className="h-7 w-14 text-[10px]"
                        aria-label={`X de ${npc.name}`}
                        onBlur={(event) =>
                          void moveNpc(
                            npc.id,
                            Number(event.target.value),
                            npc.y,
                          )
                        }
                      />
                      <Input
                        defaultValue={npc.y}
                        type="number"
                        min={0}
                        max={selected?.height ?? 1}
                        className="h-7 w-14 text-[10px]"
                        aria-label={`Y de ${npc.name}`}
                        onBlur={(event) =>
                          void moveNpc(
                            npc.id,
                            npc.x,
                            Number(event.target.value),
                          )
                        }
                      />
                      <span className="text-[9px] text-muted-foreground">
                        célula
                      </span>
                    </div>
                  </div>
                ))}
                {!npcTokens.length ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum NPC persistente neste mapa.
                  </p>
                ) : null}
              </div>
              <p className="text-[10px] text-muted-foreground">
                NPCs ambiente aparecem em toda cena; os invocados ficam salvos
                no mapa.
              </p>
            </div>
          ) : null}
        </div>
      </aside>

      {attackOpen && hudCharacter ? (
        <WeaponAttackDialog
          character={hudCharacter}
          targets={combatTargets}
          busy={busy}
          initialTargetId={selectedTargetId}
          onOpenChange={setAttackOpen}
          onAttack={submitAttack}
        />
      ) : null}

      {!frameReady && slug ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-background/60 text-sm text-muted-foreground">
          Carregando o mundo 3D…
        </div>
      ) : null}
    </main>
  );
}

export default function ImmersivePage() {
  return (
    <RequireAuth>
      <ImmersiveContent />
    </RequireAuth>
  );
}
