"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Languages, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { playerColor } from "@/lib/player-color";
import type { Campaign } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

export type ChatKind = "IC" | "OOC" | "EMOTE" | "WHISPER";

export interface ChatMessage {
  id: string;
  kind: ChatKind;
  content: string;
  /** false: fala num idioma que você não conhece (texto já embaralhado pelo servidor). */
  understood: boolean;
  language: { id: string; name: string } | null;
  author: { id: string; displayName: string };
  character: { id: string; name: string } | null;
  recipients: { id: string; displayName: string }[];
  createdAt: string;
}

interface LanguagesInfo {
  languages: { id: string; name: string; summary: string | null }[];
  characters: { id: string; name: string; user: { id: string; displayName: string }; languageIds: string[] }[];
}

const KIND_LABELS: Record<ChatKind, string> = {
  IC: "Em personagem",
  EMOTE: "Ação",
  OOC: "Fora do personagem",
  WHISPER: "Sussurro",
};

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function MessageView({ message, meId }: { message: ChatMessage; meId: string | undefined }) {
  const speaker = message.character?.name ?? message.author.displayName;
  const color = playerColor(message.author.id);
  const foreign = message.language && !message.understood;
  const languageTag = message.language ? (
    <span className="rounded bg-background/60 px-1.5 py-0.5 text-xs text-muted-foreground" title={foreign ? `Você não entende ${message.language.name}.` : undefined}>
      em {message.language.name}
      {foreign ? " · você não entende" : ""}
    </span>
  ) : null;

  if (message.kind === "EMOTE") {
    return (
      <p className="text-sm italic">
        <span className="font-semibold not-italic" style={{ color }}>{speaker}</span>{" "}
        <span className={foreign ? "text-muted-foreground" : ""}>{message.content}</span> {languageTag}
      </p>
    );
  }
  if (message.kind === "OOC") {
    return (
      <p className="text-sm text-muted-foreground">
        <span className="font-medium">{message.author.displayName}</span> (fora do personagem): {message.content}
      </p>
    );
  }
  return (
    <div className={`rounded-lg px-2.5 py-1.5 ${message.kind === "WHISPER" ? "border border-dashed border-primary/50 bg-primary/5" : "bg-background/40"}`}>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span className="text-sm font-semibold" style={{ color }}>{speaker}</span>
        {message.character ? <span>({message.author.displayName})</span> : null}
        {message.kind === "WHISPER" ? (
          <span className="font-medium text-primary">
            sussurra {message.author.id === meId ? `para ${message.recipients.map((r) => r.displayName).join(", ")}` : "para você"}
          </span>
        ) : null}
        {languageTag}
        <span className="ml-auto tabular-nums">{time(message.createdAt)}</span>
      </p>
      <p className={`whitespace-pre-wrap font-[family-name:var(--font-body)] text-base leading-6 ${foreign ? "italic text-muted-foreground" : ""}`}>
        {message.content}
      </p>
    </div>
  );
}

/** Mestre: quem fala qual idioma. */
function LanguageGrid({ campaignId, info, onChange }: { campaignId: string; info: LanguagesInfo; onChange: (info: LanguagesInfo) => void }) {
  const token = useAuthStore((state) => state.token);
  const [error, setError] = useState<string | null>(null);
  if (info.languages.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum idioma criado. Cadastre idiomas na aba Mundo (tipo “Idioma”).</p>;
  }
  async function toggle(languageId: string, characterId: string, knows: boolean) {
    if (!token) return;
    setError(null);
    try {
      const path = `/campaigns/${campaignId}/languages/${languageId}/characters/${characterId}`;
      onChange(knows ? await api.delete<LanguagesInfo>(path, token) : await api.post<LanguagesInfo>(path, undefined, token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível alterar o idioma.");
    }
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Idiomas conhecidos por personagem</caption>
        <thead>
          <tr>
            <th scope="col" className="py-1 pr-3 text-left font-medium">Personagem</th>
            {info.languages.map((language) => (
              <th key={language.id} scope="col" className="px-2 py-1 font-medium">{language.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {info.characters.map((character) => (
            <tr key={character.id} className="border-t border-border/50">
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                {character.name} <span className="text-xs text-muted-foreground">({character.user.displayName})</span>
              </th>
              {info.languages.map((language) => {
                const knows = character.languageIds.includes(language.id);
                return (
                  <td key={language.id} className="px-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${character.name} fala ${language.name}`}
                      checked={knows}
                      onChange={() => void toggle(language.id, character.id, knows)}
                      className="size-4 accent-[var(--rpg-bronze)]"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

interface TableChatProps {
  campaignId: string;
  isMaster: boolean;
  messages: ChatMessage[];
  onSent: (message: ChatMessage) => void;
}

// Conversa da mesa (MV-08) com idiomas do mundo (IM-11).
export function TableChat({ campaignId, isMaster, messages, onSent }: TableChatProps) {
  const token = useAuthStore((state) => state.token);
  const meId = useAuthStore((state) => state.user?.id);
  const [info, setInfo] = useState<LanguagesInfo | null>(null);
  const [members, setMembers] = useState<{ id: string; displayName: string }[]>([]);
  const [kind, setKind] = useState<ChatKind>("IC");
  const [characterId, setCharacterId] = useState("");
  const [languageId, setLanguageId] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLanguages, setShowLanguages] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      api.get<LanguagesInfo>(`/campaigns/${campaignId}/languages`, token),
      api.get<Campaign>(`/campaigns/${campaignId}`, token),
    ])
      .then(([languages, campaign]) => {
        if (cancelled) return;
        setInfo(languages);
        const people = new Map<string, string>([[campaign.master.id, campaign.master.displayName]]);
        for (const member of campaign.members) people.set(member.user.id, member.user.displayName);
        setMembers([...people].map(([id, displayName]) => ({ id, displayName })).filter((p) => p.id !== meId));
        const own = languages.characters.find((c) => c.user.id === meId);
        if (own) setCharacterId((current) => current || own.id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [campaignId, token, meId]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length]);

  const ownCharacters = useMemo(() => info?.characters.filter((c) => c.user.id === meId) ?? [], [info, meId]);
  const speakable = useMemo(() => {
    if (!info) return [];
    if (isMaster) return info.languages;
    const character = ownCharacters.find((c) => c.id === characterId);
    return info.languages.filter((language) => character?.languageIds.includes(language.id));
  }, [info, isMaster, ownCharacters, characterId]);
  const effectiveLanguage = speakable.some((l) => l.id === languageId) ? languageId : "";

  async function send() {
    if (!token || !text.trim()) return;
    // Atalhos: "/me ação" e "/ooc texto" (ou "((texto))").
    let content = text.trim();
    let sendKind = kind;
    if (/^\/me\s/i.test(content)) {
      sendKind = "EMOTE";
      content = content.replace(/^\/me\s+/i, "");
    } else if (/^\/ooc\s/i.test(content)) {
      sendKind = "OOC";
      content = content.replace(/^\/ooc\s+/i, "");
    } else if (/^\(\([\s\S]*\)\)$/.test(content)) {
      sendKind = "OOC";
      content = content.slice(2, -2).trim();
    }
    if (sendKind === "WHISPER" && recipients.length === 0) {
      setError("Escolha para quem sussurrar.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const message = await api.post<ChatMessage>(
        `/campaigns/${campaignId}/chat`,
        {
          kind: sendKind,
          content,
          characterId: sendKind === "OOC" ? undefined : characterId || undefined,
          // Idioma só vale para fala; ação (/me) é vista por todos.
          languageId: sendKind === "IC" || sendKind === "WHISPER" ? effectiveLanguage || undefined : undefined,
          recipientIds: sendKind === "WHISPER" ? recipients : undefined,
        },
        token,
      );
      onSent(message);
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/35 p-3">
      <ol ref={logRef} role="log" aria-live="polite" aria-label="Conversa da mesa" className="flex max-h-72 min-h-24 flex-col gap-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <li className="text-sm text-muted-foreground">Ninguém disse nada ainda.</li>
        ) : (
          messages.map((message) => (
            <li key={message.id}>
              <MessageView message={message} meId={meId} />
            </li>
          ))
        )}
      </ol>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select aria-label="Tipo de mensagem" value={kind} onChange={(e) => setKind(e.target.value as ChatKind)} className="h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30">
            {(Object.keys(KIND_LABELS) as ChatKind[]).map((option) => (
              <option key={option} value={option}>{KIND_LABELS[option]}</option>
            ))}
          </select>
          {kind !== "OOC" ? (
            <select aria-label="Personagem que fala" value={characterId} onChange={(e) => setCharacterId(e.target.value)} className="h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30">
              <option value="">{isMaster ? "Narrador / NPC" : "Sem personagem"}</option>
              {ownCharacters.map((character) => (
                <option key={character.id} value={character.id}>{character.name}</option>
              ))}
            </select>
          ) : null}
          {(kind === "IC" || kind === "WHISPER") && speakable.length > 0 ? (
            <select aria-label="Idioma da fala" value={effectiveLanguage} onChange={(e) => setLanguageId(e.target.value)} className="h-10 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30">
              <option value="">Língua comum</option>
              {speakable.map((language) => (
                <option key={language.id} value={language.id}>{language.name}</option>
              ))}
            </select>
          ) : null}
          {isMaster ? (
            <Button type="button" variant={showLanguages ? "default" : "outline"} size="sm" className="h-10" aria-expanded={showLanguages} onClick={() => setShowLanguages((v) => !v)}>
              <Languages className="size-4" aria-hidden="true" /> Idiomas
            </Button>
          ) : null}
        </div>
        {kind === "WHISPER" ? (
          <fieldset className="flex flex-wrap gap-x-4">
            <legend className="sr-only">Sussurrar para</legend>
            {members.map((member) => (
              <label key={member.id} className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recipients.includes(member.id)}
                  onChange={(e) => setRecipients((current) => (e.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id)))}
                  className="size-4 accent-[var(--rpg-bronze)]"
                />
                {member.displayName}
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="flex gap-2">
          <input
            aria-label="Mensagem"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === "EMOTE" ? "desembainha a espada…" : "Digite… (/me para ação, /ooc para fora do personagem)"}
            className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <Button type="submit" className="h-11" disabled={sending || !text.trim()} aria-label="Enviar mensagem">
            <Send className="size-4" aria-hidden="true" />
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>

      {isMaster && showLanguages && info ? <LanguageGrid campaignId={campaignId} info={info} onChange={setInfo} /> : null}
    </div>
  );
}
