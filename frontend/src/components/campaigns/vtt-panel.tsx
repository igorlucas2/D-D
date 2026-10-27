"use client";
import { useLoreMapImage } from "@/lib/use-lore-map-image";

import dynamic from "next/dynamic";
import { DragEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AmbienceControls, useAmbience } from "@/components/campaigns/ambience-controls";
import { ArrivalCard, type Arrival } from "@/components/campaigns/arrival-card";
import { DiceTray } from "@/components/campaigns/dice-tray";
import { TableChat, type ChatMessage } from "@/components/campaigns/table-chat";
import { MasterAssistant } from "@/components/campaigns/master-assistant";
import { NarrationComposer } from "@/components/campaigns/narration-composer";
import {
  CombatFloatLayer,
  LowHpVignette,
  participantForToken,
  TurnBannerView,
  useTableCombat,
} from "@/components/campaigns/table-combat";
import { NarrationScroll } from "@/components/campaigns/narration-scroll";
import { TableDiceControls } from "@/components/campaigns/table-dice-controls";
import { DayNightOverlay } from "@/components/campaigns/day-night-overlay";
import { WeatherLayer } from "@/components/campaigns/weather-layer";
import { cellEdge, nearestSide, WallsLayer, wallKey, type WallEdge } from "@/components/campaigns/walls-layer";
import { WorldEventCard } from "@/components/campaigns/world-event-card";
import { MapStage, type StageFocus } from "@/components/campaigns/map-stage";
import {
  PING_SECONDS,
  PingLayer,
  PresenceBar,
  type PresenceMember,
  type TablePing,
} from "@/components/campaigns/table-presence";
import { VttToolRail, type VttTool } from "@/components/campaigns/vtt-tool-rail";
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
import {
  AMBIENCE_PRESET_LABELS,
  AMBIENCE_PRESETS,
  OUTDOOR_PRESETS,
  resolveAmbience,
  type AmbiencePreset,
} from "@/lib/audio/ambience-presets";
import { ambienceEngine } from "@/lib/audio/ambience-engine";
import { DAY_PHASE_STYLES, getDayPhase, INDOOR_STYLE, resolveMapLighting } from "@/lib/day-phase";
import { getSocketUrl } from "@/lib/realtime";
import type {
  CharacterExplorationState,
  CombatEncounter,
  CombatEvent,
  DiceRoll,
  NarrationSuggestion,
  TableNarration,
  JournalCategory,
  VttMap,
  VttMapHotspot,
  VttLightingMode,
  VttMapKind,
  VttVisionMode,
  VttWall,
  VttMarker,
  VttToken,
} from "@/lib/types";
import {
  JOURNAL_CATEGORIES,
  JOURNAL_CATEGORY_LABELS,
  VTT_LIGHTING_MODE_LABELS,
  VTT_LIGHTING_MODES,
  VTT_VISION_MODE_LABELS,
  VTT_MAP_KIND_LABELS,
  VTT_MAP_KINDS,
} from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import { useTablePrefsStore } from "@/stores/table-prefs-store";
import { useWorldCalendar } from "@/stores/world-calendar-store";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  ChevronRight,
  Compass,
  Dices,
  MessagesSquare,
  DoorOpen,
  Eye,
  EyeOff,
  Grid3x3,
  Home,
  Landmark,
  Lock,
  MapIcon,
  MapPin,
  Mountain,
  PanelRight,
  Plus,
  RefreshCw,
  ScrollText,
  Sparkles,
  TreePine,
  Trash2,
  Building2,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";

const VttTable3D = dynamic(
  () => import("./vtt-table-3d").then((mod) => mod.VttTable3D),
  { ssr: false },
);

type VttViewMode = "2d" | "3d";

const HOTSPOT_ICONS: Record<string, typeof MapPin> = {
  "map-pin": MapPin,
  home: Home,
  landmark: Landmark,
  mountain: Mountain,
  "tree-pine": TreePine,
  "door-open": DoorOpen,
  compass: Compass,
  building: Building2,
};

function hotspotIconComponent(icon: string) {
  return HOTSPOT_ICONS[icon] ?? MapPin;
}

interface DragPayload {
  type: "token" | "marker";
  id: string;
}

interface ServerToClientEvents {
  "vtt:joined": (payload: { campaignId: string }) => void;
  "vtt:map:created": (map: VttMap) => void;
  "vtt:map:updated": (map: VttMap) => void;
  "vtt:map:removed": (payload: { mapId: string }) => void;
  "vtt:error": (payload: { message: string }) => void;
  "table:roll": (roll: DiceRoll) => void;
  "table:presence": (payload: { campaignId: string; members: PresenceMember[] }) => void;
  "table:ping": (ping: Omit<TablePing, "key">) => void;
  "table:narration": (narration: TableNarration) => void;
  "table:combat": (payload: { encounter: CombatEncounter | null; event: CombatEvent | null }) => void;
  "table:chat": (message: ChatMessage) => void;
  "table:narration:suggestion": (suggestion: NarrationSuggestion) => void;
}

interface PointPayload {
  campaignId: string;
  mapId: string;
  x: number;
  y: number;
}

interface ClientToServerEvents {
  "vtt:join": (payload: { campaignId: string }) => void;
  "vtt:leave": (payload: { campaignId: string }) => void;
  "table:presence:status": (payload: { campaignId: string; status: "online" | "away" }) => void;
  "table:ping": (payload: PointPayload) => void;
  "table:focus": (payload: PointPayload) => void;
}

/** Sem interação por este tempo, a aba conta como ausente. */
const IDLE_MS = 2 * 60 * 1000;

interface GridPoint {
  x: number;
  y: number;
}

interface VttPanelProps {
  campaignId: string;
  isMaster: boolean;
  compact?: boolean;
  explorationCharacterId?: string | null;
  explorationState?: CharacterExplorationState | null;
  onExplorationStateChange?: (state: CharacterExplorationState) => void;
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function formatDistance(start: GridPoint | null, end: GridPoint | null, gridSize: number) {
  if (!start || !end) return null;
  const squares = Math.hypot(end.x - start.x, end.y - start.y);
  const units = squares * gridSize;
  return Number.isInteger(units) ? String(units) : units.toFixed(1);
}

export function VttPanel({
  campaignId,
  isMaster,
  compact = false,
  explorationCharacterId = null,
  explorationState = null,
  onExplorationStateChange,
}: VttPanelProps) {
  const inspectorId = useId();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [focusedCell, setFocusedCell] = useState(0);
  const token = useAuthStore((state) => state.token);
  const combat = useTableCombat(campaignId, token);
  const receiveCombat = combat.receive;
  const reloadCombat = combat.reload;
  const [maps, setMaps] = useState<VttMap[]>([]);
  const [diceOpen, setDiceOpen] = useState(false);
  const meId = useAuthStore((state) => state.user?.id);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const chatOpenRef = useRef(false);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  // Conversa (MV-08/IM-11): cada pessoa recebe a mensagem já projetada pelo
  // servidor (sussurros e idiomas resolvidos lá).
  const receiveChat = useCallback(
    (message: ChatMessage) => {
      setChatMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message].slice(-120)));
      if (!chatOpenRef.current && message.author.id !== meId) setUnreadChat((count) => count + 1);
    },
    [meId],
  );
  const loadChat = useCallback(async () => {
    if (!token) return;
    try {
      setChatMessages(await api.get<ChatMessage[]>(`/campaigns/${campaignId}/chat`, token));
    } catch {
      // A conversa é secundária; a mesa continua utilizável sem ela.
    }
  }, [token, campaignId]);
  const [rolls, setRolls] = useState<DiceRoll[]>([]);
  const [trayQueue, setTrayQueue] = useState<DiceRoll[]>([]);
  const seenRollIds = useRef(new Set<string>());
  const dismissTray = useCallback(() => setTrayQueue((queue) => queue.slice(1)), []);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [narrationOpen, setNarrationOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [narrations, setNarrations] = useState<TableNarration[]>([]);
  const [suggestion, setSuggestion] = useState<NarrationSuggestion | null>(null);
  const [requestedDraftId, setRequestedDraftId] = useState<string | null>(null);
  const closeNarration = useCallback(() => setNarrations((queue) => queue.slice(1)), []);
  const clearRequestedDraft = useCallback(() => setRequestedDraftId(null), []);
  const [connection, setConnection] = useState<"connected" | "reconnecting">("connected");
  const [presence, setPresence] = useState<PresenceMember[]>([]);
  const [pings, setPings] = useState<TablePing[]>([]);
  const [pingAnnouncement, setPingAnnouncement] = useState("");
  const [stageFocus, setStageFocus] = useState<(StageFocus & { mapId: string }) | null>(null);
  const handleFocusHandled = useCallback((key: number) => {
    setStageFocus((current) => current?.key === key ? null : current);
  }, []);
  const followMaster = useTablePrefsStore((state) => state.followMaster);
  const setFollowMaster = useTablePrefsStore((state) => state.setFollowMaster);
  const mapsRef = useRef<VttMap[]>([]);
  const pingKey = useRef(0);


  // Quem rola recebe a resposta HTTP e o evento do socket: cada rolagem entra
  // no histórico e na bandeja uma única vez.
  const receiveRoll = useCallback((roll: DiceRoll) => {
    if (seenRollIds.current.has(roll.id)) return;
    seenRollIds.current.add(roll.id);
    setRolls((current) => [roll, ...current].slice(0, 30));
    setTrayQueue((queue) => [...queue, roll]);
  }, []);

  const loadRolls = useCallback(async () => {
    if (!token) return;
    try {
      const recent = await api.get<DiceRoll[]>(`/dice/campaign/${campaignId}`, token);
      for (const roll of recent) seenRollIds.current.add(roll.id);
      setRolls(recent);
    } catch {
      // O histórico é secundário; a mesa continua utilizável sem ele.
    }
  }, [token, campaignId]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<DiceRoll[]>(`/dice/campaign/${campaignId}`, token)
      .then((recent) => {
        if (cancelled) return;
        for (const roll of recent) seenRollIds.current.add(roll.id);
        setRolls(recent);
      })
      .catch(() => {
        // O histórico é secundário; a mesa continua utilizável sem ele.
      });
    return () => {
      cancelled = true;
    };
  }, [token, campaignId]);
  const [selectedMapId, setSelectedMapId] = useState("");
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [tool, setTool] = useState<VttTool>("move");
  const [viewMode, setViewMode] = useState<VttViewMode>("2d");

  // Ping e "Olhem aqui" (IM-05). O foco só move a visão de quem aceitou seguir
  // o mestre e só para mapas que esta pessoa pode ver.
  const receivePing = useCallback(
    (incoming: Omit<TablePing, "key">) => {
      const ping = { ...incoming, key: ++pingKey.current };
      setPings((current) => [...current, ping]);
      window.setTimeout(() => setPings((current) => current.filter((item) => item.key !== ping.key)), PING_SECONDS * 1000);
      const map = mapsRef.current.find((item) => item.id === ping.mapId);
      setPingAnnouncement(
        `${ping.displayName} ${ping.focus ? "pediu atenção para" : "apontou para"} ${map ? `${map.name}, ` : ""}célula ${ping.x + 1}, ${ping.y + 1}`,
      );
      ambienceEngine.sfx("ping");
      if (ping.focus && !isMaster && map && useTablePrefsStore.getState().followMaster) {
        setSelectedMapId(ping.mapId);
        setStageFocus({ mapId: map.id, x: (ping.x + 0.5) / map.width, y: (ping.y + 0.5) / map.height, key: ping.key });
      }
    },
    [isMaster],
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { calendar, lastEvent } = useWorldCalendar(campaignId);
  const weather = calendar?.weather ?? "clear";
  const weatherParticlesPref = useTablePrefsStore((state) => state.weatherParticles);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [previewPlayers, setPreviewPlayers] = useState(false);
  const [previewHidden, setPreviewHidden] = useState<Set<string> | null>(null);
  const dismissArrival = useCallback(() => setArrival(null), []);

  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [mapName, setMapName] = useState("");
  const [mapWidth, setMapWidth] = useState("24");
  const [mapHeight, setMapHeight] = useState("16");
  const [mapGridSize, setMapGridSize] = useState("1");
  const [mapGridColor, setMapGridColor] = useState("#94a3b8");
  const [mapImageUrl, setMapImageUrl] = useState("");
  const [mapKind, setMapKind] = useState<VttMapKind>("OTHER");
  const [creatingMap, setCreatingMap] = useState(false);

  const [loadedImageSize, setLoadedImageSize] = useState<{ url: string; width: number; height: number } | null>(
    null,
  );

  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenColor, setTokenColor] = useState("#f59e0b");
  const [tokenSize, setTokenSize] = useState("1");
  const [tokenImageUrl, setTokenImageUrl] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);

  const [selectedMarkerId, setSelectedMarkerId] = useState("");
  const [markerDialogOpen, setMarkerDialogOpen] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<GridPoint | null>(null);
  const [markerLabel, setMarkerLabel] = useState("");
  const [markerColor, setMarkerColor] = useState("#38bdf8");
  const [markerNote, setMarkerNote] = useState("");
  const [creatingMarker, setCreatingMarker] = useState(false);

  const [measureStart, setMeasureStart] = useState<GridPoint | null>(null);
  const [measureEnd, setMeasureEnd] = useState<GridPoint | null>(null);

  const [hotspotDialogOpen, setHotspotDialogOpen] = useState(false);
  const [editingHotspotId, setEditingHotspotId] = useState<string | null>(null);
  const [hotspotX, setHotspotX] = useState(0);
  const [hotspotY, setHotspotY] = useState(0);
  const [hotspotWidth, setHotspotWidth] = useState("1");
  const [hotspotHeight, setHotspotHeight] = useState("1");
  const [hotspotLabel, setHotspotLabel] = useState("");
  const [hotspotIcon, setHotspotIcon] = useState("map-pin");
  const [hotspotColor, setHotspotColor] = useState("#38bdf8");
  const [hotspotVisibleToPlayers, setHotspotVisibleToPlayers] = useState(true);
  const [hotspotTargetMode, setHotspotTargetMode] = useState<"none" | "existing" | "new">("none");
  const [hotspotTargetMapId, setHotspotTargetMapId] = useState("");
  const [hotspotTravelActionCost, setHotspotTravelActionCost] = useState("1");
  const [hotspotTravelMinutes, setHotspotTravelMinutes] = useState("30");
  const [hotspotEventNote, setHotspotEventNote] = useState("");
  const [hotspotTriggerJournalCategory, setHotspotTriggerJournalCategory] = useState<JournalCategory | "">("");
  const [hotspotNewMapName, setHotspotNewMapName] = useState("");
  const [hotspotNewMapKind, setHotspotNewMapKind] = useState<VttMapKind>("OTHER");
  const [savingHotspot, setSavingHotspot] = useState(false);

  const [hotspotDragStart, setHotspotDragStart] = useState<GridPoint | null>(null);
  const [hotspotDragCurrent, setHotspotDragCurrent] = useState<GridPoint | null>(null);

  const selectedMap = maps.find((map) => map.id === selectedMapId) ?? null;
  const renderedMapImageUrl = useLoreMapImage(selectedMap?.imageUrl, token);
  // Aguarda a proporção real da imagem (ou sua falha) antes de centralizar.
  // Do contrário, um mapa recém-aberto pode mudar de tamanho depois do foco.
  const mapImageReady = !selectedMap?.imageUrl || (!!renderedMapImageUrl && loadedImageSize?.url === renderedMapImageUrl);
  const activeFocus = followMaster && mapImageReady && stageFocus?.mapId === selectedMapId ? stageFocus : null;
  const imageNaturalSize = loadedImageSize && loadedImageSize.url === renderedMapImageUrl && loadedImageSize.width > 0 && loadedImageSize.height > 0 ? loadedImageSize : null;
  const selectedToken =
    selectedMap?.tokens.find((mapToken) => mapToken.id === selectedTokenId) ?? null;
  const selectedMarker =
    selectedMap?.markers.find((marker) => marker.id === selectedMarkerId) ?? null;

  const fogSet = useMemo(() => new Set(selectedMap?.fogCells ?? []), [selectedMap?.fogCells]);
  const currentHour = calendar?.currentHour ?? null;
  const lighting = useMemo(
    () => (selectedMap ? resolveMapLighting(selectedMap.kind, selectedMap.lightingMode, currentHour) : null),
    [selectedMap, currentHour],
  );
  const ambience = selectedMap ? resolveAmbience(selectedMap.kind, selectedMap.ambiencePreset) : null;
  const isNightLight = lighting === DAY_PHASE_STYLES.NOITE || lighting === DAY_PHASE_STYLES.MADRUGADA;
  const inCombat = Boolean(combat.encounter);
  // Clima só aparece ao ar livre; em interiores fica no som, abafado.
  const outdoors = lighting !== null && lighting !== INDOOR_STYLE;
  const weatherParticles = weatherParticlesPref ?? (typeof window !== "undefined" && window.innerWidth < 768 ? "reduced" : "full");
  useAmbience(
    inCombat ? "combat" : ambience,
    !inCombat && isNightLight && ambience !== null && OUTDOOR_PRESETS.has(ambience),
    weather,
    !outdoors,
  );
  const arrivalWhen = calendar
    ? `${DAY_PHASE_STYLES[getDayPhase(calendar.currentHour)].label}, dia ${calendar.currentDay} de ${
        calendar.monthNames[calendar.currentMonth - 1] ?? `mês ${calendar.currentMonth}`
      }`
    : null;
  const visibleTokens = useMemo(() => {
    if (!selectedMap) return [];
    return isMaster ? selectedMap.tokens : selectedMap.tokens.filter((mapToken) => mapToken.visible);
  }, [isMaster, selectedMap]);

  const measuredDistance = formatDistance(measureStart, measureEnd, selectedMap?.gridSize ?? 1);

  const editingHotspot =
    selectedMap?.hotspots.find((hotspot) => hotspot.id === editingHotspotId) ?? null;

  const mapPath = useMemo(() => {
    if (!selectedMap) return [];
    const path: VttMap[] = [];
    const visited = new Set<string>();
    let current: VttMap | undefined = selectedMap;
    while (current && !visited.has(current.id)) {
      path.unshift(current);
      visited.add(current.id);
      current = current.parentMapId ? maps.find((map) => map.id === current!.parentMapId) : undefined;
    }
    return path;
  }, [selectedMap, maps]);

  // Cartão de chegada (IM-03): só em viagem real por hotspot, nunca ao
  // recarregar ou quando o mestre navega pelos mapas.
  function announceArrival(targetMapId: string, travelMinutes: number | null) {
    const target = maps.find((map) => map.id === targetMapId);
    if (!target) return;
    const path: string[] = [];
    const visited = new Set<string>();
    let current: VttMap | undefined = target;
    while (current && !visited.has(current.id)) {
      path.unshift(current.name);
      visited.add(current.id);
      current = current.parentMapId ? maps.find((map) => map.id === current!.parentMapId) : undefined;
    }
    setArrival((previous) => ({ key: (previous?.key ?? 0) + 1, title: target.name, path, travelMinutes }));
  }

  const linkedMapIds = useMemo(() => {
    const set = new Set<string>();
    maps.forEach((map) => {
      map.hotspots.forEach((hotspot) => {
        if (hotspot.targetMapId && hotspot.id !== editingHotspotId) {
          set.add(hotspot.targetMapId);
        }
      });
    });
    return set;
  }, [maps, editingHotspotId]);

  const availableTargetMaps = useMemo(() => {
    if (!selectedMap) return [];
    return maps.filter((map) => map.id !== selectedMap.id && !linkedMapIds.has(map.id));
  }, [maps, selectedMap, linkedMapIds]);

  // Jogador mexe só no token do próprio personagem (MV-07).
  const ownsAnyToken = useMemo(
    () => !isMaster && Boolean(selectedMap?.tokens.some((item) => item.visible && item.ownerId === meId)),
    [isMaster, meId, selectedMap?.tokens],
  );

  async function refresh(preferredMapId?: string) {
    if (!token) return;
    const data = await api.get<VttMap[]>(`/campaigns/${campaignId}/vtt/maps`, token);
    setMaps(data);
    setSelectedMapId((current) => {
      if (preferredMapId && data.some((map) => map.id === preferredMapId)) return preferredMapId;
      if (data.some((map) => map.id === current)) return current;
      return data[0]?.id ?? "";
    });
    setSelectedTokenId((current) => {
      const nextMap = data.find((map) => map.id === (preferredMapId || selectedMapId));
      return nextMap?.tokens.some((mapToken) => mapToken.id === current) ? current : "";
    });
    setSelectedMarkerId((current) => {
      const nextMap = data.find((map) => map.id === (preferredMapId || selectedMapId));
      return nextMap?.markers.some((marker) => marker.id === current) ? current : "";
    });
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function loadMaps() {
      try {
        const data = await api.get<VttMap[]>(`/campaigns/${campaignId}/vtt/maps`, token);
        if (cancelled) return;
        setMaps(data);
        setSelectedMapId((current) => {
          if (data.some((map) => map.id === current)) return current;
          return data[0]?.id ?? "";
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Erro ao carregar mesa virtual.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMaps();

    return () => {
      cancelled = true;
    };
  }, [token, campaignId]);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    if (!token) return;

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(getSocketUrl("/vtt"), {
      auth: { token },
    });

    socketRef.current = socket;
    let connectedBefore = false;
    socket.on("connect", () => {
      setConnection("connected");
      socket.emit("vtt:join", { campaignId });
      // Eventos emitidos durante a desconexão não são reenviados (MV-03).
      if (connectedBefore) {
        void refreshRef.current();
        void loadRolls();
        reloadCombat();
        void loadChat();
      }
      connectedBefore = true;
    });

    socket.on("disconnect", () => setConnection("reconnecting"));
    socket.on("table:roll", receiveRoll);
    socket.on("table:presence", (payload) => {
      if (payload.campaignId === campaignId) setPresence(payload.members);
    });
    socket.on("table:ping", receivePing);
    socket.on("table:narration", (narration) => {
      setNarrations((queue) => (queue.some((item) => item.id === narration.id) ? queue : [...queue, narration]));
      ambienceEngine.sfx("page");
    });
    socket.on("table:narration:suggestion", setSuggestion);
    socket.on("table:combat", receiveCombat);
    socket.on("table:chat", receiveChat);

    socket.on("vtt:map:created", (map) => {
      setMaps((current) => {
        const exists = current.some((item) => item.id === map.id);
        return exists ? current.map((item) => (item.id === map.id ? map : item)) : [...current, map];
      });
      setSelectedMapId((current) => current || map.id);
    });

    socket.on("vtt:map:updated", (map) => {
      setMaps((current) => {
        const exists = current.some((item) => item.id === map.id);
        return exists ? current.map((item) => (item.id === map.id ? map : item)) : [...current, map];
      });
      setSelectedTokenId((current) =>
        map.tokens.some((mapToken) => mapToken.id === current) ? current : "",
      );
      setSelectedMarkerId((current) =>
        map.markers.some((marker) => marker.id === current) ? current : "",
      );
    });

    socket.on("vtt:map:removed", ({ mapId }) => {
      setMaps((current) => {
        const next = current.filter((map) => map.id !== mapId);
        setSelectedMapId((selected) => (selected === mapId ? next[0]?.id ?? "" : selected));
        return next;
      });
      setSelectedTokenId("");
      setSelectedMarkerId("");
    });

    socket.on("vtt:error", ({ message }) => {
      setError(message);
    });

    return () => {
      socket.emit("vtt:leave", { campaignId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, campaignId, receiveRoll, loadRolls, receivePing, receiveCombat, reloadCombat, receiveChat, loadChat]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<ChatMessage[]>(`/campaigns/${campaignId}/chat`, token)
      .then((history) => !cancelled && setChatMessages(history))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, campaignId]);

  useEffect(() => {
    mapsRef.current = maps;
  }, [maps]);

  // Mestre: busca o mapa como os jogadores o recebem e escurece o que eles
  // não veem. Recalcula a cada mudança do mapa (token, parede, porta).
  const previewMap = isMaster && previewPlayers ? maps.find((map) => map.id === selectedMapId) ?? null : null;
  useEffect(() => {
    if (!token || !previewMap) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .get<VttMap>(`/campaigns/${campaignId}/vtt/maps/${previewMap.id}/player-view`, token)
        .then((view) => {
          if (cancelled) return;
          const own = new Set(previewMap.fogCells);
          setPreviewHidden(new Set(view.fogCells.filter((cell) => !own.has(cell))));
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, campaignId, previewMap]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.key.toLowerCase() !== "p" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      setTool((current) => (current === "ping" ? "move" : "ping"));
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  // Presença: ausente com a aba oculta ou sem interação por IDLE_MS.
  useEffect(() => {
    let status: "online" | "away" = "online";
    let idleTimer = 0;
    const report = (next: "online" | "away") => {
      if (next === status) return;
      status = next;
      socketRef.current?.emit("table:presence:status", { campaignId, status });
    };
    const activity = () => {
      if (document.visibilityState === "hidden") return report("away");
      report("online");
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => report("away"), IDLE_MS);
    };
    const events = ["pointerdown", "keydown", "wheel", "visibilitychange"] as const;
    for (const event of events) document.addEventListener(event, activity, { passive: true });
    activity();
    return () => {
      for (const event of events) document.removeEventListener(event, activity);
      window.clearTimeout(idleTimer);
    };
  }, [campaignId]);

  useEffect(() => {
    const url = renderedMapImageUrl;
    if (!url) return;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setLoadedImageSize({ url, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      if (!cancelled) setLoadedImageSize({ url, width: 0, height: 0 });
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [renderedMapImageUrl]);

  function replaceMap(nextMap: VttMap) {
    setMaps((current) => current.map((map) => (map.id === nextMap.id ? nextMap : map)));
    setSelectedMapId(nextMap.id);
  }

  /**
   * PATCH do mapa com concorrência otimista (P1-2): envia a revisão lida e,
   * se outra pessoa salvou antes, recarrega em vez de sobrescrever.
   */
  async function patchMap(patch: Record<string, unknown>, failureMessage: string) {
    if (!token || !selectedMap) return null;
    setError(null);
    try {
      const updated = await api.patch<VttMap>(
        `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}`,
        { ...patch, expectedRevision: selectedMap.revision },
        token,
      );
      replaceMap(updated);
      return updated;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Outra pessoa alterou este mapa. O estado atual foi recarregado; refaça a alteração.");
        await refresh(selectedMap.id);
        return null;
      }
      setError(err instanceof ApiError ? err.message : failureMessage);
      return null;
    }
  }

  async function handleCreateMap() {
    if (!token) return;
    setCreatingMap(true);
    setError(null);
    try {
      const created = await api.post<VttMap>(
        `/campaigns/${campaignId}/vtt/maps`,
        {
          name: mapName,
          width: Number(mapWidth) || 24,
          height: Number(mapHeight) || 16,
          gridSize: Number(mapGridSize) || 1,
          gridColor: mapGridColor,
          imageUrl: mapImageUrl || undefined,
          kind: mapKind,
        },
        token,
      );
      setMaps((current) => [...current, created]);
      setSelectedMapId(created.id);
      setMapDialogOpen(false);
      setMapName("");
      setMapImageUrl("");
      setMapWidth("24");
      setMapHeight("16");
      setMapGridSize("1");
      setMapGridColor("#94a3b8");
      setMapKind("OTHER");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o mapa.");
    } finally {
      setCreatingMap(false);
    }
  }

  async function handleDeleteMap() {
    if (!token || !selectedMap) return;
    const confirmed = window.confirm(`Excluir o mapa "${selectedMap.name}"?`);
    if (!confirmed) return;

    await api.delete(`/campaigns/${campaignId}/vtt/maps/${selectedMap.id}`, token);
    setSelectedTokenId("");
    await refresh();
  }

  async function updateMapFog(nextFogCells: string[]) {
    if (!token || !selectedMap || !isMaster) return;
    await patchMap({ fogCells: nextFogCells }, "Não foi possível alterar a névoa.");
  }

  // Visão dinâmica (IM-13): paredes e portas nas bordas das células.
  async function saveWalls(walls: VttWall[]) {
    if (!token || !selectedMap || !isMaster) return;
    await patchMap({ walls }, "Não foi possível salvar as paredes.");
  }

  /** Parede: liga/desliga a parede da borda. Porta: põe/tira uma porta fechada. */
  function toggleEdge(edge: WallEdge, kind: "wall" | "door") {
    if (!selectedMap) return;
    const key = wallKey(edge);
    const existing = selectedMap.walls.find((wall) => wallKey(wall) === key);
    const others = selectedMap.walls.filter((wall) => wallKey(wall) !== key);
    const sameKind = existing && (kind === "door" ? Boolean(existing.door) : !existing.door);
    if (sameKind) return void saveWalls(others);
    return void saveWalls([...others, kind === "door" ? { ...edge, door: "closed" } : { ...edge }]);
  }

  /** Mestre abre qualquer porta; jogador, as que estão junto de um token seu (MV-07). */
  async function toggleDoor(wall: VttWall) {
    if (!token || !selectedMap) return;
    try {
      const updated = await api.post<VttMap>(
        `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/doors/toggle`,
        { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 },
        token,
      );
      replaceMap(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível mexer na porta.");
    }
  }

  /** Jogador move o próprio token; o servidor confere paredes e turno (MV-07). */
  async function moveOwnToken(tokenId: string, point: GridPoint) {
    const mapToken = selectedMap?.tokens.find((item) => item.id === tokenId);
    if (!token || !selectedMap || !mapToken || !mapToken.visible || mapToken.ownerId !== meId) return;
    const x = clamp(point.x, 0, selectedMap.width - mapToken.size);
    const y = clamp(point.y, 0, selectedMap.height - mapToken.size);
    if (x === mapToken.x && y === mapToken.y) return;
    setError(null);
    try {
      const updated = await api.patch<VttMap>(
        `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/tokens/${mapToken.id}/move`,
        { x, y },
        token,
      );
      replaceMap(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível mover o personagem.");
    }
  }

  async function updateMapVision(vision: VttVisionMode) {
    if (!token || !selectedMap || !isMaster) return;
    await patchMap({ vision }, "Não foi possível alterar a visão.");
  }

  async function updateMapLightingMode(lightingMode: VttLightingMode) {
    if (!token || !selectedMap || !isMaster) return;
    await patchMap({ lightingMode }, "Não foi possível alterar a iluminação.");
  }

  async function updateMapAmbience(ambiencePreset: AmbiencePreset | null) {
    if (!token || !selectedMap || !isMaster) return;
    await patchMap({ ambiencePreset }, "Não foi possível alterar o ambiente sonoro.");
  }

  async function updateMapGridColor(color: string) {
    if (!token || !selectedMap || !isMaster) return;
    await patchMap({ gridColor: color }, "Não foi possível alterar a cor da grade.");
  }

  async function handleCreateToken() {
    if (!token || !selectedMap) return;
    setCreatingToken(true);
    setError(null);
    try {
      const updated = await api.post<VttMap>(
        `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/tokens`,
        {
          name: tokenName,
          color: tokenColor,
          size: Number(tokenSize) || 1,
          imageUrl: tokenImageUrl || undefined,
        },
        token,
      );
      replaceMap(updated);
      setSelectedTokenId(updated.tokens.at(-1)?.id ?? "");
      setTokenDialogOpen(false);
      setTokenName("");
      setTokenColor("#f59e0b");
      setTokenSize("1");
      setTokenImageUrl("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o token.");
    } finally {
      setCreatingToken(false);
    }
  }

  async function updateToken(mapToken: VttToken, patch: Partial<VttToken>) {
    if (!token || !selectedMap || !isMaster) return;
    const updated = await api.patch<VttMap>(
      `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/tokens/${mapToken.id}`,
      patch,
      token,
    );
    replaceMap(updated);
    setSelectedTokenId(mapToken.id);
  }

  async function handleRemoveToken(mapToken: VttToken) {
    if (!token || !selectedMap || !isMaster) return;
    const updated = await api.delete<VttMap>(
      `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/tokens/${mapToken.id}`,
      token,
    );
    replaceMap(updated);
    setSelectedTokenId("");
  }

  async function handleCreateMarker() {
    if (!token || !selectedMap || !markerPosition) return;
    setCreatingMarker(true);
    setError(null);
    try {
      const updated = await api.post<VttMap>(
        `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/markers`,
        {
          x: markerPosition.x,
          y: markerPosition.y,
          label: markerLabel,
          color: markerColor,
          note: markerNote || undefined,
        },
        token,
      );
      replaceMap(updated);
      setSelectedMarkerId(updated.markers.at(-1)?.id ?? "");
      setMarkerDialogOpen(false);
      setMarkerPosition(null);
      setMarkerLabel("");
      setMarkerColor("#38bdf8");
      setMarkerNote("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o marcador.");
    } finally {
      setCreatingMarker(false);
    }
  }

  async function updateMarker(marker: VttMarker, patch: Partial<VttMarker>) {
    if (!token || !selectedMap || !isMaster) return;
    const updated = await api.patch<VttMap>(
      `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/markers/${marker.id}`,
      patch,
      token,
    );
    replaceMap(updated);
    setSelectedMarkerId(marker.id);
  }

  async function handleRemoveMarker(marker: VttMarker) {
    if (!token || !selectedMap || !isMaster) return;
    const updated = await api.delete<VttMap>(
      `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/markers/${marker.id}`,
      token,
    );
    replaceMap(updated);
    setSelectedMarkerId("");
  }

  async function handleCellClick(point: GridPoint) {
    if (!selectedMap) return;

    if (tool === "ping" || (tool === "focus" && isMaster)) {
      socketRef.current?.emit(tool === "ping" ? "table:ping" : "table:focus", {
        campaignId,
        mapId: selectedMap.id,
        x: point.x,
        y: point.y,
      });
      return;
    }

    if (tool === "measure") {
      if (!measureStart || measureEnd) {
        setMeasureStart(point);
        setMeasureEnd(null);
      } else {
        setMeasureEnd(point);
      }
      return;
    }

    if (tool === "fog" && isMaster) {
      const key = cellKey(point.x, point.y);
      const nextFog = new Set(selectedMap.fogCells);
      if (nextFog.has(key)) {
        nextFog.delete(key);
      } else {
        nextFog.add(key);
      }
      await updateMapFog([...nextFog]);
      return;
    }

    if (tool === "marker" && isMaster) {
      setMarkerPosition(point);
      setMarkerLabel("");
      setMarkerColor("#38bdf8");
      setMarkerNote("");
      setMarkerDialogOpen(true);
      return;
    }

    // Toque/teclado: com o próprio token selecionado, a célula é o destino.
    if (tool === "move" && !isMaster && selectedTokenId) {
      await moveOwnToken(selectedTokenId, point);
    }
  }

  function openCreateHotspot(point: GridPoint, width = 1, height = 1) {
    setEditingHotspotId(null);
    setHotspotX(point.x);
    setHotspotY(point.y);
    setHotspotWidth(String(width));
    setHotspotHeight(String(height));
    setHotspotLabel("");
    setHotspotIcon("map-pin");
    setHotspotColor("#38bdf8");
    setHotspotVisibleToPlayers(true);
    setHotspotTargetMode("none");
    setHotspotTargetMapId("");
    setHotspotNewMapName("");
    setHotspotNewMapKind("OTHER");
    setHotspotTravelActionCost("1");
    setHotspotTravelMinutes("30");
    setHotspotEventNote("");
    setHotspotTriggerJournalCategory("");
    setHotspotDialogOpen(true);
  }

  function openEditHotspot(hotspot: VttMapHotspot) {
    setEditingHotspotId(hotspot.id);
    setHotspotX(hotspot.x);
    setHotspotY(hotspot.y);
    setHotspotWidth(String(hotspot.width));
    setHotspotHeight(String(hotspot.height));
    setHotspotLabel(hotspot.label);
    setHotspotIcon(hotspot.icon);
    setHotspotColor(hotspot.color);
    setHotspotVisibleToPlayers(hotspot.visibleToPlayers);
    setHotspotTargetMode(hotspot.targetMapId ? "existing" : "none");
    setHotspotTargetMapId(hotspot.targetMapId ?? "");
    setHotspotNewMapName("");
    setHotspotNewMapKind("OTHER");
    setHotspotTravelActionCost(String(hotspot.travelActionCost));
    setHotspotTravelMinutes(String(hotspot.travelMinutes));
    setHotspotEventNote(hotspot.eventNote ?? "");
    setHotspotTriggerJournalCategory(hotspot.triggerJournalCategory ?? "");
    setHotspotDialogOpen(true);
  }

  // Finaliza o arrasto de criação de local: solta o mouse em qualquer lugar da
  // janela para tolerar o cursor saindo da grade durante o arrasto.
  useEffect(() => {
    if (!hotspotDragStart) return;

    function finishHotspotDrag() {
      const start = hotspotDragStart!;
      const current = hotspotDragCurrent ?? start;
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x) + 1;
      const height = Math.abs(current.y - start.y) + 1;
      setHotspotDragStart(null);
      setHotspotDragCurrent(null);
      openCreateHotspot({ x, y }, width, height);
    }

    window.addEventListener("mouseup", finishHotspotDrag);
    return () => window.removeEventListener("mouseup", finishHotspotDrag);
  }, [hotspotDragStart, hotspotDragCurrent]);

  function isHotspotLocked(hotspot: VttMapHotspot) {
    return (
      !isMaster &&
      Boolean(hotspot.targetMapId) &&
      explorationState !== null &&
      explorationState.actionPoints < hotspot.travelActionCost
    );
  }

  async function handleHotspotClick(hotspot: VttMapHotspot) {
    if (isMaster) {
      openEditHotspot(hotspot);
      return;
    }
    if (!hotspot.targetMapId || !hotspot.visibleToPlayers) return;

    if (!token || !explorationCharacterId) {
      setSelectedMapId(hotspot.targetMapId);
      setSelectedTokenId("");
      setSelectedMarkerId("");
      announceArrival(hotspot.targetMapId, null);
      return;
    }

    if (isHotspotLocked(hotspot)) {
      setError("Pontos de ação insuficientes para esta viagem.");
      return;
    }

    try {
      const updatedState = await api.post<CharacterExplorationState>(
        `/campaigns/${campaignId}/characters/${explorationCharacterId}/travel`,
        { hotspotId: hotspot.id },
        token,
      );
      onExplorationStateChange?.(updatedState);
      setSelectedMapId(hotspot.targetMapId);
      setSelectedTokenId("");
      setSelectedMarkerId("");
      announceArrival(hotspot.targetMapId, hotspot.travelMinutes || null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível viajar para este local.");
    }
  }

  async function handleSaveHotspot() {
    if (!token || !selectedMap) return;
    setSavingHotspot(true);
    setError(null);
    try {
      const payload = {
        x: hotspotX,
        y: hotspotY,
        width: Number(hotspotWidth) || 1,
        height: Number(hotspotHeight) || 1,
        label: hotspotLabel,
        icon: hotspotIcon,
        color: hotspotColor,
        visibleToPlayers: hotspotVisibleToPlayers,
        targetMapId:
          hotspotTargetMode === "existing" ? hotspotTargetMapId || null : hotspotTargetMode === "none" ? null : undefined,
        travelActionCost: Math.max(0, Number(hotspotTravelActionCost) || 0),
        travelMinutes: Math.max(0, Number(hotspotTravelMinutes) || 0),
        eventNote: hotspotEventNote.trim() || null,
        triggerJournalCategory: hotspotTriggerJournalCategory || null,
      };

      let updated: VttMap;
      let hotspotId = editingHotspotId;
      if (editingHotspotId) {
        updated = await api.patch<VttMap>(
          `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/hotspots/${editingHotspotId}`,
          payload,
          token,
        );
      } else {
        updated = await api.post<VttMap>(
          `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/hotspots`,
          payload,
          token,
        );
        hotspotId = updated.hotspots.at(-1)?.id ?? null;
      }
      replaceMap(updated);

      if (hotspotTargetMode === "new" && hotspotId) {
        await api.post<VttMap>(
          `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/hotspots/${hotspotId}/target`,
          { name: hotspotNewMapName, kind: hotspotNewMapKind },
          token,
        );
        await refresh(selectedMap.id);
      }

      setHotspotDialogOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar o local.");
    } finally {
      setSavingHotspot(false);
    }
  }

  async function handleDeleteHotspot(hotspot: VttMapHotspot) {
    if (!token || !selectedMap || !isMaster) return;
    const confirmed = window.confirm(`Excluir o local "${hotspot.label}"?`);
    if (!confirmed) return;
    const updated = await api.delete<VttMap>(
      `/campaigns/${campaignId}/vtt/maps/${selectedMap.id}/hotspots/${hotspot.id}`,
      token,
    );
    replaceMap(updated);
    setHotspotDialogOpen(false);
  }

  function handleTokenDragStart(event: DragEvent<HTMLButtonElement>, mapToken: VttToken) {
    const payload: DragPayload = { type: "token", id: mapToken.id };
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
  }

  function handleMarkerDragStart(event: DragEvent<HTMLButtonElement>, marker: VttMarker) {
    const payload: DragPayload = { type: "marker", id: marker.id };
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
  }

  async function handleCellDrop(event: DragEvent<HTMLButtonElement>, point: GridPoint) {
    event.preventDefault();
    if (!selectedMap || (!isMaster && !ownsAnyToken)) return;

    let payload: DragPayload | null = null;
    try {
      payload = JSON.parse(event.dataTransfer.getData("text/plain")) as DragPayload;
    } catch {
      return;
    }
    if (!payload) return;

    if (payload.type === "token") {
      const draggedToken = selectedMap.tokens.find((mapToken) => mapToken.id === payload!.id);
      if (!draggedToken) return;
      if (!isMaster) {
        await moveOwnToken(draggedToken.id, point);
        return;
      }
      await updateToken(draggedToken, {
        x: clamp(point.x, 0, selectedMap.width - draggedToken.size),
        y: clamp(point.y, 0, selectedMap.height - draggedToken.size),
      });
      return;
    }

    if (!isMaster) return;
    const draggedMarker = selectedMap.markers.find((marker) => marker.id === payload!.id);
    if (!draggedMarker) return;
    await updateMarker(draggedMarker, {
      x: clamp(point.x, 0, selectedMap.width - 1),
      y: clamp(point.y, 0, selectedMap.height - 1),
    });
  }

  function renderGridCells(map: VttMap) {
    const isHotspotTool = tool === "hotspot" && isMaster;

    return Array.from({ length: map.width * map.height }, (_, index) => {
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      const key = cellKey(x, y);
      const fogged = fogSet.has(key);
      const measured =
        (measureStart?.x === x && measureStart.y === y) || (measureEnd?.x === x && measureEnd.y === y);

      return (
        <button
          key={key}
          type="button"
          data-cell-index={index}
          tabIndex={index === Math.min(focusedCell, map.width * map.height - 1) ? 0 : -1}
          onFocus={() => setFocusedCell(index)}
          aria-label={`Célula ${x + 1}, ${y + 1}${fogged ? ", névoa de guerra" : ""}`}
          onKeyDown={(event) => {
            const next = event.key === "ArrowRight" ? Math.min(map.width - 1, x + 1) + y * map.width
              : event.key === "ArrowLeft" ? Math.max(0, x - 1) + y * map.width
              : event.key === "ArrowDown" ? x + Math.min(map.height - 1, y + 1) * map.width
              : event.key === "ArrowUp" ? x + Math.max(0, y - 1) * map.width
              : event.key === "Home" ? y * map.width
              : event.key === "End" ? (y + 1) * map.width - 1 : null;
            const side = ({ w: "top", a: "left", s: "bottom", d: "right" } as const)[event.key.toLowerCase() as "w" | "a" | "s" | "d"];
            if (side && isMaster && (tool === "wall" || tool === "door")) {
              event.preventDefault();
              toggleEdge(cellEdge(x, y, side), tool);
              return;
            }
            if (next === null) return;
            event.preventDefault();
            event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-cell-index="${next}"]`)?.focus();
          }}
          onClick={(event) => {
            if (isMaster && (tool === "wall" || tool === "door")) {
              const rect = event.currentTarget.getBoundingClientRect();
              const side = event.detail === 0 ? "top" : nearestSide((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
              toggleEdge(cellEdge(x, y, side), tool);
              return;
            }
            if (isHotspotTool && event.detail === 0) openCreateHotspot({ x, y });
            else void handleCellClick({ x, y });
          }}
          onMouseDown={(event) => {
            if (!isHotspotTool) return;
            event.preventDefault();
            setHotspotDragStart({ x, y });
            setHotspotDragCurrent({ x, y });
          }}
          onMouseEnter={() => {
            if (!isHotspotTool || !hotspotDragStart) return;
            setHotspotDragCurrent({ x, y });
          }}
          onDragOver={(event) => {
            if (isMaster || ownsAnyToken) event.preventDefault();
          }}
          onDrop={(event) => handleCellDrop(event, { x, y })}
          className={`border-r border-b transition-colors ${
            fogged && !isMaster
              ? "bg-[var(--rpg-charcoal)]"
              : measured
                ? "bg-primary/30"
                : fogged
                  ? "bg-black/65"
                  : "hover:bg-primary/10"
          }`}
          style={{ borderColor: map.gridColor }}
          title={`${x}, ${y}`}
        />
      );
    });
  }

  /** Centro (em %) do token de cada participante do combate, para os números. */
  function combatTokenPositions(map: VttMap) {
    const positions = new Map<string, { left: number; top: number }>();
    for (const mapToken of visibleTokens) {
      const participant = participantForToken(combat.encounter, mapToken);
      if (!participant || positions.has(participant.id)) continue;
      positions.set(participant.id, {
        left: ((mapToken.x + mapToken.size / 2) / map.width) * 100,
        top: (mapToken.y / map.height) * 100,
      });
    }
    return positions;
  }

  function renderToken(mapToken: VttToken, map: VttMap) {
    const participant = participantForToken(combat.encounter, mapToken);
    const conditions = participant?.conditions ?? [];
    const down = participant?.hpStatus === "DOWN";
    const width = (mapToken.size / map.width) * 100;
    const height = (mapToken.size / map.height) * 100;
    const left = (mapToken.x / map.width) * 100;
    const top = (mapToken.y / map.height) * 100;

    return (
      <button
        key={mapToken.id}
        type="button"
        draggable={isMaster || (mapToken.visible && mapToken.ownerId === meId)}
        onDragStart={(event) => handleTokenDragStart(event, mapToken)}
        onClick={() => setSelectedTokenId(mapToken.id)}
        className={`absolute z-20 flex items-center justify-center overflow-hidden rounded-full border text-[10px] font-semibold text-white shadow-lg ring-offset-background transition-[left,top,box-shadow,opacity,filter] duration-300 ease-out motion-reduce:transition-none ${
          selectedTokenId === mapToken.id ? "ring-2 ring-primary ring-offset-2" : "border-white/70"
        } ${!mapToken.visible ? "opacity-50" : ""} ${down ? "opacity-60 grayscale" : ""}`}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
          backgroundColor: mapToken.imageUrl ? undefined : mapToken.color,
          // Aura de condição: anel vinho; os nomes ficam no título e no inspetor.
          boxShadow: conditions.length ? "0 0 0 3px var(--rpg-wine), 0 0 12px 2px rgba(139, 52, 64, 0.8)" : undefined,
        }}
        title={[mapToken.name, down ? "caído" : null, conditions.length ? conditions.join(", ") : null].filter(Boolean).join(" · ")}
      >
        {mapToken.imageUrl ? (
          <span
            aria-label={mapToken.name}
            role="img"
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${mapToken.imageUrl})` }}
          />
        ) : (
          <span className="max-w-full truncate px-1">{mapToken.name.slice(0, 3).toUpperCase()}</span>
        )}
      </button>
    );
  }

  function renderMarker(marker: VttMarker, map: VttMap) {
    const left = ((marker.x + 0.5) / map.width) * 100;
    const top = ((marker.y + 0.5) / map.height) * 100;

    return (
      <button
        key={marker.id}
        type="button"
        draggable={isMaster}
        onDragStart={(event) => handleMarkerDragStart(event, marker)}
        onClick={(event) => {
          event.stopPropagation();
          setSelectedMarkerId(marker.id);
        }}
        className={`absolute z-30 flex -translate-x-1/2 -translate-y-full items-center justify-center transition ${
          selectedMarkerId === marker.id ? "scale-125" : ""
        }`}
        style={{ left: `${left}%`, top: `${top}%`, color: marker.color }}
        title={marker.note ? `${marker.label} — ${marker.note}` : marker.label}
      >
        <MapPin className="h-5 w-5 drop-shadow" fill="currentColor" />
      </button>
    );
  }

  function renderHotspot(hotspot: VttMapHotspot, map: VttMap) {
    if (!isMaster && !hotspot.visibleToPlayers) return null;

    const left = (hotspot.x / map.width) * 100;
    const top = (hotspot.y / map.height) * 100;
    const width = (hotspot.width / map.width) * 100;
    const height = (hotspot.height / map.height) * 100;
    const Icon = hotspotIconComponent(hotspot.icon);
    const locked = isHotspotLocked(hotspot);
    const clickable = isMaster
      ? tool === "move" || tool === "hotspot"
      : Boolean(hotspot.targetMapId) && !locked;

    return (
      <button
        key={hotspot.id}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void handleHotspotClick(hotspot);
        }}
        className={`absolute z-[15] flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-center transition ${
          clickable ? "cursor-pointer hover:bg-white/10" : "pointer-events-none cursor-default"
        } ${!hotspot.visibleToPlayers ? "opacity-60" : ""}`}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
          borderColor: hotspot.color,
          color: hotspot.color,
        }}
        title={locked ? `${hotspot.label} (pontos de ação insuficientes)` : hotspot.label}
      >
        {locked ? <Lock className="h-5 w-5 drop-shadow" /> : <Icon className="h-5 w-5 drop-shadow" />}
        <span className="max-w-full truncate px-1 text-xs font-medium text-white drop-shadow">
          {hotspot.label}
        </span>
      </button>
    );
  }

  function renderHotspotDragPreview(map: VttMap) {
    if (!hotspotDragStart || !hotspotDragCurrent) return null;

    const x0 = Math.min(hotspotDragStart.x, hotspotDragCurrent.x);
    const y0 = Math.min(hotspotDragStart.y, hotspotDragCurrent.y);
    const width = Math.abs(hotspotDragCurrent.x - hotspotDragStart.x) + 1;
    const height = Math.abs(hotspotDragCurrent.y - hotspotDragStart.y) + 1;

    return (
      <div
        className="pointer-events-none absolute z-[16] rounded-md border-2 border-dashed border-primary bg-primary/20"
        style={{
          left: `${(x0 / map.width) * 100}%`,
          top: `${(y0 / map.height) * 100}%`,
          width: `${(width / map.width) * 100}%`,
          height: `${(height / map.height) * 100}%`,
        }}
      />
    );
  }

  function renderMeasurementLine(map: VttMap) {
    if (!measureStart || !measureEnd) return null;

    return (
      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
        <line
          x1={`${((measureStart.x + 0.5) / map.width) * 100}%`}
          y1={`${((measureStart.y + 0.5) / map.height) * 100}%`}
          x2={`${((measureEnd.x + 0.5) / map.width) * 100}%`}
          y2={`${((measureEnd.y + 0.5) / map.height) * 100}%`}
          stroke="currentColor"
          strokeWidth="3"
          className="text-primary"
        />
      </svg>
    );
  }

  if (loading) {
    return (
      <Card className="min-w-0 border-primary/30 bg-card/95" aria-busy="true">
        <CardHeader>
          <CardTitle className="text-xl">Preparando a mesa</CardTitle>
          <CardDescription>Carregando cenários e peças da campanha...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-64 animate-pulse rounded-lg border border-primary/20 bg-background/50" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container min-w-0 border-primary/30 bg-card/95 shadow-xl shadow-black/25">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b border-primary/20 pb-4">
        <div>
          {!compact ? <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-primary">Palco da aventura</p> : null}
          <CardTitle className="flex items-center gap-2 text-xl">
            <MapIcon className="size-5 text-primary" aria-hidden="true" /> Mesa virtual
          </CardTitle>
          <CardDescription className={compact ? "hidden" : ""}>
            {selectedMap
              ? `${selectedMap.width}x${selectedMap.height} · ${selectedMap.tokens.length} token${
                  selectedMap.tokens.length === 1 ? "" : "s"
                }`
              : "Nenhum mapa criado."}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isMaster ? (
            <Button variant={assistantOpen ? "default" : "outline"} className="h-11" aria-expanded={assistantOpen} onClick={() => setAssistantOpen((value) => !value)}>
              <Sparkles className="size-4" aria-hidden="true" /> Assistente
            </Button>
          ) : null}
          {isMaster ? (
            <Button variant={narrationOpen ? "default" : "outline"} className="h-11" aria-expanded={narrationOpen} onClick={() => setNarrationOpen((value) => !value)}>
              <ScrollText className="size-4" aria-hidden="true" /> Narrar
            </Button>
          ) : null}
          <Button
            variant={chatOpen ? "default" : "outline"}
            className="relative h-11"
            aria-expanded={chatOpen}
            aria-label={unreadChat ? `Conversa, ${unreadChat} nova${unreadChat > 1 ? "s" : ""}` : "Conversa"}
            onClick={() => {
              setChatOpen((value) => !value);
              setUnreadChat(0);
            }}
          >
            <MessagesSquare className="size-4" aria-hidden="true" /> Conversa
            {unreadChat ? (
              <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-[var(--rpg-wine)] px-1 text-xs font-bold text-white">
                {unreadChat > 9 ? "9+" : unreadChat}
              </span>
            ) : null}
          </Button>
          <Button variant={diceOpen ? "default" : "outline"} className="h-11" aria-expanded={diceOpen} onClick={() => setDiceOpen((value) => !value)}>
            <Dices className="size-4" aria-hidden="true" /> Dados
          </Button>
          <AmbienceControls preset={ambience} />
          <Button variant={inspectorOpen ? "default" : "outline"} className="h-11" disabled={!selectedMap} aria-expanded={inspectorOpen && !!selectedMap} aria-controls={selectedMap ? inspectorId : undefined} onClick={() => setInspectorOpen((value) => !value)}>
            <PanelRight className="size-4" aria-hidden="true" /> Detalhes
          </Button>
          <Button size="icon-sm" variant="outline" title="Atualizar" aria-label="Atualizar mesa" onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isMaster ? (
            <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
              <DialogTrigger render={<Button size="sm" />}>
                <Plus className="h-4 w-4" /> Mapa
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo mapa</DialogTitle>
                  <DialogDescription>Crie uma grade para a campanha.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="mapName">Nome</Label>
                    <Input
                      id="mapName"
                      value={mapName}
                      onChange={(event) => setMapName(event.target.value)}
                      placeholder="Ruinas ao norte"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="mapWidth">Largura</Label>
                      <Input
                        id="mapWidth"
                        type="number"
                        min={8}
                        max={80}
                        value={mapWidth}
                        onChange={(event) => setMapWidth(event.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="mapHeight">Altura</Label>
                      <Input
                        id="mapHeight"
                        type="number"
                        min={8}
                        max={60}
                        value={mapHeight}
                        onChange={(event) => setMapHeight(event.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="mapGridSize">Escala</Label>
                      <Input
                        id="mapGridSize"
                        type="number"
                        min={1}
                        max={10}
                        value={mapGridSize}
                        onChange={(event) => setMapGridSize(event.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="mapGridColor">Cor da grade</Label>
                      <Input
                        id="mapGridColor"
                        type="color"
                        value={mapGridColor}
                        onChange={(event) => setMapGridColor(event.target.value)}
                        className="h-9 p-1"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="mapKind">Tipo</Label>
                    <select
                      id="mapKind"
                      value={mapKind}
                      onChange={(event) => setMapKind(event.target.value as VttMapKind)}
                      className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {VTT_MAP_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {VTT_MAP_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="mapImageUrl">Imagem</Label>
                    <Input
                      id="mapImageUrl"
                      value={mapImageUrl}
                      onChange={(event) => setMapImageUrl(event.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <DialogFooter>
                  <Button onClick={handleCreateMap} disabled={creatingMap || !mapName.trim()}>
                    {creatingMap ? "Criando..." : "Criar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex min-w-0 flex-col gap-4">
        <PresenceBar
          members={presence}
          connection={connection}
          isMaster={isMaster}
          followMaster={followMaster}
          onFollowChange={(value) => {
            setFollowMaster(value);
            if (!value) setStageFocus(null);
          }}
        />
        <p aria-live="polite" className="sr-only">{pingAnnouncement}</p>
        <p aria-live="assertive" className="sr-only">{combat.announcement}</p>
        <LowHpVignette danger={combat.danger} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {isMaster && suggestion ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            <span>
              {suggestion.characterName} chegou a {suggestion.mapName || "um local"}. Narração preparada:{" "}
              <strong>{suggestion.drafts[0]?.title}</strong>
              {suggestion.drafts.length > 1 ? ` (+${suggestion.drafts.length - 1})` : ""}
            </span>
            <span className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setRequestedDraftId(suggestion.drafts[0]?.id ?? null);
                  setNarrationOpen(true);
                  setSuggestion(null);
                }}
              >
                Abrir para ler
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)}>Dispensar</Button>
            </span>
          </div>
        ) : null}
        {isMaster && assistantOpen ? <MasterAssistant campaignId={campaignId} mapId={selectedMap?.id ?? null} /> : null}
        {isMaster && narrationOpen ? (
          <NarrationComposer
            campaignId={campaignId}
            currentMap={selectedMap ? { id: selectedMap.id, name: selectedMap.name } : null}
            requestedDraftId={requestedDraftId}
            onRequestHandled={clearRequestedDraft}
          />
        ) : null}
        {!selectedMap && narrations[0] ? (
          <div className="relative min-h-80 rounded-lg border border-border/70">
            <NarrationScroll narration={narrations[0]} pending={narrations.length - 1} onClose={closeNarration} />
          </div>
        ) : null}
        {chatOpen ? (
          <TableChat campaignId={campaignId} isMaster={isMaster} messages={chatMessages} onSent={receiveChat} />
        ) : null}
        {diceOpen ? (
          <div className="relative">
            <TableDiceControls
              campaignId={campaignId}
              isMaster={isMaster}
              characterId={explorationCharacterId}
              rolls={rolls}
              onRolled={receiveRoll}
            />
          </div>
        ) : null}
        {!selectedMap && trayQueue[0] ? (
          <div className="relative min-h-72 rounded-lg border border-border/70">
            <DiceTray roll={trayQueue[0]} queued={trayQueue.length - 1} onDone={dismissTray} />
          </div>
        ) : null}

        {maps.length > 0 && (!compact || maps.length > 1) ? (
          <div role="group" aria-label="Mapas da campanha" className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-border/70 pb-2">
            {maps.map((map) => (
              <Button
                key={map.id}
                size="sm"
                variant={map.id === selectedMapId ? "default" : "outline"}
                aria-pressed={map.id === selectedMapId}
                className="h-10 shrink-0"
                onClick={() => {
                  setSelectedMapId(map.id);
                  setSelectedTokenId("");
                }}
              >
                {map.name}
              </Button>
            ))}
          </div>
        ) : null}

        {selectedMap ? (
          <div className={`grid min-w-0 gap-4 ${inspectorOpen ? "@4xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}>
            <div className={`grid min-w-0 items-start gap-3 ${viewMode === "2d" ? "@3xl:grid-cols-[3.5rem_minmax(0,1fr)]" : ""}`}>
              {viewMode === "2d" ? <VttToolRail tool={tool} isMaster={isMaster} onToolChange={setTool} distance={measuredDistance} /> : null}
              <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/50 p-2">
                <div className="flex max-w-full flex-wrap items-center gap-2">
                  <div role="group" aria-label="Modo de visualização" className="flex items-center gap-1 rounded-lg border border-border/60 p-0.5">
                    <Button
                      size="icon-sm"
                      className="size-11"
                      variant={viewMode === "2d" ? "default" : "ghost"}
                      title="Vista 2D"
                      aria-label="Vista 2D"
                      aria-pressed={viewMode === "2d"}
                      onClick={() => setViewMode("2d")}
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      className="size-11"
                      variant={viewMode === "3d" ? "default" : "ghost"}
                      title="Mesa 3D"
                      aria-label="Vista 3D"
                      aria-pressed={viewMode === "3d"}
                      onClick={() => setViewMode("3d")}
                    >
                      <Box className="h-4 w-4" />
                    </Button>
                  </div>
                  {isMaster ? (
                    <>
                      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
                        <DialogTrigger render={<Button size="sm" variant="outline" />}>
                          <Plus className="h-4 w-4" /> Token
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Novo token</DialogTitle>
                            <DialogDescription>Adicione uma peça ao mapa atual.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3">
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="tokenName">Nome</Label>
                              <Input
                                id="tokenName"
                                value={tokenName}
                                onChange={(event) => setTokenName(event.target.value)}
                                placeholder="Sentinela"
                              />
                            </div>
                            <div className="grid grid-cols-[1fr_6rem] gap-3">
                              <div className="flex flex-col gap-2">
                                <Label htmlFor="tokenColor">Cor</Label>
                                <Input
                                  id="tokenColor"
                                  type="color"
                                  value={tokenColor}
                                  onChange={(event) => setTokenColor(event.target.value)}
                                  className="h-8 p-1"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <Label htmlFor="tokenSize">Tamanho</Label>
                                <Input
                                  id="tokenSize"
                                  type="number"
                                  min={1}
                                  max={6}
                                  value={tokenSize}
                                  onChange={(event) => setTokenSize(event.target.value)}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="tokenImageUrl">Imagem</Label>
                              <Input
                                id="tokenImageUrl"
                                value={tokenImageUrl}
                                onChange={(event) => setTokenImageUrl(event.target.value)}
                                placeholder="https://..."
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleCreateToken} disabled={creatingToken || !tokenName.trim()}>
                              {creatingToken ? "Criando..." : "Criar"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={markerDialogOpen} onOpenChange={setMarkerDialogOpen}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Novo marcador</DialogTitle>
                            <DialogDescription>
                              {markerPosition
                                ? `Anotação na célula ${markerPosition.x}, ${markerPosition.y}.`
                                : "Adicione uma anotação ao mapa."}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3">
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="markerLabel">Nome</Label>
                              <Input
                                id="markerLabel"
                                value={markerLabel}
                                onChange={(event) => setMarkerLabel(event.target.value)}
                                placeholder="Armadilha, porta secreta..."
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="markerColor">Cor</Label>
                              <Input
                                id="markerColor"
                                type="color"
                                value={markerColor}
                                onChange={(event) => setMarkerColor(event.target.value)}
                                className="h-8 w-16 p-1"
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="markerNote">Nota</Label>
                              <textarea
                                id="markerNote"
                                value={markerNote}
                                onChange={(event) => setMarkerNote(event.target.value)}
                                placeholder="Detalhes visíveis apenas para o mestre."
                                rows={3}
                                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                              />
                            </div>
                          </div>
                          {error ? <p className="text-sm text-destructive">{error}</p> : null}
                          <DialogFooter>
                            <Button onClick={handleCreateMarker} disabled={creatingMarker || !markerLabel.trim()}>
                              {creatingMarker ? "Criando..." : "Criar"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={hotspotDialogOpen} onOpenChange={setHotspotDialogOpen}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{editingHotspotId ? "Editar local" : "Novo local"}</DialogTitle>
                            <DialogDescription>
                              {`Área clicável a partir da célula ${hotspotX}, ${hotspotY} que pode levar a outro mapa. Ajuste a largura e a altura abaixo, ou arraste no mapa para desenhar a área diretamente.`}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3">
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="hotspotLabel">Nome</Label>
                              <Input
                                id="hotspotLabel"
                                value={hotspotLabel}
                                onChange={(event) => setHotspotLabel(event.target.value)}
                                placeholder="Taverna do Javali"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              <div className="flex flex-col gap-2">
                                <Label htmlFor="hotspotWidth">Largura</Label>
                                <Input
                                  id="hotspotWidth"
                                  type="number"
                                  min={1}
                                  max={selectedMap?.width ?? 24}
                                  value={hotspotWidth}
                                  onChange={(event) => setHotspotWidth(event.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <Label htmlFor="hotspotHeight">Altura</Label>
                                <Input
                                  id="hotspotHeight"
                                  type="number"
                                  min={1}
                                  max={selectedMap?.height ?? 16}
                                  value={hotspotHeight}
                                  onChange={(event) => setHotspotHeight(event.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <Label htmlFor="hotspotColor">Cor</Label>
                                <Input
                                  id="hotspotColor"
                                  type="color"
                                  value={hotspotColor}
                                  onChange={(event) => setHotspotColor(event.target.value)}
                                  className="h-9 p-1"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <Label htmlFor="hotspotIcon">Ícone</Label>
                                <select
                                  id="hotspotIcon"
                                  value={hotspotIcon}
                                  onChange={(event) => setHotspotIcon(event.target.value)}
                                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                                >
                                  {Object.keys(HOTSPOT_ICONS).map((iconKey) => (
                                    <option key={iconKey} value={iconKey}>
                                      {iconKey}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={hotspotVisibleToPlayers}
                                onChange={(event) => setHotspotVisibleToPlayers(event.target.checked)}
                              />
                              Visível para jogadores
                            </label>
                            <div className="flex flex-col gap-2">
                              <Label>Destino</Label>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={hotspotTargetMode === "none" ? "default" : "outline"}
                                  onClick={() => setHotspotTargetMode("none")}
                                >
                                  Sem destino
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={hotspotTargetMode === "existing" ? "default" : "outline"}
                                  onClick={() => setHotspotTargetMode("existing")}
                                >
                                  Mapa existente
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={hotspotTargetMode === "new" ? "default" : "outline"}
                                  disabled={Boolean(editingHotspot?.targetMapId)}
                                  onClick={() => setHotspotTargetMode("new")}
                                >
                                  Criar novo mapa
                                </Button>
                              </div>
                            </div>
                            {hotspotTargetMode === "existing" ? (
                              <div className="flex flex-col gap-2">
                                <Label htmlFor="hotspotTargetMap">Mapa vinculado</Label>
                                <select
                                  id="hotspotTargetMap"
                                  value={hotspotTargetMapId}
                                  onChange={(event) => setHotspotTargetMapId(event.target.value)}
                                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                                >
                                  <option value="">Selecione...</option>
                                  {availableTargetMaps.map((map) => (
                                    <option key={map.id} value={map.id}>
                                      {map.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}
                            {hotspotTargetMode === "new" ? (
                              <div className="grid grid-cols-[1fr_10rem] gap-3">
                                <div className="flex flex-col gap-2">
                                  <Label htmlFor="hotspotNewMapName">Nome do novo mapa</Label>
                                  <Input
                                    id="hotspotNewMapName"
                                    value={hotspotNewMapName}
                                    onChange={(event) => setHotspotNewMapName(event.target.value)}
                                    placeholder="Taverna do Javali - interior"
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Label htmlFor="hotspotNewMapKind">Tipo</Label>
                                  <select
                                    id="hotspotNewMapKind"
                                    value={hotspotNewMapKind}
                                    onChange={(event) => setHotspotNewMapKind(event.target.value as VttMapKind)}
                                    className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                                  >
                                    {VTT_MAP_KINDS.map((kind) => (
                                      <option key={kind} value={kind}>
                                        {VTT_MAP_KIND_LABELS[kind]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ) : null}
                            {hotspotTargetMode !== "none" ? (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-2">
                                  <Label htmlFor="hotspotTravelActionCost">Custo (pontos de ação)</Label>
                                  <Input
                                    id="hotspotTravelActionCost"
                                    type="number"
                                    min={0}
                                    value={hotspotTravelActionCost}
                                    onChange={(event) => setHotspotTravelActionCost(event.target.value)}
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Label htmlFor="hotspotTravelMinutes">Tempo de viagem (minutos)</Label>
                                  <Input
                                    id="hotspotTravelMinutes"
                                    type="number"
                                    min={0}
                                    value={hotspotTravelMinutes}
                                    onChange={(event) => setHotspotTravelMinutes(event.target.value)}
                                  />
                                </div>
                              </div>
                            ) : null}
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="hotspotEventNote">Nota do evento (visível só ao mestre)</Label>
                              <textarea
                                id="hotspotEventNote"
                                value={hotspotEventNote}
                                onChange={(event) => setHotspotEventNote(event.target.value)}
                                placeholder="O que existe ou acontece neste local..."
                                rows={3}
                                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="hotspotTriggerJournalCategory">
                                Registrar no diário ao ser visitado pela primeira vez
                              </Label>
                              <select
                                id="hotspotTriggerJournalCategory"
                                value={hotspotTriggerJournalCategory}
                                onChange={(event) =>
                                  setHotspotTriggerJournalCategory(event.target.value as JournalCategory | "")
                                }
                                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                              >
                                <option value="">Nenhuma</option>
                                {JOURNAL_CATEGORIES.map((category) => (
                                  <option key={category} value={category}>
                                    {JOURNAL_CATEGORY_LABELS[category]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {error ? <p className="text-sm text-destructive">{error}</p> : null}
                          <DialogFooter className="sm:justify-between">
                            {editingHotspot ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => handleDeleteHotspot(editingHotspot)}
                              >
                                <Trash2 className="h-4 w-4" /> Excluir
                              </Button>
                            ) : (
                              <span />
                            )}
                            <Button
                              onClick={handleSaveHotspot}
                              disabled={
                                savingHotspot ||
                                !hotspotLabel.trim() ||
                                (hotspotTargetMode === "existing" && !hotspotTargetMapId) ||
                                (hotspotTargetMode === "new" && !hotspotNewMapName.trim())
                              }
                            >
                              {savingHotspot ? "Salvando..." : "Salvar"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive"
                        title="Excluir mapa"
                        aria-label="Excluir mapa atual"
                        onClick={handleDeleteMap}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              {mapPath.length > 1 ? (
                <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                  {mapPath.map((map, index) => (
                    <span key={map.id} className="flex items-center gap-1">
                      {index > 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
                      <button
                        type="button"
                        disabled={map.id === selectedMap.id}
                        onClick={() => {
                          setSelectedMapId(map.id);
                          setSelectedTokenId("");
                          setSelectedMarkerId("");
                        }}
                        className={
                          map.id === selectedMap.id
                            ? "font-medium text-foreground"
                            : "hover:text-foreground hover:underline"
                        }
                      >
                        {map.name}
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="relative min-w-0">
              <ArrivalCard arrival={arrival} when={arrivalWhen} onDone={dismissArrival} />
              <TurnBannerView banner={combat.banner} />
              <WorldEventCard event={lastEvent} />
              <NarrationScroll narration={narrations[0] ?? null} pending={Math.max(0, narrations.length - 1)} onClose={closeNarration} />
              <DiceTray roll={trayQueue[0] ?? null} queued={Math.max(0, trayQueue.length - 1)} onDone={dismissTray} />
              {viewMode === "3d" ? (
                <div
                  className="relative overflow-hidden rounded-lg border border-primary/30 bg-[#262b27] shadow-inner shadow-black/40"
                  style={{
                    aspectRatio:
                      selectedMap.imageUrl && imageNaturalSize
                        ? `${imageNaturalSize.width}/${imageNaturalSize.height}`
                        : `${selectedMap.width}/${selectedMap.height}`,
                  }}
                >
                  <VttTable3D
                    key={selectedMap.id}
                    map={{...selectedMap,imageUrl:renderedMapImageUrl}}
                    tokens={visibleTokens}
                    selectedTokenId={selectedTokenId}
                    isMaster={isMaster}
                    imageNaturalSize={selectedMap.imageUrl ? imageNaturalSize : null}
                    fogCells={selectedMap.fogCells}
                    pings={pings.filter((ping) => ping.mapId === selectedMap.id)}
                    lighting={lighting ?? DAY_PHASE_STYLES.DIA}
                    focus={activeFocus}
                    onFocusHandled={handleFocusHandled}
                    onSelectToken={setSelectedTokenId}
                    onMoveToken={(mapToken, x, y) => updateToken(mapToken, { x, y })}
                  />
                </div>
              ) : (
                <MapStage key={selectedMap.id} label={selectedMap.name} compact={compact} focus={activeFocus} onFocusHandled={handleFocusHandled} aspectRatio={selectedMap.imageUrl && imageNaturalSize ? imageNaturalSize.width / imageNaturalSize.height : selectedMap.width / selectedMap.height}>
                <div
                  className="relative overflow-hidden rounded-lg border border-primary/30 bg-[#262b27] shadow-inner shadow-black/40"
                  style={{
                    aspectRatio:
                      selectedMap.imageUrl && imageNaturalSize
                        ? `${imageNaturalSize.width}/${imageNaturalSize.height}`
                        : `${selectedMap.width}/${selectedMap.height}`,
                    backgroundImage: renderedMapImageUrl ? `url(${renderedMapImageUrl})` : undefined,
                    backgroundPosition: "center",
                    backgroundSize: selectedMap.imageUrl && imageNaturalSize ? "100% 100%" : "cover",
                  }}
                >
                  {lighting ? <DayNightOverlay lighting={lighting} /> : null}
                  <WeatherLayer weather={weather} outdoors={outdoors} particles={weatherParticles} />
                  <div
                    className="absolute inset-0 grid"
                    style={{
                      gridTemplateColumns: `repeat(${selectedMap.width}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${selectedMap.height}, minmax(0, 1fr))`,
                    }}
                  >
                    {renderGridCells(selectedMap)}
                  </div>
                  {selectedMap.hotspots.map((hotspot) => renderHotspot(hotspot, selectedMap))}
                  {renderHotspotDragPreview(selectedMap)}
                  {renderMeasurementLine(selectedMap)}
                  <WallsLayer
                    walls={selectedMap.walls ?? []}
                    width={selectedMap.width}
                    height={selectedMap.height}
                    canToggleDoors={isMaster || ownsAnyToken}
                    onToggleDoor={(wall) => void toggleDoor(wall)}
                    previewHidden={previewMap?.id === selectedMap.id ? previewHidden : null}
                  />
                  {visibleTokens.map((mapToken) => renderToken(mapToken, selectedMap))}
                  {selectedMap.markers.map((marker) => renderMarker(marker, selectedMap))}
                  <PingLayer pings={pings.filter((ping) => ping.mapId === selectedMap.id)} width={selectedMap.width} height={selectedMap.height} />
                  <CombatFloatLayer floats={combat.floats} positions={combatTokenPositions(selectedMap)} />
                </div>
                </MapStage>
              )}
              </div>
              </div>
            </div>

            <div id={inspectorId} className={`${inspectorOpen ? "flex" : "hidden"} order-first min-w-0 flex-col gap-3 @4xl:order-last`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-base">Detalhes do cenário</h3>
                <Button variant="ghost" className="h-11" onClick={() => setInspectorOpen(false)}>Recolher</Button>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/35 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium">{selectedMap.name}</div>
                  <Badge variant="outline">{selectedMap.fogCells.length} fog</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Grade {selectedMap.width}x{selectedMap.height} · escala {selectedMap.gridSize}
                </div>
                {isMaster ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Label htmlFor="gridColor" className="text-sm text-muted-foreground">
                      Cor da grade
                    </Label>
                    <Input
                      id="gridColor"
                      type="color"
                      value={selectedMap.gridColor}
                      onChange={(event) => updateMapGridColor(event.target.value)}
                      className="h-8 w-16 p-1"
                    />
                  </div>
                ) : null}
                {isMaster ? (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <Label htmlFor="mapLightingMode" className="text-sm text-muted-foreground">
                      Iluminação
                    </Label>
                    <select
                      id="mapLightingMode"
                      value={selectedMap.lightingMode ?? "AUTO"}
                      onChange={(event) => updateMapLightingMode(event.target.value as VttLightingMode)}
                      className="min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {VTT_LIGHTING_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {VTT_LIGHTING_MODE_LABELS[mode]}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {isMaster ? (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <Label htmlFor="mapAmbiencePreset" className="text-sm text-muted-foreground">
                      Ambiente sonoro
                    </Label>
                    <select
                      id="mapAmbiencePreset"
                      value={selectedMap.ambiencePreset ?? ""}
                      onChange={(event) => updateMapAmbience((event.target.value || null) as AmbiencePreset | null)}
                      className="min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      <option value="">
                        Automático ({AMBIENCE_PRESET_LABELS[resolveAmbience(selectedMap.kind, null)]})
                      </option>
                      {AMBIENCE_PRESETS.map((preset) => (
                        <option key={preset} value={preset}>
                          {AMBIENCE_PRESET_LABELS[preset]}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {isMaster ? (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <Label htmlFor="mapVisionMode" className="text-sm text-muted-foreground">
                      Visão dinâmica
                    </Label>
                    <select
                      id="mapVisionMode"
                      value={selectedMap.vision ?? "OFF"}
                      onChange={(event) => void updateMapVision(event.target.value as VttVisionMode)}
                      className="min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {(Object.keys(VTT_VISION_MODE_LABELS) as VttVisionMode[]).map((mode) => (
                        <option key={mode} value={mode}>
                          {VTT_VISION_MODE_LABELS[mode]}
                        </option>
                      ))}
                    </select>
                    {selectedMap.vision !== "OFF" && !selectedMap.tokens.some((item) => item.ownerId && item.ownerId !== meId) ? (
                      <p className="text-xs text-[#d47779]">Nenhum token de jogador neste mapa: com a visão ligada, os jogadores não veem nada.</p>
                    ) : null}
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={previewPlayers}
                        onChange={(event) => {
                          setPreviewPlayers(event.target.checked);
                          if (!event.target.checked) setPreviewHidden(null);
                        }}
                        className="size-4 accent-[var(--rpg-bronze)]"
                      />
                      Ver como jogadores (escurece o que eles não veem)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {selectedMap.walls?.length ?? 0} parede(s) e porta(s). Use as ferramentas Parede e Porta na barra lateral.
                    </p>
                  </div>
                ) : null}
                {lighting ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Luz atual: {lighting.label}
                    {ambience ? ` · Som: ${AMBIENCE_PRESET_LABELS[ambience]}` : ""}
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-border/70 bg-background/35 p-3">
                <div className="mb-2 font-medium">Tokens</div>
                <div className="flex max-h-64 flex-col gap-2 overflow-auto pr-1">
                  {visibleTokens.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum token.</p>
                  ) : (
                    visibleTokens.map((mapToken) => (
                      <button
                        key={mapToken.id}
                        type="button"
                        onClick={() => setSelectedTokenId(mapToken.id)}
                        className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-left text-sm transition-colors ${
                          selectedTokenId === mapToken.id
                            ? "border-primary bg-primary/10"
                            : "border-border/60 hover:bg-muted"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full border border-white/50"
                            style={{ backgroundColor: mapToken.color }}
                          />
                          <span className="truncate">{mapToken.name}</span>
                        </span>
                        {mapToken.visible ? (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedToken && isMaster ? (
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="font-medium">{selectedToken.name}</div>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-destructive"
                      title="Excluir token"
                      onClick={() => handleRemoveToken(selectedToken)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span />
                    <Button
                      size="icon-sm"
                      variant="outline"
                      title="Subir"
                      onClick={() => updateToken(selectedToken, { y: selectedToken.y - 1 })}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <span />
                    <Button
                      size="icon-sm"
                      variant="outline"
                      title="Esquerda"
                      onClick={() => updateToken(selectedToken, { x: selectedToken.x - 1 })}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      title={selectedToken.visible ? "Ocultar" : "Mostrar"}
                      onClick={() => updateToken(selectedToken, { visible: !selectedToken.visible })}
                    >
                      {selectedToken.visible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      title="Direita"
                      onClick={() => updateToken(selectedToken, { x: selectedToken.x + 1 })}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <span />
                    <Button
                      size="icon-sm"
                      variant="outline"
                      title="Descer"
                      onClick={() => updateToken(selectedToken, { y: selectedToken.y + 1 })}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <span />
                  </div>
                </div>
              ) : null}

              {isMaster && selectedToken ? (
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 font-medium">Luz e visão de {selectedToken.name}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="tokenLight" className="text-xs text-muted-foreground">Luz (células)</Label>
                      <Input
                        id="tokenLight"
                        type="number"
                        min={0}
                        max={30}
                        key={`light-${selectedToken.id}-${selectedToken.lightRadius}`}
                        defaultValue={selectedToken.lightRadius ?? 0}
                        onBlur={(event) => {
                          const value = Math.max(0, Math.min(30, Math.trunc(Number(event.target.value)) || 0));
                          if (value !== selectedToken.lightRadius) void updateToken(selectedToken, { lightRadius: value });
                        }}
                        className="h-11"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="tokenDarkvision" className="text-xs text-muted-foreground">Visão no escuro</Label>
                      <Input
                        id="tokenDarkvision"
                        type="number"
                        min={0}
                        max={30}
                        key={`vision-${selectedToken.id}-${selectedToken.visionRadius}`}
                        defaultValue={selectedToken.visionRadius ?? 0}
                        onBlur={(event) => {
                          const value = Math.max(0, Math.min(30, Math.trunc(Number(event.target.value)) || 0));
                          if (value !== selectedToken.visionRadius) void updateToken(selectedToken, { visionRadius: value });
                        }}
                        className="h-11"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Tocha ≈ 4; lanterna ≈ 6. Só tokens ligados a personagens de jogadores enxergam.</p>
                </div>
              ) : null}

              {selectedMap.markers.length > 0 ? (
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 font-medium">Marcadores</div>
                  <div className="flex max-h-64 flex-col gap-2 overflow-auto pr-1">
                    {selectedMap.markers.map((marker) => (
                      <button
                        key={marker.id}
                        type="button"
                        onClick={() => setSelectedMarkerId(marker.id)}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition-colors ${
                          selectedMarkerId === marker.id
                            ? "border-primary bg-primary/10"
                            : "border-border/60 hover:bg-muted"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: marker.color }} />
                          <span className="truncate">{marker.label}</span>
                        </span>
                        {isMaster ? (
                          <Trash2
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleRemoveMarker(marker);
                            }}
                          />
                        ) : null}
                      </button>
                    ))}
                  </div>
                  {selectedMarker?.note ? (
                    <p className="mt-2 text-sm text-muted-foreground">{selectedMarker.note}</p>
                  ) : null}
                </div>
              ) : null}

              {selectedMap.hotspots.length > 0 ? (
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="font-medium">Locais</div>
                    <Badge variant="outline">{selectedMap.hotspots.length}</Badge>
                  </div>
                  <div className="flex max-h-64 flex-col gap-2 overflow-auto pr-1">
                    {selectedMap.hotspots
                      .filter((hotspot) => isMaster || hotspot.visibleToPlayers)
                      .map((hotspot) => {
                        const Icon = hotspotIconComponent(hotspot.icon);
                        const locked = isHotspotLocked(hotspot);
                        return (
                          <button
                            key={hotspot.id}
                            type="button"
                            onClick={() => void handleHotspotClick(hotspot)}
                            className={`flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
                              locked ? "opacity-60" : ""
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: hotspot.color }} />
                              <span className="truncate">{hotspot.label}</span>
                              {!hotspot.visibleToPlayers ? (
                                <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ) : null}
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                              {hotspot.targetMapId ? (
                                <Badge variant="outline" className="text-xs">
                                  {hotspot.travelActionCost} PA
                                </Badge>
                              ) : null}
                              {locked ? (
                                <Lock className="h-3.5 w-3.5" />
                              ) : hotspot.targetMapId ? (
                                <ArrowRight className="h-3.5 w-3.5" />
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-primary/35 bg-background/40 px-4 py-10 text-center">
            <MapIcon className="size-10 text-primary/60" aria-hidden="true" />
            <p className="font-heading text-lg text-foreground">A mesa aguarda um cenário</p>
            <p className="text-sm text-muted-foreground">
              {isMaster ? "Crie um mapa para abrir a aventura." : "O mestre ainda não criou um mapa."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
