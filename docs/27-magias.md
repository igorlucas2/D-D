# Magias — Fase C

Status: **implementada** para cura e dano com save.
Última atualização: 27/10/2026.

## 1. Objetivo

Conjurar uma magia conhecida pelo personagem, gastar o espaço correto e
resolver cura/dano no servidor, com alvo único ou múltiplos alvos.

Cobertura inicial:

- **Curar Ferimentos** (`1d8 + modificador de conjuração`, cura);
- **Bola de Fogo** (`8d6` de fogo, save de Destreza, metade no sucesso,
  múltiplos alvos);
- upcast por nível de espaço acima do nível da magia;
- truques não gastam espaço.

O catálogo atual não tinha mecânica estruturada; a Fase C adiciona
`Spell.mechanics` e usa fallback por nome para as magias já existentes.

## 2. API

### `POST /campaigns/:campaignId/combat/spells/cast`

```ts
interface CastSpellInput {
  requestKey: string;
  expectedRevision?: number;
  characterSpellId: string;
  slotLevel?: number;
  targets: Array<{ kind: "CHARACTER" | "PARTICIPANT"; id: string }>;
}
```

Resposta:

```ts
interface SpellCastResult {
  actionId: string;
  kind: "CAST_SPELL";
  spell: {
    characterSpellId: string;
    spellId: string;
    name: string;
    level: number;
    school: string;
    castLevel: number;
  };
  slot: { level: number; usedBefore: number; usedAfter: number } | null;
  targets: Array<{
    kind: "CHARACTER" | "PARTICIPANT";
    id: string;
    name: string;
    characterId: string | null;
    hpBefore: HpSnapshot | null;
    hpAfter: HpSnapshot | null;
    save: {
      ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
      roll: number;
      modifier: number;
      total: number;
      dc: number;
      success: boolean;
    } | null;
    amount: number;
    applied: number;
    absorbedByTempHp: number;
  }>;
  damageType: string | null;
  source: string;
  alreadyApplied: boolean;
  createdAt: string;
}
```

## 3. Regras

- O personagem precisa ser dono da magia e estar vinculado à campanha.
- Magia de nível 1+ exige espaço disponível de nível ≥ nível da magia;
  o espaço escolhido é consumido uma única vez.
- Truque (nível 0) não consome espaço.
- A fórmula é rolada no servidor.
- Cura: `dado + modificador de conjuração` quando a mecânica pede, limitada ao
  PV máximo.
- Dano: rolagem única para todos os alvos; cada alvo faz save quando a magia
  pede. Sucesso com `halfOnSuccess` aplica metade (arredondada para baixo);
  sucesso sem half aplica 0.
- O modificador de save usa o atributo do alvo; proficiência de save ainda não
  é modelada.
- Dano respeita PV temporário e não deixa PV negativo.
- Ficha e participante são atualizados na mesma transação.
- `expectedRevision` divergente devolve **409**.
- `requestKey` repetido devolve o resultado original sem gastar outro espaço.
- `CombatAction.kind = CAST_SPELL` registra o uso no ledger.
- HP de inimigo com `DESCRIPTIVE` não é devolvido a jogadores; o dano e o save
  continuam visíveis.

## 4. UI

- Botão **Conjurar** no HUD, com quantidade de magias e slots.
- Diálogo lista magias conhecidas, nível, escola, fórmula, save e modo de alvo.
- Seleção de espaço, incluindo upcast.
- Alvo único para cura; múltiplos checkboxes para dano em área.
- Resultado na crônica: magia, espaço, dano/cura por alvo, save e PV.
- Slot no HUD é atualizado depois da conjuração.

## 5. Dados

- `Spell.mechanics` (`LongText` JSON): `kind`, `formula`, `damageType`,
  `save`, `upcast`, `targets`, `addSpellcastingModifier`.
- Fallback por nome para `Curar Ferimentos`, `Curar Feridas` e `Bola de Fogo`.
- Migração `20261027121327_spell_mechanics`.
- `CharacterSpell`/`CharacterSpellSlot` existentes são a fonte de magias e
  espaços.

## 6. Limites desta fase

- Alcance, área geométrica, cobertura e linha de visão não são validados.
- Ataques mágicos (d20 vs CA), cantrips de dano e magias de utilidade ainda não
  têm mecânica.
- Concentração, duração e quebra por dano ainda não são aplicadas.
- Resistência/imunidade/vulnerabilidade do alvo ainda não entram no cálculo.
- Proficiência de save não é modelada.

## 7. Testes

Unitários: fallback de Curar Ferimentos/Bola de Fogo, prioridade de
`mechanics`, magia sem mecânica, modificador/DC e HUD.

Smoke com banco:

- Curar Ferimentos em 2/6 PV: slot 1 consumido, cura aplicada;
- replay sem novo consumo;
- Bola de Fogo no espaço 3: save DEX, metade no sucesso, dano aplicado,
  slot 3 consumido;
- HP, slots e ledger restaurados após o teste.
