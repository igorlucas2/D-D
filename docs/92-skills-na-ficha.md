# Busca e aprendizado de skills na ficha

Status: **skills aprendidas dentro da tela cheia**.
Data: 29/10/2026.

## 1. UI

Na seção **Habilidades**:

- skills aprendidas com nível atual/máximo;
- badge de pontos de skill;
- busca no catálogo (2+ letras);
- primeiras 20 skills quando a busca está vazia;
- botão **Aprender** em cada resultado.

Regras do botão:

- desabilitado sem pontos;
- desabilitado se skill já está no máximo;
- desabilitado durante a requisição.

Não é modal: a busca e a lista vivem dentro da tela de personagem.

## 2. Servidor

Usa o endpoint existente:

```http
POST /api/ragnarok/characters/:id/skills
{ "skillId": 1, "level": 1 }
```

O serviço:

- calcula o custo pela diferença de nível;
- rejeita se `skillPoints` for insuficiente;
- grava a skill e desconta os pontos em transação.

## 3. Teste

Ficha `Skill UI`:

- criada com **1** ponto de skill;
- busca inicial retornou **20** skills;
- `Habilidades Básicas` 0/9;
- “Aprender” → **1/9**;
- pontos **1 → 0**;
- ficha removida.

Screenshot: `frontend/test-results/skill-learn.png`.

## 4. Limites

- pré-requisitos ainda não são validados;
- não há árvore visual por classe;
- nível de skill sobe 1 por clique;
- sem reset/redistribuição;
- skill não é usada em combate ainda.

## 5. Próximo

1. pré-requisitos por skill;
2. árvore por classe/job;
3. reset;
4. skill na hotbar/combate;
5. modelo 3D do personagem.
