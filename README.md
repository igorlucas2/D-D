# D-D

[![CI](https://github.com/igorlucas2/D-D/actions/workflows/ci.yml/badge.svg)](https://github.com/igorlucas2/D-D/actions/workflows/ci.yml)

Plataforma de RPG de mesa — **Eldoria** — com backend NestJS/Prisma (MySQL) e
frontend Next.js 16/React 19, mesa virtual (VTT) em tempo real via Socket.IO.

> Monorepo criado a partir do projeto local em 26/10/2026. Código em `backend/` e
> `frontend/`; documentação de produto e arquitetura em `docs/`.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, shadcn/base-ui, Zustand, Socket.IO client |
| Mesa 3D e dados | three.js, @react-three/fiber, cannon-es |
| Backend | NestJS 11, Prisma 6, class-validator, Passport/JWT |
| Banco | MySQL 8 (histórico SQLite preservado em `backend/prisma/migrations`) |
| Tempo real | Socket.IO (namespaces `/vtt` e `/world`) |
| IA | Assistente do mestre (Anthropic, opcional) e copiloto local (Ollama) |

## Como rodar

Windows, dois cliques em **`Iniciar Eldoria.cmd`**. O guia completo (portas,
túnel, logs, opções) está em [COMO-RODAR.md](COMO-RODAR.md).

Requisitos: Node.js 20+, `backend/.env` (copie de `backend/.env.example`) e
`frontend/.env.local`.

```powershell
.\scripts\eldoria.ps1            # desenvolvimento
.\scripts\eldoria.ps1 -Mode prod # produção local
```

## Estrutura

```
backend/    API NestJS + Prisma (migrações MySQL em prisma/mysql-migrations)
frontend/   Next.js (App Router) + componentes da mesa e da ficha
docs/       especificações, lore e histórico de decisões
scripts/    monitor de desenvolvimento (eldoria.ps1)
```

## Documentação

- `docs/01-arquitetura.md` — visão geral (ver nota de atualização pendente)
- `docs/08-mundo-vivo.md` — mapas, relógio e exploração
- `docs/11-imersao.md` — som, clima, dia/noite, dados e narração
- `docs/13-mestre-ia-lore.md` — lore, memória e mestre de IA
- `docs/22-analise-e-propostas.md` — análise técnica e plano de melhorias

## Estado

Projeto em desenvolvimento ativo, com testes unitários no backend
(`cd backend; npm test`) e verificação estática nos dois lados
(`npx tsc --noEmit`, `npx eslint src`).

## Licença e conteúdo de terceiros

Código de uso privado. As fichas de referência vêm do **SRD 5.1** (CC BY 4.0),
via `dnd5eapi.co`; a atribuição formal será publicada na página de créditos
(item P2-6 de `docs/22-analise-e-propostas.md`).
