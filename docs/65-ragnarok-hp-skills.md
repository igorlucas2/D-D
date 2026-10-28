# HP/SP e skills na ficha Ragnarok

Status: **ficha Ragnarok jogável em nível básico**.
Última atualização: 28/10/2026.

## 1. HP/SP derivados

Fórmulas iniciais de estudo:

```text
maxHp = 40 + level*10 + VIT*5
maxSp = 10 + level*2 + INT*3
currentHp/currentSp = máximo ao criar
```

Ao subir nível/VIT/INT:

- máximos são recalculados;
- atuais são limitados ao novo máximo.

Exemplo: nível 10, VIT 10 → **190 HP**; INT 1 → **33 SP**.

## 2. Skills aprendidas

Novo modelo `RagnarokCharacterSkill`:

- `characterId` + `skillId` únicos;
- `level` limitado ao `maxLevel` da skill;
- cascade ao remover ficha/skill.

API:

- `POST /api/ragnarok/characters/:id/skills`
- `DELETE /api/ragnarok/characters/:id/skills/:skillId`

## 3. UI

`/library/ragnarok/characters`:

- barras de HP e SP;
- formulário **Aprender skill**:
  - escolher ficha;
  - buscar entre 1.732 skills;
  - escolher skill e nível;
  - aprender;
- skills aparecem como badges com botão de remover.

Teste:

- ficha `Teste Skills`, Aprendiz, nível 10, VIT 10;
- HP 190/190, SP 33/33;
- busca “Perícia” retornou 21 opções;
- **Perícia com Espada Nv 1** aprendida e exibida;
- ficha removida; banco voltou a 0 fichas/0 skills.

Screenshot: `frontend/test-results/ragnarok-hp-skills.png`.

## 4. Limites

- fórmulas não são as oficiais do Ragnarok;
- sem bônus de classe/equipamento;
- sem árvore de pré-requisitos;
- skill não tem efeito em combate;
- ainda não entra na mesa 5e nem no avatar 3D.

## 5. Próxima fase

- stats oficiais por classe;
- pré-requisitos e árvore;
- equipamento RO;
- usar o visual na mesa imersiva;
- efeitos de skill.
