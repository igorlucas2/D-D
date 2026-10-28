# Heroísmo — Fase R

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Adicionar um buff de concentração com **PV temporários**:

- **Heroísmo**, nível 1;
- alvo único participante;
- concede `mod. de conjuração` em **PV temporários**;
- condição `Heroico`;
- concentração de **1 minuto**;
- não gasta ação bônus nem reação.

## 2. Regras

Fallback:

```ts
kind: 'BUFF'
targets: 'SINGLE'
tempHp: 'SPELLCASTING_MOD'
concentration: {
  condition: 'Heroico',
  bonusFormula: '0',
  durationMinutes: 1
}
```

- exige participante vinculado a personagem;
- consome espaço nível 1 e ação;
- calcula `max(1, mod. de conjuração)`;
- aplica PV temporários imediatamente;
- grava `Heroico` e a concentração;
- encerrar concentração remove `Heroico`, mas **não** retira os PV temporários
  já concedidos;
- PV temporários absorvem dano antes do PV normal.

## 3. UI

- Diálogo mostra `Heroísmo` como bênção de concentração e o bônus de PV temp.
- HUD mostra `Heroico` e os PV temporários.
- Cartão mostra `Heroico · +N PV temp · 1 min`.
- Concentração aparece no HUD e pode ser encerrada.
- Heroísmo não gera narração automática (aplica condição/PV temp).

## 4. Teste real

- Heroísmo no elfo:
  - **200**;
  - `effectKind = BUFF`, `actionType = ACTION`;
  - espaço nível 1 `0 → 1`;
  - PV temporários **2**;
  - condição `Heroico`;
  - concentração ativa por 1 min.
- DB:
  - participante `tempHp = 2`, `conditions = ["Heroico"]`;
  - personagem `tempHp = 2` e JSON de concentração.
- Encerrar concentração:
  - **200**;
  - condição removida;
  - concentração `null`;
  - PV temporários **permanecem 2**.
- Encontro, ações, espaço, HP e temp restaurados.

## 5. Limites

- PV temporários de magias não se acumulam; aplicam-se pela regra normal de
  `applyTempHp`.
- A imunidade a medo do Heroísmo não é aplicada; apenas a condição e os PV temp.
- Encerrar concentração não remove PV temp já concedidos.
- Duração de 1 minuto em tempo real; expiração na próxima leitura.
- Heroísmo não gera narração automática.

## 6. Testes

- Fallback de Heroísmo com `tempHp` e concentração;
- smoke real acima;
- **205 testes / 38 suítes**;
- OpenAPI: **117 rotas** (sem rota nova).
