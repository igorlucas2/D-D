# Rodada automática da IA

Status: **resolve vários inimigos seguidos**.
Última atualização: 28/10/2026.

## 1. Endpoint

```http
POST /api/campaigns/:id/combat/ai-round
```

Somente mestre.

Fluxo:

1. verifica o participante atual;
2. se for inimigo, chama o turno da IA;
3. avança o turno;
4. repete enquanto o novo turno também for de inimigo;
5. para no primeiro aliado;
6. retorna o encontro atualizado.

Limite de segurança: **8 turnos**.

O endpoint de turno individual (`/ai-turn`) continua disponível.

## 2. HUD

O botão do mestre agora é:

```text
Rodada da IA
```

Ele resolve todos os inimigos consecutivos de uma vez.

## 3. Teste

Encontro `Rodada IA`:

- Guarda iniciativa 20;
- Poring A iniciativa 15;
- Poring B iniciativa 10;
- turno antes: **Poring A**;
- `ai-round`:
  - resolveu Poring A;
  - avançou;
  - resolveu Poring B;
  - parou no Guarda;
- Guarda caiu de 40 para **29 PV**;
- encontro e ações de teste removidos.

## 4. Limites

- IA ainda não usa caminho/obstáculos;
- ataques sem arma/habilidade;
- sem linha de visão;
- sem IA de aliados;
- log depende do `CombatAction` criado pelo turno individual.

## 5. Próxima fase

- IA com pathfinding;
- habilidades;
- IA aliada;
- auto-turno por evento;
- animação de ataque.
