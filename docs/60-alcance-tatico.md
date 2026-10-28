# Alcance tático no combate imersivo

Status: **distância na HUD + alcance corpo a corpo no motor**.
Última atualização: 28/10/2026.

## 1. Distância na HUD

A lista de iniciativa agora mostra a distância em pés entre o participante
atual e cada alvo:

```text
15  Guarda        10p   20/20
8   Poring        15p   12/12
```

- cálculo Chebyshev;
- 1 célula = 5 pés;
- `—` quando algum dos dois ainda não tem coordenada.

## 2. Validação no motor

`WeaponAttackService` valida ataques **corpo a corpo** antes de rolar:

- localiza o participante do atacante pelo `assertCanAct`;
- compara com a posição do participante alvo;
- se a distância for maior que **1 célula (5 pés)**, recusa:

```text
Alvo fora do alcance corpo a corpo (5 pés): 15 pés.
```

Armas marcadas como `ranged` não usam essa regra nesta fatia, porque o
catálogo SRD ainda não guarda o alcance numérico em pés.

## 3. Interação com o movimento

- o jogador move com clique/limite;
- a HUD mostra o alcance;
- o ataque é bloqueado se o alvo estiver longe demais no corpo a corpo;
- ataques à distância continuam permitidos.

## 4. Limites

- não há desenho de alcance no chão;
- alcance de armas à distância ainda não é numérico;
- magia não usa esta validação;
- a HUD mostra distância, mas o alvo ainda é escolhido no diálogo.

## 5. Próxima fase

- anel/área de alcance no terreno;
- alcance numérico das armas à distância;
- clique no inimigo para alvo;
- destaque de alvos válidos.
