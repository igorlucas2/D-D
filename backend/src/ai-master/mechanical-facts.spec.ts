import { describeMechanicalResult } from './mechanical-facts';

describe('describeMechanicalResult', () => {
  it('descreve dano/cura com PV final', () => {
    const facts = describeMechanicalResult('DAMAGE', {
      target: { name: 'Goblin' },
      applied: 6,
      hpAfter: { current: 2, max: 8, temp: 0 },
    });
    expect(facts.targets[0]).toEqual({
      name: 'Goblin',
      result: '6 de dano · PV 2/8',
    });
  });

  it('descreve item consumido', () => {
    const facts = describeMechanicalResult('USE_ITEM', {
      item: { name: 'Poção de Cura', quantityAfter: 1 },
      effectKind: 'HEAL',
      applied: 4,
      target: { name: 'elfo' },
      hpAfter: { current: 6, max: 6, temp: 0 },
    });
    expect(facts.action).toBe('Uso de Poção de Cura');
    expect(facts.targets[0].result).toContain('4 de cura');
    expect(facts.targets[0].result).toContain('restam 1');
  });

  it('descreve magia com ataque e save', () => {
    const attack = describeMechanicalResult('CAST_SPELL', {
      spell: { name: 'Raio de Fogo' },
      slot: null,
      targets: [
        {
          name: 'Goblin',
          attack: { total: 18, ac: 13, hit: true, critical: false },
          applied: 7,
          hpAfter: { current: 1, max: 8, temp: 0 },
        },
      ],
    });
    expect(attack.action).toBe('Raio de Fogo');
    expect(attack.targets[0].result).toContain('acertou');
    expect(attack.targets[0].result).toContain('7 de dano');

    const save = describeMechanicalResult('CAST_SPELL', {
      spell: { name: 'Bola de Fogo' },
      slot: { level: 3 },
      targets: [
        {
          name: 'Goblin',
          save: { total: 12, dc: 13, success: false },
          applied: 20,
          hpAfter: { current: 0, max: 8, temp: 0 },
        },
      ],
    });
    expect(save.targets[0].result).toContain('falhou no save');
  });

  it('descreve ataque com arma e crítico', () => {
    const facts = describeMechanicalResult('WEAPON_ATTACK', {
      weapon: { name: 'Punhal' },
      target: { name: 'Goblin' },
      attack: {
        total: 22,
        ac: 13,
        hit: true,
        critical: true,
      },
      damage: { damageType: 'piercing' },
      applied: 9,
      hpAfter: { current: 0, max: 8, temp: 0 },
    });
    expect(facts.action).toBe('Ataque com Punhal');
    expect(facts.targets[0].result).toContain('crítico');
    expect(facts.targets[0].result).toContain('9 de dano piercing');
    expect(facts.targets[0].result).toContain('PV 0/8');
  });

  it('não chama dano automático de cura', () => {
    const facts = describeMechanicalResult('CAST_SPELL', {
      spell: { name: 'Míssil Mágico' },
      slot: { level: 1 },
      damageType: 'force',
      effectKind: 'DAMAGE',
      targets: [
        {
          name: 'Goblin',
          attack: null,
          save: null,
          applied: 12,
          hpAfter: { current: 0, max: 12, temp: 0 },
        },
      ],
    });
    expect(facts.targets[0].result).toContain('12 de dano');
    expect(facts.targets[0].result).not.toContain('cura');
  });

  it('não quebra com resultado desconhecido', () => {
    const facts = describeMechanicalResult('UNKNOWN', null);
    expect(facts.action).toBe('Condição');
    expect(facts.targets[0].name).toBe('Alvo');
  });
});
