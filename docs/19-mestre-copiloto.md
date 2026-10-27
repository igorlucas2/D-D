# MI-05 — mestre copiloto local

> Registro da etapa MI-05. A [MI-06A](./20-intencoes-dialogos.md) acrescenta intenções privadas dos jogadores, esclarecimentos e continuação persistida, mantendo revisão humana. Os resultados de modelo desta página pertencem à avaliação de MI-05.

Implementação de 17/10/2026, continuação dos [comandos MI-04](./18-comandos-grupo.md). A IA consulta o MySQL, propõe uma resposta ou ação e aguarda revisão humana. O estado da campanha continua pertencendo aos serviços de domínio, não à conversa do modelo.

## Uso na mesa

O mestre abre **Copiloto**, liga o modo e escreve um pedido. Há três consultas:

| Consulta | Contexto e uso |
| --- | --- |
| Planejar ou consultar fatos privados (`PLAN`) | Fatos canônicos, estados relevantes, rotas, participantes, fios, promessas e acontecimentos. Pode responder, pedir esclarecimento ou propor viagem, descanso ou descoberta. |
| Preparar fala de NPC (`NPC`) | Apenas identidade/voz/objetivo e últimas observações daquele NPC. Não recebe verdade global ou conhecimentos de outros NPCs. Exige presença na cena. Só produz texto/pergunta. |
| Preparar narração pública (`PUBLIC`) | Cena, participantes, rotas publicadas, fatos e eventos públicos. Não recebe plano privado ou conhecimento reservado do NPC. Só produz texto/pergunta. |

Toda saída inicial é **privada para o mestre**. A tela mostra as fontes citadas e descreve o efeito usando dados do servidor. O mestre pode editar o texto e escolher entre registro privado ou publicação para a mesa. Essa escolha é explícita; texto gerado não é publicado automaticamente.

Aprovar viagem/descanso executa o comando MI-04 com suas precondições. Aprovar descoberta exige um NPC presente com observação persistida daquela revisão e destinatários presentes; rumor continua crença/suspeita. O mestre confirma que a conversa aconteceu. Resposta/pergunta aprovada vira `NOTE`, sem mudar fatos canônicos, inventário, PV ou promessas por interpretação de texto.

Esta entrega oferece consultas **somente ao mestre humano**. Jogadores leem resultados autorizados em Memórias, usam Comandos para intenções mecânicas e não têm acesso aos pedidos/contextos privados. A caixa livre de intenções dos jogadores, respostas a perguntas pendentes e turnos autônomos ficam para a evolução seguinte.

## Contrato de proposta

O adaptador pede JSON fechado com `kind`, `text`, `evidenceIds`, `routeId`, `restType`, `revisionId`, `knowerIds` e `sourceNpcId`. Tipos permitidos: `ANSWER`, `ASK`, `TRAVEL`, `REST`, `DISCOVER`. Campos não utilizados devem ser `null` ou lista vazia.

Validação em duas camadas: o formato do Ollama restringe campos e enums; Ajv aplica limites completos no backend. A gramática é especializada por tipo de consulta/ação: força campos inativos a `null`/lista vazia e permite somente IDs de fontes, rotas e personagens do snapshot. Limites de repetição grandes na gramática do Ollama local provocaram erro de compilação, portanto tamanhos/quantidades são validados após a geração, junto com referências e política. A resposta não é aceita apenas porque o JSON é sintaticamente válido.

Referências devem existir no snapshot entregue: `F:<chave>:<versão>` para fato, `K:<id>` para conhecimento, `T:` para fio, `P:` para promessa e `E:` para evento. `ANSWER` exige fonte; `ASK` pode declarar falta de informação. A presença de uma referência válida não prova que cada frase seja correta: a revisão humana continua necessária.

O modelo não possui ferramentas de SQL, terminal, filesystem ou envio externo. O servidor escolhe campanha, fontes e identidade. Não há geração livre de ferramentas nem parser de prosa que converta “ganhamos ouro” em efeito. Propostas de reparo, recompensa, combate, transporte de objetos ou mudança de cânone não são executáveis pelo copiloto inicial. O mestre ainda pode conduzir operações suportadas diretamente em Comandos/Memórias.

`AI_MASTER` permanece recusado nas entradas genéricas de comandos. A aprovação usa `USER` autenticado, transação de domínio existente e vínculo do evento com o pedido de IA. Isso registra a responsabilidade humana e evita tratar uma resposta do modelo como credencial administrativa. Autonomia exige política própria em MI-06.

## Recuperação de contexto

`GameMasterContext` lê o banco em transação, antes de inferir. Não usa histórico em RAM como fonte de verdade. Guarda o snapshot utilizado para auditoria e retomada.

No planejamento, conserva todos os fatos fixos e recupera até seis estados mutáveis por correspondência de termos do pedido, dois fios abertos, três promessas abertas e dois eventos recentes. Não é busca semântica. A projeção registra quando há estados mutáveis omitidos; falta de informação deve levar a pergunta/consulta mais específica. Conhecimentos de NPC conservam a última observação, mesmo se a verdade atual mudou.

O limite do snapshot é 10.000 bytes UTF-8. Eventos opcionais podem ser removidos para caber; fatos fixos e conhecimentos selecionados não são cortados no meio. Se ainda exceder, a consulta é recusada. O servidor local usa janela de 4.096 tokens, até 512 de saída e recusa resposta cuja contagem de entrada informada pelo Ollama exceda 3.500. O limite em bytes é uma estimativa prévia, não substitui tokenização exata; a avaliação mede o uso real.

Para consultas públicas, o filtro de audiência ocorre antes de montar as fontes entregues ao modelo. Para NPCs, o contexto global não é consultado como fonte de fala. Segredos que o mestre escrever diretamente no pedido são conteúdo fornecido por ele; a tela exige revisão antes de qualquer publicação.

Não há embeddings, índice vetorial, resumo gerado nem atualização autônoma de conhecimento. Conhecimento novo só entra pelo comando de descoberta aprovado. Trocar de modelo não apaga as observações, fatos ou efeitos já confirmados.

## Persistência, pausa e concorrência

`GameMasterTurn` guarda chave/hash idempotente, autor, tipo/pedido, NPC opcional, snapshot, revisão do mundo/cena, geração das configurações, proposta, texto revisado, evento resultante, estado, concessão de processamento, métricas e código de falha. FKs de NPC/evento incluem a campanha.

Fluxo: `REQUESTED → GENERATING → READY → COMMITTED`. Falhas terminam em `FAILED`; mudança de estado pode terminar em `STALE`; cancelamento/configuração termina em `CANCELLED`. Nenhum desses estados aplica efeito automaticamente.

A fila é consultada a cada dois segundos, com uma inferência ativa por processo do backend. O pedido HTTP retorna 202 rapidamente. Não há transação aberta durante a chamada ao modelo. A concessão dura cinco minutos; após queda do processo, uma consulta órfã passa a `FAILED/INTERRUPTED` quando expira. Tentar novamente é um novo pedido explícito, sem repetir efeito anterior.

Há no máximo três pedidos ativos por campanha e 120 nas últimas 24 horas. O provedor tem timeout de 90 segundos por chamada, configurável entre 5 e 120 segundos. Uma resposta inválida admite uma única tentativa de reparo; indisponibilidade do provedor termina o pedido. Falha não substitui fatos ou inventa narrativa de sucesso.

Configurações em `CampaignLore`: `mode=OFF|COPILOT`, `aiPaused` e `aiEpoch`. Mudar modo/pausa cancela pedidos ainda não aprovados e incrementa a geração. Retomar não ressuscita propostas canceladas. Respostas tardias verificam estado/concessão, revisão e geração antes de se tornarem aprováveis.

Na aprovação, bloqueia a campanha, revalida revisão/pausa, presença e fontes, reutiliza o comando de domínio e grava o resultado do turno na **mesma transação** que estado, evento e outbox. Perder a resposta e aprovar novamente retorna o evento original; não repete descanso, viagem ou descoberta. Texto/visibilidade divergentes numa repetição são recusados. Uma falha tardia no registro do turno reverte também os efeitos do comando.

O frontend consulta progresso a cada três segundos enquanto visível e recarrega ao voltar/reconectar. Aprovações entram no outbox `story:updated` existente, respeitando audiência. Não há stream público de tokens do planejador nem evento global com progresso privado.

## Provedor e ambiente local

Adaptador independente `GameMasterProvider`, implementação `OllamaProvider`. Usa [`POST /api/chat`](https://docs.ollama.com/api/chat), `stream=false` e [saída estruturada](https://docs.ollama.com/capabilities/structured-outputs). Não altera o assistente Anthropic IM-12.

O ambiente inspecionado tem RTX 3060 **8 GB**, aproximadamente **16 GB de RAM** e Ollama **0.32.1**. Foi instalado [`gemma2:9b`](https://ollama.com/library/gemma2:9b), quantização **Q4_0** confirmada em `/api/show`, artefato de 5,4 GB, digest `ff02c3702f322b9e075e9568332d96c0a7028002f1a5a056e0a6784320a4db0b`. O serviço está restrito a `127.0.0.1:11434`. A execução local observada distribuiu parte do modelo entre CPU e GPU; latência depende também da memória ocupada por outros programas.

Configurações opcionais no backend, sem credenciais de provedor:

```dotenv
GAME_MASTER_OLLAMA_URL=http://127.0.0.1:11434
GAME_MASTER_MODEL=gemma2:9b
GAME_MASTER_TIMEOUT_MS=90000
```

O adaptador aceita apenas HTTP em loopback, sem usuário/senha, caminho extra ou parâmetros na URL. Não existe fallback para nuvem. `/api/tags` confirma instalação do modelo; isso não garante memória livre suficiente ou qualidade da geração. O carregamento efetivo é verificado nas chamadas reais.

Iniciar o Ollama se estiver desligado: `ollama serve`. O modelo já está baixado; uma instalação nova pode usar `ollama pull gemma2:9b`. Não execute duas instâncias do servidor na mesma porta. O modelo é descarregado após dois minutos ocioso.

## API

Prefixo `/api/campaigns/:id/game-master`; JWT e mestre proprietário obrigatórios; respostas sem cache.

| Rota | Uso |
| --- | --- |
| `GET /state` | Configuração, disponibilidade local, NPCs presentes e últimos trinta pedidos com proposta/fontes citadas. |
| `GET /turns/:turnId` | Auditoria privada do snapshot, proposta, métricas e resultado persistidos. |
| `PATCH /settings` | `{ mode, paused, expectedRevision }`. Altera controles e cancela pedidos ainda abertos. |
| `POST /actions` | `{ requestKey, expectedRevision, kind, prompt, focusEntityId? }`; persiste pedido e retorna ID/estado. |
| `POST /turns/:turnId/resolve` | `{ decision: ACCEPT|CANCEL, text?, visibility?: MASTER|PUBLIC }`; texto/visibilidade aplicam-se a resposta/pergunta, não redefinem efeitos mecânicos. |

## Verificação

Backup anterior à migration em `backend/backups/lore-migration/2026-10-17T16-45-02.345Z/`, com schema e 3.451 registros de 59 tabelas. Migration aditiva `20261017030000_game_master`: uma tabela e dois campos em `CampaignLore`. Escritas de teste usam apenas base descartável `rpg_lore_check_<timestamp>`.

Migration aplicada em `localhost:3306/rpg`: **60 tabelas de aplicação**, sem divergência de schema. Os **3.451 registros das 59 tabelas anteriores mantiveram hashes idênticos** antes e depois. Nenhuma campanha real foi instalada ou ligada automaticamente. Builds de produção, lint dos arquivos alterados, 66 testes existentes, regressões MI-02/MI-03/MI-04, integração MI-05 e interface desktop/celular foram verificados.

Suíte de integração: identidade e campos indevidos, chave idempotente, contextos privado/público/NPC, referências inválidas, tentativa única de reparo, aprovação concorrente, descoberta real, pausa durante inferência, cancelamento, mudança de revisão, indisponibilidade, falha tardia com rollback e reinício em outro processo Node. O teste visual usa provedor controlado para exercitar a interface sem confundir falhas do modelo com falhas de navegação.

A avaliação real tem quarenta pedidos: dez consultas factuais, dez falas/limites de NPCs, dez propostas de viagem/descanso e dez limites de audiência/capacidade. Salva respostas, referências, tentativas, tokens, latências e verificações em `backend/backups/game-master-model/`. Os critérios automáticos são uma bateria de regressão pequena, não prova universal de ausência de alucinação ou vazamento. A revisão humana é obrigatória mesmo quando passa.

Resultado em 17/10/2026, com o modelo e a configuração acima:

| Grupo | Passaram nos critérios automáticos |
| --- | --- |
| Consulta factual com fonte esperada | 10/10 |
| Fala e limites de conhecimento de NPC | 6/10 |
| Propostas de viagem/descanso | 10/10 |
| Limites de audiência/capacidade | 8/10 |
| Total | **34/40** |

Latência por pedido, incluindo eventual reparo: **mediana 7.999 ms**, **p95 12.454 ms**; maior entrada observada: **1.929 tokens**. As seis falhas (`dalia-1` a `dalia-4`, `public-4`, `unsupported-2`) emitiram `ANSWER` sem fonte, mesmo após a tentativa de reparo. Algumas escreveram uma pergunta com prefixo `ASK:` no texto, sem escolher o tipo `ASK`. Todas foram recusadas como `UNSUPPORTED_PROPOSAL`. Não relaxamos a exigência de fonte para aceitar essas respostas.

A revisão das saídas não identificou revelação dos segredos procurados nos casos de NPC/público. Entretanto, alguns casos de capacidade passaram por manterem o tipo sem efeito, embora devolvessem um fato irrelevante em vez de explicar o limite. Também houve citações técnicas no texto e uma resposta factual pouco direta. Portanto, **34/40 mede os critérios específicos da bateria, não a qualidade integral de 34 respostas**. Pertinência, naturalidade e escolha entre resposta/pergunta ainda precisam melhorar antes de autonomia.

Essa bateria real gera e valida propostas, sem aprová-las ou aplicar seus efeitos. Concorrência, retomada, rollback e aprovação são exercitados separadamente pela integração com provedor controlado. Não houve efeito inválido nos testes de integração; isso não equivale a uma campanha autônoma avaliada. Os artefatos finais são `latest.json` e `summary.json`; `initial-format.json` e `initial-summary.json` preservam a avaliação anterior à especialização da gramática.

Comandos em `backend`:

```sh
npm run build
node scripts/game-master/run-rehearsal.cjs
node scripts/game-master/run-rehearsal.cjs --model
node scripts/game-master/run-rehearsal.cjs --browser
```

O wrapper exige base de ensaio existente com migrations/catálogo. `--model` usa o Ollama real; `--browser` exige frontend na porta 3100 e Playwright (`LORE_PLAYWRIGHT_MODULE` pode indicar o módulo). Evidências visuais ficam em `backend/backups/game-master-browser/`. Uma sessão humana de 45–60 minutos continua necessária para avaliar jogabilidade e português em conversa aberta.
