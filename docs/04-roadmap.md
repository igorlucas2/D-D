# Roadmap

## MVP (foco da primeira entrega)

Objetivo: usuário consegue se cadastrar, criar um personagem com cálculo
automático de atributos e usar uma ficha interativa básica + rolar dados.

- [x] Estrutura do monorepo (backend NestJS + frontend Next.js)
- [x] Banco de dados (SQLite via Prisma, schema cobrindo módulos 1-4 + base p/ os demais)
- [x] Módulo 1 — Usuários: cadastro, login (JWT), perfil básico, avatar, nível de conta
- [x] Módulo 2 — Personagens: CRUD, cálculo automático (modificadores, CA, iniciativa, vida, proficiência, resistências)
- [x] Módulo 3 — Ficha Interativa: layout completo, abas de inventário e magias, barras de vida/mana/XP
- [x] Módulo 4 — Dados: rolagem (D4-D100), histórico de rolagens
- [x] Telas: landing, login, registro, dashboard, lista/criação de personagem, ficha, dados

## Versão 1.0

- [x] Módulo 5 — Campanhas (criação, convite por link, participantes)
- [x] Módulo 6 — Mesa Virtual (grid, tokens, fog of war, medição, marcadores) via WebSockets
  - [x] Persistência de mapas, tokens e fog of war via REST + Prisma
  - [x] Painel web de mesa na campanha com grid, tokens arrastáveis, fog e medição
  - [x] Gateway Socket.IO para sincronização em tempo real entre jogadores
  - [x] Marcadores/anotações de mapa (criação pelo mestre, arrastáveis, com nota)
- [x] Módulo 7 — Combate (iniciativa, turnos, vida de monstros, condições, adicionar do bestiário)
- [x] Módulo 8 — Inventário avançado (drag&drop entre equipados/mochila, busca global de itens com filtros na ficha)
- [x] Módulo 9 — Magias (slots automáticos por classe/nível conforme SRD, substituindo o pool de mana legado)
- [x] Módulo 11 — Diário da Campanha (sessões, eventos, mortes, loot, decisões, timeline)
- [x] Módulo 12 — Biblioteca (bestiário, itens e magias com busca/filtros)
  - [x] Integração com a SRD 5e API (dnd5eapi.co): sincronização sob demanda e cache local
  - [x] Regras de referência e NPCs prontos
- [x] Módulo 13 — Sistema de Mundo (continentes, reinos, facções, religiões, idiomas, calendário)

## Próxima versão

- [x] Módulo 15 — Mundo Vivo: mapas hierárquicos navegáveis, relógio do
  mundo, economia de ações/descanso por personagem e avanço assíncrono da
  campanha (24h). Detalhamento completo em `08-mundo-vivo.md`.
  - [x] Fase 1 — Hierarquia de mapas e hotspots de navegação (mestre cria
    locais clicáveis que levam a outros mapas, por clique ou arrastando para
    desenhar a área; jogador navega clicando; breadcrumb da hierarquia)
  - [x] Fase 2 — Relógio do mundo (contador `totalMinutes` sincronizado via
    socket, widget no dashboard e na aba Calendário, avanço manual pelo
    mestre)
  - [x] Fase 3 — Economia de ações e descanso por personagem
    (`CharacterExplorationState` com pontos de ação/fadiga, viagem por
    hotspot com custo configurável, descanso curto/longo que avança o
    relógio e restaura HP/slots)
  - [x] Fase 4 — Eventos de local (`eventNote` e `triggerJournalCategory`
    por hotspot; ao viajar pela primeira vez para um hotspot configurado, o
    sistema cria uma entrada de diário automaticamente)
  - [x] Fase 5 — Avanço assíncrono (`realMinutesPerTick`/`gameMinutesPerTick`
    por campanha, `WorldTickService` com `@nestjs/schedule` avança o relógio
    mesmo sem jogadores conectados, configurável na aba Calendário) e tabela
    de eventos aleatórios (`CampaignWorldEvent`, sorteio ponderado por
    `weight` com `eventChancePercent` a cada avanço, registrado no diário;
    gerenciada pelo mestre na aba Eventos)
  - [x] Fase 6 — Tela de exploração do jogador (`/campaigns/[id]/explore`
    com relógio, ações/descanso, mesa com hotspots e diário recente)

## Pós v1.0 / melhorias contínuas
- Imersão (som, dia/noite, clima, dados compartilhados, narração): ver `11-imersao.md`
- Editor visual de mapas para a mesa virtual
- Notificações push (mobile)
- Modo offline parcial (mobile)
- Internacionalização (PT-BR / EN)

 
