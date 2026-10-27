import * as fs from 'fs';
import * as path from 'path';

const CACHE_PATH = path.join(__dirname, '.translation-cache.json');
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const DELIMITER = '\n@@@\n';

let cache = new Map<string, string>();
let dirty = false;

export function loadCache() {
  if (fs.existsSync(CACHE_PATH)) {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as Record<
      string,
      string
    >;
    cache = new Map(Object.entries(raw));
    console.log(`Cache de traduções carregado: ${cache.size} entradas`);
  }
}

export function saveCache() {
  if (!dirty) return;
  fs.writeFileSync(CACHE_PATH, JSON.stringify(Object.fromEntries(cache)));
  dirty = false;
  console.log(`Cache salvo: ${cache.size} entradas`);
}

export function cacheSize() {
  return cache.size;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateRaw(text: string): Promise<string> {
  const url = `${ENDPOINT}?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(text)}`;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status === 503) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as unknown[];
      const segments = data[0] as unknown[];
      return segments.map((seg) => (seg as unknown[])[0] as string).join('');
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }

  throw new Error('translateRaw: unreachable');
}

// Traduz um texto único, usando cache em disco para evitar repetições.
export async function translateText(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const cached = cache.get(trimmed);
  if (cached !== undefined) return cached;

  const translated = await translateRaw(trimmed);
  cache.set(trimmed, translated);
  dirty = true;
  await sleep(150);
  return translated;
}

// Traduz um texto longo (markdown), dividindo em blocos por parágrafo
// para respeitar o limite de tamanho da requisição e preservar a formatação.
export async function translateLong(
  text: string,
  maxChars = 3500,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (trimmed.length <= maxChars) return translateText(trimmed);

  const paragraphs = trimmed.split(/\n\n/);
  const chunks: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = para;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  const results: string[] = [];
  for (const chunk of chunks) {
    results.push(await translateText(chunk));
  }
  return results.join('\n\n');
}

// Traduz uma lista de textos curtos, agrupando-os em poucas requisições
// (separadas por delimitador) para reduzir a quantidade de chamadas à API.
export async function translateBatch(
  texts: string[],
  maxChars = 3500,
): Promise<string[]> {
  const toTranslate = Array.from(
    new Set(
      texts.map((t) => t.trim()).filter((t) => t && !cache.has(t)),
    ),
  );

  let batch: string[] = [];
  let len = 0;

  const flush = async () => {
    if (!batch.length) return;

    if (batch.length === 1) {
      cache.set(batch[0], await translateRaw(batch[0]));
      dirty = true;
      await sleep(150);
      batch = [];
      len = 0;
      return;
    }

    const joined = batch.join(DELIMITER);
    const result = await translateRaw(joined);
    const parts = result.split(/\n?@@@\n?/);

    if (parts.length === batch.length) {
      batch.forEach((item, i) => cache.set(item, parts[i].trim()));
      dirty = true;
    } else {
      // A tradução juntou/dividiu os trechos de forma inesperada: traduz um a um.
      for (const item of batch) {
        cache.set(item, await translateRaw(item));
        dirty = true;
        await sleep(150);
      }
    }

    await sleep(150);
    batch = [];
    len = 0;
  };

  for (const t of toTranslate) {
    if (len + t.length + DELIMITER.length > maxChars && batch.length) {
      await flush();
    }
    batch.push(t);
    len += t.length + DELIMITER.length;
  }
  await flush();

  return texts.map((t) => {
    const trimmed = t.trim();
    if (!trimmed) return t;
    return cache.get(trimmed) ?? t;
  });
}
