import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Cache curto por requisição HTTP. Vive em AsyncLocalStorage para não vazar
 * dados entre requisições (e não força serviços a virar request-scoped).
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<Map<string, unknown>>();

  run<T>(callback: () => T): T {
    return this.storage.run(new Map<string, unknown>(), callback);
  }

  get<T>(key: string): T | undefined {
    return this.storage.getStore()?.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.storage.getStore()?.set(key, value);
  }

  delete(key: string): void {
    this.storage.getStore()?.delete(key);
  }
}
