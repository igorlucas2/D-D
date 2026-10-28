# Resultado de ataque na HUD imersiva

Status: **rolagem, CA, dano e alvo visíveis**.
Última atualização: 28/10/2026.

## 1. Resultado

`submitAttack` agora guarda o retorno de:

```http
POST /api/campaigns/:id/combat/attacks
```

e mostra na HUD de combate:

```text
Acertou Poring · crítico
d20 17 + 5 = 22 vs CA 14
Espada Longa · 8 slashing
```

Quando erra:

```text
Errou Poring
d20 3 + 5 = 8 vs CA 14
```

## 2. Fonte

- `attack.roll`, `attack.modifier`, `attack.total`, `attack.ac`;
- `attack.hit`, `attack.critical`;
- `weapon.name`;
- `applied` e `damage.damageType`;
- `target.name`.

O motor continua calculando tudo; a HUD só apresenta.

## 3. Limites

- mostra a **última** ação, não um log completo;
- ataque só aparece quando a ficha está vinculada e é o turno;
- magia/item ainda não têm resultado próprio na HUD;
- o painel de combate lateral continua sendo a visão completa.

## 4. Próxima fase

- histórico curto de ações;
- resultado de magia/item;
- animação de dano no sprite;
- IA dos inimigos.
