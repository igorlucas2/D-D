import { resolveDeathSave } from './death-save.types';

describe('resolveDeathSave', () => {
  it('20 revive com 1 PV', () => {
    expect(resolveDeathSave(20, 0, 0)).toMatchObject({
      revived: true,
      outcome: 'REVIVED',
      successes: 0,
      failures: 0,
    });
  });

  it('1 causa duas falhas', () => {
    expect(resolveDeathSave(1, 0, 0)).toMatchObject({
      failures: 2,
      outcome: 'PENDING',
    });
  });

  it('2–9 falha e 10–19 sucede', () => {
    expect(resolveDeathSave(5, 0, 0).outcome).toBe('PENDING');
    expect(resolveDeathSave(5, 0, 0).failures).toBe(1);
    expect(resolveDeathSave(12, 0, 0)).toMatchObject({
      successes: 1,
      failures: 0,
    });
  });

  it('três sucessos estabilizam', () => {
    expect(resolveDeathSave(12, 2, 0).outcome).toBe('STABLE');
    expect(resolveDeathSave(12, 2, 0).stable).toBe(true);
  });

  it('três falhas matam', () => {
    expect(resolveDeathSave(1, 0, 2).outcome).toBe('DEAD');
    expect(resolveDeathSave(1, 0, 2).dead).toBe(true);
  });
});
