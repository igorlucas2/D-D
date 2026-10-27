import {
  parseJson,
  parseJsonArray,
  parseJsonObject,
  parseNumberArray,
  parseStringArray,
} from './json';

describe('leitura tolerante de JSON', () => {
  it('devolve null para vazio ou inválido', () => {
    expect(parseJson(null)).toBeNull();
    expect(parseJson('')).toBeNull();
    expect(parseJson('{quebrado')).toBeNull();
    expect(parseJsonObject('[1,2]')).toBeNull();
  });

  it('lê arrays tipados ignorando itens errados', () => {
    expect(parseStringArray('["a", 1, "b", null]')).toEqual(['a', 'b']);
    expect(parseNumberArray('[1, "2", 3.5, null]')).toEqual([1, 3.5]);
    expect(parseStringArray('"texto"')).toEqual([]);
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });

  it('lê objetos e preserva valores', () => {
    expect(parseJsonObject('{"dano":"1d8"}')).toEqual({ dano: '1d8' });
    expect(parseJson('true')).toBe(true);
  });
});
