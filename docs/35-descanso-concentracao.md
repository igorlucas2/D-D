# Descanso e concentração — Fase M

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Fechar a integração entre descanso e os novos estados de magia:

- descanso longo restaura HP/espaços (comportamento existente);
- descanso longo **encerra a concentração**;
- remove `Marcado`/`Abençoado` dos alvos;
- descanso curto continua sem recuperar HP/espaços e sem encerrar concentração;
- descanso em combate continua bloqueado pelo fluxo de ações do mundo.

## 2. Onde foi ligado

### Descanso coletivo

`GameActionsService` já aplica `REST` no fluxo de comandos do mundo e restaura
HP/espaços no descanso longo. Agora, para cada personagem do grupo:

```ts
await this.combat.clearConcentration(tx, characterId);
```

Isso limpa o JSON de concentração e remove a condição correspondente dos
participantes-alvo.

`GameActionsModule` importa `CombatModule` para injetar `CombatService`.

### Descanso individual

`CharactersService.longRest` (personagem sem campanha) agora também grava
`concentration: null`.

### Descanso curto

Não encerra concentração e não restaura HP/espaços; permanece como antes.

## 3. Regras

- Descanso longo só ocorre fora de combate, com todos os personagens acima de
  0 PV (validação existente).
- A concentração encerra **depois** da restauração de HP/espaços, na mesma
  transação.
- Condições de concentração (`Marcado`, `Abençoado`) são removidas.
- Outras condições não são alteradas por esta fase.
- A duração da concentração continua em tempo real; o descanso longo é a saída
  explícita.

## 4. UI

Nenhum botão novo. O fluxo de **Comandos da campanha → descanso longo** já
existe; ao concluir, o HUD deixa de mostrar a concentração e a condição some.

## 5. Limites

- Descanso curto não limpa concentração.
- Não há recuperação de condições genéricas de combate nesta fase.
- O descanso continua proibido em combate e com personagem a 0 PV.
- A integração não altera o relógio, a cena ou o evento de crônica além do que
  o descanso já fazia.

## 6. Testes

- `CombatService.clearConcentration` já coberto pelo smoke de Marca/Abençoar:
  concentração `null`, condição removida.
- `tsc`, lint, build e a suíte completa passam;
- **196 testes / 37 suítes**;
- OpenAPI permanece com **117 rotas** (sem rota nova).

> O descanso coletivo não foi executado na campanha viva para não avançar o
> relógio nem criar evento de crônica de teste; a chamada adicionada é a mesma
> `clearConcentration` já exercitada pelos endpoints de concentração.
