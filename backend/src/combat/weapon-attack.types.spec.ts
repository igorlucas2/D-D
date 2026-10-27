import {
  attackAbilityModifier,
  parseWeaponMechanics,
  weaponAbilityScore,
} from './weapon-attack.types';

describe('weapon mechanics', () => {
  it('lê o Punhal com Acuidade e dano perfurante', () => {
    const mechanics = parseWeaponMechanics(
      JSON.stringify({
        srdIndex: 'dagger',
        equipmentCategory: 'weapon',
        weaponRange: 'Melee',
        damage: '1d4',
        damageType: 'Perfuração',
        properties: ['Acuidade', 'Leve', 'Arremessável', 'Monge'],
      }),
    );
    expect(mechanics).toMatchObject({
      damageFormula: '1d4',
      damageType: 'piercing',
      finesse: true,
      ranged: false,
    });
    expect(weaponAbilityScore({ strength: 8, dexterity: 16 }, mechanics!)).toBe(
      16,
    );
  });

  it('lê dano fixo e arma à distância', () => {
    expect(
      parseWeaponMechanics(
        JSON.stringify({
          weaponRange: 'Ranged',
          damage: '1',
          damageType: 'Perfuração',
          properties: ['Munição', 'Recarga'],
        }),
      ),
    ).toMatchObject({
      damageFormula: null,
      fixedDamage: 1,
      ranged: true,
      damageType: 'piercing',
    });
  });

  it('mapeia tipos em português', () => {
    expect(
      parseWeaponMechanics(
        JSON.stringify({ damage: '1d8', damageType: 'Corte' }),
      )?.damageType,
    ).toBe('slashing');
    expect(
      parseWeaponMechanics(
        JSON.stringify({ damage: '1d6', damageType: 'Concussão' }),
      )?.damageType,
    ).toBe('bludgeoning');
  });

  it('ignora item sem dano', () => {
    expect(parseWeaponMechanics('{"healing":"2d4+2"}')).toBeNull();
    expect(parseWeaponMechanics(null)).toBeNull();
  });

  it('calcula modificador de ataque', () => {
    expect(attackAbilityModifier(16)).toBe(3);
    expect(attackAbilityModifier(8)).toBe(-1);
  });
});
