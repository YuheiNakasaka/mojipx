import { describe, expect, it } from 'vitest';
import { FRAME_SHAPES, frameUrl } from './frame.ts';
import { svgUrl } from './sprite.ts';

describe('FRAME_SHAPES', () => {
  it.each(Object.entries(FRAME_SHAPES))('%s は 12×12 で、役目の文字と透明だけで書く', (_, shape) => {
    expect(shape).toHaveLength(12);
    for (const row of shape) expect(row).toMatch(/^[OLFHS.]{12}$/);
  });
});

describe('frameUrl', () => {
  it('形の名前と役目の色から、枠の絵の url() を作る', () => {
    const colors = { O: '#000000', L: '#ffffff', F: '#0000ff' };
    expect(frameUrl('window', colors)).toBe(svgUrl(FRAME_SHAPES.window, {}, colors));
  });
  it('名前のない形も、絵を渡せば枠にできる', () => {
    const shape = Array.from({ length: 12 }, () => 'OFFFFFFFFFFO');
    expect(frameUrl(shape, { O: '#000000', F: '#ffffff' })).toBe(svgUrl(shape, {}, { O: '#000000', F: '#ffffff' }));
  });
  it('役目の文字で書いた窓は、色の文字で書いた窓と同じ絵になる', () => {
    // 役目の文字に分ける前の窓の形（k は輪郭、w は白い縁、F は塗り）
    const byColor = [
      '..kkkkkkkk..',
      '.kwwwwwwwwk.',
      'kwwFFFFFFwwk',
      ...Array.from({ length: 6 }, () => 'kwFFFFFFFFwk'),
      'kwwFFFFFFwwk',
      '.kwwwwwwwwk.',
      '..kkkkkkkk..',
    ];
    const palette = { k: '#1a1c2c', w: '#f4f4f4' };
    expect(frameUrl('window', { O: '#1a1c2c', L: '#f4f4f4', F: '#26337a' })).toBe(svgUrl(byColor, palette, { F: '#26337a' }));
  });
});
