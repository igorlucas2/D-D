# Clique no terreno no combate imersivo

Status: **movimento por clique com validação e snapback**.
Última atualização: 28/10/2026.

## 1. Ponte

O viewer agora expõe:

```ts
__eldoria.setPlayerCell(x, y, mapWidth, mapHeight)
```

- `x/y` são células do VTT;
- o viewer converte para células da GAT;
- o walker é parado e reposicionado;
- a câmera acompanha no frame seguinte.

## 2. Fluxo no turno do jogador

- when `currentCombatant.characterId === myCharacter.id`:
  - o overlay de lock é removido;
  - o jogador pode clicar no terreno e andar;
  - a posição é lida por `getPlayerPosition` a cada 1 s;
  - o parent converte para células do VTT;
  - envia `PATCH /combat/participants/:id/move`.

### Guarda de deslocamento

Antes de enviar:

- calcula distância Chebyshev da posição persistida;
- compara com `speed - movementUsed`;
- se passar, **nem envia**;
- chama `setPlayerCell` para voltar à última célula válida;
- mostra “Movimento insuficiente”.

Isso evita o avatar atravessar o mapa e o servidor recusar.

## 3. Posição inicial

No começo do turno do jogador:

- se o participante já tem `x/y`, o avatar é teleportado para essa célula;
- se não tem, o primeiro movimento é a colocação inicial.

## 4. Teste

Com `Click Teste` (30 pés):

- clique distante: avatar voltou ao centro e HUD mostrou
  “Movimento insuficiente: restam 30 pés para este turno”;
- posição persistida permaneceu `12,9`, `movementUsed = 0`;
- mapa voltou a renderizar Prontera corretamente após o snapback;
- ficha, encontro e tokens de teste removidos.

Screenshot: `frontend/test-results/immersive-click-coord.png`.

## 5. Limites

- o clique ainda pode iniciar um passo visual antes do snapback;
- não há desenho de alcance no chão;
- colisão/parede é do viewer, não do servidor;
- ataque e alvo continuam no diálogo.

## 6. Próxima fase

- preview de alcance antes do clique;
- caminho válido limitado pelo orçamento;
- clique no inimigo para alvo;
- ataque com validação de distância.
