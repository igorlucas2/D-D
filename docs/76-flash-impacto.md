# Flash de impacto no sprite

Status: **feedback visual de dano/cura no viewer**.
Última atualização: 28/10/2026.

## 1. Ponte

O viewer ganhou:

```ts
__eldoria.pulseActor("combat-<participantId>", "hit" | "heal")
```

Efeito:

- pinta o sprite de vermelho (dano) ou verde (cura);
- aumenta 22% por 260 ms;
- restaura a escala e a cor do alvo selecionado.

## 2. Disparo

A HUD observa o `actionLog`:

- nova ação no topo;
- chama `pulseActor` no participante alvo;
- `HEAL` usa verde; demais usam vermelho.

Atualiza junto com o Registro (a cada 3 s).

## 3. Limites

- o pulso pode chegar até 3 s depois da ação;
- só aparece se o alvo tiver sprite (NPC/participante no mapa);
- não há número de dano flutuante;
- o avatar local do próprio jogador não é um sprite de combate e não pulsa;
- sem som.

## 4. Próxima fase

- dano flutuante;
- animação de ataque/conjuração;
- pulso imediato pelo resultado do ataque;
- som de impacto.
