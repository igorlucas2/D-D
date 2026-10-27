"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Compass, Crown, Shield, Sparkles, Swords } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AmbientParticles } from "@/components/ornamental/ambient-particles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import type { Achievement, Character, UserProfile } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

const XP_PER_LEVEL = 1000;

function DashboardContent() {
  const token = useAuthStore((state) => state.token);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadDashboard() {
      try {
        const [profileData, charactersData, achievementsData] = await Promise.all([
          api.get<UserProfile>("/users/me", token),
          api.get<Character[]>("/characters", token),
          api.get<Achievement[]>("/users/me/achievements", token),
        ]);

        if (!cancelled) {
          setProfile(profileData);
          setCharacters(charactersData);
          setAchievements(achievementsData);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading || !profile) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const xpIntoLevel = profile.accountXp % XP_PER_LEVEL;
  const xpProgress = (xpIntoLevel / XP_PER_LEVEL) * 100;

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <AmbientParticles className="-z-10" />

      <header className="relative isolate overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(115deg,rgba(71,37,31,0.92),rgba(30,30,28,0.97)_58%,rgba(35,42,34,0.95))] px-6 py-8 shadow-2xl sm:px-9 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-xl border border-primary/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 size-64 rounded-full border border-primary/10 shadow-[0_0_0_35px_rgba(197,148,72,0.04),0_0_0_80px_rgba(197,148,72,0.03)]" />
        <div className="relative max-w-2xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <Compass className="size-4" aria-hidden="true" /> Salão de aventuras
          </p>
          <h1 className="font-heading text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            Sua próxima história começa aqui, {profile.displayName}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Reúna sua companhia, retome uma campanha e prepare o próximo capítulo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button nativeButton={false} render={<Link href="/campaigns" />}>
              <BookOpen className="size-4" aria-hidden="true" /> Abrir campanhas
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/characters/new" />}>
              <Swords className="size-4" aria-hidden="true" /> Criar personagem
            </Button>
          </div>
        </div>
      </header>

      <section aria-label="Seu progresso" className="grid gap-3 sm:grid-cols-3">
        <Card className="border-primary/15 bg-card/85">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
            <div>
              <CardDescription className="text-xs uppercase tracking-wider">Nível da conta</CardDescription>
              <CardTitle className="mt-1 font-heading text-3xl">{profile.accountLevel}</CardTitle>
            </div>
            <span className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary"><Crown className="size-5" aria-hidden="true" /></span>
          </CardHeader>
          <CardContent>
            <Progress value={xpProgress} aria-label="Progresso até o próximo nível" />
            <p className="mt-2 text-xs text-muted-foreground">{xpIntoLevel} / {XP_PER_LEVEL} XP para o próximo nível</p>
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-card/85">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
            <div>
              <CardDescription className="text-xs uppercase tracking-wider">Personagens</CardDescription>
              <CardTitle className="mt-1 font-heading text-3xl">{profile._count.characters}</CardTitle>
            </div>
            <span className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary"><Shield className="size-5" aria-hidden="true" /></span>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="ghost" className="-ml-3 text-primary" nativeButton={false} render={<Link href="/characters/new" />}>
              Criar personagem <ArrowUpRight className="size-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-card/85">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
            <div>
              <CardDescription className="text-xs uppercase tracking-wider">Conquistas desbloqueadas</CardDescription>
              <CardTitle className="mt-1 font-heading text-3xl">{achievements.filter((a) => a.unlocked).length} <span className="text-base text-muted-foreground">/ {achievements.length}</span></CardTitle>
            </div>
            <span className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary"><Sparkles className="size-5" aria-hidden="true" /></span>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {achievements.map((achievement) => (
              <Badge key={achievement.id} variant={achievement.unlocked ? "default" : "outline"}>
                {achievement.name}
              </Badge>
            ))}
            {achievements.length === 0 ? <p className="text-xs text-muted-foreground">Suas conquistas aparecerão aqui.</p> : null}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="characters-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-primary/20 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Sua companhia</p>
            <h2 id="characters-heading" className="mt-1 font-heading text-2xl">Seus personagens</h2>
          </div>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/characters" />}>
            Ver todos <ArrowUpRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {characters.length === 0 ? (
          <Card className="parchment frame-ornate">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Swords className="size-8 text-primary" aria-hidden="true" />
              <p className="font-heading text-lg">Toda lenda começa com um herói.</p>
              <p className="text-sm text-muted-foreground">Você ainda não criou nenhum personagem.</p>
              <Button nativeButton={false} render={<Link href="/characters/new" />}>Criar meu primeiro personagem</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {characters.slice(0, 6).map((character) => (
              <Link key={character.id} href={`/characters/${character.id}`} className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                <Card className="h-full overflow-hidden border-primary/15 bg-card/90 transition-[border-color,transform,box-shadow] duration-200 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-glow-primary">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <Avatar className="size-14 shrink-0 border-2 border-primary/40 shadow-md">
                      {character.portraitUrl ? <AvatarImage src={character.portraitUrl} alt={character.name} /> : null}
                      <AvatarFallback>{character.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <CardTitle className="truncate font-heading text-lg">{character.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2 text-xs">
                        {character.race} • {character.class} • Nível {character.level}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3 border-t border-primary/10 pt-4 text-xs text-muted-foreground">
                    <span>PV <strong className="font-semibold text-foreground">{character.currentHp}/{character.maxHp}</strong></span>
                    <span>CA <strong className="font-semibold text-foreground">{character.armorClass}</strong></span>
                    <ArrowUpRight className="size-4 text-primary" aria-hidden="true" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
