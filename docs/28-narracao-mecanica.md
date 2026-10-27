# Narração de resultados mecânicos — Fase E

Status: **implementada**.
Última atualização: 27/10/2026.

## 1. Objetivo

Fechar o ciclo entre o motor e a crônica: depois de **usar um item ou conjurar
uma magia**, o jogador pode pedir ao mestre para narrar **aquele resultado já
aplicado**, sem recalcular nada e sem criar efeitos novos.

O botão **Narrar consequência** aparece no cartão do último resultado de **item, magia ou ataque com arma**. Ajustes manuais de PV não geram narração automática — são cartões mecânicos, não ações de ficção. A
narração é persistida como evento público e passa a ser a leitura principal da
crônica.

## 2. Fluxo

```text
Resultado de item/magia (dano/cura/consumo)
  ↓
CombatAction (ledger) + resultado já aplicado
  ↓
Narrar consequência
  ↓
POST /campaigns/:campaignId/ai-master/narrate-action
  ↓
Fatos mecânicos extraídos do ledger
  ↓
Prompt específico de resultado + schema fechado
  ↓
Validação: alvo citado + efeito descrito
  ↓
StoryEvent público + table:state/story:updated
```

## 3. API

### `POST /campaigns/:campaignId/ai-master/narrate-action`

```ts
interface NarrateActionInput {
  requestKey: string; // idempotente
  actionId: string;   // CombatAction da campanha
}
```

A resposta é o evento de crônica:

```ts
interface NarratedActionResult {
  eventId: string;
  sequence: number;
  gameMinute: number;
  narration: string;
  memory: { summary: string; openQuestions: string[] };
  model: string;
  latencyMs: number;
  alreadyApplied: boolean;
  persisted: true;
}
```

Regras:

- exige `AUTONOMOUS`, não pausado e memória iniciada;
- só aceita `USE_ITEM`, `CAST_SPELL` e `WEAPON_ATTACK`; dano/cura manual devolve 400;
- apenas o ator da ação ou o mestre pode pedir a narração;
- a ação precisa pertencer à campanha;
- se `requestKey` repetir, devolve o evento anterior sem chamar o modelo;
- o modelo recebe o resultado, mas **não** pode aplicá-lo de novo.

## 4. Fatos mecânicos

`describeMechanicalResult` transforma o resultado em algo curto:

```json
{
  "action": "Dano",
  "outcome": "efeito aplicado pelo motor",
  "targets": [{ "name": "elfo", "result": "2 de dano · PV 4/6" }],
  "resource": null
}
```

Para magia inclui acerto/erro/crítico, save, dano/cura, espaço e PV. Para item
inclui nome, efeito, quantidade restante e PV.

## 5. Prompt e validação

O provedor usa um system prompt próprio (`AI_RESULT_SYSTEM`):

- começar pelo efeito, não pela aproximação do jogador;
- citar nominalmente os alvos;
- repetir o resultado numérico já aplicado;
- não recalcular, inventar alvo, dano, cura ou morte;
- `ask` vazio.

O validador de turno normal proíbe números de mecânica. No modo resultado ele é
chamado com `allowMechanics = true`, porque repetir o dano já aplicado é
obrigatório.

Além do schema, o serviço exige que a narração cite os nomes dos alvos,
contenha uma palavra de efeito e cite o resultado numérico aplicado (dano, cura, PV, acerto, erro, crítico, condição,
item, save). Se falhar, tenta um reparo; persistindo, devolve **422** e não grava
evento.

## 6. UI

- Cartão do último resultado de item/magia ganha **Narrar consequência**.
- Enquanto o modelo responde, o botão fica em “O mestre está narrando…”.
- Após sucesso, o evento aparece no topo da crônica e o botão desaparece para
  aquele `sourceActionId`.
- O botão só existe para o último resultado; resultados antigos ficam no
  histórico como cartões compactos.

## 7. Limites

- A narração de resultado é uma escolha explícita; não é automática.
- Apenas itens e magias; ajustes manuais de dano/cura/condição não são narrados.
- Se o modelo local estiver indisponível, o resultado mecânico continua válido.
- O texto gerado ainda é uma descrição; a fonte da verdade continua sendo o
  ledger.
- Não há edição/exclusão da narração pela UI nesta fase.

## 8. Testes

- fatos para dano/cura, item e magia com ataque/save;
- fallback para resultado desconhecido;
- schema permite mecânica no modo resultado e continua rejeitando no turno
  normal;
- smoke real com `gemma2:9b`: Poção de Cura em 1/6 PV, cura 5, narração
  “O elfo se sente revitalizado ao beber a Poção de Cura, recuperando 5 pontos de vida”, 23,4 s;
- tentativa de narrar dano manual devolve **400**;
- UI: aplicar dano, clicar em **Narrar consequência** e ver o texto substituir
  a leitura principal.
