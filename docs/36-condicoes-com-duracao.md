# Condições com duração — Fase N

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Permitir condições temporárias em rodadas, com expiração automática:

- o mestre adiciona uma condição com duração;
- o HUD mostra a contagem;
- no início do turno do participante afetado, a contagem diminui;
- ao chegar a zero, a condição é removida.

## 2. Dados

`CombatParticipant` ganha:

```prisma
timedConditions String? @db.LongText
```

JSON:

```json
[{ "name": "Atordoado", "remainingRounds": 2, "source": "Teste" }]
```

Migração `20261028012422_condition_durations`.

As condições continuam também em `conditions` (lista de strings), mantendo
compatibilidade com o HUD, IA e ações existentes.

## 3. Regras

- `durationRounds` opcional em `POST /combat/actions`, apenas para `CONDITION`
  com `conditionMode = ADD`.
- O valor fica entre 1 e 50; sem duração, a condição é permanente até remoção.
- Adicionar a mesma condição com duração substitui o timer existente.
- Remover a condição remove o timer.
- No início do turno do participante afetado:
  - cada timer diminui 1;
  - timers em 0 saem de `timedConditions`;
  - o nome correspondente sai de `conditions`.
- Condições de concentração (`Marcado`, `Abençoado`) não usam timer; são
  controladas pela concentração.

## 4. UI

- Diálogo de condição ganhou **Duração em rodadas (0 = sem prazo)**.
- HUD mostra `Atordoado · 2r` quando há timer.
- Cartão da ação mostra as rodadas restantes.
- Nenhuma rota nova.

## 5. Teste real

Com elfo (iniciativa 20) e Goblin (10):

- Condição `Atordoado`, duração 2:
  - **200**;
  - `remainingRounds = 2`;
  - DB: `conditions=["Atordoado"]`, timer 2.
- Um turno do elfo depois: timer **1**.
- Segundo turno do elfo depois: `conditions = null`, `timedConditions = null`.
- Encontro e ações de teste removidos.

## 6. Limites

- A contagem começa no valor informado e é decrementada no início do turno do
  alvo; uma condição de 1 rodada aplicada no turno atual expira no próximo
  início de turno.
- Não há duração em minutos/horas nem duração por tipo de condição.
- Condições aplicadas por magias de concentração seguem a concentração, não
  este timer.
- Descanso longo não limpa condições genéricas com timer (a condição
  permanece até remoção/expiração).

## 7. Testes

- Parser de timers válidos/inválidos;
- adicionar/substituir/remover por nome sem acento;
- decremento e expiração;
- smoke real acima;
- **200 testes / 38 suítes**;
- OpenAPI: **117 rotas**.
