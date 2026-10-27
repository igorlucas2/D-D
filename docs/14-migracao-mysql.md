# MI-DB — migração do backend para MySQL

Concluída em **16/10/2026**, como primeira etapa de implementação da [spec do mestre de IA](./13-mestre-ia-lore.md). O backend utiliza `localhost:3306/rpg`, MySQL 9.5.0, com Prisma 6.19.3. A conexão ativa está em `backend/.env`; credenciais não fazem parte deste documento.

## Resultado

Foram transferidos **3.451 registros de 35 tabelas de aplicação**, com IDs, relações, datas e conteúdo preservados. Além delas, o Prisma mantém sua própria tabela de histórico de migrations.

| Recurso | Registros preservados |
| --- | --- |
| Usuários | 16 |
| Personagens | 10 |
| Campanhas / membros | 1 / 2 |
| Itens / magias / criaturas | 602 / 322 / 342 |
| Regras / recursos SRD em cache | 33 / 2.027 |
| Inventário / magias aprendidas / slots | 7 / 1 / 63 |
| Rolagens | 16 |
| Combates / participantes | 1 / 2 |
| Mapas / estados de exploração | 1 / 2 |
| Conquistas do catálogo | 3 |

As demais tabelas estavam vazias e foram criadas. A campanha e o catálogo continuam sendo os existentes: o pacote Pacto dos Três Sinos será estruturado em MI-01 e instalado em MI-02.

## Arquivos e decisões

- [Schema ativo](../backend/prisma/schema.prisma): conector MySQL; 51 campos de texto/URL/JSON serializado receberam tipos `Text`/`LongText`, evitando o limite padrão de 191 caracteres nesses conteúdos.
- [Baseline MySQL](../backend/prisma/mysql-migrations/20261016000000_mysql_baseline/migration.sql): tabelas InnoDB, `utf8mb4` e collation binária em identidades, FKs e chaves de catálogo. Isso preserva distinções de maiúsculas, acentos e espaços das chaves SQLite. Essa parte do contrato está no SQL, pois o schema Prisma não expressa collations por campo.
- [Configuração Prisma](../backend/prisma.config.ts): usa `prisma/mysql-migrations`. O diretório `prisma/migrations` permanece intacto como histórico SQLite; não deve ser aplicado ao MySQL.
- [Schema SQLite arquivado](../backend/prisma/sqlite/schema.prisma) e [configuração do leitor](../backend/prisma.sqlite.config.ts): geram um cliente separado apenas para transferência/verificação.
- [Transferência](../backend/scripts/mysql/transfer.cjs): exige destino sem registros, insere dependências e hierarquias na ordem correta, mantém FKs habilitadas e valida o conteúdo dentro de uma única transação.
- [Snapshot](../backend/scripts/mysql/snapshot.py) e [bloqueio de origem](../backend/scripts/mysql/lock-source.py): usam a API SQLite para backup consistente e exclusão de escritas durante a troca.

A troca não exigiu instalar dependências, atualizar o Prisma ou modificar contratos das APIs. JSON já serializado continua string nesta etapa; convertê-lo em `Json` exige uma migração de domínio separada.

## Verificação executada

1. Backup SQLite com `integrity_check` e `foreign_key_check`; cópia restaurada em arquivo independente e comparada por conteúdo.
2. Ensaio em base MySQL descartável: criação do schema, transferência com rollback intencional, confirmação de destino vazio e nova transferência completa.
3. SHA-256 por tabela sobre todos os campos serializados de forma determinística, com ordenação independente do banco. Os hashes e as contagens coincidiram nas 35 tabelas. Uma segunda importação foi recusada antes de escrever.
4. Testes HTTP com contas/campanha descartáveis: cadastro/login, proteção de rotas, catálogo, personagem/inventário, hierarquias de mapa e mundo, fog, relógio, chat Unicode, reconexão e rollback de transação. Os registros de teste foram removidos e os hashes voltaram a coincidir com o snapshot.
5. Origem sem backend ativo e protegida por `BEGIN IMMEDIATE`; comparação com o snapshot imediatamente antes de importar para `rpg`. Conexão da aplicação alterada somente após importação e nova verificação completas.
6. Backend iniciado com a configuração ativa: `/api/health` retornou `database: ok`, consultando a base `rpg`. Todas as tabelas foram confirmadas como InnoDB. Prisma informou migrations atualizadas e nenhuma diferença de schema.
7. Build aprovado; 37 testes existentes e três testes do utilitário de migração passaram.

Os relatórios locais ficam em `backend/backups/mysql-migration/2026-10-16T07-45-44-834Z/`: `rehearsal-rollback.json`, `rehearsal-import.json`, `rehearsal-after-http.json`, `rpg-import.json` e `rpg-verify.json`. Eles contêm contagens e hashes, sem corpos de registros ou credenciais. A base descartável de ensaio foi removida após a validação.

## Operação e recuperação

`DATABASE_URL` é a conexão usada pelo backend e pelo Prisma. `MYSQL_DATABASE_URL` identifica o destino nos utilitários de transferência; `SQLITE_DATABASE_URL` registra a origem preservada. Não basta alterar uma URL: cliente gerado e schema precisam corresponder ao conector ativo.

Os backups locais e o cliente SQLite gerado estão excluídos pelo `.gitignore` do backend. O diretório de backup acima contém `source.db`, `restore-check.db`, `schema.sqlite.prisma` e `backend.env.before`. O arquivo SQLite original também foi preservado.

Para repetir **apenas a verificação**, após gerar o leitor com `npm run db:generate:sqlite`, execute a partir de `backend`, substituindo os caminhos:

```sh
node scripts/mysql/transfer.cjs --source CAMINHO_DO_SNAPSHOT --report NOVO_RELATORIO.json --verify
```

Para uma transferência futura, preparar backup/inventário e schema em outro destino antes de usar `--rehearse` (copia, confere e desfaz) ou `--import` (copia e confirma). Ambos exigem tabelas de aplicação vazias. O utilitário não faz merge, upsert ou limpeza de destino. Manter a origem sem escritores durante a cópia final; o snapshot usado pelo utilitário precisa representar essa origem. Divergência de conteúdo aborta a transação.

Se for necessário retornar ao SQLite **antes de novas gravações no MySQL**, parar o backend, restaurar o schema original e a configuração local do backup, apontar `prisma.config.ts` para o histórico SQLite e regenerar o cliente antes do build. Usar o arquivo SQLite preservado ou uma cópia restaurada e verificada do snapshot. A restauração de dados foi ensaiada em cópia; não houve reversão da aplicação ativa.

Depois de novas gravações no MySQL, retornar diretamente ao snapshot descartaria essas mudanças. Nesse caso, reconciliar/exportar os dados posteriores antes de trocar o conector. A reversão não deve usar `migrate reset` sobre a base que contém os dados.

## Próxima etapa

**MI-01:** converter a lore e o atlas em pacote validado, resolver fichas por origem/índice e oferecer prévia de importação. Gemma, memória narrativa, novas tabelas de lore e instalação do cenário permanecem nas fases seguintes.
