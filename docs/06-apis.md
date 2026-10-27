# APIs (REST + WebSocket)

Base URL: `http://localhost:3001/api`

## Auth
| Método | Rota | Descrição |
|---|---|---|
| POST | /auth/register | Cria usuário (email, senha, displayName) |
| POST | /auth/login | Retorna access/refresh token |
| POST | /auth/refresh | Renova access token |
| GET | /auth/me | Dados do usuário autenticado |

## Users
| Método | Rota | Descrição |
|---|---|---|
| GET | /users/:id | Perfil público |
| PATCH | /users/me | Atualiza perfil (nome, avatar) |
| GET | /users/me/achievements | Lista conquistas do usuário |

## Characters
| Método | Rota | Descrição |
|---|---|---|
| GET | /characters | Lista personagens do usuário |
| POST | /characters | Cria personagem (calcula CA, vida, etc. no servidor) |
| GET | /characters/:id | Detalhe da ficha |
| PATCH | /characters/:id | Atualiza atributos/dados (recalcula derivados) |
| DELETE | /characters/:id | Remove personagem |
| POST | /characters/:id/inventory | Adiciona item ao inventário |
| PATCH | /characters/:id/inventory/:itemId | Equipa/desequipa, muda quantidade |
| GET | /characters/:id/spells | Lista magias do personagem |

## Dice
| Método | Rota | Descrição |
|---|---|---|
| POST | /dice/roll | Rola fórmula (ex.: `2d6+3`), retorna resultado + breakdown |
| GET | /dice/history | Histórico de rolagens do usuário (paginado) |

## Campaigns (v1.0)
| Método | Rota | Descrição |
|---|---|---|
| GET/POST | /campaigns | Lista/cria campanhas |
| GET | /campaigns/:id | Detalhe |
| POST | /campaigns/:id/invite | Gera link de convite |
| POST | /campaigns/join/:inviteCode | Entra na campanha |
| CRUD | /campaigns/:id/sessions | Sessões/calendário |

## Combat (v1.0)
| Método | Rota | Descrição |
|---|---|---|
| POST | /campaigns/:id/combat/start | Inicia encontro, calcula iniciativa |
| PATCH | /combat/:id/participants/:pid | Atualiza HP/condições |
| POST | /combat/:id/next-turn | Avança turno |
| GET | /campaigns/:id/combat/actions | Histórico do ledger de dano/cura/PV/condição |
| POST | /campaigns/:id/combat/actions | Aplica dano/cura/PV temporário/condição com alvo, fórmula, idempotência e revisão |
| POST | /campaigns/:id/combat/items/use | Consome um item do inventário e aplica cura/PV temporário/dano no próprio personagem |
| POST | /campaigns/:id/combat/spells/cast | Consome espaço e resolve cura/dano, save, alvos e upcast no servidor |

## Mesa Virtual / VTT (v1.0)
| Método | Rota | Descrição |
|---|---|---|
| GET/POST | /campaigns/:id/vtt/maps | Lista/cria mapas da campanha |
| GET/PATCH/DELETE | /campaigns/:id/vtt/maps/:mapId | Detalhe, atualiza ou remove um mapa |
| POST | /campaigns/:id/vtt/maps/:mapId/tokens | Adiciona token ao mapa |
| PATCH/DELETE | /campaigns/:id/vtt/maps/:mapId/tokens/:tokenId | Move, atualiza, oculta ou remove token |

## WebSocket Gateways (v1.0)
| Namespace | Eventos |
|---|---|
| /character | `character:update` (sync ficha em tempo real) |
| /vtt | cliente: `vtt:join`, `vtt:leave`; servidor: `vtt:map:created`, `vtt:map:updated`, `vtt:map:removed`, `vtt:error` |
| /combat | `turn:next`, `participant:update`, `initiative:rolled` |
| /campaign | `chat:message`, `dice:rolled` |

## Library / World / AI Master (v1.0)
| Método | Rota | Descrição |
|---|---|---|
| GET | /catalog/monsters, /catalog/items, /catalog/spells, /catalog/rules | Catálogos ordenados por nome; `take` opcional (1..500, padrão 500) |
| CRUD | /world/continents, /kingdoms, /factions, /religions, /languages | Sistema de mundo |

## Mestre IA local (Ollama)

| Método | Rota | Descrição |
|---|---|---|
| GET | /campaigns/:campaignId/ai-master/state | Modo, pausa, cena, personagens, últimas narrações públicas e status do modelo |
| PATCH | /campaigns/:campaignId/ai-master/settings | Só mestre: `{ mode: 'OFF'|'COPILOT'|'AUTONOMOUS', paused, expectedRevision }` |
| POST | /campaigns/:campaignId/ai-master/act | `{ requestKey, action, characterId?, expectedRevision }`; narra e grava um evento público |
| POST | /campaigns/:campaignId/ai-master/narrate-action | `{ requestKey, actionId }`; narra um resultado mecânico já aplicado, sem recalculá-lo |

O modelo local só produz narração; não aplica dano, PV, item, tempo ou movimento. Detalhes e critérios de aceite em `docs/24-mestre-ia-local.md`.

## SRD 5e Integration
| Método | Rota | Descrição |
|---|---|---|
| POST | /catalog/srd/sync | Sincroniza endpoints da API `https://www.dnd5eapi.co/api` para cache local |
| GET | /catalog/srd/endpoints | Lista endpoints SRD importados e contagem local |
| GET | /catalog/srd/resources | Lista paginada: `endpoint`, `search`, `take` (1..100, padrão 50) e `cursor`; devolve `{ items, nextCursor }` |
| GET | /catalog/srd/resources/:endpoint/:index | Retorna recurso SRD detalhado com JSON original |

## Auditoria

| Método | Rota | Descrição |
|---|---|---|
| GET | /campaigns/:campaignId/audit | Lista paginada das ações de mestre (`take` 1..100, `cursor`); exige ser mestre da campanha |

As ações de mestre em campanha, VTT, combate, mundo, narração, assistente, copiloto e consequências são registradas com ator, campanha, ação, recurso, `requestId` e metadados da rota. O corpo da requisição não é gravado.

## OpenAPI e tipos do frontend

- `GET /api/docs` — Swagger UI interativa (desenvolvimento/teste; em produção exige `OPENAPI_ENABLED=1`).
- `GET /api/docs-json` — documento OpenAPI 3.
- O arquivo versionado `docs/openapi.json` é gerado a partir do app compilado: `cd backend && npm run openapi:export` (precisa do MySQL).
- Os tipos do frontend são gerados com `cd frontend && npm run api:types`; `npm run api:types:check` falha se estiverem desatualizados.
- O CI regenera o documento e falha se `docs/openapi.json` ou `src/lib/openapi.d.ts` divergirem do código.

As respostas de serviço ainda não têm schema (retornam objetos do Prisma); o contrato cobre rotas, parâmetros, corpos de entrada e os DTOs.
