# Análise do projeto e propostas de melhoria

Revisão independente do código, dos dados e da operação do Eldoria.
Data: 26/10/2026. Escopo: `backend/`, `frontend/`, `docs/`, `scripts/` e o estado
do ambiente local. Nenhum arquivo de código foi alterado nesta análise.

---

## 1. Resumo executivo

O Eldoria deixou de ser um MVP: são **≈40 mil linhas próprias** (18,5 mil no
backend, 21,1 mil no frontend), **62 modelos** no banco, **137 rotas HTTP**, **23
controllers**, 2 gateways Socket.IO, 21 documentos técnicos e 7 migrações MySQL.
A qualidade do código está acima da média de projetos desse porte:

- `tsc --noEmit` limpo no backend e no frontend (`strict: true` no frontend);
- ESLint sem erros (1 aviso de `<img>`);
- **66 testes passando em 8 suítes**;
- autorização por papel aplicada no servidor, com **projeções separadas para
  mestre e jogador** (`vtt.projection.ts`, `emitCombat`, audiência de história);
- isolamento multi-tenant no banco por chaves compostas (`[campaignId, id]`);
- padrão **outbox transacional com lease** para entrega de eventos;
- acessibilidade real (roving tabindex na grade, `aria-live`, `prefers-reduced-motion`).

O risco do projeto hoje **não é falta de funcionalidade** — é **operação,
configuração segura e processo**. Os cinco pontos abaixo concentram a maior
parte do risco:

| # | Risco | Evidência |
| --- | --- | --- |
| 1 | **Nenhum versionamento efetivo**: o backend não está em Git e o frontend tem 1 commit de scaffold com 98 arquivos não rastreados | `Test-Path .git` = falso na raiz; `frontend/.git` com 19 arquivos rastreados, sem remoto |
| 2 | **Segredo JWT igual ao fallback público do código** — qualquer pessoa pode forjar um token de qualquer usuário | `backend/.env` contém exatamente `dev-super-secret-change-me`, o mesmo default de `auth.module.ts:19` e `jwt.strategy.ts:18` |
| 3 | **`/api/image-proxy` é um proxy aberto** (SSRF e proxy de terceiros) | `frontend/src/app/api/image-proxy/route.ts:6-44` aceita qualquer URL http(s), sem allowlist, timeout, limite de tamanho ou autenticação |
| 4 | **Sessão WebSocket não expira** | token verificado só no handshake (`vtt.gateway.ts:142-158`, `world.gateway.ts:71-85`); `exp` é checado apenas em `emitStoryUpdateToUser:366-372` |
| 5 | **Sem limite de requisições** em login, cadastro, dados, sincronização SRD e assistente | nenhum `ThrottlerModule` no `package.json`; `POST /catalog/srd/sync` exige só estar logado (`srd.controller.ts:23-26`) |

**Veredito por dimensão** (nota relativa ao que se espera de um produto pronto
para jogadores reais, não à média de projetos pessoais):

| Dimensão | Nota | Comentário |
| --- | --- | --- |
| Domínio e regras | 4,5/5 | Modelagem rica (mundo, história, consequências, desafios). Decisões de produto explícitas. |
| Segurança de autorização | 4/5 | Projeções e checagens por campanha são consistentes; não encontrei endpoint sem guard nem IDOR nos fluxos revisados. |
| Segurança de configuração | 1,5/5 | Segredo default em uso, CORS `*`, sem rate limit, sem headers de segurança. |
| Confiabilidade/concorrência | 3/5 | Outbox é excelente; relógio do mundo, slots e inventário têm race conditions. |
| Manutenibilidade | 3,5/5 | Boa organização por módulo, mas 3 serviços com 700–1.000 linhas e autorização duplicada em 7 lugares. |
| Frontend/UX | 3,5/5 | Visual e acessibilidade acima da média; polling agressivo, estados de erro frágeis e um componente de 2.600 linhas. |
| Operação e processo | 1,5/5 | Sem Git real, CI, Docker, observabilidade ou política de backup dos dados. |
| Documentação | 4,5/5 | Excepcional em produto; desatualizada em arquitetura e sem registro de licenças. |
| Conformidade (LGPD/licenças) | 2/5 | Sem exclusão de conta, sem recuperação de senha, sem atribuição formal do SRD. |

---

## 2. Como esta análise foi feita

Executado (evidências no Anexo A):

- leitura integral dos arquivos críticos de autenticação, autorização, VTT,
  tempo real, relógio, outbox, assistente/copiloto, dados e bootstrap;
- `tsc --noEmit` no backend e no frontend: **0 erros**;
- ESLint no backend (silencioso) e no frontend: **0 erros, 1 aviso**;
- `jest --runInBand`: **8 suítes, 66 testes, todos passando**;
- contagens e inspeções por shell (rotas, guards, tamanho de arquivos,
  quantidades de campos `LongText`, estado do Git, tamanho de pastas).

Não executado (limitação do ambiente, não do projeto): `next build` (bloqueado
por `spawn EPERM` no sandbox), `prisma migrate status`, os testes que exigem
MySQL/servidor e os testes de navegador.

---

## 3. O que está bom e deve ser preservado

1. **Projeções de autorização no servidor.** `projectPlayerMap` remove névoa,
   paredes, tokens invisíveis, notas privadas e hotspots ocultos; combate envia
   projeções distintas por papel; história usa audiência com revalidação no
   momento da entrega (`story-outbox.service.ts:52-86`).
2. **Isolamento por campanha no banco.** As FKs compostas
   (`@@unique([campaignId, id])`, relações `[campaignId, xId]`) fazem o banco
   recusar vínculos cruzados entre campanhas — melhor que checar só no serviço.
3. **Padrão outbox com lease e backoff.** `OutboxEvent` com `leaseToken`,
   `leaseUntil` e índice `[status, availableAt]` é o jeito certo de entregar
   evento sem perder nem duplicar.
4. **Acessibilidade.** Grade com uma única célula tabulável e navegação por
   setas/Home/End; `aria-live` para ping e combate; devolução de foco ao fechar
   painéis; `prefers-reduced-motion` respeitado em ~12 componentes.
5. **Qualidade estática.** Sem `any` no `src` do frontend, sem `TODO/FIXME`,
   lint limpo, tipos explícitos nos pontos de fronteira.
6. **Documentação de produto.** Os docs 08–21 registram decisões, critérios de
   aceite e evidências de verificação — algo raro e valioso. A proposta aqui é
   **não refazer** isso, apenas mantê-lo sincronizado.

**Recomendação geral: evoluir por incrementos.** O código não pede reescrita.

---

## 4. Achados e propostas

Prioridade: **P0** = corrigir antes de abrir para jogadores que não sejam de
confiança; **P1** = confiabilidade e dívida estrutural; **P2** = qualidade,
produto e conformidade. Esforço: P (até 1 dia), M (2–5 dias), G (1–2 semanas).

### P0 — antes da próxima mesa com jogadores reais

#### P0-1. Colocar o projeto sob versionamento (esforço P)

**Evidência.** A raiz não é repositório Git. `frontend/.git` tem **1 commit**
("Initial commit from Create Next App"), **19 arquivos rastreados** e **98
alterações não rastreadas** — ou seja, praticamente todo o frontend está fora do
histórico. O backend não tem Git nenhum. No diretório de trabalho convivem
`online-rpg.rar` (690 MB), `frontend/.next` (1,8 GB), `backend/backups` (58 MB),
`backend/generated` (27 MB) e um `dev.db` legado — tudo sincronizado pelo OneDrive.

**Por que importa.** Hoje não existe como revisar, comparar, reverter ou
recuperar uma mudança. Um arquivo corrompido ou uma exclusão acidental apaga
trabalho de meses. O RAR de 690 MB é o único backup, e está no mesmo disco que o
original.

**Proposta.**

1. `git init` na raiz (monorepo), com `.gitignore` cobrindo `node_modules/`,
   `.next/`, `dist/`, `coverage/`, `logs/`, `backups/`, `generated/`, `*.db`,
   `*.rar`, `*.tsbuildinfo`, `.env*`.
2. Workspaces (`npm workspaces` ou pnpm) com scripts na raiz:
   `dev`, `build`, `lint`, `typecheck`, `test`, `check`.
3. Remoto **privado** (GitHub/GitLab) + backup fora do OneDrive; commits
   pequenos e tags por marco (`mi-06b`, `pre-mysql`).
4. Mover `online-rpg.rar` para armazenamento externo e excluir do diretório.
5. Excluir `node_modules` e `.next` da sincronização do OneDrive (ou mover o
   checkout para fora dele). O `.next` de 1,8 GB é o principal causador de
   tráfego de sincronização.
6. Arquivar o legado SQLite (`prisma/migrations`, `prisma/sqlite`,
   `prisma.sqlite.config.ts`, `dev.db`, `shadow-tmp.db`,
   `generated/sqlite-migration`) em uma tag `pre-mysql`, em vez de mantê-lo
   ativo ao lado do MySQL.

#### P0-2. Endurecer configuração do servidor (esforço M)

**Evidência.**

- `backend/.env` usa **o segredo default do código** (`dev-super-secret-change-me`);
  o mesmo fallback está em `auth.module.ts:18-23` e `jwt.strategy.ts:17-19`.
- `main.ts:8` chama `app.enableCors()` sem origem; os gateways usam
  `cors: { origin: '*' }` (`vtt.gateway.ts:122`, `world.gateway.ts:55`).
- Não há `helmet`, `compression`, `@nestjs/throttler` nem limite de corpo no
  `package.json`; não há `enableShutdownHooks`.
- O `.env` ainda carrega `MYSQL_DATABASE_URL` e `SQLITE_DATABASE_URL` legados.

**Por que importa.** Com o segredo default, qualquer pessoa que leia o
repositório forja um JWT com `sub` de outro usuário e assume a campanha dele —
em HTTP **e** em WebSocket. CORS aberto amplia o alcance disso para qualquer
site. Sem throttle, o login aceita força bruta (bcrypt custa CPU) e o cadastro
aceita abuso.

**Proposta.**

1. Validar ambiente no boot e **falhar se faltar** (`ConfigModule.forRoot({ validate })`
   com zod/joi): `DATABASE_URL`, `JWT_SECRET` (≥ 32 bytes aleatórios),
   `JWT_EXPIRES_IN`, `PORT`, e um `NODE_ENV` explícito. Remover o fallback.
2. **Rotacionar o segredo atual** (invalida sessões existentes) depois de
   publicar a validação.
3. Fechar CORS: o navegador só fala com a origem do Next, que faz proxy de
   `/api` e `/socket.io` — então `enableCors({ origin: false })` e
   `cors: { origin: [] }` nos gateways (ou allowlist via `ELDORIA_ORIGINS` se
   houver acesso direto).
4. Adicionar `helmet` (exceto CSP no backend), `compression`,
   `app.set('trust proxy', 1)` (túnel), limite de corpo (`json({ limit: '256kb' })`),
   `app.enableShutdownHooks()` e `app.disable('x-powered-by')`.
5. Adicionar headers de segurança no Next (`headers()`): CSP, `X-Content-Type-Options`,
   `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `poweredByHeader: false`.
6. Limpar chaves legadas do `.env` e documentar cada variável em `.env.example`.

#### P0-3. Fechar o proxy de imagens (esforço P)

**Evidência.** `frontend/src/app/api/image-proxy/route.ts:6-44` busca qualquer
URL `http(s)` no servidor, sem autenticação, sem allowlist, sem timeout, sem
limite de tamanho, com `Access-Control-Allow-Origin: *` e aceitando
`image/svg+xml` — que, servido na **mesma origem** do app, executa script se a
URL for aberta diretamente. O `docs/09` já registra isso como **MV-05** (aberto).

**Por que importa.** SSRF clássico: o servidor pode ser usado para alcançar
`localhost`, `169.254.169.254` (metadados de nuvem) e a rede interna; o proxy
também vira hospedagem gratuita de imagens de terceiros, e o SVG cria um vetor
de XSS na origem da aplicação.

**Proposta.**

1. Exigir sessão válida (encaminhar o `Authorization` ao backend ou validar
   assinatura) e aplicar rate limit por usuário/IP.
2. Allowlist de hosts por env (`IMAGE_PROXY_ALLOWED_HOSTS`) e bloqueio de IPs
   privados/reservados após `dns.lookup({ all: true })`, revalidando **cada**
   redirecionamento (`redirect: 'manual'`).
3. `AbortSignal.timeout(5000)`, limite de `Content-Length` (ex.: 10 MB) e
   leitura em streaming com corte.
4. Servir apenas raster (`image/png|jpeg|webp|gif`) e responder com
   `X-Content-Type-Options: nosniff` e `Content-Disposition: attachment` para
   tipos não raster; remover `ACAO: *` ou restringir.
5. Alternativa estrutural: armazenar uploads em object storage e servir por
   CDN própria, mantendo o proxy só para hosts conhecidos.

#### P0-4. Rate limiting e controle de custo (esforço M)

**Evidência.**

- Login/cadastro sem limite (`auth.controller.ts:21-24`).
- `POST /catalog/srd/sync` exige só `JwtAuthGuard` (`srd.controller.ts:23-26`) e
  dispara **centenas de fetches sequenciais** sem timeout
  (`srd-sync.service.ts:35-47,95-105,247-253`); a sincronização de monstros são
  ~334 requisições.
- Assistente: a cota é **contagem de pedidos** (`assistant.service.ts:125-133`)
  e cada pedido pode gerar **16.000 tokens** (`:148`), no modelo fixo em código
  (`:19`). Não há orçamento em tokens nem limite por minuto.
- Chat tem limite em memória (`chat.service.ts:56`); ping tem 1/s; o resto não.

**Proposta.**

1. `@nestjs/throttler` global (ex.: 120 req/min por IP) + limites específicos:
   `5/min` em login (por IP **e** e-mail), `3/min` em cadastro de conta,
   `30/min` em dados, `10/min` em assistente/copiloto.
2. Sincronização SRD: papel administrativo (`ADMIN_EMAILS` ou `User.role`),
   execução em background com progresso, `AbortSignal`, concorrência 4 e
   idempotência por `(endpoint, index)`.
3. Assistente: teto de tokens por mês (`assistantMonthlyTokenLimit`), cota
   atômica (`UPDATE ... WHERE used < limit`), `max_tokens` 1.200–2.000 para
   texto criativo, modelo e esforço por env, `timeout`/`maxRetries` no SDK,
   registro de custo por campanha.
4. Copiloto Ollama: uma geração por campanha por vez (lock), já que o modelo
   local é caro e concorre com a CPU da máquina.

#### P0-5. Expiração e abuso de sessão WebSocket (esforço M)

**Evidência.** O token é validado uma vez no handshake. O `exp` é guardado
(`vtt.gateway.ts:153`) mas só verificado em `emitStoryUpdateToUser`
(`:366-372`); o gateway do mundo nem guarda `exp` (`world.gateway.ts:79-84`).
`table:presence:status` (`vtt.gateway.ts:211-224`) faz broadcast sem throttle e
`vtt:join` faz query por conexão. Não há Redis adapter nem estado compartilhado.

**Por que importa.** Um token de 1 dia vale enquanto a aba ficar aberta — e um
socket antigo continua recebendo chat, narração, rolagens e relógio. Sem
revogação, trocar a senha (quando existir) não derruba sessões.

**Proposta.**

1. Agendar `setTimeout` para `disconnect(true)` no `exp` e revalidar em cada
   handler (ou token curto + refresh no handshake).
2. Token bucket por socket para `vtt:join` e `table:presence:status` (o `table:ping`
   já tem limite de 1/s).
3. DTOs validados para payloads WS (hoje `@MessageBody` é interface sem
   validação) — usar o mesmo `ValidationPipe` com schemas por evento.
4. Redis adapter + presença no Redis quando houver mais de uma instância; até
   lá, documentar "1 réplica" como requisito de deploy.

### P1 — confiabilidade e dívida estrutural

#### P1-1. Relógio do mundo: atomicidade e multi-instância (esforço M)

**Evidência.** `addMinutes` lê `totalMinutes`, soma em memória e grava
(`world.service.ts:316-333`) sem transação nem lock — dois avanços simultâneos
(tick do cron + viagem de jogador) perdem um update. O cron roda a cada minuto
sem lock (`world-tick.service.ts:15-44`) e usa `updatedAt` do calendário como
referência, que também muda ao editar configurações.

**Proposta.**

1. `lastTickAt` dedicado e **CAS**: `UPDATE CampaignCalendar SET totalMinutes = totalMinutes + ?, lastTickAt = ? WHERE campaignId = ? AND lastTickAt = ?`.
2. Lock por campanha (`SELECT ... FOR UPDATE` ou `GET_LOCK`) para viagem,
   descanso e tick.
3. Limitar recuperação de ticks atrasados (ex.: no máximo N por execução) e
   registrar `WorldEvent` de forma idempotente.
4. Reaproveitar o padrão de lease do `OutboxEvent` para o tick (uma instância
   líder por campanha).

#### P1-2. Revisões e concorrência otimista nos estados da mesa (esforço M)

**Evidência.** `VttMap`, `CombatEncounter` e `CampaignCalendar` não têm
`revision`; o servidor emite o objeto inteiro e o último write vence. Um mestre
com duas abas perde alterações de névoa/token sem aviso (`docs/09` MV-03,
aberto).

**Proposta.** `revision Int` (ou uso explícito de `updatedAt`) em
mapa/combate/calendário; incluir na projeção e no evento; `PATCH` com
`If-Match`/`expectedRevision` → `409 Conflict`; cliente ignora evento com
revisão menor e recarrega o snapshot.

#### P1-3. Camada de dados: JSON, paginação e índices (esforço G)

**Evidência.**

- **0 campos `Json`** no schema; há **51 `@db.LongText`** e **28 `@db.Text`**,
  muitos usados como JSON serializado (`fogOfWarData`, `wallsData`, `conditions`,
  `breakdown`, `traits`, `actions`, `properties`). O parse é manual
  (`dice.service.ts:140`, `catalog.service.ts:9-27`) — uma linha corrompida
  derruba a requisição com 500.
- Sem paginação: `catalog.service.ts:33-55` devolve item/spell/monster/rule
  inteiros; `journal.service.ts:31-44` devolve todas as entradas da campanha;
  `srd.service.ts:22-44` usa `take: 500` e busca `contains` sem índice.
- Integridade: `InventoryItem` não tem `@@unique([characterId, itemId])` —
  adicionar o mesmo item duas vezes em paralelo cria duas linhas (ou perde
  quantidade), porque o serviço faz `findFirst` e depois `create`
  (`characters.service.ts:185-204`).
- FKs são indexadas automaticamente pelo MySQL, mas consultas por
  `campaignId + status` só existem onde alguém lembrou de criar índice.

**Proposta.**

1. Migrar os campos JSON para `Json` do Prisma, com schemas (zod) na escrita e
   leitura tipada; manter `String` só onde o valor é realmente texto.
2. Padronizar paginação por cursor (`(createdAt, id)` ou `(name, id)`) em
   catálogo, SRD, diário, chat e história; `take` máximo obrigatório.
3. Adicionar unicidade onde a regra existe (`InventoryItem[characterId, itemId]`,
   `CharacterLanguage[characterId, languageId]`) e trocar check-then-create por
   `upsert`/`createMany({ skipDuplicates: true })`.
4. Para busca textual na SRD: índice FULLTEXT (MySQL) ou `startsWith` com
   índice; medir com `EXPLAIN`.
5. Habilitar log de queries lentas e revisar `@@index` a partir das consultas
   reais, não por intuição.

#### P1-4. Monorepo com pacote compartilhado (esforço M)

**Evidência.** A regra de personagem está **duplicada**: 191 linhas em
`backend/src/characters/rules/character-rules.ts` e 186 em
`frontend/src/lib/character-rules.ts`. Já divergiram: o backend aceita
`baseArmor` (`:163`), o frontend fixa 10 (`:164`); o frontend tem
`formatModifier` e compra de pontos que o backend não tem. `docs/01` promete
`packages/shared/src/rules`, que não existe. Os tipos da API são reescritos à
mão em `frontend/src/lib/types.ts` (616 linhas).

**Proposta.** Workspaces + `packages/shared` com regras puras, schemas zod e
tipos de DTO; importar nos dois lados. Em paralelo, gerar tipos do OpenAPI do
Nest (`@nestjs/swagger`) e consumir no frontend — elimina a maior fonte de
divergência silenciosa.

#### P1-5. Tirar operações longas do ciclo HTTP (esforço G)

**Evidência.** Sincronização SRD (cerca de 330 requisições sequenciais),
instalação de cenário (`lore-install.service.ts`, 622 linhas), geração do
copiloto (até 90 s, `ollama.provider.ts:74-80`) e do assistente rodam **dentro**
da requisição. O proxy do Next e o navegador podem estourar timeout, e não há
progresso nem retomada.

**Proposta.** Fila (BullMQ/Redis) ou tabela de jobs com o padrão de lease já
existente; endpoints `POST` devolvem `202 + jobId`, `GET /jobs/:id` mostra
progresso; idempotência por chave; retomada após restart.

#### P1-6. Erros, observabilidade e auditoria (esforço M)

**Evidência.** Não há filtro global de exceções: erro Prisma inesperado vira
500 genérico. `register` e `join` fazem check-then-create
(`auth.service.ts:20-35`, `campaigns.service.ts:111-113`) e uma corrida gera
`P2002` → 500 em vez de 409. Só há **2** `new Logger` no `src`; não há
request-id, log estruturado nem métricas; `/api/health` faz só `SELECT 1`. Ações
do mestre (publicar mapa, revelar névoa, mudar PV, avançar relógio) não deixam
trilha de auditoria.

**Proposta.**

1. Exception filter global mapeando `P2002`→409, `P2025`→404, `P2003`→409 e
   códigos estáveis de erro; nunca vazar stack.
2. `nestjs-pino` + request-id + log de acesso; nível por env.
3. `/health/live` e `/health/ready` (checando banco + outbox atrasado); métricas
   Prometheus (`/metrics` protegido) para latência, erros, outbox lag, sockets.
4. Sentry/OTel para exceções no cliente e no servidor.
5. `AuditLog` (ator, campanha, ação, alvo, diff, IP) para ações de mestre e
   administração.

#### P1-7. Contratos de API e validação de parâmetros (esforço M)

**Evidência.** **172 parâmetros de rota** são `string` sem validação;
`Number(level)` pode virar `NaN` (`characters.controller.ts:174`);
`createHotspotTarget` reusa `CreateVttMapDto` (`vtt.controller.ts:237`); `level`
aceita só `Min(1)`, sem `Max(20)` (`update-character.dto.ts:6-9`); `imageUrl` é
string livre em mapa e token (aceita `data:`/`http:`), enquanto o avatar usa
`@IsUrl`.

**Proposta.** Pipes (`ParseIntPipe`, pipe de CUID), DTOs específicos por rota,
`@Max(20)` no nível, URL https com allowlist para imagens, `class-transformer`
com `@Exclude` para nunca serializar `passwordHash`; documentar tudo com Swagger.

#### P1-8. Centralizar autorização e cortar consultas repetidas (esforço M)

**Evidência.** O par `assertIsMember`/`assertIsMaster` está **copiado em sete
serviços** (`vtt.service.ts:1010-1036`, `combat.service.ts:447-473`,
`world.service.ts:711-737`, `journal.service.ts:204-222`,
`chat.service.ts:347-360`, `assistant.service.ts:300-309`,
`dice.service.ts:144-158`), cada um refazendo a query de campanha + membros.
`characters.service.findOne` chama `syncSpellSlots` **a cada GET**, e a função
faz 9 `findUnique` + 9 `upsert` (`characters.service.ts:449-475`); `update`
chama `findOne` duas vezes. E `story-outbox.service.ts:53-86` emite no socket
**dentro** da transação serializável, mantendo a transação aberta durante I/O de
rede. Três serviços passam de 700 linhas (`vtt` 1.037, `story` 835, `world` 738).

**Por que importa.** Sete cópias da mesma regra é exatamente onde uma delas vai
divergir (ex.: aceitar `CO_MASTER` só em uma rota). E o custo por leitura de
ficha cresce com o número de telas abertas na mesa.

**Proposta.** `CampaignAccessService` (ou guard + CASL) com cache por requisição
e políticas explícitas (`canView`, `canEdit`, `canBroadcast`); sincronizar slots
só em criação/level-up (ou em lote, com `createMany`/`updateMany`); coletar
eventos e despachar **depois** do commit; quebrar os três serviços grandes por
caso de uso (mapa/visão, combate, relógio) com serializers próprios.

### P2 — frontend, produto, testes e conformidade

#### P2-1. Fatiar o `vtt-panel` e organizar estado (esforço G)

**Evidência.** `frontend/src/components/campaigns/vtt-panel.tsx`: **2.618
linhas**, **74 `useState`**, 12 `useEffect`, 25 chamadas `api.*` em um único
componente. `renderGridCells` recria **384 botões** (mapa 24×16) a cada render;
qualquer evento de chat/presença/ping re-renderiza o painel inteiro. A página
`campaigns/[id]/world/page.tsx` tem 962 linhas e 21 `useState`.

**Proposta.** Extrair `MapCanvas` (memoizado), `TokenLayer`, `FogLayer`,
`MeasureTool`, `Inspector`, `MapDialogs`, `ChatPanel`, `DicePanel` e `Narration`;
concentrar o estado da ferramenta em `useReducer`; mover fetch para hooks
(`useCampaignMaps`, `useChat`) com React Query. Sem mudança funcional, ganho de
performance e testabilidade.

#### P2-2. Fim do polling e camada de dados única (esforço M)

**Evidência.** Polling de **3 s** em copiloto e intenções, **4 s** na ficha,
**5 s** em comandos e prazos, **10 s** na história e na cena — somado a um socket
que já invalida. `copilot` = 20 GETs/min por cliente. `/characters` é buscado
por `table-combat`, `exploration-hud` e `lore-scene-panel` na mesma tela;
`/campaigns/:id` por três telas. `api.ts` não tem timeout, `AbortController`
nem retry — e o dashboard tem `try/finally` sem `catch`
(`dashboard/page.tsx:37-64`), ficando em "Carregando..." para sempre se a API
falhar.

**Proposta.** TanStack Query com `staleTime` + invalidação por socket (padrão já
usado em `useStoryUpdates`); `AbortSignal.timeout` e retry com backoff em
`api.ts`; `catch` + `role="alert"` em todas as cargas; skeleton em vez de texto.
Efeito esperado: queda de uma ordem de grandeza nas requisições por mesa.

#### P2-3. Uma conexão Socket.IO por aba (esforço M)

**Evidência.** Hoje a mesma aba abre até **4 conexões** (`vtt-panel`,
`combat-panel`, `useStoryUpdates`, `world-calendar-store`). O
`world-calendar-store` já implementa singleton com ref-count
(`world-calendar-store.ts:49-105`) — o padrão certo, aplicado em um só lugar.

**Proposta.** Generalizar para um `RealtimeProvider` com ref-count e salas
multiplexadas (`join` de campanha uma vez, handlers por evento); estado de
conexão único na UI.

#### P2-4. Estados de rota, boundary e metadata (esforço P/M)

**Evidência.** Não existe `error.tsx`, `loading.tsx` nem `not-found.tsx` em
nenhum segmento; 19 de 21 páginas são `"use client"`; só o `layout.tsx` define
metadata, então todas as rotas têm o mesmo título. O único error boundary é o de
texturas 3D.

**Proposta.** `error.tsx`/`loading.tsx` por grupo de rotas, `not-found.tsx`,
`global-error.tsx`; metadata e OG por página; avaliar `middleware.ts` e cookie
`httpOnly` no lugar de `localStorage` (hoje o token fica em `localStorage`,
legível por XSS).

#### P2-5. Testes e CI (esforço G)

**Evidência.** 8 suítes / 66 testes cobrindo **funções puras** (visão, movimento,
presença, embaralhamento, lore, assistente). Nenhum teste de serviço, de
autorização, de concorrência ou de socket; **zero** testes de frontend. Não há
CI, e `npm run lint` do backend usa `--fix` (um pipeline de verificação não pode
alterar arquivos).

**Proposta.**

1. Backend: testes de integração com MySQL descartável (o projeto já tem esse
   padrão nos scripts de ensaio) cobrindo a matriz **mestre / membro / ex-membro
   / estranho** em cada recurso; idempotência de comandos; tick do relógio;
   entrega do outbox.
2. Frontend: Vitest para regras/pontos/dados e Playwright para o fluxo
   login → personagem → mesa → mover token → rolar → revelar (os ensaios
   `run-rehearsal.cjs` já fazem isso manualmente — transformar em suíte).
3. CI (GitHub Actions) com serviço MySQL: install → typecheck → lint (sem
   `--fix`) → unit → integração → build. Somar `npm audit` e Dependabot.
4. Meta inicial de cobertura: 60% nos módulos de domínio, com foco em
   autorização (não em número global).

#### P2-6. Lacunas de produto e conformidade (esforço M/G)

**Evidência.**

- **Não há recuperação de senha, verificação de e-mail nem exclusão de conta**
  (busca por `forgot|reset|delete-account` não encontra nada). Senha mínima de
  6 caracteres (`register.dto.ts:6-9`), sem normalização de e-mail.
- Convite é um `cuid` **permanente** (`Campaign.inviteCode`, sem expiração ou
  rotação) e a interface copia o **código**, não um link.
- Não há co-mestre (`CampaignRole` só tem `MASTER`/`PLAYER`).
- **VTT no toque é parcial**: mover token funciona por "selecionar + tocar na
  célula", mas o arrasto usa HTML5 drag (`vtt-panel.tsx:1370-1371`) e o desenho
  de hotspot usa `onMouseDown/onMouseEnter` (`:1313-1322`) — em tablet/celular,
  arrastar e desenhar não funcionam.
- Acessibilidade pontual: `<Label>` sem `htmlFor` e seleção sem `aria-pressed`
  na criação de personagem; `filter-select` sem `aria-label`; erros de
  login/registro sem `role="alert"`; inputs padrão de 32 px.
- Metadados do site dizem "estilo D&D 5e" e o manual cita o SRD, mas não há
  página de créditos/licença com a atribuição exigida pelo **SRD 5.1 (CC BY 4.0)**.

**Proposta.**

1. Fluxo de "esqueci a senha" por e-mail com token de uso único e expiração;
   verificação de e-mail no cadastro; exclusão de conta (LGPD) com anonimização
   do que não puder ser apagado; senha mínima 8 + checagem de vazamento;
   normalizar e-mail (`trim().toLowerCase()`).
2. Convite com expiração, rotação e revogação; botão "copiar link" com a URL
   completa; opcional: aprovação do mestre para entrar.
3. Co-mestre (`CampaignRole.CO_MASTER`) ou tabela de permissões por campanha.
4. Pointer Events no VTT + alternativa "selecionar token → tocar célula"
   (padrão que o backend já suporta via `PATCH .../tokens/:id/move`).
5. Corrigir labels/aria e alvos de toque (mínimo 44 px) em formulários.
6. Página "Créditos e licenças" com a atribuição do SRD 5.1, origem dos dados
   (`dnd5eapi.co`) e `LICENSE` do projeto; trocar "estilo D&D 5e" por "baseado no
   SRD 5.1" nos metadados; publicar política de privacidade e termos se houver
   acesso público.

#### P2-7. Manter a documentação sincera (esforço P)

**Evidência.** `docs/01` descreve Next 14, SQLite→PostgreSQL, `packages/shared` e
`mobile/` — nada disso corresponde ao código (Next 16, MySQL, sem shared/mobile).
`docs/05` lista estrutura de pastas que não existe (route groups, `inventory/`,
`spells/`, `library/`, `ai-master/`, `tailwind.config.ts`). O roadmap não registra
os marcos IM/MI (docs 11–21). O `backend/README.md` é o boilerplate do NestJS.

**Proposta.** Reescrever 01 e 05 a partir do código; atualizar o roadmap com os
marcos IM-01…IM-13 e MI-01…MI-06B; substituir o README do backend por um guia
real (variáveis, migrações, testes, papéis); criar índice em `docs/README.md` e
ADRs curtos para decisões (MySQL, JSON em texto, uma instância, 1 personagem ↔
1 campanha).

---

## 5. Status do backlog que já existe (docs/09)

O plano P0 de `docs/09-melhorias-mesas-vivas.md` é bom; vale fechá-lo antes de
abrir novas frentes. Situação verificada no código hoje:

| ID | Item | Status verificado |
| --- | --- | --- |
| MV-01 | Projeções mestre/jogador e revogação de sala | **Feito** (`vtt.projection.ts`, `evictUser`) |
| MV-02 | Exploração por campanha/personagem | **Feito** (`CharacterExplorationState`, binding em `CampaignCharacter`) — mas a decisão "1 personagem ↔ 1 campanha" está implícita no schema e não documentada |
| MV-03 | Fonte da verdade + `revision` | **Feito** em 26/10/2026: `revision` em mapa, combate e calendário, com `expectedRevision` opcional e 409 (P1-2); o cliente da mesa e o do calendário já enviam a revisão |
| MV-04 | Relógio atômico e cron multi-instância | **Feito** em 26/10/2026: incremento atômico, `lastTickAt` + CAS, teto de 24 ticks por execução (P1-1) |
| MV-05 | Endurecer imagem remota + CORS + JWT | **Feito** em 26/10/2026 (P0-2 e P0-3) |
| MV-06 | Lobby, sessão, convite expirável | **Parcial** (convite permanente; sem estado de sessão) |
| MV-14 | Mobile/teclado + fatiar `vtt-panel` | **Parcial** (teclado na grade feito; toque e split pendentes) |

---

## 6. Sequência sugerida

**Semana 1 — parar o sangramento (P0-1 a P0-4)**
Git + remoto + limpeza do workspace; validação de env e rotação do segredo;
CORS fechado; `helmet`; throttle em auth; proxy de imagem fechado. São mudanças
pequenas e independentes — dá para entregar em dias.

**Semana 2 — sessão e erros (P0-5, P1-6, P2-4)**
Expiração de socket; filtro global de exceções; `catch` nas telas que ficam
presas em "Carregando"; `error.tsx`/`loading.tsx`; timeout no `api.ts`.

**Semanas 3–5 — confiabilidade (P1-1, P1-2, P1-3, P1-5)**
Relógio atômico; revisões; JSON tipado e paginação; fila para operações longas.
Aqui entram os testes de integração que provam cada uma dessas correções.

**Mês 2 — estrutura (P1-4, P1-7, P2-1, P2-2, P2-3)**
Pacote compartilhado + OpenAPI; fatiar o `vtt-panel`; React Query no lugar do
polling; conexão única de socket.

**Mês 3 — produto e processo (P2-5 a P2-7)**
CI + Playwright; recuperação de senha/exclusão de conta; convite expirável;
acessibilidade e toque; documentação e licenças.

**Não fazer agora:** app mobile nativo, reescrita de módulos, novas features de
IA. O retorno por esforço é muito maior em hardening e processo.

---

## 7. Ganhos rápidos (menos de um dia cada)

1. `git init` + `.gitignore` + primeiro commit + remoto privado.
2. Remover `online-rpg.rar` do diretório e excluir `node_modules`/`.next` do OneDrive.
3. Falhar no boot sem `JWT_SECRET` forte; rotacionar o segredo atual.
4. Fechar CORS (o proxy do Next torna isso indiferente para o navegador).
5. Allowlist + timeout + limite de tamanho no `image-proxy`.
6. Trocar `?? 'dev-super-secret-change-me'` por erro explícito.
7. `catch` + `role="alert"` no dashboard e nas listas.
8. `AbortSignal.timeout` em `api.ts`.
9. Remover o `--fix` do script `lint` do backend e adicionar `lint:fix`.
10. Remover `package.json#prisma` (deprecado, ignorado pelo `prisma.config.ts`) e
    adicionar `engines.node`/`.nvmrc`.

---

## 8. Como medir se melhorou

| Indicador | Hoje | Meta |
| --- | --- | --- |
| Segredos default em uso | 1 (JWT) | 0, com falha no boot |
| Endpoints com CORS `*` | 3 (HTTP + 2 gateways) | 0 |
| Endpoints públicos sem rate limit | login, cadastro, SRD sync | 0 |
| Requisições de polling por cliente/min | até 20 (copiloto) | 0 (invalidação por socket) |
| Conexões Socket.IO por aba | até 4 | 1 |
| Cobertura de autorização (mestre/membro/ex-membro/estranho) | 0 testes | 100% dos recursos com campanha |
| Tempo de CI verde | não existe | < 10 min, bloqueando merge |
| Outbox lag (p95) | sem métrica | < 2 s, alerta em 10 s |
| Ticks duplicados por hora | possível | 0 (CAS/lock provado por teste) |
| Ações de mestre auditadas | 0 | 100% |

---

## 9. Andamento das correções

As notas das seções 1 e 2 refletem o diagnóstico inicial; esta seção registra o
que já foi corrigido.

| Data | Item | O que foi feito |
| --- | --- | --- |
| 26/10/2026 | P0-1 (parcial) | Repositório Git na raiz, `.gitignore`/`.gitattributes`, `.env` e artefatos grandes fora do versionamento, primeiro commit publicado em https://github.com/igorlucas2/D-D. Pendente: mover o RAR e excluir `.next`/`node_modules` da sincronização do OneDrive. |
| 26/10/2026 | P0-2 | `validateEnv` com falha no boot; fallback do JWT removido; segredo local rotacionado; CORS por allowlist no HTTP e no handshake do Socket.IO; `helmet`, `compression`, limite de payload de 1 MB, shutdown hooks e `trust proxy` opt-in; CSP e headers de segurança no Next. Verificado com build dos dois lados e smoke test (health, headers, CORS e handshake). |
| 26/10/2026 | P0-3 | `image-proxy` reescrito: só http(s) e portas 80/443; bloqueio de loopback, rede privada, link-local, multicast e reservados (IPv4, IPv6 e mapeados), revalidado a cada redirecionamento; timeout de 5 s, limite de 8 MB em streaming, apenas raster (SVG recusado), rate limit de 120/min e cabeçalhos `nosniff`/`CORP`. Verificado por HTTP: `file:`→400, `127.0.0.1`→403, HTML→415, SVG→415, PNG público→200, redirect para localhost→403, 121ª requisição→429. |
| 26/10/2026 | P0-4 | `@nestjs/throttler` global (300/min por IP) com limites específicos: login 10/min, cadastro 3/min, dados 60/min, assistente e copiloto 10/min, sync SRD 2/10 min; bloqueio por e-mail após 10 falhas (15 min) independente do IP; `ADMIN_EMAILS` opcional no sync SRD; fetch do SRD com timeout de 15 s e orçamento total de 2 min com resultado parcial; `trust proxy` corrigido para reconhecer `::ffff:127.0.0.1` (sem isso, todos os clientes dividiam o mesmo balde). Verificado com 429 por IP, 429 por e-mail e isolamento entre clientes. |
| 26/10/2026 | P0-5 | Sessão WebSocket com prazo: o `exp` do JWT vira timer por socket, é conferido em cada evento e há varredura de 60 s como rede de segurança; token vencido ou sem `exp` é encerrado já no handshake. Token bucket por socket para join/leave (10 a cada 2 s) e presença (5 a cada 2 s), nos namespaces `/vtt` e `/world`. Verificado com socket real: token de 4 s cai em ~3,4 s; token vencido e token sem `exp` caem em <10 ms; origem proibida é recusada no handshake; `localhost` conecta e permanece. |
| 26/10/2026 | P1-1 | Relógio atômico: `addMinutes` passou a incrementar no banco (sem ler-somar-gravar); `CampaignCalendar.lastTickAt` ganhou coluna própria e o tick usa CAS em `updateMany`, com recuperação limitada a 24 intervalos e cálculo puro em `planAutoTick`. Ensaio concorrente: 20 avanços simultâneos somaram exatamente 160 min; dois workers com o mesmo snapshot produziram **1 vencedor** e +180 min (3 intervalos). |
| 26/10/2026 | P1-2 | Concorrência otimista: `revision` em `VttMap`, `CombatEncounter` e `CampaignCalendar`, incluída nas projeções/eventos; `expectedRevision` opcional no PATCH do mapa, PATCH do combate e PUT do calendário, com CAS em transação e **409**. A mesa envia a revisão e recarrega em conflito; o formulário do calendário e o painel de combate também. Ensaio: duas edições simultâneas com a mesma revisão → 1 sucesso e 1 conflito no mapa e no calendário; revisão do mapa subiu uma única vez. |
| 26/10/2026 | P1-6 | Erros padronizados (`AllExceptionsFilter`): P2002→409, P2025→404, P2003/P2034→409, JSON inválido→400, inesperado→500 sem stack; corpo com `statusCode`, `error`, `message`, `requestId`, `timestamp` e `path`. Logs JSON (pino/nestjs-pino) com `x-request-id` gerado ou ecoado e redação de `authorization`/`cookie`/senhas. `/health/live`, `/health/ready` (banco + atraso do outbox) e `/api/metrics` Prometheus (desligado por padrão, token opcional) com gauges de outbox e de campanhas com tick. Verificado por HTTP: 409/400/404 no formato único, id ecoado, 401 sem token, 200 com token, 404 desligado e logs correlacionados. |
| 26/10/2026 | P1-3 (fase 1) | Leitura tolerante de JSON em `common/json.ts`, aplicada em dados, combate, SRD, catálogo, mapa, calendário e comandos: linha corrompida não derruba mais a requisição. Índices para nome de item/magia/monstro/regra, SRD (`endpoint`+`name`), diário, histórico de dados e conversa. Catálogo SRD paginado por cursor (`take` ≤ 100, `{items,nextCursor}`) com "Carregar mais" na biblioteca; catálogo geral limitado a 500 por consulta (`take` opcional) e histórico de dados limitado a 100. Verificado por HTTP: páginas 2+1 sem sobreposição, `take=3` respeitado e `breakdown` corrompido devolvido como fallback (200). |
| 26/10/2026 | P2-2 (fase 1) | React Query no cliente (`Providers`, cache de 15 s, retry 1, refetch ao focar/reconectar); copiloto e ficha do personagem migrados para `useQuery` (a ficha relê o PV a cada 30 s em vez de 4 s); intenções, comandos, prazos, memória e cena passaram de 3–10 s para **60 s de fallback**, mantendo a invalidação por socket e o refresh ao focar; `api.ts` ganhou timeout de 15 s e cancelamento por `AbortSignal`. Verificado com build e páginas públicas em produção. |
| 26/10/2026 | P2-3 | Uma conexão Socket.IO por aba: `realtime-client.ts` cria **um único Manager** e multiplexa `/vtt` e `/world`; cada componente recebe um canal que remove só os próprios handlers, e as salas usam contagem de referência (join uma vez, leave no último). Mesa, combate, memória e relógio migrados; `use-story-updates` deixou de abrir socket próprio e o `realtime.ts` antigo foi removido. Verificado com o cliente real: **1 Manager, transporte websocket, 2 namespaces conectados**; build e typecheck ok. |
| 27/10/2026 | P2-4 | Boundaries e estados de carregamento: `error.tsx` na raiz, na campanha e na ficha; `global-error.tsx`; `not-found.tsx` custom; `loading.tsx` com skeletons (raiz, dashboard, campanhas, ficha, biblioteca). Painel, personagens e campanhas ganharam erro com "Tentar de novo" — antes uma falha de API deixava "Carregando..." para sempre. `RequireAuth` limita a espera de hidratação a 2 s e o storage corrompido é descartado. Esta versão do Next usa `unstable_retry` no boundary (documentado em `node_modules/next/dist/docs`). Verificado em Chromium headless: o fallback do boundary renderiza em produção e rota inexistente devolve **404** com a página custom. |
| 27/10/2026 | P2-5 | E2E com Playwright 1.51 (4 cenários: landing, login/cadastro, 404 custom e cadastro → painel → criar/abrir campanha) contra backend real; limpeza de usuários `e2e-*`; CI no GitHub Actions com três jobs (backend com MySQL, lint/tipos/testes; frontend com lint/tipos/build; E2E com backend, Next de produção e Chromium) e relatório/trace publicado em falha. Verificado local: 4/4 testes em 6,7 s. |
| 27/10/2026 | P2-5 (CI) | A primeira execução do CI pegou o conteúdo de lore em CRLF: no Linux o checkout normaliza para LF e os hashes do manifesto/registro divergiam. Conteúdo e manifesto foram normalizados para LF e os hashes reancorados. Segunda execução: **backend, frontend e E2E verdes** (run 40453861228). |
| 27/10/2026 | P1-4 | OpenAPI 3 gerado a partir do app compilado (plugin do Swagger nos DTOs): **105 rotas e 61 schemas**, Swagger UI em `/api/docs` e JSON em `/api/docs-json`; em produção fica desligado sem `OPENAPI_ENABLED=1`. `docs/openapi.json` versionado e tipos do frontend gerados com `openapi-typescript` (`src/lib/openapi.d.ts`); o login/cadastro já usam `LoginRequest`/`RegisterRequest` do contrato. CI regenera o documento e compara os dois artefatos, falhando em divergência. |
| 27/10/2026 | P1-8 | Autorização centralizada em `CampaignAccessService`: uma consulta por campanha/usuário (mestre + membros), 404/403 padronizados e mensagens por chamador; 10 helpers duplicados em assistant, campaigns, combat, dice, journal, narration, vtt e world passaram a delegar. Cache por requisição via `AsyncLocalStorage` + middleware: duas verificações no mesmo request = **1 SELECT**, isolado entre requests (teste HTTP com supertest). **138 testes/25 suítes**. Limite: gateways/jobs não têm cache e chat/exploração/game-master ainda mantêm checagens próprias. |
| 27/10/2026 | P1-6 (auditoria) | Tabela `AuditLog` com ator/campanha/ação/recurso/`requestId`/metadados, índices e FKs `SET NULL`; interceptor global grava após o sucesso das ações anotadas com `@Audit` em campanha, VTT, combate, mundo, narração, assistente, copiloto e consequências. O corpo não é armazenado (só chaves/params) e falha de auditoria não derruba a ação. Consulta em `GET /campaigns/:campaignId/audit` (só mestre, cursor). Verificado por HTTP: `campaign.update` registrado com ator e metadados; jogador recebe 403. **142 testes/27 suítes**; E2E passou a conferir a auditoria. Sem retenção automática ainda. |
| 27/10/2026 | P2-2 (fase 2) | Evento `table:state` emitido após mutações de campanha (copiloto, intenções, comandos, prazos); o hook de tempo real invalida snapshots e as cinco telas deixaram de fazer polling de 60 s (copiloto também perdeu o `refetchInterval`). Diário paginado por cursor (`take` 1..100, 30 por página, "Carregar mais"). **144 testes/28 suítes**; E2E cobre o fluxo. Ainda há leitura de segurança de 30 s na ficha e 60 s na cena de lore; o catálogo segue limitado a 500 por consulta. |
| 27/10/2026 | Mestre IA local (fase 1) | Spec em `docs/24-mestre-ia-local.md`: modo `AUTONOMOUS`, contexto de cena compilado (fatos públicos, personagens, eventos recentes), schema fechado de narração, validação contra mecânica/meta-discurso/HTML, reparo único e fallback 422. Nova página `/campaigns/:id/play`, controles de mestre com CAS e narração persistida como `StoryEvent` público. **155 testes/30 suítes**; OpenAPI com 109 rotas. Mecânica, fatos e combate continuam manuais. |

**P2-2 fase 2 (próxima):** converter as demais telas para `useQuery`/`useMutation` (as ações ainda chamam `load` manualmente), remover o fallback onde houver evento de domínio e usar paginação infinita no catálogo. A conexão única de socket continua no P2-3.

**Limites do P2-3:** se a mesa desmontar enquanto outra tela da mesma campanha continua aberta, a presença pode ficar marcada até o disconnect (o servidor não tem “downgrade” de presença). Para várias campanhas na mesma aba, o evento `world:clock:updated` ainda não carrega `campaignId`; hoje cada página usa uma campanha só.

**Pendente do P1-6:** trilha de auditoria das ações do mestre (ator, alvo, diff) — pede tabela própria e interceptor; fica para o próximo ciclo.

**P1-3 fase 2 (próxima):** migrar as 12 colunas JSON-as-text para o tipo `Json` do Prisma. Exige atualizar `prisma/seed.ts`, o utilitário `scripts/mysql/transfer.cjs` e todos os pontos de escrita; por isso ficou separado. Paginar também as abas de itens/magias/monstros da biblioteca, de preferência junto do P2-2 (React Query).

**Limite conhecido (revogação):** remover um membro já derruba o acesso na hora
(`evictUser`). Revogar um token específico antes do vencimento — logout em todos
os aparelhos ou troca de senha — exige um `tokenVersion` por usuário conferido a
cada requisição; fica como item de P1, junto do Redis adapter.

---

## Anexo A — Evidências coletadas (baseline da análise, 26/10/2026)

- **Git**: raiz sem `.git`; `frontend` em `master` com 1 commit, 19 arquivos
  rastreados, 98 não rastreados, sem remoto.
- **Ambiente**: `backend/.env` com `JWT_SECRET` idêntico ao fallback do código;
  `DATABASE_URL` MySQL `root@localhost:3306/rpg`.
- **Build estático**: `tsc --noEmit` backend exit 0; frontend exit 0;
  `eslint src` frontend 0 erros/1 aviso; eslint backend sem saída;
  `jest --runInBand` 8 suítes / 66 testes aprovados.
- **Tamanhos**: `vtt-panel.tsx` 2.618 linhas / 74 `useState` / 25 chamadas `api`;
  `vtt.service.ts` 1.037; `story.service.ts` 835; `world.service.ts` 738;
  `game-actions.service.ts` 698; `game-master.service.ts` 584;
  `world/page.tsx` 962; `library/page.tsx` 794.
- **Schema**: 62 modelos, 33 `@@index`, 44 `@@unique`, 126 `onDelete`,
  0 `Json`, 51 `LongText`, 28 `Text`.
- **Rotas e guards**: 137 rotas HTTP, 23 controllers, 21 usos de `@UseGuards`;
  apenas `AppController` e `HealthController` sem guard.
- **Banco/fila**: 7 migrações MySQL ativas, 30 migrações SQLite legadas,
  `OutboxEvent` com `leaseToken`/`leaseUntil` e índices corretos.
- **Peso do workspace**: 760 MB sem `node_modules`/`.next` (690 MB do RAR);
  `frontend/.next` 1,83 GB; `backend/backups` 58,6 MB (inclui duas cópias do
  banco de desenvolvimento usadas no ensaio da migração MySQL).
