import { PrismaClient } from '@prisma/client';

// Sincroniza as tabelas do cliente Ragnarok Online (ragassets) com o MySQL do
// Eldoria. O catalogo fica em tabelas proprias: ele nao altera as regras SRD
// da mesa narrada.
const BASE = 'https://assets.latam-tools.com.br';
const prisma = new PrismaClient();

type Job = { id: number; jt: string; name: string; hasIcon?: boolean };
type Skill = {
  id: number;
  name: string;
  maxLevel?: number;
  description?: string | null;
  delay?: unknown;
  parent?: string | number | null;
};
type Item = {
  id: number;
  name: string;
  slots?: number;
  aegisName?: string | null;
  resourceName?: string | null;
  description?: string | null;
  view?: number | null;
  spriteView?: number | null;
  spriteBlank?: boolean;
  viewKind?: string | null;
  equipSlots?: unknown;
  costume?: boolean;
  contains?: unknown;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'eldoria-ragnarok-sync/1.0' },
  });
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function chunks<T>(rows: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    result.push(rows.slice(index, index + size));
  }
  return result;
}

async function main() {
  console.log('Buscando dados do ragassets...');
  const [jobs, skills, items, mapData] = await Promise.all([
    fetchJson<Job[]>('/raw/jobs.json'),
    fetchJson<Skill[]>('/raw/skills.json'),
    fetchJson<Item[]>('/raw/items.json'),
    fetchJson<{ maps: string[] }>('/maps/index.json'),
  ]);

  const namedJobs = jobs.filter((job) => job.name?.trim() && job.jt?.trim());
  const namedItems = items.filter((item) => item.name?.trim());

  console.log(
    `Recebidos: ${namedJobs.length} classes nomeadas, ${skills.length} skills, ${namedItems.length} itens nomeados, ${mapData.maps.length} mapas.`,
  );

  for (const batch of chunks(namedJobs)) {
    await prisma.ragnarokJob.createMany({
      data: batch.map((job) => ({
        id: job.id,
        jt: job.jt ?? `JT_${job.id}`,
        name: job.name,
        hasIcon: Boolean(job.hasIcon),
      })),
      skipDuplicates: true,
    });
  }

  for (const batch of chunks(skills)) {
    await prisma.ragnarokSkill.createMany({
      data: batch.map((skill) => ({
        id: skill.id,
        name: skill.name ?? `Skill ${skill.id}`,
        maxLevel: skill.maxLevel ?? 1,
        description: skill.description ?? null,
        delay: skill.delay ?? undefined,
        parent: skill.parent != null ? String(skill.parent) : null,
      })),
      skipDuplicates: true,
    });
  }

  for (const batch of chunks(namedItems)) {
    await prisma.ragnarokItem.createMany({
      data: batch.map((item) => ({
        id: item.id,
        name: item.name,
        slots: item.slots ?? 0,
        aegisName: item.aegisName ?? null,
        resourceName: item.resourceName ?? null,
        description: item.description ?? null,
        view: item.view ?? null,
        spriteView: item.spriteView ?? null,
        spriteBlank: Boolean(item.spriteBlank),
        viewKind: item.viewKind ?? null,
        equipSlots: item.equipSlots ?? undefined,
        costume: Boolean(item.costume),
        contains: item.contains ?? undefined,
      })),
      skipDuplicates: true,
    });
  }

  for (const batch of chunks(mapData.maps)) {
    await prisma.ragnarokMap.createMany({
      data: batch.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }

  console.log(
    `Banco: ${await prisma.ragnarokJob.count()} classes, ${await prisma.ragnarokSkill.count()} skills, ${await prisma.ragnarokItem.count()} itens, ${await prisma.ragnarokMap.count()} mapas.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
