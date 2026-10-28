# Sincronização de posição no modo imersivo

Status: **funcionando entre clientes por polling**.
Última atualização: 28/10/2026.

## 1. Ponte do viewer

O viewer agora expõe:

```ts
__eldoria.getPlayerPosition(): { x, y } | null
```

`x/y` são frações do grid da GAT. O parent converte para células do VTT:

```ts
x = floor(pos.x * map.width)
y = floor(pos.y * map.height)
```

## 2. Endpoint do jogador

Novo endpoint **sem exigir mestre**:

```http
PUT /api/campaigns/:campaignId/vtt/maps/:mapId/tokens/me
{
  "characterId": "...",
  "x": 12,
  "y": 9
}
```

Regras:

- precisa ser membro da campanha;
- a ficha precisa pertencer ao usuário;
- se a ficha estiver vinculada a outra campanha, retorna conflito;
- cria o token do personagem no mapa se ainda não existir;
- atualiza x/y e emite `map.updated`;
- não permite que um jogador mova o token de outro.

## 3. Fluxo no cliente

- a cada **1 s**, o parent lê `getPlayerPosition` e envia `tokens/me`;
- a cada **2,5 s**, recarrega mapas/tokens;
- o token do próprio jogador é excluído dos sprites — o avatar local já o
  representa;
- tokens de **outros personagens** entram como sprites 3D;
- NPCs ambientes e NPCs persistentes continuam funcionando.

Assim:

- cada cliente vê o próprio avatar livre;
- os outros veem a posição atualizada em até ~2,5 s;
- o mestre continua podendo mover NPCs e tokens.

## 4. Testes

- endpoint `tokens/me` criou token na posição 11,9 e devolveu 200;
- UI criou token automático na posição 12,9 após abrir o modo imersivo;
- tokens/fichas de teste removidos depois;
- OpenAPI: **124 rotas**.

## 5. Limites

- é polling, não WebSocket de posição;
- o token do outro jogador usa sprite genérico até mapearmos o build visual;
- se o jogador tiver várias fichas, o cliente usa a primeira;
- movimento durante combate continua bloqueado pelo `setLocked`.

## 6. Próxima fase

- transporte por WebSocket em vez de polling;
- sprite do outro jogador a partir de `Character.appearance`;
- combate 3D: iniciativa, célula atual, alcance, ataque e IA.
