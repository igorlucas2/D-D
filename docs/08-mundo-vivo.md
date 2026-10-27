# Módulo 15 — Mundo Vivo (mapas hierárquicos, tempo e ações)

> Roadmap de implementação para transformar a campanha em um mundo navegável
> e contínuo: o mestre monta uma árvore de mapas (mundo → região → cidade →
> casa/local), o jogador navega clicando nos locais, e cada ação do jogador
> consome tempo de jogo, que se acumula mesmo entre sessões — exigindo
> descanso para recuperar recursos.

Este documento complementa `02-modelo-de-dados.md` e `06-apis.md`. Cada fase
abaixo é incremental e pode ser entregue isoladamente.

## Conceitos novos

- **Mapa hierárquico**: todo `VttMap` pode ter um mapa "pai" e ser alcançado
  através de um *hotspot* (ponto/área clicável) desenhado no mapa pai.
  Ex.: Mapa do Reino → hotspot "Cidade de Valdor" → Mapa da Cidade → hotspot
  "Taverna do Corvo" → Mapa da Taverna (interior).
- **Hotspot**: marcador posicionado num mapa que aponta para outro mapa
  (ou para um evento). É o que o mestre desenha; é o que o jogador clica.
- **Relógio do mundo**: extensão do `CampaignCalendar` já existente, com
  granularidade de minutos/horas, que avança conforme as ações dos jogadores
  (e, opcionalmente, sozinho com o tempo real — "campanha 24h").
- **Economia de ações/tempo**: cada ação de exploração (viajar para um
  hotspot, descansar, investigar, etc.) consome um custo em minutos de jogo
  e, opcionalmente, "pontos de ação"/fadiga do personagem.
- **Descanso**: ação especial que consome bastante tempo de jogo e restaura
  recursos do personagem (vida, espaços de magia, pontos de ação).

## Fase 1 — Hierarquia de mapas e navegação básica ✅ (concluída)

Objetivo: o mestre consegue ligar mapas entre si; o jogador navega clicando.

- [x] Prisma: adicionar a `VttMap`:
  - `parentMapId String?` (auto-relação `VttMap` ↔ `VttMap`, com proteção
    contra ciclos via `assertNotDescendant`)
  - `kind` enum (`WORLD | REGION | SETTLEMENT | BUILDING | INTERIOR | OTHER`) — usado para ícone/breadcrumb
  - Simplificação: o vínculo "hotspot de origem" é resolvido via
    `VttMapHotspot.targetMapId @unique` (1:1 opcional), sem precisar de um
    campo `parentHotspotId` redundante em `VttMap`.
- [x] Novo model `VttMapHotspot`:
  - `id, mapId` (mapa onde o hotspot é desenhado)
  - `x, y, width, height` (área clicável, em unidades de grid — mesmo
    sistema de coordenadas dos tokens, com clamp automático aos limites do mapa)
  - `label, icon, color`
  - `targetMapId String? @unique` (mapa de destino; pode ser nulo até o mestre criar)
  - `visibleToPlayers Boolean @default(true)`
- [x] Backend (`vtt` module):
  - `POST/PATCH/DELETE /campaigns/:id/vtt/maps/:mapId/hotspots(/:hotspotId)`
  - `POST /campaigns/:id/vtt/maps/:mapId/hotspots/:hotspotId/target`
    — atalho "criar mapa filho a partir deste hotspot" (cria `VttMap` com
    `parentMapId` já preenchido e vincula `targetMapId` do hotspot)
  - Reaproveitados os eventos socket existentes `vtt:map:created/updated`
    (cada mapa serializado já inclui `hotspots`), sem necessidade de eventos
    novos
- [x] Frontend — modo mestre:
  - Ferramenta "Hotspot" (ícone bússola) no `VttPanel`: clique numa célula
    abre diálogo para nomear, escolher tamanho/ícone/cor e linkar a um mapa
    existente ou criar um novo mapa filho
  - Hotspots renderizados como overlays tracejados na grade 2D; clique num
    hotspot existente reabre o diálogo para editar/excluir
  - Seletor de "Tipo" (`kind`) no diálogo de criação de mapa
- [x] Frontend — modo jogador:
  - Hotspots visíveis (`visibleToPlayers`) ficam clicáveis; clique navega
    para `targetMapId` (troca o `selectedMapId` no `VttPanel`)
  - Breadcrumb no topo do painel (`Mundo > Reino > Cidade de Valdor`),
    construído subindo por `parentMapId`
  - Painel lateral "Locais" lista os hotspots do mapa atual com atalho de
    navegação

- [x] Desenhar hotspots por arraste: com a ferramenta "Hotspot" ativa, o
  mestre pode arrastar na grade 2D para definir a área (`x, y, width,
  height`) diretamente; um clique simples ainda cria uma área 1x1, e os
  campos de largura/altura no diálogo continuam editáveis manualmente.

Pendente para uma iteração futura: overlay de hotspots na visão 3D.

## Fase 2 — Relógio do mundo ✅

Objetivo: existe um tempo de jogo compartilhado, sincronizado em tempo real.

- [x] Prisma: estendido `CampaignCalendar`
  - `totalMinutes Int @default(0)` — contador absoluto, fonte da verdade
    (usamos `Int`, não `BigInt`: até ~4084 anos de jogo cabem em um Int do
    SQLite, e evita problemas de serialização JSON do `BigInt`)
  - `currentDay/Month/Year/Hour/Minute` continuam existindo como cache
    derivado, recalculados a partir de `totalMinutes` + `daysPerMonth`
  - `currentHour Int @default(8)`, `currentMinute Int @default(0)`
  - migration `campaign_calendar_clock` aplicada
  - backfill: campanhas existentes (`totalMinutes === 0` mas com
    `currentDay/Month/Year` não triviais) têm o `totalMinutes` calculado a
    partir desses campos no primeiro carregamento e persistido, para não
    resetar a data para Ano 1/Dia 1
- [x] Backend (`world` module):
  - `POST /campaigns/:id/world/clock/advance { minutes }` — avança o relógio
    (somente mestre); `PUT /campaigns/:id/world/calendar` também aceita
    `currentHour`/`currentMinute` e recalcula `totalMinutes`
  - Novo `world.gateway.ts` (namespace `world`, eventos `world:join`,
    `world:leave`, `world:joined`, `world:clock:updated`, `world:error`),
    seguindo o mesmo padrão do `vtt.gateway.ts`
  - `GET /campaigns/:id/world/calendar` agora retorna também `totalMinutes`,
    `currentWeekdayIndex` (índice 0-based em `weekdayNames`)
- [x] Frontend:
  - `WorldClockWidget` (componente novo) conecta ao namespace `/world`,
    entra na sala da campanha e atualiza data/hora/dia da semana via
    `world:clock:updated`
  - Exibido no dashboard da campanha (`/campaigns/[id]`); mestre vê botões
    de avanço rápido (+10min, +30min, +1h, +8h, +1 dia)
  - Aba "Calendário" em `/campaigns/[id]/world` mostra dia da semana e
    horário atuais, e o diálogo de edição do mestre ganhou campos de
    hora/minuto

## Fase 3 — Economia de ações e descanso por personagem ✅

Objetivo: cada personagem tem um "orçamento" de ações que se gasta ao
explorar e se recupera ao descansar.

- [x] Prisma: novo model `CharacterExplorationState`
  - `id, characterId (unique), campaignId`
  - `currentMapId String?` — onde o personagem está agora na árvore de mapas
  - `actionPoints Int @default(6)`, `maxActionPoints Int @default(6)`
  - `fatigue Int @default(0)`
  - `lastRestAtMinutes Int @default(0)` (referência ao `totalMinutes` do
    relógio do mundo — usamos `Int`, não `BigInt`, pelo mesmo motivo da Fase 2)
  - `VttMapHotspot` ganhou `travelActionCost Int @default(1)` e
    `travelMinutes Int @default(30)`, configuráveis pelo mestre no diálogo de
    edição do hotspot
  - migration `exploration_state` aplicada
- [x] Backend (`exploration` module, importa `CharactersModule` e
  `WorldModule` que agora exportam seus serviços):
  - `GET /campaigns/:id/characters/:characterId/exploration` — estado atual
    (cria com valores padrão na primeira chamada)
  - `POST /campaigns/:id/characters/:characterId/travel { hotspotId }`:
    valida que o hotspot pertence à campanha, tem `targetMapId` e (se o
    personagem já tem `currentMapId`) pertence ao mapa atual; debita
    `actionPoints` pelo `travelActionCost` do hotspot e avança o relógio em
    `travelMinutes`; atualiza `currentMapId` para `targetMapId`
  - `POST /campaigns/:id/characters/:characterId/rest { type: "short"|"long" }`:
    avança o relógio (1h / 8h via novo `WorldService.addMinutes`, sem checagem
    de mestre), restaura `actionPoints` ao máximo; descanso longo zera
    `fatigue` e restaura HP/espaços de magia (`CharactersService.longRest`),
    descanso curto reduz `fatigue` em 1
- [x] Frontend:
  - `ExplorationHud` (componente novo) no dashboard da campanha: seletor de
    personagem (quando o usuário tem mais de um), badges "Ações: X/Y",
    "Fadiga: N" e "Próximo descanso recomendado" (quando `actionPoints === 0`
    ou `fatigue > 0`), botões de descanso curto/longo com confirmação
    (`window.confirm`)
  - `VttPanel`: diálogo de hotspot (mestre) ganhou campos de "Custo (pontos de
    ação)" e "Tempo de viagem (minutos)" quando o hotspot tem destino; clique
    do jogador num hotspot com destino chama `POST .../travel`, atualiza o
    estado de exploração compartilhado e troca de mapa; hotspots ficam com
    ícone de cadeado e desabilitados quando `actionPoints` é insuficiente

Simplificação: como `Character` não tem vínculo direto com `Campaign`, o
`ExplorationHud` deixa o jogador escolher entre todos os seus personagens
(`GET /characters`); `CharacterExplorationState.campaignId` é gravado na
criação do estado (primeira consulta/viagem/descanso).

## Fase 4 — Eventos de local (o que o mestre configura por hotspot) ✅

Objetivo: o mestre anota o que existe/acontece em cada local sem precisar de
um mapa filho completo.

- [x] Prisma: `VttMapHotspot` ganhou
  - `eventNote String?` (texto livre, visível só ao mestre)
  - `triggerJournalCategory JournalCategory?` — ao ser visitado pela primeira
    vez, cria automaticamente uma `CampaignJournalEntry`
  - `firstVisitedAt DateTime?` — marcado na primeira viagem para o hotspot
  - migration `hotspot_events` aplicada
- [x] Backend: `POST /campaigns/:id/characters/:characterId/travel` agora,
  quando o hotspot de destino tem `triggerJournalCategory` e ainda não tem
  `firstVisitedAt`, marca `firstVisitedAt = now()` e cria uma
  `CampaignJournalEntry` (título "Local descoberto: <label>", conteúdo =
  `eventNote` ou uma frase padrão, `category = triggerJournalCategory`,
  `authorId = campaign.masterId`) diretamente via `PrismaService` (sem
  depender do `JournalModule`)
- [x] Frontend — modo mestre: diálogo de edição do hotspot (mesmo diálogo da
  Fase 1) ganhou um campo de texto "Nota do evento (visível só ao mestre)" e
  um seletor "Registrar no diário ao ser visitado pela primeira vez" com as
  categorias do diário (`JOURNAL_CATEGORIES`) ou "Nenhuma"

## Fase 5 — Avanço assíncrono ("campanha roda 24h") ✅

Objetivo: o tempo de jogo (e eventos simples) avançam mesmo sem jogadores
conectados, dentro de um ritmo configurado pelo mestre.

- [x] Prisma: `CampaignCalendar` ganhou
  - `realMinutesPerTick Int @default(0)` (0 = desligado/manual)
  - `gameMinutesPerTick Int @default(60)`
  - `eventChancePercent Int @default(0)` (0-100; chance de sortear um evento
    da tabela a cada avanço automático)
  - migration `world_tick_config` aplicada
  - migration `world_events_table` aplicada
- [x] Novo model `CampaignWorldEvent` (tabela de eventos aleatórios por
  campanha): `id, campaignId, title, content, category (JournalCategory),
  weight Int @default(1), isActive Boolean @default(true)`
- [x] Backend: `WorldTickService` (`world/world-tick.service.ts`) com
  `@nestjs/schedule` (`@Cron(CronExpression.EVERY_MINUTE)`, registrado via
  `ScheduleModule.forRoot()` no `AppModule`):
  - a cada minuto, para cada `CampaignCalendar` com `realMinutesPerTick > 0`
    (`WorldService.findCampaignsWithAutoTick`), verifica se já se passaram
    `realMinutesPerTick` minutos reais desde `updatedAt`; se sim, soma
    `gameMinutesPerTick` ao `totalMinutes` via `WorldService.addMinutes`
    (que já emite `world:clock:updated` e atualiza `updatedAt`, reiniciando
    a contagem do próximo tick)
  - se o avanço ocorreu e `eventChancePercent > 0`, sorteia (com
    `Math.random() * 100 < eventChancePercent`) se um evento será disparado;
    em caso positivo, `WorldService.rollWorldEvent` faz uma seleção aleatória
    ponderada (roleta acumulada por `weight`) entre os `CampaignWorldEvent`
    com `isActive: true` e cria uma `CampaignJournalEntry` (autor = mestre da
    campanha) com o `title`/`content`/`category` do evento sorteado
  - CRUD da tabela de eventos (`GET/POST/PATCH/DELETE
    /campaigns/:id/world/events(/:eventId)`), restrito ao mestre
    (`assertIsMaster`)
- [x] Frontend — modo mestre: aba "Calendário" (`/campaigns/[id]/world`) no
  diálogo de edição do calendário ganhou os campos "Avanço automático
  (minutos reais)", "Tempo de jogo por avanço (minutos)" (ex.: 60/240 = "1h
  real = 4h de jogo"; 0 desliga o avanço automático) e "Chance de evento
  aleatório por avanço (%)"; badges mostram o ritmo e a chance configurados
  quando ativos
  - Nova aba "Eventos" (visível só ao mestre) lista a tabela de eventos da
    campanha com categoria, peso e estado ativo/inativo, com diálogo de
    criação/edição (título, conteúdo, categoria, peso 1-100, ativo) e ações
    de editar/ativar/desativar/excluir

## Fase 6 — Tela de exploração do jogador ✅

Objetivo: experiência dedicada de navegação, separada da mesa de combate.

- [x] Nova rota `/campaigns/[id]/explore` (link "Exploração" no dashboard da
  campanha):
  - `VttPanel` (mapa 2D/3D com hotspots navegáveis e breadcrumb da
    hierarquia, Fase 1) reaproveitado como está
  - `WorldClockWidget` (Fase 2) e `ExplorationHud` (ações/descanso, Fase 3)
    no topo da coluna principal
  - Painel lateral "Diário recente" com as últimas 5 entradas de
    `CampaignJournalEntry` da campanha (inclui as entradas automáticas de
    "Local descoberto" da Fase 4) e atalho para o diário completo

Simplificação: em vez de um painel "do local atual" (entradas de diário não
têm vínculo direto com `VttMap`/hotspot), o painel lateral mostra as entradas
mais recentes da campanha como um todo — já cobre o caso de uso de
"o que aconteceu de novo" sem exigir um novo relacionamento no schema.
`VttPanel` é reaproveitado sem alterações (a rota dedicada substitui a
combinação combate+exploração do dashboard, conforme a segunda opção
listada).

## Integrações com o que já existe

- `CampaignWorldEntry` (continentes/reinos/facções) pode ganhar um campo
  opcional `mapId` para linkar a entrada de lore ao seu `VttMap`
  correspondente — não é pré-requisito, mas evita duplicar hierarquias.
- O sistema de combate (`CombatEncounter`) continua independente; viajar para
  um hotspot que tenha um encontro associado pode futuramente iniciar um
  `CombatEncounter` automaticamente (fora do escopo inicial).
- Tudo reaproveita o gateway Socket.IO já usado pelo VTT (`getSocketUrl`),
  evitando nova infraestrutura de realtime.

## Ordem sugerida

1. Fase 1 (hierarquia + navegação) — maior valor visual imediato, sem
   depender de nada novo além do `vtt` module.
2. Fase 2 (relógio) — base de dados pequena, necessária para as fases
   seguintes.
3. Fase 3 (ações/descanso) — depende do relógio.
4. Fase 4 (eventos de local) — incremento pequeno sobre a Fase 1.
5. Fase 6 (tela de exploração) — pode ser feita em paralelo assim que as
   Fases 1-3 tiverem APIs mínimas.
6. Fase 5 (avanço assíncrono/24h) — por último: é a única que exige um job
   em background e mais cuidado operacional.
