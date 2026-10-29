# M1 — Aprendiz, aparência, classe e rates

Status: **implementado**.
Data: 29/10/2026.

## 1. Entrada

Todo personagem novo nasce **Aprendiz**:

- job `JT_NOVICE` (id 0);
- nível base 1;
- job level 1;
- 15 pontos de atributo;
- 1 ponto de skill;
- zeny 0.

O servidor ignora `jobId`, `level` e stats enviados na criação. O cliente não
escolhe mais classe.

## 2. Aparência

Campos persistidos:

```text
gender
hairStyle
hairColor
clothesColor
skinTone
appearance (legado)
```

- criação na biblioteca;
- edição dentro da ficha em tela cheia;
- sprite local em cache; paper doll CSS como fallback;
- API `PATCH /ragnarok/characters/:id`.

A prévia é local; ainda não usa sprite Ragnarok.

## 3. Classe pelo mestre

```http
POST /api/campaigns/:id/ragnarok-characters/:characterId/class
{ "jobId": 1 }
```

Regras:

- somente mestre;
- ficha precisa estar vinculada à campanha;
- Aprendiz não pode ser “concedido” de novo;
- grava `classGrantedAt` e `classGrantedById`;
- atualiza a ficha na UI.

Painel do mestre ganhou:

- seletor de ficha vinculada;
- seletor de classe;
- botão **Conceder classe**.

## 4. Rates e loot

```http
GET   /api/campaigns/:id/ragnarok-config
PATCH /api/campaigns/:id/ragnarok-config
```

Campos:

- Base EXP;
- Job EXP;
- Drop;
- Zeny;
- loot mode;
- proteção do loot.

Padrão:

```text
5x / 5x / 5x / 5x
KILLER
45 segundos
```

Somente mestre altera. A UI está no console do mestre.

## 5. Banco

Migration:

`20261029160000_ragnarok_m1_appearance_config`

Novos campos em `RagnarokCharacter`:

- jobLevel, jobExp, zeny;
- gender, hairStyle, hairColor, clothesColor, skinTone;
- classGrantedAt, classGrantedById.

Nova tabela:

- `RagnarokCampaignConfig`.

## 6. Testes

API:

- criação com `jobId: 5`, `level: 99`, `strength: 99`
  → Aprendiz, nível 1, FOR 1, 15 pontos;
- aparência salva e relida;
- vínculo;
- classe concedida: Espadachim;
- config padrão 5x/KILLER/45s;
- config alterada para 10x/PARTY;
- ficha de teste removida e config restaurada.

UI:

- ficha com seção **Aparência**;
- prévia muda cabelo/roupa/pele;
- painel do mestre com **Ragnarok — classe** e **rates e loot**.

Screenshots:

- `frontend/test-results/m1-appearance-saved.png`
- `frontend/test-results/m1-master.png`

## 7. Limites

- sprite local estático de Aprendiz; cores de cabelo/roupa ainda não aplicadas;
- cabelo/corte ainda abstratos;
- rates não são aplicados em combate porque o combate Ragnarok ainda não existe;
- classe não valida job level/missão;
- sem job exp;
- sem token/posição Ragnarok;
- sem loja/Kafra/mobs;
- ficha SRD não usa esses campos.

## 8. Próximo

1. renderer local de sprite/paleta;
2. job level/job exp;
3. classes com pré-requisitos;
4. token/posição Ragnarok;
5. NPCs, lojas, portais.
