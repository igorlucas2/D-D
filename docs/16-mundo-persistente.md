# MI-02 — Mundo persistente e instalação de cenário

> Registro da etapa MI-02. Desde 17/10/2026, eventos, fatos versionados e descobertas estão implementados na [MI-03 — História e conhecimento](./17-historia-conhecimento.md); viagem coletiva, objetos e outbox estão na [MI-04 — Comandos do grupo](./18-comandos-grupo.md). As limitações abaixo descrevem o estado desta etapa em 16/10.

Entrega de 16/10/2026. Continuação do [pacote MI-01](./15-pacote-lore.md) e da [spec MI](./13-mestre-ia-lore.md). A instalação do mundo já funciona no MySQL. O mestre ainda conduz a aventura; Gemma, eventos narrativos, descobertas e comandos de viagem coletiva serão implementados nas fases seguintes.

## Usar pela interface

1. Em **Campanhas → Nova campanha**, informe o nome e marque **Usar Eldoria — O Pacto dos Três Sinos (campanha de teste)**.
2. Confira a premissa e crie a campanha. Criação e instalação acontecem na mesma transação. A interface abre o caderno do cenário instalado.
3. Em **Cenário**, o mestre encontra o elenco persistido, PV, localização, conhecimento inicial e os três mapas. O conteúdo vem da cópia instalada no banco, mesmo se o pacote editorial mudar ou sair do servidor.
4. Na mesa, cada membro pode escolher um personagem próprio e usar **Vincular à campanha**. O grupo começa no **Cais do Lume**. A ficha não pode estar vinculada a outra campanha, nem manter uso legado detectado em exploração, tokens ou combate de outra campanha.
5. Vale e Porto começam publicados. A abadia fica reservada ao mestre; sua publicação pode ser feita pelos controles existentes de mapas após a descoberta narrada pelo mestre.

O pacote continua `DRAFT`, com encontros, atribuição e recompensa monetária pendentes de revisão. A seleção explícita de campanha de teste habilita `allowDraft: true`; isso não publica o pacote, não liga IA e não executa recompensas. Uma campanha vazia também pode usar **Cenário → Revisar cenário → Instalar rascunho de teste**. Campanhas com conteúdo ou outros participantes não recebem uma instalação sobreposta.

## Persistência implementada

Migration: [`20261016010000_lore_world`](../backend/prisma/mysql-migrations/20261016010000_lore_world/migration.sql). São **11 tabelas novas**, mais um índice composto em `VttMap`. Não há alteração de conteúdo nas tabelas antigas.

| Modelo | Responsabilidade |
| --- | --- |
| `LorePackVersion` | Identidade e hash imutáveis por pacote/versão, com snapshot completo validado. |
| `CampaignLore` | Instalação, revisão inicial, modo `OFF`, flag de teste, autor, chave idempotente de criação e snapshots do catálogo. |
| `CampaignEntity` | Identidades locais de lugar, NPC, facção, objeto e personagem; chave única por campanha. |
| `CampaignPlace` | Descrição privada, hierarquia e mapa associado, com FKs da mesma campanha. |
| `CampaignFaction` | Objetivo e limites da facção; não expostos automaticamente aos jogadores. |
| `CampaignNpc` | Localização, facção, voz, objetivo, ficha mecânica copiada, PV e condições da instância. |
| `CampaignPlotObject` | Localização e estado inicial dos objetos de trama. |
| `CampaignLoreMap` | Vínculo com mapa da mesa e cópia PNG no MySQL, com checksum próprio. |
| `TravelRoute` | Arestas direcionadas com custo em minutos e bloqueio; separadas da árvore visual de mapas. |
| `SceneState` | Lugar e fase do grupo, com revisão independente do mapa aberto na interface. |
| `CampaignCharacter` | Ficha pertencente a uma campanha e participante da única cena do MVP. |

`CampaignCharacter` representa também a participação na cena neste MVP; não foi criada uma tabela `SceneParticipant` redundante. As definições editoriais ficam no snapshot de `LorePackVersion` e nas `templateKey` das entidades; uma tabela separada `LoreTemplate` não é necessária nesta fase. As FKs compostas impedem associar NPC, objeto, rota ou lugar a entidades/mapas de outra campanha.

Uma instalação inicial cria **35 entidades**: 17 lugares (incluindo salas), oito NPCs, quatro facções e seis objetos. Acrescenta três mapas, 12 hotspots, 22 arestas (sete rotas regionais e quatro deslocamentos locais nos dois sentidos), calendário e cena. Personagens entram somente por vínculo explícito. Fichas de criaturas ficam congeladas no catálogo da instalação; não são instanciadas como inimigos automaticamente.

O calendário usa a função canônica existente: ano 87, Bruma, dia 1, 08:00; 12 meses de 30 dias; avanço por tempo real desligado. Nara e Bento têm instâncias diferentes apesar de ambos usarem `commoner`. Alterar PV de uma instância não altera o catálogo nem outra campanha.

## Transação, repetição e compatibilidade

O instalador usa transação `Serializable`, bloqueio da campanha e até três tentativas para conflitos transacionais. A criação a partir de cenário bloqueia o usuário e guarda `(installedById, requestKey)` com o hash dos parâmetros. Repetir a mesma requisição devolve a campanha criada; reutilizar a chave com outros parâmetros retorna 409.

A instalação em campanha existente revalida proprietário e ausência de conteúdo dentro da transação. Os 16 vínculos são resolvidos novamente nesse mesmo contexto. Uma ficha ausente/ambígua, erro na gravação ou mudança do hash desfaz toda a instalação. Repetir o mesmo pacote/hash em campanha instalada retorna `alreadyInstalled: true`, sem recolocar NPCs ou restaurar estados iniciais. Outra versão/hash é recusada.

O hash esperado deve ser o da revisão apresentada. Uma versão já registrada com outro hash não pode ser sobrescrita, mesmo sendo rascunho. Para evoluir o conteúdo após a primeira instalação, preparar nova versão. A leitura do mundo e a repetição de uma instalação concluída usam o banco, sem depender dos arquivos de origem.

O endpoint de exclusão de campanha remove dependências em ordem, na mesma transação. Remover isoladamente um mapa instalado é recusado para não quebrar o vínculo dos lugares. O pacote versionado permanece como registro de referência após excluir uma campanha.

Os serviços legados de tokens, combate e exploração recusam usar uma ficha já vinculada em outra campanha. O vínculo inicial também verifica usos legados, sem mover ou copiar fichas silenciosamente. As operações legadas de viagem e descanso são recusadas em campanhas com lore: seus efeitos individuais não representam o futuro comando transacional do grupo.

## Mapas, portas e acesso às imagens

O atlas do pacote recebeu geometria autorada em grade para a abadia: perímetro das cinco salas e seis corredores, com 11 portas. A entrada começa aberta; dez portas internas começam fechadas. Essa geometria é validada com `sanitizeWalls` e `canReach`. Não se inferem paredes dos traços do SVG; a arte é esquemática e alguns traços não coincidem exatamente com as bordas da grade.

As paredes/portas são instaladas em `VttMap.wallsData`, usadas pelo movimento existente. Visão dinâmica começa `OFF`, pois ainda não existem tokens de personagens na cena; o mestre pode habilitar a visão pelos controles existentes após posicioná-los. Os testes também verificam que portas fechadas bloqueiam visão e que as salas ficam acessíveis com portas abertas.

PNG é guardado no banco, sem depender de URL externa ou de arquivo posteriormente substituído. A API exige JWT, associação atual à campanha e, para jogadores, mapa publicado. Abadia não publicada retorna 404 para membros; usuário de fora e membro removido recebem 403. A resposta usa `private, no-store` e `image/png`. CSS, medição da imagem e WebGL recebem um blob criado após `fetch` autenticado; URLs privadas não passam pelo proxy de imagens externas. O blob é revogado ao mudar mapa, sessão ou desmontar o componente.

Os três desenhos não contêm segredos arquitetônicos ou anotações narrativas privadas. Fog continua sendo uma ferramenta visual, sem substituir autorização do arquivo.

## APIs

Prefixo `/api`, JWT obrigatório. Nenhuma API abaixo recebe SQL, caminho de arquivo ou URL arbitrária.

| Rota | Quem pode usar | Efeito |
| --- | --- | --- |
| `POST /lore-packs/create-preview` | Autenticado que prepara sua própria campanha | Retorna identidade, hash e condições editoriais de criação; sem lore privada. |
| `POST /lore-campaigns` | Autenticado | Cria campanha própria e instala o mundo atomicamente. |
| `POST /campaigns/:id/lore/install` | Mestre proprietário | Instala em campanha vazia ou devolve instalação idêntica existente. |
| `GET /campaigns/:id/lore/state` | Membro atual ou mestre | Jogador: lugar da cena, participantes e metadados mínimos. Mestre: entidades, rotas, mapas e snapshot privado. |
| `POST /campaigns/:id/lore/characters` | Membro, para ficha própria | Vincula personagem e participa da cena; repetição não duplica. |
| `GET /campaigns/:id/lore/maps/:mapId/image` | Mestre ou membro autorizado ao mapa publicado | Entrega PNG instalado. |

Instalação: `{ packId, version, expectedHash, allowDraft? }`. Criação acrescenta `{ name, description?, requestKey }`, com `requestKey` UUID preservada ao retentar. Vínculo recebe `{ characterId }`. Não copiar hashes da documentação: obtenha a revisão atual pela prévia.

## Evidências e operação

- Backup anterior preservado em `backend/backups/lore-migration/2026-10-16T19-39-00.718Z/`: snapshot lógico, modelos da origem e `schema.migration-base.prisma` para restauração; sem credenciais em documentação ou saída de comandos.
- Ensaio em base MySQL descartável: aplicadas as duas migrations, restaurados todos os registros do backup e comparados os hashes antes dos testes de instalação.
- Migration aplicada em `localhost:3306/rpg`. **As 35 tabelas antigas e seus 3.451 registros mantiveram hashes idênticos.** O banco agora tem 46 tabelas de aplicação; schema sem drift. Nenhuma campanha do usuário recebeu o cenário automaticamente.
- Testes de integração: rollback após falha em NPC, catálogo ambíguo, instalação/criação simultâneas e repetidas, chave reutilizada com dados diferentes, FK entre campanhas, isolamento de PV, reinício de conexão e fonte editorial indisponível, permissões, imagens, vínculo de personagens, mapa sem viagem e paredes/portas.
- Navegador: criação pela interface, caderno instalado, três PNGs autenticados, viewport desktop/celular sem overflow, mesa 2D/3D sem proxy externo, vínculo do personagem e recusa da área privada ao jogador. Capturas revisadas em `backend/backups/lore-migration/browser/`.
- Verificações de código: 66 testes do backend aprovados, builds de produção do backend e frontend concluídos, TypeScript e lint dos arquivos alterados sem erros. O pacote resolve os 16 vínculos ao catálogo; a verificação HTTP de leitura também passou.

Comandos em `backend`:

```sh
npm run db:generate
npm run db:deploy
npm run build
npm test -- --runInBand
npm run lore:validate
npm run test:lore-http
```

O teste `npm run test:lore-install` **exige uma base descartável** `rpg_lore_check_<timestamp>` no `DATABASE_URL`, com catálogo e schema. Ele cria dados temporários e os remove ao terminar. Não apontá-lo para `rpg`. O utilitário `scripts/lore/migration.cjs` conserva a referência local do ensaio em `backups/lore-migration/current.json`; a opção `rehearse` restaura o backup numa base nova, e `cleanup` remove somente essa base descartável. `verify` compara as tabelas de origem ao backup; não é um teste para executar depois que jogadores legitimamente modificarem a campanha.

Para voltar ao código anterior imediatamente após esta entrega, manter as tabelas novas e restaurar a versão anterior da aplicação é suficiente: a migration é aditiva e o catálogo/campanhas não foram alterados. Não remover tabelas novas se já houver campanhas instaladas. Em caso de recuperação completa, restaurar o snapshot em uma base separada, verificar hashes e só então escolher o destino; não aplicar o snapshot sobre campanhas que evoluíram desde o backup.

## Limites e próxima etapa

O mundo e suas instâncias estão persistidos. Fatos, rumores, conhecimento e fios ainda são o **snapshot inicial imutável**, não um histórico de alterações: MI-03 adicionará eventos, revisões, descobertas, relações e correções. Não há editor livre de estado, execução de pressões, viagem coletiva, dinheiro ou mestre Gemma. Alterar o mapa aberto, mudar a câmera ou posicionar tokens não muda `SceneState`.

MI-03 é a próxima entrega. Comandos transacionais do grupo, incluindo viagem, chegam em MI-04; o modelo local entra em MI-05. Até lá, esta instalação é uma base de preparação e teste conduzida pelo mestre humano.
