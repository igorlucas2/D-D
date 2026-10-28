# Magia no combate imersivo

Status: **Conjurar conectado ao motor**.
Última atualização: 28/10/2026.

## 1. HUD

No turno do personagem, quando a ficha tem magias:

```text
Conjurar
```

Abre o `SpellDialog` existente:

- lista magias preparadas;
- escolhe espaço;
- escolhe alvo(s) entre participantes;
- modo único/múltiplo conforme a magia.

### Envio

```http
POST /api/campaigns/:id/combat/spells/cast
{
  "requestKey": "<uuid>",
  "expectedRevision": 3,
  "characterSpellId": "...",
  "slotLevel": 1,
  "targets": [{ "kind": "PARTICIPANT", "id": "..." }]
}
```

O servidor valida ação, espaço, alvo, save/ataque, dano/cura e concentração.

## 2. Fonte dos dados

A HUD agora usa o `HudCharacter` de
`GET /campaigns/:id/ai-master/state`, que já traz:

- `items` com `effectKind`;
- `spells` com mecânica;
- `spellSlots` usados/totais;
- concentração e condições.

Antes a página montava um `HudCharacter` mínimo, sem magias.

## 3. Limites

- o resultado da magia ainda não tem cartão dedicado na HUD; entra no Registro
  se gerar `CombatAction`;
- magia exige ficha vinculada e espaço disponível;
- alcance/linha de visão não são checados no grid 3D;
- sem animação de conjuração.

## 4. Próxima fase

- cartão de resultado de magia;
- seleção de alvo por clique no sprite;
- alcance/área no terreno;
- concentração na HUD;
- animação de magia.
