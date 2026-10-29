# SPEC — Ragnarok cooperativo no navegador

Status: **especificação de produto e arquitetura**.
Data: 29/10/2026.
Decisão: implementar o conteúdo e as mecânicas de Ragnarok em um RPG cooperativo
de navegador, com mundo persistente por campanha. Sem combate por turnos nesta
fase. O mestre administra por um painel web separado.

## 0. Resumo executivo

O jogo será:

- **um mundo Ragnarok persistente por campanha**;
- **cooperativo**: os jogadores da mesa são personagens vinculados ao mesmo
  mundo;
- **autoritativo no servidor**: posição, dano, drops, lojas, quests e progressão
  são validados no backend;
- **com assets locais**: mapas, personagens, NPCs, itens, efeitos e BGM servidos
  pelo nosso domínio;
- **com a ficha como núcleo**: aparência, atributos, modificadores, classe,
  skills, equipamento, inventário, mascotes e jornada;
- **com o painel do mestre no navegador**: grants, spawns, quests, portais,
  eventos e auditoria.

O cliente original não será clonado. O objetivo é um RPG web com conteúdo e
regras Ragnarok, não um emulador do executable.

## 1. Objetivos

### G1 — Conteúdo
Importar e disponibilizar:

- 97 jobs;
- 1.732 skills;
- 14.397 itens;
- 965 mapas;
- NPCs, lojas, Kafra, portais, spawns, mobs e quests.

### G2 — Mundo cooperativo
Jogadores da mesma campanha:

- entram no mesmo mapa;
- veem uns aos outros;
- compartilham canais, festa e eventos;
- mantêm posição e estado no servidor;
- podem ser movidos/administrados pelo mestre.

### G3 — Ficha completa
A ficha é a interface central:

- identidade visual;
- atributos e composição de modificadores;
- classe/job;
- skills;
- equipamento e paper doll;
- inventário;
- mascotes;
- missões.

### G4 — Master separado
O mestre não depende do viewer para administrar. Ele usa um **painel web** com
modais, tabelas e formulários.

### G5 — Visual local
Nenhum asset crítico depende de CDN externa em runtime.

## 2. Não objetivos

- clone exato do cliente oficial;
- mesmo protocolo do servidor original;
- combate por turnos nesta fase;
- PvP no lançamento;
- economia entre servidores;
- mobile-first;
- GLB 3D no primeiro recorte;
- execução literal dos scripts rAthena no navegador.

## 3. Modo de jogo

### 3.1 Campanha = mundo
Cada campanha possui:

- um mundo;
- um conjunto de mapas instanciados;
- jogadores vinculados;
- mestre;
- estado persistente.

Não existe “mesa narrada” separada do mundo no modo Ragnarok. A crônica do
mestre é uma camada de narração sobre o mundo.

### 3.2 Jogadores
Cada jogador:

- tem uma ficha Ragnarok;
- tem um `WorldActor` no mapa;
- entra/sai sem derrubar o mundo;
- mantém posição, HP/SP, inventário, quests e zeny.

### 3.3 Mestre
O mestre:

- observa o mundo;
- narra;
- cria/edita quests;
- concede itens/zeny/EXP/buff;
- spawna NPCs/mobs;
- abre portais;
- gerencia jogadores;
- audita ações.

O mestre pode ter um avatar observador, mas não precisa participar do combate.

### 3.4 Sessão
Fluxo:

1. login;
2. selecionar campanha;
3. criar/escolher Aprendiz;
4. entrar no mundo;
5. jogar cooperativamente;
6. mestre administra pelo painel.

## 4. Arquitetura

```text
Browser
  Next.js + WebGL
  HUD + ficha + janelas de jogo
  painel do mestre
        │
        │ HTTPS / Socket.IO
        ▼
NestJS
  auth, campanhas, mundo, atores
  inventário, lojas, quests
  combate autoritativo
  admin/auditoria
        │
        ▼
MySQL + Prisma
  catálogo Ragnarok
  fichas, inventário, quests
  instâncias, atores, logs
        │
        ▼
Storage local
  mapas, sprites, ícones, efeitos, BGM
```

### 4.1 Autoridade
O cliente envia **intenção**:

- mover para;
- usar skill;
- atacar alvo;
- comprar item;
- falar com NPC;
- aceitar quest.

O servidor valida e aplica. O cliente nunca calcula dano, drop, EXP ou preço.

### 4.2 Tick
- servidor: 10 Hz para movimento/combate;
- IA de mob: 2–5 Hz;
- cliente: 60 fps com interpolação;
- cast/cooldown em milissegundos no servidor.

### 4.3 Sessão
- Socket.IO namespace `/ragnarok`;
- salas por campanha, mapa e instância;
- presença, chat, posição, ações e eventos.

## 5. Mundo e mapas

### 5.1 Coordenadas
- grid de células;
- posição `x/y` em células;
- colisão do `.gat`;
- altura do `.gnd`;
- direção `0–7`;
- raio de interação;
- velocidade em células/segundo.

### 5.2 Catálogo de mapas
Cada mapa:

```text
id, nome, slug, arquivo, largura, altura
spawnX, spawnY, tipo (cidade/campo/dungeon)
flags (PvP, teleporte, save, montaria)
```

Assets:

```text
maps/<slug>/
  map.gat
  map.gnd
  map.rsw
  models/
  textures/
  minimap.png
```

### 5.3 Instâncias
- uma instância por campanha/mapa/canal;
- dungeon pode ser instância privada;
- limite de jogadores por canal;
- criação lazy;
- limpeza por inatividade.

### 5.4 Portais
Tipos:

- passagem de mapa;
- warp NPC;
- Kafra;
- portal de dungeon;
- portal de evento.

Modelo:

```text
RagnarokWarp
  id
  fromMapId, x, y, radius
  toMapId, toX, toY
  trigger (walk/talk/script)
  requirement (quest, level, item)
```

Fluxo:

1. jogador entra no raio;
2. servidor valida requisito;
3. troca de instância/mapa;
4. posiciona no destino;
5. salva última posição.

### 5.5 Save/respawn
- save point por personagem;
- Kafra define save;
- morte retorna ao save;
- posição persistida no `WorldActor`.

### 5.6 NPCs e spawns
NPCs vindos de dados:

- loja;
- Kafra;
- quest;
- warp;
- heal;
- script;
- decoração.

Mobs:

- spawn por mapa;
- quantidade;
- raio;
- respawn;
- nível;
- drops;
- EXP.

## 6. Atores do mundo

```text
RagnarokActor
  id
  instanceId
  kind (PLAYER/NPC/MOB/PET)
  characterId?
  npcId?
  mobId?
  x, y, dir
  hp, sp
  state (idle/move/cast/attack/dead)
  visible
  updatedAt
```

- jogador = ator + ficha;
- NPC = ator + definição;
- mob = ator + definição;
- pet = ator + mascote;
- posição nunca fica só no cliente.

### 6.1 Movimento
- cliente clica no destino;
- servidor calcula rota no grid;
- valida colisão/velocidade;
- broadcast de posição;
- correção se inválido.

### 6.2 Visão
- câmera isométrica/3D;
- jogador sempre visível;
- outros atores por sala;
- animação de caminhada;
- nome/guilda/festa.

## 7. Personagem

### 7.1 Criação
Começa como **Aprendiz**:

- nível base 1;
- job level 1;
- stats iniciais;
- 15 pontos de atributo;
- 1 ponto de skill;
- aparência;
- nome;
- gênero.

### 7.2 Aparência
Campos persistidos:

```text
gender
hairStyle
hairColor
clothesColor
skinTone
appearanceBuild
```

A prévia usa o renderer local de sprites/paletas.

### 7.3 Atributos
Base:

- STR, AGI, VIT, INT, DEX, LUK.

Derivados:

- ATK, MATK;
- DEF, MDEF;
- HIT, FLEE;
- CRIT;
- ASPD;
- HP/SP máximos;
- peso;
- resistências.

A ficha mostra composição:

```text
ATK = base + arma + refino + cartas + buff
```

### 7.4 Nível
Separar:

- base level;
- job level;
- base EXP;
- job EXP.

Level-up:

- +3 stat points;
- +1 skill point;
- HP/SP recalculados.

### 7.5 Skills
- árvore por classe;
- pré-requisitos;
- custo;
- nível máximo;
- cast time;
- cooldown;
- SP;
- alcance;
- alvo.

### 7.6 Equipamento
Slots:

- topo, meio, baixo;
- armadura;
- arma;
- escudo;
- capa;
- sapatos;
- acessório 1/2;
- traje;
- mascote/montaria.

Cada item:

- refino;
- cartas;
- bônus;
- peso;
- restrição.

### 7.7 Inventário
- grade;
- quantidade;
- peso;
- categoria;
- zeny;
- equipar/consumir/descartar.

### 7.8 Mascotes
- ovo;
- nome;
- intimidade;
- nível;
- segue;
- bônus.

## 8. Itens e economia

### 8.1 Catálogo
Importar 14.397 itens com:

- nome;
- descrição;
- tipo;
- slot;
- peso;
- preço;
- nível;
- classe;
- bônus;
- sprite/ícone;
- flags.

### 8.2 Tipos
- consumível;
- arma;
- armadura;
- escudo;
- capa;
- sapatos;
- acessório;
- carta;
- etc.

### 8.3 Drops
- por mob;
- chance;
- quantidade;
- loot rights;
- log.

### 8.4 Loot no chão

Todo drop nasce como um **objeto físico no mapa**:

```text
RagnarokGroundDrop
  id, instanceId, itemId, quantity
  x, y, droppedAt, expiresAt
  ownerCharacterId, ownerPartyId
  protectionUntil, state
```

O cliente desenha o ícone/nome no chão. O jogador clica para pegar; o servidor
valida distância, dono, prazo e espaço no inventário.

**FFA (free-for-all)**
- qualquer jogador pode pegar imediatamente;
- o crédito de EXP/quest continua com quem matou ou com a festa;
- simples, mas sujeito a “ninja loot”.

**Killer**
- o drop pertence a quem matou;
- se quem matou está em festa, o dono é a **festa**;
- membros da festa podem pegar;
- proteção curta, por exemplo **45 segundos**;
- depois da proteção, abre para FFA;
- se o dono estiver longe/morto, o item continua no chão até expirar.

**Festa (party)**
- o drop pertence à festa;
- raros usam need/greed/rodízio;
- comuns podem ser pegos por qualquer membro;
- exige UI de distribuição.

**Padrão recomendado: Killer cooperativo.**
O item cai no chão, quem matou tem prioridade curta e a festa pode pegar; depois
abre para FFA. Isso preserva o loot físico do Ragnarok e evita ninja loot
imediato.

Itens de quest são pessoais/automáticos para os elegíveis e não entram no
leilão da festa.

O mestre configura o modo e a janela de proteção no painel.

Itens de quest são sempre pessoais/automáticos para os elegíveis, mesmo em FFA
ou Killer.

### 8.5 Lojas
- NPC loja;
- catálogo;
- preço de compra/venda;
- estoque;
- zeny;
- transação atômica.

### 8.6 Kafra
- save;
- teleporte;
- armazém;
- serviços.

### 8.7 Refino/cartas
Fase posterior:

- refino;
- cartas;
- slots;
- bônus.

## 9. Combate e mecânicas

### 9.1 Tempo real
Sem turnos nesta fase.

- clique para alvo;
- hotbar para skill;
- cast;
- cooldown;
- animação;
- dano no servidor.

### 9.2 Fórmulas
Fonte: rAthena Renewal, versionada.

- ATK físico/mágico;
- DEF/MDEF;
- HIT/FLEE;
- CRIT;
- ASPD;
- cast;
- elemento;
- tamanho;
- raça.

As fórmulas ficam em um módulo `ragnarok-formulas` com testes.

### 9.3 Elementos
- neutro;
- água;
- terra;
- fogo;
- vento;
- veneno;
- sagrado;
- sombrio;
- fantasma;
- maldito.

Tabela versionada.

### 9.4 Status
- stun;
- freeze;
- petrify;
- poison;
- silence;
- bleed;
- slow;
- buffs/debuffs.

### 9.5 IA
- aggro;
- leash;
- chase;
- attack;
- skill;
- flee;
- respawn.

### 9.6 Morte
- HP 0;
- morte;
- respawn no save;
- penalidade configurável;
- EXP/drop.

### 9.7 Festa
- EXP compartilhada;
- loot;
- crédito de quest;
- revive.

## 10. Quests e classes

### 10.1 Quest engine
Tipos:

- matar;
- coletar;
- falar;
- visitar;
- escoltar;
- usar item;
- classe.

Modelo:

```text
RagnarokQuest
RagnarokQuestObjective
RagnarokQuestReward
RagnarokQuestProgress
```

### 10.2 Progresso
- por personagem;
- por etapa;
- por objetivo;
- crédito de festa configurável;
- persistente.

### 10.3 Classe

- todo personagem começa como **Aprendiz**;
- **quem concede a classe é o mestre**, pelo painel;
- o jogador não troca de classe sozinho;
- o mestre pode exigir job level 10 e/ou uma missão antes de conceder;
- a concessão é auditada;
- ao conceder:
  - troca o job;
  - libera a árvore da classe;
  - mantém nível base e job level;
  - ajusta stats/skills permitidos;
  - registra a jornada;
- segunda classe depois, também pelo mestre.

### 10.4 Quests do mestre
O mestre cria:

- título;
- descrição;
- objetivos;
- recompensas;
- pré-requisitos;
- NPC;
- prazo;
- visibilidade.

## 11. UI/UX

### 11.1 Mundo
HUD:

- HP/SP;
- nível/job;
- zeny;
- hotbar;
- quest tracker;
- minimapa;
- chat;
- festa.

### 11.2 Ficha
Tela cheia:

- paper doll;
- atributos e composição;
- skills;
- equipamento;
- inventário;
- mascotes;
- jornada;
- missões.

### 11.3 Janelas

Janelas de jogo:

- inventário;
- equipamento;
- loja;
- Kafra;
- baú;
- quest.

**Decisão:** nossa UI por padrão, no estilo Ragnarok. Se uma janela custar
muito, usar uma janela **inspirada no original** como fallback visual. Nunca
usar `Dialog` genérico para ficha/loja/skill.

Prioridade:

1. HUD e ficha: nossa UI;
2. inventário/equipamento: nossa UI;
3. loja/Kafra: nossa UI;
4. baú/quest: nossa UI;
5. fallback inspirado no original apenas onde o custo for desproporcional.

### 11.4 Painel do mestre
Página separada:

```text
/campaigns/:id/admin
```

Com modais e formulários.

### 11.5 Atalhos
- `C` ficha;
- `I` inventário;
- `K` skills;
- `J` diário;
- `M` mapa;
- `E` interagir;
- `Enter` chat;
- `Esc` fechar.

## 12. Painel do mestre

### 12.1 Jogadores
- roster;
- ficha;
- posição;
- online;
- kick;
- revive;
- teleportar.

### 12.2 Grants
- item;
- zeny;
- EXP base;
- job EXP;
- buff;
- nível;
- **classe** (Aprendiz → primeira classe).

### 12.3 Configuração de rates

Aba **Configurações → Rates** no painel do mestre.

Campos:

- Base EXP;
- Job EXP;
- Drop;
- Zeny.

Padrão: **5x** em todos.

Regras:

- somente mestre;
- inteiro de 1 a 100;
- aplica-se a ganhos futuros;
- não retroativo;
- persistido por campanha;
- auditado;
- pode ser alterado sem reiniciar o mundo.

### 12.4 Mundo
- spawnar NPC;
- spawnar mob;
- spawnar chefe;
- abrir portal;
- mudar clima/hora;
- anunciar.

### 12.5 Quests
- criar;
- editar;
- atribuir;
- concluir;
- recompensar.

### 12.6 Economia
- lojas;
- preços;
- drop rates;
- eventos.

### 12.7 Auditoria
Toda ação:

```text
actor, action, target, payload, timestamp, requestId
```

## 13. Modelo de dados

### 13.1 Existentes
- `RagnarokJob`;
- `RagnarokSkill`;
- `RagnarokItem`;
- `RagnarokMap`;
- `RagnarokCharacter`;
- `RagnarokCharacterSkill`;
- `RagnarokCharacterItem`;
- `CampaignRagnarokCharacter`.

### 13.2 Novos/evoluídos
- `RagnarokCharacter` + `jobLevel`, `jobExp`, `zeny`, aparência;
- `RagnarokWorldInstance`;
- `RagnarokActor`;
- `RagnarokNpc`;
- `RagnarokShop`;
- `RagnarokShopItem`;
- `RagnarokWarp`;
- `RagnarokMob`;
- `RagnarokSpawn`;
- `RagnarokInventory`;
- `RagnarokEquipment`;
- `RagnarokQuest`;
- `RagnarokQuestObjective`;
- `RagnarokQuestProgress`;
- `RagnarokPet`;
- `RagnarokCombatLog`;
- `RagnarokAdminAudit`;
- `RagnarokGroundDrop` (item no chão, dono, proteção, expiração);
- `RagnarokCampaignConfig` (rates, loot mode, loot protection, level cap);
- `RagnarokClassGrant` (quem concedeu, classe, quando).

## 14. APIs e sockets

### 14.1 REST
```text
GET  /campaigns/:id/world
GET  /campaigns/:id/world/:mapId/actors
POST /campaigns/:id/world/join
POST /campaigns/:id/world/leave
GET  /characters/:id/sheet
PATCH /characters/:id/stats
POST /characters/:id/skills
GET  /characters/:id/inventory
POST /characters/:id/inventory/use
POST /characters/:id/equipment
GET  /characters/:id/quests
POST /campaigns/:id/world/drops/:dropId/pickup
POST /campaigns/:id/shops/:shopId/buy
POST /campaigns/:id/shops/:shopId/sell
POST /campaigns/:id/kafra/teleport
POST /campaigns/:id/kafra/storage
GET  /campaigns/:id/admin/config
PATCH /campaigns/:id/admin/config
POST /campaigns/:id/admin/class-grant
POST /campaigns/:id/admin/...
```

### 14.2 Socket
```text
world:join
world:leave
actor:move
actor:stop
drop:spawn
drop:pickup
drop:expire
actor:attack
actor:skill
npc:interact
shop:open
chat:say
party:update
combat:event
```

### 14.3 Sequência
1. cliente entra na sala;
2. servidor envia snapshot;
3. cliente prediz movimento;
4. servidor corrige;
5. ações passam pelo servidor;
6. eventos são broadcast.

## 15. Assets locais

### 15.1 Pipeline
1. extrair do GRF;
2. validar;
3. gerar manifest;
4. subir para storage;
5. servir same-origin;
6. versionar.

### 15.2 Manifest
```json
{
  "version": "2026-10-29",
  "maps": {},
  "characters": {},
  "npcs": {},
  "items": {},
  "effects": {},
  "bgm": {}
}
```

### 15.3 Validação
- todo asset referenciado existe;
- todo mapa tem colisão;
- todo NPC tem sprite;
- todo item tem ícone;
- fallback explícito.

### 15.4 Licença
Assets oficiais pertencem à Gravity. Uso local/privado; não commitar GRF nem
assets extraídos. rAthena é referência de dados; scripts não serão copiados
literalmente.

## 16. Importação de conteúdo

### 16.1 Fontes
- rAthena;
- GRF do cliente;
- arquivos locais do projeto.

### 16.2 ETL
- jobs;
- skills;
- itens;
- mapas;
- NPCs;
- lojas;
- warps;
- spawns;
- mobs;
- quests.

### 16.3 Validação
- IDs únicos;
- referências válidas;
- contagens;
- mapas abrem;
- NPCs têm posição;
- lojas têm itens;
- warps têm destino;
- spawns têm mob.

### 16.4 Cobertura
- 97 jobs;
- 1.732 skills;
- 14.397 itens;
- 965 mapas.

Quests têm cobertura medida; não prometer 100% no primeiro ciclo.

## 17. Segurança e operação

- JWT;
- roles;
- membership;
- master-only admin;
- rate limit;
- validação de movimento;
- validação de cooldown;
- validação de item/zeny;
- logs;
- backup;
- métricas;
- erros.

## 18. Milestones

### M0 — Fundação
- schema;
- assets locais;
- importação;
- manifesto;
- testes.

Aceite: catálogo e mapas válidos.

### M1 — Aprendiz e visual
- criação;
- aparência;
- prévia local;
- stats;
- ficha.

Aceite: criar Aprendiz com cabelo/cor/roupa/pele.

### M2 — Mundo
- ator;
- mapa;
- movimento;
- câmera;
- portal;
- Prontera ↔ campo.

Aceite: dois jogadores se veem e atravessam portal.

### M3 — Itens
- inventário;
- equipamento;
- paper doll;
- peso;
- zeny.

Aceite: equipar arma e ver bônus.

### M4 — NPC/economia
- loja;
- Kafra;
- save;
- teleporte;
- armazém.

Aceite: comprar poção e teleportar.

### M5 — Combate
- mob;
- dano;
- skill;
- drop;
- EXP;
- respawn.

Aceite: matar Poring, o loot cair no chão, o killer/festa pegar primeiro e outro jogador só pegar após a proteção.

### M6 — Quests/classe
- engine;
- Aprendiz;
- job level 10;
- missão;
- primeira classe;
- skill tree.

Aceite: receber a classe concedida pelo mestre.

### M7 — Mestre
- painel;
- grants;
- spawn;
- quest builder;
- auditoria.

Aceite: mestre dá item/zeny/EXP, spawna mob, configura rates e concede classe.

### M8 — Conteúdo
- mais cidades;
- campos;
- classes;
- quests;
- mapas.

### M9 — Profundidade
- mascotes;
- refino;
- cartas;
- PvP/trade.

## 19. Critérios de aceite globais

1. criar Aprendiz;
2. escolher aparência;
3. entrar no mundo;
4. ver outro jogador;
5. atravessar portal;
6. comprar item;
7. usar Kafra;
8. matar mob;
9. receber EXP/drop;
10. distribuir pontos;
11. aprender skill;
12. concluir quest;
13. receber classe do mestre;
14. mestre conceder item/zeny/EXP/classe;
15. mestre criar quest, configurar rates e modo de loot;
16. tudo persiste após reload;
17. servidor autoritativo.

## 20. Riscos

- escopo de 965 mapas;
- assets oficiais e licença;
- scripts rAthena não são executáveis diretamente;
- performance de sprites/composição;
- sincronização de combate;
- tamanho do banco;
- compatibilidade com a mesa 5e;
- UI custom vs original;
- conteúdo de quests incompleto.

## 21. Decisões fechadas

1. Todo personagem começa como **Aprendiz**.
2. **Quem concede a classe é o mestre**, pelo painel.
3. Rates configuráveis na aba do mestre; **5x** por padrão.
4. Loot padrão: **Killer cooperativo** (cai no chão, killer/festa tem prioridade curta, depois FFA).
5. Janelas: **nossa UI por padrão**, com fallback inspirado no original apenas
   quando o custo for desproporcional.

## 22. Decisões abertas

1. level cap;
2. canais por mapa;
3. PvP;
4. trade entre jogadores;
5. fonte das quests;
6. sprite 2D agora ou GLB;
7. mestre com avatar ou observador.

## 23. Recomendação

Primeiro recorte:

```text
Aprendiz + aparência local
→ Prontera com Kafra/loja
→ portal para prt_fild01
→ Poring com combate tempo real
→ job level 10
→ mestre concede a classe (missão opcional)
→ primeira classe
```

Isso prova todas as camadas sem tentar implementar 965 mapas de uma vez. Depois
o conteúdo cresce por cidade, campo, classe e quest.

## 24. Relação com o que já existe

- ficha em tela cheia: aproveitar;
- pontos/skills: aproveitar;
- vínculo com campanha: aproveitar;
- Prontera local: aproveitar;
- catálogo Ragnarok: aproveitar;
- combate 5e: **não** usar para Ragnarok;
- token SRD: **não** é o ator Ragnarok;
- `VttToken`: bridge temporária, não modelo final do mundo Ragnarok.

## 25. Definição de pronto

A spec só está concluída quando:

- um jogador cria Aprendiz;
- entra em Prontera;
- vê outro jogador;
- compra item;
- usa Kafra;
- atravessa portal;
- mata Poring;
- recebe EXP/drop;
- completa a missão de classe;
- vira primeira classe;
- o mestre administra tudo pelo painel;
- o estado sobrevive a reload;
- nenhum cálculo crítico acontece no cliente.
