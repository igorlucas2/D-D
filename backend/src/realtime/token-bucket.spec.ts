import { takeToken, type BucketState } from './token-bucket';

describe('takeToken', () => {
  it('permite a rajada inicial e depois bloqueia', () => {
    let state: BucketState | undefined;
    for (let index = 0; index < 3; index += 1) {
      const result = takeToken(state, 3, 1_000, 1_000);
      expect(result.allowed).toBe(true);
      state = result.state;
    }

    const denied = takeToken(state, 3, 1_000, 1_000);
    expect(denied.allowed).toBe(false);
    expect(denied.state.tokens).toBe(0);
  });

  it('recarrega um token por intervalo', () => {
    let state: BucketState | undefined;
    for (let index = 0; index < 2; index += 1) {
      state = takeToken(state, 2, 1_000, 1_000).state;
    }

    expect(takeToken(state, 2, 1_000, 1_500).allowed).toBe(false);

    const refilled = takeToken(state, 2, 1_000, 2_000);
    expect(refilled.allowed).toBe(true);
    expect(refilled.state.tokens).toBe(0);
  });

  it('não passa da capacidade mesmo após muito tempo parado', () => {
    let state: BucketState | undefined = takeToken(
      undefined,
      2,
      1_000,
      1_000,
    ).state;
    state = takeToken(state, 2, 1_000, 1_000).state;

    const result = takeToken(state, 2, 1_000, 10_000);
    expect(result.allowed).toBe(true);
    expect(result.state.tokens).toBe(1);
  });

  it('ignora relógio andando para trás', () => {
    const state = takeToken(undefined, 2, 1_000, 5_000).state;
    const result = takeToken(state, 2, 1_000, 4_000);

    expect(result.allowed).toBe(true);
    expect(result.state.tokens).toBe(0);
  });
});
