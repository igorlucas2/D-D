# Backend Eldoria

O banco ativo é **MySQL**. A etapa MI-DB e a migração dos dados locais estão documentadas em [Migração MySQL](../docs/14-migracao-mysql.md). O schema usa Prisma 6; as migrations ativas ficam em `prisma/mysql-migrations`. `prisma/migrations` preserva exclusivamente o histórico SQLite anterior.

Configure `DATABASE_URL` no `.env` local a partir de [.env.example](./.env.example). Para uma base MySQL nova:

```sh
npm install
npm run db:generate
npm run db:deploy
npm run build
npm run start:prod
```

`db:deploy` cria/atualiza o schema; não importa o catálogo nem copia uma campanha. A transferência SQLite→MySQL é uma operação separada, documentada no procedimento MI-DB. A base local `rpg` já recebeu essa transferência.

Verificações: `npm test -- --runInBand` e `npm run test:db-migration`. O teste HTTP de migração (`node scripts/mysql/smoke.cjs`, após build) exige uma base descartável com prefixo `rpg_migration_check_` e um catálogo importado.

**Lore MI-01/MI-02:** pacote privado em `content/eldoria-tres-sinos/1.0.0`, validado e copiado para `dist/content` durante o build. `npm run lore:validate` confere as fichas no MySQL; `npm run test:lore-http` testa leituras autenticadas com escritas bloqueadas. **Nova campanha** permite instalar o cenário de teste atomicamente; **Cenário** exibe a cópia persistida ao mestre. A migration MI-02 adicionou 11 tabelas e preservou os dados anteriores. `npm run test:lore-install` exige uma base descartável, nunca `rpg`. [Contrato e operação atual](../docs/16-mundo-persistente.md).

**História MI-03:** **Memórias** permite ao mestre registrar fatos versionados, acontecimentos, descobertas, relações, promessas e fios. Cada personagem guarda a versão que observou; jogadores recebem somente projeções autorizadas. A migration adiciona 11 tabelas e um contador. Novas instalações incluem a memória; instalações anteriores usam preparo explícito pela tela. `npm run test:story` exige uma base descartável, nunca `rpg`; `node scripts/story/run-rehearsal.cjs` usa a referência do ensaio local. [Contratos, testes e limites](../docs/17-historia-conhecimento.md).

**Comandos MI-04:** **Comandos** permite solicitar/confirmar viagem e descanso coletivos, transporte de objetos de trama e passagem de tempo. Estado, localização factual, histórico e outbox são transacionais; notificações individuais revalidam membros/audiência. Campanhas com lore usam esses comandos para relógio e descanso. Duas novas tabelas; C07 vinculado ao badajo e cinco fatos de localização adicionais. `npm run test:game-actions` exige base descartável; `node scripts/game-actions/run-rehearsal.cjs --browser` exercita também a interface com frontend na porta 3100. [Contrato, migração e limites](../docs/18-comandos-grupo.md).

**Copiloto MI-05:** o mestre usa **Copiloto** para consultar fatos, preparar fala de NPC ou narração pública, revisar texto e aprovar propostas de viagem/descanso/descoberta. Ollama local com `gemma2:9b`, sem fallback para nuvem; configuração padrão `http://127.0.0.1:11434`, `GAME_MASTER_MODEL` e `GAME_MASTER_TIMEOUT_MS` opcionais. Campanhas começam desligadas; pausa cancela propostas não aprovadas. `npm run test:game-master` exige base descartável; `node scripts/game-master/run-rehearsal.cjs --model` avalia o modelo real, e `--browser` testa a interface com provedor controlado. [Contrato, resultados e limites](../docs/19-mestre-copiloto.md).

**Intenções MI-06A:** participantes usam **Intenções** para enviar pedidos de personagens próprios e conversar com NPCs presentes. Rascunhos ficam privados ao mestre; respostas e esclarecimentos aprovados chegam somente ao autor. Continuação, cancelamento e fallback humano são persistentes. `node scripts/game-master/run-rehearsal.cjs --intents` verifica o contrato e `--intents-browser` verifica a interface. [Implementação e limites](../docs/20-intencoes-dialogos.md). Autonomia ainda não habilitada.

**Prazos MI-06B:** **Prazos** permite ao mestre autorizar lembretes e viagens de NPCs. O relógio aprovado executa capacidades determinísticas com revalidação, pausa, orçamento, partida/chegada distintas e conhecimento versionado, sem chamar Gemma. Política desligada por padrão. Migration aditiva com duas tabelas. `node scripts/consequences/run-rehearsal.cjs --browser` testa também a interface, com frontend na porta 3100 e Playwright; sem `--browser`, executa a integração. [Contrato, migração e limites](../docs/21-prazos-do-mundo.md).

---

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
