# Ataques com arma — Fase F

Status: **implementada**.
Última atualização: 27/10/2026.

## 1. Objetivo

Permitir que um personagem ataque com uma arma do próprio inventário e o
servidor resolva rolagem de ataque, CA, dano e crítico.

## 2. Dados da arma

O catálogo já usa `Item.properties`:

```json
{
  "equipmentCategory": "weapon",
  "weaponRange": "Melee",
  "damage": "1d4",
  "damageType": "Perfuração",
  "properties": ["Acuidade", "Leve", "Arremessável", "Monge"]
}
```

O motor lê:

- fórmula de dano (`1d4`) ou dano fixo (`1`);
- tipo em português/inglês (`Corte`, `Perfuração`, `Concussão`, `Piercing`…);
- `Acuidade`, `Distância`, `Duas Mãos`, `Versátil`;
- categoria `Arma`.

## 3. API

### `POST /campaigns/:campaignId/combat/attacks`

```ts
interface WeaponAttackInput {
  requestKey: string;
  expectedRevision?: number;
  inventoryItemId: string;
  targetKind: "CHARACTER" | "PARTICIPANT";
  targetId: string;
}
```

A resposta inclui arma, alvo, ataque (d20 + modificador vs CA, acerto/crítico),
dano (fórmula, modificador, tipo), PV antes/depois, dano aplicado e absorvido.

## 4. Regras

- A arma precisa estar no inventário do personagem do usuário.
- Categoria `Arma` e dados de dano válidos; senão **400**.
- Ataque: `d20 + proficiência + modificador`.
- Modificador:
  - à distância: Destreza;
  - Acuidade: maior entre Força e Destreza;
  - corpo a corpo: Força.
- Natural 1 erra; natural 20 acerta e causa crítico.
- Crítico rola o dado de dano novamente; o modificador entra uma vez.
- Dano respeita PV temporário e não deixa PV negativo.
- CA de personagem vem da ficha; participante sem ficha usa CA 10.
- Ficha e participante são atualizados na mesma transação.
- `expectedRevision` divergente devolve **409**; `requestKey` é idempotente.
- Ledger `CombatAction` com `kind = WEAPON_ATTACK`.

## 5. UI

- Botão **Atacar** no HUD quando há arma no inventário.
- Diálogo escolhe arma e alvo, mostra dano/tipo.
- Resultado na crônica mostra acerto/erro/crítico, CA, dano e PV.
- Botão de narração automática fica restrito a itens/magias nesta fase; ataques
  com arma permanecem cartões mecânicos.

## 6. Limites

- Munição/recarga não é consumida.
- Alcance, cobertura, desvantagem e proficiência de arma não são modelados.
- Ação/economia de turno ainda não é aplicada.
- Não há ataque desarmado nem duas mãos/versátil completo.
- O resultado do ataque pode ser narrado pelo mestre (Fase J).
- Alvo com `Marcado` recebe `+1d6` do conjurador (Fase K).
- Atacante com `Abençoado` recebe `+1d4` no ataque (Fase L).

## 7. Testes

- Punhal: Acuidade, `1d4`, perfurante, escolha de Destreza;
- dano fixo/arco e mapeamento de tipos em português;
- item sem dano é rejeitado;
- smoke real: ataque 12 vs CA 1, dano 4, PV 6→2, restaurado;
- replay de `requestKey` sem duplicar;
- UI: botão Atacar, diálogo com Punhal e alvo.
