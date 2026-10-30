# Job level e job EXP

Status: **progressão concedida pelo mestre**.
Data: 30/10/2026.

## 1. Regra

- job level máximo: 70;
- cada nível concede +1 skill point;
- EXP necessária por nível:

```text
100 + (jobLevel - 1) * 50
```

Exemplos:

- nível 1 → 100;
- nível 10 → 550;
- nível 20 → 1050.

## 2. API

```http
POST /api/campaigns/:id/ragnarok-characters/:characterId/job-level
{ "level": 10 }

POST /api/campaigns/:id/ragnarok-characters/:characterId/job-exp
{ "amount": 1000 }
```

Regras:

- somente mestre;
- ficha vinculada à campanha;
- nível limitado a 1–70;
- subir nível incrementa skill points pela diferença;
- job EXP sobe vários níveis em loop, com sobra;
- no nível máximo, EXP fica 0.

## 3. UI

Ficha:

- `Job N` no cabeçalho;
- barra `jobExp / próximo`;
- atualiza após o mestre conceder.

Painel do mestre:

- input de job level;
- botão **Job level**;
- input de job EXP;
- botão **Dar Job EXP**.

## 4. Teste

Ficha `Job Test`:

- criada como Aprendiz;
- job level 10 → skill points **10**;
- job EXP 1000 no nível 10:
  - sobe para 11;
  - sobra 450;
  - skill points **11**;
- ficha removida.

## 5. Limites

- não existe fonte automática de job EXP ainda;
- combate/mobs ainda não dão EXP;
- classe não exige job level 10 (o mestre decide);
- rates de job EXP ainda não são aplicados;
- cores de cabelo/roupa do sprite seguem pendentes;
- sem equipamento composto no sprite.

## 6. Próximo

1. EXP por mob/quest;
2. exigência opcional de job level para classe;
3. rates aplicados;
4. paleta de cabelo/roupa;
5. token/posição no mundo.
