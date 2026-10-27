import { applyDamage, applyHeal, applyTempHp } from './combat-action.types';
import { parseItemEffect } from './item-use.types';

describe('parseItemEffect', () => {
  it('lê a poção de cura do catálogo', () => {
    expect(parseItemEffect('{"healing":"2d4+2"}')).toEqual({
      kind: 'HEAL',
      formula: '2d4+2',
      amount: null,
      damageType: 'untyped',
    });
  });

  it('aceita PV temporário numérico', () => {
    expect(parseItemEffect('{"temporaryHp":5}')).toMatchObject({
      kind: 'TEMP_HP',
      amount: 5,
    });
  });

  it('aceita dano com tipo', () => {
    expect(
      parseItemEffect('{"damage":"1d6","damageType":"fire"}'),
    ).toMatchObject({
      kind: 'DAMAGE',
      formula: '1d6',
      damageType: 'fire',
    });
  });

  it('ignora item sem efeito conhecido', () => {
    expect(parseItemEffect('{"srdIndex":"rope"}')).toBeNull();
    expect(parseItemEffect(null)).toBeNull();
  });

  it('não deixa a cura passar do máximo', () => {
    expect(applyHeal({ current: 8, max: 10, temp: 2 }, 5)).toEqual({
      current: 10,
      max: 10,
      temp: 2,
    });
  });

  it('dano de item respeita PV temporário', () => {
    expect(applyDamage({ current: 10, max: 10, temp: 2 }, 5)).toMatchObject({
      applied: 3,
      absorbedByTempHp: 2,
    });
  });

  it('PV temporário de item não acumula', () => {
    expect(applyTempHp({ current: 10, max: 10, temp: 2 }, 5).temp).toBe(5);
  });
});
