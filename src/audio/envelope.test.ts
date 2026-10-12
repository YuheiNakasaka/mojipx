import { describe, expect, it } from 'vitest';
import { decayCurve, swellAttackOf, swingShift, vibratoDepthHz } from './envelope.ts';

describe('decayCurve', () => {
  it('大きさ vol から始まり、時定数で減っていく', () => {
    const c = decayCurve(0.5, 0.32, 0.16, 3);
    expect(c[0]).toBeCloseTo(0.5);
    expect(c[1]).toBeCloseTo(0.5 * Math.exp(-1));
    expect(c[2]).toBeCloseTo(0.5 * Math.exp(-2));
  });
  it('値はいつも減っていく', () => {
    const c = Array.from(decayCurve(1, 2, 0.16));
    expect(c.every((v, i) => i === 0 || v < (c[i - 1] as number))).toBe(true);
  });
});

describe('swellAttackOf', () => {
  it('長い音ほど長く立ち上がり、0.4 秒で止める', () => {
    expect(swellAttackOf(0.5)).toBeCloseTo(0.175);
    expect(swellAttackOf(4)).toBe(0.4);
  });
});

describe('vibratoDepthHz', () => {
  it('1200 セントは1オクターブで、周波数と同じ幅', () => expect(vibratoDepthHz(440, 1200)).toBeCloseTo(440));
  it('0 セントは揺らさない', () => expect(vibratoDepthHz(440, 0)).toBe(0));
});

describe('swingShift', () => {
  it('奇数の刻みだけを遅らせる', () => {
    expect(swingShift(0, 0.2)).toBe(0);
    expect(swingShift(1, 0.2)).toBe(0.2);
    expect(swingShift(7, 0.2)).toBe(0.2);
  });
});
