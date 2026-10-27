"use client";
import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { storyLabels, type StoryState } from "@/lib/story-types";
const field =
  "mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const kinds = [
  "NOTE",
  "FACT_CREATE",
  "FACT_UPDATE",
  "CORRECTION",
  "DISCOVER",
  "RELATIONSHIP",
  "PROMISE_CREATE",
  "PROMISE_RESOLVE",
  "THREAD_UPDATE",
];
export function StoryEditor({
  data,
  campaignId,
  token,
  onSaved,
}: {
  data: StoryState;
  campaignId: string;
  token: string;
  onSaved: () => Promise<void>;
}) {
  const [kind, setKind] = useState("NOTE");
  const [scope, setScope] = useState("MASTER");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef<{
    signature: string;
    body: {
      requestKey: string;
      expectedRevision: number;
      operation: Record<string, unknown>;
    };
  } | null>(null);
  const entities = data.entities ?? [];
  function entity(name: string, label: string, optional = false) {
    return (
      <label className="block text-sm">
        {label}
        <select
          aria-label={label}
          className={field}
          name={name}
          required={!optional}
          defaultValue=""
        >
          <option value="">Selecione</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const text = (name: string, label: string, max = 2000) => (
    <label className="block text-sm">
      {label}
      <textarea
        className={field}
        name={name}
        required
        rows={3}
        maxLength={max}
      />
    </label>
  );
  const facts = (revision = false) => (
    <label className="block text-sm">
      {revision ? "Informação a revelar" : "Fato a revisar"}
      <select
        aria-label={revision ? "Informação a revelar" : "Fato a revisar"}
        className={field}
        name={revision ? "revisionId" : "factId"}
        required
        defaultValue=""
      >
        <option value="">Selecione</option>
        {data.facts
          .filter((f) => revision || f.editable !== false)
          .map((f) => (
            <option key={f.id} value={revision ? f.revisionId : f.id}>
              {f.key} — {f.text.slice(0, 100)}
            </option>
          ))}
      </select>
    </label>
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const f = new FormData(form);
    const get = (name: string) => String(f.get(name) ?? "").trim();
    const ids = (name: string) => f.getAll(name).map(String).filter(Boolean);
    const audience = { scope: get("scope"), recipientIds: ids("recipientIds") };
    let operation: Record<string, unknown> = { kind };
    switch (kind) {
      case "NOTE":
        operation = {
          kind,
          text: get("text"),
          entityIds: ids("entityId"),
          audience,
        };
        break;
      case "FACT_CREATE":
        operation = {
          kind,
          key: `F_${crypto.randomUUID().replaceAll("-", "")}`,
          text: get("text"),
          factKind: get("factKind"),
          classification: get("classification"),
          entityIds: ids("entityId"),
          audience,
        };
        break;
      case "FACT_UPDATE":
      case "CORRECTION":
        operation = {
          kind,
          factId: get("factId"),
          text: get("text"),
          reason: get("reason"),
          audience,
        };
        break;
      case "DISCOVER":
        operation = {
          kind,
          revisionId: get("revisionId"),
          knowerIds: ids("knowerIds"),
          stance: get("stance"),
          source: get("source"),
        };
        break;
      case "RELATIONSHIP":
        operation = {
          kind,
          fromId: get("fromId"),
          toId: get("toId"),
          trust: Number(get("trust")),
          fear: Number(get("fear")),
          description: get("description"),
          audience,
        };
        break;
      case "PROMISE_CREATE":
        operation = {
          kind,
          giverId: get("giverId"),
          receiverId: get("receiverId"),
          terms: get("terms"),
          audience,
        };
        break;
      case "PROMISE_RESOLVE":
        operation = {
          kind,
          promiseId: get("promiseId"),
          status: get("status"),
          reason: get("reason"),
        };
        break;
      case "THREAD_UPDATE":
        operation = {
          kind,
          threadId: get("threadId"),
          status: get("status"),
          reason: get("reason"),
          audience,
        };
        break;
    }
    // Form content, not a freshly generated ID or a background refresh, identifies a retry.
    const signature = JSON.stringify([kind, [...f.entries()]]);
    if (pending.current?.signature !== signature)
      pending.current = {
        signature,
        body: {
          requestKey: crypto.randomUUID(),
          expectedRevision: data.revision!,
          operation,
        },
      };
    try {
      await api.post(
        `/campaigns/${campaignId}/story/commands`,
        pending.current.body,
        token,
      );
      pending.current = null;
      form.reset();
      setScope("MASTER");
      setMessage("Registro salvo na memória da campanha.");
      await onSaved();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível salvar.");
      if (e instanceof ApiError && e.status === 409) {
        pending.current = null;
        await onSaved();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border border-primary/35 bg-card/80 p-5">
      <summary className="cursor-pointer font-heading text-xl">
        Registrar na memória
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">
        Registre o que foi confirmado na sessão. Estes registros narrativos não
        movem tokens, gastam itens ou pagam recompensas.
      </p>
      <label className="mt-4 block text-sm">
        Tipo de registro
        <select
          aria-label="Tipo de registro"
          className={field}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setMessage("");
            setScope("MASTER");
          }}
          disabled={busy}
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {storyLabels[k]}
            </option>
          ))}
        </select>
      </label>
      <form key={kind} onSubmit={submit} className="mt-4 space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          {["NOTE", "FACT_CREATE"].includes(kind) && (
            <>
              {text(
                "text",
                "O que foi confirmado?",
                kind === "NOTE" ? 4000 : 6000,
              )}
              {entity("entityId", "Relacionado a (opcional)", true)}
            </>
          )}
          {kind === "FACT_CREATE" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                Natureza
                <select aria-label="Natureza" name="factKind" className={field}>
                  <option value="FACT">Fato confirmado</option>
                  <option value="CLAIM">Rumor ou afirmação</option>
                </select>
              </label>
              <label>
                Como pode mudar
                <select
                  aria-label="Como pode mudar"
                  name="classification"
                  className={field}
                >
                  <option value="MUTABLE">Estado que pode evoluir</option>
                  <option value="FIXED">Premissa fixa</option>
                </select>
              </label>
            </div>
          )}
          {["FACT_UPDATE", "CORRECTION"].includes(kind) && (
            <>
              {facts()}
              {text("text", "Novo texto confirmado", 6000)}
              {text("reason", "Motivo e evidência")}
              <p className="text-sm text-muted-foreground">
                A versão anterior será preservada. Quem conhecia a versão antiga
                só saberá da mudança após uma nova descoberta.
              </p>
            </>
          )}
          {kind === "DISCOVER" && (
            <>
              {facts(true)}
              <fieldset>
                <legend className="text-sm">
                  Quem recebeu esta informação?
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {entities
                    .filter((e) => ["NPC", "CHARACTER"].includes(e.kind))
                    .map((e) => (
                      <label
                        key={e.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input type="checkbox" name="knowerIds" value={e.id} />
                        {e.name}
                      </label>
                    ))}
                </div>
              </fieldset>
              <label className="block text-sm">
                Como entende a informação
                <select
                  aria-label="Como entende a informação"
                  name="stance"
                  className={field}
                >
                  <option value="KNOWN">Sabe (fato)</option>
                  <option value="BELIEVED">Acredita</option>
                  <option value="SUSPECTED">Suspeita</option>
                </select>
              </label>
              {text("source", "Como soube? (visível ao destinatário)")}
              <p className="text-sm text-muted-foreground">
                Acesso privado para os donos dos personagens selecionados.
                Conhecimento de NPC permanece reservado ao mestre.
              </p>
            </>
          )}
          {kind === "RELATIONSHIP" && (
            <>
              {entity("fromId", "De")}
              {entity("toId", "Para")}
              {text("description", "Descrição da relação")}
              <div className="grid grid-cols-2 gap-4">
                <label>
                  Confiança (−100 a 100)
                  <input
                    className={field}
                    type="number"
                    name="trust"
                    min={-100}
                    max={100}
                    defaultValue={0}
                    required
                  />
                </label>
                <label>
                  Medo (0 a 100)
                  <input
                    className={field}
                    type="number"
                    name="fear"
                    min={0}
                    max={100}
                    defaultValue={0}
                    required
                  />
                </label>
              </div>
            </>
          )}
          {kind === "PROMISE_CREATE" && (
            <>
              {entity("giverId", "Quem promete")}
              {entity("receiverId", "Para quem")}
              {text("terms", "Termos da promessa")}
            </>
          )}
          {kind === "PROMISE_RESOLVE" && (
            <>
              <label className="block text-sm">
                Promessa em aberto
                <select
                  className={field}
                  name="promiseId"
                  aria-label="Promessa em aberto"
                  required
                  defaultValue=""
                >
                  <option value="">Selecione</option>
                  {data.promises
                    .filter((p) => p.status === "OPEN")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.terms}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm">
                Resultado
                <select aria-label="Resultado" className={field} name="status">
                  {["FULFILLED", "BROKEN", "CANCELLED"].map((s) => (
                    <option key={s} value={s}>
                      {storyLabels[s]}
                    </option>
                  ))}
                </select>
              </label>
              {text("reason", "O que aconteceu?")}
            </>
          )}
          {kind === "THREAD_UPDATE" && (
            <>
              <label className="block text-sm">
                Fio narrativo
                <select
                  className={field}
                  name="threadId"
                  aria-label="Fio narrativo"
                  required
                  defaultValue=""
                >
                  <option value="">Selecione</option>
                  {data.threads.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.objective}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Situação
                <select aria-label="Situação" className={field} name="status">
                  {["OPEN", "RESOLVED", "ABANDONED"].map((s) => (
                    <option key={s} value={s}>
                      {storyLabels[s]}
                    </option>
                  ))}
                </select>
              </label>
              {text("reason", "Motivo da mudança")}
            </>
          )}
          {!["DISCOVER", "PROMISE_RESOLVE"].includes(kind) && (
            <>
              <label className="block text-sm">
                Quem pode ler
                <select
                  className={field}
                  name="scope"
                  aria-label="Quem pode ler"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="MASTER">Somente o mestre</option>
                  <option value="PUBLIC">Toda a mesa</option>
                  <option value="RECIPIENTS">
                    Mestre e destinatários escolhidos
                  </option>
                </select>
              </label>
              {scope === "RECIPIENTS" && (
                <fieldset>
                  <legend>Destinatários</legend>
                  {data.members?.map((m) => (
                    <label
                      key={m.id}
                      className="mt-2 flex items-center gap-2 text-sm"
                    >
                      <input type="checkbox" name="recipientIds" value={m.id} />
                      {m.name}
                    </label>
                  ))}
                </fieldset>
              )}
            </>
          )}
          <Button type="submit">
            {busy ? "Salvando…" : "Salvar registro"}
          </Button>
        </fieldset>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </form>
    </details>
  );
}
