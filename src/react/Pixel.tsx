// ドット絵の部品（docs/design.md#ドット絵）。絵を SVG の矩形で描く。配色は PaletteProvider から読む。
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { type Palette, type Recolor, runsOf, type Sprite, sizeOf } from '../sprite.ts';

const PaletteContext = createContext<Palette>({});

/** 中の部品が使う配色を決める。 */
export const PaletteProvider = ({ palette, children }: { palette: Palette; children: ReactNode }) => (
  <PaletteContext.Provider value={palette}>{children}</PaletteContext.Provider>
);

/** 今の配色。 */
export const usePalette = (): Palette => useContext(PaletteContext);

/** ドット絵を SVG で描く。scale は1点の大きさ。title がなければ飾りとして読み上げない。 */
export function Pixel({
  sprite,
  scale = 2,
  title,
  recolor,
  palette,
  className,
}: {
  sprite: Sprite;
  scale?: number;
  title?: string;
  recolor?: Recolor;
  /** 配色。指定しなければ PaletteProvider の配色。 */
  palette?: Palette;
  className?: string;
}) {
  const inherited = usePalette();
  const colors = palette ?? inherited;
  const runs = useMemo(() => runsOf(sprite, colors, recolor), [sprite, colors, recolor]);
  const { w, h } = sizeOf(sprite);
  return (
    <svg
      className={className ? `px-sprite ${className}` : 'px-sprite'}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {runs.map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.color} />
      ))}
    </svg>
  );
}
