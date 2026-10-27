# Plano de melhorias — mesas vivas de RPG online

Análise em 21/09/2026. Este documento propõe melhorias; não indica que elas já foram implementadas. O foco é a experiência de jogadores e mestre numa campanha que continua entre sessões. Captura de rede/SIP/PCAP não faz parte do produto.

## O que é uma mesa viva

Uma mesa viva combina cinco coisas: **presença** (saber quem está na sessão), **cena compartilhada** (todos veem o que o mestre apresentou), **agência** (jogadores agem com seus personagens), **consequência** (ações alteram mapa, combate, tempo e história) e **continuidade** (quem volta entende o que aconteceu). Efeitos 3D, áudio e automações ajudam, mas não substituem esses fundamentos.

Exemplo de fluxo desejado:

1. Mestre prepara uma cena sem revelá-la; jogadores entram por convite e escolhem personagem.
2. Mestre apresenta a cena; todos recebem o mesmo estado autorizado, com segredos ainda ocultos.
3. Jogador move seu token, aponta um local ou declara uma ação; a mesa mostra quem agiu e o resultado.
4. Uma viagem, rolagem ou turno altera o estado persistente; os demais recebem atualização em tempo real.
5. Quem se reconecta recebe uma fotografia atualizada; quem volta dias depois vê um resumo das mudanças.

## O que temos hoje

| Área | Evidência no projeto | Ajuste necessário para uma mesa viva |
| --- | --- | --- |
| Campanhas | Criação, membros e entrada por código em [`campaigns.service.ts`](../backend/src/campaigns/campaigns.service.ts). | Lobby/presença, personagem vinculado à campanha, convite com validade e controle do mestre. |
| Mesa | Mapas 2D/3D, tokens, marcadores, fog manual, medidas e hotspots em [`vtt-panel.tsx`](../frontend/src/components/campaigns/vtt-panel.tsx); persistência e eventos de mapa em [`vtt.service.ts`](../backend/src/vtt/vtt.service.ts) e [`vtt.gateway.ts`](../backend/src/vtt/vtt.gateway.ts). | Cena ativa, visão separada por papel, movimento do próprio token, pings e recuperação após reconexão. |
| Exploração | Viagem, pontos de ação e descanso em [`exploration.service.ts`](../backend/src/exploration/exploration.service.ts); tela dedicada em [`explore/page.tsx`](../frontend/src/app/campaigns/%5Bid%5D/explore/page.tsx). | Estado por personagem **e** campanha; transações; regras para ações simultâneas e tempo global. |
| Mundo | Relógio via Socket.IO, tick automático e eventos que entram no diário em [`world.service.ts`](../backend/src/world/world.service.ts) e [`world-tick.service.ts`](../backend/src/world/world-tick.service.ts). | Relógio atômico, pausa/modo de sessão e aviso em tempo real quando um evento narrativo ocorre. |
| Combate e dados | Combate com iniciativa/turnos em [`combat.service.ts`](../backend/src/combat/combat.service.ts); rolagens e histórico individual em [`dice.service.ts`](../backend/src/dice/dice.service.ts). | Atualização da mesa para todos, rolagens públicas/privadas por campanha e regra explícita de sincronização de HP com a ficha. |
| Diário | Entradas persistentes por campanha em [`journal.service.ts`](../backend/src/journal/journal.service.ts). | Handouts/revelações por destinatário, vínculos com cenas e resumo de “desde sua última visita”. |

O [roadmap de Mundo Vivo](./08-mundo-vivo.md) cobre mapas, relógio e exploração já implementados. A próxima etapa não deve repetir essas fases: deve ligar seus estados numa experiência colaborativa segura e coerente.

### Bloqueios observados no código atual

- **Segredos são escondidos apenas no cliente.** A API devolve todos os mapas com tokens, marcadores e hotspots a qualquer membro, sem projeção por papel; o gateway publica o mapa inteiro na mesma sala. `visible`, `visibleToPlayers` e `eventNote` chegam ao cliente mesmo quando a interface não os desenha. A nota de marcador descrita como privada também é exibida na seleção sem checar o papel. O seletor permite abrir qualquer mapa, contornando a viagem por hotspot. Isso inviabiliza segredos de mestre e fog confiável. Ver [`vtt.service.ts`](../backend/src/vtt/vtt.service.ts), [`vtt.gateway.ts`](../backend/src/vtt/vtt.gateway.ts) e [`vtt-panel.tsx`](../frontend/src/components/campaigns/vtt-panel.tsx).
- **A visão 3D não equivale à 2D.** O componente 3D desenha a superfície e tokens sem aplicar `fogCells` nem os hotspots navegáveis da visão 2D; até haver paridade, não deve oferecer ao jogador uma forma de contornar o ocultamento. Ver [`vtt-table-3d.tsx`](../frontend/src/components/campaigns/vtt-table-3d.tsx).
- **A sessão não se recompõe automaticamente.** Ao reconectar, o cliente reentra na sala, mas não recarrega mapa/relógio para recuperar mudanças perdidas. Combate e diário recente carregam dados inicialmente, sem eventos próprios de atualização. Ver [`vtt-panel.tsx`](../frontend/src/components/campaigns/vtt-panel.tsx), [`world-clock-widget.tsx`](../frontend/src/components/campaigns/world-clock-widget.tsx) e [`combat-panel.tsx`](../frontend/src/components/campaigns/combat-panel.tsx). A [documentação do Socket.IO sobre entrega](https://socket.io/docs/v4/delivery-guarantees/) confirma que eventos emitidos pelo servidor durante desconexão não são reenviados por padrão; mesmo a [recuperação de conexão](https://socket.io/docs/v4/connection-state-recovery/) não dispensa ressincronização quando falha.
- **A exploração permite estados incoerentes.** `CharacterExplorationState` é único só por `characterId`; viagem não valida `visibleToPlayers` e a primeira viagem pode começar por qualquer hotspot. Débito de pontos, avanço do relógio e criação de diário não formam uma transação única. Ver [`schema.prisma`](../backend/prisma/schema.prisma) e [`exploration.service.ts`](../backend/src/exploration/exploration.service.ts).
- **Tempo compartilhado carece de política de jogo.** Descanso de um jogador adianta o relógio global; o incremento do calendário é leitura seguida de escrita, e cada instância executa seu próprio cron. Antes de ampliar a campanha assíncrona, é preciso decidir quando uma ação individual pode mover o tempo de todos. Ver [`world.service.ts`](../backend/src/world/world.service.ts), [`world-tick.service.ts`](../backend/src/world/world-tick.service.ts) e [`exploration.service.ts`](../backend/src/exploration/exploration.service.ts).
- **Agência do jogador é limitada.** A alteração de token exige mestre no backend e no frontend; dados não têm `campaignId`/visibilidade, e não há chat, presença ou pings de mesa no código ativo. Ver [`vtt.service.ts`](../backend/src/vtt/vtt.service.ts), [`vtt-panel.tsx`](../frontend/src/components/campaigns/vtt-panel.tsx) e [`dice.service.ts`](../backend/src/dice/dice.service.ts).
- **Entrar e recuperar-se da sessão ainda exige atrito.** O ingresso usa código manual permanente e ocorre imediatamente, sem validade/aprovação; o HUD de exploração escolhe entre todos os personagens da conta. Falhas de API podem aparecer como lista vazia ou sumir em widgets, e a exclusão de campanha não pede confirmação. Ver [`campaigns.service.ts`](../backend/src/campaigns/campaigns.service.ts), [`exploration-hud.tsx`](../frontend/src/components/campaigns/exploration-hud.tsx) e [`campaigns/page.tsx`](../frontend/src/app/campaigns/page.tsx).

## Referências de outras mesas virtuais

As plataformas abaixo são referências de padrões de interação, não uma lista para copiar integralmente. Recursos, planos e disponibilidade podem mudar; os links apontam para documentação oficial consultada nesta análise.

| Padrão observado | Referência oficial | Aplicação recomendada aqui |
| --- | --- | --- |
| Entrada simples por link, sala e permissões por camada/dono. | [Owlbear Rodeo — salas](https://docs.owlbear.rodeo/docs/rooms/) e [permissões](https://docs.owlbear.rodeo/docs/permissions/). | Reduzir atrito ao entrar, mas manter autorização de personagem e segredos no servidor. |
| Mestre consegue direcionar a atenção dos jogadores ao mesmo ponto do mapa. | [Owlbear Rodeo — Sync View](https://docs.owlbear.rodeo/docs/casting/). | Comando “Olhem aqui”/ping e opção de seguir a câmera do mestre, sem prender a câmera permanentemente. |
| Preparar uma cena em privado e apresentá-la com conteúdo visual e ambiente. | [Alchemy — criação de cena](https://help.alchemyrpg.com/en/articles/9821311-creating-a-scene) e [orientação do mestre](https://help.alchemyrpg.com/en/articles/9714185-gamemaster-orientation). | Prévia do mestre, cena ativa e transição sincronizada; áudio por cena só depois do núcleo confiável. |
| Visão, iluminação, portas e notas do mapa ligadas a conteúdo narrativo. | [Foundry — luz](https://foundryvtt.com/article/lighting/), [paredes/portas](https://foundryvtt.com/article/walls/) e [notas do mapa](https://foundryvtt.com/article/map-notes/). | Primeiro projeção segura e fog manual; depois linha de visão, portas e handouts vinculados a locais. |
| Revelação de handouts, ocultação do mapa e ritmo de combate legível. | [Roll20 — handouts em encontros](https://help.roll20.net/hc/en-us/articles/29257977326871-7-Setting-up-non-combat-encounters), [Hide/Reveal](https://help.roll20.net/hc/en-us/articles/34086640235927-2024-Change-Log) e [Turn Tracker](https://help.roll20.net/hc/en-us/articles/360039178634-Turn-Tracker). | Dar ao mestre ações rápidas de revelar conteúdo e avançar turno; não automatizar regras antes de fixar o sistema adotado. |
| Conversa em personagem, sussurro e modos de visibilidade das rolagens. | [Foundry — chat](https://foundryvtt.com/article/chat/) e [rolagens](https://foundryvtt.com/article/dice/). | Uma trilha de atividade da campanha, persistente e filtrada por destinatário, antes de voz/vídeo próprios. |
| Registro de atividades e continuidade narrativa entre encontros. | [Quest Portal — recursos](https://www.questportal.com/features) e [Session Stories](https://www.questportal.com/blog/session-stories). | Criar linha do tempo da campanha e resumo personalizado desde a última visita. |

## Estado da implementação

- **MV-01 (12/10/2026), parte de mapas, combate e revogação:**
  - A API REST já projetava os mapas por papel ([`vtt.projection.ts`](../backend/src/vtt/vtt.projection.ts)). Agora o [`vtt.gateway.ts`](../backend/src/vtt/vtt.gateway.ts) também separa as salas `campaign:{id}:master` e `campaign:{id}:players`:
    - o mestre recebe o mapa completo;
    - jogadores recebem `projectPlayerMap`;
    - mapa em preparação não gera nenhum evento para jogadores;
    - publicar ou despublicar ressincroniza as projeções.
  - Sair, ser removido ou excluir a campanha tira o usuário das salas da mesa e do relógio na hora.
  - O PV de inimigos segue o modo do encontro (decisão 4 da [spec de imersão](./11-imersao.md)).
  - Na 2D, a névoa passou a ser opaca para o jogador (antes ficava a 65%, com o terreno visível); a régua não a atravessa.
  - A 3D desenha a névoa com a mesma regra, o que resolve a paridade de névoa do MV-12. Hotspots na 3D continuam pendentes.
  - Verificado com sockets reais (mestre, jogador e intruso):
    - nenhum evento do jogador contém nota privada, `eventNote`, token invisível ou nome de mapa não publicado;
    - token sob névoa sai da projeção;
    - intruso é recusado;
    - jogador removido para de receber mesa e relógio e recebe 403 na API.
  - Diário projetado (12/10/2026): entradas restritas só chegam ao autor, ao mestre e aos destinatários. A entrada automática de primeira visita deixou de copiar o `eventNote` privado.
- **MV-10 (parcial, 12/10/2026):** revelações de texto por destinatário, com registro opcional no diário e rascunhos sugeridos na chegada a um mapa (IM-06 da [spec de imersão](./11-imersao.md)). Faltam handouts com imagem e notas ligadas a hotspot.
- **MV-03 (parcial):** a mesa e o relógio recarregam o estado autorizado ao reconectar, e a mesa mostra “Reconectando…” enquanto o socket está caído. Falta `revision`/versionamento.
- **MV-09 (12/10/2026):** combate em tempo real com projeção por papel e eventos de cena (ver IM-07 na [spec de imersão](./11-imersao.md)). Diário e exploração já são cobertos por MV-01/IM-06. A sincronia de PV entre combate e ficha foi decidida e implementada em 13/10/2026 (ver MV-07 abaixo).
- **MV-12 (parcial, 13/10/2026):** a névoa já é igual em 2D e 3D. Visão dinâmica com paredes, portas, luz e visão no escuro, calculada no servidor, e prévia “ver como jogadores” para o mestre (IM-13 da [spec de imersão](./11-imersao.md)). Faltam hotspots e paredes na vista 3D. O foco de câmera “Olhem aqui” passou a funcionar também na 3D em 16/10/2026 (IM-05/MV-07).
- **MV-08 (12/10/2026):** conversa em personagem, ação, fora do personagem e sussurro, com projeção por destinatário no servidor. As rolagens com visibilidade já existiam (IM-04). Ver IM-11 na [spec de imersão](./11-imersao.md).
- **MV-07 (13/10/2026):** presença, ping e “Olhem aqui” implementados (ver IM-05 na [spec de imersão](./11-imersao.md)). O jogador move só o token do próprio personagem (arrastar, ou selecionar o token e clicar na célula; `PATCH .../tokens/:id/move`): o servidor confere dono, token visível, mapa publicado, limites, e que exista caminho pela grade sem atravessar parede ou porta fechada; em combate, quem está na iniciativa só anda no próprio turno. O jogador abre e fecha portas encostado nelas (até uma célula; `POST .../doors/toggle`); o mestre continua movendo qualquer token e mexendo em qualquer porta. Não há limite de deslocamento por turno (fica combinado à mesa). A recarga na reconexão não foi testada de ponta a ponta (exigiria derrubar a conexão no navegador).
- **PV combate ↔ ficha (13/10/2026):** dano ou cura no combate atualizam na hora o PV atual da ficha do personagem; mudar o PV na ficha ou fazer descanso longo atualiza o participante do combate e avisa a mesa. A ficha aberta relê o PV a cada 4 s e ao voltar para a aba.

## Backlog priorizado

Prioridade **P0** significa corrigir antes de uma mesa com jogadores reais; **P1** é o primeiro conjunto de funcionalidades novas; **P2** amplia imersão e alcance. Esforço `P/M/G` é relativo, não uma estimativa de prazo.

### P0 — Fundamentos para jogar sem vazamentos nem estados perdidos

| ID / esforço | Melhoria e ajuste no código atual | Critério de aceite |
| --- | --- | --- |
| MV-01 / G | Criar projeções `Mestre` e `Jogador` para mapas, tokens, hotspots, marcadores/notas e combate. API e Socket.IO enviam somente objetos/campos autorizados; mapa em preparação não aparece a jogadores. Revogar a sala de sockets quando alguém sair/for removido da campanha. | Um jogador não encontra `eventNote`, nota privada de marcador, token invisível, mapa não revelado ou HP secreto nem na resposta HTTP nem no tráfego WebSocket; remoção de membro corta atualizações. |
| MV-02 / G | Modelar exploração por `(campaignId, characterId)`; vincular personagem ao participante da campanha; validar hotspot visível, origem e destino. Fazer débito de AP, mudança de mapa, tempo e primeira visita de forma transacional/idempotente. | Duas campanhas do mesmo personagem não compartilham AP/local; viagem oculta/fora de origem falha; duas tentativas simultâneas não gastam AP duas vezes nem duplicam diário. |
| MV-03 / M | Definir fonte da verdade no servidor e `revision`/versão para mesa, combate, relógio e diário. Na conexão/reconexão, obter snapshot após autorização; ignorar eventos antigos e indicar estado de conexão na UI. | Após desconectar, alterar mapa e voltar, cliente e servidor exibem a mesma revisão; a UI informa quando está desatualizada. |
| MV-04 / G | Tornar avanço de relógio atômico; separar `lastTickAt` de `updatedAt`, coordenar o cron entre instâncias e limitar recuperação de ticks atrasados. Definir pausa automática durante sessão ao vivo. | Viagem/descanso/tick concorrentes não perdem minutos; dois processos não disparam o mesmo tick/evento; edição de calendário não reinicia contagem indevidamente. |
| MV-05 / M | Endurecer entrada de imagens remotas usada pelo mapa: allowlist ou bloqueio de endereços internos em cada redirecionamento, limites de tempo/tamanho e validação de conteúdo. Configurar origens HTTP/WS e segredo JWT por ambiente; revalidar sessão e tratar HTTP 401 no cliente. | URL local/privada é rejeitada, imagem grande expira com erro controlado, aplicação não inicia em produção sem segredo e sessão expirada retorna à autenticação com mensagem clara. Ver [`image-proxy`](../frontend/src/app/api/image-proxy/route.ts), [`main.ts`](../backend/src/main.ts) e [`auth.module.ts`](../backend/src/auth/auth.module.ts). |

### P1 — Interação real entre mestre e jogadores

| ID / esforço | Melhoria e ajuste no código atual | Critério de aceite |
| --- | --- | --- |
| MV-06 / G | Introduzir **lobby, sessão e cena ativa**: convite por link rotacionável/expirável, aprovação opcional, escolha explícita de personagem, estado `preparação → ao vivo → encerrada`, mapa ativo e prévia exclusiva do mestre. Botão “Apresentar cena” publica somente a projeção autorizada; “Voltar à mesa” recupera a cena atual. | Jogador não vê cena em preparação; convite vencido não permite ingresso; ao apresentar, todos mudam de cena sem recarregar; novo participante aprovado entra direto na cena ativa. |
| MV-07 / M | Adicionar presença (online/ausente), ping e foco de câmera. Permitir ao jogador mover **somente** seu token, com validação de propriedade e limites no servidor; mestre pode reposicionar qualquer token. | Dois jogadores veem presença/ping imediatamente; um não move token alheio nem altera campos administrativos; mestre conserva controle. |
| MV-08 / G | Criar trilha de atividade da sessão: chat em personagem/fora de personagem, sussurro, rolagem com visibilidade `pública / mestre / privada`, autor e horário. Reaproveitar o serviço de dados, adicionando contexto de campanha e limites de fórmula. | Resultado de dado é calculado no servidor uma vez, persistido e exibido apenas ao público escolhido; reconexão recupera histórico autorizado. |
| MV-09 / M | Emitir eventos de combate, diário e exploração, com snapshot de recuperação. Definir se HP do encontro altera ficha imediatamente ou só ao encerrar; separar atributos secretos dos monstros. | Avançar turno ou alterar HP atualiza todos os participantes sem refresh; jogador não recebe informação secreta; ficha e combate seguem a regra definida. |
| MV-10 / M | Transformar diário em **revelações**: handout de texto/imagem, notas ligadas a mapa/hotspot, público selecionado e botão “Mostrar aos jogadores”. Registro de descoberta aparece na linha do tempo. | Mestre revela uma pista a um ou mais participantes; quem não recebeu não a acessa por URL/API; quem recebeu pode consultá-la depois. |
| MV-11 / G | Criar rotina entre sessões: resumo “desde sua última visita”, eventos relevantes e próximos ganchos. Para ações assíncronas, usar pedidos/intenção pendente ou janela de resolução, em vez de deixar qualquer descanso individual avançar 8h para toda a campanha sem coordenação. | Jogador ausente entende o que mudou; mestre pode aprovar/resolver ações assíncronas; ações simultâneas têm ordem e consequência determinísticas. |

### P2 — Imersão, acessibilidade e ferramentas do mestre

| ID / esforço | Melhoria e ajuste no código atual | Critério de aceite |
| --- | --- | --- |
| MV-12 / G | Fechar paridade 2D/3D (fog e hotspots) antes de liberar 3D para jogadores; depois considerar luz por token, paredes/portas e prévia “visão do jogador” para o mestre. | Trocar 2D↔3D nunca revela conteúdo oculto; mestre consegue testar exatamente o que um jogador verá. |
| MV-13 / M | Ambiente por cena: música/efeitos opcionais, volume e mute locais, respeitando licença dos arquivos. Voz/vídeo nativos são decisão posterior; um link externo de chamada pode atender a primeira versão. | A cena troca trilha sem interromper controles do jogador; ninguém é forçado a ouvir áudio; licença/origem do asset é registrada. |
| MV-14 / M | Melhorar mobile, teclado e feedback: menu compacto, comandos de mapa acessíveis, navegação por setas na grade em vez de centenas de tabulações, rótulos de ícones, redução de movimento, estados de erro/retry e confirmação para exclusões. Separar o `vtt-panel.tsx` em componentes de cena, ferramentas, camadas e diálogos. | Fluxos de entrar, mover token, rolar e ler pista funcionam em celular e teclado; falha de API não parece “lista vazia”; exclusão pede confirmação; teste automatizado cobre interação principal. |

## Sequência recomendada de entregas

1. **Base segura:** MV-01 a MV-05, com testes de autorização, concorrência e reconexão. Se a visão 3D ainda não tiver fog seguro, ocultá-la para jogadores temporariamente.
2. **Primeira sessão viva:** MV-06 a MV-08. Um mestre apresenta a cena; dois jogadores entram, aparecem online, movem seus tokens, apontam lugares e rolam dados compartilhados.
3. **Consequência e retorno:** MV-09 a MV-11. Combate, descobertas e tempo entram numa linha do tempo consistente e recuperável após ausência.
4. **Imersão opcional:** MV-12 a MV-14, sem prejudicar dispositivos modestos nem acessibilidade.

Para cada entrega, testar ao menos: mestre + dois jogadores em navegadores separados; usuário removido; desconexão de um jogador; duas ações simultâneas; acesso direto a URL/API; troca entre 2D e 3D.

## Decisões de produto antes de implementar

1. **Tempo da campanha:** no modo ao vivo, descanso/viagem individual avança o relógio imediatamente, exige confirmação do mestre ou entra numa fila de intenções? Sugestão: mestre controla avanços globais na sessão; fora dela, resolver intenções assíncronas por janela/agenda.
2. **Descoberta:** fog, mapa e pistas pertencem ao grupo inteiro ou a cada personagem? Sugestão inicial: cena e fog do grupo; segredos e handouts por destinatário.
3. **Personagem na campanha:** um personagem pode participar de várias campanhas? Se sim, exploração e recursos de campanha não podem compartilhar a mesma linha de estado.
4. **Rolagem:** padrão público ou privado? Sugestão: público por padrão na sessão, com opção explícita de mestre/privado e registro auditável do resultado.
5. **Regras de HP:** combate é a fonte da verdade ou uma projeção temporária da ficha? Definir antes de sincronizar automaticamente.

## Como medir se melhorou

- **Segurança:** zero campos secretos em respostas/eventos destinados a jogadores; testes automatizados para membro, não membro e ex-membro.
- **Confiabilidade:** após reconexão, snapshot do cliente igual ao estado autorizado do servidor; relógio avança exatamente uma vez por ação/tick.
- **Uso:** um convite leva à cena ativa em poucos passos; mestre revela uma pista ou foca o grupo com uma ação; jogador que retorna vê imediatamente o que mudou.
- **Acessibilidade:** ações centrais possíveis com teclado e em largura de celular, sem navegar célula por célula por toda a grade.

Este plano evita tratar 3D, IA ou voz como sinônimo de “mesa viva”. O diferencial deve ser uma história que todos conseguem acompanhar, influenciar e retomar com confiança.
