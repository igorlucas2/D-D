# Números flutuantes de dano/cura

Status: **feedback numérico no sprite**.
Última atualização: 28/10/2026.

## 1. Ponte

```ts
__eldoria.floatText("combat-<id>", "-8", "hit")
__eldoria.floatText("combat-<id>", "+7", "heal")
```

Cria um sprite de texto:

- canvas 256×96, fonte serifada;
- contorno preto;
- vermelho para dano, verde para cura;
- sobe 3 unidades e desaparece em **900 ms**;
- textura/material descartados no fim.

## 2. Disparo

O mesmo observador do `actionLog` que dispara o flash chama
`floatText` quando `applied > 0`.

## 3. Limites

- pode chegar até 3 s depois da ação;
- some se o alvo não tiver sprite;
- sem número para condição/erro;
- sem fila: vários números podem sobrepor;
- avatar local não recebe.

## 4. Próxima fase

- fila/agrupamento de números;
- dano crítico com estilo próprio;
- som;
- animação de conjuração.
