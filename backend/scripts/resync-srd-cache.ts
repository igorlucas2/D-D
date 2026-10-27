import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SrdSyncService } from '../src/srd/srd-sync.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(SrdSyncService);
  const result = await service.resyncFromCache();
  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

void main();
