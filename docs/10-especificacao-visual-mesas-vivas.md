# Especificação visual — Eldoria, mesas vivas

Status: identidade visual e segunda etapa da organização da mesa implementadas. O workspace de sessão já possui painéis recolhíveis, ferramentas adaptáveis e zoom 2D; presença, chat e revelações continuam no plano funcional. Complementa o [plano funcional de mesas vivas](./09-melhorias-mesas-vivas.md). As capturas fornecidas pelo usuário orientam a **densidade e a organização** de um VTT: mapa dominante, ferramentas rápidas, elenco, combate e conversa acessíveis sem sair da sessão. Não copiar logotipo, ilustrações, ícones, molduras, disposição pixel a pixel ou outros assets de terceiros.

## Direção de arte e princípio de uso

**Uma taverna de campanha, não um painel corporativo.** Superfícies escuras de carvão e couro deixam mapas e retratos protagonizarem. Bronze marca ações e seleção; vinho marca perigo/combate; musgo marca exploração e estados positivos. Pergaminho é reservado para leitura longa, fichas e revelações — não como fundo de toda a mesa. A ornamentação medieval deve ser discreta e funcional: filetes, brasões abstratos, textura leve e títulos cerimoniais. Em combate, legibilidade e velocidade vencem decoração.

Três princípios para decisões futuras:

1. **O mapa é o palco.** Na sessão, deve ocupar a maior área contínua; controles aparecem nas bordas e não o cobrem sem necessidade.
2. **O que é importante aparece primeiro.** Cena ativa, turno, conexão, personagem selecionado e ações disponíveis sempre têm prioridade sobre estatísticas da conta ou configurações.
3. **Fantasia sem ruído.** Máximo de um ornamento forte por região visual. Nada de brilho permanente ou textura atrás de texto pequeno.

## Diagnóstico do visual atual

| Hoje | Ajuste de design |
| --- | --- |
| [`globals.css`](../frontend/src/app/globals.css) já oferece tema escuro, `.parchment`, molduras e brilho dourado, mas a cor primária ilumina quase todo destaque. | Consolidar tokens semânticos; reduzir brilho para seleção/ação principal e separar bronze, vinho e musgo por significado. |
| [`layout.tsx`](../frontend/src/app/layout.tsx) já carrega Cinzel e EB Garamond. | Preservá-las como identidade; reservar uma fonte de UI muito legível para comandos densos, números e formulário. |
| [`site-header.tsx`](../frontend/src/components/layout/site-header.tsx) expõe todas as rotas no topo, inclusive na mesa. | Ter um cabeçalho global compacto e um *shell* de sessão próprio; menu móvel e ações de saída claramente identificadas. |
| Landing e dashboard em [`page.tsx`](../frontend/src/app/page.tsx) e [`dashboard/page.tsx`](../frontend/src/app/dashboard/page.tsx) priorizam cards e progressão de conta. | Destacar entrar/voltar à campanha, próxima sessão e o que mudou; usar cards menores para XP e conquistas. |
| [`campaigns/[id]/page.tsx`](../frontend/src/app/campaigns/%5Bid%5D/page.tsx) empilha relógio, exploração e mesa numa coluna, com combate em painel separado. | Criar uma página de campanha como *lobby* e uma mesa em tela ampla com painéis laterais e inferior. |
| [`explore/page.tsx`](../frontend/src/app/campaigns/%5Bid%5D/explore/page.tsx) repete relógio, HUD e VTT. | Exploração vira modo da mesma mesa/rota, com ferramentas e lateral próprios, sem duplicar o palco. |
| [`vtt-panel.tsx`](../frontend/src/components/campaigns/vtt-panel.tsx) reúne mapa, ferramentas, diálogos e gestão em um card grande. | Separar visualmente barra da cena, toolbar, canvas, inspetor e atividade; esconder controles de mestre em preparação sem ocultar ações de jogador. |
| [`characters/[id]/page.tsx`](../frontend/src/app/characters/%5Bid%5D/page.tsx) já mistura pergaminho e atributos circulares. | Manter o tom, mas dar prioridade a PV, CA e recursos; reduzir círculos decorativos em telas pequenas e mostrar dados em linhas compactas. |

Este diagnóstico não declara que recursos futuros como presença, chat de mesa ou cena ativa já existem; eles dependem das entregas MV-06 a MV-11 do plano funcional.

## Sistema de cores

Valores-base em sRGB para implementação. Sombras, overlays e estados devem derivar destes tokens, não de cores aleatórias por componente. O contraste indicado é a razão calculada para o par proposto; validar novamente no navegador após aplicar opacidade ou imagem de fundo.

| Token | Hex | Uso e regra |
| --- | --- | --- |
| `canvas` | `#141715` | Fundo da sessão e áreas atrás do mapa. |
| `surface` | `#242922` | Painéis, toolbar, cards escuros e popovers. |
| `parchment` | `#E6D9B8` | Fundo de textos longos, ficha e handout; texto `canvas` (12,88:1). |
| `bronze` | `#B58A50` | CTA, seleção, foco, ícones ativos; texto `canvas` (5,77:1). Texto bronze em `surface`: 4,75:1. |
| `wine` | `#8B3440` | Combate, risco, ação destrutiva confirmada; texto branco: 7,89:1. Nunca usar como única pista de perigo. |
| `moss` | `#5B7353` | Exploração, pronto/seguro, progresso; texto branco: 5,22:1. **Não** usar texto musgo sobre pergaminho (3,72:1). |
| `text-main` | `#E6D9B8` | Texto primário em `canvas` e `surface` (12,88:1 e 10,59:1). |
| `text-muted` | `#BAAE91` | Texto secundário em `surface` (6,75:1). |
| `text-on-light` | `#141715` | Texto sobre pergaminho e bronze. |
| `error-light` | `#D47779` | Mensagem de erro sobre `surface` (4,74:1); erro não deve depender só da cor. |

Estados semânticos: ação principal `bronze`; navegação ativa com filete bronze + texto claro; iniciativa/perigo `wine`; exploração/viagem `moss`; indisponível com texto atenuado **e** indicação textual. Fundo de mapa e artes carregadas não entram no cálculo de contraste dos controles: estes precisam de superfície sólida/overlay. Se houver barras de PV, incluir número e legenda; cores podem reforçar, não transmitir o valor isoladamente.

## Tipografia e escala

- **Cinzel** (existente): marca, títulos de página e títulos de cena. Evitar em texto de botão muito pequeno, tabela ou chat. Títulos: 32/40 px desktop, 26/34 tablet, 24/32 mobile.
- **EB Garamond** (existente): texto narrativo, descrição, diário e handouts, normalmente 18/28 px; nunca menor que 16 px em leitura contínua.
- **Fonte de interface neutra** (proposta: `system-ui`, sem download obrigatório): menus, formulário, rótulos, tooltips, chat compacto, inventário, números de combate. Corpo 14–16 px, linha 1,4–1,5. Dados numéricos com `font-variant-numeric: tabular-nums`.
- Hierarquia: título da cena 24–28 px; seção 18–20; nome de personagem 16–18; rótulo 12–14; tooltip 13–14. Evitar caixa-alta longa; usar caixa-alta apenas em micro-rótulos com espaçamento moderado.

## Grade, espaço e camada

Escala de espaço `4 / 8 / 12 / 16 / 24 / 32 / 48` px. Raio: 8 px para controles, 12 px para painéis, 16 px para cards narrativos. Linha ornamental de 1 px; moldura dupla somente em hero, handout ou ficha destacada. Alvo clicável/toque mínimo: 44 × 44 px. Ícones de 18–20 px acompanhados por nome visível ou `aria-label` e tooltip no desktop.

Largura de leitura: 70–78 caracteres por linha; conteúdo de páginas comuns até 1200 px. A mesa usa toda a largura disponível, com área jogável mínima de 560 px em desktop. Em telas menores, não encolher a área do mapa para caber três colunas: recolher laterais em gavetas. Camadas de elevação: base `canvas` → superfície `surface` → popover/menu → modal. Sombras suaves e quentes; sem brilho contínuo em muitos cards.

Breakpoints de desenho (a implementação pode adaptar ao conteúdo): **desktop ≥ 1200 px**, **tablet 768–1199 px**, **mobile < 768 px**. Em viewport de 320 px, nunca criar rolagem horizontal da página; o mapa pode ser arrastado/zoomado dentro do próprio palco.

## Componentes de linguagem visual

| Componente | Especificação |
| --- | --- |
| `SessionShell` | Troca o cabeçalho de marketing por barra de 56–64 px com breadcrumb campanha/cena, status de conexão, modo Mestre/Jogador e ação “Sair da mesa”. Não colocar ações destrutivas junto a “Voltar”. |
| `SceneTabs` | Abas nomeadas para cenas/documentos **abertos pelo próprio usuário**, sem imitar navegador nem proliferar indefinidamente; no máximo 5 visíveis, excesso em menu. Cena ativa marcada por filete bronze e texto, não só cor. Mapas preparados pelo mestre não aparecem ao jogador. |
| `ToolRail` | 52–60 px na lateral esquerda em desktop: selecionar/mover, ping, régua; ferramentas de fog, marcador e hotspot apenas ao mestre. Grupos separados por divisores; atalhos exibidos em tooltip. No mobile, barra inferior de até 4 ações + “Mais”. |
| `MapStage` | Canvas com fundo `canvas`, imagem do mapa preservando proporção, grade sutil e controles de zoom/pan em canto estável; “Ajustar ao mapa” visível. Não aplicar moldura ornamentada sobre a imagem; priorizar legibilidade de tokens. |
| `Token` | Retrato circular ou monograma, borda por estado/propriedade e anel de seleção bronze; nome em tooltip/painel, não rótulo permanente sobre cada token. Token sem imagem mantém monograma. Foco de teclado visível. |
| `Inspector` | Painel direito de 300–360 px desktop: personagem/objeto selecionado, recursos, permissões e ações contextuais; quando nada está selecionado, mostra participantes/cena. Não expor segredos do mestre por ocultação CSS: projeção autorizada vem da API. |
| `ActivityDock` | Faixa inferior redimensionável/recolhível para rolagens, conversa e diário recente; timestamps, autor e visibilidade por item. Altura inicial 220–280 px; conteúdo rolável internamente. Recurso futuro MV-08. |
| `CombatTray` | Painel de iniciativa com turno atual bem destacado, rodada, PV autorizados e “Próximo turno” só para mestre; pode ocupar o inspetor ou uma gaveta, sem competir com o mapa. |
| `CharacterCard` | Retrato 56–72 px, nome, papel, presença e recursos numéricos. Lista compacta com detalhes sob demanda; não repetir barras coloridas sem legendas. |
| `Handout` | Janela de pergaminho com texto escuro, ilustração opcional, autoria/descoberta e botão “Fechar”; abrir sem roubar permanentemente o mapa. Revelação futura MV-10. |

Para arte própria: mapas e retratos são fornecidos pelos usuários; assets do produto podem usar gravura medieval simples/traços de tinta, sem visual de terceiros. Texturas de pergaminho devem ser quase imperceptíveis e desativáveis; usar `object-fit: cover` somente em retratos, nunca em mapas.

## Layouts de página

### Entrada e landing (`/`)

Desktop: hero em duas colunas (mensagem e ações à esquerda, composição original de mesa/mapa à direita), três provas de valor abaixo: “Jogue junto”, “Prepare cenas”, “Continue a história”. A ação principal é “Criar mesa/começar”; secundária “Entrar”. Tablet: hero empilhado, imagem após CTA. Mobile: título curto, CTA de largura total e uma única ilustração de baixo peso; partículas decorativas reduzidas. A landing atual já tem frase e cards; transformar os cards de funcionalidades isoladas em jornada de sessão. Não usar captura de tela alheia como hero.

### Dashboard (`/dashboard`)

Desktop: coluna principal 8/12 para “Continuar campanha”, campanhas recentes e “Desde sua última visita”; coluna lateral 4/12 para personagens, agenda/status e XP. Tablet: 7/12 + 5/12 ou 1 coluna quando apertado. Mobile: primeiro a campanha em andamento, depois personagem, depois atividade/XP. Estado vazio deve oferecer “Criar campanha” ou “Entrar com convite”; erro deve oferecer “Tentar novamente”. “Desde sua última visita” depende de MV-11; até lá, usar atividade existente sem prometer resumo automático.

### Campanha / lobby (`/campaigns/[id]`)

Cabeçalho com nome, descrição curta, papel e status da sessão. Ação principal: “Entrar na mesa” (jogador) ou “Abrir mesa” (mestre). Abaixo: participantes, cena disponível, resumo do mundo e diário recente. Convite e configurações em menu do mestre; excluir campanha em zona de perigo com confirmação. Desktop: 8/12 + 4/12; tablet/mobile: uma coluna. Não manter a mesa inteira enterrada entre widgets no lobby quando houver a rota/shell dedicado.

### Mesa virtual / sessão (novo `SessionShell` sobre o VTT)

Desktop, leitura espacial:

```text
┌ Campanha / Cena ─── conexão ─── modo ─── sair ┐
│ cenas/abas                    ações de cena   │
├──────┬───────────────────────┬───────────────┤
│tools │       MAPA / CENA     │ inspetor      │
│      │                       │ elenco/combate│
├──────┴───────────────────────┴───────────────┤
│ atividade: dados · conversa · diário         │
└───────────────────────────────────────────────┘
```

Mapa = 60–72% da largura restante; inspetor 300–360 px, toolbar 52–60 px. A faixa de atividade pode ser recolhida para quase só mostrar a última ação. Mestre recebe modo “Preparar” com painel de camadas/cenas e prévia da visão do jogador **somente quando a projeção segura existir** (MV-01/MV-06). Jogador recebe movimento/ping/rolagem, sem ferramenta administrativa. Reconexão mostra aviso persistente “Reconectando; ações temporariamente indisponíveis” até snapshot válido (MV-03); não dar aparência de mesa atualizada quando está atrasada.

Tablet: palco mantém prioridade; inspetor vira painel recolhível de 280–320 px, atividade vira gaveta inferior. Toolbar pode ficar à esquerda. Mobile: palco ocupa a tela útil; barra de cena compacta no topo, ferramentas essenciais embaixo e painéis como *bottom sheets* separados (“Participantes”, “Combate”, “Atividade”, “Ficha”). Só uma gaveta aberta por vez. O mapa suporta pan com um dedo e zoom com gestos/controles; controles não dependem de hover. Modo paisagem oferece mais palco, mas não é obrigatório para tarefas básicas.

### Exploração (`/campaigns/[id]/explore` durante transição)

Até unificar os modos, preservar a rota e concentrar: relógio compacto no topo do palco, AP/local/ação na lateral, mapa como conteúdo principal e diário como aba ou gaveta. Desktop 8/12 + 4/12; tablet lateral recolhível; mobile mapa primeiro, HUD resumido fixo e ações em gaveta. Confirmar viagem com destino/custo/tempo e indicar quando uma ação afeta toda a campanha. Quando a mesa unificada chegar, a URL pode redirecionar para `?mode=explore` sem perder links existentes.

### Ficha (`/characters/[id]`)

Desktop: cabeçalho com retrato e nome, faixa de recursos imediatos (PV, CA, iniciativa, magia), depois atributos e abas Inventário/Magias/História. O pergaminho é fundo dos blocos de leitura, não das barras de ferramentas. Tablet: faixa de recursos em duas linhas. Mobile: retrato menor, PV e CA na primeira dobra, atributos em grade 2 × 3 ou lista, abas horizontalmente roláveis com indicação de continuidade; nenhum número essencial oculto por ornamento. Botões de ajuste de PV com rótulo/tooltip e anúncio do novo valor.

## Estados e microinterações

- **Carregando:** skeleton com tamanho da região real; não substituir uma falha de API por “Carregando...” eterno. No mapa, conservar a última cena com overlay de sincronização quando seguro.
- **Vazio:** mensagem específica + uma ação útil (“Adicionar mapa”, “Criar personagem”, “Convidar jogadores”).
- **Erro:** texto claro, causa resumida e “Tentar novamente”; sessão 401 leva a reautenticação sem perder o caminho de retorno.
- **Offline/reconexão:** status textual no cabeçalho e bloqueio de operações mutáveis até confirmação; alterações locais não devem parecer salvas.
- **Salvando/salvo:** indicador discreto junto ao controle; se falhar, devolver a edição e oferecer retry.
- **Hover/foco/seleção:** hover leve; foco de teclado com contorno bronze de 2 px e offset; seleção com borda + ícone/label. Transições de 120–180 ms; respeitar `prefers-reduced-motion` e suprimir partículas/zoom animado.
- **Modal de risco:** confirmação com nome da campanha/personagem e consequência explícita para excluir/sair/remover; botão destrutivo separado do primário.

## Acessibilidade e validação

Alvo de conformidade: WCAG 2.2 AA. Todos os caminhos principais por teclado: entrar na mesa, selecionar mapa/cena autorizada, mover token próprio, rolar dados, abrir ficha, ver revelação e sair. Para grade, usar foco em um elemento com navegação por setas ou equivalente; evitar centenas de itens no `Tab`. Modal prende foco, devolve foco ao acionador e fecha com Escape quando seguro. `aria-live` para turno, rolagem, conexão e mudança de PV sem anunciar cada atualização visual do mapa. Retratos têm alt descritivo quando informativos; fundos/ornamentos são decorativos. Não deixar efeito sonoro ou animação indispensável.

Testar em 320, 375, 768, 1024, 1280 e 1440 px; zoom de navegador de 200%; alto contraste; tema com imagens grandes/ausentes; mapa 80 × 60; lista de 20 NPCs; chat longo; conexão lenta. Medir se títulos e controles permanecem legíveis com esses cenários, não apenas em captura estática.

Os 44 × 44 px definidos acima são uma meta de conforto para a mesa, não o mínimo formal de WCAG 2.2 AA. Para aceite de acessibilidade, verificar as fontes normativas da W3C: [contraste mínimo de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [tamanho mínimo de alvo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) e [reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html).

## Estado da implementação visual

- Aplicado: tokens globais de cor, fundo e cabeçalho responsivo; página inicial com prévia ilustrativa original; dashboard e lista de campanhas; cabeçalho/navegação da campanha, mesa mais larga, mapas e ferramentas mais legíveis, companhia lateral e estados vazios; exploração com mapa primeiro; ficha com PV/CA e recursos priorizados. Partículas decorativas estáveis entre servidor e navegador, ocultas para quem prefere movimento reduzido.
- Segunda etapa: [`SessionWorkspace`](../frontend/src/components/campaigns/session-workspace.tsx) reúne Companhia, Combate e Jornada em painéis recolhíveis, com apenas um aberto por vez. Eles ficam ao lado da mesa em desktop e acima dela em telas estreitas. Os componentes continuam montados ao trocar de painel para preservar formulários e personagem selecionado.
- [`VttToolRail`](../frontend/src/components/campaigns/vtt-tool-rail.tsx) coloca ferramentas em coluna quando o componente tem largura suficiente e em linha no mobile. Ferramentas administrativas seguem restritas ao papel de mestre na interface. O inspetor de cenário abre em “Detalhes” e pode ser recolhido.
- [`MapStage`](../frontend/src/components/campaigns/map-stage.tsx) oferece zoom 2D de 100% a 300%, ajuste à área disponível, rolagem interna e navegação por toque com a rolagem nativa. O ajuste considera largura e altura e mantém a proporção do mapa. Gestos de pinça e arraste livre por mouse ainda não estão implementados; o modo 3D mantém seus controles próprios.
- “Focar no mapa” recolhe a navegação e o resumo da campanha, reduzindo cabeçalhos. “Visão completa” restaura a página. Exclusão, saída e remoção de participante passam por confirmação com estado de processamento e mensagem de erro. Modais longos têm rolagem limitada à altura da tela.
- A grade usa um ponto de entrada no Tab; setas navegam entre células, Home/End vão às extremidades da linha e Enter executa a ferramenta selecionada. Na página inicial, foi corrigida a largura mínima implícita da grade que cortava conteúdo no celular.
- Ainda não aplicado: rota dedicada de sessão, gavetas sobrepostas no mobile, atividade/chat em tempo real, presença, cenas autorizadas por jogador e revelações. Os critérios gerais acima seguem como metas; esta etapa não declara conformidade WCAG completa nem paridade de autorização entre as vistas 2D e 3D.

### Verificação da segunda etapa — 21/09/2026

Verificação automatizada em Chrome com Playwright, contas e respostas de API simuladas exclusivamente no navegador. Nenhuma operação de escrita foi enviada à API real. Cobertura:

- Página inicial em 320, 375, 768 e 1440 px, com cabeçalho hidratado e sem transbordamento horizontal.
- Mesa como mestre e jogador em 320, 375, 768, 1280 e 1440 px: abrir/recolher Companhia, Combate, Jornada e Detalhes; zoom e ajuste; ausência de transbordamento da página.
- “Focar no mapa” e retorno à visão completa; navegação por setas/Enter, medição por teclado e um único ponto de Tab na grade.
- Preservação de uma quantidade de dano ainda não aplicada ao trocar de painel; abertura/cancelamento de confirmação de exclusão, saída e remoção sem disparar mutações.
- Modal longo de criação de local inteiramente acessível na altura de tela 320 × 812; botões de mestre ausentes na interface do jogador.
- Nenhuma exceção de execução capturada nesses cenários. Inspeção das imagens geradas levou ao ajuste do cabeçalho mobile e da largura da página inicial.

Essa rodada cobre a interface e seus estados locais; não valida persistência, autorização no servidor, sincronização entre clientes, fog no 3D, gestos de pinça ou todos os cenários de conteúdo do checklist geral.

## Sequência sugerida de implementação

1. **Fundação visual:** tokens CSS, tipografia de interface, header responsivo, estados de erro/vazio, redução de partículas e glow. Sem mudar regras de jogo.
2. **Navegação de campanha:** dashboard orientado a voltar à mesa; lobby separado; ficha mais legível em mobile.
3. **Shell da mesa:** extrair `MapStage`, `ToolRail`, `Inspector`, `ActivityDock`; preservar ações existentes. Primeiro entregar layouts desktop/mobile e testes de interação; não apresentar controles de recursos futuros como se funcionassem.
4. **Mesa viva real:** adicionar visuais de presença, cena ativa, chat/rolagens e revelações conforme MV-01–MV-11; autorizações são do servidor. Depois, 2D/3D com paridade de fog conforme MV-12.

## Critérios de aceite visual

1. Em 1280 × 720, o mapa é a região dominante e controles de mestre/jogador continuam acessíveis sem ocupar o centro do palco.
2. Em 375 × 812 e 320 px de largura, entrar na mesa, mover token próprio, consultar combate e rolar dados são possíveis sem scroll horizontal da página nem hover.
3. Texto normal, rótulos de controle e estados usam combinações de contraste ≥ 4,5:1; texto grande ≥ 3:1; foco, perigo e seleção são identificáveis sem depender só de cor.
4. Mestre e jogador enxergam layouts coerentes com suas permissões; a UI não sugere que ocultação visual substitui proteção da API.
5. “Carregando”, “Vazio”, “Erro”, “Reconectando”, “Salvando” e “Salvo” têm aparência e texto distintos.
6. Ficha, mapa e diário mantêm identidade medieval comum, porém a mesa usa ornamentação contida e leitura rápida.
7. A equipe consegue substituir uma imagem de mapa/retrato sem quebrar grade, proporção, controles ou legibilidade.

Esta spec não autoriza copiar a interface das imagens de referência. O resultado deve ser uma identidade própria de Eldoria, com os mesmos padrões úteis de priorização espacial e fluxo de jogo.
