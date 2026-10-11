import { describe, expect, it } from 'vitest';
import { hash2, pathLength, pointOnPath } from './draw.ts';

describe('hash2', () => {
  it('同じ数の組には同じ値を返し、0以上2^32未満', () => {
    expect(hash2(3, 7)).toBe(hash2(3, 7));
    for (const [a, b] of [
      [0, 0],
      [1, 2],
      [-5, 9],
      [400, 224],
    ] as const) {
      const h = hash2(a, b);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
  it('数の順が違えば、たいてい違う値になる', () => expect(hash2(1, 2)).not.toBe(hash2(2, 1)));
});

describe('pathLength / pointOnPath', () => {
  // 右へ10、下へ10の折れ線
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];
  it('長さは、線分の縦と横の長さの合計', () => expect(pathLength(path)).toBe(20));
  it('割合0は始め、1は終わり', () => {
    expect(pointOnPath(path, 0)).toEqual({ x: 0, y: 0, facing: 'right' });
    expect(pointOnPath(path, 1)).toEqual({ x: 10, y: 10, facing: 'down' });
  });
  it('途中の割合は、長さに沿った位置と、その線分の向き', () => {
    expect(pointOnPath(path, 0.25)).toEqual({ x: 5, y: 0, facing: 'right' });
    expect(pointOnPath(path, 0.75)).toEqual({ x: 10, y: 5, facing: 'down' });
  });
  it('0〜1の外の割合は、端に寄せる', () => {
    expect(pointOnPath(path, -1)).toEqual(pointOnPath(path, 0));
    expect(pointOnPath(path, 2)).toEqual(pointOnPath(path, 1));
  });
  it('左と上へ進む線分の向き', () => {
    expect(
      pointOnPath(
        [
          { x: 10, y: 0 },
          { x: 0, y: 0 },
        ],
        0.5,
      ).facing,
    ).toBe('left');
    expect(
      pointOnPath(
        [
          { x: 0, y: 10 },
          { x: 0, y: 0 },
        ],
        0.5,
      ).facing,
    ).toBe('up');
  });
  it('1点だけの線は、その点で右を向く', () => expect(pointOnPath([{ x: 3, y: 4 }], 0.5)).toEqual({ x: 3, y: 4, facing: 'right' }));
});
