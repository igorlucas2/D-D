import { PrismaClient } from '@prisma/client';
import {
  cacheSize,
  loadCache,
  saveCache,
  translateBatch,
  translateLong,
  translateText,
} from './translate-utils';

const SOURCE = 'dnd5eapi-2014';
const prisma = new PrismaClient();

interface Feature {
  name: string;
  description: string;
}

async function getSrdData(
  endpoint: string,
  index: string,
): Promise<Record<string, unknown> | null> {
  const resource = await prisma.srdResource.findUnique({
    where: { endpoint_index: { endpoint, index } },
  });
  if (!resource) return null;
  return JSON.parse(resource.data) as Record<string, unknown>;
}

async function processRuleSections() {
  const rules = await prisma.ruleSection.findMany({
    where: { source: SOURCE },
  });
  console.log(`RuleSection: ${rules.length} registros`);

  let processed = 0;
  let skipped = 0;
  for (const rule of rules) {
    const srd = rule.srdIndex
      ? await getSrdData('rule-sections', rule.srdIndex)
      : null;
    if (srd && rule.name !== (srd.name as string)) {
      skipped += 1;
      continue;
    }

    const name = await translateText(rule.name);
    const description = rule.description
      ? await translateLong(rule.description)
      : rule.description;

    await prisma.ruleSection.update({
      where: { id: rule.id },
      data: { name, description },
    });

    processed += 1;
    console.log(`  [${processed}/${rules.length}] ${rule.name} -> ${name}`);
    saveCache();
  }
  console.log(`RuleSection concluído: ${processed} traduzidos, ${skipped} já traduzidos.`);
}

async function processItems() {
  const items = await prisma.item.findMany({ where: { source: SOURCE } });
  console.log(`Item: ${items.length} registros`);

  let processed = 0;
  let skipped = 0;
  for (const item of items) {
    let srd: Record<string, unknown> | null = null;
    if (item.srdIndex) {
      const [endpoint, index] = item.srdIndex.includes(':')
        ? item.srdIndex.split(':')
        : ['equipment', item.srdIndex];
      srd = await getSrdData(endpoint, index);
    }
    if (srd && item.name !== (srd.name as string)) {
      skipped += 1;
      continue;
    }

    const name = await translateText(item.name);
    const description = item.description
      ? await translateLong(item.description)
      : item.description;

    let properties = item.properties;
    if (properties) {
      const parsed = JSON.parse(properties) as Record<string, unknown>;
      const special = parsed.special as string[] | undefined;
      if (special && special.length) {
        parsed.special = await translateBatch(special);
        properties = JSON.stringify(parsed);
      }
    }

    await prisma.item.update({
      where: { id: item.id },
      data: { name, description, properties },
    });

    processed += 1;
    console.log(`  [${processed}/${items.length}] ${item.name} -> ${name}`);
    if (processed % 10 === 0) saveCache();
  }
  saveCache();
  console.log(`Item concluído: ${processed} traduzidos, ${skipped} já traduzidos.`);
}

async function processSpells() {
  const spells = await prisma.spell.findMany({ where: { source: SOURCE } });
  console.log(`Spell: ${spells.length} registros`);

  let processed = 0;
  let skipped = 0;
  for (const spell of spells) {
    const srd = spell.srdIndex
      ? await getSrdData('spells', spell.srdIndex)
      : null;
    if (srd && spell.name !== (srd.name as string)) {
      skipped += 1;
      continue;
    }

    const name = await translateText(spell.name);
    const description = spell.description
      ? await translateLong(spell.description)
      : spell.description;

    await prisma.spell.update({
      where: { id: spell.id },
      data: { name, description },
    });

    processed += 1;
    console.log(`  [${processed}/${spells.length}] ${spell.name} -> ${name}`);
    if (processed % 10 === 0) saveCache();
  }
  saveCache();
  console.log(`Spell concluído: ${processed} traduzidos, ${skipped} já traduzidos.`);
}

async function processMonsters() {
  const monsters = await prisma.monster.findMany({ where: { source: SOURCE } });
  console.log(`Monster: ${monsters.length} registros`);

  const pending: typeof monsters = [];
  let skipped = 0;
  for (const monster of monsters) {
    const srd = monster.srdIndex
      ? await getSrdData('monsters', monster.srdIndex)
      : null;
    if (srd && monster.name !== (srd.name as string)) {
      skipped += 1;
      continue;
    }
    pending.push(monster);
  }
  console.log(`  pendentes: ${pending.length}/${monsters.length} (${skipped} já traduzidos)`);

  const names = pending.map((m) => m.name);
  const translatedNames = await translateBatch(names);
  console.log('Nomes de monstros traduzidos.');
  saveCache();

  const allFeatureNames: string[] = [];
  const allFeatureDescs: string[] = [];
  for (const monster of pending) {
    for (const field of [monster.traits, monster.actions]) {
      if (!field) continue;
      const arr = JSON.parse(field) as Feature[];
      arr.forEach((f) => {
        allFeatureNames.push(f.name);
        allFeatureDescs.push(f.description);
      });
    }
  }
  console.log(
    `Traduzindo ${allFeatureNames.length} nomes e ${allFeatureDescs.length} descrições de traits/actions...`,
  );
  await translateBatch(allFeatureNames);
  saveCache();
  await translateBatch(allFeatureDescs);
  saveCache();
  console.log('Traits/actions traduzidos.');

  for (let i = 0; i < pending.length; i += 1) {
    const monster = pending[i];
    const name = translatedNames[i];

    let traits = monster.traits;
    if (traits) {
      const arr = JSON.parse(traits) as Feature[];
      const translated = await Promise.all(
        arr.map(async (f) => ({
          name: await translateText(f.name),
          description: await translateText(f.description),
        })),
      );
      traits = JSON.stringify(translated);
    }

    let actions = monster.actions;
    if (actions) {
      const arr = JSON.parse(actions) as Feature[];
      const translated = await Promise.all(
        arr.map(async (f) => ({
          name: await translateText(f.name),
          description: await translateText(f.description),
        })),
      );
      actions = JSON.stringify(translated);
    }

    await prisma.monster.update({
      where: { id: monster.id },
      data: { name, traits, actions },
    });

    console.log(`  [${i + 1}/${pending.length}] ${monster.name} -> ${name}`);
    if ((i + 1) % 10 === 0) saveCache();
  }
  saveCache();
  console.log(`Monster concluído: ${pending.length} traduzidos, ${skipped} já traduzidos.`);
}

async function main() {
  const target = process.argv[2] ?? 'rules';
  loadCache();

  try {
    if (target === 'rules' || target === 'all') await processRuleSections();
    if (target === 'items' || target === 'all') await processItems();
    if (target === 'spells' || target === 'all') await processSpells();
    if (target === 'monsters' || target === 'all') await processMonsters();
  } finally {
    saveCache();
    console.log(`Cache final: ${cacheSize()} entradas.`);
    await prisma.$disconnect();
  }
}

void main();
