import { describe, expect, it } from 'vitest';
import { flipped, runsOf, sizeOf, spriteProblems, svgOf, svgUrl } from './sprite.ts';

const PALETTE = { k: '#000000', w: '#ffffff', r: '#ff0000' };

describe('runsOf', () => {
  it('横に続く同じ文字を1つの矩形にまとめ、透明の点は描かない', () => {
    expect(runsOf(['kkw.', '.rr.'], PALETTE)).toEqual([
      { x: 0, y: 0, w: 2, color: '#000000' },
      { x: 2, y: 0, w: 1, color: '#ffffff' },
      { x: 1, y: 1, w: 2, color: '#ff0000' },
    ]);
  });
  it('配色にない文字は描かない', () =>
    expect(runsOf(['k1k'], PALETTE)).toEqual([
      { x: 0, y: 0, w: 1, color: '#000000' },
      { x: 2, y: 0, w: 1, color: '#000000' },
    ]));
  it('差し替えの色は、配色の色より先に使い、配色にない文字も色にする', () => {
    expect(runsOf(['k1'], PALETTE, { k: '#123456', '1': '#abcdef' })).toEqual([
      { x: 0, y: 0, w: 1, color: '#123456' },
      { x: 1, y: 0, w: 1, color: '#abcdef' },
    ]);
  });
  it('色が同じでも文字が違えば、別の矩形にする', () => expect(runsOf(['kw'], PALETTE, { w: '#000000' })).toHaveLength(2));
});

describe('sizeOf / flipped', () => {
  it('幅は1行目の長さ、高さは行の数', () => expect(sizeOf(['abc', 'abc'])).toEqual({ w: 3, h: 2 }));
  it('空の絵は0×0', () => expect(sizeOf([])).toEqual({ w: 0, h: 0 }));
  it('左右の反転は、行ごとに文字を逆に並べる', () => expect(flipped(['kw.', 'r..'])).toEqual(['.wk', '..r']));
});

describe('spriteProblems', () => {
  it('行の長さがそろい、配色の文字だけなら誤りはない', () => expect(spriteProblems(['kw', '.r'], PALETTE)).toEqual([]));
  it('1行目と長さの違う行を挙げる', () => expect(spriteProblems(['kw', 'k'], PALETTE)).toEqual(['1行目の長さが 1（1行目は 2）']));
  it('配色にない文字を、行ごとに1度挙げる', () => expect(spriteProblems(['kzz'], PALETTE)).toEqual(['0行目に配色にない文字「z」']));
  it('描くときに差し替える文字は、許した文字として扱う', () => expect(spriteProblems(['k1'], PALETTE, ['1'])).toEqual([]));
});

describe('svgOf / svgUrl', () => {
  it('絵の大きさの SVG に、矩形ごとの rect を並べ、点の縁をぼかさない', () => {
    expect(svgOf(['kw'], PALETTE)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="1" viewBox="0 0 2 1" shape-rendering="crispEdges">' +
        '<rect x="0" y="0" width="1" height="1" fill="#000000"/><rect x="1" y="0" width="1" height="1" fill="#ffffff"/></svg>',
    );
  });
  it('CSS の url() は、SVG を URL の形に直して埋め込む', () => {
    const url = svgUrl(['k'], PALETTE);
    expect(url.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(url.slice('url("data:image/svg+xml,'.length, -2))).toBe(svgOf(['k'], PALETTE));
  });
});
