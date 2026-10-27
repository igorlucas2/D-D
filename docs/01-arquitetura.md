# Arquitetura Geral

## Visão Geral

Plataforma web (e futuramente mobile) para RPG de mesa com sistema próprio
inspirado em RPGs medievais de fantasia (não copia conteúdo proprietário de D&D 5e,
apenas se inspira na estrutura geral: atributos, classes, magias, combate por turnos).

## Stack

### Frontend Web
- **Next.js 14 (App Router)** + TypeScript
- **TailwindCSS** + **shadcn/ui** para componentes
- **Zustand** ou **TanStack Query** para estado/cache de dados do servidor
- **Socket.IO client** para tempo real (mesa virtual, ficha, combate)
- **dnd-kit** para drag & drop (inventário/equipamentos)
- **Three.js / @react-three/fiber** para dados 3D

### Backend
- **NestJS** (Node.js + TypeScript)
- **Prisma ORM**
- **Socket.IO (via @nestjs/websockets)** para tempo real
- **JWT** (access + refresh token) para autenticação
- **class-validator / class-transformer** para validação de DTOs

### Banco de Dados
- **Fase atual (dev/MVP): SQLite** (arquivo local `dev.db`, gerenciado via Prisma)
- **Fase futura (produção): PostgreSQL**
- Migração facilitada porque:
  - Todo acesso a dados passa pelo Prisma (nenhuma query SQL nativa específica de SQLite)
  - O schema (`schema.prisma`) evita tipos exclusivos do SQLite
  - Para migrar: trocar `provider = "sqlite"` → `provider = "postgresql"`,
    ajustar `DATABASE_URL` no `.env` e rodar `prisma migrate deploy`
  - Tipos `Json`, enums e relações já são escritos de forma compatível com Postgres

### Tempo Real
- WebSockets (Socket.IO) para:
  - Ficha de personagem (atualização ao vivo)
  - Mesa virtual (tokens, fog of war, grid)
  - Combate (iniciativa, turnos, vida)
  - Chat/dados rolados na campanha

### Mobile (futuro)
- **React Native (Expo)** reaproveitando lógica de domínio (pacote `packages/shared`)
  e consumindo a mesma API NestJS
- Sincronização automática via API + cache local (SQLite/AsyncStorage no device)

### Infraestrutura
- **Docker** + **docker-compose** (API, banco, frontend)
- Dev local: SQLite não precisa de container; Postgres (quando migrar) roda em container

## Monorepo

```
online-rpg/
├── backend/      # API NestJS + Prisma
├── frontend/     # Next.js (web)
├── mobile/       # (futuro) React Native/Expo
├── packages/
│   └── shared/   # tipos, regras de cálculo (modificadores, CA, vida, etc.)
└── docs/         # documentação do projeto
```

## Camadas do Backend (NestJS)

```
src/
├── auth/         # login, registro, JWT, guards
├── users/        # perfil, avatar, conquistas, nível de conta
├── characters/   # personagens, atributos, cálculo automático
├── inventory/    # itens, equipamentos
├── spells/       # magias, slots
├── dice/         # rolagens + histórico
├── campaigns/    # campanhas, convites, sessões
├── vtt/          # mesa virtual (tokens, mapas, fog of war) - via gateway WS
├── combat/       # gerenciador de combate
├── journal/      # diário da campanha
├── library/      # biblioteca (regras, monstros, itens, magias, NPCs)
├── world/        # mundo (continentes, reinos, facções, etc.)
├── ai-master/    # assistente de IA para mestres
└── prisma/       # PrismaService + schema
```

## Regra de cálculo (compartilhada)

As fórmulas de modificadores, CA, iniciativa, vida e proficiência ficam em
`packages/shared/src/rules` para serem usadas tanto no backend (cálculo
autoritativo ao salvar) quanto no frontend (preview em tempo real durante
edição da ficha).
