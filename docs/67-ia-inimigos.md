# IA de inimigos — primeiro turno

Status: **IA de movimento e ataque básico**.
Última atualização: 28/10/2026.

## 1. Endpoint

```http
POST /api/campaigns/:id/combat/ai-turn
```

Somente o mestre.

Regras:

- só age se o participante atual for **inimigo**;
- escolhe o aliado vivo mais próximo;
- calcula deslocamento restante;
- move até ficar adjacente (Chebyshev);
- se estiver a ≤ 1 célula e ainda tiver ação:
  - rola **d20 + 2** contra CA (ficha do aliado ou 10);
  - dano **1d6+1**, dobrado em crítico;
  - aplica PV temporários antes dos PV normais;
  - marca `actionUsed`.

## 2. HUD

Quando o turno atual é de um inimigo, o mestre vê:

```text
Turno da IA
```

O encontro retorna atualizado; o mestre pode então usar **Próximo turno**.

## 3. Teste

Encontro `IA 3D`:

- Guarda em `12,9`, Poring em `14,9`;
- turno avançado para Poring;
- IA:
  - moveu Poring para `13,9` (5 pés);
  - rolou ataque contra CA 10;
  - errou o Guarda;
  - marcou `actionUsed = true`;
- encontro removido.

## 4. Limites

- IA não usa habilidades, itens ou alcance de arma;
- sem linha de visão/obstáculos;
- sem ledger `CombatAction` nesta versão (o ataque não aparece no Registro);
- não avança o turno sozinha;
- sem IA de aliados.

## 5. Próxima fase

- registrar ataque da IA no ledger;
- IA com alcance/movimento por caminho;
- habilidades e condições;
- IA de aliados;
- animação de ataque.
