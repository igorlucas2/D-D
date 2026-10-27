"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { Campaign, NarrationDraft, TableNarration } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

interface NarrationComposerProps {
  campaignId: string;
  currentMap: { id: string; name: string } | null;
  /** Rascunho a abrir (ex.: vindo de uma sugestão de chegada). */
  requestedDraftId: string | null;
  onRequestHandled: () => void;
}

const MAX_LENGTH = 4000;

// Painel do mestre para narrar (IM-06): escrever ou usar um rascunho, escolher
// quem recebe e, se quiser, registrar no diário com o mesmo público.
export function NarrationComposer({ campaignId, currentMap, requestedDraftId, onRequestHandled }: NarrationComposerProps) {
  const token = useAuthStore((state) => state.token);
  const [players, setPlayers] = useState<{ id: string; displayName: string }[]>([]);
  const [drafts, setDrafts] = useState<NarrationDraft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<"all" | "some">("all");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [record, setRecord] = useState(true);
  const [linkToMap, setLinkToMap] = useState(false);
  const [busy, setBusy] = useState<"send" | "save" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      api.get<Campaign>(`/campaigns/${campaignId}`, token),
      api.get<NarrationDraft[]>(`/campaigns/${campaignId}/narration/drafts`, token),
    ])
      .then(([campaign, loadedDrafts]) => {
        if (cancelled) return;
        setPlayers(campaign.members.filter((member) => member.userId !== campaign.masterId).map((member) => member.user));
        setDrafts(loadedDrafts);
      })
      .catch((err) => {
        if (!cancelled) setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Não foi possível carregar os rascunhos." });
      });
    return () => {
      cancelled = true;
    };
  }, [token, campaignId]);

  function loadDraft(draft: NarrationDraft) {
    setDraftId(draft.id);
    setTitle(draft.title);
    setContent(draft.content);
    setLinkToMap(Boolean(draft.mapId && draft.mapId === currentMap?.id));
    setMessage(null);
  }

  useEffect(() => {
    if (!requestedDraftId) return;
    const draft = drafts.find((item) => item.id === requestedDraftId);
    if (!draft) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abre o rascunho pedido pela sugestão de chegada
    loadDraft(draft);
    onRequestHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedDraftId, drafts]);

  function reset() {
    setDraftId(null);
    setTitle("");
    setContent("");
    setLinkToMap(false);
  }

  async function send() {
    if (!token || !content.trim()) return;
    if (audience === "some" && recipients.length === 0) {
      setMessage({ kind: "error", text: "Escolha ao menos um jogador ou envie para toda a mesa." });
      return;
    }
    setBusy("send");
    setMessage(null);
    try {
      const sent = await api.post<TableNarration & { recipients: { displayName: string }[] }>(
        `/campaigns/${campaignId}/narration`,
        {
          title: title.trim() || undefined,
          content,
          recipientIds: audience === "some" ? recipients : [],
          recordInJournal: record,
        },
        token,
      );
      const who = sent.recipients.length ? sent.recipients.map((item) => item.displayName).join(", ") : "toda a mesa";
      setMessage({ kind: "ok", text: `Narração enviada para ${who}${sent.journalEntryId ? " e guardada no diário" : ""}.` });
      reset();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Não foi possível enviar a narração." });
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft() {
    if (!token || !content.trim()) return;
    setBusy("save");
    setMessage(null);
    const body = { title: title.trim() || "Sem título", content, mapId: linkToMap && currentMap ? currentMap.id : null };
    try {
      const saved = draftId
        ? await api.patch<NarrationDraft>(`/campaigns/${campaignId}/narration/drafts/${draftId}`, body, token)
        : await api.post<NarrationDraft>(`/campaigns/${campaignId}/narration/drafts`, body, token);
      setDrafts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setDraftId(saved.id);
      setMessage({ kind: "ok", text: "Rascunho salvo." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Não foi possível salvar o rascunho." });
    } finally {
      setBusy(null);
    }
  }

  async function removeDraft(draft: NarrationDraft) {
    if (!token) return;
    try {
      await api.delete(`/campaigns/${campaignId}/narration/drafts/${draft.id}`, token);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      if (draftId === draft.id) reset();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Não foi possível excluir o rascunho." });
    }
  }

  // Rascunhos deste mapa primeiro.
  const orderedDrafts = [...drafts].sort(
    (a, b) => Number(b.mapId === currentMap?.id) - Number(a.mapId === currentMap?.id),
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/35 p-3">
      {orderedDrafts.length > 0 ? (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Rascunhos</h4>
          <ul className="flex max-h-40 flex-col gap-1 overflow-auto pr-1">
            {orderedDrafts.map((draft) => (
              <li key={draft.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1 text-sm ${draft.id === draftId ? "bg-primary/15" : "odd:bg-background/40"}`}>
                <span className="min-w-0">
                  <span className="font-medium">{draft.title}</span>
                  {draft.mapId && draft.mapId === currentMap?.id ? (
                    <span className="ml-2 text-xs text-muted-foreground">· ao chegar neste mapa</span>
                  ) : null}
                </span>
                <span className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => loadDraft(draft)}>Usar</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Excluir rascunho ${draft.title}`} onClick={() => void removeDraft(draft)}>
                    Excluir
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <Label htmlFor="narrationTitle" className="text-xs text-muted-foreground">Título (opcional)</Label>
        <Input id="narrationTitle" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className="h-11" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="narrationContent" className="text-xs text-muted-foreground">Texto da narração</Label>
        <textarea
          id="narrationContent"
          value={content}
          maxLength={MAX_LENGTH}
          rows={5}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-28 rounded-lg border border-input bg-transparent px-2.5 py-2 font-[family-name:var(--font-body)] text-base leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <span className="self-end text-xs tabular-nums text-muted-foreground">{content.length}/{MAX_LENGTH}</span>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs text-muted-foreground">Quem recebe</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="narrationAudience" checked={audience === "all"} onChange={() => setAudience("all")} className="size-4 accent-[var(--rpg-bronze)]" />
          Toda a mesa
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="narrationAudience" checked={audience === "some"} onChange={() => setAudience("some")} className="size-4 accent-[var(--rpg-bronze)]" />
          Só jogadores escolhidos
        </label>
        {audience === "some" ? (
          players.length === 0 ? (
            <p className="pl-6 text-sm text-muted-foreground">Nenhum jogador na campanha ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 pl-6">
              {players.map((player) => (
                <label key={player.id} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={recipients.includes(player.id)}
                    onChange={(e) =>
                      setRecipients((current) => (e.target.checked ? [...current, player.id] : current.filter((id) => id !== player.id)))
                    }
                    className="size-4 accent-[var(--rpg-bronze)]"
                  />
                  {player.displayName}
                </label>
              ))}
            </div>
          )
        ) : null}
      </fieldset>

      <div className="flex flex-wrap gap-x-4">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} className="size-4 accent-[var(--rpg-bronze)]" />
          Registrar no diário (com o mesmo público)
        </label>
        {currentMap ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={linkToMap} onChange={(e) => setLinkToMap(e.target.checked)} className="size-4 accent-[var(--rpg-bronze)]" />
            Sugerir este rascunho quando alguém chegar a {currentMap.name}
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="h-11" disabled={busy !== null || !content.trim()} onClick={() => void send()}>
          {busy === "send" ? "Enviando..." : "Enviar narração"}
        </Button>
        <Button className="h-11" variant="outline" disabled={busy !== null || !content.trim()} onClick={() => void saveDraft()}>
          {busy === "save" ? "Salvando..." : draftId ? "Atualizar rascunho" : "Salvar rascunho"}
        </Button>
        {draftId || content ? (
          <Button className="h-11" variant="ghost" onClick={reset}>Limpar</Button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className={`text-sm ${message.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>{message.text}</p>
      ) : null}
    </div>
  );
}
