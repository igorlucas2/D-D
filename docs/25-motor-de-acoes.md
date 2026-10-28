# Motor de ações e Mesa 2.0 — Fase A

Status: **Fase A implementada** (dano, cura, PV temporário e condições).
Última atualização: 27/10/2026.

## 1. Objetivo

Dar ao jogador uma mesa em que a **narração do mestre é o centro de leitura** e
as consequências mecânicas são aplicadas pelo servidor, não pelo modelo.

Fase A entrega:

- dano, cura, PV temporário e condições;
- alvo por personagem ou participante do combate;
- resultado mecânico com breakdown;
- crônica central, HUD do personagem e composer hierarquizados;
- histórico e idempotência por `requestKey`;
- autorização e concorrência otimista.

Fora da Fase A: ataques com arma, magias, itens com carga, economia de ações,
morte/descanso automáticos. Essas fases usam o mesmo pipeline.

## 2. Hierarquia da página

A página `/campaigns/:id/play` passa a ter uma hierarquia explícita:

```text
Cabeçalho: campanha, cena, status do mestre, controles do mestre (discretos)
┌──────────────────────────────────────────────┬────────────────────┐
│ CRÔNICA                                      │ HUD DO PERSONAGEM  │
│  última narração em destaque, texto grande   │  PV, PV temp, CA   │
│  entradas anteriores em linha do tempo       │  condições         │
│  resultados mecânicos recentes               │  ações rápidas     │
│                                              │                    │
│ COMPOSER: o que você faz?                    │  combate/turno     │
└──────────────────────────────────────────────┴────────────────────┘
```

Regras:

1. A crônica é a coluna mais larga e o primeiro conteúdo após o cabeçalho.
2. A última narração é sempre o elemento tipográfico de maior peso.
3. O HUD é lateral no desktop e vem depois da crônica no mobile.
4. O composer fica no fim da crônica, separado da leitura.
5. Controles do mestre não competem com a narrativa: ficam no topo, compactos.
6. Resultados mecânicos usam cartões menores e cores semânticas; nunca
   substituem a prosa.

## 3. Fluxo

```text
Jogador usa o composer (narração) e/ou HUD (mecânica)
  │
  ├─ POST /ai-master/act ───────────────► prosa do mestre (fonte da crônica)
  │
  └─ POST /combat/actions ──────────────► motor aplica dano/cura/PV/condição
                                                │
                                                ├─ CombatAction (ledger)
                                                ├─ Character + CombatParticipant
                                                ├─ revisão do encontro +1
                                                └─ table:state / table:combat
```

A IA continua **sem** autorização para aplicar mecânica. O HUD é a interface
humana para o motor; o compositor é a interface narrativa.

## 4. API

### `POST /campaigns/:campaignId/combat/actions`

```ts
interface CombatActionInput {
  requestKey: string;              // UUID, idempotente por ator
  expectedRevision?: number;       // revisão do encontro, se houver
  kind: "DAMAGE" | "HEAL" | "TEMP_HP" | "CONDITION";
  targetKind: "CHARACTER" | "PARTICIPANT";
  targetId: string;
  amount?: number;                 // 1..999
  formula?: string;                // "2d6+3"; exclusivo de amount
  damageType?: DamageType;         // padrão untyped
  condition?: string;              // 1..60
  conditionMode?: "ADD" | "REMOVE";
  source?: string;                 // 1..80
}
```

Resposta:

```ts
interface CombatActionResult {
  actionId: string;
  requestKey: string;
  kind: ActionKind;
  target: {
    kind: "CHARACTER" | "PARTICIPANT";
    id: string;
    name: string;
    characterId: string | null;
  };
  amount: number;
  breakdown: RollBreakdown | null;
  damageType: string | null;
  hpBefore: { current: number; max: number; temp: number };
  hpAfter: { current: number; max: number; temp: number };
  applied: number;
  absorbedByTempHp: number;
  conditionsBefore: string[];
  conditionsAfter: string[];
  source: string | null;
  alreadyApplied: boolean;
  createdAt: string;
}
```

Regras:

- exatamente `amount` ou `formula` para `DAMAGE`/`HEAL`;
- `TEMP_HP` usa `amount`;
- `CONDITION` exige `condition` e `conditionMode`, não usa valor;
- membros só podem alvo no próprio personagem; mestre pode qualquer alvo;
- alvo `PARTICIPANT` exige combate ativo e participante da campanha;
- alvo `CHARACTER` exige ficha vinculada à campanha;
- `expectedRevision` divergente devolve **409**;
- `requestKey` repetido devolve o resultado anterior (`alreadyApplied: true`).

### `GET /campaigns/:campaignId/combat/actions?take=20`

Lista o ledger recente, mais novo primeiro. Membros veem a mesa; o corpo não
inclui dados privados de ficha.

## 5. Regras dos efeitos

### Dano

```text
absorvido = min(PV temporário, dano)
PV temporário -= absorvido
perdido = min(PV atual, dano - absorvido)
PV atual -= perdido
```

PV nunca fica negativo. O resultado informa dano aplicado e absorvido.
Se o alvo for participante ligado a personagem, a ficha acompanha na mesma
transação.

### Cura

```text
aplicado = min(cura, máximo - atual)
PV atual += aplicado
```

Cura não cria PV temporário nem ultrapassa o máximo.

### PV temporário

Não acumula: vale o maior valor entre o atual e o novo. O resultado informa
quanto foi efetivamente ganho.

### Condições

Lista JSON existente (`CombatParticipant.conditions`). `ADD` adiciona sem
duplicar (comparação sem caixa); `REMOVE` remove. Limite de 20 condições e 60
caracteres por nome. Duração estruturada fica para a Fase C.

## 6. Fonte da verdade e concorrência

- `Character.currentHp` / `tempHp`: persistência da ficha.
- `CombatParticipant.currentHp` / `tempHp`: projeção do encontro.
- Toda ação bloqueia o alvo com `SELECT ... FOR UPDATE`, aplica e atualiza os
  dois registros na mesma transação.
- `CombatEncounter.revision` incrementa a cada ação quando há combate.
- `CombatAction` é o ledger: ator, alvo, entrada canônica, resultado, revisão.
- O cliente envia `requestKey`; o servidor calcula hash canônico e rejeita a
  mesma chave com corpo diferente.

## 7. Dados

`CombatParticipant` ganha `tempHp`.

Novo `CombatAction`:

```prisma
model CombatAction {
  id           String   @id @default(cuid())
  campaignId   String
  encounterId  String?
  actorUserId  String
  requestKey   String
  requestHash  String   @db.Char(64)
  kind         String
  targetKind   String
  targetId     String
  targetName   String
  payload      String   @db.LongText
  result       String   @db.LongText
  createdAt    DateTime @default(now())
  @@unique([campaignId, actorUserId, requestKey])
  @@index([campaignId, createdAt])
}
```

Relações com campanha, usuário e encontro usam cascata/`SetNull` para preservar
o ledger quando o combate termina.

## 8. UI

Componentes:

- `chronicle.tsx` — crônica com última narração em destaque, histórico e
  resultados mecânicos;
- `character-hud.tsx` — PV, PV temporário, CA, condições e ações rápidas;
- `mechanical-action-dialog.tsx` — alvo, tipo, valor/fórmula, tipo de dano,
  condição e prévia;
- `resolution-card.tsx` — breakdown do resultado.

Interações:

- último texto do mestre com `aria-live="polite"`;
- botões do HUD abrem o diálogo já no tipo escolhido;
- mestre escolhe qualquer alvo; jogador vê apenas os próprios;
- após aplicar, recarrega estado e combate, e o cartão de resultado aparece na
  crônica;
- erros aparecem perto do composer, sem apagar o texto digitado;
- `prefers-reduced-motion` respeitado.

## 9. Status da entrega

Implementado: migração e ledger `CombatAction`, motor transacional,
permissões, idempotência, histórico, HUD, composer de ação e crônica
central. Testes manuais contra o banco: dano com PV temporário, cura, replay
de `requestKey`, condição em participante e sincronização ficha ↔ combate.

## 9.1 Fase B

Itens consumíveis usam o mesmo ledger e a mesma transação; a spec está em `docs/26-itens.md`.

## 9.2 Fase C

Magias usam slot, save e upcast no mesmo pipeline; a spec está em `docs/27-magias.md`.

## 9.3 Fase D

Ataques mágicos usam CA e crítico no mesmo pipeline de magia; ver `docs/27-magias.md`.

## 9.4 Fase E

A narração de resultados mecânicos está em `docs/28-narracao-mecanica.md`.

## 9.5 Fase F

Ataques com arma estão em `docs/29-armas.md`.

## 9.6 Fase G

Economia de ações e turno em `docs/30-economia-de-acoes.md`.

## 9.7 Fase H

Queda, estabilização e morte em `docs/31-morte-e-estabilizacao.md`.

## 9.8 Fase I

Salvaguarda automática no início do turno em `docs/31-morte-e-estabilizacao.md`.

## 9.9 Fase J

Narração de ataques com arma em `docs/32-narracao-de-armas.md`.

## 9.10 Fase K

Marca do Caçador e concentração em `docs/33-concentracao.md`.

## 10. Testes e aceite

Unitários:

- dano com e sem PV temporário, dano maior que PV, PV zero;
- cura limitada ao máximo;
- PV temporário não acumula;
- condição adiciona/remove sem duplicar;
- DTO rejeita valor e fórmula juntos, alvo inválido e condição vazia.

Integração:

- jogador não pode ferir outro personagem;
- mestre pode;
- repetição de `requestKey` não duplica dano;
- revisão divergente devolve 409;
- ficha e participante ficam iguais;
- ledger e socket refletem a ação.

Aceite:

- nenhuma ação altera PV fora de transação;
- a página mostra a última narração como elemento principal;
- o HUD reflete o estado após cada ação sem reload manual;
- a mesa continua jogável se a IA estiver desligada.
