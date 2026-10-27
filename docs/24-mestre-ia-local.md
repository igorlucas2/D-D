# Mestre IA local — especificação

Status: **fase 1 implementada** (narrador assistido; mecânica manual).
Última atualização: 27/10/2026.

## 1. Objetivo

Permitir que uma mesa jogue com um modelo de linguagem local no papel de
mestre, sem que ele invente fatos, mecânica ou conhecimento que os personagens
não têm. O banco continua sendo a fonte da verdade; o modelo é o narrador.

O modo atual (`COPILOT`) produz propostas para revisão humana. Esta spec cria o
modo **`AUTONOMOUS`**, em que a IA narra a consequência de uma ação e registra a
memória do turno, mas não altera PV, itens, tempo, posição nem cânone.

### Não objetivos da fase 1

- combate automático, dano, iniciativa ou morte;
- criação/alteração de fatos canônicos pela IA;
- movimento de token, viagem ou descanso automáticos;
- substituir as regras: o mestre humano continua podendo pausar, corrigir e
  rolar dados na mesa.

## 2. Princípios

1. **O banco é a memória.** O modelo recebe um recorte montado por código, não
   o histórico bruto.
2. **O motor é o árbitro.** Mecânica é calculada no backend; a IA só descreve.
3. **A IA propõe; o validador dispõe.** Toda saída passa por schema + regras
   determinísticas antes de virar narrativa persistida.
4. **Conhecimento é por audiência.** Fatos privados do mestre e conhecimentos de
   NPCs não entram no contexto público.
5. **Memória é estruturada.** Resumo, perguntas abertas e fatos novos (fase 2)
   são registros validados, não texto solto no prompt.
6. **Modelo local, rede local.** O provedor só aceita `127.0.0.1`/`localhost`,
   sem credenciais na URL, como o copiloto atual.

## 3. Arquitetura do turno

```text
Jogador
  │  ação em texto + personagem
  ▼
AiMasterService ── valida membro, personagem, modo, pausa
  │
  ▼
TurnContextBuilder ── cena, relógio, personagens, fatos públicos, eventos recentes
  │  JSON compacto (orçamento de tokens)
  ▼
LocalAiProvider (Ollama) ── JSON Schema fechado, temperatura baixa
  │  { narration, memory, ask }
  ▼
TurnValidator ── schema, tamanho, meta-discurso, mecânica inventada
  │  falhou → 1 reparo com os erros; depois fallback seguro
  ▼
StoryService.appendAiTurn ── transação: StoryEvent NOTE público + sequência
  │                           + outbox (story:updated)
  ▼
HTTP devolve narração + memória + evento; sockets invalidam a mesa
```

## 4. Contexto do turno (fase 1)

O `TurnContextBuilder` monta um JSON pequeno e determinístico:

```ts
interface AiTurnContext {
  campaign: { name: string };
  scene: { name: string; phase: string; gameMinute: number; weather: string };
  player: { name: string; character: string | null };
  characters: Array<{
    name: string;
    hp: { current: number; max: number; temp: number };
    armorClass: number;
    conditions: string[];
  }>;
  facts: Array<{ text: string; classification: 'FIXED' | 'MUTABLE' | 'RUMOR' }>;
  recent: Array<{ sequence: number; gameMinute: number; summary: string }>;
  action: string;
  rules: string[];
}
```

Regras do recorte:

- somente fatos com audiência `PUBLIC` e a revisão mais recente;
- no máximo 24 fatos e 6 eventos recentes;
- nomes/HP/CA/condições apenas dos personagens na cena;
- ação do jogador delimitada como dado, nunca instrução;
- orçamento de ~6.000 caracteres; se estourar, remove eventos antigos antes de
  remover fatos;
- nenhum `userId`, token, segredo de NPC ou fato `MASTER`.

## 5. Saída do modelo

Schema fechado (sem campos extras):

```ts
interface AiTurnResult {
  narration: string;        // 1..4000 caracteres, texto público
  memory: {
    summary: string;        // 1..600, para o ledger
    openQuestions: string[]; // até 5, o que ficou em aberto
  };
  ask: string | null;       // pergunta ao jogador, quando falta contexto
}
```

- `ask` preenchido significa que a IA precisa de esclarecimento; a narração
  ainda pode ser curta, mas o turno não registra avanço de história.
- Sem operações, sem IDs, sem números de mecânica.
- Se o modelo tentar descrever dano/PV/rolagem, o validador rejeita e pede
  reparo; a mesa resolve a mecânica no painel próprio.

## 6. Validação

Determinística, em ordem:

1. JSON válido e schema fechado (`additionalProperties: false`);
2. `narration` não vazia, sem caracteres de controle, sem HTML;
3. `memory.summary` não vazio e curto;
4. sem meta-discurso (“como IA”, “sou um modelo”, “não posso”);
5. sem mecânica inventada (padrões de dano/PV/rolagem);
6. sem URLs ou comandos;
7. `ask` opcional, curto.

Em falha: uma tentativa de reparo com a lista de erros. Persistindo, o endpoint
responde **422** com `fallback` (narração neutra) e não grava evento.

## 7. Persistência e memória

- `StoryEvent` com `kind: NOTE`, `actorKind: AI`, `actorName: "Mestre IA"`,
  audiência `PUBLIC`, `summary` = resumo do turno, `payload` = ação, narração,
  memória, modelo e latência.
- `CampaignLore.storySequence` incrementa na mesma transação; o outbox emite
  `story:updated`, então as telas atualizam.
- A fase 1 não cria `StoryFact`; a memória narrativa fica no evento e no resumo
  do turno. Fatos canônicos continuam sendo criados pelos comandos existentes.
- Retenção: os eventos seguem a política do diário/memória; não há expurgo
  automático nesta fase.

## 8. Modos e controle

`CampaignLore.mode`: `OFF` | `COPILOT` | `AUTONOMOUS`.
`CampaignLore.aiPaused`: pausa imediata.

- `GET /campaigns/:id/ai-master/state` — qualquer membro: modo, pausa, cena,
  personagens, últimos eventos públicos.
- `PATCH /campaigns/:id/ai-master/settings` — só mestre: `{ mode, paused,
  expectedRevision }`, com CAS em `revision`.
- `POST /campaigns/:id/ai-master/act` — membro com personagem na campanha:
  `{ requestKey, action, characterId? , expectedRevision }`.
  - exige `AUTONOMOUS` e não pausado;
  - idempotente por `requestKey`;
  - devolve `{ eventId, sequence, narration, memory, ask, model, latencyMs }`.

Limite de uso: 10 ações por minuto por IP/rota (modelo local é caro).

## 9. UI (fase 1)

Nova página `/campaigns/:id/play` (“Mesa narrada”):

- seletor de personagem do jogador;
- linha do tempo das últimas narrações públicas;
- caixa “O que você faz?” + enviar;
- estado de carregamento/erro e botão “Perguntar de novo”;
- para o mestre: ligar/desligar `AUTONOMOUS`, pausar/retomar;
- link na navegação da campanha, ao lado de Memórias.

A tela usa `useStoryUpdates` para recarregar quando o ledger mudar.

## 10. Provedor local

- Ollama em `127.0.0.1:11434` (mesma configuração `GAME_MASTER_OLLAMA_URL`).
- Modelo configurável (`GAME_MASTER_MODEL`, padrão atual `gemma2:9b`; recomendado
  Qwen2.5 14B Instruct ou Llama 3.1 8B para PT-BR).
- `format` = JSON Schema fechado; `temperature: 0.4`; `num_ctx: 8192`;
  `num_predict: 800`; timeout de 90 s.
- Se o provedor não estiver disponível: **503** com `PROVIDER_UNAVAILABLE` e
  mensagem clara; a mesa continua funcionando manualmente.
- Nenhuma chamada externa; a URL é validada como loopback.

## 11. Testes e critérios de aceite

Unitários:

- schema aceita o exemplo mínimo e rejeita campos extras/texto vazio;
- validador rejeita mecânica inventada, HTML, meta-discurso e memória vazia;
- reparo inclui os erros;
- contexto não inclui fatos `MASTER` nem userIds.

Integração:

- membro com personagem recebe narração e evento público;
- jogador sem personagem recebe 400;
- modo `OFF`/pausado recebe 409;
- `requestKey` repetido devolve o mesmo evento;
- mestre alterna modo com CAS e revisão errada devolve 409;
- jogador não altera settings (403).

Critérios:

- 100% das saídas persistidas passam no schema;
- zero fato privado no contexto público;
- nenhuma mecânica aplicada pela IA na fase 1;
- a mesa continua jogável manualmente se o modelo cair.

## 12. Fases seguintes

**Fase 2 — operações seguras:** `REVEAL_FACT` (fato já existente + knowers),
`ADVANCE_TIME` limitado, `NOTE` de memória; validação de conhecimento/audiência;
UI mostra “o que a IA sabe”.

**Fase 3 — ledger de fatos:** IA propõe `FACT_CREATE`/`FACT_UPDATE` com
evidências; motor grava revisão e audiência; aprovação opcional do mestre.

**Fase 4 — combate narrado:** IA descreve o resultado calculado pelo motor de
combate, sem tocar em PV/iniciativa.

**Fase 5 — plano do diretor:** arco com objetivo, apostas, pistas e agenda de
NPCs; retrieval por entidade/cena e resumos de arco.

## 13. Status desta entrega

Implementado:

- endpoints de estado, configuração e ação;
- contexto de cena com fatos públicos, personagens e eventos recentes;
- schema/validador com reparo único e fallback 422;
- persistência como `StoryEvent` público e invalidação por socket;
- página `/campaigns/:id/play` com controles de mestre;
- testes do schema (9 casos) e build/CI.

Pendente para as próximas fases: testes de integração com banco/provider simulado, operações mecânicas validadas, ledger de fatos propostos pela IA e narração de combate.
