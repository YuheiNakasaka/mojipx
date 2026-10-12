import { describe, expect, it } from 'vitest';
import { audible, compile, frequencyOf, midiOf, repeatBars, stepSecOf } from './score.ts';

describe('midiOf / frequencyOf', () => {
  it('A4 は 69 番で 440Hz', () => {
    expect(midiOf('A4')).toBe(69);
    expect(frequencyOf(69)).toBe(440);
  });
  it('シャープとフラットを読む', () => {
    expect(midiOf('C4')).toBe(60);
    expect(midiOf('F#4')).toBe(66);
    expect(midiOf('Bb3')).toBe(58);
  });
  it('読めない名前は null', () => {
    expect(midiOf('H4')).toBeNull();
    expect(midiOf('C')).toBeNull();
    expect(midiOf('-')).toBeNull();
  });
  it('1オクターブ上は周波数が2倍', () => expect(frequencyOf(81)).toBeCloseTo(880));
});

describe('compile', () => {
  it('伸ばす記号の数だけ音を長くし、休みでは鳴らさない', () => {
    const c = compile({
      bpm: 120,
      beatsPerBar: 4,
      stepsPerBeat: 2,
      channels: [{ voice: 'pulse', volume: 1, layer: 'both', bars: ['C4 - - . E4+G4 . . .'] }],
      drums: [{ volume: 1, layer: 'both', bars: ['xH.z....'] }],
    });
    expect(c.length).toBe(8);
    expect(c.notes[0]).toEqual([
      { midi: [60], steps: 3, voice: 'pulse', volume: 1, layer: 'both', envelope: 'hold', vibrato: 0, pan: 0, echo: 0 },
    ]);
    expect(c.notes[4]?.[0]?.midi).toEqual([64, 67]);
    expect(c.notes[3]).toEqual([]);
    expect(c.drums[0]?.map((d) => d.drum)).toEqual(['kick', 'hat']);
    expect(c.drums[1]?.map((d) => [d.drum, d.offset])).toEqual([
      ['hat', 0],
      ['hat', 0.5],
    ]);
    expect(c.drums[3]?.map((d) => d.drum)).toEqual(['snare', 'hat']);
  });
  it('小節の長さが合わない譜面は例外にする', () => {
    const bad = (bar: string) => () =>
      compile({
        bpm: 120,
        beatsPerBar: 4,
        stepsPerBeat: 2,
        channels: [{ voice: 'pulse', volume: 1, layer: 'both', bars: [bar] }],
        drums: [],
      });
    expect(bad('C4 - -')).toThrow();
    expect(bad('C4 - - - - - - - -')).toThrow();
    expect(bad('C4 - - - X9 - - -')).toThrow();
  });
});

describe('compile の音色と刻み', () => {
  it('チャンネルの音の動き・揺れ・左右・やまびこを、音ごとに持たせる', () => {
    const c = compile({
      bpm: 120,
      beatsPerBar: 4,
      stepsPerBeat: 2,
      channels: [
        { voice: 'sine', volume: 1, layer: 'both', bars: ['C4 . . . . . . .'], envelope: 'pluck', vibrato: 12, pan: -0.5, echo: 0.3 },
      ],
      drums: [],
    });
    expect(c.notes[0]?.[0]).toMatchObject({ voice: 'sine', envelope: 'pluck', vibrato: 12, pan: -0.5, echo: 0.3 });
  });
  it('16分音符を1刻みにすると、1小節は16刻み', () => {
    const c = compile({
      bpm: 120,
      beatsPerBar: 4,
      stepsPerBeat: 4,
      channels: [{ voice: 'pulse', volume: 1, layer: 'both', bars: ['C4 D4 E4 F4 G4 - - - . . . . C5 - - -'] }],
      drums: [{ volume: 1, layer: 'both', bars: ['x.h.z.h.x.o.z.ht'] }],
    });
    expect(c.length).toBe(16);
    expect(stepSecOf(c, false)).toBe(0.125);
    expect(c.drums[10]?.map((d) => d.drum)).toEqual(['open']);
    expect(c.drums[15]?.map((d) => d.drum)).toEqual(['tom']);
  });
  it('跳ねる割合を 0〜0.5 に収め、やまびこを持たせる', () => {
    const base = { bpm: 120, beatsPerBar: 4 as const, stepsPerBeat: 2 as const, channels: [], drums: [] };
    expect(compile({ ...base, swing: 0.9 }).swing).toBe(0.5);
    expect(compile(base).swing).toBe(0);
    expect(compile({ ...base, echo: { steps: 3, feedback: 0.4 } }).echo).toEqual({ steps: 3, feedback: 0.4 });
    expect(compile(base).echo).toBeNull();
  });
  it('曲の大きさの倍率を 0〜2 に収め、決めなければ1にする', () => {
    const base = { bpm: 120, beatsPerBar: 4 as const, stepsPerBeat: 2 as const, channels: [], drums: [] };
    expect(compile(base).gain).toBe(1);
    expect(compile({ ...base, gain: 0.7 }).gain).toBe(0.7);
    expect(compile({ ...base, gain: 5 }).gain).toBe(2);
  });
});

describe('compile の繰り返し', () => {
  const score = (loopFrom?: number) => ({
    bpm: 120,
    beatsPerBar: 4 as const,
    stepsPerBeat: 2 as const,
    channels: [{ voice: 'pulse' as const, volume: 1, layer: 'both' as const, bars: ['C4 - - - - - - -', 'D4 - - - - - - -'] }],
    drums: [],
    loopFrom,
  });
  it('繰り返しの始まりを決めなければ、頭から繰り返す', () => expect(compile(score()).loopStart).toBe(0));
  it('繰り返しの始まりの小節を、刻みの番号にする', () => expect(compile(score(1)).loopStart).toBe(8));
  it('繰り返しの始まりが曲の外なら例外にする', () => {
    expect(() => compile(score(2))).toThrow();
    expect(() => compile(score(-1))).toThrow();
  });
});

describe('stepSecOf', () => {
  it('1刻みは8分音符の長さ。120bpm なら0.25秒', () => {
    const c = compile({ bpm: 120, intenseBpm: 150, beatsPerBar: 4, stepsPerBeat: 2, channels: [], drums: [] });
    expect(stepSecOf(c, false)).toBe(0.25);
    expect(stepSecOf(c, true)).toBe(0.2);
  });
});

describe('audible', () => {
  it('both はいつも、calm は落ち着いているときだけ、intense は山場だけ鳴る', () => {
    expect([audible('both', false), audible('both', true)]).toEqual([true, true]);
    expect([audible('calm', false), audible('calm', true)]).toEqual([true, false]);
    expect([audible('intense', false), audible('intense', true)]).toEqual([false, true]);
  });
});

describe('repeatBars', () => {
  it('同じ小節を並べ、最後の小節だけ形を変えられる', () => {
    expect(repeatBars(3, 'k...')).toEqual(['k...', 'k...', 'k...']);
    expect(repeatBars(3, 'k...', 'kkkk')).toEqual(['k...', 'k...', 'kkkk']);
  });
});
