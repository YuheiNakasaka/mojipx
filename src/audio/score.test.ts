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
    expect(c.notes[0]).toEqual([{ midi: [60], steps: 3, voice: 'pulse', volume: 1, layer: 'both' }]);
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
