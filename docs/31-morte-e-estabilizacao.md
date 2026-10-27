# Queda, estabilização e morte — Fase H

Status: **implementada**.
Última atualização: 27/10/2026.

## 1. Objetivo

Evitar que um personagem a 0 PV continue agindo e fornecer o ciclo básico de
salvaguarda contra morte:

- personagem a 0 PV fica **inconsciente** e não pode atacar/conjurar/usar item;
- personagem jogável rola **uma salvaguarda contra morte por turno**;
- três sucessos = **estável**; três falhas = **morto**; 20 natural = **volta com
  1 PV**;
- monstro/NPC a 0 PV morre;
- cura acima de 0 limpa os estados de morte;
- dano recebido já a 0 PV gera uma falha.

## 2. Dados

`CombatParticipant` ganha:

```prisma
deathSuccesses Int @default(0)
deathFailures  Int @default(0)
isStable       Boolean @default(false)
isDead         Boolean @default(false)
deathSaveUsed  Boolean @default(false)
```

Migrações `20261027142033_death_saves` e `20261027142250_death_save_once`.

Condições usadas: `Inconsciente`, `Estável`, `Morto`.

## 3. Regras

### Queda

- `reconcileVitals` é chamado depois de dano/cura em participante.
- PV 0 + ficha de jogador: adiciona `Inconsciente`; zera/limpa estabilidade.
- PV 0 + monstro/NPC sem personagem: `isDead = true`, condição `Morto`.
- Cura/revive com PV > 0: limpa `isDead`, `isStable`, contadores e condições de
  morte.
- Dano em quem já está a 0 e não está estável: +1 falha; ao chegar a 3, morre.

### Ação

`assertCanAct` bloqueia ataque, magia e item se o participante estiver morto ou
com PV 0. Ajustes manuais de PV continuam disponíveis.

### Salvaguarda contra morte

`POST /campaigns/:campaignId/combat/death-save`

```ts
{ requestKey: string }
```

- exige ser o participante atual (mestre pode rolar pelo atual);
- exige PV 0, não morto, não estável;
- uma rolagem por turno (`deathSaveUsed`);
- d20:
  - 20: revive com 1 PV;
  - 1: duas falhas;
  - 2–9: uma falha;
  - 10–19: um sucesso;
- 3 sucessos: `isStable = true`, condição `Estável`;
- 3 falhas: `isDead = true`, condição `Morto`;
- resultado entra no ledger `DEATH_SAVE` e no histórico.

O próximo turno reseta `deathSaveUsed`, ação, bônus e reação do participante
que começa.

## 4. UI

- HUD mostra:
  - **inconsciente · X sucessos / Y falhas**;
  - **estável**;
  - **morto**.
- Botão **Rolar morte** aparece no turno do personagem caído.
- Botão **Encerrar turno** continua disponível.
- Atacar/Conjurar/Usar item ficam desabilitados caído/morto.
- Cartão de resultado mostra d20, sucessos/falhas e desfecho.
- Ajustes manuais de dano/cura continuam no HUD e podem estabilizar/reviver uma
  ficha.

## 5. Limites

- A salvaguarda é manual; não rola automaticamente no início do turno.
- Não há morte instantânea por dano massivo.
- Cura recebida por outra pessoa depende de magia com alvo; o item atual é
  autoalvo.
- Condições de morte não têm duração própria; são limpas por cura/revive.
- O mestre pode rolar pelo participante atual, mas não há botão específico de
  override além do HUD.

## 6. Testes

Smoke com banco:

- dano 6 em elfo 6/6 → PV 0, condição `Inconsciente`, `isDead = false`;
- salvaguarda d20 = 12 → 1 sucesso, `PENDING`, `deathSaveUsed = true`;
- segunda salvaguarda no mesmo turno → **409**;
- encerrar turno → próximo participante;
- encontro removido e HP restaurado.

Unitários: 20 revive, 1 duas falhas, 2–9 falha, 10–19 sucesso, 3 sucessos
estabilizam, 3 falhas matam. **190 testes/36 suítes**.
