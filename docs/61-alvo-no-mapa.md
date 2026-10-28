# Alvo no mapa e distância tática

Status: **seleção de alvo na HUD + raycast de ator no viewer**.
Última atualização: 28/10/2026.

## 1. Distância na HUD

A lista de iniciativa mostra:

```text
15  Guarda        0p    20/20
8   Poring       10p    12/12
```

- distância Chebyshev em pés;
- 1 célula = 5 pés;
- `—` quando falta coordenada.

Teste: Guarda em `12,9`, Poring em `14,9` → **10p**; o alvo ficou com anel
âmbar ao ser selecionado.

Screenshot: `frontend/test-results/immersive-range-target.png`.

## 2. Selecionar alvo na HUD

Clicar (ou Enter/Espaço) em uma linha de iniciativa:

- define `selectedTargetId`;
- destaca a linha com anel âmbar;
- o diálogo de ataque abre já nesse alvo.

## 3. Selecionar alvo no mapa

O viewer ganhou raycast de atores:

- cada sprite carrega `userData.actorId`;
- `pointerdown` no canvas faz raycast nos atores;
- se acertar, interrompe o clique de movimento;
- chama `__eldoria.onActorClick(actorId)`;
- o parent remove o prefixo `combat-` e seleciona o participante.

Assim o jogador pode clicar no sprite do Poring/aliado para escolher o alvo.

## 4. Alcance no motor

Continua valendo para armas corpo a corpo:

- distância > 1 célula (5 pés) → recusa antes da rolagem;
- armas à distância ainda não têm alcance numérico no catálogo.

## 5. Limites

- o raycast usa o sprite, não a célula;
- não há destaque visual no sprite selecionado, só na HUD;
- alvo ainda pode ser trocado no diálogo;
- o sprite pode não aparecer em alguns ângulos/câmeras.

## 6. Próxima fase

- anel de alcance no chão;
- destaque 3D do alvo;
- alcance numérico para armas à distância;
- magia/item com o mesmo alvo selecionado.
