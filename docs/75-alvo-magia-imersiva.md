# Alvo selecionado também na magia

Status: **alvo do mapa/HUD abre marcado no diálogo de magia**.
Última atualização: 28/10/2026.

## 1. Fluxo

- jogador clica no sprite ou na linha de iniciativa;
- `selectedTargetId` é definido;
- ao abrir **Conjurar**, o diálogo recebe `initialTargetId`;
- para magias de **alvo único**, esse alvo já começa selecionado;
- o jogador ainda pode trocar no diálogo.

## 2. Implementação

`SpellDialog` ganhou:

```ts
initialTargetId?: string | null
```

`defaultTargetsFor(...)` usa o alvo preferido quando a magia é `SINGLE`.

## 3. Limites

- magia de área/múltiplos não usa o alvo inicial;
- sem área desenhada no terreno;
- sem validação de alcance/linha de visão no grid;
- sem animação.

## 4. Próxima fase

- área e alcance no terreno;
- alvo por clique para área;
- animação de conjuração;
- save visual no mapa.
