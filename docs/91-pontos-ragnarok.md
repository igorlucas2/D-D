# Pontos de Ragnarok na ficha

Status: **atributos e skills com pontos no servidor**.
Data: 29/10/2026.

## 1. Modelo

`RagnarokCharacter` ganhou:

- `statPoints`;
- `skillPoints`.

Migration: `20261029143000_ragnarok_points`.

Criação:

- nível 1: **15 pontos de atributo**, **1 de skill**;
- níveis acima: nível × 3 de atributo e nível de skill.

Subir de nível:

- +3 pontos de atributo por nível;
- +1 ponto de skill por nível.

## 2. API

```http
PATCH /api/ragnarok/characters/:id/stats
{ "stat": "strength", "amount": 1 }
```

Validações:

- atributo entre os seis;
- máximo 99;
- pontos suficientes;
- decremento atômico com `updateMany` para não ficar negativo.

Aprender skill:

```http
POST /api/ragnarok/characters/:id/skills
{ "skillId": 1, "level": 1 }
```

Agora cobra `skillPoints` pela diferença de nível e rejeita saldo insuficiente.

## 3. UI

Tela cheia de personagem:

- “Pontos disponíveis: N”;
- botão `+` em cada atributo Ragnarok;
- ficha atualiza após o servidor confirmar;
- badge de pontos de skill.

## 4. Teste

- ficha `Points UI`:
  - criada com **15 pontos** de atributo e **1** de skill;
  - `+` em FOR: **1 → 2**, pontos **15 → 14**;
  - skill `Habilidades Básicas`: skillPoints **1 → 0**;
  - ficha removida.

Screenshot: `frontend/test-results/character-points.png`.

## 5. Limites

- ainda não há navegador/árvore de skills na tela;
- pré-requisitos de skill não são validados;
- pontos não podem ser resetados;
- ficha SRD continua somente leitura;
- paper doll 2D, sem modelo 3D;
- sem vínculo explícito da ficha Ragnarok à campanha.

## 6. Próximo

1. árvore/busca de skills na tela;
2. pré-requisitos;
3. reset/redistribuição;
4. modelo 3D;
5. vínculo da ficha à campanha.
