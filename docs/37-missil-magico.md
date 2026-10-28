# Míssil Mágico — Fase O

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Adicionar uma magia de **dano automático**, sem ataque nem salvaguarda:

- **Míssil Mágico** (nome do catálogo), nível 1;
- dano de **força**;
- acerto garantido;
- consome espaço e ação;
- entra no mesmo pipeline de resultado, PV e narração.

## 2. Regra simplificada

O catálogo não traz `Spell.mechanics` para essa magia; o motor usa fallback:

```ts
kind: 'DAMAGE'
formula: '3d4+3'
damageType: 'force'
save: null
attack: null
targets: 'SINGLE'
upcast: { formula: '1d4+1' }
```

Cada conjuração é resolvida como os três dardos no alvo selecionado:
`3d4+3` de dano de força. Upcast soma `1d4+1` por nível acima do 1º.

## 3. Fluxo

- exige um alvo participante;
- consome espaço nível 1 e ação;
- não rola ataque nem save;
- aplica dano direto, respeitando PV temporário;
- atualiza ficha/participante;
- gera `CAST_SPELL` com `damageType = force`;
- o cartão mostra dano de força;
- **Narrar consequência** funciona, pois há dano aplicado.

## 4. Correção de fatos

O extrator de fatos tratava qualquer magia sem ataque/save como cura. Agora usa
`damageType`/`effectKind` para distinguir dano automático de cura:

- `"12 de dano · PV ..."` para Míssil;
- `"12 de cura · PV ..."` apenas para cura.

## 5. Teste real

Combate com elfo e Goblin:

- Míssil Mágico: **200**;
- `effectKind = DAMAGE`, `damageType = force`;
- `attack = null`, `save = null`;
- dano **6**, Goblin **20 → 14 PV**;
- espaço nível 1 **0 → 1**;
- narração:
  > “O míssil mágico explode sobre o Goblin, causando 6 de dano. O Goblin agora tem 14 PV.”
- encontro, ação, evento, espaço e HP restaurados.

## 6. Limites

- Os três dardos são resolvidos em um único alvo, não distribuídos entre alvos.
- Não há contagem individual de dardos na UI.
- O dano é `3d4+3` fixo; upcast soma `1d4+1`.
- Continua usando o slot/ação padrão.

## 7. Testes

- Fallback de Míssil com `attack/save = null`, dano de força e upcast;
- fatos de narração não chamam dano automático de cura;
- **202 testes / 38 suítes**;
- OpenAPI: **117 rotas** (sem rota nova).
