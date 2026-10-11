import { describe, expect, it } from 'vitest';
import { tickAt, tickStarts } from './timeline.ts';

describe('tickStarts', () => {
  it('時点の数より1つ多い並びで、0に始まり、全体の長さで終わる', () =>
    expect(tickStarts([1, 1, 1, 1], 400)).toEqual([0, 100, 200, 300, 400]));
  it('重い時点ほど長く、全体の長さは変わらない', () => expect(tickStarts([1, 3], 400)).toEqual([0, 100, 400]));
});

describe('tickAt', () => {
  const starts = tickStarts([1, 3, 1], 500); // 0, 100, 400, 500
  it('始まりは時点0', () => expect(tickAt(starts, 0)).toBe(0));
  it('時点の始まりの時刻からは、その時点', () => {
    expect(tickAt(starts, 100)).toBe(1);
    expect(tickAt(starts, 399)).toBe(1);
    expect(tickAt(starts, 400)).toBe(2);
  });
  it('全体の長さを過ぎたら、最後の時点', () => {
    expect(tickAt(starts, 500)).toBe(2);
    expect(tickAt(starts, Number.POSITIVE_INFINITY)).toBe(2);
  });
  it('負の時刻は時点0', () => expect(tickAt(starts, -10)).toBe(0));
});
