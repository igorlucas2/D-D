"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AmbientParticles } from "@/components/ornamental/ambient-particles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatModifier } from "@/lib/character-rules";
import type { Character } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

function CharactersContent() {
  const token = useAuthStore((state) => state.token);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<Character[]>("/characters", token)
      .then((data) => {
        if (!cancelled) setCharacters(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <AmbientParticles className="-z-10" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-glow-primary font-heading text-2xl font-bold">Personagens</h1>
          <p className="text-muted-foreground">Gerencie os heróis das suas campanhas.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/characters/new" />}>
          Novo personagem
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : characters.length === 0 ? (
        <Card className="parchment frame-ornate">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground">
              Você ainda não criou nenhum personagem.
            </p>
            <Button nativeButton={false} render={<Link href="/characters/new" />}>
              Criar meu primeiro personagem
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <Link key={character.id} href={`/characters/${character.id}`}>
              <Card className="h-full transition-shadow hover:ring-primary/50 hover:shadow-glow-primary">
                <CardHeader className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {character.portraitUrl ? (
                      <AvatarImage src={character.portraitUrl} alt={character.name} />
                    ) : null}
                    <AvatarFallback>{character.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>{character.name}</CardTitle>
                    <CardDescription>
                      {character.race} • {character.class} • Nível {character.level}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                  <span>PV {character.currentHp}/{character.maxHp}</span>
                  <span>CA {character.armorClass}</span>
                  <span>Iniciativa {formatModifier(character.initiative)}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CharactersPage() {
  return (
    <RequireAuth>
      <CharactersContent />
    </RequireAuth>
  );
}
