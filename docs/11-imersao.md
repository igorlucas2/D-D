# Especificação de imersão — Eldoria

Análise em 11/10/2026. Este documento propõe melhorias; não indica que elas já foram implementadas. Complementa o [plano funcional de mesas vivas](./09-melhorias-mesas-vivas.md) (identificadores `MV-xx`) e a [especificação visual](./10-especificacao-visual-mesas-vivas.md). Aqui os itens usam o prefixo `IM-xx`.

Evolução em 17/10/2026: [mestre de IA com lore e memória persistente](./13-mestre-ia-lore.md), com o cenário inicial **O Pacto dos Três Sinos**, catálogo reaproveitado e plano `MI-00` a `MI-08`. **MI-DB concluída:** MySQL local `localhost:3306/rpg`, com 3.451 registros preservados. [Migração](./14-migracao-mysql.md). **MI-01 concluída:** pacote estruturado, 16 vínculos de fichas validados e prévia privada. [Pacote](./15-pacote-lore.md). **MI-02 concluída:** instalação transacional em campanha nova, entidades por campanha, calendário/cena e mapas autenticados. [Mundo persistente e testes](./16-mundo-persistente.md). **MI-03 concluída:** tela Memórias, acontecimentos, fatos versionados, descobertas, relações, promessas, fios e correções com acesso por destinatário e retomada após reinício. [História e conhecimento](./17-historia-conhecimento.md). **MI-04 implementada:** comandos confirmados pelo mestre, viagem/descanso coletivos, transporte do caixote e conteúdo, localização factual e outbox com atualização autorizada das telas. [Comandos e limites](./18-comandos-grupo.md).

**MI-05 implementada em modo copiloto:** Gemma 2 9B local via Ollama, recuperação do MySQL, contextos privados/públicos/de NPC separados, fontes citadas, propostas tipadas, edição, aprovação transacional, pausa e retomada. O mestre usa **Copiloto** na mesa; jogadores recebem somente resultados publicados/autorizados. [Contrato, avaliação real e limites](./19-mestre-copiloto.md). O assistente IM-12 permanece independente. Autonomia MI-06 ainda não está habilitada; sessão humana prolongada e validações adicionais continuam pendentes.

**MI-06A — intenções e diálogos:** jogadores usam **Intenções** para perguntar a NPCs presentes ou descrever ações pretendidas. O mestre revisa o rascunho ou responde manualmente, podendo pedir esclarecimento. A conversa é privada entre autor e mestre, persiste no MySQL e retoma após reinício. [Contrato e implementação](./20-intencoes-dialogos.md). Esta é a primeira parte da MI-06; a execução autônoma continua pendente.

**MI-06B — prazos do mundo:** o mestre usa **Prazos** para preparar lembretes e viagens de NPCs, com política desligada por padrão, autorização individual, pausa e limite por avanço. O backend revalida condições no relógio de jogo, registra partida e chegada separadamente e conserva conhecimento por revisão, sem depender do Gemma. [Contrato, migração e testes](./21-prazos-do-mundo.md). Transporte da carga, reparos e decisões autônomas do modelo continuam pendentes.

## Estado da implementação

- **IM-01 implementado (12/10/2026):** fases em [`day-phase.ts`](../frontend/src/lib/day-phase.ts); camada 2D em [`day-night-overlay.tsx`](../frontend/src/components/campaigns/day-night-overlay.tsx); luz interpolada na [mesa 3D](../frontend/src/components/campaigns/vtt-table-3d.tsx); campo `VttMap.lightingMode` com seletor “Iluminação” no inspetor do mestre; fase exibida no relógio. O calendário passou a vir de uma store compartilhada ([`world-calendar-store.ts`](../frontend/src/stores/world-calendar-store.ts)), com uma conexão por campanha e recarga após reconexão. Valores da noite 3D foram clareados após inspeção visual: com luz azul saturada, a superfície ficava ilegível.
- **IM-03 implementado (12/10/2026):** [`arrival-card.tsx`](../frontend/src/components/campaigns/arrival-card.tsx), disparado só pelo clique em hotspot do jogador, com dados da API REST projetada.
- **Verificado** com Playwright e dados reais em contas descartáveis (removidas depois), cobrindo:
  - a camada da noite no mapa externo e a ausência dela no interior;
  - o mapa voltando ao dia em tempo real quando o mestre avança o relógio;
  - o cartão com breadcrumb, fase, data e tempo de viagem, que some em cerca de 2 s e não reaparece ao recarregar;
  - o override de iluminação aplicado pelo mestre e o seletor ausente para o jogador;
  - 375 px com movimento reduzido, sem rolagem horizontal;
  - a noite 3D com aparência distinta do dia.
- **IM-02 implementado (12/10/2026), com ajustes à spec:**
  - A biblioteca própria é **sintetizada por Web Audio** em [`ambience-engine.ts`](../frontend/src/lib/audio/ambience-engine.ts): ruído, filtros e osciladores. Não há arquivos baixados nem licença a registrar.
  - Os 10 presets ficam em [`ambience-presets.ts`](../frontend/src/lib/audio/ambience-presets.ts), com padrão por `kind`. Mapas externos ganham grilos à noite, ligando o som ao IM-01.
  - Novo campo `VttMap.ambiencePreset`, validado no servidor contra a lista. O mestre escolhe em “Ambiente sonoro” no inspetor.
  - Botão “Ativar som” e volume ficam no cabeçalho da mesa ([`ambience-controls.tsx`](../frontend/src/components/campaigns/ambience-controls.tsx)). A preferência é salva no navegador; após recarregar, o som retoma no primeiro clique ou tecla.
  - Ainda não feito: `musicTrack` (depende de trilhas gravadas), canais separados de música e efeitos (só há um volume de ambiente por enquanto) e a pasta `public/audio/LICENSES.md` (só será necessária quando houver gravações).
  - Verificado com Playwright e áudio real no Chromium:
    - nada toca antes do gesto do usuário;
    - crossfade entre mapas;
    - troca feita pelo mestre chega ao jogador em tempo real;
    - todos os presets audíveis, com nível RMS equilibrado entre 0,019 e 0,037;
    - volume 0 silencia e desligar suspende o áudio;
    - preset inválido é rejeitado pela API;
    - seletor exclusivo do mestre.

    A **qualidade sonora não foi avaliada por ouvido**: precisa de audição humana no teste de jogo.
- **Decisão 4 implementada (12/10/2026):**
  - Campos `CombatEncounter.hpDisplay` e `Campaign.combatHpDisplay` (o modo vale para o próximo combate) e rota `PATCH /campaigns/:id/combat`, exclusiva do mestre.
  - `getEncounter` projeta por papel e envia `hpStatus` para todos os participantes.
  - No painel de Combate, o mestre tem o interruptor “PV dos inimigos: Descritivo / Numérico” e vê o aviso “Jogadores veem: …”. O jogador vê o rótulo e uma barra por faixa, que não revela mais que o rótulo.
  - Verificado via API e Playwright:
    - no modo descritivo, o jogador recebe `currentHp`/`maxHp` nulos para inimigos e números para aliados;
    - o jogador recebe 403 ao tentar trocar o modo;
    - o modo numérico libera os números;
    - o combate seguinte herda o modo.
  - Ainda sem tempo real: o jogador vê a troca ao recarregar o painel (depende de MV-09).
- **IM-04 implementado (12/10/2026):**
  - **Servidor:**
    - O resultado é sorteado no servidor com `crypto.randomInt`.
    - A fórmula aceita até 20 dados e modificador de no máximo ±100.
    - `DiceRoll` ganhou `campaignId` e `visibility`: pública por padrão na mesa (decisão 3) e sempre privada fora dela.
    - O personagem usado na rolagem precisa ser de quem rola.
    - A entrega é pelo [`vtt.gateway.ts`](../backend/src/vtt/vtt.gateway.ts) (`table:roll`): pública para a mesa toda, “só mestre” para o mestre e quem rolou, privada só para quem rolou (sala `campaign:{id}:user:{userId}`).
    - O histórico autorizado está em `GET /dice/campaign/:id` e é recarregado na reconexão.
  - **Cliente:**
    - Física com `cannon-es` 0.20.0. A geometria fica em [`polyhedra.ts`](../frontend/src/lib/dice/polyhedra.ts) e serve tanto à malha quanto ao corpo físico: d4 lido pelo vértice, d10 em trapezoedro e d100 como dezena + unidade.
    - A simulação ([`simulate.ts`](../frontend/src/lib/dice/simulate.ts)) roda inteira antes de exibir. Ela refaz o lançamento se algum dado terminar inclinado e troca os rótulos para que a face de cima mostre o valor do servidor.
    - A bandeja ([`dice-tray.tsx`](../frontend/src/components/campaigns/dice-tray.tsx)) fica sobre o palco, sem capturar cliques. O botão “Dados” abre controles e histórico ([`table-dice-controls.tsx`](../frontend/src/components/campaigns/table-dice-controls.tsx)). Crítico e falha têm texto e som.
    - A preferência “Só o resultado” é salva no navegador e vale por padrão com movimento reduzido.
  - **Verificado:**
    - **Geometria e simulação, em Node** (300 dados de todos os tipos): faces planas e orientadas para fora; a face de cima mostra o valor do servidor em 300 de 300; nenhum dado inclinado ou fora da bandeja; lançamento com mediana de 1,9 s.
    - **Entrega, com sockets reais:** destinatários corretos nas três visibilidades; histórico filtrado por papel; 403 para intruso e para personagem alheio; 400 para fórmula ou visibilidade inválidas.
    - **Sorteio:** 2000 d20 no servidor ficaram entre 79 e 116 por face (esperado 100).
    - **Navegador (Playwright):** o mestre vê a rolagem do jogador ao vivo. As capturas de d20, 3d6, 6d6, 3d20, 2d4, 2d10, d12 e d100 mostram na face de cima os valores do servidor. No celular, com movimento reduzido, só aparece o cartão de resultado, sem rolagem horizontal.
  - **Concluído depois:**
    - cor estável por participante ([`player-color.ts`](../frontend/src/lib/player-color.ts), 8 tons com contraste ≥ 8:1 contra a tinta), usada no dado, no histórico, na presença e nos pings;
    - volumes separados de ambiente e de efeitos.
- **IM-05 implementado (12/10/2026):**
  - **Presença** ([`table-presence.ts`](../backend/src/vtt/table-presence.ts), com testes unitários): lista por campanha, mestre primeiro.
    - Uma pessoa com várias abas só fica “ausente” quando todas estão ausentes, seja com a aba oculta, seja após 2 min sem interação.
    - Sai da lista quando a última aba fecha ou quando é removida da campanha.
    - O estado fica em memória (uma instância do servidor).
  - **Ping** (ferramenta “Apontar”, atalho P): anel na cor do jogador na 2D e na 3D, som curto no canal de efeitos e anúncio para leitor de tela.
  - **“Olhem aqui”** (só o mestre): leva quem tem “Seguir o mestre” ligado ao mapa e ao ponto, ampliando para 200%. Quem desligou não é movido.
  - **Validação no servidor:** participação atual no banco, 1 ping/s por aba, célula dentro do mapa, jogador só aponta em mapa publicado, ping em mapa em preparação só chega ao mestre e foco exige mestre e mapa publicado.
  - **Indicador de conexão** (parte de MV-03): o aviso “Reconectando…” aparece enquanto o socket está caído.
  - **Verificado:**
    - **Com sockets reais:** destinatários e recusas acima; presença com duas abas; remoção e fechamento de abas; limite de frequência.
    - **No navegador:** ping da jogadora visto pelo mestre, centralizado na célula; foco levou a jogadora ao Porto em 200% no canto pedido; jogador com “Seguir” desligado não se moveu; ausência por aba oculta visível ao mestre.
  - **Foco 3D concluído (16/10/2026):** [`table-camera-controls.tsx`](../frontend/src/components/campaigns/table-camera-controls.tsx) centraliza a célula solicitada e aproxima até o equivalente a 200%, preservando o ângulo e um zoom maior que o jogador já tenha escolhido. A transição dura 300 ms, é imediata com movimento reduzido e pode ser interrompida por gesto de câmera. O ping 3D também fica estático com movimento reduzido.
    - O foco respeita “Seguir o mestre”, fica associado ao mapa autorizado e é consumido uma vez, sem reaparecer ao alternar 2D/3D. A troca de mapa reinicia a câmera antes de aplicar o novo foco.
    - A centralização aguarda o carregamento das dimensões da imagem; se ela falhar, usa as dimensões da grade.
    - **Verificado com Playwright/Chromium, API simulada e eventos Socket.IO de teste:** dois jogadores, um sem seguir; centro da célula e zoom; repetição sem zoom acumulado; preservação de zoom manual; troca de mapas de proporções distintas; ping sem foco; interrupção pelo mouse; alternância 2D/3D sem repetir o pedido; 2D ainda em 200%; mapa ausente da projeção ignorado; imagem lenta e imagem indisponível; 375 px com movimento reduzido, sem posições intermediárias de câmera nem rolagem horizontal da página. Inspeção visual das capturas desktop/celular. O backend de autorização não foi alterado nem revalidado nesta entrega.
    - **Verificações de código:** TypeScript e ESLint nos componentes alterados.
  - **Limitação restante de presença:** o estado não é compartilhado entre várias instâncias do servidor.
- **IM-06 implementado (12/10/2026):**
  - **Envio:** o mestre usa “Narrar” ([`narration-composer.tsx`](../frontend/src/components/campaigns/narration-composer.tsx)) para escrever ou usar um rascunho e enviar para toda a mesa ou para jogadores escolhidos. Os destinatários são validados no servidor ([`narration.service.ts`](../backend/src/narration/narration.service.ts)): só jogadores da campanha.
  - **Entrega:** por socket, só às abas dos destinatários e ao mestre.
  - **Pergaminho** ([`narration-scroll.tsx`](../frontend/src/components/campaigns/narration-scroll.tsx)): diálogo não modal sobre o palco, com fila, som de página no canal de efeitos, “somente para você” quando restrita, e Esc ou “Fechar” devolvendo o foco.
  - **Diário com público** (parte de MV-10): a entrada pode ter destinatários (`restricted` + `JournalEntryRecipient`). O jogador fora do público não recebe a entrada; só o mestre vê a lista de destinatários.
  - **Rascunhos** (`NarrationDraft`), opcionalmente ligados a um mapa: quando um personagem viaja para esse mapa, só o mestre recebe a sugestão “Abrir para ler”.
  - **Vazamento corrigido:** a entrada automática de “Local descoberto” copiava o `eventNote` (nota privada do mestre) para o diário público. Agora usa um texto neutro.
  - **Verificado:**
    - **Com sockets e API:** a narração a todos chega aos três; a narração à Ana chega só à Ana e ao mestre; o diário do Bruno não contém a revelação nem por API; recusas para jogador narrando ou lendo rascunhos (403), destinatário de fora ou o próprio mestre (400), texto vazio ou com mais de 4000 caracteres (400) e mapa de outra campanha no rascunho (404); a sugestão de chegada vai só ao mestre; o `eventNote` não aparece mais no diário.
    - **No navegador:** a Ana vê o pergaminho com foco nele e fecha com Esc; o Bruno não vê nada; a sugestão abre o rascunho, que, enviado a todos, aparece para os dois; o diário do mestre mostra o selo “Revelação para Ana”.
  - **Limitações:** handouts com imagem ainda não existem (só texto) e narrações recebidas offline não reaparecem como pergaminho; ficam no diário se tiverem sido registradas.
- **IM-07 implementado com MV-09 (12/10/2026):**
  - **Combate em tempo real:** cada mudança no [`combat.service.ts`](../backend/src/combat/combat.service.ts) envia `table:combat` com o encontro projetado por papel e o evento que o causou (`start`, `end`, `turn`, `hp`, `conditions`, `roster`, `display`). No modo descritivo, o jogador recebe dano de inimigo **sem número** (`delta: null`) e sem PV no encontro.
  - **Painel de combate:** usa uma conexão auxiliar (`presence: false`, não conta na presença) e recarrega ao reconectar.
  - **Efeitos de cena** ([`table-combat.tsx`](../frontend/src/components/campaigns/table-combat.tsx)):
    - aviso “Rolem iniciativa!”, “Vez de Kael · Rodada N” e “Fim do combate”;
    - números de dano e cura sobre o token (para inimigo oculto, só o estado, ex. “Muito ferido”);
    - vinheta vermelha só na tela de quem tem o personagem com PV ≤ 25%, pulsando se o movimento não estiver reduzido e mais forte se o personagem cair;
    - anel vinho nos tokens com condição, com os nomes das condições no título;
    - token caído em cinza;
    - tokens deslizam (300 ms) em vez de saltar;
    - anúncio `aria-live` de cada mudança.
  - **Trilha de combate:** tambores de guerra sintetizados no canal de ambiente enquanto houver encontro; ao terminar, volta o som da cena.
  - **Ligação entre participante e token:** pelo personagem e, para monstros, pelo nome do token.
  - **Verificado:**
    - **Com sockets reais:** eventos e projeção por papel (Ana recebeu `delta: null` e PV nulo do goblin enquanto o mestre via −7; no modo numérico, −8 e 5 PV); turno, condições e fim chegam a todos; a conexão auxiliar não infla a presença.
    - **No navegador:** aviso de início e de turno; mestre vê “−11” e jogadora vê “Muito ferido”; tambores durante o combate e volta ao ambiente da cena depois; vinheta só para a dona do personagem (com 1 de 7 PV) e nenhuma para o mestre; anel e título com condições; transição de posição do token.
  - **Integrações do plano 09:** PV do combate e da ficha sincronizados nos dois sentidos desde 13/10/2026; foco “Olhem aqui” na 3D concluído em 16/10/2026 (IM-05/MV-07).
- **IM-08 e IM-09 implementados (12/10/2026):**
  - **Clima global da campanha** (decisão 2): `CampaignCalendar.weather` (céu limpo, nublado, chuva, tempestade, neblina, neve, ventania), enviado junto do relógio. O mestre muda pelo widget do relógio (`POST /world/weather`, só mestre, valor validado); jogadores veem o selo de clima.
  - **Eventos do mundo** podem ter `weatherEffect`: quando sorteados pelo relógio automático, mudam o clima e viram um momento ao vivo (`world:event:triggered`), com cartão no palco, sino no canal de efeitos e anúncio para leitor de tela. O texto completo continua no diário.
  - **Visual** ([`weather-layer.tsx`](../frontend/src/components/campaigns/weather-layer.tsx)), só em mapas ao ar livre:
    - partículas em canvas (no máximo 150) abaixo da grade e da névoa de guerra, pausadas com a aba oculta;
    - tom de nublado ou neblina;
    - relâmpago raro na tempestade, nunca com movimento reduzido;
    - preferência “Clima: completas / reduzidas / desligadas” por jogador (automático: reduzidas no celular e com movimento reduzido).
  - **Som:** chuva, tempestade com trovões e ventania no canal de ambiente; em interiores, só a chuva abafada “lá fora”.
  - **Verificado:**
    - **Permissões:** jogador não muda o clima (403); clima inválido e efeito inválido em evento são recusados (400).
    - **Socket e tela:** o socket da jogadora recebe o clima; a tela mostra camada e canvas de chuva com som `road+rain`; o interior não tem camada e tem som `silence+rain-indoor`; com “desligadas” o canvas some e o tom fica.
    - **Sorteio:** pelo cron real, com chance de 100%, o evento “A tempestade chega” mudou o clima para tempestade, o cartão apareceu e a entrada foi para o diário.
  - **Limitações:**
    - a vista 3D não mostra clima;
    - mudar o clima à mão reinicia a contagem do próximo tick automático, que usa o `updatedAt` do calendário (fragilidade já apontada em MV-04).
- **IM-10 implementado (12/10/2026):**
  - `CampaignMember.lastSeenAt` e `lastSeenGameMinutes` guardam a última visita e o relógio do mundo naquele momento.
  - `GET /campaigns/:id/journal/since-last-visit` devolve o tempo de jogo decorrido, o clima atual e as entradas novas do diário com as **mesmas regras de visibilidade** (revelações só para autor, mestre e destinatários; as que a própria pessoa escreveu não contam). `POST …/journal/visit` marca a visita.
  - **Cartão** ([`return-chronicle.tsx`](../frontend/src/components/campaigns/return-chronicle.tsx)) na página da campanha e na exploração: “Enquanto você esteve fora…”, com “3 dias e 4 horas se passaram no mundo”, o clima, até 8 novidades (selo “revelação para você”) e link para o diário.
  - Só aparece se houver novidade ou se tiver passado ao menos 1 hora no mundo. A visita é marcada logo depois de ler o resumo, a cada 5 minutos com a aba visível e ao fechar a página, então o que foi visto ao vivo não volta como novidade.
  - **Verificado:**
    - na primeira visita não há cartão; o intruso recebe 403;
    - a Ana viu o tempo de jogo, a neve, a própria revelação e o evento público, mas não a revelação do Bruno nem a própria anotação;
    - o Bruno viu a dele e não a da Ana;
    - o cartão não reaparece ao recarregar.
  - **Corrigido no caminho:** campanhas sem calendário salvo davam tempo decorrido vazio; agora usam o mesmo calendário padrão do relógio.
  - **Não incluído:** “próxima sessão”, porque o sistema ainda não tem agenda de sessões.
- **IM-11 implementado com a conversa da mesa (MV-08), 12/10/2026:**
  - **Conversa** (“Conversa” no topo da mesa, com contador de não lidas) em quatro modos: em personagem, ação (`/me`), fora do personagem (`/ooc` ou `((…))`) e sussurro. O sussurro vai para os escolhidos e para o mestre.
  - Histórico de 60 mensagens recarregado na reconexão; até 6 mensagens a cada 5 s por pessoa.
  - **Idiomas do mundo:** usam as entradas “Idioma” do módulo Mundo. O mestre ensina pela grade “Idiomas” (`CharacterLanguage`), e o jogador só pode falar idiomas que o personagem escolhido conhece.
  - **Segredo garantido no servidor** ([`language-scramble.ts`](../backend/src/chat/language-scramble.ts), com testes): cada destinatário recebe sua própria projeção pela sala individual. Quem não conhece o idioma recebe o texto já embaralhado (determinístico, mesmo tamanho e pontuação, “sotaque” próprio de cada idioma), e o original nunca chega a essa pessoa. O mestre e o autor sempre leem o original.
  - Idioma vale só para fala: ação e fora do personagem nunca são embaralhados.
  - **Verificado:**
    - **Com sockets:**
      - a frase em élfico chegou embaralhada ao Bruno e à Carla, sem a palavra original em nenhum dado recebido; depois que o mestre ensinou élfico ao Kael, o histórico do Bruno mostrou o original;
      - o sussurro chegou ao mestre e ao destinatário, e não à Carla;
      - recusas: falar idioma desconhecido (400), usar personagem alheio (403), jogador ensinando idioma (403), idioma de outra campanha ou entrada que não é idioma (404), sétima mensagem seguida (429).
    - **No navegador:** a Ana só vê no seletor os idiomas da Lira; o Bruno recebeu “Conversa, 2 novas”, viu a fala embaralhada com o selo “você não entende” e a ação legível; a grade do mestre ensinou o idioma com um clique.
  - **Corrigido no caminho:** uma ação (`/me`) enviada com idioma selecionado também saía embaralhada.
  - **Limitação:** os personagens ainda não são ligados a uma campanha específica, então o conhecimento de idioma vale para qualquer personagem da pessoa. Os idiomas em si, porém, são da campanha.
- **IM-13 implementado (13/10/2026):**
  - **Visão do grupo** (decisão do plano 09: “névoa do grupo”), calculada no servidor ([`vision.ts`](../backend/src/vtt/vision.ts), com testes). A união do que os tokens dos personagens dos jogadores enxergam define a visão; o restante entra na névoa da projeção do jogador, que já esconde tokens, marcadores e locais sob névoa. Por isso as vistas 2D e 3D do jogador ficam corretas sem mudança.
  - **Modos por mapa:**
    - **Desligada:** só a névoa manual.
    - **Iluminado:** linha de visão; paredes e portas fechadas bloqueiam.
    - **Escuro:** só o que alguma luz ilumina (com linha de visão a partir da luz) ou o que a visão no escuro de quem olha alcança.
  - **Paredes e portas** nas bordas das células (`VttMap.wallsData`), com as ferramentas “Parede” e “Porta”: clique perto da borda ou **W/A/S/D** na célula com o teclado. O mestre abre e fecha portas clicando nelas; porta aberta aparece com o vão livre.
    - Paredes inválidas, repetidas ou fora do mapa são descartadas.
    - O jogador só recebe as paredes vizinhas ao que vê, para não vazar a planta.
  - **Por token:** luz (`lightRadius`, tocha ≈ 4) e visão no escuro (`visionRadius`), editáveis no inspetor. Só enxergam os tokens ligados a personagens de jogadores (`ownerId` na serialização). Luz de token oculto não ilumina, para não denunciar quem está escondido.
  - **Mestre:** “Ver como jogadores” escurece o que o grupo não vê agora, pela rota `GET …/maps/:id/player-view` (só mestre). O inspetor avisa quando a visão está ligada sem nenhum token de jogador no mapa.
  - **Verificado:**
    - **Testes unitários:** 9.
    - **API e socket:**
      - com a porta fechada, o jogador não vê goblin, marcador nem local, e a nota privada não vaza;
      - com a porta aberta, o goblin aparece, mas uma célula em ângulo fechado continua oculta;
      - no escuro sem luz só se vê a própria célula; com tocha 4, até 4 células; com visão no escuro 10, o goblin a 10 células;
      - fechar a porta escondeu o goblin pelo socket;
      - recusas: rota de prévia para jogador (403), modo inválido e raio 99 (400).
    - **Desempenho:** mapa 80×60 com 400 paredes e 4 personagens, 41 ms por projeção.
    - **Navegador:** 7 paredes desenhadas com o mouse e uma porta com o teclado; jogadora sem goblin e com 48 células escuras; ao abrir a porta, goblin visível e 32 células escuras; prévia do mestre; jogador sem ferramentas de parede.
  - **Corrigido no caminho:** a porta aberta parecia fechada, porque o tracejado dependia da unidade do SVG; agora é desenhada como batentes com vão.
  - **Limitações:**
    - a vista 3D não desenha as paredes (a névoa já respeita a visão);
    - a visão é do grupo, não individual por personagem;
    - jogadores abrem portas junto do próprio token e movem só o próprio token, sem atravessar paredes (MV-07, 13/10/2026);
    - não há memória de áreas já exploradas: o que sai de vista volta a escurecer;
    - o modo “Escuro” é escolhido à mão, sem ligação com a fase do dia (IM-01).
- **IM-12 implementado com padrões seguros (13/10/2026):**
  - **Padrões adotados**, já que a decisão 6 ficou em aberto:
    - **Provedor:** Claude (`claude-opus-5-5`), pelo SDK oficial `@anthropic-ai/sdk`, com pensamento adaptativo, esforço médio e fallback de recusa (`fallbacks: "default"`).
    - **Custo:** fica com quem põe `ANTHROPIC_API_KEY` no `backend/.env`. Sem chave, o recurso aparece como indisponível e nenhuma chamada sai do servidor.
    - **Privacidade:** desligado por campanha até o mestre ligar, com aviso do que é enviado. Só sai algo quando o mestre clica em “Gerar”.
    - **Limite:** 30 pedidos por mês por campanha (ajustável de 1 a 500), com registro de tokens por pedido (`AssistantRequest`).
  - **Uso** (“Assistente”, só para o mestre): descrever a cena, improvisar um NPC, sugerir nomes ou pedido livre. O contexto vai junto: campanha, mapa atual com locais e presentes, hora e clima, até 25 entradas do Mundo e títulos recentes do diário. O resultado volta só para o mestre, que pode copiar ou salvar como rascunho de narração (IM-06); publicar continua sendo ação explícita.
  - **Erros:** recusa (422, registrada), chave inválida (503), limite da API (429) e outros erros da API (502), com mensagens em português.
  - **Verificado:**
    - **8 testes unitários com cliente simulado**, sem chamada real nem custo: permissão, falta de chave, recurso desligado, pedido vazio, limite mensal, contexto enviado, parâmetros da chamada (modelo, fallback, pensamento), registro de uso, recusa e tradução de erros.
    - **Ponta a ponta sem chave:** status “indisponível”, pedidos recusados com mensagem clara, jogador barrado (403), validações (400) e painel explicando como ativar.
    - **Não verificado:** a chamada real à API, por falta de credencial nesta máquina.
- **Continuidade:** os itens principais foram entregues; as limitações registradas em cada item continuam abertas. O foco 3D do IM-05 foi concluído em 16/10/2026. Permanecem, entre outras, clima na 3D (IM-08), paredes na 3D e ligação automática entre noite e visão (IM-13), além das preferências de conforto ainda não implementadas.

## Objetivo

Fazer o jogador **perceber o mundo** (som, luz, clima, chegada a um lugar), **sentir os outros na mesa** (dados, pings, narração compartilhada) e **ver o mundo reagir** (tempo, eventos, combate com peso). O mapa hierárquico, o relógio, os eventos aleatórios e a mesa 3D já existem; a maior parte desta spec torna esses sistemas visíveis e audíveis, em vez de criar regras novas.

## Princípios

1. **Reforçar, não substituir.** Efeito nenhum carrega informação exclusiva: o turno também aparece em texto, o clima também aparece no relógio, o dano também aparece no número de PV.
2. **O mestre conduz, o jogador controla o próprio conforto.** O mestre escolhe trilha, clima e narração da cena; cada jogador controla volume, intensidade de efeitos e partículas no próprio dispositivo.
3. **Nada de efeito como vazamento.** Título de cena, trilha sonora, clima ou narração só são enviados quando o destino é autorizado para aquele usuário. Mapa em preparação não toca música nem aparece em cartão de transição.
4. **Silencioso e leve por padrão.** Áudio só começa após interação do usuário; animações respeitam `prefers-reduced-motion`; dispositivos modestos mantêm a mesa responsiva.
5. **Curto e interrompível.** Nenhuma transição ou animação bloqueia comando do jogador por mais de 2 s; todas podem ser puladas.

## O que temos hoje

| Área | Evidência no projeto | Lacuna de imersão |
| --- | --- | --- |
| Dados | [`dice-roller.tsx`](../frontend/src/components/ornamental/dice-roller.tsx) gira a malha com `gsap`; d10 e d100 usam `dodecahedronGeometry`. Resultado em [`dice.service.ts`](../backend/src/dice/dice.service.ts), sem `campaignId`. | Sem física; face exibida não corresponde ao resultado; rolagem é individual e invisível para a mesa. |
| Tempo | `CampaignCalendar.totalMinutes` e `currentHour` em [`schema.prisma`](../backend/prisma/schema.prisma), sincronizados por `world:clock:updated` em [`world.gateway.ts`](../backend/src/world/world.gateway.ts). | A hora do jogo não altera nada no mapa: meio-dia e meia-noite são idênticos. |
| Lugares | `VttMap.kind` (`WORLD`, `REGION`, `SETTLEMENT`, `BUILDING`, `INTERIOR`, `OTHER`), hotspots com `travelMinutes`, viagem em [`exploration.service.ts`](../backend/src/exploration/exploration.service.ts). | Troca de mapa instantânea, sem sensação de chegada; mapa não tem ambiente sonoro. |
| Eventos do mundo | `CampaignWorldEvent` sorteado pelo [`world-tick.service.ts`](../backend/src/world/world-tick.service.ts) e gravado no diário. | Evento aparece só como linha de diário; nenhum momento ao vivo, nenhum efeito no ambiente. |
| Mesa 3D | [`vtt-table-3d.tsx`](../frontend/src/components/campaigns/vtt-table-3d.tsx) com `ambientLight` e uma `directionalLight` fixas. | Iluminação estática; sem hora do dia, clima ou foco. |
| Partículas | [`ambient-particles.tsx`](../frontend/src/components/ornamental/ambient-particles.tsx), usado apenas em páginas de listagem. | Pode ser base para clima, mas hoje é decoração genérica. |
| Mundo | `WorldEntryType.IDIOMA` em `CampaignWorldEntry`. | Idiomas não têm efeito em jogo. |
| Presença, áudio, chat, narração | Nenhum código ativo. | A mesa é silenciosa e não mostra quem está jogando. |
| Projeção segura | REST filtra mapas por papel via [`vtt.projection.ts`](../backend/src/vtt/vtt.projection.ts). | O [`vtt.gateway.ts`](../backend/src/vtt/vtt.gateway.ts) ainda emite `vtt:map:created/updated` com o mapa completo para toda a sala. Bloqueia itens que dependem de evento por socket (ver Dependências). |

## Backlog

Prioridade **P1** = primeira onda, entregável sem esperar o restante do plano 09; **P2** = depende de itens `MV`; **P3** = diferencial posterior. Esforço `P/M/G` é relativo.

### Onda 1 — Sentidos (P1)

#### IM-01 / M — Ciclo dia/noite ligado ao relógio

Derivar a **fase do dia** de `currentHour` do calendário (função pura compartilhada, sem campo novo):

| Fase | Horas | Tom 2D (overlay) | Luz 3D |
| --- | --- | --- | --- |
| Madrugada | 0–4 | azul escuro, opacidade 0,45 | intensidade 0,25, cor `#5a6b9a` |
| Alvorada | 5–6 | âmbar/rosado, 0,20 | 0,7, `#f2b880`, ângulo baixo leste |
| Dia | 7–16 | nenhum | 1,2, `#fff4e0`, ângulo alto |
| Crepúsculo | 17–18 | laranja/vinho, 0,25 | 0,7, `#e08a5a`, ângulo baixo oeste |
| Noite | 19–23 | azul, 0,35 | 0,35, `#6f7fb0` |

- 2D: camada `pointer-events: none` sobre a imagem do mapa em [`map-stage.tsx`](../frontend/src/components/campaigns/map-stage.tsx), **abaixo** de tokens, marcadores e controles (eles não escurecem). Mistura `multiply` ou cor sólida com opacidade.
- 3D: interpolar cor/intensidade/posição da `directionalLight` e intensidade da `ambientLight`.
- Mapas `BUILDING` e `INTERIOR` ignoram a fase (luz interior), salvo override do mestre (`VttMap.lightingMode`: `AUTO | INDOOR | FIXED_DAY | FIXED_NIGHT`).
- Mudança de fase transiciona em 1,5 s; com `prefers-reduced-motion`, troca direta.
- Relógio exibe ícone + nome da fase (informação não depende só do tom).

**Aceite:** avançar o relógio de 12h para 20h escurece o mapa externo em todos os clientes conectados sem recarregar; mapa interior não muda; tokens e controles mantêm contraste ≥ 4,5:1 em todas as fases.

#### IM-02 / M — Paisagem sonora por mapa

- Prisma: `VttMap.ambiencePreset String?` (lista fechada no código: `tavern`, `city`, `forest`, `road`, `cave`, `dungeon`, `castle`, `sea`, `night-wild`, `silence`) e `VttMap.musicTrack String?`. Sem upload de áudio arbitrário nesta fase.
- Padrão quando vazio: `WORLD/REGION → road`, `SETTLEMENT → city`, `BUILDING/INTERIOR → silence`, `OTHER → silence`. Mestre sobrescreve no inspetor do mapa.
- Cliente: `AudioDirector` (Web Audio API, um `GainNode` por canal: `master`, `music`, `ambience`, `sfx`). Ao mudar o mapa atual, crossfade de 2 s. Camada noturna opcional (`night-wild` sobreposta em mapas externos durante Noite/Madrugada, ligando IM-01).
- Áudio só inicia após primeiro gesto do usuário na sessão (política de autoplay); antes disso, botão “Ativar som” discreto no `SessionShell`.
- Assets em `frontend/public/audio/`, Ogg Vorbis com fallback AAC, loops ≤ 1,5 MB, carregamento sob demanda. Arquivo `frontend/public/audio/LICENSES.md` registra origem, autor e licença (CC0 ou equivalente) de cada arquivo; arquivo sem licença registrada não entra no repositório.
- Jogador recebe o preset apenas de mapas publicados (já garantido pela projeção REST); o mestre pré-escuta mapas em preparação apenas localmente.

**Aceite:** jogador viaja da cidade para a taverna e ouve crossfade; mudo e volumes por canal persistem após recarregar; com som desativado nenhum arquivo de áudio é baixado; mapa não publicado nunca toca no cliente do jogador.

#### IM-03 / P — Transição de chegada

- Ao viajar por hotspot (resposta da viagem do jogador ou mudança de cena apresentada pelo mestre), exibir cartão sobre o palco: nome do local em Cinzel, breadcrumb curto (`Reino de Valdor › Cidade › Taverna do Corvo`), data e fase do dia (`Anoitecer, 3º dia de Colheita`) e, se houver, tempo gasto (`+30 min de viagem`).
- Duração total ≤ 1,8 s (fade-in 300 ms, leitura, fade-out 400 ms); clique, Esc ou qualquer comando pula. Reduzido: fade de 150 ms sem zoom.
- Não dispara quando o mestre apenas navega entre mapas na prévia, nem ao recarregar a página (só em mudança real de local).
- Texto anunciado via `aria-live="polite"`.

**Aceite:** a primeira chegada a um local exibe o cartão uma vez por cliente; recarregar não repete; o cartão nunca mostra nome de mapa não publicado.

#### IM-04 / G — Dados físicos e compartilhados

- **Resultado no servidor:** `POST /dice/roll` aceita `campaignId?` e `visibility` (`PUBLIC | MASTER | PRIVATE`). Servidor sorteia, persiste e devolve `{ rollId, formula, dice: [{ sides, value }], total }`.
- **Animação no cliente:** física com `@react-three/rapier` (ou `cannon-es`) numa bandeja sobre o palco. Técnica: simular o lançamento, identificar a face que ficou para cima e **remapear a numeração das faces** da malha para que essa face mostre o valor do servidor. O cliente nunca decide o resultado.
- Geometrias corretas: d4, d6, d8, d10 (trapezoedro pentagonal), d12, d20; d100 = dois d10 (dezenas + unidades).
- **Compartilhado:** rolagens `PUBLIC` aparecem para todos na mesa com cor/nome do personagem; `MASTER` aparece para quem rolou e para o mestre; `PRIVATE` só para quem rolou. Filtragem por destinatário no servidor (salas `user:{id}`), nunca por CSS.
- Crítico (20 natural em d20) e falha crítica (1 natural): brilho bronze ou rachadura vinho no dado + efeito sonoro `sfx`; texto “Crítico!” sempre visível.
- Bandeja não bloqueia o mapa; resultado textual aparece imediatamente, a animação é cosmética (≤ 2,5 s). Máximo de 10 dados físicos por rolagem; acima disso, mostrar só o resultado.
- Canvas de física só existe durante a animação (descarregado depois).

**Aceite:** dois jogadores veem o mesmo valor na face do dado; rolagem `MASTER` não chega ao socket do outro jogador; desativar animação mostra só o resultado; d10/d100 têm geometria correta.

### Onda 2 — Presença e drama (P2)

#### IM-05 / M — Presença, ping e “Olhem aqui” (detalha MV-07)

- Avatares online/ausente no `SessionShell` (ausente após 2 min sem foco/atividade).
- Ping: clique longo ou `P` + clique → onda animada na célula, cor do jogador, som curto; limite de 1 ping/s por usuário.
- Mestre: “Olhem aqui” centraliza a câmera de todos na região; jogador pode recusar seguir (`Seguir mestre: ligado/desligado`).
- Eventos `table:presence`, `table:ping`, `table:focus` por socket, apenas para membros do mapa ativo.

**Aceite:** ping aparece em < 300 ms para os demais; jogador com “Seguir mestre” desligado não tem a câmera movida.

#### IM-06 / M — Narração em pergaminho

- Mestre escreve (ou escolhe de rascunhos preparados) um texto narrativo e o envia para **todos** ou para **destinatários** escolhidos.
- Clientes exibem painel de pergaminho (componente `Handout` da spec visual) sobre o palco, EB Garamond 18/28, som de página; “Fechar” devolve o foco ao mapa.
- Opção “Registrar no diário” cria `CampaignJournalEntry` com o mesmo público.
- Rascunhos ligados a mapa/hotspot (`VttMap`/`VttMapHotspot`): ao chegar ao local, o mestre recebe sugestão “Ler narração de chegada?”.
- Destinatário filtrado no servidor (depende de salas por usuário, MV-10).

**Aceite:** jogador fora da lista não recebe o texto nem por socket nem pela API do diário; quem recebeu consegue reler no diário.

#### IM-07 / G — Combate com peso (depende de MV-09)

- Banner de turno “Vez de Kael” com retrato, por 1,5 s, e destaque persistente no `CombatTray`; som de turno opcional.
- Números flutuantes de dano/cura sobre o token (vinho/musgo + sinal `−`/`+`), também anunciados em `aria-live`.
- Vinheta vermelha nas bordas da tela **do próprio jogador** quando seu personagem está com PV ≤ 25%; pulsação só sem `prefers-reduced-motion`.
- Aura por condição no token (ícone + cor; ex.: envenenado, atordoado, caído), com legenda no inspetor.
- Movimento de token interpolado (200–300 ms) em vez de salto.
- Trilha `music` alterna para combate ao iniciar encontro e volta ao ambiente ao encerrar (liga IM-02).
- PV de monstros chega ao jogador como estado descritivo (`Ileso`, `Ferido`, `Muito ferido`, `À beira da morte`), nunca como número, se o mestre não autorizar.

**Aceite:** avançar turno atualiza banner e trilha em todos os clientes sem refresh; jogador não recebe PV numérico de monstro oculto.

#### IM-08 / M — Clima vindo do mundo

- Prisma: `CampaignCalendar.weather String @default("clear")` (`clear`, `cloudy`, `rain`, `storm`, `fog`, `snow`, `wind`) e `CampaignWorldEvent.weatherEffect String?`. Mestre muda clima manualmente no widget do relógio; evento sorteado com `weatherEffect` altera o clima.
- Emitido junto de `world:clock:updated` (o calendário já é público a membros).
- Efeito 2D/3D apenas em mapas externos: partículas (base em `ambient-particles.tsx`, limite de 150 partículas em 2D), neblina como gradiente, relâmpago raro em `storm` (desativado com movimento reduzido).
- Interiores recebem apenas som abafado (`ambience` com filtro passa-baixa) — “a chuva lá fora”.
- Preferência do jogador: partículas `completas / reduzidas / desligadas`.

**Aceite:** evento “Tempestade” muda clima, som e partículas para todos; interior mostra só o som; partículas desligadas não afetam o texto do clima no relógio.

#### IM-09 / P — Evento do mundo ao vivo

- Quando um `CampaignWorldEvent` é sorteado com jogadores conectados, mostrar cartão narrativo curto (título + primeira frase + “Ler no diário”) e som de sino/trompa conforme categoria.
- Sem jogadores conectados, o evento entra na crônica de retorno (IM-10).
- Evento `world:event:triggered` com o mesmo conteúdo já público do diário.

**Aceite:** evento sorteado durante a sessão aparece para todos uma única vez; não duplica entrada de diário.

### Onda 3 — O mundo tem voz (P3)

#### IM-10 / M — Crônica de retorno (apresentação de MV-11)

Ao entrar na campanha após ausência, cartão em pergaminho “Enquanto você esteve fora…” com: tempo de jogo decorrido (`3 dias e 4 horas se passaram`), clima atual, eventos sorteados, revelações recebidas e próxima sessão. Botão “Voltar à mesa”. Fonte: `lastSeenAt` por membro (`CampaignMember.lastSeenAt`) comparado com diário/eventos autorizados.

**Aceite:** jogador ausente vê só entradas autorizadas para ele; o cartão não reaparece na mesma visita.

#### IM-11 / G — Chat em personagem com idiomas do mundo (depende de MV-08)

- Mensagens com retrato do personagem, modos `em personagem`, `fora de personagem`, `/me` (ação) e sussurro.
- Prisma: `CharacterLanguage { characterId, worldEntryId }` ligando personagens a entradas `IDIOMA`.
- Mensagem enviada “em élfico”: **o servidor** envia o texto original a quem conhece o idioma (e ao mestre) e uma versão embaralhada determinística (mesmo comprimento de palavras, alfabeto do idioma) a quem não conhece, com rótulo “fala em élfico”. O original nunca chega ao cliente de quem não fala o idioma.
- Mestre pode “ensinar” um idioma durante a campanha (concede `CharacterLanguage`).

**Aceite:** inspeção do tráfego do jogador sem o idioma não contém o texto original; mestre sempre lê o original.

#### IM-12 / M — Assistente de cena para o mestre (módulo 10 do escopo original)

- Painel exclusivo do mestre: “Descrever cena”, “Improvisar NPC”, “Nome para…”, usando contexto autorizado do mestre (mapa atual, fase do dia, clima, entradas do mundo).
- Saída sempre vai para o mestre como rascunho; publicar exige ação explícita (vira IM-06).
- Chamada ao provedor de LLM no backend, com chave por ambiente, limite de uso por campanha e registro de custo; desligável por campanha.
- Decisão de provedor, custo e privacidade antes de implementar (ver Decisões).

**Aceite:** nenhum texto gerado chega a jogadores sem publicação do mestre; campanha com assistente desligado não faz chamadas externas.

#### IM-13 / G — Luz e visão por token (amplia MV-12)

Paredes/portas desenhadas pelo mestre, fonte de luz por token (tocha 6 células, lanterna, visão no escuro) e névoa dinâmica calculada **no servidor** (ou com projeção segura equivalente). Integra IM-01: à noite, áreas externas sem luz ficam escuras. Só iniciar após fog paritário 2D/3D (MV-12).

**Aceite:** jogador não recebe tokens/marcadores fora da área visível; trocar 2D↔3D não revela nada.

## Preferências de conforto (transversal)

Painel “Som e efeitos” no `SessionShell`, salvo por usuário (localStorage primeiro; servidor quando houver perfil de preferências):

| Preferência | Valores | Padrão |
| --- | --- | --- |
| Volume geral, música, ambiente, efeitos | 0–100 | 70 / 50 / 60 / 70, som desligado até o primeiro gesto |
| Intensidade de efeitos | completa / reduzida / mínima | `reduzida` se `prefers-reduced-motion`, senão `completa` |
| Partículas de clima | completas / reduzidas / desligadas | completas |
| Animação de dados | física / simples / só resultado | física |
| Seguir câmera do mestre | ligado / desligado | ligado |
| Banners de turno e cartões de chegada | ligados / desligados | ligados |

`mínima` desliga vinheta, relâmpago, tremor, partículas e zoom; mantém textos, sons opcionais e números.

## Orçamento de desempenho

- Mesa mantém ≥ 50 fps em notebook intermediário com clima + dia/noite ativos; nenhum efeito bloqueia input por mais de 100 ms.
- Partículas: ≤ 150 (2D) e ≤ 400 (3D); pausar quando a aba está oculta.
- Áudio: carregar só o preset atual e o próximo provável; total baixado por sessão típica ≤ 10 MB.
- Canvas de dados físicos montado apenas durante a rolagem.
- Em mobile (< 768 px), intensidade padrão `reduzida` e partículas `reduzidas`.

## Mudanças de dados e eventos (resumo)

| Item | Prisma | API / socket |
| --- | --- | --- |
| IM-01 | `VttMap.lightingMode` | campo no PATCH do mapa; reutiliza `world:clock:updated` |
| IM-02 | `VttMap.ambiencePreset`, `VttMap.musicTrack` | campos no PATCH do mapa (mestre) |
| IM-04 | `DiceRoll.campaignId`, `DiceRoll.visibility`, `DiceRoll.characterId` | `POST /dice/roll` estendido; `table:roll` por destinatário |
| IM-05 | — | `table:presence`, `table:ping`, `table:focus` |
| IM-06 | `NarrationDraft { mapId?, hotspotId?, content }`; público no diário (MV-10) | `scene:narration` por destinatário |
| IM-07 | condições/estado descritivo em `CombatParticipant` (MV-09) | `combat:updated` projetado por papel |
| IM-08 | `CampaignCalendar.weather`, `CampaignWorldEvent.weatherEffect` | payload de `world:clock:updated` |
| IM-09 | — | `world:event:triggered` |
| IM-10 | `CampaignMember.lastSeenAt` | `GET /campaigns/:id/since-last-visit` |
| IM-11 | `CharacterLanguage`, mensagens de chat (MV-08) | `chat:message` por destinatário com texto projetado |

## Dependências e sequência

1. **Agora (sem bloqueio):** IM-01, IM-02, IM-03 — usam dados já públicos para membros (calendário) ou já projetados por REST (mapa publicado). IM-02 e IM-03 devem ser acionados pela resposta da viagem/carregamento REST do jogador, **não** pelos eventos `vtt:map:*` atuais.
2. **Corrigir a projeção do socket (parte de MV-01) — feito em 12/10/2026, ver [estado no plano 09](./09-melhorias-mesas-vivas.md#estado-da-implementação):** `vtt.gateway.ts` emite o mapa completo para a sala. Antes de IM-04 e de qualquer item da Onda 2, criar salas por papel/usuário (`campaign:{id}:master`, `user:{id}`) e emitir `projectPlayerMap` para jogadores. Somar reconexão com snapshot (MV-03).
3. **Onda 2:** IM-04 (precisa de salas por destinatário), IM-05, IM-08, IM-09, depois IM-06 (com MV-10) e IM-07 (com MV-09).
4. **Onda 3:** IM-10 (com MV-11), IM-11 (com MV-08), IM-12 após decisão de provedor, IM-13 após MV-12.

## Como validar

### Teste de jogo de referência

Roteiro fixo de ~45 min com mestre + 2 jogadores em navegadores separados (um em celular): chegada à cidade de dia → viagem à taverna → anoitecer → evento “Tempestade” → combate curto → retorno no dia seguinte. Executar **antes** (versão atual) e **depois** de cada onda, com o mesmo roteiro.

Questionário ao fim (1 a 5), por participante:

1. Senti que estava naquele lugar.
2. Senti que estávamos jogando juntos, ao mesmo tempo.
3. Percebi a passagem do tempo no jogo.
4. Algum efeito me atrapalhou ou cansou? (qual)
5. Consegui fazer o que queria sem esperar animação.

Meta para considerar a onda validada: média das perguntas 1–3 sobe ≥ 1 ponto em relação ao “antes”; pergunta 5 ≥ 4; nenhum efeito citado por mais de um participante como incômodo sem que haja preferência para desligá-lo.

### Sinais objetivos

- Rolagens públicas e pings por sessão (Onda 2).
- Proporção de jogadores que desligam som/efeitos (alto = efeito mal calibrado).
- Tempo até o primeiro comando após viagem (transição não pode atrasar).
- fps médio e picos de frame no roteiro, em desktop e celular.

### Testes automatizados (Playwright, como na verificação da spec visual)

- Fase do dia muda overlay/luz ao receber `world:clock:updated` simulado; interior não muda.
- Com `prefers-reduced-motion`, nenhuma animação > 200 ms; cartão de chegada vira fade simples.
- Áudio não carrega antes do primeiro gesto; mudo persiste.
- Socket do jogador nunca recebe: mapa não publicado, rolagem `MASTER/PRIVATE` alheia, narração sem ser destinatário, texto original de idioma desconhecido, PV numérico oculto.
- Larguras 320, 375, 768, 1280 e 1440 px sem rolagem horizontal com clima e banners ativos.

## Decisões de produto antes de implementar

Respostas registradas em 12/10/2026: 1 = biblioteca própria (implementada como síntese procedural); 2 = clima global; 3 = rolagem pública por padrão; 4 = o mestre escolhe por encontro (descritivo por padrão); 5 = embaralhar; 6 = sem decisão, IM-12 fora do escopo por ora.

**Sobre a decisão 4:** com estado descritivo, o jogador vê “Ileso / Ferido / Muito ferido / À beira da morte” em vez de “PV 23/45”. Isso preserva o mistério (ninguém calcula quantos golpes faltam) e dá ao mestre margem para ajustar o encontro. Com PV numérico, o jogador planeja com precisão, ao custo de imersão. Uma opção por encontro permite os dois estilos; o mestre sempre vê os números.

**Decidido:** interruptor por encontro (`CombatEncounter.hpDisplay`: `DESCRIPTIVE | NUMERIC`), padrão descritivo, herdado do encontro anterior da campanha e alterável no meio do combate. O servidor só envia `currentHp`/`maxHp` de inimigos ao jogador no modo numérico; no descritivo envia o rótulo (100% Ileso · ≥ 50% Ferido · ≥ 25% Muito ferido · > 0 À beira da morte · 0 Caído). Aliados e mestre sempre veem números. Hoje `getEncounter` envia o PV de todos a qualquer membro, então esta mudança também fecha esse vazamento.

1. **Fonte dos áudios:** biblioteca própria CC0 empacotada (recomendado para começar) ou upload pelo mestre? Upload exige moderação, limites e verificação de licença. r: biblioteca própria CC0 empacotada para começar.
2. **Clima:** global da campanha (recomendado) ou por região/mapa? Por região é mais realista, mas multiplica configuração do mestre. r: faça o recomendado
3. **Rolagem padrão na sessão:** pública (recomendado, com opção explícita de mestre/privada) ou privada? r: faça o recomendado
4. **PV de monstros:** estado descritivo por padrão (recomendado) ou numérico, configurável por encontro? explique 
5. **Idiomas:** embaralhar texto (recomendado) ou ocultar totalmente para quem não fala? recomendado 
6. **Assistente de IA:** provedor, quem paga o custo, limites por campanha e se conteúdo da campanha pode sair do servidor. *Implementado com padrões seguros em 13/10/2026 (ver estado do IM-12); ajustáveis.*

## Fora do escopo

Voz/vídeo nativos (link externo de chamada atende por ora), trilhas com direitos autorais de terceiros, efeitos que dependam de hardware (vibração obrigatória, áudio espacial) e qualquer automação de regras que ainda não foi fixada no sistema próprio.
