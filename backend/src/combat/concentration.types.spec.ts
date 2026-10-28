import { parseConcentrationState } from './concentration.types';

describe('parseConcentrationState', () => {
  it('lê um estado completo', () => {
    expect(
      parseConcentrationState(
        JSON.stringify({
          spellId: 's1',
          spellName: 'Marca do Caçador',
          targetKind: 'PARTICIPANT',
          targetId: 'p1',
          targetName: 'Goblin',
          condition: 'Marcado',
          bonusFormula: '1d6',
          startedAt: '2026-10-28T00:00:00.000Z',
          expiresAt: '2026-10-28T01:00:00.000Z',
        }),
      ),
    ).toMatchObject({
      spellName: 'Marca do Caçador',
      bonusFormula: '1d6',
      targets: [{ kind: 'PARTICIPANT', id: 'p1', name: 'Goblin' }],
    });
  });

  it('lê múltiplos alvos de Bênção', () => {
    expect(
      parseConcentrationState(
        JSON.stringify({
          spellId: 's2',
          spellName: 'Abençoar',
          targets: [
            { kind: 'PARTICIPANT', id: 'p1', name: 'elfo' },
            { kind: 'PARTICIPANT', id: 'p2', name: 'aliado' },
          ],
          condition: 'Abençoado',
          bonusFormula: '1d4',
          startedAt: '2026-10-28T00:00:00.000Z',
          expiresAt: '2026-10-28T00:01:00.000Z',
        }),
      ),
    ).toMatchObject({
      spellName: 'Abençoar',
      targets: [
        { kind: 'PARTICIPANT', id: 'p1', name: 'elfo' },
        { kind: 'PARTICIPANT', id: 'p2', name: 'aliado' },
      ],
      condition: 'Abençoado',
    });
  });

  it('ignora estado inválido', () => {
    expect(parseConcentrationState('{"spellName":"x"}')).toBeNull();
    expect(parseConcentrationState(null)).toBeNull();
  });
});
