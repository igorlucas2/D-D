# Itens utilizáveis — Fase B

Status: **implementada** (consumíveis com efeito).
Última atualização: 27/10/2026.

## 1. Objetivo

Permitir que o jogador use um item do inventário e o servidor aplique o efeito,
consumindo a quantidade na mesma transação, sem o cliente calcular cura/dano.

Fase B cobre **consumíveis com um efeito primário**:

- cura (`properties.healing`);
- PV temporário (`properties.temporaryHp` ou `tempHp`);
- dano (`properties.damage`/`damageFormula` + `properties.damageType`).

O item é usado no próprio personagem. Cargas, equipar/atunir, alvo em aliados e
efeitos múltiplos ficam para a fase seguinte.

## 2. API

### `POST /campaigns/:campaignId/combat/items/use`

```ts
interface UseItemInput {
  requestKey: string;       // UUID, idempotente por ator
  inventoryItemId: string;
  characterId: string;      // precisa ser o dono do item
  expectedRevision?: number; // revisão do combate, se houver
}
```

Resposta:

```ts
interface ItemUseResult {
  actionId: string;
  kind: "USE_ITEM";
  effectKind: "HEAL" | "TEMP_HP" | "DAMAGE";
  target: { id: string; name: string; characterId: string };
  amount: number;
  breakdown: RollBreakdown | null;
  damageType: string;
  hpBefore: HpSnapshot;
  hpAfter: HpSnapshot;
  applied: number;
  absorbedByTempHp: number;
  item: {
    inventoryItemId: string;
    itemId: string;
    name: string;
    quantityBefore: number;
    quantityAfter: number;
  };
  source: string;
  alreadyApplied: boolean;
  createdAt: string;
}
```

## 3. Regras

- O item precisa pertencer ao personagem do usuário e estar vinculado à
  campanha.
- O efeito é lido de `Item.properties`; item sem efeito reconhecido devolve
  **400**.
- A fórmula é rolada no servidor; o cliente só exibe.
- Cura respeita o PV máximo; PV temporário não acumula; dano consome PV
  temporário antes do PV.
- A quantidade é decrementada (ou a entrada é removida em quantidade 0) na
  mesma transação da alteração de PV.
- `expectedRevision` divergente devolve **409**.
- `requestKey` repetido devolve o resultado original e **não consome** de novo.
- A ficha e o participante do combate são sincronizados.
- O uso entra no ledger `CombatAction` (`kind = USE_ITEM`) e no histórico.
- O evento `table:state` invalida a mesa; se houver combate, `table:combat`
  também recebe o HP.

## 4. UI

- Botão **Usar item** no HUD, com contagem de itens utilizáveis.
- Diálogo lista apenas itens com efeito reconhecido e quantidade > 0.
- Mostra nome, efeito, fórmula e quantidade; confirmação explícita.
- O resultado aparece na crônica como cartão com nome do item, cura/dano e
  quantidade restante.
- A lista vem do estado do mestre IA (`characters[].items`), que inclui
  `effectKind` calculado no servidor.

## 5. Dados

Sem migração nesta fase:

- `Item.properties` já traz `healing` para a Poção de Cura;
- `InventoryItem.quantity` é a fonte de consumo;
- `CombatAction` registra o uso e o resultado.

## 6. Limites e próxima fase

- Cargas (`charges`) e itens equipados/atunidos ainda não alteram o motor.
- Uso em outro personagem e efeitos múltiplos ainda não são suportados.
- Magias continuam sem automação; a Fase C usará o mesmo padrão de definição
  estruturada e resolução no servidor.

## 7. Testes

Unitários: leitura de `healing`, `temporaryHp` e `damage`, item sem efeito,
cura limitada ao máximo, dano com PV temporário e PV temporário sem acúmulo.
Smoke com banco: Poção de Cura em personagem com 2/6 PV, replay de `requestKey`
sem consumir de novo e restauração da quantidade.
