"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Compass,
  Crown,
  Dices,
  HeartPulse,
  MapPin,
  MessageSquare,
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
  CharacterScreen,
  type RagnarokSheet,
  type RagnarokStat,
  type RagnarokAppearance,
} from "@/components/immersive/character-screen";
import { NarrationComposer } from "@/components/campaigns/narration-composer";
import { TableDiceControls } from "@/components/campaigns/table-dice-controls";
import {
  SpellDialog,
  type SpellCastInput,
} from "@/components/table/spell-dialog";
import {
  WeaponAttackDialog,
  type WeaponAttackInput,
} from "@/components/table/weapon-attack-dialog";
import { ItemUseDialog } from "@/components/table/item-use-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type {
  Campaign,
  Character,
  CombatEncounter,
  DiceRoll,
  Item,
  VttMap,
} from "@/lib/types";
import type {
  ActionTarget,
  CombatActionResult,
  HudCharacter,
  ItemUseResult,
  SpellCastResult,
} from "@/lib/table-types";
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

const NPC_IMAGE = (
  job: number,
  gender: "male" | "female" = "female",
  head = 1,
) =>
  `https://assets.latam-tools.com.br/image?job=${job}&gender=${gender}&head=${head}&action=0&frame=0&headdir=0&canvas=208x210%2B104%2B152&v=0.17.3`;

const NPC_IMAGES = [
  NPC_IMAGE(4, "female", 1),
  NPC_IMAGE(5, "male", 1),
  NPC_IMAGE(1, "male", 1),
];

const WORLD_NPCS: Record<
  string,
  Array<{
    id: "kafra" | "shop" | "guide";
    name: string;
    dx: number;
    dy: number;
    imageUrl: string;
  }>
> = {
  Prontera: [
    {
      id: "kafra",
      name: "Kafra",
      dx: -3,
      dy: 2,
      imageUrl: NPC_IMAGE(4, "female", 1),
    },
    {
      id: "shop",
      name: "Comerciante",
      dx: 3,
      dy: 2,
      imageUrl: NPC_IMAGE(5, "male", 1),
    },
    {
      id: "guide",
      name: "Guia de Prontera",
      dx: 0,
      dy: -3,
      imageUrl: NPC_IMAGE(1, "male", 1),
    },
  ],
};

const PORTAL_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <defs>
      <radialGradient id="g" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#67e8f9" stop-opacity="0.15"/>
        <stop offset="55%" stop-color="#67e8f9" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="80" cy="80" r="72" fill="url(#g)"/>
    <circle cx="80" cy="80" r="54" fill="none" stroke="#67e8f9" stroke-width="7" stroke-dasharray="12 8"/>
    <circle cx="80" cy="80" r="34" fill="#0e7490" fill-opacity="0.7" stroke="#a5f3fc" stroke-width="4"/>
    <path d="M80 46l22 34H58z" fill="#ecfeff"/>
  </svg>
`)}`;

function storedPositionKey(campaignId: string, mapId: string) {
  return `eldoria:position:${campaignId}:${mapId}`;
}

function storedMapKey(campaignId: string) {
  return `eldoria:map:${campaignId}`;
}

const AMBIENT: Record<
  string,
  Array<{ name: string; x: number; y: number; job: number }>
> = {
  Prontera: [
    { name: "Guarda de Prata", x: 0.45, y: 0.42, job: 1 },
    { name: "Pregoeiro", x: 0.57, y: 0.47, job: 2 },
    { name: "Cidadã", x: 0.5, y: 0.58, job: 0 },
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

interface RagnarokVisual {
  id: string;
  name: string;
  appearance: string | null;
}

interface RagnarokConfig {
  baseExpRate: number;
  jobExpRate: number;
  dropRate: number;
  zenyRate: number;
  lootMode: string;
  lootProtectionSeconds: number;
}

interface RagnarokJob {
  id: number;
  name: string;
  jt: string;
}

interface PartyState {
  scene: { name: string } | null;
  characters: HudCharacter[];
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
    pulseActor: (id: string, kind?: "hit" | "heal") => void;
    floatText: (id: string, text: string, kind?: "hit" | "heal") => void;
  };
}

interface AttackHudResult {
  weapon: { name: string };
  target: { name: string };
  attack: {
    roll: number;
    modifier: number;
    total: number;
    ac: number;
    hit: boolean;
    critical: boolean;
  };
  damage: { amount: number; damageType: string };
  applied: number;
}

type SideTab = "party" | "chronicle" | "combat" | "npc" | "master";

function frameCss() {
  return `
    body *:not(canvas):not(#eldoria-lock) { visibility: hidden !important; }
    body canvas { visibility: visible !important; }
    #eldoria-lock { visibility: visible !important; }
  `;
}

function itemEffectKind(
  properties: string | null,
): "HEAL" | "TEMP_HP" | "DAMAGE" | null {
  if (!properties) return null;
  try {
    const data = JSON.parse(properties) as Record<string, unknown>;
    if (data.healing !== undefined) return "HEAL";
    if (data.temporaryHp !== undefined || data.tempHp !== undefined)
      return "TEMP_HP";
    if (data.damage !== undefined || data.damageFormula !== undefined)
      return "DAMAGE";
    return null;
  } catch {
    return null;
  }
}

function ImmersiveContent() {
  const params = useParams<{ id: string }>();
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [maps, setMaps] = useState<VttMap[]>([]);
  const [myCharacter, setMyCharacter] = useState<Character | null>(null);
  const [ragnarokVisuals, setRagnarokVisuals] = useState<RagnarokVisual[]>([]);
  const [ragnarokSheets, setRagnarokSheets] = useState<RagnarokSheet[]>([]);
  const [boundRagnarokIds, setBoundRagnarokIds] = useState<string[]>([]);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [learningSkill, setLearningSkill] = useState(false);
  const [bindingSheet, setBindingSheet] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [equippingEntry, setEquippingEntry] = useState<string | null>(null);
  const [ragnarokJobs, setRagnarokJobs] = useState<RagnarokJob[]>([]);
  const [ragnarokConfig, setRagnarokConfig] = useState<RagnarokConfig | null>(
    null,
  );
  const [classTarget, setClassTarget] = useState("");
  const [classJob, setClassJob] = useState("");
  const [grantingClass, setGrantingClass] = useState(false);
  const [jobLevelValue, setJobLevelValue] = useState("10");
  const [jobExpAmount, setJobExpAmount] = useState("500");
  const [grantingJob, setGrantingJob] = useState(false);
  const [roItemSearch, setRoItemSearch] = useState("");
  const [roItemResults, setRoItemResults] = useState<
    Array<{ id: number; name: string; viewKind: string | null }>
  >([]);
  const [roItemChoice, setRoItemChoice] = useState("");
  const [roItemQuantity, setRoItemQuantity] = useState("1");
  const [grantingItem, setGrantingItem] = useState(false);
  const [zenyAmount, setZenyAmount] = useState("1000");
  const [grantingZeny, setGrantingZeny] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [classNotice, setClassNotice] = useState<string | null>(null);
  const [kafraOpen, setKafraOpen] = useState(false);
  const [kafraBusy, setKafraBusy] = useState(false);
  const [kafraMessage, setKafraMessage] = useState<string | null>(null);
  const [viewerPosition, setViewerPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [ratesForm, setRatesForm] = useState({
    baseExpRate: "5",
    jobExpRate: "5",
    dropRate: "5",
    zenyRate: "5",
    lootMode: "KILLER",
    lootProtectionSeconds: "45",
  });
  const [selectedRagnarokId, setSelectedRagnarokId] = useState("");
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
  const [narrationOpen, setNarrationOpen] = useState(false);
  const [diceOpen, setDiceOpen] = useState(false);
  const [diceRolls, setDiceRolls] = useState<DiceRoll[]>([]);
  const [masterMessage, setMasterMessage] = useState<string | null>(null);
  const [bossName, setBossName] = useState("Chefe da Cena");
  const [bossHp, setBossHp] = useState("120");
  const [bossInitiative, setBossInitiative] = useState("20");
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [itemTarget, setItemTarget] = useState("");
  const [itemChoice, setItemChoice] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [levelTarget, setLevelTarget] = useState("");
  const [levelValue, setLevelValue] = useState("2");
  const [levelClass, setLevelClass] = useState("");
  const [masterBusy, setMasterBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attackOpen, setAttackOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [spellOpen, setSpellOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<AttackHudResult | null>(null);
  const [lastSpell, setLastSpell] = useState<string | null>(null);
  const [lastItem, setLastItem] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<CombatActionResult[]>([]);
  const [frameReady, setFrameReady] = useState(false);
  const iframe = useRef<HTMLIFrameElement>(null);
  const lastSentPosition = useRef("");
  const lastCombatTurn = useRef("");
  const lastPulsedAction = useRef("");
  const restoredPosition = useRef("");
  const actorsRef = useRef<
    Array<{
      id: string;
      x: number;
      y: number;
      imageUrl: string;
      size?: number;
    }>
  >([]);

  const selected = maps.find((map) => map.id === selectedId) ?? null;
  const slug = selected ? (LIVE_SLUG[selected.name] ?? null) : null;
  const selectedVisual =
    ragnarokVisuals.find((entry) => entry.id === selectedRagnarokId) ?? null;
  const boundSheet =
    ragnarokSheets.find((entry) => boundRagnarokIds.includes(entry.id)) ?? null;
  const selectedSheet =
    ragnarokSheets.find((entry) => entry.id === selectedRagnarokId) ??
    boundSheet ??
    ragnarokSheets[0] ??
    null;
  const activeWorldRagnarok =
    selectedSheet && boundRagnarokIds.includes(selectedSheet.id)
      ? selectedSheet
      : null;
  const visualAppearance =
    selectedVisual?.appearance ?? myCharacter?.appearance;
  const buildCode = useMemo(() => {
    const raw = visualAppearance;
    if (!raw) return null;
    try {
      const url = new URL(raw);
      if (url.hostname !== "visuais.latam-tools.com.br") return null;
      return url.searchParams.get("b");
    } catch {
      return null;
    }
  }, [visualAppearance]);
  const frameSrc = slug
    ? `/immersive/index.html${buildCode ? `?b=${encodeURIComponent(buildCode)}` : ""}#play/${slug}`
    : null;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [
        campaignData,
        mapData,
        partyData,
        charactersData,
        ragnarokData,
        boundData,
        configData,
        jobsData,
      ] = await Promise.all([
        api.get<Campaign>(`/campaigns/${params.id}`, token),
        api.get<VttMap[]>(`/campaigns/${params.id}/vtt/maps`, token),
        api.get<PartyState>(`/campaigns/${params.id}/ai-master/state`, token),
        api.get<Character[]>("/characters", token),
        api.get<RagnarokSheet[]>("/ragnarok/characters", token),
        api.get<RagnarokSheet[]>(
          `/campaigns/${params.id}/ragnarok-characters`,
          token,
        ),
        api.get<RagnarokConfig>(
          `/campaigns/${params.id}/ragnarok-config`,
          token,
        ),
        api.get<RagnarokJob[]>("/ragnarok/classes", token),
      ]);
      setCampaign(campaignData);
      setMaps(mapData);
      setParty(partyData);
      setRagnarokSheets(ragnarokData);
      setBoundRagnarokIds(boundData.map((entry) => entry.id));
      setRagnarokConfig(configData);
      setRatesForm({
        baseExpRate: String(configData.baseExpRate),
        jobExpRate: String(configData.jobExpRate),
        dropRate: String(configData.dropRate),
        zenyRate: String(configData.zenyRate),
        lootMode: configData.lootMode,
        lootProtectionSeconds: String(configData.lootProtectionSeconds),
      });
      setRagnarokJobs(jobsData);
      setClassJob(
        (current) =>
          current || String(jobsData.find((job) => job.id !== 0)?.id ?? ""),
      );
      setClassTarget((current) => current || boundData[0]?.id || "");
      setRagnarokVisuals(
        ragnarokData.filter((entry) => Boolean(entry.appearance)),
      );
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
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem(storedMapKey(params.id))
            : null;
        if (
          stored &&
          mapData.some((map) => map.id === stored && LIVE_SLUG[map.name])
        )
          return stored;
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

  useEffect(() => {
    if (!token || !combat) return;
    let cancelled = false;
    const loadLog = async () => {
      try {
        const log = await api.get<CombatActionResult[]>(
          `/campaigns/${params.id}/combat/actions?take=8`,
          token,
        );
        if (!cancelled) setActionLog(log);
      } catch {
        // histórico opcional
      }
    };
    void loadLog();
    const timer = window.setInterval(() => void loadLog(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [combat, params.id, token]);

  const npcTokens = useMemo(
    () =>
      (selected?.tokens ?? []).filter(
        (token) =>
          !token.characterId && !token.ragnarokCharacterId && token.visible,
      ),
    [selected],
  );

  const otherPlayerTokens = useMemo(
    () =>
      (selected?.tokens ?? []).filter(
        (entry) =>
          (entry.characterId || entry.ragnarokCharacterId) &&
          entry.characterId !== myCharacter?.id &&
          entry.ragnarokCharacterId !== activeWorldRagnarok?.id &&
          entry.visible,
      ),
    [activeWorldRagnarok?.id, myCharacter?.id, selected],
  );

  const ownToken = useMemo(
    () =>
      selected?.tokens.find(
        (entry) =>
          (entry.characterId && entry.characterId === myCharacter?.id) ||
          (entry.ragnarokCharacterId &&
            entry.ragnarokCharacterId === activeWorldRagnarok?.id),
      ) ?? null,
    [activeWorldRagnarok?.id, myCharacter?.id, selected],
  );

  const portalHotspots = useMemo(
    () =>
      (selected?.hotspots ?? []).filter(
        (hotspot) =>
          hotspot.visibleToPlayers &&
          (Boolean(hotspot.targetMapId) ||
            /portal|port[ãa]o|entrada|caverna|kafra|passagem/i.test(
              hotspot.label,
            )),
      ),
    [selected],
  );

  const npcMapKey =
    Object.keys(WORLD_NPCS).find((key) =>
      selected?.name.toLowerCase().includes(key.toLowerCase()),
    ) ??
    selected?.name ??
    "";

  const ambientNpcs = useMemo(
    () =>
      (
        AMBIENT[npcMapKey] ?? [
          { name: "Morador", x: 0.48, y: 0.55, job: 0 },
          { name: "Viajante", x: 0.58, y: 0.45, job: 1 },
        ]
      )
        .map((npc, index) => ({
          id: `ambient-${selected?.id ?? "map"}-${index}`,
          ...npc,
        }))
        .filter((npc) => !npcTokens.some((token) => token.name === npc.name)),
    [npcMapKey, npcTokens, selected?.id],
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
    const ambient = ambientNpcs.map((npc) => ({
      id: npc.id,
      x: npc.x,
      y: npc.y,
      imageUrl: NPC_IMAGES[npc.job] ?? NPC_IMAGES[0],
      size: 1.7,
    }));
    const baseX = viewerPosition
      ? viewerPosition.x * selected.width
      : (ownToken?.x ?? Math.floor(selected.width / 2));
    const baseY = viewerPosition
      ? viewerPosition.y * selected.height
      : (ownToken?.y ?? Math.floor(selected.height / 2));
    const worldNpcs = (WORLD_NPCS[npcMapKey] ?? []).map((npc) => ({
      id: `npc:${npc.id}`,
      x: (baseX + npc.dx + 0.5) / selected.width,
      y: (baseY + npc.dy + 0.5) / selected.height,
      imageUrl: npc.imageUrl,
      size: 6,
    }));
    const portals = portalHotspots.map((hotspot, index) => ({
      id: `portal:${hotspot.id}`,
      x: (hotspot.x + hotspot.width / 2) / selected.width,
      y: (hotspot.y + hotspot.height / 2) / selected.height,
      imageUrl: PORTAL_ICON,
      size: 2.3 + (index % 2) * 0.15,
    }));
    return [...tokens, ...players, ...ambient, ...worldNpcs, ...portals];
  }, [
    ambientNpcs,
    combat,
    myCharacter,
    npcMapKey,
    npcTokens,
    otherPlayerTokens,
    ownToken,
    portalHotspots,
    selected,
    viewerPosition,
  ]);

  useEffect(() => {
    actorsRef.current = actors;
  }, [actors]);

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
    win.__eldoria.setLocked(characterOpen || (combatActive && !myCombatTurn));
    return true;
  }, [actors, characterOpen, combatActive, myCombatTurn]);

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
  }, [applyFrame, buildCode, slug]);

  useEffect(() => {
    if (!frameReady) return;
    const win = iframe.current?.contentWindow as ImmersiveWindow | null;
    if (!win?.__eldoria) return;
    const update = () => {
      const position = win.__eldoria?.getPlayerPosition?.();
      if (position) setViewerPosition(position);
    };
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [frameReady]);

  useEffect(() => {
    if (!frameReady || !selectedSheet) return;
    const doc = iframe.current?.contentDocument;
    if (!doc) return;

    const click = (selector: string) =>
      doc.querySelector<HTMLButtonElement>(selector)?.click();
    const clickInBlock = (label: string, aria: string) => {
      const block = [...doc.querySelectorAll(".control-block")].find(
        (element) => element.textContent?.includes(label),
      );
      block
        ?.querySelector<HTMLButtonElement>(`button[aria-label="${aria}"]`)
        ?.click();
    };
    const option = [
      ...doc.querySelectorAll<HTMLButtonElement>(".class-option"),
    ].find((element) => element.textContent?.trim() === selectedSheet.job.name);
    option?.click();
    click(
      `.gender-btn[aria-label="${selectedSheet.gender === "F" ? "Feminino" : "Masculino"}"]`,
    );
    click(`.hair-pick[aria-label="Estilo ${selectedSheet.hairStyle}"]`);

    const hairColor =
      selectedSheet.hairColor === 0
        ? "Padrão"
        : `Cor ${((selectedSheet.hairColor - 1) % 8) + 1}`;
    clickInBlock("Cor do cabelo", hairColor);

    const clothesColor =
      selectedSheet.clothesColor === 0
        ? "Padrão"
        : `Cor ${((selectedSheet.clothesColor - 1) % 8) + 1}`;
    clickInBlock("Cor da roupa", clothesColor);

    const skin =
      selectedSheet.skinTone === 0
        ? "Pele original"
        : `Tom ${Math.min(4, selectedSheet.skinTone + 1)}`;
    clickInBlock("Pele", skin);

    const timer = window.setTimeout(() => {
      const current = iframe.current?.contentWindow as ImmersiveWindow | null;
      current?.__eldoria?.setActors(actorsRef.current);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [frameReady, selectedSheet]);

  const openKafra = useCallback(() => {
    setKafraMessage(null);
    setKafraOpen(true);
  }, []);

  const openPortal = useCallback(
    (hotspotId: string) => {
      const hotspot = portalHotspots.find((entry) => entry.id === hotspotId);
      if (!hotspot) {
        setError("Portal não encontrado.");
        return;
      }
      if (hotspot.label.toLowerCase().includes("kafra")) {
        openKafra();
        return;
      }
      const target = hotspot.targetMapId
        ? maps.find((map) => map.id === hotspot.targetMapId)
        : null;
      if (!target) {
        setError(`${hotspot.label} é um ponto de interesse sem passagem 3D.`);
        return;
      }
      if (!LIVE_SLUG[target.name]) {
        setError(`O portal leva a ${target.name}, que ainda não tem cena 3D.`);
        return;
      }
      setSelectedId(target.id);
      setFrameReady(false);
      lastSentPosition.current = "";
      restoredPosition.current = "";
      window.localStorage.setItem(storedMapKey(params.id), target.id);
    },
    [maps, openKafra, params.id, portalHotspots],
  );

  async function kafraAction(action: "save" | "teleport") {
    if (!token || !activeWorldRagnarok || kafraBusy) return;
    setKafraBusy(true);
    setKafraMessage(null);
    try {
      const result = await api.post<{ mapId: string; x: number; y: number }>(
        `/campaigns/${params.id}/ragnarok-characters/${activeWorldRagnarok.id}/kafra/${action}`,
        {},
        token,
      );
      if (action === "save") {
        setKafraMessage("Ponto de save registrado.");
      } else {
        const target = maps.find((entry) => entry.id === result.mapId);
        setKafraMessage(
          `Teleportado para ${target?.name ?? "o save"} (${result.x}, ${result.y}).`,
        );
        if (result.mapId === selected?.id && selected) {
          const win = iframe.current?.contentWindow as ImmersiveWindow | null;
          win?.__eldoria?.setPlayerCell(
            result.x,
            result.y,
            selected.width,
            selected.height,
          );
          lastSentPosition.current = "";
        } else {
          setSelectedId(result.mapId);
          setFrameReady(false);
          lastSentPosition.current = "";
          restoredPosition.current = "";
          window.localStorage.setItem(storedMapKey(params.id), result.mapId);
        }
      }
    } catch (err) {
      setKafraMessage(
        err instanceof ApiError ? err.message : "A Kafra recusou o serviço.",
      );
    } finally {
      setKafraBusy(false);
    }
  }

  useEffect(() => {
    if (!frameReady) return;
    const win = iframe.current?.contentWindow as ImmersiveWindow | null;
    if (!win?.__eldoria) return;
    // eslint-disable-next-line react-hooks/immutability -- ponte intencional com o iframe same-origin
    win.__eldoria.onActorClick = (id) => {
      if (id.startsWith("portal:")) {
        openPortal(id.slice(7));
        return;
      }
      if (id === "npc:kafra") {
        openKafra();
        return;
      }
      if (id === "npc:shop") {
        setError("A loja do comerciante entra na próxima etapa.");
        return;
      }
      if (id === "npc:guide") {
        setError("Guia: a Praça Central fica ao norte do portal sul.");
        return;
      }
      setSelectedTargetId(id.startsWith("combat-") ? id.slice(7) : id);
    };
    return () => {
      if (win.__eldoria) win.__eldoria.onActorClick = undefined;
    };
  }, [frameReady, openKafra, openPortal]);

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
    if (!frameReady || !actionLog.length) return;
    const latest = actionLog[0];
    if (lastPulsedAction.current === latest.actionId) return;
    lastPulsedAction.current = latest.actionId;
    const win = iframe.current?.contentWindow as ImmersiveWindow | null;
    win?.__eldoria?.pulseActor(
      `combat-${latest.target.id}`,
      latest.kind === "HEAL" ? "heal" : "hit",
    );
    if (latest.applied > 0) {
      win?.__eldoria?.floatText(
        `combat-${latest.target.id}`,
        `${latest.kind === "HEAL" ? "+" : "-"}${latest.applied}`,
        latest.kind === "HEAL" ? "heal" : "hit",
      );
    }
  }, [actionLog, frameReady]);

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
    if (!selected || !slug) return;
    window.localStorage.setItem(storedMapKey(params.id), selected.id);
  }, [params.id, selected, slug]);

  useEffect(() => {
    if (!frameReady || !selected || combat) return;
    const win = iframe.current?.contentWindow as ImmersiveWindow | null;
    if (!win?.__eldoria) return;
    const key = `${selected.id}:${ownToken?.id ?? "local"}`;
    if (restoredPosition.current !== key) {
      const stored = ownToken
        ? { x: ownToken.x, y: ownToken.y }
        : (() => {
            try {
              const raw = window.localStorage.getItem(
                storedPositionKey(params.id, selected.id),
              );
              return raw ? (JSON.parse(raw) as { x: number; y: number }) : null;
            } catch {
              return null;
            }
          })();
      if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
        win.__eldoria.setPlayerCell(
          stored.x,
          stored.y,
          selected.width,
          selected.height,
        );
      }
      restoredPosition.current = key;
    }
    const timer = window.setInterval(() => {
      const position = win.__eldoria?.getPlayerPosition?.();
      if (!position) return;
      const x = Math.max(
        0,
        Math.min(selected.width - 1, Math.floor(position.x * selected.width)),
      );
      const y = Math.max(
        0,
        Math.min(selected.height - 1, Math.floor(position.y * selected.height)),
      );
      window.localStorage.setItem(
        storedPositionKey(params.id, selected.id),
        JSON.stringify({ x, y }),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [combat, frameReady, ownToken, params.id, selected]);

  useEffect(() => {
    if (
      !frameReady ||
      (!myCharacter && !activeWorldRagnarok) ||
      !selected ||
      !token
    ) {
      return;
    }
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

      if (combat && !activeWorldRagnarok) {
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

      const key = activeWorldRagnarok
        ? `ro:${activeWorldRagnarok.id}:${selected.id}:${x}:${y}`
        : `${myCharacter!.id}:${selected.id}:${x}:${y}`;
      if (lastSentPosition.current === key) return;
      lastSentPosition.current = key;
      if (cancelled) return;
      try {
        await api.put(
          `/campaigns/${params.id}/vtt/maps/${selected.id}/tokens/me`,
          activeWorldRagnarok
            ? { ragnarokCharacterId: activeWorldRagnarok.id, x, y }
            : { characterId: myCharacter!.id, x, y },
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
    activeWorldRagnarok,
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

  async function seedAmbientNpcs() {
    if (!token || !selected || !campaign?.masterId) return;
    setBusy(true);
    setError(null);
    try {
      for (const [index, npc] of ambientNpcs.entries()) {
        const offset = [
          [-1, 0],
          [1, -1],
          [0, 2],
        ][index % 3];
        await api.post(
          `/campaigns/${params.id}/vtt/maps/${selected.id}/tokens`,
          {
            name: npc.name,
            x: Math.max(
              0,
              Math.min(
                selected.width - 1,
                Math.floor(selected.width / 2) + offset[0],
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                selected.height - 1,
                Math.floor(selected.height / 2) + offset[1],
              ),
            ),
            imageUrl: NPC_IMAGES[npc.job] ?? NPC_IMAGES[0],
            color: "#c28b45",
            visible: true,
          },
          token,
        );
      }
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao trazer NPCs da cena.",
      );
    } finally {
      setBusy(false);
    }
  }

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

  async function runAiRound() {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.post<CombatEncounter>(
        `/campaigns/${params.id}/combat/ai-round`,
        undefined,
        token,
      );
      setCombat(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha no turno da IA.");
    } finally {
      setBusy(false);
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
      const result = await api.post<AttackHudResult>(
        `/campaigns/${params.id}/combat/attacks`,
        { ...input, requestKey: crypto.randomUUID() },
        token,
      );
      setLastAction(result);
      setAttackOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao atacar.");
    } finally {
      setBusy(false);
    }
  }

  async function submitItemUse(inventoryItemId: string) {
    if (!token || !myCharacter) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<ItemUseResult>(
        `/campaigns/${params.id}/combat/items/use`,
        {
          requestKey: crypto.randomUUID(),
          inventoryItemId,
          characterId: myCharacter.id,
        },
        token,
      );
      setLastItem(
        `${result.item.name} → ${result.target.name}: ${result.applied} PV`,
      );
      setItemOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao usar o item.");
    } finally {
      setBusy(false);
    }
  }

  async function submitSpellCast(input: SpellCastInput) {
    if (!token) return;
    setBusy(true);
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
      const targets = result.targets
        .map((target) => `${target.name} ${target.applied} PV`)
        .join(", ");
      setLastSpell(`${result.spell.name} → ${targets}`);
      setSpellOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao conjurar a magia.",
      );
    } finally {
      setBusy(false);
    }
  }

  const hudCharacter = useMemo<HudCharacter | null>(() => {
    const mine = party?.characters.find((entry) => entry.isMine);
    if (mine) return mine;
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
        effectKind: itemEffectKind(entry.item.properties),
      })),
      spells: [],
      spellSlots: [],
    };
  }, [myCharacter, party]);

  const combatTargets = useMemo<ActionTarget[]>(() => {
    const current = combat?.participants[combat.turnIndex];
    return (combat?.participants ?? []).map((participant) => ({
      kind: "PARTICIPANT",
      id: participant.id,
      name: participant.name,
      characterId: participant.characterId,
      currentHp: participant.currentHp,
      maxHp: participant.maxHp,
      isAlly: participant.isAlly,
      distanceFeet:
        current?.x != null &&
        current.y != null &&
        participant.x != null &&
        participant.y != null
          ? Math.max(
              Math.abs(current.x - participant.x),
              Math.abs(current.y - participant.y),
            ) * 5
          : null,
    }));
  }, [combat]);

  const isMaster = campaign?.masterId === currentUserId;
  const currentCombatant = combat?.participants[combat.turnIndex] ?? null;

  useEffect(() => {
    const first = party?.characters[0];
    if (!first) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- alvo padrão dos comandos
    setItemTarget((current) => current || first.characterId);
    setLevelTarget((current) => current || first.characterId);
  }, [party]);

  useEffect(() => {
    if (!token || tab !== "master" || !isMaster) return;
    let cancelled = false;
    api
      .get<Item[]>("/catalog/items", token)
      .then((items) => {
        if (!cancelled) setCatalogItems(items);
      })
      .catch(() => {
        if (!cancelled) setCatalogItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isMaster, tab, token]);

  useEffect(() => {
    if (!diceOpen || !token) return;
    let cancelled = false;
    api
      .get<DiceRoll[]>(`/dice/campaign/${params.id}`, token)
      .then((rolls) => {
        if (!cancelled) setDiceRolls(rolls);
      })
      .catch(() => {
        if (!cancelled) setDiceRolls([]);
      });
    return () => {
      cancelled = true;
    };
  }, [diceOpen, params.id, token]);

  async function summonBoss() {
    if (!token || !selected || !isMaster) return;
    setMasterBusy(true);
    setMasterMessage(null);
    try {
      let encounter = await api.get<CombatEncounter | null>(
        `/campaigns/${params.id}/combat`,
        token,
      );
      if (!encounter) {
        encounter = await api.post<CombatEncounter>(
          `/campaigns/${params.id}/combat`,
          { name: "Encontro do Mestre" },
          token,
        );
      }
      const x = Math.floor(selected.width / 2);
      const y = Math.floor(selected.height / 2);
      await api.post(
        `/campaigns/${params.id}/vtt/maps/${selected.id}/tokens`,
        {
          name: bossName.trim() || "Chefe",
          x,
          y,
          imageUrl: NPC_IMAGES[2],
          color: "#ef4444",
          visible: true,
        },
        token,
      );
      const updated = await api.post<CombatEncounter>(
        `/campaigns/${params.id}/combat/participants`,
        {
          name: bossName.trim() || "Chefe",
          initiative: Math.max(1, Number(bossInitiative) || 20),
          maxHp: Math.max(1, Number(bossHp) || 120),
          currentHp: Math.max(1, Number(bossHp) || 120),
          isAlly: false,
        },
        token,
      );
      const boss = updated.participants.find(
        (entry) => entry.name === (bossName.trim() || "Chefe") && !entry.isAlly,
      );
      if (boss) {
        await api.patch(
          `/campaigns/${params.id}/combat/participants/${boss.id}/move`,
          { x, y },
          token,
        );
      }
      setMasterMessage(`${bossName.trim() || "Chefe"} entrou no combate.`);
      await load();
    } catch (err) {
      setMasterMessage(
        err instanceof ApiError ? err.message : "Falha ao invocar o boss.",
      );
    } finally {
      setMasterBusy(false);
    }
  }

  async function grantMasterItem() {
    if (!token || !itemTarget || !itemChoice) return;
    setMasterBusy(true);
    setMasterMessage(null);
    try {
      const result = await api.post<{ characterName: string; item: Item }>(
        `/campaigns/${params.id}/master/grant-item`,
        {
          characterId: itemTarget,
          itemId: itemChoice,
          quantity: Math.max(1, Number(itemQuantity) || 1),
        },
        token,
      );
      setMasterMessage(
        `${result.item.name} entregue a ${result.characterName}.`,
      );
      await load();
    } catch (err) {
      setMasterMessage(
        err instanceof ApiError ? err.message : "Falha ao entregar o item.",
      );
    } finally {
      setMasterBusy(false);
    }
  }

  async function allocateSheetStat(stat: RagnarokStat) {
    if (!token || !selectedSheet || allocating) return;
    setAllocating(true);
    setError(null);
    try {
      const updated = await api.patch<RagnarokSheet>(
        `/ragnarok/characters/${selectedSheet.id}/stats`,
        { stat, amount: 1 },
        token,
      );
      setRagnarokSheets((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao distribuir o ponto.",
      );
    } finally {
      setAllocating(false);
    }
  }

  async function toggleRagnarokEquip(entryId: string, equipped: boolean) {
    if (!token || !selectedSheet || equippingEntry) return;
    setEquippingEntry(entryId);
    setError(null);
    try {
      const updated = await api.patch<RagnarokSheet>(
        `/ragnarok/characters/${selectedSheet.id}/items/${entryId}`,
        { equipped },
        token,
      );
      setRagnarokSheets((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao alterar equipamento.",
      );
    } finally {
      setEquippingEntry(null);
    }
  }

  async function saveSheetAppearance(appearance: RagnarokAppearance) {
    if (!token || !selectedSheet || savingAppearance) return;
    setSavingAppearance(true);
    setError(null);
    try {
      const updated = await api.patch<RagnarokSheet>(
        `/ragnarok/characters/${selectedSheet.id}`,
        appearance,
        token,
      );
      setRagnarokSheets((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao salvar aparência.",
      );
    } finally {
      setSavingAppearance(false);
    }
  }

  async function bindSheetToCampaign() {
    if (!token || !selectedSheet || bindingSheet) return;
    setBindingSheet(true);
    setError(null);
    try {
      await api.post(
        `/campaigns/${params.id}/ragnarok-characters`,
        { characterId: selectedSheet.id },
        token,
      );
      setBoundRagnarokIds((current) =>
        current.includes(selectedSheet.id)
          ? current
          : [...current, selectedSheet.id],
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao vincular a ficha.",
      );
    } finally {
      setBindingSheet(false);
    }
  }

  async function learnSheetSkill(skillId: number, level: number) {
    if (!token || !selectedSheet || learningSkill) return;
    setLearningSkill(true);
    setError(null);
    try {
      const updated = await api.post<RagnarokSheet>(
        `/ragnarok/characters/${selectedSheet.id}/skills`,
        { skillId, level },
        token,
      );
      setRagnarokSheets((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao aprender a skill.",
      );
    } finally {
      setLearningSkill(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const query = roItemSearch.trim();
        const result = await api.get<
          Array<{ id: number; name: string; viewKind: string | null }>
        >(
          `/ragnarok/items?take=20${
            query.length >= 2 ? `&search=${encodeURIComponent(query)}` : ""
          }`,
          token,
        );
        if (!cancelled) {
          setRoItemResults(result);
          setRoItemChoice((current) => current || String(result[0]?.id ?? ""));
        }
      } catch {
        if (!cancelled) setRoItemResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [roItemSearch, token]);

  async function grantRagnarokItem() {
    if (!token || !classTarget || !roItemChoice || grantingItem) return;
    setGrantingItem(true);
    setMasterMessage(null);
    try {
      const updated = await api.post<RagnarokSheet>(
        `/campaigns/${params.id}/ragnarok-characters/${classTarget}/item`,
        {
          itemId: Number(roItemChoice),
          quantity: Math.max(1, Number(roItemQuantity) || 1),
        },
        token,
      );
      setRagnarokSheets((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setMasterMessage("Item entregue à ficha Ragnarok.");
    } catch (err) {
      setMasterMessage(
        err instanceof ApiError ? err.message : "Falha ao entregar item.",
      );
    } finally {
      setGrantingItem(false);
    }
  }

  async function grantRagnarokZeny() {
    if (!token || !classTarget || grantingZeny) return;
    setGrantingZeny(true);
    setMasterMessage(null);
    try {
      const updated = await api.post<RagnarokSheet>(
        `/campaigns/${params.id}/ragnarok-characters/${classTarget}/zeny`,
        { amount: Math.max(1, Number(zenyAmount) || 1) },
        token,
      );
      setRagnarokSheets((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setMasterMessage(`Zeny entregue: ${updated.zeny}.`);
    } catch (err) {
      setMasterMessage(
        err instanceof ApiError ? err.message : "Falha ao entregar zeny.",
      );
    } finally {
      setGrantingZeny(false);
    }
  }

  async function grantJobLevel() {
    if (!token || !classTarget || grantingJob) return;
    setGrantingJob(true);
    setMasterMessage(null);
    try {
      const updated = await api.post<RagnarokSheet>(
        `/campaigns/${params.id}/ragnarok-characters/${classTarget}/job-level`,
        { level: Number(jobLevelValue) },
        token,
      );
      setRagnarokSheets((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setMasterMessage(`Job level: ${updated.jobLevel}.`);
    } catch (err) {
      setMasterMessage(
        err instanceof ApiError ? err.message : "Falha ao conceder job level.",
      );
    } finally {
      setGrantingJob(false);
    }
  }

  async function grantJobExp() {
    if (!token || !classTarget || grantingJob) return;
    setGrantingJob(true);
    setMasterMessage(null);
    try {
      const updated = await api.post<RagnarokSheet>(
        `/campaigns/${params.id}/ragnarok-characters/${classTarget}/job-exp`,
        { amount: Number(jobExpAmount) },
        token,
      );
      setRagnarokSheets((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setMasterMessage(
        `Job EXP aplicado: Job ${updated.jobLevel} (${updated.jobExp}).`,
      );
    } catch (err) {
      setMasterMessage(
        err instanceof ApiError ? err.message : "Falha ao conceder job EXP.",
      );
    } finally {
      setGrantingJob(false);
    }
  }

  async function grantRagnarokClass() {
    if (!token || !classTarget || !classJob || grantingClass) return;
    setGrantingClass(true);
    setMasterMessage(null);
    try {
      const updated = await api.post<RagnarokSheet>(
        `/campaigns/${params.id}/ragnarok-characters/${classTarget}/class`,
        { jobId: Number(classJob) },
        token,
      );
      setRagnarokSheets((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setMasterMessage(`Classe concedida: ${updated.job.name}.`);
      setClassNotice(`${updated.name} agora é ${updated.job.name}`);
      window.setTimeout(() => setClassNotice(null), 4500);
    } catch (err) {
      setMasterMessage(
        err instanceof ApiError ? err.message : "Falha ao conceder classe.",
      );
    } finally {
      setGrantingClass(false);
    }
  }

  async function saveRagnarokConfig() {
    if (!token || savingRates) return;
    setSavingRates(true);
    setMasterMessage(null);
    try {
      const updated = await api.patch<RagnarokConfig>(
        `/campaigns/${params.id}/ragnarok-config`,
        {
          baseExpRate: Number(ratesForm.baseExpRate),
          jobExpRate: Number(ratesForm.jobExpRate),
          dropRate: Number(ratesForm.dropRate),
          zenyRate: Number(ratesForm.zenyRate),
          lootMode: ratesForm.lootMode,
          lootProtectionSeconds: Number(ratesForm.lootProtectionSeconds),
        },
        token,
      );
      setRagnarokConfig(updated);
      setMasterMessage("Rates e loot atualizados.");
    } catch (err) {
      setMasterMessage(
        err instanceof ApiError ? err.message : "Falha ao salvar rates.",
      );
    } finally {
      setSavingRates(false);
    }
  }

  async function levelMasterCharacter() {
    if (!token || !levelTarget) return;
    setMasterBusy(true);
    setMasterMessage(null);
    try {
      const updated = await api.post<{ name: string; level: number }>(
        `/campaigns/${params.id}/master/level-up`,
        {
          characterId: levelTarget,
          level: Math.max(1, Math.min(20, Number(levelValue) || 1)),
          className: levelClass.trim() || undefined,
        },
        token,
      );
      setMasterMessage(`${updated.name} agora é nível ${updated.level}.`);
      await load();
    } catch (err) {
      setMasterMessage(
        err instanceof ApiError ? err.message : "Falha ao subir o nível.",
      );
    } finally {
      setMasterBusy(false);
    }
  }

  const canMoveCurrent =
    Boolean(currentCombatant) &&
    (isMaster ||
      (Boolean(myCharacter) &&
        currentCombatant?.characterId === myCharacter?.id));
  const canAttackCurrent =
    Boolean(hudCharacter && currentCombatant) &&
    currentCombatant?.characterId === myCharacter?.id;
  const canUseItem = Boolean(
    hudCharacter?.items.some((item) => item.effectKind && item.quantity > 0),
  );
  const canCastSpell = Boolean(canAttackCurrent && hudCharacter?.spells.length);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        setCharacterOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setCharacterOpen(false);
      }
      if ((event.key === "m" || event.key === "M") && isMaster) {
        event.preventDefault();
        setTab("master");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMaster]);

  return (
    <main className="fixed inset-x-0 bottom-0 top-[4.25rem] overflow-hidden bg-[#171816]">
      {classNotice ? (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-50 flex justify-center">
          <div className="animate-pulse rounded-full border border-primary/60 bg-background/95 px-6 py-2 text-sm font-semibold text-primary shadow-[0_0_45px_rgba(201,162,94,0.45)]">
            ✦ {classNotice}
          </div>
        </div>
      ) : null}
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
        {ragnarokVisuals.length ? (
          <select
            aria-label="Fonte do visual"
            className="h-9 max-w-40 rounded-md border border-input bg-background px-2 text-xs"
            value={selectedRagnarokId}
            onChange={(event) => {
              setSelectedRagnarokId(event.target.value);
              setFrameReady(false);
            }}
          >
            <option value="">Visual SRD</option>
            {ragnarokVisuals.map((entry) => (
              <option key={entry.id} value={entry.id}>
                RO · {entry.name}
              </option>
            ))}
          </select>
        ) : null}
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
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => setDiceOpen(true)}
        >
          <Dices className="size-3.5" /> Dados
        </Button>
        {isMaster ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setNarrationOpen(true)}
          >
            <MessageSquare className="size-3.5" /> Narrar
          </Button>
        ) : null}
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
              {canAttackCurrent && canUseItem ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1 w-full gap-1"
                  onClick={() => setItemOpen(true)}
                  disabled={busy}
                >
                  Usar item
                </Button>
              ) : null}
              {canCastSpell ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1 w-full gap-1"
                  onClick={() => setSpellOpen(true)}
                  disabled={busy}
                >
                  Conjurar
                </Button>
              ) : null}
            </div>
          ) : null}
          {lastAction ? (
            <div className="border-t border-border/70 p-2 text-[10px]">
              <p
                className={
                  lastAction.attack.hit
                    ? "font-semibold text-emerald-400"
                    : "font-semibold text-destructive"
                }
              >
                {lastAction.attack.hit ? "Acertou" : "Errou"}{" "}
                {lastAction.target.name}
                {lastAction.attack.critical ? " · crítico" : ""}
              </p>
              <p className="mt-0.5 font-mono text-muted-foreground">
                d20 {lastAction.attack.roll} + {lastAction.attack.modifier} ={" "}
                {lastAction.attack.total} vs CA {lastAction.attack.ac}
              </p>
              <p className="font-mono text-muted-foreground">
                {lastAction.weapon.name} · {lastAction.applied}{" "}
                {lastAction.damage.damageType}
              </p>
            </div>
          ) : null}
          {lastSpell || lastItem ? (
            <div className="border-t border-border/70 p-2 text-[10px]">
              {lastSpell ? (
                <p className="text-primary">
                  <span className="font-semibold">Magia:</span> {lastSpell}
                </p>
              ) : null}
              {lastItem ? (
                <p className="text-primary">
                  <span className="font-semibold">Item:</span> {lastItem}
                </p>
              ) : null}
            </div>
          ) : null}
          {actionLog.length ? (
            <div className="border-t border-border/70 p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Registro
              </p>
              <ul className="space-y-0.5">
                {actionLog.slice(0, 5).map((entry) => (
                  <li
                    key={entry.actionId}
                    className="flex items-center justify-between gap-2 text-[10px]"
                  >
                    <span className="truncate text-muted-foreground">
                      {entry.source ?? entry.kind} · {entry.target.name}
                    </span>
                    <span className="shrink-0 font-mono">
                      {entry.applied > 0
                        ? `${entry.applied} PV`
                        : entry.conditionsAfter.length
                          ? entry.conditionsAfter[
                              entry.conditionsAfter.length - 1
                            ]
                          : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {isMaster && currentCombatant && !currentCombatant.isAlly ? (
            <div className="border-t border-border/70 p-2">
              <Button
                size="sm"
                className="w-full gap-1"
                onClick={() => void runAiRound()}
                disabled={busy}
              >
                <Swords className="size-3.5" /> Rodada da IA
              </Button>
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
              ["party", Users, "Grupo"],
              ["chronicle", ScrollText, "Crônica"],
              ["combat", Swords, "Combate"],
              ["npc", MapPin, "NPCs"],
              ...(isMaster ? [["master", Crown, "Mestre"] as const] : []),
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

        {portalHotspots.length ? (
          <div className="border-b border-border/70 px-2 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Portais
            </p>
            <div className="flex flex-wrap gap-1">
              {portalHotspots.map((hotspot) => (
                <Button
                  key={hotspot.id}
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[10px]"
                  onClick={() => openPortal(hotspot.id)}
                >
                  <MapPin className="size-3" /> {hotspot.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {error ? (
            <p role="alert" className="mb-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          {tab === "master" ? (
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                Console do Mestre
              </p>
              {masterMessage ? (
                <p className="rounded border border-primary/25 bg-primary/10 px-2 py-1 text-xs">
                  {masterMessage}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setNarrationOpen(true)}
                >
                  <MessageSquare className="size-3.5" /> Narrar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setDiceOpen(true)}
                >
                  <Dices className="size-3.5" /> Dados
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border border-destructive/35 p-2">
                <p className="text-xs font-semibold">Invocar boss</p>
                <Input
                  value={bossName}
                  onChange={(event) => setBossName(event.target.value)}
                  className="h-8 text-xs"
                  placeholder="Nome do boss"
                />
                <div className="grid grid-cols-2 gap-1">
                  <Input
                    value={bossHp}
                    onChange={(event) => setBossHp(event.target.value)}
                    type="number"
                    min={1}
                    className="h-8 text-xs"
                    aria-label="PV do boss"
                  />
                  <Input
                    value={bossInitiative}
                    onChange={(event) => setBossInitiative(event.target.value)}
                    type="number"
                    min={1}
                    className="h-8 text-xs"
                    aria-label="Iniciativa do boss"
                  />
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full gap-1"
                  disabled={masterBusy || !selected}
                  onClick={() => void summonBoss()}
                >
                  <Swords className="size-3.5" /> Invocar no centro do mapa
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 p-2">
                <p className="text-xs font-semibold">Dar item do jogo</p>
                {party?.characters.length ? (
                  <>
                    <select
                      value={itemTarget}
                      onChange={(event) => setItemTarget(event.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      aria-label="Personagem que recebe o item"
                    >
                      {party.characters.map((character) => (
                        <option
                          key={character.characterId}
                          value={character.characterId}
                        >
                          {character.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={itemSearch}
                      onChange={(event) => setItemSearch(event.target.value)}
                      className="h-8 text-xs"
                      placeholder="Buscar no catálogo SRD…"
                    />
                    <select
                      value={itemChoice}
                      onChange={(event) => setItemChoice(event.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      aria-label="Item para entregar"
                    >
                      <option value="">Escolha um item…</option>
                      {catalogItems
                        .filter((entry) =>
                          entry.name
                            .toLowerCase()
                            .includes(itemSearch.trim().toLowerCase()),
                        )
                        .slice(0, 40)
                        .map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                    </select>
                    <div className="flex gap-1">
                      <Input
                        value={itemQuantity}
                        onChange={(event) =>
                          setItemQuantity(event.target.value)
                        }
                        type="number"
                        min={1}
                        max={99}
                        className="h-8 w-20 text-xs"
                        aria-label="Quantidade"
                      />
                      <Button
                        size="sm"
                        className="h-8 flex-1"
                        disabled={masterBusy || !itemTarget || !itemChoice}
                        onClick={() => void grantMasterItem()}
                      >
                        Entregar
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhum personagem vinculado à campanha.
                  </p>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 p-2">
                <p className="text-xs font-semibold">Subir nível / classe</p>
                {party?.characters.length ? (
                  <>
                    <select
                      value={levelTarget}
                      onChange={(event) => setLevelTarget(event.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      aria-label="Personagem que sobe de nível"
                    >
                      {party.characters.map((character) => (
                        <option
                          key={character.characterId}
                          value={character.characterId}
                        >
                          {character.name}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-1">
                      <Input
                        value={levelValue}
                        onChange={(event) => setLevelValue(event.target.value)}
                        type="number"
                        min={1}
                        max={20}
                        className="h-8 text-xs"
                        aria-label="Novo nível"
                      />
                      <Input
                        value={levelClass}
                        onChange={(event) => setLevelClass(event.target.value)}
                        className="h-8 text-xs"
                        placeholder="Classe (opcional)"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-8 w-full"
                      disabled={masterBusy || !levelTarget}
                      onClick={() => void levelMasterCharacter()}
                    >
                      Aplicar nível
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Vincule um personagem para evoluir.
                  </p>
                )}
              </div>

              <div className="order-[-4] space-y-2 rounded-lg border border-primary/30 p-2">
                <p className="text-xs font-semibold">Ragnarok — classe</p>
                {boundRagnarokIds.length ? (
                  <>
                    <select
                      value={classTarget}
                      onChange={(event) => setClassTarget(event.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      aria-label="Ficha Ragnarok que recebe a classe"
                    >
                      {ragnarokSheets
                        .filter((entry) => boundRagnarokIds.includes(entry.id))
                        .map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} · {entry.job.name}
                          </option>
                        ))}
                    </select>
                    <select
                      value={classJob}
                      onChange={(event) => setClassJob(event.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      aria-label="Classe a conceder"
                    >
                      {ragnarokJobs
                        .filter((job) => job.id !== 0)
                        .map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.name} ({job.jt})
                          </option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      className="h-8 w-full"
                      disabled={grantingClass || !classTarget || !classJob}
                      onClick={() => void grantRagnarokClass()}
                    >
                      {grantingClass ? "Concedendo..." : "Conceder classe"}
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma ficha Ragnarok vinculada.
                  </p>
                )}
              </div>

              <div className="order-[-1] space-y-2 rounded-lg border border-border/60 p-2">
                <p className="text-xs font-semibold">Ragnarok — job</p>
                {boundRagnarokIds.length ? (
                  <>
                    <div className="grid grid-cols-2 gap-1">
                      <Input
                        type="number"
                        min={1}
                        max={70}
                        value={jobLevelValue}
                        onChange={(event) =>
                          setJobLevelValue(event.target.value)
                        }
                        className="h-8 text-xs"
                        aria-label="Novo job level"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={grantingJob || !classTarget}
                        onClick={() => void grantJobLevel()}
                      >
                        Job level
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <Input
                        type="number"
                        min={1}
                        value={jobExpAmount}
                        onChange={(event) =>
                          setJobExpAmount(event.target.value)
                        }
                        className="h-8 text-xs"
                        aria-label="Quantidade de job EXP"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={grantingJob || !classTarget}
                        onClick={() => void grantJobExp()}
                      >
                        Dar Job EXP
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma ficha Ragnarok vinculada.
                  </p>
                )}
              </div>

              <div className="order-[-3] space-y-2 rounded-lg border border-border/60 p-2">
                <p className="text-xs font-semibold">Ragnarok — item/zeny</p>
                {boundRagnarokIds.length ? (
                  <>
                    <Input
                      value={roItemSearch}
                      onChange={(event) => setRoItemSearch(event.target.value)}
                      className="h-8 text-xs"
                      placeholder="Buscar item Ragnarok…"
                    />
                    <select
                      value={roItemChoice}
                      onChange={(event) => setRoItemChoice(event.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      aria-label="Item Ragnarok para entregar"
                    >
                      <option value="">Escolha um item…</option>
                      {roItemResults.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        min={1}
                        max={999}
                        value={roItemQuantity}
                        onChange={(event) =>
                          setRoItemQuantity(event.target.value)
                        }
                        className="h-8 w-20 text-xs"
                        aria-label="Quantidade do item Ragnarok"
                      />
                      <Button
                        size="sm"
                        className="h-8 flex-1"
                        disabled={grantingItem || !roItemChoice}
                        onClick={() => void grantRagnarokItem()}
                      >
                        Entregar item
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        min={1}
                        value={zenyAmount}
                        onChange={(event) => setZenyAmount(event.target.value)}
                        className="h-8 w-24 text-xs"
                        aria-label="Zeny para entregar"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 flex-1"
                        disabled={grantingZeny}
                        onClick={() => void grantRagnarokZeny()}
                      >
                        Entregar zeny
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma ficha Ragnarok vinculada.
                  </p>
                )}
              </div>

              <div className="order-[-2] space-y-2 rounded-lg border border-border/60 p-2">
                <p className="text-xs font-semibold">Ragnarok — rates e loot</p>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      ["baseExpRate", "Base EXP"],
                      ["jobExpRate", "Job EXP"],
                      ["dropRate", "Drop"],
                      ["zenyRate", "Zeny"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="space-y-0.5 text-[10px]">
                      <span className="text-muted-foreground">{label}</span>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={ratesForm[key]}
                        onChange={(event) =>
                          setRatesForm((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        className="h-8 text-xs"
                      />
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <select
                    value={ratesForm.lootMode}
                    onChange={(event) =>
                      setRatesForm((current) => ({
                        ...current,
                        lootMode: event.target.value,
                      }))
                    }
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    aria-label="Modo de loot"
                  >
                    <option value="KILLER">Killer cooperativo</option>
                    <option value="FFA">FFA</option>
                    <option value="PARTY">Festa</option>
                  </select>
                  <Input
                    type="number"
                    min={0}
                    max={300}
                    value={ratesForm.lootProtectionSeconds}
                    onChange={(event) =>
                      setRatesForm((current) => ({
                        ...current,
                        lootProtectionSeconds: event.target.value,
                      }))
                    }
                    className="h-8 text-xs"
                    aria-label="Proteção do loot em segundos"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-full"
                  disabled={savingRates}
                  onClick={() => void saveRagnarokConfig()}
                >
                  {savingRates ? "Salvando..." : "Salvar rates"}
                </Button>
                {ragnarokConfig ? (
                  <p className="text-[9px] text-muted-foreground">
                    Padrão 5x · loot {ragnarokConfig.lootMode} · proteção{" "}
                    {ragnarokConfig.lootProtectionSeconds}s
                  </p>
                ) : null}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-1 text-[10px]"
                nativeButton={false}
                render={<Link href="/library/ragnarok/characters" />}
              >
                <Crown className="size-3.5" /> Fichas e classes Ragnarok
              </Button>
            </div>
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
                {ambientNpcs.length
                  ? ambientNpcs.map((npc) => npc.name).join(" · ")
                  : "Os moradores desta cena já estão persistentes no mapa."}
              </p>
              {isMaster && selected ? (
                <div className="space-y-2 rounded-lg border border-primary/25 p-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1"
                    onClick={() => void seedAmbientNpcs()}
                    disabled={busy || !ambientNpcs.length}
                  >
                    <Users className="size-3.5" /> Trazer NPCs para a cena
                  </Button>
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

      {itemOpen && hudCharacter ? (
        <ItemUseDialog
          items={hudCharacter.items}
          characterName={hudCharacter.name}
          busy={busy}
          onOpenChange={setItemOpen}
          onUse={submitItemUse}
        />
      ) : null}

      {spellOpen && hudCharacter ? (
        <SpellDialog
          character={hudCharacter}
          targets={combatTargets}
          busy={busy}
          initialTargetId={selectedTargetId}
          onOpenChange={setSpellOpen}
          onCast={submitSpellCast}
        />
      ) : null}

      <Dialog open={narrationOpen} onOpenChange={setNarrationOpen}>
        <DialogContent className="max-h-[88dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Narrar sem sair do mapa</DialogTitle>
            <DialogDescription>
              A narração é enviada para os jogadores e pode ser registrada no
              diário, com o mapa atual.
            </DialogDescription>
          </DialogHeader>
          <NarrationComposer
            campaignId={params.id}
            currentMap={
              selected ? { id: selected.id, name: selected.name } : null
            }
            requestedDraftId={null}
            onRequestHandled={() => undefined}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={diceOpen} onOpenChange={setDiceOpen}>
        <DialogContent className="max-h-[88dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dados da mesa</DialogTitle>
            <DialogDescription>
              Rolagem autoritativa no servidor; o resultado aparece para quem
              pode ver.
            </DialogDescription>
          </DialogHeader>
          <TableDiceControls
            campaignId={params.id}
            isMaster={isMaster}
            characterId={myCharacter?.id ?? null}
            rolls={diceRolls}
            onRolled={(roll) =>
              setDiceRolls((current) => [roll, ...current].slice(0, 20))
            }
          />
        </DialogContent>
      </Dialog>

      {selected ? (
        <div className="absolute bottom-20 left-3 z-40 w-56 rounded-xl border border-primary/30 bg-card/94 p-2 shadow-2xl backdrop-blur">
          <p className="px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Moradores de {npcMapKey}
          </p>
          <div className="mt-1 space-y-1">
            {(WORLD_NPCS[npcMapKey] ?? []).map((npc) => (
              <button
                key={npc.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-background/45 px-2 py-1.5 text-left transition hover:border-primary/40 hover:bg-primary/10"
                onClick={() => {
                  if (npc.id === "kafra") {
                    openKafra();
                  } else if (npc.id === "shop") {
                    setError("A loja do comerciante entra na próxima etapa.");
                  } else {
                    setError(
                      "Guia: a Praça Central fica ao norte do portão sul.",
                    );
                  }
                }}
              >
                <img
                  src={npc.imageUrl}
                  alt=""
                  className="size-8 rounded-md border border-border/50 object-contain"
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs">{npc.name}</span>
                  <span className="block text-[9px] text-muted-foreground">
                    {npc.id === "kafra"
                      ? "Save · teleporte"
                      : npc.id === "shop"
                        ? "Comércio"
                        : "Informações"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {kafraOpen ? (
        <div className="absolute bottom-24 right-3 z-50 w-80 rounded-xl border border-primary/40 bg-card/96 p-3 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="font-heading text-lg">Kafra</p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar Kafra"
              onClick={() => setKafraOpen(false)}
            >
              ×
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Serviços de Prontera para {activeWorldRagnarok?.name ?? "sua ficha"}
            .
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={!activeWorldRagnarok || kafraBusy}
              onClick={() => void kafraAction("save")}
            >
              Salvar ponto
            </Button>
            <Button
              size="sm"
              disabled={!activeWorldRagnarok || kafraBusy}
              onClick={() => void kafraAction("teleport")}
            >
              Teleportar ao save
            </Button>
          </div>
          {kafraMessage ? (
            <p className="mt-2 text-xs text-muted-foreground">{kafraMessage}</p>
          ) : null}
          {!activeWorldRagnarok ? (
            <p className="mt-2 text-xs text-destructive">
              Vincule uma ficha Ragnarok à campanha primeiro.
            </p>
          ) : null}
        </div>
      ) : null}

      <CharacterScreen
        open={characterOpen}
        onClose={() => setCharacterOpen(false)}
        srd={myCharacter}
        hud={hudCharacter}
        ragnarok={selectedSheet}
        onAllocateStat={allocateSheetStat}
        allocating={allocating}
        onLearnSkill={learnSheetSkill}
        learning={learningSkill}
        bound={Boolean(
          selectedSheet && boundRagnarokIds.includes(selectedSheet.id),
        )}
        onBind={bindSheetToCampaign}
        binding={bindingSheet}
        onSaveAppearance={saveSheetAppearance}
        savingAppearance={savingAppearance}
        onToggleEquip={toggleRagnarokEquip}
        equipping={equippingEntry}
      />

      <div className="absolute bottom-3 left-1/2 z-40 flex w-[min(45rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-1 rounded-xl border border-primary/30 bg-card/94 p-2 shadow-2xl backdrop-blur">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="truncate">
                {ragnarokSheets[0]?.name ?? myCharacter?.name ?? "Aventureiro"}
              </span>
              <span className="font-mono">
                {hudCharacter
                  ? `${hudCharacter.currentHp}/${hudCharacter.maxHp} PV`
                  : "—"}
              </span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${
                    hudCharacter
                      ? Math.max(
                          0,
                          Math.min(
                            100,
                            (hudCharacter.currentHp /
                              Math.max(1, hudCharacter.maxHp)) *
                              100,
                          ),
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((slot) => (
              <div
                key={slot}
                title="Hotbar em integração"
                className="grid size-8 place-items-center rounded border border-border/70 bg-background/60 font-mono text-[10px] text-muted-foreground"
              >
                {slot}
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2 text-[10px]"
            onClick={() => setCharacterOpen(true)}
          >
            C · Personagem
          </Button>
          {isMaster ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-2 text-[10px]"
              onClick={() => setTab("master")}
            >
              M · Mestre
            </Button>
          ) : null}
        </div>
      </div>

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
