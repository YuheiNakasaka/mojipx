import { describe, expect, it } from 'vitest';
import { mixColor, tintedPalette } from './color.ts';

describe('mixColor', () => {
  it('割合0は元の色、1は寄せる先の色', () => {
    expect(mixColor('#102030', '#ffffff', 0)).toBe('rgb(16,32,48)');
    expect(mixColor('#102030', '#ffffff', 1)).toBe('rgb(255,255,255)');
  });
  it('途中の割合は、色の成分ごとに混ぜて四捨五入する', () => expect(mixColor('#000000', '#ff0080', 0.5)).toBe('rgb(128,0,64)'));
});

describe('tintedPalette', () => {
  it('配色のすべての文字の色を、同じ割合で寄せる', () =>
    expect(tintedPalette({ a: '#000000', b: '#ffffff' }, '#ff0000', 0.5)).toEqual({ a: 'rgb(128,0,0)', b: 'rgb(255,128,128)' }));
});
