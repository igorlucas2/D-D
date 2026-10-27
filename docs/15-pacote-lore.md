# MI-01 — Pacote de lore e prévia do mestre

**Registro da entrega MI-01.** A instalação foi implementada depois, em [MI-02 — mundo persistente](./16-mundo-persistente.md), que descreve o comportamento atual. As limitações de instalação e entrega de imagens abaixo correspondem à etapa MI-01.

Entrega de 16/10/2026, referente à [spec MI v1.4](./13-mestre-ia-lore.md). O cenário **O Pacto dos Três Sinos** está estruturado e validado no backend. Esta fase não cria tabelas, não instala o mundo em campanhas e não chama um modelo de IA.

## Usar no jogo

Com backend e frontend ativos, abra uma campanha como mestre e escolha **Cenário → Revisar cenário**. A página fica em `/campaigns/:id/lore` e apresenta a premissa pública, o elenco e seu conhecimento, fatos, segredos, objetivos, pistas, mapas/rotas, facções, encontros, história, pressões e reparos. Os mapas aparecem nesta fase como nomes, dimensões e caminhos; suas imagens ainda não são instaladas na mesa.

Jogadores não têm o atalho nem acesso à revisão privada. O backend verifica o proprietário da campanha antes de ler o pacote ou consultar as fichas. Ler um segredo no caderno não o revela aos personagens. A página não grava a lore em localStorage.

O rascunho contém oito NPCs, oito referências de criaturas, quatro facções, seis lugares regionais, seis pontos urbanos, cinco salas, seis objetos, 14 fatos canônicos e nove fatos de observação, cinco afirmações/crenças, quatro fios, quatro conclusões com três pistas alternativas cada, cinco eventos de pressão, quatro reparos e três mapas SVG/PNG.

## Arquivos e confiança

O pacote está em [`backend/content/eldoria-tres-sinos/1.0.0`](../backend/content/eldoria-tres-sinos/1.0.0/manifest.json). O manifesto lista 13 arquivos com SHA-256. O hash do próprio manifesto fica em [`bundled-packs.ts`](../backend/src/lore/bundled-packs.ts), compilado com o backend; ele também é o `contentHash` devolvido ao mestre. Essa fixação detecta divergência entre os arquivos e a versão aprovada no código. Não é uma assinatura digital de conteúdo externo.

[`lore.schema.ts`](../backend/src/lore/lore.schema.ts) define schemas Draft-07 compilados uma vez com AJV 8, sem propriedades livres ou coerção silenciosa. O carregador recusa pacote desconhecido, checksums divergentes, arquivo ausente, caminhos externos, audiência indevida e referências inconsistentes. Nenhuma API aceita upload, URL ou diretório arbitrário.

Também são validados IDs únicos; tipos das referências; ciclos de lugares, mapas e pressões; limites da grade; hotspots e hierarquia; conectividade regional; rotas duplicadas; fontes de pistas; conhecimento versus crença; restrições de recompensas e reserva de encontros posteriores. Texturas PNG precisam corresponder à proporção da grade; SVGs do pacote não podem conter scripts ou referências remotas.

O único arquivo marcado `PUBLIC` é `public.json`. Mesmo os mapas divulgáveis ficam como `MASTER` no manifesto por enquanto: sua entrega depende da autorização e das descobertas de MI-02. A pasta `content` não é montada como diretório estático. O build do Nest copia o pacote para `dist/content`; a resolução não depende do diretório atual do processo.

## Contratos implementados

Todas as rotas abaixo usam o prefixo `/api`, JWT e `Cache-Control: no-store`.

| Rota | Autorização | Resposta |
| --- | --- | --- |
| `GET /lore-packs` | Usuário autenticado | ID, versão, status e conteúdo público. Sem contadores privados, manifesto, fontes privadas ou segredos. Falha de validação vira erro genérico 503. |
| `POST /campaigns/:id/lore/install-preview` | Mestre proprietário | Premissa, contagens, revisão privada, fontes, catálogo resolvido, pendências e conflitos. Pacote inválido: 422; pacote/campanha inexistente: 404; outro usuário: 403. |

Corpo da prévia:

```json
{ "packId": "eldoria-tres-sinos", "version": "1.0.0" }
```

Cada vínculo resolve por igualdade exata de `source` e `srdIndex`, inclusive após a consulta ao MySQL. Zero resultados gera `MISSING`; mais de um gera `AMBIGUOUS`; nenhuma dessas situações escolhe uma ficha pelo nome ou pela primeira linha. `monsterId` fica nulo em ambos os erros. Atributos como `isNpc` não substituem a identidade: Sava usa o bloco `goblin` como pessoa do cenário.

`catalogValid` informa a resolução das fichas. `campaignEligible` verifica se há somente o mestre e nenhuma relação de conteúdo/calendário/combate. Qualquer conteúdo já existente gera `CAMPAIGN_NOT_EMPTY`. Abrir funcionalidades antigas que criam calendário ou outros registros também pode tornar a campanha inelegível: MI-02 deve oferecer a escolha do cenário na criação, antes desses registros.

`canInstall` é sempre `false` em MI-01, inclusive quando o catálogo está válido e a campanha vazia. Não existe endpoint de instalação. A prévia repetida consulta o estado sem gerar eventos, mapas, NPCs, recompensas ou revisões no banco.

## Atualizar e verificar o rascunho

Execute em `backend`:

```sh
npm run lore:build-editorial
npm run build
npm run lore:validate
npm test -- --runInBand
npm run test:lore-http
```

O gerador Python usa a lore/atlas editoriais e complementa a estrutura em [`build-editorial.py`](../backend/scripts/lore/build-editorial.py). Nesta etapa ele é específico para este cenário. Revise as mudanças em JSON e no registro de hashes; não use a regeneração como aprovação editorial automática. O gerador recusa sobrescrever uma versão marcada `PUBLISHED`. Alterações de conteúdo publicado deverão receber nova versão e registro explícito.

`lore:validate` lê o pacote compilado e consulta o catálogo do `DATABASE_URL` local. Por isso, execute o build após editar o rascunho. Não imprime credenciais ou modifica registros. Os 16 vínculos resolveram no MySQL local, sem pendências.

`test:lore-http` exige ao menos uma campanha existente. O teste usa sessões temporárias assinadas apenas em memória para verificar proprietário, membro e outro usuário. Uma extensão do Prisma bloqueia operações de escrita; nenhuma conta ou campanha de teste é criada. Não imprime tokens. A variante opcional `node scripts/lore/smoke.cjs --browser` usa Playwright instalado no ambiente, um frontend já iniciado na porta 3100 com proxy padrão para 3001 e um backend de teste somente para leitura na porta 3001. Se necessário, `LORE_PLAYWRIGHT_MODULE` informa o caminho do módulo Playwright e `LORE_BROWSER_CHANNEL=chrome` usa o Chrome instalado em uma sessão isolada. Capturas ficam em `backend/backups/lore-browser-check`, ignorado pelo controle de versão.

## Evidências e próximos passos

- Backend: build e 66 testes aprovados, incluindo 29 casos de lore sobre integridade, equivalência editorial, geografia, conhecimento, catálogo e autorização.
- API com MySQL real: 16 vínculos resolvidos, projeção pública sem segredos, proprietário autorizado, membro/outro usuário recusados, DTO inválido recusado e prévia repetível; escritas bloqueadas durante o ensaio.
- Frontend: TypeScript, lint dos arquivos novos e build de produção aprovados; rota `/campaigns/[id]/lore` incluída.
- Navegador: revisão privada em desktop e celular (1440×1000 e 390×844), sem overflow horizontal; falha temporária e nova tentativa; jogador recusado antes de solicitar segredos; visitante encaminhado ao login. Capturas revisadas visualmente. O ensaio completo usou 18 consultas somente de leitura no MySQL.

O pacote permanece `DRAFT`: faltam teste de equilíbrio, revisão de atribuição e definição da recompensa monetária antes de habilitá-la. Hospedagem está descrita como benefício narrativo; nenhum pagamento é executado. Condições e efeitos em texto são conteúdo para revisão, não expressões executáveis: MI-04 terá que traduzi-los em comandos tipados com precondições verificáveis.

A próxima etapa é MI-02: migrations de entidades e lugares por campanha, cópia das fichas como snapshots, calendário, mapas/hotspots, paredes/portas da abadia e instalação atômica idempotente. Histórico de fatos/conhecimento persistente vem em MI-03; Gemma entra em MI-05, depois das garantias de estado e comandos.
