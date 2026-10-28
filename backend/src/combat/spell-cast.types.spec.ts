import {
  abilityModifier,
  resolveSpellMechanics,
  spellSaveDc,
  spellToHud,
  spellcastingAbility,
  spellcastingModifier,
} from './spell-cast.types';

describe('spell mechanics', () => {
  it('resolve a cura de Curar Ferimentos pelo fallback', () => {
    expect(resolveSpellMechanics({ name: 'Curar Ferimentos' })).toMatchObject({
      kind: 'HEAL',
      formula: '1d8',
      addSpellcastingModifier: true,
      targets: 'SINGLE',
    });
  });

  it('resolve Bola de Fogo com save de Destreza e metade no sucesso', () => {
    expect(resolveSpellMechanics({ name: 'Bola de Fogo' })).toMatchObject({
      kind: 'DAMAGE',
      formula: '8d6',
      damageType: 'fire',
      save: { ability: 'DEX', halfOnSuccess: true },
      targets: 'MULTIPLE',
    });
  });

  it('dá prioridade ao mechanics estruturado', () => {
    expect(
      resolveSpellMechanics({
        name: 'Curar Ferimentos',
        mechanics: JSON.stringify({
          kind: 'HEAL',
          formula: '2d8',
          addSpellcastingModifier: true,
          targets: 'SINGLE',
        }),
      }),
    ).toMatchObject({ formula: '2d8' });
  });

  it('resolve Raio de Fogo como ataque mágico', () => {
    expect(resolveSpellMechanics({ name: 'Raio de Fogo' })).toMatchObject({
      kind: 'DAMAGE',
      formula: '1d10',
      damageType: 'fire',
      attack: 'SPELL',
      targets: 'SINGLE',
    });
  });

  it('resolve Marca do Caçador como concentração com bônus', () => {
    expect(resolveSpellMechanics({ name: 'Marca do Caçador' })).toMatchObject({
      kind: 'MARK',
      targets: 'SINGLE',
      concentration: {
        condition: 'Marcado',
        bonusFormula: '1d6',
        durationMinutes: 60,
      },
    });
  });

  it('resolve Míssil Mágico como dano automático', () => {
    expect(resolveSpellMechanics({ name: 'Míssil Mágico' })).toMatchObject({
      kind: 'DAMAGE',
      formula: '3d4+3',
      damageType: 'force',
      attack: null,
      save: null,
      targets: 'SINGLE',
    });
  });

  it('resolve Abençoar como buff de concentração', () => {
    expect(resolveSpellMechanics({ name: 'Abençoar' })).toMatchObject({
      kind: 'BUFF',
      targets: 'MULTIPLE',
      concentration: {
        condition: 'Abençoado',
        bonusFormula: '1d4',
        durationMinutes: 1,
      },
    });
  });

  it('resolve Escudo da Fé como ação bônus e CA', () => {
    expect(resolveSpellMechanics({ name: 'Escudo da Fé' })).toMatchObject({
      kind: 'BUFF',
      action: 'BONUS',
      targets: 'SINGLE',
      concentration: {
        condition: 'Protegido',
        bonusFormula: '+2',
        durationMinutes: 10,
      },
    });
  });

  it('resolve Escudo Arcano como reação e ward', () => {
    expect(resolveSpellMechanics({ name: 'Escudo Arcano' })).toMatchObject({
      kind: 'BUFF',
      action: 'REACTION',
      targets: 'SINGLE',
      ward: { condition: 'Escudado', acBonus: 5, rounds: 1 },
    });
  });

  it('resolve Heroísmo com PV temporários', () => {
    expect(resolveSpellMechanics({ name: 'Heroísmo' })).toMatchObject({
      kind: 'BUFF',
      tempHp: 'SPELLCASTING_MOD',
      targets: 'SINGLE',
      concentration: {
        condition: 'Heroico',
        durationMinutes: 1,
      },
    });
  });

  it('ignora magia sem mecânica conhecida', () => {
    expect(resolveSpellMechanics({ name: 'Luz' })).toBeNull();
  });

  it('calcula modificador, ability e DC', () => {
    expect(abilityModifier(15)).toBe(2);
    expect(spellcastingAbility('Mago')).toBe('INT');
    expect(
      spellcastingModifier({
        class: 'Mago',
        intelligence: 15,
        wisdom: 10,
        charisma: 8,
      }),
    ).toBe(2);
    expect(spellSaveDc(2, 2)).toBe(12);
  });

  it('monta o HUD com metadados da magia', () => {
    expect(
      spellToHud('cs1', {
        id: 's1',
        name: 'Bola de Fogo',
        level: 3,
        school: 'Evocação',
        concentration: false,
        description: null,
      }),
    ).toMatchObject({
      characterSpellId: 'cs1',
      effectKind: 'DAMAGE',
      saveAbility: 'DEX',
      targetMode: 'MULTIPLE',
    });
  });
});
