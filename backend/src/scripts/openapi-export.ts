import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from '../openapi';

/**
 * Gera `docs/openapi.json` a partir do app compilado (o plugin do Swagger no
 * `nest build` é quem adiciona os metadados dos DTOs).
 *
 * Requer o banco configurado porque o AppModule inicializa o Prisma. Rode com
 * `npm run openapi:export` (compila antes).
 */
async function main() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: false,
  });
  app.setGlobalPrefix('api');
  await app.init();

  const document = buildOpenApiDocument(app);
  const output = resolve(process.cwd(), '..', 'docs', 'openapi.json');
  writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(
    `OpenAPI salvo em ${output} (${Object.keys(document.paths).length} rotas)`,
  );

  await app.close();
}

main().catch((error) => {
  console.error('Falha ao gerar o OpenAPI:', error);
  process.exitCode = 1;
});
