import { canReach, canReachDoor } from './movement';
import type { Wall } from './vision';

// Corredor 5x3 com uma parede vertical em x = 2 cobrindo as três linhas.
const wallLine = (door?: Wall['door']): Wall[] => [
  { x1: 2, y1: 0, x2: 2, y2: 1 },
  { x1: 2, y1: 1, x2: 2, y2: 2, ...(door ? { door } : {}) },
  { x1: 2, y1: 2, x2: 2, y2: 3 },
];

describe('canReach', () => {
  const token = { x: 0, y: 1, size: 1 };

  it('sem paredes chega a qualquer lugar', () => {
    expect(canReach(token, 4, 2, 5, 3, [])).toBe(true);
  });

  it('parede fechada impede atravessar', () => {
    expect(canReach(token, 4, 1, 5, 3, wallLine())).toBe(false);
    expect(canReach(token, 1, 2, 5, 3, wallLine())).toBe(true);
  });

  it('porta fechada bloqueia e aberta deixa passar', () => {
    expect(canReach(token, 4, 1, 5, 3, wallLine('closed'))).toBe(false);
    expect(canReach(token, 4, 1, 5, 3, wallLine('open'))).toBe(true);
  });

  it('contorna a parede quando há caminho', () => {
    const walls: Wall[] = [{ x1: 2, y1: 1, x2: 2, y2: 2 }];
    expect(canReach(token, 3, 1, 5, 3, walls)).toBe(true);
  });

  it('token grande não passa por fresta de uma célula', () => {
    const big = { x: 0, y: 0, size: 2 };
    const walls: Wall[] = [{ x1: 2, y1: 0, x2: 2, y2: 1 }];
    // Mapa 5x2: a única linha livre tem só uma célula de altura.
    expect(canReach(big, 3, 0, 5, 2, walls)).toBe(false);
    expect(canReach(big, 3, 0, 5, 3, walls)).toBe(true);
  });
});

describe('canReachDoor', () => {
  const door: Wall = { x1: 2, y1: 1, x2: 2, y2: 2, door: 'closed' };

  it('alcança a porta encostado ou a uma célula', () => {
    expect(canReachDoor({ x: 1, y: 1, size: 1 }, door)).toBe(true);
    expect(canReachDoor({ x: 2, y: 2, size: 1 }, door)).toBe(true);
    expect(canReachDoor({ x: 0, y: 0, size: 1 }, door)).toBe(true);
  });

  it('longe da porta não alcança', () => {
    expect(canReachDoor({ x: 4, y: 1, size: 1 }, door)).toBe(false);
    expect(canReachDoor({ x: 1, y: 4, size: 1 }, door)).toBe(false);
  });
});
