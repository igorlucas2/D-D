# Visual local e escopo de Ragnarok completo

Status: **decisão de arquitetura**.
Data: 29/10/2026.

## 1. O que é “visual local”

É todo asset necessário para desenhar o jogo servido pelo **nosso** domínio,
sem depender de `assets.latam-tools.com.br` nem de
`visuais.latam-tools.com.br` em runtime.

### Camadas

| Camada | Conteúdo | Estado |
| --- | --- | --- |
| Mapa | `.gat/.gnd/.rsw/.rsm`, texturas, água | Prontera local pronta |
| Personagem | `.spr/.act/.pal`, cabelo, roupa, equipamento | a extrair |
| NPC | Kafra, lojas, carrinhos, guardas | sprites no GRF; a extrair |
| Itens | ícones, coleção, cartas | a extrair |
| Efeitos | `.str`, texturas, sons | a extrair |
| BGM | faixas por mapa | Prontera pronta |
| UI | ícones, fontes, cursores | parcial |

### Manifesto

```text
/assets/ragnarok/<versao>/
  maps/
  characters/
  npcs/
  items/
  effects/
  bgm/
  manifest.json
```

- same-origin;
- versionado;
- cache imutável por hash;
- fallback explícito quando falta um asset;
- sem CORS externo.

### Ficha

`appearance` deixa de ser uma URL remota e vira um **build local**:

```text
gender, hairStyle, hairColor, clothesColor, skinTone, equipment
```

A prévia é desenhada pelo nosso renderer de sprites/paletas. O GLB 3D é uma
camada posterior; “visual local” não significa GLB.

## 2. O que “Ragnarok completo” significa

Existem três níveis:

### A. Conteúdo completo
- 97 jobs;
- 1.732 skills;
- 14.397 itens;
- 965 mapas;
- NPCs, lojas, Kafra, portais, mobs, quests.

Isso é possível com dados do rAthena + assets do cliente.

### B. Comportamento completo
- classes e jobs;
- quests;
- comércio;
- refinamento/cartas;
- mascotes;
- progressão;
- campos e dungeons.

Possível, mas é um projeto de meses.

### C. Clone exato do cliente
- mesma engine;
- mesmos scripts;
- mesmas animações;
- mesmo timing;
- mesmo protocolo.

Não é o objetivo. O objetivo é um **RPG de navegador** com conteúdo e regras
Ragnarok, não um emulador do executable.

## 3. Dá para fazer no navegador?

Sim, com esta arquitetura:

```text
Next.js + WebGL       → mundo, personagens, mapas
NestJS + Prisma       → fichas, itens, quests, economia
Socket.IO             → posição, presença, combate
rAthena/GRF           → dados e assets
PostgreSQL/MySQL      → estado autoritativo
```

O navegador aguenta:

- mapas 3D com sprites;
- centenas de NPCs por cena;
- inventário e lojas;
- multiplayer;
- quests e progressão.

O que pesa é **conteúdo**, não a tecnologia.

## 4. Modais e configurações

Separar dois mundos:

### Jogo
- HUD;
- ficha em tela cheia;
- loja/Kafra no mundo;
- hotbar;
- diário.

Sem modal genérico para a ficha.

### Administração
- configurações da campanha;
- construtor de missões;
- dar item/zeny/EXP/buff;
- spawnar NPC/mob;
- portais;
- roster.

Aqui modais e páginas de configuração no navegador fazem sentido.

### Regra
Modal é para **administração e configuração**. A experiência do jogador é
mundo + HUD + telas de jogo.

## 5. Ordem de implementação

1. **Visual local do personagem** (sprites/paletas/cabelo/roupa).
2. **Criação de Aprendiz** + atributos derivados.
3. **Equipamento/paper doll + inventário**.
4. **Kafra/lojas** em Prontera.
5. **Mobs e combate livre** em `prt_fild01`.
6. **Job level + missão de classe**.
7. **Quests do mestre**.
8. **Mais cidades/campos**.
9. **Mascotes**.
10. **GLB 3D** (fase de arte).

## 6. Recomendação

Não começar por “todos os mapas e todas as quests”. Começar por:

```text
Aprendiz + aparência local
→ Prontera com Kafra/loja
→ prt_fild01 com Poring
→ job level 10 + missão de classe
→ primeira classe
```

Isso prova todas as camadas:

- visual local;
- ficha;
- economia;
- NPC;
- combate;
- progressão;
- quest.

Depois o conteúdo cresce por cidade/classe/quest.

## 7. Decisões pendentes

1. prévia do personagem: sprite 2D agora ou aguardar GLB?
2. missão de classe: script próprio ou importar do rAthena?
3. modais de administração: página separada ou overlay do mestre?
4. primeira classe após Aprendiz: Espadachim, Mago ou Arqueiro?
