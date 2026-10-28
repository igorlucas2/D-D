# Usar item no combate imersivo

Status: **consumíveis do inventário na HUD 3D**.
Última atualização: 28/10/2026.

## 1. Detecção

A HUD deriva o efeito de `Item.properties`:

- `healing` → HEAL;
- `temporaryHp` / `tempHp` → TEMP_HP;
- `damage` / `damageFormula` → DAMAGE.

Isso preenche `HudItem.effectKind`, usado pelo diálogo existente.

## 2. Fluxo

No turno do personagem:

- botão **Atacar**;
- botão **Usar item** quando há consumível utilizável.

O diálogo lista os itens com efeito e envia:

```http
POST /api/campaigns/:id/combat/items/use
{
  "requestKey": "<uuid>",
  "inventoryItemId": "...",
  "characterId": "..."
}
```

O servidor consome, rola o efeito e aplica. O registro aparece no histórico de
`CombatAction` (se registrado pelo motor de itens).

## 3. Limites

- item precisa estar na ficha do jogador;
- ficha precisa estar vinculada à campanha para o motor aceitar;
- sem seleção de alvo para item de dano (usa o próprio personagem no DTO);
- sem item de equipamento;
- UI de item ainda não mostra o resultado detalhado na HUD.

## 4. Próxima fase

- item de dano com alvo;
- resultado de item na HUD;
- magia no mesmo fluxo;
- animação de consumo.
