# Combate tático no modo imersivo — fatia 1

Status: **HUD de iniciativa e atores de combate no mapa**.
Última atualização: 28/10/2026.

## 1. Combate sobre o mundo

Quando existe `CombatEncounter`:

- o viewer recebe `setLocked(true)`;
- o movimento livre é bloqueado;
- a HUD de combate aparece à esquerda;
- participantes viram sprites 3D:
  - personagem com token no mapa usa a posição do token;
  - inimigos/NPCs sem token usam uma posição de formação próxima;
  - o participante do turno atual fica maior (`2.5` contra `2.0`);
- o avatar local continua representando o próprio jogador e não é duplicado.

## 2. HUD

Mostra:

- nome do encontro;
- rodada;
- turno atual;
- ordem de iniciativa;
- PV atual/máximo (quando o servidor permite);
- aliado/inimigo;
- botão **Próximo turno** para o mestre.

O botão chama:

```http
POST /api/campaigns/:id/combat/next-turn
```

e atualiza a HUD com o encontro retornado.

## 3. Integração com o painel existente

A aba **Combate** continua com o painel completo:

- iniciar/encerrar encontro;
- adicionar/remover participantes;
- ataques;
- magias;
- itens;
- condições;
- morte/estabilização.

A HUD 3D é uma camada de leitura e avanço de turno; o motor de regras
continua sendo o backend.

## 4. Validação

Teste com encontro `Teste 3D`:

- rodada 1, turno do Guarda;
- Poring como inimigo;
- sprites visíveis no mapa;
- **Próximo turno** mudou para Poring;
- encontro e tokens de teste removidos depois.

Screenshot: `frontend/test-results/immersive-combat-hud2.png`.

## 5. Limites

- ainda não há movimento tático célula a célula no 3D;
- ataque/magia continuam no painel lateral;
- inimigos sem token não têm posição persistida;
- a iniciativa não bloqueia o clique no mapa por personagem, apenas o lock
  global do encontro;
- o sprite do participante usa o token/NPC atual, não o build visual completo.

## 6. Próxima fase

- posições de combate persistidas por participante;
- movimento com orçamento de deslocamento;
- alcance visual e seleção de alvo no mapa;
- ataque e magia disparando o mesmo motor de ações;
- IA de inimigos.
