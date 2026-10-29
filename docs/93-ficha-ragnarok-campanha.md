# Ficha Ragnarok vinculada à campanha

Status: **vínculo jogador ↔ campanha**.
Data: 29/10/2026.

## 1. Modelo

`CampaignRagnarokCharacter`:

- `campaignId`;
- `characterId` único;
- `joinedAt`.

Uma ficha pertence a uma campanha por vez.

Migration: `20261029150000_ragnarok_campaign_link`.

## 2. API

```http
GET    /api/campaigns/:id/ragnarok-characters
POST   /api/campaigns/:id/ragnarok-characters
       { "characterId": "..." }
DELETE /api/campaigns/:id/ragnarok-characters/:characterId
```

Regras:

- membro ou mestre da campanha;
- jogador só vincula a própria ficha;
- mestre pode vincular ficha de jogador;
- ficha não pode estar em outra campanha;
- desvincular exige dono ou mestre.

## 3. UI

Tela de personagem:

- ficha Ragnarok mostra **Vincular à campanha** quando não vinculada;
- após confirmar, badge **Vinculada à campanha**;
- a ficha vinculada é escolhida automaticamente na abertura.

A ficha SRD continua sendo a do token/posição por enquanto.

## 4. Teste

- ficha `Bind UI` criada;
- POST de vínculo → 201;
- GET retornou `[Bind UI]`;
- UI mostrou botão e depois o badge;
- DELETE → 200;
- ficha e vínculo removidos.

Screenshot: `frontend/test-results/character-bound.png`.

## 5. Limites

- vínculo é só de dados; ainda não substitui o avatar/token SRD;
- não há botão de desvincular na UI;
- sem roster visual do mestre;
- sem loja/Kafra usando a ficha ainda;
- sem posição própria da ficha Ragnarok.

## 6. Próximo

1. token/posição Ragnarok;
2. roster do mestre;
3. loja/Kafra usando zeny da ficha;
4. skills na hotbar;
5. modelo 3D.
