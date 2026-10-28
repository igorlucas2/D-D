# Movimento tático no combate 3D

Status: **posição persistida + orçamento de deslocamento**.
Última atualização: 28/10/2026.

## 1. Modelo

`CombatParticipant` ganhou:

| Campo | Uso |
| --- | --- |
| `x`, `y` | posição no grid do mapa |
| `speed` | deslocamento por turno, em pés (padrão 30) |
| `movementUsed` | pés gastos no turno atual |

Migration: `20261028130000_combat_positions`.

## 2. Endpoint

```http
PATCH /api/campaigns/:id/combat/participants/:participantId/move
{ "x": 14, "y": 9 }
```

Regras:

- mestre move qualquer participante;
- jogador só move o participante do **próprio turno**;
- distância usa Chebyshev (diagonal custa 1 célula);
- cada célula custa **5 pés**;
- não pode ultrapassar `speed - movementUsed`;
- participante morto não se move;
- primeiro movimento de quem ainda está sem coordenada é **colocação inicial
  gratuita**;
- retorna o encontro atualizado e emite a mudança.

## 3. Turno

`advanceTurn` zera `movementUsed` do próximo participante, junto com
ação/bônus/reação.

## 4. HUD

- mostra `usados / total` em pés;
- quatro setas para mover o participante atual;
- cada passo custa 5 pés;
- o sprite usa `participant.x/y` antes do token/fallback;
- o participante do turno continua maior;
- **Próximo turno** avança e reseta o movimento.

## 5. Validação

Teste com Guarda (30 pés) e Poring:

- colocação em `12,9`: 200, `movementUsed = 0`;
- passo para `13,9`: 200, `movementUsed = 5`;
- tentativa `20,9`: **400**, restavam 25 e custava 35;
- clique na seta direita: `14,9`, 10 pés usados;
- encontro de teste removido.

Screenshot: `frontend/test-results/immersive-combat-move.png`.

## 6. Limites

- o movimento é por setas na HUD, não por clique no terreno;
- o avatar local continua visível no lugar do participante próprio;
- não há caminho/colisão no movimento tático ainda;
- ataque/magia continuam no painel lateral.

## 7. Próxima fase

- clique no terreno para mover dentro do alcance;
- colisão e caminho no grid;
- seleção de alvo no mapa;
- ataque/magia usando o motor de ações.
