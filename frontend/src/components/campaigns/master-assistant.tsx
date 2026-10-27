"use client";

import { useEffect, useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

type Kind = "scene" | "npc" | "names" | "free";

interface AssistantStatus {
  available: boolean;
  enabled: boolean;
  monthlyLimit: number;
  usedThisMonth: number;
  tokensThisMonth: { input: number; output: number };
  model: string;
}

const KINDS: { id: Kind; label: string; placeholder: string; needsPrompt: boolean }[] = [
  { id: "scene", label: "Descrever a cena", placeholder: "Opcional: algum detalhe que deve aparecer", needsPrompt: false },
  { id: "npc", label: "Improvisar NPC", placeholder: "Opcional: ex. um guarda desconfiado", needsPrompt: false },
  { id: "names", label: "Nomes", placeholder: "Ex.: tavernas de uma cidade portuária", needsPrompt: true },
  { id: "free", label: "Pedido livre", placeholder: "Ex.: três rumores sobre o barão", needsPrompt: true },
];

const KIND_TITLES: Record<Kind, string> = {
  scene: "Cena (assistente)",
  npc: "NPC (assistente)",
  names: "Nomes (assistente)",
  free: "Ideia (assistente)",
};

interface MasterAssistantProps {
  campaignId: string;
  mapId: string | null;
}

// Assistente do mestre (IM-12). Nada do que ele gera chega aos jogadores por
// conta própria: o mestre lê, ajusta e, se quiser, guarda como narração.
export function MasterAssistant({ campaignId, mapId }: MasterAssistantProps) {
  const token = useAuthStore((state) => state.token);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [kind, setKind] = useState<Kind>("scene");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{ text: string; kind: Kind; truncated: boolean } | null>(null);
  const [busy, setBusy] = useState<"ask" | "settings" | "save" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [limitDraft, setLimitDraft] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<AssistantStatus>(`/campaigns/${campaignId}/assistant`, token)
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        setLimitDraft(String(data.monthlyLimit));
      })
      .catch((err) => !cancelled && setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Não foi possível abrir o assistente." }));
    return () => {
      cancelled = true;
    };
  }, [token, campaignId]);

  async function saveSettings(patch: { enabled?: boolean; monthlyLimit?: number }) {
    if (!token) return;
    setBusy("settings");
    setMessage(null);
    try {
      setStatus(await api.patch<AssistantStatus>(`/campaigns/${campaignId}/assistant`, patch, token));
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Não foi possível salvar." });
    } finally {
      setBusy(null);
    }
  }

  async function ask() {
    if (!token) return;
    setBusy("ask");
    setMessage(null);
    try {
      const response = await api.post<{ text: string; truncated: boolean }>(
        `/campaigns/${campaignId}/assistant`,
        { kind, prompt: prompt.trim() || undefined, mapId: mapId ?? undefined },
        token,
      );
      setResult({ text: response.text, kind, truncated: response.truncated });
      setStatus((current) => (current ? { ...current, usedThisMonth: current.usedThisMonth + 1 } : current));
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "O assistente não respondeu." });
    } finally {
      setBusy(null);
    }
  }

  async function saveAsDraft() {
    if (!token || !result) return;
    setBusy("save");
    try {
      await api.post(
        `/campaigns/${campaignId}/narration/drafts`,
        { title: KIND_TITLES[result.kind], content: result.text.slice(0, 4000), mapId },
        token,
      );
      setMessage({ kind: "ok", text: "Salvo nos rascunhos de narração. Abra “Narrar” para revisar e enviar." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Não foi possível salvar o rascunho." });
    } finally {
      setBusy(null);
    }
  }

  const selected = KINDS.find((item) => item.id === kind)!;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/35 p-3">
      {!status ? (
        <p className="text-sm text-muted-foreground">{message?.text ?? "Carregando…"}</p>
      ) : !status.available ? (
        <p className="text-sm text-muted-foreground">
          O assistente não está configurado neste servidor. Para usar, defina <code>ANTHROPIC_API_KEY</code> no arquivo <code>backend/.env</code> e reinicie o
          Eldoria. O custo das chamadas fica na conta dessa chave.
        </p>
      ) : !status.enabled ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            O assistente ajuda a descrever cenas, improvisar NPCs e sugerir nomes, usando o modelo Claude ({status.model}).
          </p>
          <p className="text-muted-foreground">
            Ao pedir algo, são enviados à Anthropic: o nome e a descrição da campanha, o mapa atual (nome, locais e quem está nele), a hora e o clima, até 25
            entradas do Mundo e os títulos recentes do diário. Nada é enviado sem você clicar em “Gerar”, e nada chega aos jogadores sem você publicar.
          </p>
          <Button className="h-11 self-start" disabled={busy !== null} onClick={() => void saveSettings({ enabled: true })}>
            <Sparkles className="size-4" aria-hidden="true" /> Ligar o assistente nesta campanha
          </Button>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Tipo de pedido" className="flex flex-wrap gap-1.5">
            {KINDS.map((item) => (
              <Button key={item.id} size="sm" className="min-h-10" variant={kind === item.id ? "default" : "outline"} aria-pressed={kind === item.id} onClick={() => setKind(item.id)}>
                {item.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="assistantPrompt" className="text-xs text-muted-foreground">
              {selected.needsPrompt ? "O que você quer" : "Detalhes (opcional)"}
            </Label>
            <textarea
              id="assistantPrompt"
              value={prompt}
              maxLength={600}
              rows={2}
              placeholder={selected.placeholder}
              onChange={(event) => setPrompt(event.target.value)}
              className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="h-11" disabled={busy !== null || (selected.needsPrompt && !prompt.trim())} onClick={() => void ask()}>
              <Sparkles className="size-4" aria-hidden="true" /> {busy === "ask" ? "Pensando…" : "Gerar"}
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {status.usedThisMonth}/{status.monthlyLimit} pedidos este mês
            </span>
          </div>

          {result ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-card/60 p-3" aria-live="polite">
              <p className="whitespace-pre-wrap font-[family-name:var(--font-body)] text-base leading-6">{result.text}</p>
              {result.truncated ? <p className="text-xs text-muted-foreground">A resposta foi cortada por tamanho.</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="min-h-10" disabled={busy !== null} onClick={() => void saveAsDraft()}>
                  Salvar como rascunho de narração
                </Button>
                <Button size="sm" variant="outline" className="min-h-10" onClick={() => void navigator.clipboard.writeText(result.text)}>
                  <Copy className="size-4" aria-hidden="true" /> Copiar
                </Button>
              </div>
            </div>
          ) : null}

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Configurações e uso</summary>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="assistantLimit" className="text-xs text-muted-foreground">Limite de pedidos por mês</Label>
                <Input id="assistantLimit" type="number" min={1} max={500} value={limitDraft} onChange={(event) => setLimitDraft(event.target.value)} className="h-10 w-28" />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="min-h-10"
                disabled={busy !== null}
                onClick={() => void saveSettings({ monthlyLimit: Math.max(1, Math.min(500, Math.trunc(Number(limitDraft)) || 1)) })}
              >
                Salvar limite
              </Button>
              <Button size="sm" variant="ghost" className="min-h-10 text-destructive" disabled={busy !== null} onClick={() => void saveSettings({ enabled: false })}>
                Desligar nesta campanha
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              Uso no mês: {status.tokensThisMonth.input.toLocaleString("pt-BR")} tokens enviados e {status.tokensThisMonth.output.toLocaleString("pt-BR")} recebidos ({status.model}).
            </p>
          </details>
        </>
      )}
      {message && status ? (
        <p role="status" className={`text-sm ${message.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
