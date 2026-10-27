import { AiTurnValidationError, parseAiTurn } from './turn.schema';

const valid = {
  narration: 'A porta range e o ar frio do porão sobe pelas frestas.',
  memory: {
    summary: 'O grupo abriu a porta do porão.',
    openQuestions: ['Quem esteve aqui antes?'],
  },
  ask: '',
};

describe('parseAiTurn', () => {
  it('aceita o formato mínimo e normaliza ask vazio', () => {
    expect(parseAiTurn(JSON.stringify(valid))).toEqual({
      narration: valid.narration,
      memory: valid.memory,
      ask: null,
    });
  });

  it('aceita pergunta explícita', () => {
    const parsed = parseAiTurn(
      JSON.stringify({ ...valid, ask: 'Qual personagem abre a porta?' }),
    );
    expect(parsed.ask).toBe('Qual personagem abre a porta?');
  });

  it('rejeita JSON inválido', () => {
    expect(() => parseAiTurn('{')).toThrow(AiTurnValidationError);
  });

  it('rejeita campo extra', () => {
    expect(() =>
      parseAiTurn(JSON.stringify({ ...valid, operation: 'ATTACK' })),
    ).toThrow(AiTurnValidationError);
  });

  it('rejeita narração vazia', () => {
    expect(() =>
      parseAiTurn(JSON.stringify({ ...valid, narration: '   ' })),
    ).toThrow(AiTurnValidationError);
  });

  it('rejeita mecânica inventada', () => {
    expect(() =>
      parseAiTurn(
        JSON.stringify({
          ...valid,
          narration: 'O goblin perde 8 pontos de vida com o golpe.',
        }),
      ),
    ).toThrow(AiTurnValidationError);
  });

  it('rejeita HTML, URL e meta-discurso', () => {
    for (const narration of [
      '<b>A porta abre.</b>',
      'Veja https://exemplo.test para continuar.',
      'Como uma IA, não posso narrar isso.',
    ]) {
      expect(() =>
        parseAiTurn(JSON.stringify({ ...valid, narration })),
      ).toThrow(AiTurnValidationError);
    }
  });

  it('rejeita memória vazia', () => {
    expect(() =>
      parseAiTurn(
        JSON.stringify({
          ...valid,
          memory: { summary: ' ', openQuestions: [] },
        }),
      ),
    ).toThrow(AiTurnValidationError);
  });

  it('rejeita eco de nomes de campos do schema', () => {
    expect(() =>
      parseAiTurn(
        JSON.stringify({
          ...valid,
          narration: `${valid.narration} ask`,
        }),
      ),
    ).toThrow(AiTurnValidationError);
    expect(() =>
      parseAiTurn(
        JSON.stringify({
          ...valid,
          memory: {
            summary: 'player.character pergunta sobre a porta.',
            openQuestions: [],
          },
        }),
      ),
    ).toThrow(AiTurnValidationError);
  });
});
