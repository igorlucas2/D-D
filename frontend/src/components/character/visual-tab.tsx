"use client";

import { useState } from "react";
import { ExternalLink, Save, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { Character } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

const BUILDER_URL = "https://visuais.latam-tools.com.br/";
const BUILDER_HOST = "visuais.latam-tools.com.br";

function normalizeBuilderUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname !== BUILDER_HOST) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function VisualTab({
  character,
  onChange,
}: {
  character: Character;
  onChange: (character: Character) => void;
}) {
  const token = useAuthStore((state) => state.token);
  const [value, setValue] = useState(
    character.appearance?.startsWith("https://") ? character.appearance : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const normalized = normalizeBuilderUrl(value);

  async function save() {
    if (!token) return;
    setError(null);
    setSaved(false);
    if (value.trim() && !normalized) {
      setError("Use um link do construtor em visuais.latam-tools.com.br.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.patch<Character>(
        `/characters/${character.id}`,
        { appearance: normalized ?? "" },
        token,
      );
      onChange(updated);
      setValue(normalized ?? "");
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar o visual.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/25 bg-card/70 p-4">
        <p className="flex items-center gap-2 font-heading text-xl">
          <Sparkles className="size-5 text-primary" aria-hidden="true" /> Seu
          visual em Midgard
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Monte classe, cabelo, roupa e visuais no construtor do LATAM. Depois
          copie o link do build e cole abaixo. O visual fica salvo só nesta
          ficha.
        </p>
        <Button
          className="mt-4 gap-2"
          nativeButton={false}
          render={<a href={BUILDER_URL} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink className="size-4" aria-hidden="true" /> Abrir
          construtor
        </Button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/60 p-4">
        <Label htmlFor="visual-url" className="flex items-center gap-2">
          <UserRound className="size-4 text-primary" aria-hidden="true" />
          Link do seu build
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          No construtor, monte o personagem e copie a URL da barra de endereço
          (ela contém <code>?b=...</code>).
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="visual-url"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setSaved(false);
            }}
            placeholder="https://visuais.latam-tools.com.br/?b=..."
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            className="gap-2"
            onClick={() => void save()}
            disabled={saving || (!!value.trim() && !normalized)}
          >
            <Save className="size-4" aria-hidden="true" />
            {saving ? "Salvando…" : "Salvar visual"}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="mt-2 text-xs text-primary">
            Visual salvo nesta ficha.
          </p>
        ) : null}
      </div>

      {normalized ? (
        <div className="overflow-hidden rounded-xl border border-primary/30 bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 p-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Prévia do visual
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              nativeButton={false}
              render={<a href={normalized} target="_blank" rel="noreferrer" />}
            >
              Abrir no construtor{" "}
              <ExternalLink className="size-3" aria-hidden="true" />
            </Button>
          </div>
          <iframe
            src={normalized}
            title={`Visual de ${character.name}`}
            className="h-[70dvh] min-h-96 w-full border-0"
            allow="fullscreen; autoplay"
          />
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        O visual é uma camada de aparência. Ele não altera CA, PV, itens ou
        regras de combate da ficha.
      </p>
    </div>
  );
}
