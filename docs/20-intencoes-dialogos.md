# MI-06A — intenções dos jogadores e diálogos persistentes

Implementação de 17/10/2026. Primeiro incremento da MI-06, sobre o [copiloto MI-05](./19-mestre-copiloto.md). Entrega o ciclo jogador → consulta contextual → revisão do mestre → resposta ou esclarecimento → continuação. A liberação de ações autônomas continua dependendo da avaliação humana e da política de capacidades prevista na [spec principal](./13-mestre-ia-lore.md).

## Experiência na mesa

O botão **Intenções** abre a cena atual, os personagens do usuário vinculados ao cenário e os NPCs presentes. O jogador descreve o que pretende fazer ou perguntar. Escolher um NPC produz uma consulta `NPC`; escolher a cena produz `PUBLIC`. O jogador não pode solicitar planejamento privado `PLAN` nem assumir outro personagem.

A conversa é reservada ao autor e ao mestre. Outros jogadores não recebem pedidos, rascunhos, respostas ou contadores dessas conversas. O chat da mesa permanece disponível para conversa pública e fora do personagem.

O mestre vê o pedido, o rascunho privado e as fontes citadas. Pode usar e editar o rascunho, responder manualmente ou pedir esclarecimento. A escolha **Pedir esclarecimento ao jogador** abre um campo de resposta para o autor. O novo pedido mantém personagem, NPC e vínculo com a pergunta anterior. Há uma intenção ativa por personagem; duplicações de envio retornam o pedido original.

Somente texto revisado chega ao jogador. A resposta gera um evento `NOTE` restrito ao autor, também legível pelo mestre em Memórias. Ela não aplica viagem, descanso, dano, recompensa, transferência de item ou descoberta de conhecimento. Esses efeitos continuam nos comandos de domínio. Uma frase como “pego o badajo” é uma intenção, não comprovação de que a ação aconteceu.

## Persistência e contexto

`GameMasterTurn` ganha três campos opcionais, preservando os turnos anteriores:

| Campo | Uso |
| --- | --- |
| `playerEntityId` | Identifica intenção de jogador e a entidade de seu personagem. |
| `parentTurnId` | Liga a continuação à pergunta anterior. Uma pergunta admite uma continuação. |
| `replyKind` | `ANSWER` encerra o pedido; `ASK` aguarda esclarecimento. |

Novo estado `WAITING_PLAYER`. Uma resposta conclusiva termina em `COMMITTED`. Uma pergunta aprovada grava o evento e passa a `WAITING_PLAYER`; enviar o esclarecimento conclui o turno pai e cria o filho na mesma transação. Cancelar uma pergunta já entregue preserva seu evento, mas fecha a possibilidade de continuar aquele pedido.

As referências de personagem e turno pai incluem a campanha. O pai deve pertencer ao mesmo autor, personagem, NPC e revisão da cena. O caminho genérico de aprovação do copiloto recusa intenções de jogador: a resposta passa pelo contrato específico de audiência restrita.

O contexto usa as projeções MI-05: fontes públicas para cena; apenas conhecimento do NPC para sua fala. Acrescenta no máximo três pares de pergunta/resposta **já revisada** da mesma conversa. Rascunhos rejeitados e conversas de outros jogadores nunca entram. Se exceder 10.000 bytes, remove pares antigos inteiros e sinaliza `conversationOmitted`. Fatos essenciais seguem o limite e a recusa existentes. O histórico completo permanece nos registros ligados por `parentTurnId`, embora a tela mostre todos os pedidos ativos e apenas os trinta encerrados mais recentes.

## Revisão, pausa e recuperação

Antes e depois da inferência, e antes de publicar, o servidor confere participação atual, posse do personagem, vínculo com a campanha, revisão da cena e presença do NPC. Remoção do jogador, transferência do personagem ou mudança de cena impedem a resposta pendente. Rascunhos também exigem revisão global e geração de configuração atuais.

Se o contexto global mudou, o mestre pode conferir o estado atual e responder manualmente. A opção manual é explícita; não reaproveita silenciosamente uma decisão do modelo. Se a própria cena ou o participante mudou, é necessário cancelar o pedido e enviar outro.

O provedor continua com uma inferência por processo, timeout e uma tentativa de reparo. A fila compartilha os limites de três gerações pendentes por campanha e 120 pedidos por dia. Intenções têm limite adicional de trinta por autor/campanha em 24 horas. Quando a inferência está desligada, pausada ou sem espaço na fila, o pedido fica disponível para resposta humana. Falha do modelo também permite essa resposta.

Pausar/desligar cancela gerações, rascunhos e perguntas ainda abertas. Respostas tardias não os reabrem. Novas intenções durante a pausa seguem apenas para atendimento humano. Responder manualmente durante uma inferência encerra a concessão: o resultado tardio não substitui a resposta já entregue.

Publicação, audiência, evento, outbox e estado do turno pertencem à mesma transação. Falha tardia reverte tudo. Repetir a publicação com texto/tipo idênticos retorna o evento original; texto ou tipo diferentes geram conflito. Cancelar não apaga o histórico.

O frontend consulta o estado a cada três segundos enquanto visível, recarrega ao reconectar e escuta `story:updated` autorizado. Troca de identidade limpa a tela; perda de acesso remove os dados da interface. Não há transmissão pública de progresso privado.

## API

Prefixo `/api/campaigns/:id/intents`, JWT obrigatório e respostas sem cache.

| Rota | Autorização e entrada |
| --- | --- |
| `GET /` | Mestre recebe as intenções; participante recebe somente as próprias, sem snapshot, rascunho, fontes, diagnósticos ou revisão global. |
| `POST /` | Autor com personagem próprio: `{ requestKey, playerEntityId, prompt, expectedSceneRevision, focusEntityId?, parentTurnId? }`. Retorna 202 com ID. |
| `POST /:turnId/respond` | Mestre: `{ text, kind: ANSWER|ASK, source: DRAFT|MANUAL, expectedRevision }`. |
| `POST /:turnId/cancel` | Mestre ou autor. Recusa cancelamento de uma resposta já concluída. |

## Migração e verificação

Migration aditiva `20261017040000_player_intents`: três campos opcionais, valor de enum, índices e FKs. Backup anterior em `backend/backups/lore-migration/2026-10-17T17-28-56.302Z/`: 60 tabelas e 3.451 registros. O ensaio restaura essa cópia em base descartável `rpg_lore_check_<timestamp>` antes de testar.

Aplicada em `localhost:3306/rpg`. As **60 tabelas de aplicação e os 3.451 registros anteriores mantiveram hashes idênticos**, sem divergência entre schema e banco. Relatório em `mi06a-applied.json` no diretório do backup. Nenhuma campanha real recebeu lore, ativação ou mensagens de teste.

Integração cobre autorizações, injeção de campos, envio/revisão concorrentes, ocultação dos rascunhos, audiência restrita, pergunta/continuação, fontes do NPC, rascunho desatualizado, cancelamento/pausa durante inferência, perda de participação/posse, mudança de cena, modelo indisponível, atendimento humano e rollback completo. Reinício em outro processo confirma a pergunta persistida e o direito do autor de responder. Pedidos ativos continuam visíveis mesmo após mais de trinta registros encerrados.

Passaram os builds de backend/frontend, lint dos arquivos alterados, os 66 testes existentes, regressões de instalação/memória/comandos/copiloto e a nova integração. O navegador verificou envio com perda de resposta e repetição, rascunho privado, pergunta editada, esclarecimento após recarga, resposta manual com modelo desligado e remoção de acesso. Capturas desktop/celular foram inspecionadas; sem estouro horizontal na página nem erros JavaScript do cliente.

### Gemma real

Com o mesmo `gemma2:9b` Q4_0 e hardware registrados na MI-05, a bateria repetida passou em **35/40** critérios: fatos **10/10**, NPCs **7/10**, propostas mecânicas **10/10**, limites de audiência/capacidade **8/10**. Mediana **7.312 ms**, p95 **12.931 ms**, maior entrada **1.975 tokens**. Houve um pedido rejeitado de **61.186 ms**, incluindo as duas tentativas; o p95 não descreve esse pior caso.

As cinco falhas (`dalia-1`, `dalia-3`, `dalia-4`, `public-4`, `unsupported-2`) continuaram produzindo `ANSWER` sem evidência, às vezes escrevendo `ASK:` dentro do texto. Foram recusadas. A revisão não encontrou revelação dos segredos procurados nos casos de NPC/público, mas respostas irrelevantes ainda passam em critérios que verificam apenas limites de capacidade. Esses números não medem qualidade integral nem liberam autonomia.

O ensaio adicional do novo fluxo passou em **2/2 pedidos reais pela fila**: pergunta a Mara e esclarecimento ligado à pergunta aprovada. Ambos recuperaram Oren como contratante, com fontes do conhecimento de Mara. Tempos de **9.142 ms** e **7.859 ms**; entradas de 957 e 986 tokens. O segundo snapshot continha o par anterior revisado. O jogador recebeu apenas a pergunta humana do teste; nenhum rascunho do modelo foi publicado. As respostas ainda vieram em terceira pessoa, indicando espaço para melhorar a interpretação de NPC.

Evidências preservadas em `backend/backups/player-intents-model/latest.json`, `summary.json` e `dialogue.json`. A base descartável foi removida após o ensaio; backups e capturas permanecem. Isso verifica uma conversa curta, não substitui a sessão humana prolongada.

Comandos em `backend`, com base descartável preparada:

```sh
npm run build
node scripts/game-master/run-rehearsal.cjs --intents
node scripts/game-master/run-rehearsal.cjs --intents-browser
node scripts/game-master/run-rehearsal.cjs --dialogue-model
```

O teste de navegador exige frontend na porta 3100 e Playwright, com `LORE_PLAYWRIGHT_MODULE` se necessário. Relatórios e capturas ficam em `backend/backups/player-intents-browser/`. A suíte usa usuários e campanhas de teste; nenhuma conversa é enviada a jogadores reais.

`--dialogue-model` usa o Ollama real em dois pedidos encadeados, atravessando a fila persistida. O histórico recebe uma pergunta humana de teste; os rascunhos gerados não são publicados. A opção `--model` repete a bateria MI-05; `GAME_MASTER_EVAL_DIR=backups/player-intents-model` separa seus relatórios dos resultados históricos. `npm run test:player-intents` executa a integração quando `DATABASE_URL` já aponta explicitamente para uma base descartável.

## Próximos incrementos da MI-06

Atualização: a [MI-06B](./21-prazos-do-mundo.md) implementa política e prazos determinísticos de NPCs, com autorização humana, pausa, revisão e eventos separados de partida/chegada. NPCs em trânsito ficam indisponíveis nas conversas. As pendências de autonomia do modelo descritas abaixo permanecem.

O modo `AUTOMATIC` ainda não é aceito pela API. `AI_MASTER` continua recusado pelos comandos genéricos. Para liberar autonomia, faltam a sessão humana de 45–60 minutos, avaliação de diálogo aberto e uma política persistida que autorize capacidades, destinatários, rotas e orçamento por campanha.

Viagem automática deve exigir intenção inequívoca, rota autorizada, grupo elegível e orçamento de tempo, revalidados no commit. Revelação de NPC exige condições editoriais de disposição para falar, além de conhecimento: saber um segredo não significa estar autorizado a revelá-lo. Prazos de NPC devem usar minutos de jogo, precondições tipadas e evento idempotente; não uma descrição livre que o modelo interprete como comando. Cada capacidade deve manter pausa, cancelamento e fallback humano e ser validada nos dois caminhos completos do arco previstos na spec.
