// BGM の譜面の読み方（docs/design.md#音）。曲の中身はゲームが持つ。
// 譜面は小節ごとの文字列で書き、compile で1拍未満の刻み（step）ごとの音の並びにする。DOM と Web Audio には触れない。
//
// 旋律・和音・低音の記法: 空白で区切った1語が1刻み。'C5' や 'F#4'、'Bb3' は音の高さ、'E4+G4' は和音、
// '-' は前の音を伸ばし、'.' は休み。
// 太鼓の記法: 1文字が1刻み。k=大太鼓、s=小太鼓、h=ハイハット、H=ハイハットを2つ（刻みの頭と半ば）、
// x=大太鼓とハイハット、z=小太鼓とハイハット、'.'=休み。

export type Voice = 'pulse' | 'square' | 'triangle';
/** 'calm' は落ち着いているときだけ、'intense' は山場（setIntensity(1)）のときだけ、'both' はいつも鳴らす。 */
export type Layer = 'calm' | 'intense' | 'both';
export type Channel = {
  readonly voice: Voice;
  readonly volume: number; // 0〜1。曲の中の釣り合い
  readonly layer: Layer;
  readonly bars: readonly string[];
};
export type DrumChannel = { readonly volume: number; readonly layer: Layer; readonly bars: readonly string[] };
export type Score = {
  readonly bpm: number;
  readonly intenseBpm?: number; // 山場の速さ。なければ bpm のまま
  readonly beatsPerBar: 3 | 4;
  readonly stepsPerBeat: 2; // 8分音符を1刻みとする
  readonly channels: readonly Channel[];
  readonly drums: readonly DrumChannel[];
};

export type Drum = 'kick' | 'snare' | 'hat';
export type NoteEvent = {
  readonly midi: readonly number[];
  readonly steps: number;
  readonly voice: Voice;
  readonly volume: number;
  readonly layer: Layer;
};
export type DrumEvent = { readonly drum: Drum; readonly offset: 0 | 0.5; readonly volume: number; readonly layer: Layer }; // offset は刻みの中の位置（割合）
export type Compiled = {
  readonly bpm: number;
  readonly intenseBpm: number;
  readonly stepsPerBeat: number;
  readonly length: number; // ループ全体の刻みの数
  readonly notes: readonly (readonly NoteEvent[])[]; // 刻みごとに、その刻みで鳴り始める音
  readonly drums: readonly (readonly DrumEvent[])[];
};

// ---- 音の高さ ----

const PITCH: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'A4' → 69 のような MIDI の番号。読めなければ null。 */
export function midiOf(name: string): number | null {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) return null;
  const [, letter, accidental, octave] = m;
  const base = PITCH[letter as string];
  if (base === undefined) return null;
  return base + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) + (Number(octave) + 1) * 12;
}

/** MIDI の番号の周波数（Hz）。A4 = 440Hz。 */
export const frequencyOf = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

const DRUM_HITS: Readonly<Record<string, readonly (readonly [Drum, 0 | 0.5])[]>> = {
  k: [['kick', 0]],
  s: [['snare', 0]],
  h: [['hat', 0]],
  H: [
    ['hat', 0],
    ['hat', 0.5],
  ],
  x: [
    ['kick', 0],
    ['hat', 0],
  ],
  z: [
    ['snare', 0],
    ['hat', 0],
  ],
  '.': [],
};

/** 小節の語。旋律は空白で区切り、太鼓は1文字ずつ。 */
export const tokensOf = (bar: string, drums: boolean): readonly string[] => (drums ? Array.from(bar) : bar.trim().split(/\s+/));

/** 譜面を刻みごとの音の並びにする。譜面の誤り（長さの合わない小節、読めない語）は例外にする。 */
export function compile(score: Score): Compiled {
  const perBar = score.beatsPerBar * score.stepsPerBeat;
  const barCount = score.channels[0]?.bars.length ?? 0;
  const length = barCount * perBar;
  const notes: NoteEvent[][] = Array.from({ length }, () => []);
  const drums: DrumEvent[][] = Array.from({ length }, () => []);

  for (const ch of score.channels) {
    if (ch.bars.length !== barCount) throw new Error(`小節の数が合わない: ${ch.bars.length} ≠ ${barCount}`);
    const tokens = ch.bars.flatMap((bar) => {
      const t = tokensOf(bar, false);
      if (t.length !== perBar) throw new Error(`小節の長さが合わない: "${bar}"`);
      return t;
    });
    tokens.forEach((token, step) => {
      if (token === '-' || token === '.') return;
      const midi = token.split('+').map((n) => {
        const v = midiOf(n);
        if (v === null) throw new Error(`読めない音: ${token}`);
        return v;
      });
      let steps = 1;
      while (tokens[step + steps] === '-') steps++;
      notes[step]?.push({ midi, steps, voice: ch.voice, volume: ch.volume, layer: ch.layer });
    });
  }
  for (const ch of score.drums) {
    if (ch.bars.length !== barCount) throw new Error(`太鼓の小節の数が合わない: ${ch.bars.length} ≠ ${barCount}`);
    ch.bars.forEach((bar, b) => {
      const t = tokensOf(bar, true);
      if (t.length !== perBar) throw new Error(`太鼓の小節の長さが合わない: "${bar}"`);
      t.forEach((c, i) => {
        const hits = DRUM_HITS[c];
        if (!hits) throw new Error(`読めない太鼓: ${c}`);
        for (const [drum, offset] of hits) drums[b * perBar + i]?.push({ drum, offset, volume: ch.volume, layer: ch.layer });
      });
    });
  }
  return { bpm: score.bpm, intenseBpm: score.intenseBpm ?? score.bpm, stepsPerBeat: score.stepsPerBeat, length, notes, drums };
}

/** 1刻みの秒数。山場では intenseBpm の速さで刻む。 */
export const stepSecOf = (c: Compiled, intense: boolean): number => 60 / (intense ? c.intenseBpm : c.bpm) / c.stepsPerBeat;

/** 刻みの音を、山場かどうかで鳴らすか。 */
export const audible = (layer: Layer, intense: boolean): boolean => layer === 'both' || (layer === 'intense') === intense;

/** 同じ形の太鼓を小節の数だけ並べる。最後の小節だけ形を変えられる。 */
export const repeatBars = (bars: number, beat: string, last = beat): readonly string[] => [
  ...Array.from({ length: bars - 1 }, () => beat),
  last,
];
