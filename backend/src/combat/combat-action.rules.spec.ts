import {
  addCondition,
  applyDamage,
  applyHeal,
  applyTempHp,
  removeCondition,
} from './combat-action.types';

describe('combat action rules', () => {
  it('aplica dano primeiro nos PV temporários', () => {
    expect(applyDamage({ current: 20, max: 20, temp: 5 }, 8)).toEqual({
      hp: { current: 17, max: 20, temp: 0 },
      applied: 3,
      absorbedByTempHp: 5,
    });
  });

  it('não deixa PV negativo', () => {
    expect(applyDamage({ current: 4, max: 20, temp: 0 }, 99)).toEqual({
      hp: { current: 0, max: 20, temp: 0 },
      applied: 4,
      absorbedByTempHp: 0,
    });
  });

  it('cura sem ultrapassar o máximo e sem tocar PV temporário', () => {
    expect(applyHeal({ current: 18, max: 20, temp: 3 }, 10)).toEqual({
      current: 20,
      max: 20,
      temp: 3,
    });
  });

  it('PV temporário não acumula', () => {
    expect(applyTempHp({ current: 10, max: 10, temp: 4 }, 2).temp).toBe(4);
    expect(applyTempHp({ current: 10, max: 10, temp: 4 }, 7).temp).toBe(7);
  });

  it('condições não duplicam e podem ser removidas', () => {
    const added = addCondition(['Caído'], 'caído');
    expect(added).toEqual(['Caído']);
    expect(addCondition(added, 'Amedrontado')).toEqual([
      'Caído',
      'Amedrontado',
    ]);
    expect(removeCondition(['Caído', 'Amedrontado'], 'CAÍDO')).toEqual([
      'Amedrontado',
    ]);
  });

  it('rejeita condição vazia', () => {
    expect(() => addCondition([], '  ')).toThrow(RangeError);
  });
});
