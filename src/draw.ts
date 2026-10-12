// キャンバスに描く道具（docs/design.md#持つもの）。座標は舞台の点で、描く位置は整数に丸め、点の縁をそろえる。
// 絵の画像は raster.ts の canvasOf が作る。
import { canvasOf } from './raster.ts';
import { type Palette, type Recolor, type Sprite, sizeOf } from './sprite.ts';

export type Ctx = CanvasRenderingContext2D;
export type Point = { readonly x: number; readonly y: number };

/** 矩形を塗る。 */
export function fillRect(ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** 絵の左上を (x, y) に合わせて置く。 */
export function drawSprite(ctx: Ctx, sprite: Sprite, palette: Palette, x: number, y: number, recolor?: Recolor): void {
  ctx.drawImage(canvasOf(sprite, palette, recolor), Math.round(x), Math.round(y));
}

/** 絵の下の中央を (x, y) に合わせて置く。床に立つ人や機械に使う。 */
export function drawSpriteFoot(ctx: Ctx, sprite: Sprite, palette: Palette, x: number, y: number, recolor?: Recolor): void {
  const { w, h } = sizeOf(sprite);
  drawSprite(ctx, sprite, palette, x - w / 2, y - h, recolor);
}

/**
 * 下から伸びる途中の絵。下の中央を (x, base) に合わせ、高さの割合 grow（0〜1）だけ下から描く。
 * 描いた高さ（点）を返す。生えてくる木や、建ち上がる家のような動きに使う。
 */
export function drawSpriteRising(
  ctx: Ctx,
  sprite: Sprite,
  palette: Palette,
  x: number,
  base: number,
  grow: number,
  recolor?: Recolor,
): number {
  const { w, h } = sizeOf(sprite);
  if (grow >= 1) {
    drawSpriteFoot(ctx, sprite, palette, x, base, recolor);
    return h;
  }
  const shown = Math.max(1, Math.round(h * grow));
  ctx.drawImage(canvasOf(sprite, palette, recolor), 0, h - shown, w, shown, Math.round(x - w / 2), Math.round(base - shown), w, shown);
  return shown;
}

/** 縦か横の線分を、太さ w の矩形で塗る。両端を pad だけ伸ばし、角の継ぎ目を埋める。 */
export function strip(ctx: Ctx, a: Point, b: Point, w: number, pad: number, color: string): void {
  const x0 = Math.min(a.x, b.x) - pad;
  const x1 = Math.max(a.x, b.x) + pad;
  const y0 = Math.min(a.y, b.y) - pad;
  const y1 = Math.max(a.y, b.y) + pad;
  if (a.y === b.y) fillRect(ctx, color, x0, a.y - w / 2, x1 - x0, w);
  else fillRect(ctx, color, a.x - w / 2, y0, w, y1 - y0);
}

/** 2つの整数から決まる、0以上2^32未満の乱数。床の模様や火花の位置のように、毎こま同じに見せたいばらつきに使う。 */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 歩く向き。 */
export type Facing = 'left' | 'right' | 'up' | 'down';

/** 縦と横の線分だけからなる折れ線の長さ。 */
export const pathLength = (path: readonly Point[]): number =>
  path.slice(1).reduce((s, p, i) => {
    const q = path[i] as Point;
    return s + Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
  }, 0);

/** 縦と横の線分だけからなる折れ線の上の、始めから割合 f（0〜1）の位置と、そこで進む向き。線の上を流れるものや歩く人に使う。 */
export function pointOnPath(path: readonly Point[], f: number): Point & { readonly facing: Facing } {
  let rest = Math.min(Math.max(f, 0), 1) * pathLength(path);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as Point;
    const b = path[i] as Point;
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (rest <= len || i === path.length - 1) return pointOnSegment(a, b, rest, len);
    rest -= len;
  }
  const last = path.at(-1) ?? { x: 0, y: 0 };
  return { x: last.x, y: last.y, facing: 'right' };
}

// 長さ len の線分 a→b の、a から rest だけ進んだ位置（b を越えない）と、進む向き。
function pointOnSegment(a: Point, b: Point, rest: number, len: number): Point & { readonly facing: Facing } {
  const k = len === 0 ? 0 : Math.min(rest / len, 1);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, facing: facingOf(a, b) };
}

function facingOf(a: Point, b: Point): Facing {
  if (b.x > a.x) return 'right';
  if (b.x < a.x) return 'left';
  return b.y < a.y ? 'up' : 'down';
}
