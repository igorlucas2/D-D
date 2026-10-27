import {
  computeVisibleCells,
  sanitizeWalls,
  visibleWalls,
  type VisionSource,
  type Wall,
} from './vision';

const token = (
  x: number,
  y: number,
  extra: Partial<VisionSource> = {},
): VisionSource => ({
  x,
  y,
  size: 1,
  lightRadius: 0,
  visionRadius: 0,
  ...extra,
});

/** Parede vertical contínua na coluna x, de y0 a y1 (exclusive). */
const verticalWall = (
  x: number,
  y0: number,
  y1: number,
  door?: Wall['door'],
): Wall[] =>
  Array.from({ length: y1 - y0 }, (_, i) => ({
    x1: x,
    y1: y0 + i,
    x2: x,
    y2: y0 + i + 1,
    ...(door ? { door } : {}),
  }));

describe('visão dinâmica', () => {
  it('modo desligado vê tudo', () => {
    expect(computeVisibleCells(4, 3, 'OFF', [], [], []).size).toBe(12);
  });

  it('parede esconde o que está atrás no modo iluminado', () => {
    // Sala 10x5 dividida por parede inteira em x = 5.
    const walls = verticalWall(5, 0, 5);
    const seen = computeVisibleCells(10, 5, 'LIT', walls, [token(1, 2)], []);
    expect(seen.has('4:2')).toBe(true);
    expect(seen.has('6:2')).toBe(false);
    expect(seen.has('9:0')).toBe(false);
  });

  it('porta aberta deixa ver, porta fechada bloqueia', () => {
    const closed = [
      ...verticalWall(5, 0, 2),
      ...verticalWall(5, 2, 3, 'closed'),
      ...verticalWall(5, 3, 5),
    ];
    const open = closed.map((w) =>
      w.door ? { ...w, door: 'open' as const } : w,
    );
    expect(
      computeVisibleCells(10, 5, 'LIT', closed, [token(1, 2)], []).has('7:2'),
    ).toBe(false);
    expect(
      computeVisibleCells(10, 5, 'LIT', open, [token(1, 2)], []).has('7:2'),
    ).toBe(true);
  });

  it('não dá para espiar pela quina entre duas paredes', () => {
    // Token na célula (4,5) com parede em cima e à direita, formando uma quina
    // em (5,5). A célula na diagonal (5,4) fica escondida; a outra diagonal,
    // sem parede, continua visível.
    const walls: Wall[] = [
      { x1: 4, y1: 5, x2: 5, y2: 5 },
      { x1: 5, y1: 5, x2: 5, y2: 6 },
    ];
    const seen = computeVisibleCells(10, 10, 'LIT', walls, [token(4, 5)], []);
    expect(seen.has('5:4')).toBe(false);
    expect(seen.has('5:5')).toBe(false);
    expect(seen.has('3:4')).toBe(true);
    expect(seen.has('3:6')).toBe(true);
  });

  it('no escuro só se vê o que a luz alcança ou a visão no escuro', () => {
    const dark = computeVisibleCells(20, 5, 'DARK', [], [token(0, 2)], []);
    expect([...dark]).toEqual(['0:2']); // só a própria célula

    const torch = computeVisibleCells(
      20,
      5,
      'DARK',
      [],
      [token(0, 2, { lightRadius: 3 })],
      [token(0, 2, { lightRadius: 3 })],
    );
    expect(torch.has('3:2')).toBe(true);
    expect(torch.has('6:2')).toBe(false);

    const darkvision = computeVisibleCells(
      20,
      5,
      'DARK',
      [],
      [token(0, 2, { visionRadius: 5 })],
      [],
    );
    expect(darkvision.has('5:2')).toBe(true);
    expect(darkvision.has('9:2')).toBe(false);
  });

  it('luz distante ilumina o que o jogador consegue ver de longe', () => {
    // Fogueira em (15,2) com raio 2; jogador no escuro em (0,2), sem paredes.
    const seen = computeVisibleCells(
      20,
      5,
      'DARK',
      [],
      [token(0, 2)],
      [token(15, 2, { lightRadius: 2 })],
    );
    expect(seen.has('15:2')).toBe(true);
    expect(seen.has('8:2')).toBe(false);
  });

  it('luz atrás de parede não é vista', () => {
    const walls = verticalWall(10, 0, 5);
    const seen = computeVisibleCells(
      20,
      5,
      'DARK',
      walls,
      [token(0, 2)],
      [token(15, 2, { lightRadius: 2 })],
    );
    expect(seen.has('15:2')).toBe(false);
  });

  it('sanitiza paredes inválidas, repetidas e fora do mapa', () => {
    const walls = sanitizeWalls(
      [
        { x1: 2, y1: 0, x2: 2, y2: 1 },
        { x1: 2, y1: 1, x2: 2, y2: 0 }, // repetida ao contrário
        { x1: 0, y1: 0, x2: 2, y2: 0 }, // comprida demais
        { x1: 0, y1: 0, x2: 1, y2: 1 }, // diagonal
        { x1: 9, y1: 0, x2: 9, y2: 1 }, // fora do mapa
        { x1: 1, y1: 3, x2: 2, y2: 3, door: 'closed' },
        'lixo',
      ],
      5,
      5,
    );
    expect(walls).toEqual([
      { x1: 2, y1: 0, x2: 2, y2: 1 },
      { x1: 1, y1: 3, x2: 2, y2: 3, door: 'closed' },
    ]);
  });

  it('só envia paredes ao lado de células visíveis', () => {
    const walls: Wall[] = [
      { x1: 1, y1: 0, x2: 1, y2: 1 },
      { x1: 8, y1: 0, x2: 8, y2: 1 },
    ];
    expect(visibleWalls(walls, new Set(['0:0']))).toEqual([walls[0]]);
  });
});
