# Ficha Ragnarok como núcleo do jogo

Status: **decisão de produto/arquitetura**.
Data: 29/10/2026.

## 1. Princípio

A ficha não é uma aba nem um modal de status. É o **hub do personagem**, aberta
em tela cheia, com o mundo ao fundo.

Ela concentra:

- identidade visual;
- atributos e modificadores;
- classe/job e progressão;
- habilidades;
- equipamento e paper doll;
- inventário;
- mascotes;
- missões e jornada.

## 2. Identidade visual

Criação/edição:

- gênero;
- corte de cabelo;
- cor do cabelo;
- cor da roupa;
- tom de pele;
- nome.

Persistência:

```text
RagnarokCharacter.appearance   // build code/URL do visual
RagnarokCharacter.gender
RagnarokCharacter.hairStyle
RagnarokCharacter.hairColor
RagnarokCharacter.clothesColor
RagnarokCharacter.skinTone
```

A prévia usa o visual Ragnarok local. O modelo GLB entra depois; a ficha não
pode depender de um viewer externo.

## 3. Atributos e modificadores

Base:

- STR, AGI, VIT, INT, DEX, LUK.

Derivados:

- ATK, MATK;
- DEF, MDEF;
- HIT, FLEE;
- CRIT;
- ASPD;
- HP máximo, SP máximo;
- peso;
- resistências/elemento.

A ficha mostra a composição:

```text
ATK 128 = base 82 + arma 32 + refinamento 4 + buff 10
```

Não é só um número: o jogador vê de onde veio.

Pontos:

- `statPoints` distribuíveis;
- `skillPoints`;
- level base e **job level** separados;
- reset/redistribuição como serviço.

## 4. Classe e jornada

Começa como **Aprendiz**:

- nível base 1;
- job level 1;
- skills básicas;
- sem classe avançada.

Progressão:

1. job level 10;
2. o mestre concede a classe pelo painel;
3. missão de classe é opcional/narrativa;
4. nova árvore de skills;
5. segunda classe no futuro.

Precisa de:

```text
RagnarokCharacter.jobLevel
RagnarokCharacter.jobExp
RagnarokCharacter.classChangedAt
RagnarokJobChangeQuest
RagnarokSkillPrerequisite
```

A ficha mostra a jornada:

```text
Aprendiz → Espadachim → Cavaleiro
```

## 5. Equipamento e paper doll

Slots:

- topo;
- meio;
- baixo;
- armadura;
- arma;
- escudo;
- capa;
- sapatos;
- acessório 1;
- acessório 2;
- traje/costume;
- mascote/montaria.

Cada item mostra:

- nome;
- refino;
- cartas;
- bônus;
- peso;
- restrição de classe/nível.

O paper doll reflete o equipamento equipado.

## 6. Inventário

Grade com:

- quantidade;
- peso;
- categoria;
- equipável/consumível;
- refino/cartas;
- zeny.

O inventário não é a mesma tabela do equipamento: equipar move/flag o item, não
duplica.

## 7. Mascotes

Modelo:

```text
RagnarokPet
  characterId, eggItemId, name, intimacy, level, following
```

A ficha mostra:

- mascote ativa;
- intimidade;
- nível;
- bônus/serviço;
- visual no mundo.

## 8. Missões e classe

A ficha tem a jornada e as missões:

- missão de classe;
- pré-requisitos;
- recompensa;
- progresso;
- diário.

A missão de classe é um **NPC no mundo**, não um menu.

## 9. Layout

Tela cheia, sem modal:

```text
[paper doll]   [Atributos] [Habilidades] [Equipamento]
               [Inventário] [Mascotes] [Jornada] [Missões]
```

Cabeçalho:

- nome;
- classe;
- nível base/job;
- zeny;
- pontos.

O mundo continua atrás; `Esc` fecha e devolve o controle.

## 10. O que já existe

- ficha em tela cheia;
- pontos de atributo e skill;
- busca/aprendizado de skill;
- vínculo com campanha;
- catálogo Ragnarok;
- assets locais de Prontera;
- sprites/mapas Ragnarok.

## 11. O que falta

- campos de aparência estruturados;
- editor de cabelo/cor/roupa/pele;
- job level e job exp;
- classe inicial Aprendiz e missão de classe;
- derived stats com composição;
- paper doll com slots reais;
- inventário com peso/refino/cartas;
- mascotes;
- visual Ragnarok na prévia;
- GLB 3D.

## 12. Ordem recomendada

1. criação Aprendiz + aparência;
2. atributos derivados com composição;
3. equipamento/paper doll;
4. inventário/peso/zeny;
5. job level + missão de classe;
6. mascotes;
7. skill tree/pré-requisitos;
8. GLB 3D.

## 13. Critérios de aceite

1. criar Aprendiz com cabelo/cor/roupa/pele;
2. ver prévia persistida;
3. distribuir pontos e ver o derivado mudar;
4. ver de onde vem cada modificador;
5. equipar itens e ver o paper doll;
6. ver inventário/peso/zeny;
7. chegar a job level 10;
8. job level 10;
9. receber a classe do mestre;
10. ver mascote e missões na ficha;
11. nada disso abre modal genérico.
