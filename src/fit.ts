// 舞台の拡大の倍率（docs/design.md#stage）。DOM に触れない。
// 点の大きさをそろえるため、2倍以上は整数に、1倍以上2倍未満は 0.5 刻みに切り下げる。
// 1倍に収まらないときは、縮めてよい場合だけ、そのままの値まで縮める。

export type FitOptions = {
  /** 1倍より小さく縮めてよいか。スマホの縦向きの幅に舞台を収めるときに使う。 */
  readonly shrink?: boolean;
  /** 縮めるときの下限。 */
  readonly min?: number;
  /** 倍率の上限。小さな挿絵のように、等倍より大きくしない舞台に使う。 */
  readonly max?: number;
  /** 親の大きさから引く余白（点）。縦横それぞれに引く。 */
  readonly gutter?: number;
  /**
   * 親の高さの代わりに使う高さ（点）。縦にスクロールする画面では、親の高さが舞台の高さで決まり、
   * 親に合わせると縮み続けるため、画面の高さから決めた値を渡す。
   */
  readonly height?: number;
};

export const SHRINK_MIN = 0.5;

/** 幅 availW・高さ availH の中に、幅 w・高さ h の舞台を収める倍率。 */
export function fitScale(availW: number, availH: number, w: number, h: number, options: FitOptions = {}): number {
  const gutter = options.gutter ?? 0;
  const s = Math.min(options.max ?? Number.POSITIVE_INFINITY, (availW - gutter) / w, ((options.height ?? availH) - gutter) / h);
  if (s >= 2) return Math.floor(s);
  if (s >= 1) return Math.floor(s * 2) / 2;
  if (!options.shrink) return 1;
  return Math.max(options.min ?? SHRINK_MIN, Math.floor(s * 100) / 100);
}

/** 画面を覆う舞台の大きさ（点）と倍率。fillSize が返す。 */
export type FillSize = { readonly width: number; readonly height: number; readonly scale: number };

/**
 * 幅 availW・高さ availH を隙間なく覆う舞台の大きさと、整数の倍率。短い辺がおよそ short 点になる倍率を選ぶ。
 * 舞台は親より最大で「倍率 - 1」画素だけはみ出すので、親で切る。背景いっぱいに動く絵を描く画面に使う。
 */
export function fillSize(availW: number, availH: number, short: number): FillSize {
  const scale = Math.max(1, Math.round(Math.min(availW, availH) / short));
  return { width: Math.max(1, Math.ceil(availW / scale)), height: Math.max(1, Math.ceil(availH / scale)), scale };
}
