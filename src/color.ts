// 色の混ぜ合わせ（docs/design.md#持つもの）。夜の景色を暗く、傷を負った人を赤く描くような、配色全体の色の寄せに使う。
// DOM に触れない。
import type { Palette, Recolor } from './sprite.ts';

const channel = (hex: string, i: number): number => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

/** #rrggbb の色 hex を、色 to へ割合 k（0〜1）だけ寄せた rgb() の色。 */
export function mixColor(hex: string, to: string, k: number): string {
  const v = (i: number) => Math.round(channel(hex, i) * (1 - k) + channel(to, i) * k);
  return `rgb(${v(0)},${v(1)},${v(2)})`;
}

/** 配色のすべての色を、色 to へ割合 k だけ寄せる差し替え。 */
export const tintedPalette = (palette: Palette, to: string, k: number): Recolor =>
  Object.fromEntries(Object.entries(palette).map(([ch, hex]) => [ch, mixColor(hex, to, k)]));
