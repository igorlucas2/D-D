# Kafra com token Ragnarok

Status: **save, teleporte e recuperação de HP/SP**.
Data: 30/10/2026.

## 1. Modelo

`RagnarokCharacter` ganhou:

```text
saveMapId String?
saveX     Int?
saveY     Int?
```

Migration: `20261030080000_ragnarok_kafra_save`.

## 2. API

```http
POST /api/campaigns/:id/ragnarok-characters/:characterId/kafra/save
POST /api/campaigns/:id/ragnarok-characters/:characterId/kafra/teleport
```

Regras:

- jogador dono da ficha;
- ficha vinculada à campanha;
- token Ragnarok precisa existir;
- save usa mapa/x/y atuais do token;
- teleporte move o token para o save;
- teleporte restaura HP/SP máximos;
- mapa do save precisa pertencer à campanha.

## 3. UI

- botão **Kafra de Prontera** no painel lateral;
- abre painel de jogo no canto, sem modal;
- **Salvar ponto**;
- **Teleportar ao save**;
- mensagens no painel.

## 4. Teste

API:

- token de IGOR em 10,10;
- save gravado;
- token movido para 1,1;
- teleporte voltou para o save;
- HP/SP restaurados;
- save de teste limpo.

UI:

- painel abriu;
- “Ponto de save registrado.” apareceu;
- screenshot `frontend/test-results/kafra-panel.png`.

## 5. Limites

- não há armazém ainda;
- não há lista de destinos;
- save é por personagem, não por conta;
- a Kafra não valida proximidade do NPC;
- o painel é um overlay de jogo, não modal genérico.

## 6. Próximo

1. armazém da Kafra;
2. lista de teleportes;
3. loja NPC;
4. portais para outros mapas;
5. combate.
