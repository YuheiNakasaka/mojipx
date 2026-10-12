import { describe, expect, it } from 'vitest';
import { advanceStep, positionAt, recentMarks, type StepMark } from './transport.ts';

const mark = (step: number, at: number, loop = 0, track = 'a'): StepMark<string> => ({ track, step, loop, at, sec: 0.25 });

describe('positionAt', () => {
  const marks = [mark(0, 1), mark(1, 1.25), mark(2, 1.5, 0, 'b')];
  it('最初の印より前は null', () => expect(positionAt(marks, 0.99)).toBeNull());
  it('印の時刻ちょうどは、その刻みの頭', () =>
    expect(positionAt(marks, 1.25)).toEqual({ track: 'a', step: 1, loop: 0, phase: 0, stepSec: 0.25 }));
  it('刻みの中の進み具合を返す', () => expect(positionAt(marks, 1.3125)?.phase).toBeCloseTo(0.25));
  it('先に予約した印ではなく、今の時刻までの最後の印を使う', () => expect(positionAt(marks, 1.4)?.step).toBe(1));
  it('曲が替わった後は、新しい曲の位置', () => expect(positionAt(marks, 1.6)?.track).toBe('b'));
  it('最後の印より後は、進み具合を1で止める', () => expect(positionAt(marks, 9)?.phase).toBe(1));
});

describe('recentMarks', () => {
  it('古い印を捨て、最後の印は残す', () => {
    const marks = [mark(0, 0), mark(1, 0.25), mark(2, 5)];
    expect(recentMarks(marks, 10, 1).map((m) => m.step)).toEqual([2]);
    expect(recentMarks(marks, 1, 1).map((m) => m.step)).toEqual([0, 1, 2]);
  });
});

describe('advanceStep', () => {
  it('ループの途中は次の刻みへ進む', () => expect(advanceStep(3, 0, 8)).toEqual({ step: 4, loop: 0 }));
  it('ループの終わりで頭に戻り、ループの数を増やす', () => expect(advanceStep(7, 2, 8)).toEqual({ step: 0, loop: 3 }));
  it('前奏のある曲は、ループの始まりに戻る', () => expect(advanceStep(15, 0, 16, 8)).toEqual({ step: 8, loop: 1 }));
  it('ループの始まりが曲より長くても、曲の中に収める', () => expect(advanceStep(7, 0, 8, 99)).toEqual({ step: 7, loop: 1 }));
});
