import { MAX_AUTO_TICKS_PER_RUN, planAutoTick } from './clock';

const MINUTE = 60_000;

describe('planAutoTick', () => {
  const base = new Date('2026-10-26T12:00:00.000Z');

  it('não avança antes do intervalo vencer', () => {
    expect(
      planAutoTick(
        {
          realMinutesPerTick: 10,
          gameMinutesPerTick: 60,
          lastTickAt: base,
          updatedAt: base,
        },
        base.getTime() + 9 * MINUTE,
      ),
    ).toBeNull();
  });

  it('avança exatamente um intervalo no vencimento', () => {
    const plan = planAutoTick(
      {
        realMinutesPerTick: 10,
        gameMinutesPerTick: 60,
        lastTickAt: base,
        updatedAt: base,
      },
      base.getTime() + 10 * MINUTE,
    );

    expect(plan).toEqual({
      intervals: 1,
      nextTickAt: new Date(base.getTime() + 10 * MINUTE),
      minutesToAdd: 60,
    });
  });

  it('recupera vários intervalos e mantém o alinhamento', () => {
    const plan = planAutoTick(
      {
        realMinutesPerTick: 10,
        gameMinutesPerTick: 30,
        lastTickAt: base,
        updatedAt: base,
      },
      base.getTime() + 35 * MINUTE,
    );

    expect(plan?.intervals).toBe(3);
    expect(plan?.minutesToAdd).toBe(90);
    expect(plan?.nextTickAt).toEqual(new Date(base.getTime() + 30 * MINUTE));
  });

  it('limita a recuperação ao teto por execução', () => {
    const plan = planAutoTick(
      {
        realMinutesPerTick: 1,
        gameMinutesPerTick: 60,
        lastTickAt: base,
        updatedAt: base,
      },
      base.getTime() + 1000 * MINUTE,
    );

    expect(plan?.intervals).toBe(MAX_AUTO_TICKS_PER_RUN);
    expect(plan?.minutesToAdd).toBe(MAX_AUTO_TICKS_PER_RUN * 60);
  });

  it('usa updatedAt quando o calendário ainda não tem lastTickAt', () => {
    const plan = planAutoTick(
      {
        realMinutesPerTick: 5,
        gameMinutesPerTick: 15,
        lastTickAt: null,
        updatedAt: base,
      },
      base.getTime() + 5 * MINUTE,
    );

    expect(plan?.intervals).toBe(1);
    expect(plan?.minutesToAdd).toBe(15);
  });

  it('ignora relógio que andou para trás', () => {
    expect(
      planAutoTick(
        {
          realMinutesPerTick: 5,
          gameMinutesPerTick: 15,
          lastTickAt: base,
          updatedAt: base,
        },
        base.getTime() - MINUTE,
      ),
    ).toBeNull();
  });
});
