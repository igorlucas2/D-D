import { PrismaClient, ItemRarity, EquipmentSlot } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const achievements = [
    {
      code: 'FIRST_CHARACTER',
      name: 'Primeiro Passo',
      description: 'Crie seu primeiro personagem.',
      icon: '🧙',
    },
    {
      code: 'FIRST_ROLL',
      name: 'Sorte Lançada',
      description: 'Role seus primeiros dados.',
      icon: '🎲',
    },
    {
      code: 'NATURAL_20',
      name: 'Crítico!',
      description: 'Tire um 20 natural em um d20.',
      icon: '⭐',
    },
  ];
  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      update: {},
      create: achievement,
    });
  }

  const itemCount = await prisma.item.count();
  if (itemCount === 0) {
    await prisma.item.createMany({
      data: [
      {
        name: 'Espada Longa',
        description: 'Uma espada de aço bem balanceada.',
        weight: 1.5,
        value: 15,
        rarity: ItemRarity.COMMON,
        category: 'Arma',
        slot: EquipmentSlot.MAIN_HAND,
        properties: JSON.stringify({ damage: '1d8', damageType: 'cortante' }),
      },
      {
        name: 'Escudo de Madeira',
        description: 'Escudo reforçado com ferro.',
        weight: 3,
        value: 10,
        rarity: ItemRarity.COMMON,
        category: 'Armadura',
        slot: EquipmentSlot.OFF_HAND,
        properties: JSON.stringify({ armorBonus: 2 }),
      },
      {
        name: 'Poção de Cura',
        description: 'Restaura 2d4+2 pontos de vida.',
        weight: 0.5,
        value: 50,
        rarity: ItemRarity.COMMON,
        category: 'Consumível',
        slot: EquipmentSlot.NONE,
        properties: JSON.stringify({ healing: '2d4+2' }),
      },
      {
        name: 'Mochila de Aventureiro',
        description: 'Aumenta a capacidade de carga.',
        weight: 2,
        value: 5,
        rarity: ItemRarity.COMMON,
        category: 'Equipamento',
        slot: EquipmentSlot.NONE,
        properties: JSON.stringify({ extraCapacity: 30 }),
      },
      ],
    });
  }

  const monsterCount = await prisma.monster.count();
  if (monsterCount === 0) {
    await prisma.monster.createMany({
      data: [
        {
          name: 'Goblin',
          type: 'Humanoide',
          size: 'Pequeno',
          armorClass: 15,
          maxHp: 7,
          speed: 9,
          strength: 8,
          dexterity: 14,
          constitution: 10,
          intelligence: 10,
          wisdom: 8,
          charisma: 8,
          challengeRating: '1/4',
          xp: 50,
          traits: JSON.stringify([
            {
              name: 'Fuga Ágil',
              description: 'O goblin pode usar Disengage ou Hide como ação bônus em cada turno.',
            },
          ]),
          actions: JSON.stringify([
            {
              name: 'Cimitarra',
              description: 'Ataque corpo a corpo: +4 para acertar, alcance 1,5 m, um alvo. Dano: 1d6+2 cortante.',
            },
            {
              name: 'Arco Curto',
              description: 'Ataque à distância: +4 para acertar, alcance 24/96 m, um alvo. Dano: 1d6+2 perfurante.',
            },
          ]),
          description: 'Pequenos humanoides agressivos que vivem em bandos e emboscam viajantes.',
        },
        {
          name: 'Orc',
          type: 'Humanoide',
          size: 'Médio',
          armorClass: 13,
          maxHp: 15,
          speed: 9,
          strength: 16,
          dexterity: 12,
          constitution: 16,
          intelligence: 7,
          wisdom: 11,
          charisma: 10,
          challengeRating: '1/2',
          xp: 100,
          traits: JSON.stringify([
            {
              name: 'Fúria Implacável',
              description: 'Quando reduzido a 0 PV mas não morto, pode fazer um teste de CON (CD 10) para ficar com 1 PV.',
            },
          ]),
          actions: JSON.stringify([
            {
              name: 'Machado Grande',
              description: 'Ataque corpo a corpo: +5 para acertar, alcance 1,5 m, um alvo. Dano: 1d12+3 cortante.',
            },
            {
              name: 'Azagaia',
              description: 'Ataque corpo a corpo ou à distância: +5 para acertar, alcance 1,5 m ou 9/36 m. Dano: 1d6+3 perfurante.',
            },
          ]),
          description: 'Guerreiros brutais que vivem para a batalha e seguem os mais fortes.',
        },
        {
          name: 'Lobo',
          type: 'Fera',
          size: 'Médio',
          armorClass: 13,
          maxHp: 11,
          speed: 12,
          strength: 12,
          dexterity: 15,
          constitution: 12,
          intelligence: 3,
          wisdom: 12,
          charisma: 6,
          challengeRating: '1/4',
          xp: 50,
          traits: JSON.stringify([
            {
              name: 'Táticas de Matilha',
              description: 'O lobo tem vantagem em ataques contra uma criatura se ao menos um aliado estiver a até 1,5 m dela.',
            },
            {
              name: 'Audição e Olfato Aguçados',
              description: 'O lobo tem vantagem em testes de Percepção que usem audição ou olfato.',
            },
          ]),
          actions: JSON.stringify([
            {
              name: 'Mordida',
              description: 'Ataque corpo a corpo: +4 para acertar, alcance 1,5 m, um alvo. Dano: 2d4+2 perfurante. Se o alvo for uma criatura, deve ser bem-sucedido em um teste de FOR (CD 11) ou cair Caído.',
            },
          ]),
          description: 'Predadores que caçam em matilha, cercando suas presas.',
        },
        {
          name: 'Esqueleto',
          type: 'Morto-vivo',
          size: 'Médio',
          armorClass: 13,
          maxHp: 13,
          speed: 9,
          strength: 10,
          dexterity: 14,
          constitution: 15,
          intelligence: 6,
          wisdom: 8,
          charisma: 5,
          challengeRating: '1/4',
          xp: 50,
          traits: JSON.stringify([
            {
              name: 'Vulnerabilidades',
              description: 'Vulnerável a dano de concussão. Imune a veneno.',
            },
          ]),
          actions: JSON.stringify([
            {
              name: 'Espada Curta',
              description: 'Ataque corpo a corpo: +4 para acertar, alcance 1,5 m, um alvo. Dano: 1d6+2 perfurante.',
            },
            {
              name: 'Arco Curto',
              description: 'Ataque à distância: +4 para acertar, alcance 24/96 m, um alvo. Dano: 1d6+2 perfurante.',
            },
          ]),
          description: 'Restos animados de guerreiros caídos, controlados por magia necromântica.',
        },
        {
          name: 'Zumbi',
          type: 'Morto-vivo',
          size: 'Médio',
          armorClass: 8,
          maxHp: 22,
          speed: 6,
          strength: 13,
          dexterity: 6,
          constitution: 16,
          intelligence: 3,
          wisdom: 6,
          charisma: 5,
          challengeRating: '1/4',
          xp: 50,
          traits: JSON.stringify([
            {
              name: 'Fortitude de Morto-Vivo',
              description: 'Se um dano reduzir o zumbi a 0 PV, ele faz um teste de CON (CD 5 + dano) para ficar com 1 PV, exceto com dano radiante ou crítico.',
            },
          ]),
          actions: JSON.stringify([
            {
              name: 'Pancada',
              description: 'Ataque corpo a corpo: +3 para acertar, alcance 1,5 m, um alvo. Dano: 1d6+1 de concussão.',
            },
          ]),
          description: 'Cadáveres reanimados, lentos porém implacáveis e difíceis de derrubar.',
        },
        {
          name: 'Ogro',
          type: 'Gigante',
          size: 'Grande',
          armorClass: 11,
          maxHp: 59,
          speed: 12,
          strength: 19,
          dexterity: 8,
          constitution: 16,
          intelligence: 5,
          wisdom: 7,
          charisma: 7,
          challengeRating: '2',
          xp: 450,
          traits: null,
          actions: JSON.stringify([
            {
              name: 'Porrete Grande',
              description: 'Ataque corpo a corpo: +6 para acertar, alcance 3 m, um alvo. Dano: 2d8+4 de concussão.',
            },
            {
              name: 'Azagaia',
              description: 'Ataque corpo a corpo ou à distância: +6 para acertar, alcance 3 m ou 9/36 m. Dano: 2d6+4 perfurante.',
            },
          ]),
          description: 'Gigantes brutos e de baixa inteligência, conhecidos por sua força descomunal.',
        },
        {
          name: 'Urso-Coruja',
          type: 'Monstruosidade',
          size: 'Grande',
          armorClass: 13,
          maxHp: 59,
          speed: 12,
          strength: 20,
          dexterity: 12,
          constitution: 17,
          intelligence: 3,
          wisdom: 12,
          charisma: 7,
          challengeRating: '3',
          xp: 700,
          traits: JSON.stringify([
            {
              name: 'Visão e Olfato Aguçados',
              description: 'O urso-coruja tem vantagem em testes de Percepção que usem visão ou olfato.',
            },
          ]),
          actions: JSON.stringify([
            {
              name: 'Multiataque',
              description: 'O urso-coruja faz dois ataques: um com o Bico e um com as Garras.',
            },
            {
              name: 'Bico',
              description: 'Ataque corpo a corpo: +7 para acertar, alcance 1,5 m, um alvo. Dano: 1d10+5 perfurante.',
            },
            {
              name: 'Garras',
              description: 'Ataque corpo a corpo: +7 para acertar, alcance 1,5 m, um alvo. Dano: 2d8+5 cortante.',
            },
          ]),
          description: 'Criatura híbrida feroz, com corpo de urso e cabeça de coruja gigante.',
        },
        {
          name: 'Aranha Gigante',
          type: 'Fera',
          size: 'Grande',
          armorClass: 14,
          maxHp: 26,
          speed: 9,
          strength: 14,
          dexterity: 16,
          constitution: 12,
          intelligence: 2,
          wisdom: 11,
          charisma: 4,
          challengeRating: '1',
          xp: 200,
          traits: JSON.stringify([
            {
              name: 'Escalada em Teias',
              description: 'A aranha pode escalar superfícies difíceis, inclusive de cabeça para baixo em tetos, sem precisar de testes.',
            },
            {
              name: 'Sentido de Teia',
              description: 'A aranha sabe a localização exata de qualquer criatura tocando sua teia.',
            },
          ]),
          actions: JSON.stringify([
            {
              name: 'Mordida',
              description: 'Ataque corpo a corpo: +5 para acertar, alcance 1,5 m, um alvo. Dano: 1d8+3 perfurante mais 2d8 de veneno.',
            },
            {
              name: 'Teia (recarga 5-6)',
              description: 'Ataque à distância: +5 para acertar, alcance 18/30 m, um alvo. O alvo fica restrito por uma teia.',
            },
          ]),
          description: 'Predadores arbóreos que tecem teias enormes para capturar presas.',
        },
        {
          name: 'Cultista',
          type: 'Humanoide',
          size: 'Médio',
          armorClass: 12,
          maxHp: 9,
          speed: 9,
          strength: 11,
          dexterity: 12,
          constitution: 10,
          intelligence: 10,
          wisdom: 11,
          charisma: 10,
          challengeRating: '1/8',
          xp: 25,
          traits: JSON.stringify([
            {
              name: 'Devoção Sombria',
              description: 'O cultista tem vantagem em testes de resistência contra ser enfeitiçado ou amedrontado.',
            },
          ]),
          actions: JSON.stringify([
            {
              name: 'Cimitarra',
              description: 'Ataque corpo a corpo: +3 para acertar, alcance 1,5 m, um alvo. Dano: 1d6+1 cortante.',
            },
          ]),
          description: 'Seguidores fanáticos de cultos obscuros, geralmente encontrados em grupos.',
        },
        {
          name: 'Dragão Jovem Vermelho',
          type: 'Dragão',
          size: 'Grande',
          armorClass: 18,
          maxHp: 178,
          speed: 12,
          strength: 23,
          dexterity: 10,
          constitution: 21,
          intelligence: 14,
          wisdom: 11,
          charisma: 19,
          challengeRating: '10',
          xp: 5900,
          traits: null,
          actions: JSON.stringify([
            {
              name: 'Multiataque',
              description: 'O dragão faz três ataques: um com a Mordida e dois com as Garras.',
            },
            {
              name: 'Mordida',
              description: 'Ataque corpo a corpo: +10 para acertar, alcance 3 m, um alvo. Dano: 2d10+6 perfurante mais 1d6 de fogo.',
            },
            {
              name: 'Garras',
              description: 'Ataque corpo a corpo: +10 para acertar, alcance 1,5 m, um alvo. Dano: 2d6+6 cortante.',
            },
            {
              name: 'Sopro de Fogo (recarga 5-6)',
              description: 'O dragão exala fogo em um cone de 18 m. Cada criatura na área deve fazer um teste de DES (CD 17), sofrendo 16d6 de dano de fogo, ou metade se bem-sucedida.',
            },
          ]),
          description: 'Dragões jovens já são ameaças temíveis, cuspindo fogo devastador e dominando vastos territórios.',
        },
      ],
    });
  }

  const spellCount = await prisma.spell.count();
  if (spellCount === 0) {
    await prisma.spell.createMany({
      data: [
      {
        name: 'Curar Ferimentos',
        school: 'Evocação',
        level: 1,
        range: 'Toque',
        duration: 'Instantâneo',
        concentration: false,
        description: 'Restaura 1d8 + modificador de conjuração pontos de vida.',
        classes: JSON.stringify(['Clerigo', 'Druida', 'Paladino']),
      },
      {
        name: 'Bola de Fogo',
        school: 'Evocação',
        level: 3,
        range: '45 metros',
        duration: 'Instantâneo',
        concentration: false,
        description: 'Explosão de fogo que causa 8d6 de dano em uma área.',
        classes: JSON.stringify(['Mago', 'Feiticeiro']),
      },
      {
        name: 'Escudo Arcano',
        school: 'Abjuração',
        level: 1,
        range: 'Pessoal',
        duration: '1 rodada',
        concentration: false,
        description: '+5 de CA até o início do próximo turno.',
        classes: JSON.stringify(['Mago', 'Feiticeiro']),
      },
      ],
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
