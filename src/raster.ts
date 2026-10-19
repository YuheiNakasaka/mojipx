// 絵をキャンバスの画像にする（docs/design.md#pixel-art）。DOM に触れる。
import { type Palette, type Recolor, runsOf, type Sprite, sizeOf } from './sprite.ts';

// キャンバスの画像は、絵・配色・差し替えの色の組ごとに1度だけ作る。
const cache = new WeakMap<Sprite, WeakMap<Palette, Map<string, HTMLCanvasElement>>>();

/** 絵を等倍のキャンバスにする。描くときは drawImage で拡大する（imageSmoothingEnabled は false）。 */
export function canvasOf(sprite: Sprite, palette: Palette, recolor?: Recolor): HTMLCanvasElement {
  const key = recolor ? JSON.stringify(recolor) : '';
  let byPalette = cache.get(sprite);
  if (!byPalette) {
    byPalette = new WeakMap();
    cache.set(sprite, byPalette);
  }
  let byColor = byPalette.get(palette);
  if (!byColor) {
    byColor = new Map();
    byPalette.set(palette, byColor);
  }
  const hit = byColor.get(key);
  if (hit) return hit;
  const { w, h } = sizeOf(sprite);
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const ctx = c.getContext('2d');
  if (ctx)
    for (const r of runsOf(sprite, palette, recolor)) {
      ctx.fillStyle = r.color;
      ctx.fillRect(r.x, r.y, r.w, 1);
    }
  byColor.set(key, c);
  return c;
}
