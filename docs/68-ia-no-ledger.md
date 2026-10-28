# IA de inimigos no ledger de combate

Status: **ataque da IA registrado no histórico**.
Última atualização: 28/10/2026.

## 1. Ledger

Cada turno de IA que tenta atacar cria um `CombatAction`:

- `kind: AI_ATTACK`;
- `source: "IA: <nome>"`;
- alvo participante;
- payload com `currentId`, `attack`, `ac`, `hit`, `critical`, `damage`;
- result com `amount`, `applied`, `hpBefore`, `hpAfter`, `damageType`;
- `requestKey` UUID e `requestHash` SHA-256.

Isso faz o ataque aparecer no **Registro** da HUD:

```text
REGISTRO
IA: Poring · Guarda     3 PV
```

Mesmo quando erra, o registro aparece com `—` / 0 PV.

## 2. Teste

Encontro `IA Log 3D`:

- Guarda em `12,9`;
- Poring em `14,9`;
- Poring recebeu o turno;
- IA moveu para `13,9`, rolou ataque e **errou**;
- ledger retornou:
  - `kind: AI_ATTACK`;
  - `source: IA: Poring`;
  - `target: Guarda`;
  - `applied: 0`;
- HUD mostrou o registro;
- encontro e ações de teste removidos.

Screenshot: `frontend/test-results/immersive-ai-log.png`.

## 3. Limites

- IA ainda não usa habilidades;
- não há linha de visão/caminho;
- ataque da IA usa fórmula fixa `d20+2` / `1d6+1`;
- não avança turno automaticamente;
- aliados não têm IA.

## 4. Próxima fase

- IA com caminho e alcance;
- ataques com arma/habilidade;
- condições;
- auto-turno;
- animação de ataque.
