// Fala em idioma desconhecido (IM-11). O servidor troca cada palavra por uma
// "palavra estrangeira" antes de enviar, então o texto original nunca chega a
// quem não fala o idioma. Determinístico: a mesma palavra no mesmo idioma vira
// sempre a mesma coisa, o que dá ao texto embaralhado cara de língua de verdade.

const SOUNDS: string[][] = [
  'ael ith lor wen sil mir ia el ra thi na ys', // fluido
  'dur khaz gor bor rak dum thra ul grim ok az brn', // gutural
  'zha xir qua vex ssa thu ix zor ka vi sse yth', // sibilante
  'ba do ki mu ne ro ta pi su lo ga he', // silábico
].map((sounds) => sounds.split(' '));

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Gerador simples e reproduzível a partir de uma semente. */
function generator(seed: number) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function scrambleWord(word: string, languageId: string, sounds: string[]) {
  const next = generator(hash(`${languageId}:${word.toLowerCase()}`));
  let out = '';
  while (out.length < word.length) {
    out += sounds[Math.floor(next() * sounds.length)];
  }
  out = out.slice(0, Math.max(1, word.length));
  return word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()
    ? out[0].toUpperCase() + out.slice(1)
    : out;
}

export function scrambleText(text: string, languageId: string): string {
  const sounds = SOUNDS[hash(languageId) % SOUNDS.length];
  // Só letras são trocadas; pontuação, números e espaços ficam no lugar.
  return text.replace(/\p{L}+/gu, (word) =>
    scrambleWord(word, languageId, sounds),
  );
}
