# Equipamento Ragnarok na ficha

Status: **inventário/equipamento próprio, sem bônus mecânicos**.
Última atualização: 28/10/2026.

## 1. Modelo

`RagnarokCharacterItem`:

- `characterId`;
- `itemId` do catálogo `RagnarokItem`;
- `slot` (viewKind/equipSlots ou `Geral`);
- `equipped`;
- único por personagem + item.

Migration: `20261028142000_ragnarok_equipment`.

## 2. API

- `POST /api/ragnarok/characters/:id/items`
- `PATCH /api/ragnarok/characters/:id/items/:entryId`
- `DELETE /api/ragnarok/characters/:id/items/:entryId`

Regras:

- ficha pertence ao usuário;
- item existe;
- equipar um item desequipa os demais do mesmo slot;
- ficha retornada já com `equipment.item`.

## 3. UI

- painel **Equipar item**:
  - escolher ficha;
  - buscar no catálogo (14.397 itens);
  - escolher e equipar;
- card da ficha:
  - badge equipado/não equipado;
  - clique alterna equipado;
  - × remove.

Teste:

- ficha `Equip Teste`;
- item `Espada` (#1101);
- POST retornou 201 com `slot: Geral`, `equipped: true`;
- UI exibiu o item;
- ficha/item removidos.

Screenshot: `frontend/test-results/ragnarok-equipment.png`.

## 4. Limites

- não aplica ATQ/defesa/stats;
- `slot` cai em `Geral` quando o item não informa `viewKind`/`equipSlots`;
- sem refino/cartas;
- sem requisito de nível/classe;
- não altera o visual 3D ainda.

## 5. Próxima fase

- bônus mecânicos por item;
- slots oficiais;
- requisitos;
- visual equipado no avatar;
- cartas/refino.
