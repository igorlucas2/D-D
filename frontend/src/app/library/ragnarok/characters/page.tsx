"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, UserRound } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

interface Job {
  id: number;
  jt: string;
  name: string;
}

interface RagnarokCharacter {
  id: string;
  name: string;
  jobId: number;
  level: number;
  strength: number;
  agility: number;
  vitality: number;
  intelligence: number;
  dexterity: number;
  luck: number;
  appearance: string | null;
  maxHp: number;
  currentHp: number;
  maxSp: number;
  currentSp: number;
  skills: Array<{
    id: string;
    level: number;
    skill: { id: number; name: string; maxLevel: number };
  }>;
  job: Job;
}

const STATS = [
  ["strength", "FOR"],
  ["agility", "AGI"],
  ["vitality", "VIT"],
  ["intelligence", "INT"],
  ["dexterity", "DES"],
  ["luck", "SOR"],
] as const;

function RagnarokCharactersContent() {
  const token = useAuthStore((state) => state.token);
  const [characters, setCharacters] = useState<RagnarokCharacter[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [name, setName] = useState("");
  const [appearanceUrl, setAppearanceUrl] = useState("");
  const [jobId, setJobId] = useState("");
  const [level, setLevel] = useState("1");
  const [stats, setStats] = useState<Record<string, string>>({
    strength: "1",
    agility: "1",
    vitality: "1",
    intelligence: "1",
    dexterity: "1",
    luck: "1",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skillCharacterId, setSkillCharacterId] = useState("");
  const [skillSearch, setSkillSearch] = useState("");
  const [skillResults, setSkillResults] = useState<
    Array<{ id: number; name: string; maxLevel: number }>
  >([]);
  const [skillChoice, setSkillChoice] = useState("");
  const [skillLevel, setSkillLevel] = useState("1");
  const [skillBusy, setSkillBusy] = useState(false);

  useEffect(() => {
    if (!token || skillSearch.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa a busca curta
      setSkillResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.get<
          Array<{ id: number; name: string; maxLevel: number }>
        >(
          `/ragnarok/skills?take=20&search=${encodeURIComponent(skillSearch.trim())}`,
          token,
        );
        if (!cancelled) {
          setSkillResults(result);
          setSkillChoice(String(result[0]?.id ?? ""));
        }
      } catch {
        if (!cancelled) setSkillResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [skillSearch, token]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [roster, classes] = await Promise.all([
        api.get<RagnarokCharacter[]>("/ragnarok/characters", token),
        api.get<Job[]>("/ragnarok/classes", token),
      ]);
      setCharacters(roster);
      setJobs(classes);
      setJobId((current) => current || String(classes[0]?.id ?? ""));
      setSkillCharacterId((current) => current || roster[0]?.id || "");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao carregar fichas.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void load();
  }, [load]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<RagnarokCharacter>(
        "/ragnarok/characters",
        {
          name: name.trim(),
          jobId: Number(jobId),
          level: Number(level) || 1,
          ...Object.fromEntries(
            STATS.map(([key]) => [key, Number(stats[key]) || 1]),
          ),
          appearance: appearanceUrl.trim() || undefined,
        },
        token,
      );
      setCharacters((current) => [...current, created]);
      setName("");
      setAppearanceUrl("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao criar ficha.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!token) return;
    try {
      await api.delete(`/ragnarok/characters/${id}`, token);
      setCharacters((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao remover ficha.",
      );
    }
  }

  async function learnSkill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !skillCharacterId || !skillChoice || skillBusy) return;
    setSkillBusy(true);
    setError(null);
    try {
      const updated = await api.post<RagnarokCharacter>(
        `/ragnarok/characters/${skillCharacterId}/skills`,
        { skillId: Number(skillChoice), level: Number(skillLevel) || 1 },
        token,
      );
      setCharacters((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSkillSearch("");
      setSkillResults([]);
      setSkillChoice("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao aprender skill.",
      );
    } finally {
      setSkillBusy(false);
    }
  }

  async function forgetSkill(characterId: string, skillId: number) {
    if (!token) return;
    try {
      const updated = await api.delete<RagnarokCharacter>(
        `/ragnarok/characters/${characterId}/skills/${skillId}`,
        token,
      );
      if (updated) {
        setCharacters((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Falha ao remover skill.",
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="font-heading text-sm font-medium uppercase tracking-[0.3em] text-primary">
            Outro jogo, mesma conta
          </span>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight">
            <UserRound className="size-7" /> Fichas Ragnarok
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Fichas separadas do SRD, usando as classes do cliente LATAM. Ainda é
            uma base de estudo; não entram no combate 5e.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            nativeButton={false}
            render={<Link href="/library/ragnarok" />}
          >
            <ArrowLeft className="size-4" /> Catálogo
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            nativeButton={false}
            render={<Link href="/library" />}
          >
            Biblioteca
          </Button>
        </div>
      </div>

      <form
        onSubmit={(event) => void create(event)}
        className="space-y-3 rounded-xl border border-primary/25 bg-card/70 p-4"
      >
        <p className="font-heading text-lg">Nova ficha</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ro-name">Nome</Label>
            <Input
              id="ro-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ro-job">Classe</Label>
            <select
              id="ro-job"
              value={jobId}
              onChange={(event) => setJobId(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name} ({job.jt})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ro-level">Nível</Label>
            <Input
              id="ro-level"
              type="number"
              min={1}
              max={200}
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="ro-appearance">Link do visual (opcional)</Label>
            <Input
              id="ro-appearance"
              value={appearanceUrl}
              onChange={(event) => setAppearanceUrl(event.target.value)}
              placeholder="https://visuais.latam-tools.com.br/?b=..."
            />
          </div>
          <div className="grid grid-cols-6 gap-1">
            {STATS.map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`ro-${key}`} className="text-[10px]">
                  {label}
                </Label>
                <Input
                  id={`ro-${key}`}
                  type="number"
                  min={1}
                  max={999}
                  value={stats[key]}
                  onChange={(event) =>
                    setStats((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="h-9 px-1 text-center"
                />
              </div>
            ))}
          </div>
        </div>
        <Button type="submit" className="gap-2" disabled={busy || !name.trim()}>
          <Plus className="size-4" /> {busy ? "Criando…" : "Criar ficha"}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>

      <form
        onSubmit={(event) => void learnSkill(event)}
        className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-4"
      >
        <p className="font-heading text-lg">Aprender skill</p>
        <div className="grid gap-2 sm:grid-cols-4">
          <select
            aria-label="Ficha para skill"
            value={skillCharacterId}
            onChange={(event) => setSkillCharacterId(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
          <Input
            value={skillSearch}
            onChange={(event) => setSkillSearch(event.target.value)}
            placeholder="Buscar skill…"
            className="h-9"
            aria-label="Buscar skill"
          />
          <select
            aria-label="Skill"
            value={skillChoice}
            onChange={(event) => setSkillChoice(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {skillResults.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name} (Nv {skill.maxLevel})
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <Input
              aria-label="Nível da skill"
              type="number"
              min={1}
              max={10}
              value={skillLevel}
              onChange={(event) => setSkillLevel(event.target.value)}
              className="h-9 w-16"
            />
            <Button
              type="submit"
              className="h-9 flex-1"
              disabled={skillBusy || !skillCharacterId || !skillChoice}
            >
              {skillBusy ? "…" : "Aprender"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Digite ao menos 2 letras para buscar entre as 1.732 skills.
        </p>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando fichas…</p>
      ) : characters.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {characters.map((character) => (
            <article
              key={character.id}
              className="rounded-xl border border-border/70 bg-card/70 p-4"
            >
              <div className="flex items-start gap-3">
                <img
                  src={`https://assets.latam-tools.com.br/image?job=${character.jobId}&action=0&frame=0`}
                  alt=""
                  className="size-14 rounded-lg border border-border/60 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-lg">
                    {character.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {character.job.name} · Nv {character.level}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  aria-label={`Remover ${character.name}`}
                  onClick={() => void remove(character.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-6 gap-1">
                {STATS.map(([key, label]) => (
                  <div
                    key={key}
                    className="rounded-md border border-border/60 bg-background/40 px-1 py-1 text-center"
                  >
                    <p className="text-[9px] text-muted-foreground">{label}</p>
                    <p className="font-mono text-xs">{character[key]}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-md border border-border/60 bg-background/40 px-2 py-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">HP</span>
                    <span className="font-mono">
                      {character.currentHp}/{character.maxHp}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.min(100, (character.currentHp / Math.max(1, character.maxHp)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background/40 px-2 py-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SP</span>
                    <span className="font-mono">
                      {character.currentSp}/{character.maxSp}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-sky-500"
                      style={{
                        width: `${Math.min(100, (character.currentSp / Math.max(1, character.maxSp)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {character.skills.map((entry) => (
                  <Badge
                    key={entry.id}
                    variant="secondary"
                    className="gap-1 text-[9px]"
                  >
                    {entry.skill.name} Nv {entry.level}
                    <button
                      type="button"
                      aria-label={`Remover ${entry.skill.name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        void forgetSkill(character.id, entry.skill.id)
                      }
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                {!character.skills.length ? (
                  <span className="text-[10px] text-muted-foreground">
                    Nenhuma skill aprendida.
                  </span>
                ) : null}
              </div>
              <Badge variant="outline" className="mt-3 font-mono text-[10px]">
                {character.job.jt}
              </Badge>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma ficha Ragnarok ainda.
        </p>
      )}
    </div>
  );
}

export default function RagnarokCharactersPage() {
  return (
    <RequireAuth>
      <RagnarokCharactersContent />
    </RequireAuth>
  );
}
