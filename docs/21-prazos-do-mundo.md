# Prazos do mundo e viagens de NPCs

Entrega **MI-06B**, 17/10/2026. Complementa as [intenções e diálogos MI-06A](./20-intencoes-dialogos.md) e a [spec do mestre de IA](./13-mestre-ia-lore.md). Implementada no backend, MySQL e tela **Prazos**, acessível pelo mestre na campanha.

O backend executa lembretes e viagens previamente autorizados, usando o relógio e o estado persistido. O Gemma não escolhe, escreve nem executa esses comandos. A autonomia de diálogo, investigação e ações do grupo continua pendente; `AUTOMATIC` e o ator `AI_MASTER` permanecem recusados pelos contratos existentes.

## Uso na mesa

1. Instalar o cenário e preparar os comandos da campanha. A política começa desligada.
2. Abrir **Prazos** e salvar as permissões: execução habilitada, pausa, viagens de NPC e limite de efeitos por avanço.
3. Preparar um lembrete ou selecionar NPC, rota e minutos até a partida. Autorizar esse prazo explicitamente se quiser execução automática; a autorização também vale para sua chegada.
4. Avançar o tempo pelos **Comandos do grupo**, inclusive viagem ou descanso aprovados. Só os minutos do jogo vencem prazos; o relógio real e o reinício do servidor não executam consequências.
5. Revisar os itens que aguardam o mestre. Confirmar um prazo vencido, cancelar um lembrete/partida ou adiar para um novo momento. Toda operação revalida a revisão da campanha.

O modo de inferência `OFF` não impede prazos autorizados: eles não dependem do modelo. A pausa geral `aiPaused`, configurada no Copiloto, também interrompe efeitos automáticos. Desligar ou pausar a política mantém as decisões manuais disponíveis. Retomar não aplica os prazos perdidos; eles ficam em revisão até uma decisão explícita.

## Capacidades e limites

| Capacidade | Efeito confirmado | O que exige outro comando |
| --- | --- | --- |
| `REMINDER` | Registra um lembrete privado no histórico do mestre. | Decidir uma consequência, alterar fatos, PV, rotas ou objetos. |
| `NPC_DEPART` | Marca o NPC em trânsito, registra a partida e cria uma única chegada futura. | Transportar carga, mover o grupo ou iniciar combate. |
| `NPC_ARRIVE` | Muda o lugar do NPC para o destino e encerra o trânsito. | Revelar conhecimento aos jogadores ou publicar uma fala. |

O mestre prepara partidas; a chegada é criada exclusivamente pelo backend. Cada viagem usa uma rota existente da mesma campanha, entre 1 e 1.440 minutos. Prazos novos ficam de 1 a 43.200 minutos à frente do relógio, respeitando o limite inteiro do calendário.

Há até **60 prazos pendentes por campanha** e de **1 a 12 efeitos por avanço**, com padrão 4. Partida e chegada consomem um efeito cada. Se um avanço atravessar ambas, elas podem ocorrer na mesma transação, em ordem temporal, antes do evento final do grupo. A chegada pode ficar aguardando revisão se o orçamento acabar após a partida.

Os itens vencidos são ordenados por minuto e ID; o motor consulta novamente após cada execução para considerar chegadas recém-criadas. O laço é limitado a 120 candidatos, suficiente para os 60 prazos e suas possíveis chegadas. Prazos sem autorização, pausados ou fora do orçamento passam a `WAITING_MASTER`; não permanecem em uma fila que dispara ao retomar.

## Revalidação e continuidade

Para execução automática, a política e o prazo precisam ter sido autorizados pelo mestre atual. Trocar a titularidade invalida as autorizações anteriores até revisão. A política de viagens é adicional à autorização individual da rota escolhida.

Antes de cada partida/chegada, o backend verifica campanha, rota, duração, posição, PV, condições e viagem ativa. Um hash guarda o estado físico do NPC e os extremos/duração da rota. NPC com PV zerados ou qualquer condição ativa não viaja neste incremento. Mudanças desde a autorização exigem revisão, mesmo que o NPC ainda tenha PV positivos.

Combate ou conversa pendente com o NPC impedem a execução. Se a partida/chegada envolver o lugar do grupo, ou o destino de uma viagem do grupo atravessando o prazo, a automação também pede revisão. Uma confirmação humana permite um deslocamento presenciado pelo grupo; continua sujeita às demais condições físicas e conversas pendentes.

Durante o trânsito:

- `CampaignNpc.activeJourneyId` aponta para a partida. `placeEntityId` conserva a origem histórica até a chegada; não representa presença enquanto esse vínculo existir.
- Consultas de NPCs presentes no Copiloto, nas Intenções e na validação de conversas excluem NPCs em viagem.
- Pausar, reiniciar ou vencer o prazo não teletransporta o NPC. Uma chegada aguardando revisão conserva o trânsito.
- Cancelar uma chegada é recusado, pois o NPC já partiu. O mestre pode confirmar a chegada vencida ou adiá-la, após revisar as condições. Uma mudança inválida de rota/estado precisa ser reconciliada antes.
- Adiar só aceita um instante posterior ao prazo anterior e ao relógio atual. Revalida as condições e registra nova autorização e snapshot. Não encurta uma viagem.

Deslocamento não altera objetos, PV, inventário ou relações. Este incremento atualiza a localização narrativa persistida; não implementa animação de token em percurso nem navegação espacial contínua.

## Memória, eventos e transação

As tabelas novas são `WorldAutomationPolicy`, com permissões por campanha, e `ScheduledConsequence`, com capacidade, autorização, prazo, estado, snapshot, viagem anterior e evento resultante. FKs compostas restringem NPCs, rotas, viagens e eventos à mesma campanha. Índices únicos impedem chegada ou resultado duplicados.

Estados: `SCHEDULED` → `APPLIED` ou `WAITING_MASTER`; a revisão permite aplicar, cancelar quando cabível ou adiar de volta a `SCHEDULED`. Uma execução ou cancelamento concluído não é revertido por repetir a chamada. Repetir a criação com a mesma chave e conteúdo devolve o registro anterior; reutilizar a chave para outro conteúdo gera conflito.

Configuração, preparo, adiamento, cancelamento, lembrete, partida e chegada produzem eventos privados `MASTER` e outbox transacional. O avanço de relógio que exige revisão também persiste os estados pendentes. A transação do comando do grupo engloba relógio, consequências, NPCs, fatos, eventos, revisão e outbox. Falha tardia desfaz o conjunto; requisições concorrentes disputam o bloqueio e a revisão da campanha.

Cada deslocamento cria uma revisão do fato `NPC_LOC_<entityId>`, com predicado `NPC_LOCATION`, ligada ao evento real. A edição genérica de fatos não pode sobrescrever essa localização. O próprio NPC recebe conhecimento da nova revisão. Outros personagens mantêm exatamente a revisão que observaram; saber da partida não concede conhecimento automático da chegada. C05, C09 e os fatos de localização da carga não são reescritos por uma viagem de NPC.

O histórico de preparação registra a rota autorizada; os cartões de revisão exibem NPC, origem, destino e duração. Os nomes da rota nos cartões refletem seu cadastro atual, e qualquer mudança no snapshot impede aplicação sem revisão. Eventos de partida/chegada conservam o resultado ocorrido.

## Marcos da lore

O botão **Preparar lembretes da lore** cria seis lembretes manuais para `eldoria-tres-sinos@1.0.0`, uma vez por campanha:

| Minutos desde T0 | Revisão solicitada |
| --- | --- |
| 720 | Caixote na mina e possibilidade de Mara preparar o transporte. |
| 1.440 | Preparação, interrupções e eventual partida da carga. |
| 1.530 | Partida efetiva, interceptação e eventual chegada da carga. |
| 2.160 | Vigia inativo e decisão sobre a ponte. |
| 2.880 | Galeria, água e resposta do Conselho. |
| 2.880 | Atendimento e condição de Bento. |

T0 vem do minuto do evento `GENESIS`. Instalar esses lembretes tardiamente não os executa retroativamente. A avaliação de Bento em 48 horas é um lembrete editorial adicional, não um prazo canônico de dano ou morte; a lore pede avaliação conforme os acontecimentos.

Esses registros não simulam o transporte do caixote, a interdição da ponte nem os reparos. Tais efeitos ainda precisam de comandos próprios com precondições de carga, preparação, ferramentas e mecanismos. O texto de um lembrete não se torna verdade canônica só por ter vencido.

## API

Todas as rotas abaixo exigem o mestre, usam respostas sem cache e ficam sob `/api/campaigns/:id/consequences`.

| Método e rota | Contrato |
| --- | --- |
| `GET /` | Revisão, relógio, política, NPCs/rotas, todos os pendentes e últimos 30 encerrados. |
| `PATCH /policy` | `expectedRevision`, `enabled`, `paused`, `allowNpcTravel`, `maxPerAdvance`. |
| `POST /` | `expectedRevision`, `requestKey` UUID, `kind`, `title`, `delayMinutes`, `autoApproved`; texto opcional e NPC/rota somente para partida. |
| `POST /preset` | `expectedRevision`, `autoApproved`; cria apenas os marcos ainda não preparados. |
| `POST /:id/resolve` | `expectedRevision`, `decision: APPLY | CANCEL`; aplicar exige prazo vencido. |
| `POST /:id/postpone` | `expectedRevision`, `delayMinutes`, `autoApproved`; revisão explícita, sem antecipação. |

Campos desconhecidos e capacidades fora da lista são recusados. Criação e resolução são repetíveis sem duplicar efeitos. Configuração e adiamento usam concorrência otimista: uma repetição com revisão antiga exige atualização, sem novo efeito silencioso. Jogadores não recebem conteúdo ou contadores desta tela; publicações para a mesa continuam usando os contratos existentes.

## Migração e verificações

Migration aditiva `20261017050000_world_consequences`, aplicada em `localhost:3306/rpg`. Backup anterior: `backend/backups/lore-migration/2026-10-17T18-23-50.778Z/`. O ensaio criou uma base descartável, aplicou todas as migrations, restaurou o backup e passou na integração de instalação.

As **60 tabelas e 3.451 registros anteriores mantiveram hashes idênticos** antes e depois da aplicação. O banco passou a 62 tabelas de aplicação, com as duas novas vazias e nenhuma campanha real com lore ou política habilitada. Diff Prisma sem divergência. Evidência em `verification.json`, `rehearsal.json` e `mi06b-applied.json` no backup.

Passaram builds de backend/frontend, lint dos arquivos alterados, os 66 testes unitários existentes e as integrações de instalação, memória, comandos, copiloto e intenções. A nova integração exercita permissões, campos proibidos, repetição, revisão concorrente, orçamento, pausas, troca de mestre, rotas alteradas, conversas pendentes, trânsito, ordem de eventos, chegada única, fatos versionados, conhecimento antigo, preservação da carga e rollback depois de partida/chegada. Um processo novo confirma a persistência do trânsito sem disparar chegada ao iniciar.

O navegador verificou política, perda de resposta e repetição sem duplicação, lembrete automático, adiamento/cancelamento, partida manual, marcos idempotentes, reconexão e revogação de acesso. Capturas desktop/celular inspecionadas em `backend/backups/consequences-browser/`, sem estouro horizontal da página ou erros JavaScript do cliente.

Com base descartável preparada e backend compilado:

```sh
node scripts/consequences/run-rehearsal.cjs
node scripts/consequences/run-rehearsal.cjs --browser
```

O segundo comando exige frontend na porta 3100 e Playwright, configurável por `LORE_PLAYWRIGHT_MODULE`. `npm run test:consequences` exige que `DATABASE_URL` já aponte para a base descartável. Os testes não consultam Gemma nem enviam mensagens a jogadores reais. Prompt e provedor não foram alterados; a avaliação histórica do modelo continua sendo a registrada na MI-06A.

## Próximo incremento

Adicionar preparação/transporte de carga e reparos dos três mecanismos como comandos tipados, usando os marcos acima para reavaliação das pressões. Para liberar decisões do modelo sem confirmação, continuam necessárias política específica por capacidade, condições de revelação de NPC, avaliação humana de 45–60 minutos e conclusão do arco por dois caminhos sem correção de estado crítico. A MI-06 permanece em andamento.
