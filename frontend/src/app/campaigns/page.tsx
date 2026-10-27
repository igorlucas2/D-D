"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { PublicLorePack } from "@/lib/lore-types";
import { ArrowUpRight, BookOpen, Crown, Map, Plus, Ticket, Users } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { AmbientParticles } from "@/components/ornamental/ambient-particles";
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
import { ErrorState } from "@/components/ui/error-state";
import { api, ApiError } from "@/lib/api";
import type { Campaign } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

const textareaClassName =
  "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm";

function CampaignsContent() {
  const router = useRouter();
  const [loreTemplate,setLoreTemplate] = useState<(PublicLorePack & {contentHash:string})|null>(null);
  const [useLore,setUseLore] = useState(false);
  const creationRequest = useRef<{body:string;key:string}|null>(null);
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(()=>{
    if(!createOpen || !token) return;
    let active=true;
    api.get<PublicLorePack[]>("/lore-packs",token).then(async packs=>{
      if(!packs[0]) return;
      const pack=packs[0];
      const preview=await api.post<{contentHash:string}>("/lore-packs/create-preview",{packId:pack.packId,version:pack.version},token);
      if(active)setLoreTemplate({...pack,...preview});
    }).catch(()=>{if(active)setLoreTemplate(null);});
    return ()=>{active=false;};
  },[createOpen,token]);

  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function refresh() {
    if (!token) return;
    const data = await api.get<Campaign[]>("/campaigns", token);
    setCampaigns(data);
  }

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadCampaigns() {
      try {
        const data = await api.get<Campaign[]>("/campaigns", token);
        if (!cancelled) setCampaigns(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Não foi possível carregar suas campanhas.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCampaigns();

    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  async function handleCreate() {
    if (!token) return;
    setCreateError(null);
    setCreating(true);
    try {
      if(useLore && !loreTemplate) throw new ApiError("Cenário indisponível. Reabra a janela para tentar novamente.",503);
      if(useLore && loreTemplate) {
        const body={name,description:description || undefined,packId:loreTemplate.packId,version:loreTemplate.version,expectedHash:loreTemplate.contentHash,allowDraft:loreTemplate.status==="DRAFT"};
        const signature=JSON.stringify(body);
        if(creationRequest.current?.body!==signature) creationRequest.current={body:signature,key:crypto.randomUUID()};
        const result=await api.post<{campaignId:string}>("/lore-campaigns",{...body,requestKey:creationRequest.current.key},token);
        setCreateOpen(false);creationRequest.current=null;setName("");setDescription("");
        router.push(`/campaigns/${result.campaignId}/lore`);
        return;
      }
      await api.post<Campaign>(
        "/campaigns",
        { name, description: description || undefined },
        token,
      );
      setCreateOpen(false);
      setName("");
      setDescription("");
      await refresh();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Não foi possível criar a campanha.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (!token) return;
    setJoinError(null);
    setJoining(true);
    try {
      await api.post<Campaign>("/campaigns/join", { inviteCode }, token);
      setJoinOpen(false);
      setInviteCode("");
      await refresh();
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : "Convite inválido.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <AmbientParticles className="-z-10" />

      <header className="relative isolate overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(115deg,rgba(71,37,31,0.92),rgba(30,30,28,0.97)_58%,rgba(35,42,34,0.95))] px-6 py-8 shadow-2xl sm:px-9 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-xl border border-primary/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 size-64 rounded-full border border-primary/10 shadow-[0_0_0_35px_rgba(197,148,72,0.04),0_0_0_80px_rgba(197,148,72,0.03)]" />
        <div className="relative max-w-2xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <Map className="size-4" aria-hidden="true" /> Crônicas compartilhadas
          </p>
          <h1 className="font-heading text-3xl font-semibold leading-tight sm:text-4xl">Suas campanhas</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Entre em uma mesa para continuar a história ou reúna aventureiros para uma nova jornada.
          </p>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <DialogTrigger render={<Button variant="outline" />}><Ticket className="size-4" aria-hidden="true" /> Entrar com convite</DialogTrigger>
            <DialogContent className="parchment frame-ornate">
              <DialogHeader>
                <DialogTitle>Entrar em uma campanha</DialogTitle>
                <DialogDescription>
                  Cole o código de convite compartilhado pelo mestre.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="inviteCode">Código de convite</Label>
                <Input
                  id="inviteCode"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                />
              </div>
              {joinError ? <p className="text-sm text-destructive">{joinError}</p> : null}
              <DialogFooter>
                <Button onClick={handleJoin} disabled={joining || !inviteCode.trim()}>
                  {joining ? "Entrando..." : "Entrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button />}><Plus className="size-4" aria-hidden="true" /> Nova campanha</DialogTrigger>
            <DialogContent className="parchment frame-ornate">
              <DialogHeader>
                <DialogTitle>Nova campanha</DialogTitle>
                <DialogDescription>
                  Crie uma mesa e convide jogadores depois pelo código de convite.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="campaignName">Nome</Label>
                <Input
                  id="campaignName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="campaignDescription">Descrição (opcional)</Label>
                <textarea
                  id="campaignDescription"
                  className={textareaClassName}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              {loreTemplate && <div className="space-y-2 rounded-lg border border-primary/30 p-3"><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={useLore} onChange={e=>setUseLore(e.target.checked)} className="mt-1" /> Usar {loreTemplate.title} {loreTemplate.status==="DRAFT"?"(campanha de teste)":""}</label>{useLore && <><p className="text-sm text-muted-foreground">{loreTemplate.tone} {loreTemplate.party.minPlayers}–{loreTemplate.party.maxPlayers} jogadores.</p><details className="text-sm"><summary className="cursor-pointer">Ler a premissa</summary><p className="mt-2">{loreTemplate.premise}</p></details><p className="text-xs text-muted-foreground">O mundo será instalado com condução humana. Encontros e recompensas ainda estão em revisão.</p></>}</div>}
              {createError ? <p role="alert" className="text-sm text-destructive">{createError}</p> : null}
              <DialogFooter>
                <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                  {creating ? "Criando..." : "Criar campanha"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-primary/20 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Arquivo de aventuras</p>
          <h2 className="mt-1 font-heading text-2xl">Mesas em andamento</h2>
        </div>
        {!loading ? <span className="text-sm text-muted-foreground">{campaigns.length} {campaigns.length === 1 ? "campanha" : "campanhas"}</span> : null}
      </div>

      {loading ? (
        <PageSkeleton cards={4} withHeader={false} />
      ) : error ? (
        <ErrorState
          title="Não foi possível carregar suas campanhas"
          message={error}
          onRetry={() => {
            setError(null);
            setLoading(true);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : campaigns.length === 0 ? (
        <Card className="parchment frame-ornate">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <BookOpen className="size-8 text-primary" aria-hidden="true" />
            <p className="font-heading text-lg">O próximo capítulo espera por você.</p>
            <p className="text-sm text-muted-foreground">Você ainda não participa de nenhuma campanha. Crie uma mesa ou entre com um convite acima.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              <Card className="h-full overflow-hidden border-primary/15 bg-card/90 transition-[border-color,transform,box-shadow] duration-200 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-glow-primary">
                <div aria-hidden="true" className="h-1 bg-[linear-gradient(90deg,rgba(122,52,54,0.95),rgba(197,148,72,0.8),rgba(66,87,65,0.9))]" />
                <CardHeader className="flex flex-row items-center gap-3">
                  <Avatar className="size-12 shrink-0 border border-primary/40 bg-primary/10 text-primary">
                    <AvatarFallback>{campaign.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate font-heading text-lg">{campaign.name}</CardTitle>
                    <CardDescription className="mt-1 truncate text-xs">Mestre: {campaign.master.displayName}</CardDescription>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent className="min-h-16 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                  {campaign.description || "Sem descrição."}
                </CardContent>
                <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/10 pt-4">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" aria-hidden="true" />
                    {campaign.members.length} participante
                    {campaign.members.length === 1 ? "" : "s"}
                  </span>
                  {campaign.masterId === userId ? <Badge><Crown className="size-3" aria-hidden="true" /> Mestre</Badge> : <Badge variant="outline">Jogador</Badge>}
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <RequireAuth>
      <CampaignsContent />
    </RequireAuth>
  );
}
