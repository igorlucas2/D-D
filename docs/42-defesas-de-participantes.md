# Defesas de participantes — Fase T

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Permitir resistência, imunidade e vulnerabilidade em **monstros/participantes
sem ficha**, usando um JSON no `CombatParticipant`:

```json
[
  { "damageType": "fire", "type": "RESISTANCE" },
  { "damageType": "poison", "type": "IMMUNITY" }
]
```

Antes, apenas `CharacterResistance` era consultada; monstros não tinham como
resistir.

## 2. Dados/API

Campo:

```prisma
damageDefenses String? @db.LongText
```

Migração `20261028035643_participant_defenses`.

`AddParticipantDto` e `UpdateParticipantDto` aceitam:

```ts
damageDefenses?: Array<{
  damageType: string;
  type: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY';
}>
```

O mestre pode criar/editar via:

- `POST /campaigns/:id/combat/participants`
- `PATCH /campaigns/:id/combat/participants/:participantId`

## 3. Resolução

`CombatService.resolveDamageDefense` combina:

1. defesas JSON do participante;
2. `CharacterResistance` do personagem vinculado, se existir.

Assim, um participante com ficha usa as duas fontes; um monstro puro usa o JSON.

Regras continuam:

- resistência → metade;
- imunidade → zero;
- vulnerabilidade → dobro;
- resistência + vulnerabilidade → normal.

## 4. UI

O painel de combate, no modo mestre, ganhou:

- badges de defesas por participante;
- remoção de defesa;
- campo “Defesa (ex: fogo)”;
- seletor resistência/imunidade/vulnerabilidade;
- botão **Adicionar defesa**.

## 5. Teste real

- Participante `Elemental` criado com:
  - `damageDefenses = [{damageType:"fire",type:"RESISTANCE"}]`.
- Dano manual **11 fire**:
  - `applied = 5`;
  - PV **30 → 25**;
  - `defense.type = RESISTANCE`.
- Encontro e ação removidos.

## 6. Limites

- Defesas de participantes não são importadas automaticamente do SRD; são
  informadas pelo mestre.
- Não há validação semântica de tipos de dano além de texto livre; tipos
  português/inglês são normalizados no cálculo.
- A UI de combate só permite adicionar/remover; não edita em massa.
- A ficha (`CharacterResistance`) continua sem editor dedicado.

## 7. Testes

- Parser de defesas JSON válidas/inválidas;
- smoke real acima;
- **211 testes / 39 suítes**;
- OpenAPI: **117 rotas** (sem rota nova).
