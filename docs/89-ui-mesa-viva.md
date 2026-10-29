# UI da Mesa Viva — personagem sem modais genéricos

Status: **decisão de interface**.
Data: 29/10/2026.

## 1. Regra

A mesa imersiva não usa `Dialog` genérico nem aba lateral para ficha,
atributos, pontos, habilidades, loja ou Kafra.

O mundo 3D continua visível. As telas são **interfaces do jogo**, com
identidade Eldoria/Ragnarok, abertas por tecla ou hotbar.

## 2. Estrutura

### HUD permanente
Canto inferior:

- retrato do personagem;
- HP/SP;
- nível base/job;
- zeny;
- buffs ativos;
- hotbar de skills/itens;
- botão de personagem (`C`);
- botão de diário (`J`);
- botão do mestre (`M`), só mestre.

Canto superior:

- nome do mapa/cidade;
- hora/clima;
- minimapa;
- conexão.

### Tela de personagem (`C`)
Tela cheia, com o mundo desfocado ao fundo, não um modal central.

Layout:

```text
┌─────────────────────────────────────────────────────┐
│  PERSONAGEM        Nv 32 / Job 18        Zeny 12.400│
│  [modelo 3D do personagem]                          │
│                                                     │
│  ATRIBUTOS        HABILIDADES       EQUIPAMENTO     │
│  FOR 32 +       árvore de skills    slots 3D        │
│  AGI 45 +       pontos: 4           cartas/refino   │
│  VIT 28 +                                           │
│  INT 12 +       [aprender]                          │
│  DEX 30 +                                           │
│  LUK 18 +                                           │
│                                                     │
│  [Inventário] [Missões] [Títulos] [Reputação]       │
└─────────────────────────────────────────────────────┘
```

- modelo 3D do personagem com equipamento equipado;
- pontos distribuíveis com `+`;
- skills com pré-requisito, nível e custo;
- inventário em grade;
- missões com progresso;
- fecha com `Esc` e devolve o controle ao mundo.

### Loja / NPC
Ao se aproximar e apertar `E`:

- diálogo na parte inferior, com retrato do NPC;
- opções: Falar, Comprar, Vender, Sair;
- grade de itens no mesmo painel;
- zeny no topo;
- o NPC e o mundo continuam visíveis.

### Kafra
Painel de serviço, não modal de formulário:

- Teleporte (destinos desbloqueados);
- Armazém (grade);
- Save;
- Sair.

### Diário (`J`)
Tela de missões:

- ativas;
- concluídas;
- objetivos;
- recompensas;
- rastreamento no HUD.

### Mestre (`M`)
Overlay de mestre, separado da ficha do jogador:

- narração;
- criar/editar missão;
- dar item/zeny/EXP/buff;
- spawnar NPC/mob/boss;
- portais;
- roster.

## 3. Combate sem modal

O combate usa:

- hotbar 1–9;
- clique no alvo;
- anel de alcance;
- confirmação no próprio HUD;
- log lateral.

Não abrir `SpellDialog`/`WeaponAttackDialog` genéricos. A seleção de skill,
alvo e confirmação acontece na hotbar e no mundo.

## 4. Componentes

Criar componentes próprios:

```text
game/CharacterScreen
game/CharacterModelViewer
game/StatAllocator
game/SkillTree
game/EquipmentPaperDoll
game/InventoryGrid
game/QuestJournal
game/NpcDialogue
game/ShopPanel
game/KafraPanel
game/MasterOverlay
game/ActionBar
```

Não reutilizar `Dialog` do shadcn para essas telas.

## 5. Persistência e estado

- estado do personagem em store única;
- mudanças otimistas com confirmação do servidor;
- abrir/fechar tela não recria iframe nem perde posição;
- `Esc` fecha a tela e devolve o controle;
- teclado não vaza para o viewer quando a tela está aberta.

## 6. Critérios de aceite

1. `C` abre a ficha em tela cheia, não modal;
2. distribuir ponto atualiza o servidor;
3. aprender skill respeita pré-requisito/pontos;
4. inventário e equipamento funcionam sem sair do mundo;
5. `E` em NPC abre diálogo/loja/Kafra no mundo;
6. `J` abre diário;
7. `M` abre console do mestre;
8. fechar tudo com `Esc` mantém posição e cena;
9. nenhuma dessas telas usa `Dialog` genérico.

## 7. Ordem

1. HUD + hotbar + tela de personagem;
2. atributos/pontos;
3. skills/árvore;
4. equipamento/inventário;
5. NPC/loja/Kafra;
6. diário/missões;
7. overlay do mestre.

## 8. Limite

É mais trabalho que modais genéricos, mas é o único caminho para parecer um
jogo e não um painel web sobre o mapa.
