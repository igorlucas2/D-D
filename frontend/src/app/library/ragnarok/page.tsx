"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Database,
  Search,
  Sparkles,
  Sword,
  UserRound,
  Waypoints,
} from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

type Tab = "classes" | "items" | "skills" | "maps";

interface Summary {
  jobs: number;
  skills: number;
  items: number;
  maps: number;
  costumes: number;
}

interface Job {
  id: number;
  jt: string;
  name: string;
  hasIcon: boolean;
}

interface Item {
  id: number;
  name: string;
  slots: number;
  aegisName: string | null;
  resourceName: string | null;
  view: number | null;
  costume: boolean;
  equipSlots: unknown;
}

interface Skill {
  id: number;
  name: string;
  maxLevel: number;
  delay: unknown;
  description: string | null;
}

interface MapEntry {
  name: string;
}

const TABS: Array<{ id: Tab; label: string; icon: typeof UserRound }> = [
  { id: "classes", label: "Classes", icon: UserRound },
  { id: "items", label: "Itens", icon: Sword },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "maps", label: "Mapas", icon: Waypoints },
];

function cleanDescription(value: string | null): string {
  if (!value) return "Sem descrição.";
  return value
    .replace(/\^[0-9a-fA-F]{6}/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

function RagnarokContent() {
  const token = useAuthStore((state) => state.token);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState<Tab>("classes");
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [maps, setMaps] = useState<MapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .get<Summary>("/ragnarok/summary", token)
      .then(setSummary)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Falha ao carregar o catálogo.",
        ),
      );
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza a consulta com a busca */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const query = search.trim()
      ? `&search=${encodeURIComponent(search.trim())}`
      : "";
    const request =
      tab === "classes"
        ? api.get<Job[]>(`/ragnarok/classes?x=1${query}`, token)
        : tab === "items"
          ? api.get<Item[]>(`/ragnarok/items?take=100${query}`, token)
          : tab === "skills"
            ? api.get<Skill[]>(`/ragnarok/skills?take=100${query}`, token)
            : api.get<MapEntry[]>(`/ragnarok/maps?${query.slice(1)}`, token);

    request
      .then((data) => {
        if (cancelled) return;
        if (tab === "classes") setJobs(data as Job[]);
        if (tab === "items") setItems(data as Item[]);
        if (tab === "skills") setSkills(data as Skill[]);
        if (tab === "maps") setMaps(data as MapEntry[]);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof ApiError
              ? err.message
              : "Falha ao consultar o catálogo.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, search, token]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="font-heading text-sm font-medium uppercase tracking-[0.3em] text-primary">
            Outro jogo, mesma mesa
          </span>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Database className="size-7" /> Ragnarok Online
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Base de classes, habilidades, itens e mapas do cliente LATAM. É um
            catálogo separado: não altera as fichas SRD da mesa narrada.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            nativeButton={false}
            render={<Link href="/library/ragnarok/characters" />}
          >
            <UserRound className="size-4" /> Fichas
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            nativeButton={false}
            render={<Link href="/library" />}
          >
            <ArrowLeft className="size-4" /> Biblioteca
          </Button>
        </div>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Classes
            </p>
            <p className="font-heading text-2xl">{summary.jobs}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Skills
            </p>
            <p className="font-heading text-2xl">{summary.skills}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Itens
            </p>
            <p className="font-heading text-2xl">{summary.items}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Mapas
            </p>
            <p className="font-heading text-2xl">{summary.maps}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Buscar ${tab === "classes" ? "classe" : tab === "items" ? "item" : tab === "skills" ? "skill" : "mapa"}…`}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "default" : "outline"}
              className="gap-1"
              onClick={() => setTab(id)}
            >
              <Icon className="size-3.5" /> {label}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Consultando o catálogo…</p>
      ) : null}

      {!loading && tab === "classes" ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/70 p-3"
            >
              <img
                src={`https://assets.latam-tools.com.br/image?job=${job.id}&action=0&frame=0`}
                alt=""
                className="size-10 rounded-md border border-border/60 object-contain"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{job.name}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {job.jt} · #{job.id}
                </p>
              </div>
            </div>
          ))}
          {!jobs.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma classe encontrada.
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && tab === "items" ? (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{item.name}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  #{item.id}
                  {item.aegisName ? ` · ${item.aegisName}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {item.slots > 0 ? (
                  <Badge variant="outline" className="text-[9px]">
                    {item.slots} slot(s)
                  </Badge>
                ) : null}
                {item.costume ? (
                  <Badge className="text-[9px]">visual</Badge>
                ) : null}
              </div>
            </div>
          ))}
          {!items.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum item encontrado.
            </p>
          ) : null}
          {items.length === 100 ? (
            <p className="pt-2 text-xs text-muted-foreground">
              Mostrando os primeiros 100; refine a busca.
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && tab === "skills" ? (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="rounded-xl border border-border/70 bg-card/60 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{skill.name}</p>
                <Badge variant="outline" className="text-[9px]">
                  Nv {skill.maxLevel}
                </Badge>
                <span className="font-mono text-[10px] text-muted-foreground">
                  #{skill.id}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {cleanDescription(skill.description)}
              </p>
            </div>
          ))}
          {!skills.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma skill encontrada.
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && tab === "maps" ? (
        <div className="flex flex-wrap gap-1">
          {maps.map((map) => (
            <Badge
              key={map.name}
              variant="outline"
              className="font-mono text-[10px]"
            >
              {map.name}
            </Badge>
          ))}
          {!maps.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum mapa encontrado.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function RagnarokPage() {
  return (
    <RequireAuth>
      <RagnarokContent />
    </RequireAuth>
  );
}
