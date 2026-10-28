import {
  addTimedCondition,
  parseTimedConditions,
  removeTimedCondition,
  tickTimedConditions,
} from './condition-duration.types';

describe('condition durations', () => {
  it('lê e valida timers', () => {
    expect(
      parseTimedConditions(
        JSON.stringify([
          { name: 'Atordoado', remainingRounds: 2, source: 'Teste' },
          { name: 'Inválido', remainingRounds: 'x' },
        ]),
      ),
    ).toEqual([{ name: 'Atordoado', remainingRounds: 2, source: 'Teste' }]);
  });

  it('adiciona/substitui por nome sem acento', () => {
    const list = addTimedCondition([], 'Atordoado', 2, null);
    expect(addTimedCondition(list, 'atordoado', 3, 'x')).toEqual([
      { name: 'atordoado', remainingRounds: 3, source: 'x' },
    ]);
  });

  it('remove por nome', () => {
    expect(
      removeTimedCondition(
        [{ name: 'Atordoado', remainingRounds: 2, source: null }],
        'ATORDOADO',
      ),
    ).toEqual([]);
  });

  it('decrementa e expira', () => {
    expect(
      tickTimedConditions([
        { name: 'A', remainingRounds: 2, source: null },
        { name: 'B', remainingRounds: 1, source: null },
      ]),
    ).toEqual({
      remaining: [{ name: 'A', remainingRounds: 1, source: null }],
      expired: ['B'],
    });
  });
});
