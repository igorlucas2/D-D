# Escudo da Fé e ação bônus — Fase P

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Implementar a primeira magia de **ação bônus**:

- **Escudo da Fé**, nível 1;
- alvo único participante;
- **+2 CA**;
- concentração de **10 minutos**;
- consome **ação bônus**, não a ação principal.

## 2. Regras

Fallback:

```ts
kind: 'BUFF'
targets: 'SINGLE'
action: 'BONUS'
concentration: {
  condition: 'Protegido',
  bonusFormula: '+2',
  durationMinutes: 10
}
```

- exige um participante;
- consome espaço nível 1;
- grava a concentração com a condição `Protegido`;
- ataque contra o alvo calcula `CA = CA base + 2`;
- encerrar/quebrar a concentração remove `Protegido` e o bônus de CA;
- não gasta a ação principal.

## 3. Economia de ações

`CombatService.assertCanAct` agora aceita `ACTION` ou `BONUS`:

- ação normal verifica `actionUsed`;
- ação bônus verifica `bonusUsed`;
- `consumeAction`/`consumeBonus` marcam o recurso correto;
- o início do próximo turno reseta ação, bônus e reação.

Assim, o personagem pode:

1. conjurar Escudo da Fé como ação bônus;
2. ainda atacar/usar item/conjurar com a ação principal;
3. encerrar o turno normalmente.

## 4. UI

- Diálogo de magia mostra **ação bônus**.
- HUD mostra se a ação/bônus estão disponíveis ou usados.
- **Conjurar** fica disponível também quando resta apenas a ação bônus.
- HUD de concentração mostra `Escudo da Fé em ...`.
- Cartão mostra `Protegido · +2 CA · 10 min`.
- Atacar/usar item continuam dependentes da ação principal.

## 5. Teste real

- Escudo da Fé no elfo:
  - **200**;
  - `effectKind = BUFF`, `actionType = BONUS`;
  - espaço nível 1 `0 → 1`;
  - condição `Protegido`;
  - `actionUsed = false`, `bonusUsed = true`.
- Ataque com Punhal no elfo:
  - **200**;
  - **CA 12** (10 + 2);
  - acertou.
- Segunda magia bônus no mesmo turno:
  - **409**, “Sua ação bônus já foi usada neste turno.”
- Encerrar concentração:
  - **200**;
  - condição `Protegido` removida.
- Encontro, ações, espaço e HP restaurados.

## 6. Limites

- O bônus de CA só é aplicado pelo motor em ataques de arma/magia que calculam CA; não altera a ficha permanentemente.
- Medidor de CA na ficha não muda; a CA efetiva do ataque inclui o bônus.
- Sem bônus de CA em efeitos que não consultam `conditionAcBonus`.
- Concentração dura 10 minutos reais; expira na próxima leitura.
- Escudo da Fé não gera narração automática (aplica condição).

## 7. Testes

- Fallback de Escudo da Fé com ação bônus, condição e CA;
- smoke real acima;
- **203 testes / 38 suítes**;
- OpenAPI: **117 rotas** (sem rota nova).
