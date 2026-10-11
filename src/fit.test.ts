import { describe, expect, it } from 'vitest';
import { fitScale, SHRINK_MIN } from './fit.ts';

// 舞台は横400・縦224 とする
const scaleIn = (w: number, h: number, options = {}) => fitScale(w, h, 400, 224, options);

describe('fitScale', () => {
  it('2倍以上に収まるなら、整数に切り下げる', () => {
    expect(scaleIn(1000, 1000)).toBe(2);
    expect(scaleIn(1300, 1000)).toBe(3);
  });
  it('1倍以上2倍未満なら、0.5 刻みに切り下げる', () => {
    expect(scaleIn(799, 1000)).toBe(1.5);
    expect(scaleIn(599, 1000)).toBe(1);
  });
  it('幅と高さの、収まる倍率の小さいほうで決める', () => expect(scaleIn(2000, 448)).toBe(2));
  it('余白を、幅と高さのそれぞれから引く', () => expect(scaleIn(820, 1000, { gutter: 20 })).toBe(2));
  it('1倍に収まらないとき、縮めない決まりなら1倍', () => expect(scaleIn(300, 1000)).toBe(1));
  it('縮めてよい決まりなら、0.01 刻みに切り下げた倍率まで縮める', () => expect(scaleIn(366, 1000, { shrink: true })).toBe(0.91));
  it('縮める倍率には下限がある', () => {
    expect(scaleIn(100, 1000, { shrink: true })).toBe(SHRINK_MIN);
    expect(scaleIn(100, 1000, { shrink: true, min: 0.8 })).toBe(0.8);
  });
  it('上限より大きくしない', () => {
    expect(scaleIn(2000, 2000, { max: 1 })).toBe(1);
    expect(scaleIn(300, 2000, { max: 1, shrink: true })).toBe(0.75);
  });
  it('高さを渡すと、親の高さの代わりに使う', () => {
    expect(scaleIn(1000, 100, { height: 1000 })).toBe(2);
    expect(scaleIn(1000, 1000, { height: 244, gutter: 20 })).toBe(1);
  });
});
