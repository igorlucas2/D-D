# Escudo Arcano e reação — Fase Q

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Implementar a primeira **reação** de combate:

- **Escudo Arcano**, nível 1;
- alvo único participante;
- **+5 CA** por **1 rodada**;
- consome **reação**, não ação/bônus;
- sem concentração.

## 2. Regras

Fallback:

```ts
kind: 'BUFF'
targets: 'SINGLE'
action: 'REACTION'
ward: {
  condition: 'Escudado',
  acBonus: 5,
  rounds: 1
}
```

- exige participante;
- consome espaço nível 1;
- adiciona `Escudado` e um timer de 1 rodada;
- ataque contra o alvo calcula `CA base + 5`;
- o timer expira no início do próximo turno do alvo;
- não cria concentração;
- não gasta ação nem bônus.

## 3. Economia de reação

`CombatService.assertCanAct` aceita:

- `ACTION`: verifica `actionUsed`;
- `BONUS`: verifica `bonusUsed`;
- `REACTION`: verifica `reactionUsed`.

`consumeReaction` marca a reação. O início do turno reseta ação, bônus e
reação.

Agora o turno suporta:

1. reação (Escudo Arcano);
2. ação bônus (Escudo da Fé);
3. ação principal (ataque/magia/item).

## 4. UI

- Diálogo de magia mostra **reação**.
- HUD mostra ação, bônus e reação disponíveis/usados.
- **Conjurar** fica disponível quando resta qualquer um dos três.
- CA efetiva exibe +5 enquanto `Escudado`.
- HUD mostra `Escudado · 1r`.
- Cartão mostra `Escudado · +5 CA · 1 rodada`.
- Escudo Arcano não gera narração automática: aplica condição.

## 5. Teste real

- Escudo Arcano no elfo:
  - **200**;
  - `actionType = REACTION`;
  - espaço nível 1 `0 → 1`;
  - condição `Escudado`;
  - timer `1`;
  - `reactionUsed = true`, `actionUsed = false`.
- Ataque com Punhal no elfo:
  - **CA 15** (10 + 5);
  - total 15, acertou.
- Segunda reação no mesmo turno:
  - **409**, “Sua reação já foi usada neste turno.”
- Dois `end-turn` até voltar ao elfo:
  - timer expira;
  - `Escudado` removido;
  - `reactionUsed` resetado.
- Encontro, ações, espaço e HP restaurados.

## 6. Limites

- O bônus de CA é aplicado apenas em ataques que consultam `conditionAcBonus`.
- A ficha base não muda; o HUD mostra a CA efetiva.
- Escudo Arcano é usado proativamente como reação; não há gatilho automático
  “quando for atingido” nesta fase.
- Sem reação de ataque de oportunidade ou Contrafeitiço.
- Duração de 1 rodada via timer; expira no início do próximo turno.

## 7. Testes

- Fallback de Escudo Arcano com ação `REACTION` e ward `+5 CA / 1 rodada`;
- smoke real acima;
- **204 testes / 38 suítes**;
- OpenAPI: **117 rotas** (sem rota nova).
