"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AmbientParticles } from "@/components/ornamental/ambient-particles";
import { Crest, OrnateDivider } from "@/components/ornamental/ornate-divider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expiredNotice, setExpiredNotice] = useState(false);
  const [next, setNext] = useState("/dashboard");

  // Lido no cliente para não exigir Suspense na página.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("next");
    // Só caminhos internos: evita redirecionar para outro site.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- parâmetros só existem no navegador
    if (target && target.startsWith("/") && !target.startsWith("//")) setNext(target);
    setExpiredNotice(params.get("sessao") === "expirada");
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <AmbientParticles />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Crest className="h-12 w-12 text-primary" />
          <h1 className="text-glow-primary font-heading text-2xl font-bold tracking-wide">
            Eldoria RPG
          </h1>
          <OrnateDivider className="w-40" />
        </div>
        <Card className="parchment frame-ornate w-full">
          <CardHeader>
            <CardTitle className="text-xl">Entrar</CardTitle>
            <CardDescription>
              Acesse sua conta para continuar suas aventuras.
            </CardDescription>
            {expiredNotice ? (
              <p role="status" className="mt-2 rounded-md border border-[var(--rpg-wine)]/40 bg-[var(--rpg-wine)]/10 px-3 py-2 text-sm">
                Sua sessão expirou. Entre de novo para voltar de onde parou.
              </p>
            ) : null}
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </CardContent>
            <CardFooter className="mt-4 flex flex-col items-stretch gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Não tem uma conta?{" "}
                <Link href="/register" className="text-primary hover:underline">
                  Criar conta
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
