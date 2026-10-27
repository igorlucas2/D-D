"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { useStoryUpdates } from "@/lib/use-story-updates";
import {
  JOURNAL_CATEGORIES,
  JOURNAL_CATEGORY_LABELS,
  type Campaign,
  type JournalCategory,
  type JournalEntry,
} from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import { ArrowLeft, BookOpen, Pencil, Trash2 } from "lucide-react";

const textareaClassName =
  "min-h-32 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm";

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

interface EntryFormState {
  title: string;
  content: string;
  category: JournalCategory;
  sessionDate: string;
}

const EMPTY_FORM: EntryFormState = {
  title: "",
  content: "",
  category: "SESSAO",
  sessionDate: new Date().toISOString().slice(0, 10),
};

const JOURNAL_PAGE_SIZE = 30;

function JournalContent() {
  const params = useParams<{ id: string }>();
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [form, setForm] = useState<EntryFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function refresh() {
    if (!token) return;
    const [campaignData, entriesData] = await Promise.all([
      api.get<Campaign>(`/campaigns/${params.id}`, token),
      api.get<JournalEntry[]>(
        `/campaigns/${params.id}/journal?take=${JOURNAL_PAGE_SIZE}`,
        token,
      ),
    ]);
    setCampaign(campaignData);
    setEntries(entriesData);
    setHasMore(entriesData.length === JOURNAL_PAGE_SIZE);
  }

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadJournal() {
      try {
        const [campaignData, entriesData] = await Promise.all([
          api.get<Campaign>(`/campaigns/${params.id}`, token),
          api.get<JournalEntry[]>(
            `/campaigns/${params.id}/journal?take=${JOURNAL_PAGE_SIZE}`,
            token,
          ),
        ]);
        if (cancelled) return;
        setCampaign(campaignData);
        setEntries(entriesData);
        setHasMore(entriesData.length === JOURNAL_PAGE_SIZE);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Erro ao carregar diário.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadJournal();

    return () => {
      cancelled = true;
    };
  }, [token, params.id]);

  useStoryUpdates(params.id, token, () => {
    void refresh();
  });

  function openCreateDialog() {
    setEditingEntry(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEditDialog(entry: JournalEntry) {
    setEditingEntry(entry);
    setForm({
      title: entry.title,
      content: entry.content,
      category: entry.category,
      sessionDate: entry.sessionDate ? entry.sessionDate.slice(0, 10) : "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        title: form.title,
        content: form.content,
        category: form.category,
        sessionDate: form.sessionDate || undefined,
      };
      if (editingEntry) {
        await api.patch(`/campaigns/${params.id}/journal/${editingEntry.id}`, body, token);
      } else {
        await api.post(`/campaigns/${params.id}/journal`, body, token);
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar a entrada.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entryId: string) {
    if (!token) return;
    await api.delete(`/campaigns/${params.id}/journal/${entryId}`, token);
    await refresh();
  }

  async function loadMore() {
    if (!token || loadingMore || !hasMore || entries.length === 0) return;
    setLoadingMore(true);
    try {
      const next = await api.get<JournalEntry[]>(
        `/campaigns/${params.id}/journal?take=${JOURNAL_PAGE_SIZE}&cursor=${entries[entries.length - 1].id}`,
        token,
      );
      setEntries((current) => [...current, ...next]);
      setHasMore(next.length === JOURNAL_PAGE_SIZE);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erro ao carregar mais entradas.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-destructive">
        {error ?? "Campanha não encontrada."}
      </div>
    );
  }

  const isMaster = campaign.masterId === userId;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <Link
          href={`/campaigns/${campaign.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para {campaign.name}
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BookOpen className="h-6 w-6" /> Diário da Campanha
            </h1>
            <p className="text-muted-foreground">{campaign.name}</p>
          </div>
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger render={<Button onClick={openCreateDialog} />}>Nova entrada</DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingEntry ? "Editar entrada" : "Nova entrada"}</DialogTitle>
                <DialogDescription>
                  Registre o que aconteceu na campanha: sessões, eventos, mortes, loot ou decisões.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="entryTitle">Título</Label>
                <Input
                  id="entryTitle"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="entryCategory">Categoria</Label>
                  <select
                    id="entryCategory"
                    value={form.category}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, category: event.target.value as JournalCategory }))
                    }
                    className={selectClassName}
                  >
                    {JOURNAL_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {JOURNAL_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="entryDate">Data da sessão</Label>
                  <Input
                    id="entryDate"
                    type="date"
                    value={form.sessionDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, sessionDate: event.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="entryContent">Conteúdo</Label>
                <textarea
                  id="entryContent"
                  className={textareaClassName}
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                  placeholder="O que aconteceu nesta sessão..."
                />
              </div>
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              <DialogFooter>
                <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground">Nenhuma entrada registrada ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => {
            const canEdit = isMaster || entry.authorId === userId;
            return (
              <Card key={entry.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>{entry.title}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="outline">{JOURNAL_CATEGORY_LABELS[entry.category]}</Badge>
                      {entry.restricted ? (
                        <Badge
                          variant="secondary"
                          title={entry.recipients.length ? `Visível para: ${entry.recipients.map((r) => r.displayName).join(", ")}` : undefined}
                        >
                          {entry.recipients.length
                            ? `Revelação para ${entry.recipients.map((r) => r.displayName).join(", ")}`
                            : "Revelação privada"}
                        </Badge>
                      ) : null}
                      {entry.sessionDate ? (
                        <span>{new Date(entry.sessionDate).toLocaleDateString("pt-BR")}</span>
                      ) : null}
                    </CardDescription>
                  </div>
                  {canEdit ? (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(entry)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{entry.content}</p>
                </CardContent>
                <CardFooter>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px]">
                        {entry.author.displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {entry.author.displayName}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
          {hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Carregando..." : "Carregar mais"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function JournalPage() {
  return (
    <RequireAuth>
      <JournalContent />
    </RequireAuth>
  );
}
