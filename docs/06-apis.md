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
| POST | /ai-master/generate | `{ type: 'npc'|'city'|'tavern'|'quest'|'monster'|'treasure'|'encounter', prompt }` |

## SRD 5e Integration
| Método | Rota | Descrição |
|---|---|---|
| POST | /catalog/srd/sync | Sincroniza endpoints da API `https://www.dnd5eapi.co/api` para cache local |
| GET | /catalog/srd/endpoints | Lista endpoints SRD importados e contagem local |
| GET | /catalog/srd/resources | Lista paginada: `endpoint`, `search`, `take` (1..100, padrão 50) e `cursor`; devolve `{ items, nextCursor }` |
| GET | /catalog/srd/resources/:endpoint/:index | Retorna recurso SRD detalhado com JSON original |
