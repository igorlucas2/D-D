import { mapMonster } from './srd-mappers';

describe('mapMonster', () => {
  it('importa resistÃªncias, imunidades e vulnerabilidades', () => {
    const monster = mapMonster({
      index: 'test-monster',
      name: 'Teste',
      type: 'dragon',
      size: 'Large',
      armor_class: [{ value: 16 }],
      hit_points: 30,
      speed: { walk: '30 ft.' },
      strength: 16,
      dexterity: 12,
      constitution: 14,
      intelligence: 8,
      wisdom: 10,
      charisma: 8,
      challenge_rating: 2,
      xp: 450,
      damage_resistances: ['cold', 'fire'],
      damage_immunities: ['poison'],
      damage_vulnerabilities: ['radiant'],
    });
    expect(JSON.parse(monster.damageDefenses ?? '[]')).toEqual([
      { damageType: 'cold', type: 'RESISTANCE' },
      { damageType: 'fire', type: 'RESISTANCE' },
      { damageType: 'poison', type: 'IMMUNITY' },
      { damageType: 'radiant', type: 'VULNERABILITY' },
    ]);
  });
});
