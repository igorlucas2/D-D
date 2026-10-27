# MI-03 — História, descobertas e conhecimento

> Registro da etapa MI-03. [MI-04](./18-comandos-grupo.md) acrescentou comandos físicos, cinco fatos de localização e outbox; os números da seção de migração abaixo registram a entrega MI-03.

Entrega de 17/10/2026, continuação do [mundo persistente](./16-mundo-persistente.md) e da [spec MI](./13-mestre-ia-lore.md). A campanha agora mantém acontecimentos, fatos versionados, crenças, descobertas, relações, promessas e fios narrativos no MySQL. A condução continua humana; Gemma entra em MI-05.

## Usar na mesa

1. Abra **Campanhas → sua campanha → Memórias**. O caderno **Cenário** também tem um link para essa tela.
2. O mestre usa **Registrar na memória** para registrar acontecimentos, novas informações, evolução de fatos, correções, descobertas, relações, promessas e andamento dos fios.
3. Cada informação pode ser reservada ao mestre, compartilhada com a mesa ou destinada a membros escolhidos. Compartilhar um texto para leitura não equivale a declarar que todos os personagens o descobriram.
4. Para uma descoberta, escolha a informação, os NPCs/personagens que a receberam, a postura (sabe, acredita ou suspeita) e a origem. O dono do personagem recebe a informação privadamente. A origem também fica visível para ele: não coloque nela segredos que não foram revelados.
5. Use **Ver versões** para consultar o texto anterior e o acontecimento que fundamentou cada mudança. Premissas fixas e rumores só mudam por **Correção**, com motivo explícito.

O mestre pode buscar informações e filtrar conhecimentos por personagem. Jogadores veem somente fatos compartilhados, seus conhecimentos e registros autorizados; não recebem o elenco privado, números de confiança/medo, avaliações de veracidade de rumores ou indicadores de atividade secreta.

## Separar verdade, crença e acesso

Uma informação tem identidade estável e versões imutáveis. `EntityKnowledge` aponta para a **versão observada**, não para o fato atual. Exemplo: após registrar que o caixote foi transportado para a abadia, a memória de Mara continua mostrando a mina até uma nova observação. O mestre vê que esse conhecimento está desatualizado; a projeção do personagem não recebe um aviso que denunciaria uma mudança secreta.

Os 23 fatos editoriais e cinco rumores são importados como 28 informações distintas. Rumores têm `kind=CLAIM`; uma crença em R01 não modifica C05/C09, que identificam os responsáveis. A avaliação editorial de veracidade é exclusiva do mestre. Um rumor não pode ser registrado como `KNOWN`; confirmar uma afirmação exige um fato separado ou a descoberta do fato correspondente.

As 16 observações iniciais dos NPCs vêm do pacote instalado. Os quatro fios e as relações editoriais também são copiados. Confiança/medo começam em zero como escala ainda não avaliada pelo mestre; o vínculo qualitativo original continua descrito em português. Uma dívida editorial não cria uma promessa executável nem uma recompensa.

`PUBLIC` significa acesso dos usuários da mesa. Conhecimento pertence à entidade narrativa. Um jogador pode ler um anúncio público sem que todos os personagens sejam marcados como testemunhas. Estar conectado, abrir um mapa, ler chat ou escrever no diário não cria fatos, descobertas ou promessas automaticamente.

## Modelo implementado

Migration: [`20261017010000_story_memory`](../backend/prisma/mysql-migrations/20261017010000_story_memory/migration.sql). Adiciona 11 tabelas e `CampaignLore.storySequence`, mantendo as tabelas anteriores.

| Modelo | Contrato |
| --- | --- |
| `StoryEvent` | Sequência única por campanha, minuto de jogo, data de registro, ator `USER/SYSTEM`, chave/hash idempotente, resumo e payload versionado. Correção referencia evento anterior. |
| `EventEntity` | Liga acontecimentos a entidades da mesma campanha por FKs compostas. |
| `StoryFact` | Identidade/chave, natureza `FACT/CLAIM`, classe `FIXED/MUTABLE`, predicado `ASSERTION` e número da versão atual. |
| `StoryFactRevision` | Texto, versão, evento de origem, audiência e avaliação editorial opcional. Versões anteriores não são sobrescritas. |
| `StoryFactSubject` | Assuntos/entidades de um fato, com integridade dentro da campanha. |
| `EntityKnowledge` | Observação imutável: conhecedor, versão observada, postura, origem e evento. A observação mais recente por fato representa a postura atual. |
| `StoryAudience` / `StoryAudienceMember` | Visibilidade de eventos, versões e estados narrativos; destinatários são usuários reais e precisam pertencer à campanha. |
| `StoryRelationship` | Relação dirigida, descrição, confiança −100 a 100, medo 0 a 100 e evento de origem. Mudanças guardam o estado anterior no evento. |
| `StoryPromise` | Quem promete, beneficiário, termos, estado `OPEN/FULFILLED/BROKEN/CANCELLED`, resolução e evento. Encerramento repetido não reaplica efeitos. |
| `StoryThread` | Objetivo, critério, consequência editorial, estado `OPEN/RESOLVED/ABANDONED`, justificativa e evento. |

Os JSONs de eventos contêm `{ schemaVersion: 1, operation, before }` e são privados ao mestre. A projeção de jogador entrega somente o resumo aprovado, tipo e datas. Nenhuma API aceita SQL, predicado livre ou um comando mecânico dentro do texto.

Eventos e observações são somente acrescentados pelos serviços. Não existem endpoints para apagá-los ou editar seu conteúdo. A exclusão explícita da campanha remove também seu histórico, em ordem compatível com as FKs; uma correção narrativa não usa essa operação. As credenciais administrativas do MySQL continuam tendo poder sobre o banco, portanto essa regra não substitui backups operacionais.

## Escrita e recuperação

Toda escrita exige o mestre proprietário. A transação `Serializable` bloqueia a linha da campanha, revalida acesso, compara `expectedRevision` e grava audiência, evento, estado e revisão juntos. Até três tentativas tratam conflitos transacionais; uma revisão desatualizada gera 409, sem aplicar metade da operação.

`requestKey` é UUID por campanha e o hash usa JSON canônico, incluindo a revisão apresentada. Reenviar a mesma operação/chave devolve o resultado confirmado, mesmo que outras mudanças tenham ocorrido. Reutilizar a chave com conteúdo diferente é conflito. A interface preserva a requisição após falha de rede; após 409, atualiza o estado e exige novo envio humano. Não há reenvio automático de uma intenção sobre um estado diferente.

Novas instalações chamam `seedStory` **dentro da transação MI-02**. O evento `GENESIS`, de autoria `SYSTEM`, identifica o snapshot e seu hash, sem criar login do mestre artificial. Leituras usam apenas registros instalados; não recarregam o pacote editorial nem dependem do processo de IA.

Uma campanha MI-02 anterior apresenta **Preparar memória do cenário**. Essa operação explícita e idempotente importa o snapshot instalado, preservando mapas, NPCs, PV, personagens e calendário. Registra que se trata de importação das premissas, com a data original da instalação. Se a campanha já tiver evoluído por condução humana, o mestre deve revisar/corrigir essas premissas antes de usá-las como estado atual. Não se reconstrói um passado a partir do chat.

O snapshot usa leitura `RepeatableRead`. A interface recarrega ao voltar à janela, recuperar conexão e a cada dez segundos enquanto está visível. Atualizações atrasadas de outra consulta são descartadas; páginas antigas do histórico já abertas são novamente consultadas. Nenhuma retomada reexecuta comandos.

Na entrega MI-03, a recuperação era HTTP. [MI-04](./18-comandos-grupo.md) acrescentou `story:updated` e outbox durável, com revalidação de audiência/membros e payload de invalidação sem texto/revisão global. Cada leitura revalida a associação à campanha e limpa a tela quando o acesso é recusado. A busca de acontecimentos filtra audiência **antes** da paginação (50 por página); o cursor é um evento visível. Jogadores não recebem sequências globais, revisão global, contagens ocultas ou cursores de eventos privados.

## APIs

Prefixo `/api`, JWT obrigatório, respostas `private, no-store` ou `no-store`.

| Rota | Acesso e resultado |
| --- | --- |
| `GET /campaigns/:id/story/state?q=&entityId=` | Snapshot projetado. Mestre consulta todos os estados; jogador recebe leitura autorizada e conhecimentos próprios. Filtro de personagem alheio é recusado. |
| `GET /campaigns/:id/story/events?q=&entityId=&before=` | Acontecimentos autorizados, mais recentes primeiro, e cursor da próxima página. Filtro por entidade reservado ao mestre. |
| `GET /campaigns/:id/story/knowledge/:entityId` | Contexto limitado ao que a entidade observou. NPC: somente mestre. Personagem: mestre ou dono. Sem verdade atual, avaliações ou alertas de conhecimento desatualizado. |
| `GET /campaigns/:id/story/facts/:factId/history` | Mestre: versões e registros de origem, inclusive correções. |
| `POST /campaigns/:id/story/initialize` | Mestre: prepara memória de instalação anterior, sem reexecutar mundo/mapas. |
| `POST /campaigns/:id/story/commands` | Mestre: `{ requestKey, expectedRevision, operation }`; operação discriminada e validada por schema fechado. |
| `POST /campaigns/:id/story/corrections` | Mesmo contrato/transação, aceitando somente `operation.kind=CORRECTION`. |

Operações: `NOTE`, `FACT_CREATE`, `FACT_UPDATE`, `CORRECTION`, `DISCOVER`, `RELATIONSHIP`, `PROMISE_CREATE`, `PROMISE_RESOLVE`, `THREAD_UPDATE`. A audiência é `{ scope: MASTER|PUBLIC|RECIPIENTS, recipientIds: [] }`; somente `RECIPIENTS` aceita e exige destinatários. Descobertas derivam destinatários dos personagens; encerrar promessa conserva a audiência original. Conteúdo compartilhado pode revelar nomes/termos: a escolha de publicação pertence ao mestre.

Uma descoberta via API pode apontar para uma versão antiga para registrar uma observação tardia. A interface oferece a versão atual. Fios podem ser reabertos com justificativa; promessas encerradas não podem ser cumpridas novamente. Os termos originais e seus resultados ficam no histórico, sem inferir entrega de itens ou pagamentos.

## Verificação e operação

- Backup anterior: `backend/backups/lore-migration/2026-10-17T15-49-50.331Z/`, com snapshot das 46 tabelas e `schema.before.prisma` válido para a base anterior. Credenciais não são exportadas para documentação.
- Ensaio: migrations aplicadas em base descartável, restauração das 46 tabelas e comparação de hashes; regressão da instalação MI-02 aprovada.
- Migration aplicada em `localhost:3306/rpg`: **57 tabelas de aplicação**, sem divergência entre schema e banco. Os **3.451 registros das 46 tabelas anteriores mantiveram hashes idênticos**. Nenhuma campanha existente foi semeada ou modificada automaticamente.
- Integração MI-03: criação inicial, preparo de campanha anterior, rumor sem mudar cânone, descoberta individual, conhecimento desatualizado, contexto restrito de NPC, correção preservando versão, promessa idempotente, relações/fios, concorrência, falha injetada após gravação parcial, FKs entre campanhas, busca/paginação sem segredo e remoção de membro.
- Reinício real: processo do backend encerrado e outro processo Node iniciado; fatos/revisões, conhecimentos, promessa e fio foram recuperados do MySQL.
- Interface: registro, repetição após resposta perdida, descoberta privada, histórico de versões, retomada do jogador e projeções desktop/celular. Capturas em `backend/backups/story-browser/`.
- Builds de produção, TypeScript, lint dos arquivos alterados e 66 testes existentes do backend verificados.

Comandos em `backend`:

```sh
npm run db:generate
npm run build
npm test -- --runInBand
npm run lore:validate
npm run test:lore-http
```

`npm run test:story` exige `DATABASE_URL` numa base descartável `rpg_lore_check_<timestamp>`, com migrations e catálogo. `node scripts/story/run-rehearsal.cjs` usa a base de ensaio apontada pelo backup; `--browser` também exige frontend na porta 3100 e Playwright/Chrome disponíveis, podendo usar `LORE_PLAYWRIGHT_MODULE`. Não execute testes de escrita em `rpg`. `scripts/lore/migration.cjs verify` compara somente campos/tabelas presentes no backup, permitindo adição de colunas; não deve ser usado após alterações legítimas dos jogadores para exigir dados antigos.

Recuperação operacional: manter as tabelas novas ao voltar temporariamente ao código anterior; uma restauração integral deve ser ensaiada numa base separada antes de escolher o destino. Não apagar história nova para corrigir um fato narrativo.

## Limites e próxima etapa

Os fatos gerais desta fase são afirmações narrativas versionadas. Escrever “o caixote foi levado” **não altera automaticamente** `CampaignPlotObject`, a cena, tokens ou inventário. [MI-04](./18-comandos-grupo.md) passou a vincular C07 e cinco fatos de localização ao estado físico: esses fatos só mudam pelos comandos de domínio, junto com os eventos, e deixam de aceitar edição/correção narrativa livre. A suíte MI-03 usa uma afirmação independente para testar correções e observações antigas; o transporte físico é testado na suíte MI-04.

MI-03 não incluiu resumos gerados, embeddings, execução automática de prazos/recompensas ou Gemma. A viagem coletiva e sincronização durável foram entregues em MI-04. Não foi realizada uma sessão humana de 45–60 minutos; a continuidade foi exercitada por cenários automatizados e pelo fluxo real no navegador. Propostas por IA continuam previstas para MI-05.
