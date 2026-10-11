// ドット絵の絵（docs/design.md#ドット絵）。絵は1文字を1色に対応させた行の文字列の並びで書き、'.' は透明とする。
// DOM に触れない。キャンバスにする canvasOf は raster.ts にある。

/** 1文字を1色に対応させた行の並び。'.' は透明。 */
export type Sprite = readonly string[];
/** 文字から CSS の色への対応。 */
export type Palette = Readonly<Record<string, string>>;
/** 配色の一部の文字を、別の色にする差し替え。配色にない文字を色にするのにも使う。 */
export type Recolor = Readonly<Record<string, string>>;
/** 横に続く同じ色の点をまとめた矩形。高さはいつも1点。 */
export type Run = { readonly x: number; readonly y: number; readonly w: number; readonly color: string };

export const TRANSPARENT = '.';

const colorOf = (ch: string, palette: Palette, recolor?: Recolor): string | undefined => recolor?.[ch] ?? palette[ch];

/** 横に続く同じ色の点を1つの矩形にまとめる。色の決まらない文字は描かない。 */
export function runsOf(sprite: Sprite, palette: Palette, recolor?: Recolor): readonly Run[] {
  const runs: Run[] = [];
  sprite.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x] as string;
      const color = ch === TRANSPARENT ? undefined : colorOf(ch, palette, recolor);
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      if (color) runs.push({ x, y, w, color });
      x += w;
    }
  });
  return runs;
}

export const sizeOf = (sprite: Sprite): { readonly w: number; readonly h: number } => ({ w: sprite[0]?.length ?? 0, h: sprite.length });

/** 左右を反転した絵。 */
export const flipped = (sprite: Sprite): Sprite => sprite.map((row) => [...row].reverse().join(''));

/**
 * 絵の誤り。行の長さが1行目と違う行と、配色にも allowed にもない文字を挙げる。
 * allowed は、描くときに差し替える文字（人の髪や服の色など）。
 */
export function spriteProblems(sprite: Sprite, palette: Palette, allowed: readonly string[] = []): readonly string[] {
  const { w } = sizeOf(sprite);
  const known = new Set([TRANSPARENT, ...Object.keys(palette), ...allowed]);
  return sprite.flatMap((row, y) => {
    const width = row.length === w ? [] : [`${y}行目の長さが ${row.length}（1行目は ${w}）`];
    const unknown = [...new Set(Array.from(row))].filter((ch) => !known.has(ch)).map((ch) => `${y}行目に配色にない文字「${ch}」`);
    return [...width, ...unknown];
  });
}

/** 絵を SVG の文字列にする（窓の枠の border-image などに使う）。 */
export function svgOf(sprite: Sprite, palette: Palette, recolor?: Recolor): string {
  const { w, h } = sizeOf(sprite);
  const rects = runsOf(sprite, palette, recolor)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.color}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
}

/** 絵を CSS の url() にする。 */
export const svgUrl = (sprite: Sprite, palette: Palette, recolor?: Recolor): string =>
  `url("data:image/svg+xml,${encodeURIComponent(svgOf(sprite, palette, recolor))}")`;
