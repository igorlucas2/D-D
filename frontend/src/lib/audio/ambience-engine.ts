"use client";

import type { AmbiencePreset } from "@/lib/audio/ambience-presets";
import type { Weather } from "@/lib/weather";

// Paisagens sonoras sintetizadas com Web Audio (IM-02). Nenhum arquivo é
// baixado: todos os sons nascem de ruído e osciladores gerados aqui, então são
// próprios do projeto e não exigem registro de licença.

type Stop = () => void;
type NoiseColor = "white" | "pink" | "brown";

const CROSSFADE_SECONDS = 2;
const NOISE_SECONDS = 4;

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

class Voice {
  readonly output: GainNode;
  private readonly cleanups: Stop[] = [];
  private stopped = false;

  constructor(readonly ctx: AudioContext, destination: AudioNode) {
    this.output = ctx.createGain();
    this.output.gain.value = 0;
    this.output.connect(destination);
  }

  onStop(cleanup: Stop) {
    this.cleanups.push(cleanup);
  }

  get active() {
    return !this.stopped;
  }

  fadeTo(value: number, seconds: number) {
    const now = this.ctx.currentTime;
    const gain = this.output.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(value, now + seconds);
  }

  stop(fadeSeconds: number) {
    if (this.stopped) return;
    this.stopped = true;
    this.fadeTo(0, fadeSeconds);
    window.setTimeout(() => {
      for (const cleanup of this.cleanups) cleanup();
      this.output.disconnect();
    }, fadeSeconds * 1000 + 100);
  }

  /** Repete `fire` em intervalos aleatórios enquanto a voz estiver ativa. */
  every(minSeconds: number, maxSeconds: number, fire: (at: number) => void) {
    let timer = 0;
    const tick = () => {
      if (!this.active) return;
      fire(this.ctx.currentTime + 0.05);
      timer = window.setTimeout(tick, random(minSeconds, maxSeconds) * 1000);
    };
    timer = window.setTimeout(tick, random(0, maxSeconds) * 1000);
    this.onStop(() => window.clearTimeout(timer));
  }
}

class AmbienceEngine {
  private ctx: AudioContext | null = null;
  // Saída comum (medida pelo analisador) com dois canais de volume
  // independentes: paisagem sonora e efeitos (dados, pings, críticos).
  private master: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private voice: Voice | null = null;
  private currentKey: string | null = null;
  private volume = 0.6;
  private sfxVolume = 0.7;
  private pauseSeq = 0;
  private readonly noiseCache = new Map<NoiseColor, AudioBuffer>();
  private readonly listeners = new Set<() => void>();

  /** Precisa ser chamado dentro de um gesto do usuário (política de autoplay). */
  async start() {
    this.pauseSeq += 1;
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.ambienceBus = this.ctx.createGain();
      this.ambienceBus.gain.value = this.volume;
      this.ambienceBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      this.sfxBus.connect(this.master);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(this.analyser);
      this.ctx.addEventListener("statechange", () => this.emit());
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.emit();
  }

  /** Para o som e suspende o contexto, salvo se `start()` vier antes do fim do fade. */
  async pause() {
    const seq = ++this.pauseSeq;
    this.stop(0.4);
    if (this.ctx?.state !== "running") return;
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    if (seq === this.pauseSeq) await this.ctx.suspend();
  }

  /** Para a paisagem atual, mantendo o contexto pronto para a próxima. */
  stop(fadeSeconds = CROSSFADE_SECONDS) {
    this.stopCurrent(fadeSeconds);
    this.emit();
  }

  get running() {
    return this.ctx?.state === "running";
  }

  get activeKey() {
    return this.currentKey;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.ctx && this.ambienceBus) this.ambienceBus.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
  }

  setSfxVolume(volume: number) {
    this.sfxVolume = volume;
    if (this.ctx && this.sfxBus) this.sfxBus.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
  }

  /** Troca a paisagem com crossfade; a mesma combinação não reinicia. */
  play(preset: AmbiencePreset | "combat", night: boolean, weather: Weather = "clear", indoor = false) {
    const key = `${preset}${night ? "+night" : ""}${weather !== "clear" ? `+${weather}${indoor ? "-indoor" : ""}` : ""}`;
    if (!this.ctx || !this.ambienceBus || !this.running || key === this.currentKey) return;
    this.stopCurrent(CROSSFADE_SECONDS);
    this.currentKey = key;
    const audibleWeather = weather === "rain" || weather === "storm" || weather === "wind" || weather === "snow";
    if (preset === "silence" && !night && !audibleWeather) {
      this.emit();
      return;
    }
    const voice = new Voice(this.ctx, this.ambienceBus);
    buildPreset(this, voice, preset);
    if (night || preset === "night-wild") crickets(voice, preset === "night-wild" ? 1 : 0.6);
    if (audibleWeather) weatherLayer(this, voice, weather, indoor);
    voice.fadeTo(1, CROSSFADE_SECONDS);
    this.voice = voice;
    this.emit();
  }

  /**
   * Efeito curto fora da paisagem: dados batendo na bandeja e o toque de
   * crítico/falha. Só soa se o jogador ativou o som.
   */
  sfx(kind: "dice" | "critical" | "fumble" | "ping" | "page" | "bell", seconds = 1.6) {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || !this.running) return;
    const start = ctx.currentTime + 0.02;
    if (kind === "dice") {
      // Batidas cada vez mais espaçadas e fracas, como dados perdendo energia.
      let t = 0;
      let level = 0.35;
      while (t < seconds && level > 0.02) {
        const source = ctx.createBufferSource();
        source.buffer = this.noise("white");
        const band = ctx.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.value = random(1800, 3800);
        band.Q.value = 3;
        const env = ctx.createGain();
        env.gain.setValueAtTime(level, start + t);
        env.gain.exponentialRampToValueAtTime(0.0001, start + t + 0.035);
        source.connect(band).connect(env).connect(bus);
        source.start(start + t, random(0, NOISE_SECONDS - 0.1), 0.05);
        t += random(0.05, 0.12) * (1 + t * 1.5);
        level *= random(0.72, 0.9);
      }
      return;
    }
    if (kind === "bell") {
      // Sino distante anunciando um acontecimento do mundo.
      for (const [frequency, level] of [[392, 0.14], [784, 0.06], [1176, 0.03]] as const) {
        const oscillator = ctx.createOscillator();
        oscillator.frequency.value = frequency;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, start);
        env.gain.exponentialRampToValueAtTime(level, start + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, start + 2.2);
        oscillator.connect(env).connect(bus);
        oscillator.start(start);
        oscillator.stop(start + 2.3);
      }
      return;
    }
    if (kind === "page") {
      // Folha virando: ruído que varre do grave ao agudo e some.
      const source = ctx.createBufferSource();
      source.buffer = this.noise("pink");
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 1.2;
      band.frequency.setValueAtTime(600, start);
      band.frequency.exponentialRampToValueAtTime(4200, start + 0.32);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(0.5, start + 0.06);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      source.connect(band).connect(env).connect(bus);
      source.start(start, random(0, NOISE_SECONDS - 0.5), 0.45);
      return;
    }
    if (kind === "ping") {
      // Toque curto e agudo, como uma gota de metal: chama atenção sem assustar.
      const oscillator = ctx.createOscillator();
      oscillator.frequency.setValueAtTime(1480, start);
      oscillator.frequency.exponentialRampToValueAtTime(990, start + 0.25);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      oscillator.connect(env).connect(bus);
      oscillator.start(start);
      oscillator.stop(start + 0.45);
      return;
    }
    const notes = kind === "critical" ? [660, 880, 1320] : [330, 247];
    notes.forEach((frequency, i) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = kind === "critical" ? "triangle" : "sawtooth";
      oscillator.frequency.value = frequency;
      const env = ctx.createGain();
      const at = start + seconds + i * 0.12;
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(kind === "critical" ? 0.12 : 0.06, at + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      oscillator.connect(env).connect(bus);
      oscillator.start(at);
      oscillator.stop(at + 0.55);
    });
  }

  /** Nível RMS da saída (0–1); usado em testes e indicadores. */
  measureLevel(): number {
    if (!this.analyser) return 0;
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (const sample of data) sum += sample * sample;
    return Math.sqrt(sum / data.length);
  }

  noise(color: NoiseColor): AudioBuffer {
    const cached = this.noiseCache.get(color);
    if (cached) return cached;
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (color === "white") {
        data[i] = white * 0.5;
      } else if (color === "pink") {
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
      } else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
    }
    this.noiseCache.set(color, buffer);
    return buffer;
  }

  private stopCurrent(fadeSeconds: number) {
    this.voice?.stop(fadeSeconds);
    this.voice = null;
    this.currentKey = null;
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

// --- Blocos de síntese ---------------------------------------------------

function noiseSource(engine: AmbienceEngine, voice: Voice, color: NoiseColor) {
  const source = voice.ctx.createBufferSource();
  source.buffer = engine.noise(color);
  source.loop = true;
  // Começar em ponto aleatório evita que camadas iguais soem em fase.
  source.start(0, random(0, NOISE_SECONDS));
  voice.onStop(() => source.stop());
  return source;
}

function lfo(voice: Voice, frequency: number, depth: number, target: AudioParam) {
  const oscillator = voice.ctx.createOscillator();
  oscillator.frequency.value = frequency;
  const gain = voice.ctx.createGain();
  gain.gain.value = depth;
  oscillator.connect(gain).connect(target);
  oscillator.start();
  voice.onStop(() => oscillator.stop());
}

function filter(voice: Voice, type: BiquadFilterType, frequency: number, q = 0.7) {
  const node = voice.ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

function gainNode(voice: Voice, value: number) {
  const node = voice.ctx.createGain();
  node.gain.value = value;
  return node;
}

/** Eco simples para espaços de pedra. */
function echo(voice: Voice, delaySeconds: number, feedback: number) {
  const input = gainNode(voice, 1);
  const delay = voice.ctx.createDelay(2);
  delay.delayTime.value = delaySeconds;
  const loop = gainNode(voice, feedback);
  const damp = filter(voice, "lowpass", 1800);
  input.connect(voice.output);
  input.connect(delay).connect(damp).connect(loop).connect(delay);
  damp.connect(voice.output);
  return input;
}

function wind(engine: AmbienceEngine, voice: Voice, level: number, center = 500) {
  const lowpass = filter(voice, "lowpass", center, 0.9);
  const amp = gainNode(voice, level);
  noiseSource(engine, voice, "brown").connect(lowpass).connect(amp).connect(voice.output);
  lfo(voice, 0.07, center * 0.5, lowpass.frequency);
  lfo(voice, 0.11, level * 0.45, amp.gain);
}

/** Uivo de vento por frestas: ruído em banda estreita com altura oscilante. */
function howl(engine: AmbienceEngine, voice: Voice, level: number, out: AudioNode) {
  const band = filter(voice, "bandpass", 320, 6);
  const amp = gainNode(voice, level);
  noiseSource(engine, voice, "pink").connect(band).connect(amp).connect(out);
  lfo(voice, 0.05, 90, band.frequency);
  lfo(voice, 0.09, level * 0.6, amp.gain);
}

/** Burburinho de vozes: bandas de fala com amplitude silábica independente. */
function murmur(engine: AmbienceEngine, voice: Voice, level: number) {
  const bands: [number, number][] = [[320, 0.55], [520, 0.8], [880, 1.3], [1400, 0.4]];
  for (const [frequency, rate] of bands) {
    const band = filter(voice, "bandpass", frequency, 1.6);
    const amp = gainNode(voice, level * 0.5);
    noiseSource(engine, voice, "pink").connect(band).connect(amp).connect(voice.output);
    lfo(voice, rate * random(2.2, 3.4), level * 0.45, amp.gain);
  }
}

function crackle(engine: AmbienceEngine, voice: Voice, level: number) {
  // Base grave da lareira.
  const rumble = filter(voice, "lowpass", 180);
  noiseSource(engine, voice, "brown").connect(rumble).connect(gainNode(voice, level * 0.5)).connect(voice.output);
  const highpass = filter(voice, "highpass", 1800);
  highpass.connect(voice.output);
  voice.every(0.04, 0.45, (at) => {
    const source = voice.ctx.createBufferSource();
    source.buffer = engine.noise("white");
    const env = voice.ctx.createGain();
    const length = random(0.004, 0.03);
    env.gain.setValueAtTime(level * random(0.4, 1.6), at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(env).connect(highpass);
    source.start(at, random(0, NOISE_SECONDS - 0.1), length + 0.01);
  });
}

function tone(
  voice: Voice,
  out: AudioNode,
  at: number,
  { from, to, duration, level, type = "sine" }: { from: number; to: number; duration: number; level: number; type?: OscillatorType },
) {
  const oscillator = voice.ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, at);
  oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
  const env = voice.ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level, at + Math.min(0.01, duration / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(env).connect(out);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

function birds(voice: Voice, level: number, minGap: number, maxGap: number) {
  voice.every(minGap, maxGap, (at) => {
    const base = random(2600, 4200);
    const notes = Math.floor(random(2, 6));
    for (let i = 0; i < notes; i++) {
      const start = at + i * random(0.09, 0.16);
      tone(voice, voice.output, start, { from: base * random(0.9, 1.15), to: base * random(1.1, 1.4), duration: random(0.05, 0.11), level: level * random(0.5, 1) });
    }
  });
}

function crickets(voice: Voice, level: number) {
  for (const pitch of [4300, 4750]) {
    voice.every(0.5, 1.3, (at) => {
      for (let i = 0; i < 3; i++) {
        tone(voice, voice.output, at + i * 0.045, { from: pitch, to: pitch * 0.99, duration: 0.03, level: level * 0.05 });
      }
    });
  }
}

function drips(voice: Voice, out: AudioNode, level: number, minGap: number, maxGap: number) {
  voice.every(minGap, maxGap, (at) => {
    const from = random(1100, 1800);
    tone(voice, out, at, { from, to: from * 0.45, duration: 0.07, level });
  });
}

function glassClinks(voice: Voice, level: number) {
  voice.every(2.5, 7, (at) => {
    const pitch = random(2400, 3600);
    tone(voice, voice.output, at, { from: pitch, to: pitch * 0.995, duration: 0.35, level });
    if (Math.random() < 0.5) tone(voice, voice.output, at + 0.08, { from: pitch * 1.07, to: pitch * 1.06, duration: 0.25, level: level * 0.6 });
  });
}

function drone(engine: AmbienceEngine, voice: Voice, cutoff: number, level: number) {
  const lowpass = filter(voice, "lowpass", cutoff);
  const amp = gainNode(voice, level);
  noiseSource(engine, voice, "brown").connect(lowpass).connect(amp).connect(voice.output);
  lfo(voice, 0.03, level * 0.3, amp.gain);
}

function waves(engine: AmbienceEngine, voice: Voice) {
  const lowpass = filter(voice, "lowpass", 700, 0.8);
  const amp = gainNode(voice, 0.18);
  noiseSource(engine, voice, "brown").connect(lowpass).connect(amp).connect(voice.output);
  lfo(voice, 0.12, 450, lowpass.frequency);
  lfo(voice, 0.12, 0.13, amp.gain);
  const spray = filter(voice, "highpass", 3000);
  const sprayAmp = gainNode(voice, 0.03);
  noiseSource(engine, voice, "pink").connect(spray).connect(sprayAmp).connect(voice.output);
  lfo(voice, 0.12, 0.025, sprayAmp.gain);
}

function rumbles(engine: AmbienceEngine, voice: Voice, level: number) {
  voice.every(9, 20, (at) => {
    const source = voice.ctx.createBufferSource();
    source.buffer = engine.noise("brown");
    const lowpass = filter(voice, "lowpass", 90);
    const env = voice.ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level, at + 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
    source.connect(lowpass).connect(env).connect(voice.output);
    source.start(at, random(0, 1), 2.5);
  });
}

/** Tambores de guerra: bumbo grave em compasso irregular sobre um zumbido tenso. */
function warDrums(engine: AmbienceEngine, voice: Voice) {
  drone(engine, voice, 120, 0.25);
  const pattern = [0, 0.42, 0.84, 1.05, 1.68, 2.1, 2.52, 2.73];
  voice.every(3.36, 3.36, (at) => {
    pattern.forEach((offset, i) => {
      const accent = i === 0 || i === 4;
      tone(voice, voice.output, at + offset, { from: accent ? 95 : 120, to: 45, duration: 0.45, level: accent ? 0.5 : 0.28 });
    });
  });
}

/**
 * Clima (IM-08). Ao ar livre, chuva e vento cheios; em interiores, só a chuva
 * abafada "lá fora" (passa-baixa) e trovões distantes.
 */
function weatherLayer(engine: AmbienceEngine, voice: Voice, weather: Weather, indoor: boolean) {
  if (weather === "rain" || weather === "storm") {
    const heavy = weather === "storm";
    const highpass = filter(voice, "highpass", 900);
    const muffle = filter(voice, "lowpass", indoor ? 450 : 9000);
    const amp = gainNode(voice, indoor ? (heavy ? 0.12 : 0.08) : heavy ? 0.22 : 0.14);
    noiseSource(engine, voice, "pink").connect(highpass).connect(muffle).connect(amp).connect(voice.output);
    lfo(voice, 0.07, indoor ? 0.02 : 0.04, amp.gain);
    if (heavy) {
      rumbles(engine, voice, indoor ? 0.2 : 0.4);
      if (!indoor) wind(engine, voice, 0.15, 600);
    }
  } else if (weather === "wind" && !indoor) {
    wind(engine, voice, 0.38, 750);
  } else if (weather === "wind" || weather === "snow") {
    wind(engine, voice, indoor ? 0.05 : 0.12, indoor ? 300 : 450);
  }
}

function buildPreset(engine: AmbienceEngine, voice: Voice, preset: AmbiencePreset | "combat") {
  switch (preset) {
    case "combat":
      warDrums(engine, voice);
      break;
    case "tavern":
      murmur(engine, voice, 0.5);
      crackle(engine, voice, 0.2);
      glassClinks(voice, 0.05);
      break;
    case "city":
      murmur(engine, voice, 0.25);
      wind(engine, voice, 0.15, 600);
      break;
    case "forest":
      wind(engine, voice, 0.18, 900);
      birds(voice, 0.06, 1.5, 6);
      break;
    case "road":
      wind(engine, voice, 0.3, 500);
      birds(voice, 0.04, 6, 15);
      break;
    case "cave": {
      drone(engine, voice, 160, 0.35);
      drips(voice, echo(voice, 0.28, 0.45), 0.09, 1.2, 4.5);
      break;
    }
    case "dungeon": {
      drone(engine, voice, 110, 0.4);
      drips(voice, echo(voice, 0.35, 0.5), 0.06, 3, 9);
      rumbles(engine, voice, 0.25);
      break;
    }
    case "castle":
      howl(engine, voice, 0.2, echo(voice, 0.3, 0.35));
      drone(engine, voice, 140, 0.3);
      break;
    case "sea":
      waves(engine, voice);
      wind(engine, voice, 0.12, 700);
      break;
    case "night-wild":
      wind(engine, voice, 0.2, 400);
      break;
    case "silence":
      break;
  }
}

export const ambienceEngine = new AmbienceEngine();

// Permite medir o nível de saída em testes de navegador.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __eldoriaAmbience: AmbienceEngine }).__eldoriaAmbience = ambienceEngine;
}
