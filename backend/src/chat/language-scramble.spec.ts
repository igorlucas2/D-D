import { scrambleText } from './language-scramble';

describe('scrambleText', () => {
  const text = 'O tesouro está escondido sob a ponte, perto da Torre Velha!';

  it('não deixa nenhuma palavra original passar', () => {
    const scrambled = scrambleText(text, 'idioma-elfico');
    const original = new Set(
      text.toLowerCase().match(/\p{L}{3,}/gu) as string[],
    );
    const leaked = (scrambled.toLowerCase().match(/\p{L}+/gu) ?? []).filter(
      (word) => original.has(word),
    );
    expect(leaked).toEqual([]);
  });

  it('é determinístico e mantém pontuação e maiúsculas', () => {
    const a = scrambleText(text, 'idioma-elfico');
    expect(scrambleText(text, 'idioma-elfico')).toBe(a);
    expect(a.endsWith('!')).toBe(true);
    expect(a.split(',').length).toBe(2);
    expect(a[0]).toBe(a[0].toUpperCase());
  });

  it('a mesma palavra vira a mesma palavra estrangeira', () => {
    const [first, second] = scrambleText('ponte ponte', 'x').split(' ');
    expect(first).toBe(second);
  });

  it('idiomas diferentes soam diferentes', () => {
    expect(scrambleText(text, 'idioma-a')).not.toBe(
      scrambleText(text, 'idioma-b'),
    );
  });

  it('preserva o tamanho de cada palavra', () => {
    const words = text.match(/\p{L}+/gu) as string[];
    const scrambled = scrambleText(text, 'anao').match(/\p{L}+/gu) as string[];
    expect(scrambled.map((w) => w.length)).toEqual(words.map((w) => w.length));
  });
});
