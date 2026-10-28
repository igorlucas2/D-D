import {
  parseDamageDefenses,
  resolveDamageDefense,
} from './damage-defense.types';

describe('damage defense', () => {
  it('metade na resistência', () => {
    expect(
      resolveDamageDefense(11, 'fire', [
        { damageType: 'fogo', type: 'RESISTANCE' },
      ]),
    ).toMatchObject({
      type: 'RESISTANCE',
      original: 11,
      adjusted: 5,
      multiplier: 0.5,
    });
  });

  it('zera na imunidade', () => {
    expect(
      resolveDamageDefense(20, 'piercing', [
        { damageType: 'piercing', type: 'IMMUNITY' },
      ]).adjusted,
    ).toBe(0);
  });

  it('dobra na vulnerabilidade', () => {
    expect(
      resolveDamageDefense(6, 'cold', [
        { damageType: 'gelo', type: 'VULNERABILITY' },
      ]).adjusted,
    ).toBe(12);
  });

  it('resistência + vulnerabilidade voltam ao normal', () => {
    expect(
      resolveDamageDefense(10, 'fire', [
        { damageType: 'fire', type: 'RESISTANCE' },
        { damageType: 'fire', type: 'VULNERABILITY' },
      ]),
    ).toMatchObject({ type: null, adjusted: 10 });
  });

  it('tipo sem defesa não muda', () => {
    expect(resolveDamageDefense(8, 'force', [])).toMatchObject({
      type: null,
      adjusted: 8,
    });
  });

  it('lê defesas JSON de participante', () => {
    expect(
      parseDamageDefenses(
        JSON.stringify([
          { damageType: 'fogo', type: 'RESISTANCE' },
          { damageType: 'x', type: 'NOPE' },
        ]),
      ),
    ).toEqual([{ damageType: 'fogo', type: 'RESISTANCE' }]);
  });
});
