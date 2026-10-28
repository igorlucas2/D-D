# Economia de ações e turno — Fase G

Status: **implementada** (ação principal).
Última atualização: 27/10/2026.

## 1. Objetivo

Fazer o combate respeitar a ordem de iniciativa e a ação principal por turno:

- atacar, conjurar ou usar item consome a **ação** do participante;
- só o participante do turno atual pode agir;
- o jogador pode encerrar o próprio turno;
- o mestre pode encerrar/avançar qualquer turno;
- o próximo participante começa com ação, bônus e reação disponíveis.

## 2. Dados

`CombatParticipant` ganha:

```prisma
actionUsed   Boolean @default(false)
bonusUsed    Boolean @default(false)
reactionUsed Boolean @default(false)
```

Migração `20261027135714_combat_action_economy`.

`actionUsed` já é aplicado; `bonusUsed` e `reactionUsed` ficam preparados para
as próximas fases.

## 3. Regras

Ao usar arma, magia ou item dentro de um combate:

1. o personagem precisa ter um participante no encontro;
2. o participante precisa ser o atual (`turnIndex`);
3. `actionUsed` precisa ser falso;
4. a transação da ação marca `actionUsed = true`.

Fora de combate não há economia: as mesmas ações continuam livres.

Ajustes manuais de PV/condição no HUD **não** consomem ação; são correções de
mesa, não ações de personagem.

### Encerrar turno

`POST /campaigns/:campaignId/combat/end-turn`

- jogador: apenas se o participante atual pertence ao seu personagem;
- mestre: qualquer turno;
- avança `turnIndex`/`round`, incrementa `revision` e reseta
  `actionUsed/bonusUsed/reactionUsed` do novo participante;
- emite `table:turn`/`table:state`.

O endpoint antigo `next-turn` continua existindo para o mestre.

## 4. Concorrência

`assertCanAct` bloqueia a linha do `CombatEncounter` com
`SELECT ... FOR UPDATE`, relê o encontro e valida turno/ação. Isso evita duas
ações simultâneas consumirem a mesma ação.

As ações continuam incrementando `revision`; a UI usa CAS em
`expectedRevision`.

## 5. UI

- HUD mostra:
  - “seu turno / ação disponível”;
  - “ação usada”;
  - “aguardando seu turno”.
- **Atacar**, **Conjurar** e **Usar item** ficam desabilitados fora do turno ou
  depois da ação.
- **Encerrar turno** aparece no turno do jogador.
- Ajustes manuais (Dano/Cura/PV temp./Condição) continuam disponíveis; não são
  ações de combate.
- O reload do estado vem de `table:state` e do evento de turno.

## 6. Limites

Reação passou a ser consumida por Escudo Arcano: `docs/39-escudo-arcano.md`.

Ação bônus passou a ser consumida por Escudo da Fé: `docs/38-escudo-da-fe.md`.

Condições temporárias em rodadas estão em `docs/36-condicoes-com-duracao.md`.

- Ação bônus e reação têm campos, mas nenhuma ação as consome ainda.
- Não há movimento, dash, prontidão ou ação livre.
- Ações de arma/magia/item são todas tratadas como **ação principal**.
- A economia só vale dentro de combate ativo; fora dele, as ações são livres.
- Ajustes manuais não são bloqueados pela economia.

## 7. Testes

Smoke com banco e dois participantes:

- elfo (iniciativa 20) e alvo (iniciativa 10);
- ataque com Punhal: **200**, dano 5, `actionUsed = true`;
- segundo ataque no mesmo turno: **409** “ação já usada”;
- encerrar turno: vez do alvo, flags do alvo resetadas;
- ataque do elfo fora do turno: **409** “não é seu turno”;
- `next-turn` do mestre volta ao elfo, flags resetadas;
- novo ataque: **200**;
- encontro removido e HP restaurado.

Testes unitários existentes de arma/magia/item continuam passando; **185
testes/35 suítes**.
