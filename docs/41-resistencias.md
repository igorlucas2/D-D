# Resistência, imunidade e vulnerabilidade — Fase S

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Aplicar `CharacterResistance` ao dano do motor:

- **resistência** → metade (arredondada para baixo);
- **imunidade** → zero;
- **vulnerabilidade** → dobro;
- resistência + vulnerabilidade do mesmo tipo se anulam;
- tipos em português/inglês são normalizados (`fogo` ↔ `fire`).

Antes, o modelo existia, mas nenhum cálculo de dano o consultava.

## 2. Onde foi aplicado

- Dano manual (`POST /combat/actions`, `kind = DAMAGE`);
- ataque com arma (`WEAPON_ATTACK`);
- magia de dano (`CAST_SPELL`);
- item de dano (`USE_ITEM`).

Cada resultado carrega:

```ts
defense: {
  type: "RESISTANCE" | "IMMUNITY" | "VULNERABILITY" | null;
  original: number;
  adjusted: number;
  multiplier: number;
} | null
```

- `original`: dano antes da defesa;
- `adjusted`: dano depois;
- `multiplier`: 0, 0.5, 1 ou 2.

A defesa é aplicada **após** save/crítico e **antes** de PV temporário/PV.

## 3. Regras

- Resistência: `floor(dano / 2)`.
- Imunidade: `0`.
- Vulnerabilidade: `dano × 2`.
- Resistência + vulnerabilidade: dano normal.
- Sem entrada para o tipo: dano normal.
- `damageType` ausente/nulo: sem defesa.
- A defesa é do personagem-alvo; participantes sem personagem não têm
  resistências.

## 4. UI

- Cartões mostram `resistiu (metade)`, `imune` ou `vulnerável (dobro)`.
- O dano exibido é o **aplicado** após a defesa.

## 5. Teste real

- Resistência a **fogo** no elfo.
- Dano manual de **11 fire**:
  - `original = 11`;
  - `adjusted = 5`;
  - `applied = 5`;
  - PV **6 → 1**;
  - `defense.type = RESISTANCE`.
- Resistência removida e HP restaurado.
- Encontro e ação de teste removidos.

## 6. Limites

- Defesas de **monstros/participantes sem personagem** ainda não têm modelo.
- A resistência é consultada por `damageType`; dano sem tipo não é reduzido.
- Não há UI de ficha para editar resistências nesta fase; usa o modelo
  existente (`CharacterResistance`).
- A narração automática ainda não menciona “resistiu”; o dado está no resultado.
- Imunidade não é “dano zero absoluto” para efeitos não-dano.

## 7. Testes

- Unidade: metade, zero, dobro, resistência + vulnerabilidade e sem defesa;
- smoke real acima;
- **210 testes / 39 suítes**;
- OpenAPI: **117 rotas** (sem rota nova).
