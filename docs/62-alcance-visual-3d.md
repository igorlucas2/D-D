# Alcance visual e destaque 3D

Status: **anel de deslocamento no chão + tint do alvo**.
Última atualização: 28/10/2026.

## 1. Anel de alcance

O viewer ganhou:

```ts
__eldoria.setRange(x, y, cells, mapWidth, mapHeight)
```

- posiciona um anel no chão;
- raio = `cells * cellSize`;
- cor ciano, translúcido;
- `cells = 0` esconde.

O parent calcula:

```ts
remainingCells = floor((speed - movementUsed) / 5)
```

e atualiza o anel com a posição do participante atual e as dimensões do mapa.

## 2. Destaque do alvo

```ts
__eldoria.setSelectedActor("combat-<participantId>")
```

- percorre os sprites;
- pinta o alvo com âmbar (`#ffd166`);
- restaura branco nos demais;
- `null` limpa.

O alvo é escolhido clicando no sprite (raycast) ou na linha de iniciativa.

## 3. Teste visual

Encontro `Anel 3D`:

- Guarda em `12,9`, Poring em `14,9`;
- HUD mostrou **0p** e **10p**;
- Poring selecionado na HUD;
- anel ciano de **30 pés** visível no terreno em volta do Guarda;
- Poring com tint de alvo;
- encontro de teste removido.

Screenshot: `frontend/test-results/immersive-range-ring.png`.

## 4. Limites

- o anel é uma aproximação plana; não acompanha cada elevação do terreno;
- não mostra obstáculos/paredes;
- armas à distância ainda sem alcance numérico;
- o anel não impede o clique fora do alcance — a validação é do movimento/ataque;
- sprite pode não aparecer em alguns ângulos.

## 5. Próxima fase

- anel de alcance de arma/alvo;
- célula clicável com preview de caminho;
- alcance numérico para armas à distância;
- IA de inimigos.
