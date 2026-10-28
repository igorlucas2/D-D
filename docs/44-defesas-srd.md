# Defesas SRD de monstros — Fase V

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Importar as defesas de dano do SRD para `Monster` e levá-las automaticamente ao
criar o participante no combate:

- resistências;
- imunidades;
- vulnerabilidades.

## 2. Dados

`Monster` ganha:

```prisma
damageDefenses String? @db.LongText
```

Formato:

```json
[
  { "damageType": "acid", "type": "IMMUNITY" },
  { "damageType": "fire", "type": "RESISTANCE" }
]
```

Migração `20261028043031_monster_damage_defenses`.

## 3. Importação

`mapMonster` lê:

- `damage_resistances`;
- `damage_immunities`;
- `damage_vulnerabilities`;

e grava o JSON. O sincronizador SRD usa o mapper sem alteração adicional.

Também foi feito um backfill local dos **334** monstros já sincronizados.
Exemplo: `Dragão Negro Adulto` → `acid: IMMUNITY`.

## 4. Combate

O painel de combate, ao adicionar um monstro do catálogo, envia
`damageDefenses` no `POST /combat/participants`.

O motor então aplica as defesas no cálculo de dano exatamente como nas fases
anteriores.

## 5. Teste real

- `Dragão Negro Adulto` importado com `acid: IMMUNITY`.
- Participante criado com essa defesa.
- Dano manual **11 acid**:
  - `applied = 0`;
  - PV **195 → 195**;
  - `defense.type = IMMUNITY`.
- Encontro e ação removidos.

## 6. Limites

- Só defesas de **dano** são importadas; imunidades a condições não.
- O backfill foi executado localmente; um banco novo só recebe após sync SRD.
- A UI não mostra as defesas do catálogo antes de adicionar, apenas no
  participante.
- Texto de tipos do SRD é mantido em inglês; o motor normaliza.

## 7. Testes

- Teste unitário de `mapMonster` com resistência, imunidade e vulnerabilidade;
- smoke real do dragão imune a ácido;
- **212 testes / 40 suítes**;
- OpenAPI: **118 rotas**.
