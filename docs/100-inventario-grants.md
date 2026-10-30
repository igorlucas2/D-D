# Inventário Ragnarok e grants do mestre

Status: **itens com quantidade, zeny e entrega pelo painel**.
Data: 30/10/2026.

## 1. Modelo

`RagnarokCharacterItem` ganhou:

```text
quantity Int @default(1)
```

Migration: `20261030050000_ragnarok_item_quantity`.

O item continua único por `characterId + itemId`; quantidades acumulam.

## 2. API

```http
POST /api/campaigns/:id/ragnarok-characters/:characterId/item
{ "itemId": 501, "quantity": 5 }

POST /api/campaigns/:id/ragnarok-characters/:characterId/zeny
{ "amount": 1000 }
```

Regras:

- somente mestre;
- ficha vinculada à campanha;
- item do catálogo Ragnarok;
- quantidade 1–999;
- zeny 1–1.000.000.000;
- item repetido incrementa a quantidade;
- slot vem do `viewKind`/`equipSlots` do item.

## 3. UI

Painel do mestre:

- busca de item no catálogo;
- seletor;
- quantidade;
- **Entregar item**;
- campo de zeny;
- **Entregar zeny**.

Ficha:

- inventário Ragnarok lista itens, slot, equipado e quantidade;
- cabeçalho mostra zeny atualizado.

## 4. Teste

Ficha `Item Test`:

- Poção Vermelha ×5;
- segundo grant ×2 → **×7**;
- zeny 1000;
- ficha removida.

## 5. Limites

- não há loja/Kafra ainda;
- item não pode ser usado/consumido pela UI ainda;
- equipamento não altera sprite;
- quantidade não separa equipado de inventário;
- sem peso;
- sem compra/venda.

## 6. Próximo

1. usar/consumir item;
2. equipar/desequipar com quantidade;
3. loja NPC;
4. Kafra;
5. peso/inventário completo.
