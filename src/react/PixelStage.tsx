// 舞台（docs/design.md#舞台）。決まった大きさの点の画面をキャンバスに等倍で描き、親の大きさに合わせて CSS で拡大する。
// 毎こまの描画は React の外で行い、描く関数は描き直しのたびに最新のものに差し替わる。上には DOM の層を重ねる。
// PixelFill は、大きさを決めずに親を覆う舞台で、点の数を親の大きさから決める。
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import type { Ctx } from '../draw.ts';
import { type FillSize, type FitOptions, fillSize, fitScale } from '../fit.ts';
import { prefersReducedMotion } from '../motion.ts';

/** 描く関数に渡す時刻。now は requestAnimationFrame の時刻、frame は絵の動きの番号、sec は経過の秒。止めた舞台では frame と sec は0。 */
export type StageClock = { readonly now: number; readonly frame: number; readonly sec: number; readonly still: boolean };
export type DrawStage = (ctx: Ctx, clock: StageClock) => void;
/** 親を覆う舞台の描く関数。size は今の舞台の大きさ（点）と倍率。 */
export type DrawFill = (ctx: Ctx, clock: StageClock, size: FillSize) => void;

/**
 * 動く舞台は毎こま、止めた舞台は描き直しのたびに1度だけ、最新の描く関数を呼ぶ。
 * maxFps を渡すと、1秒にそれより多くは描かない（画面の書き換えが速い端末で、電池を減らしすぎないため）。
 */
function useDrawLoop(
  canvas: RefObject<HTMLCanvasElement | null>,
  draw: DrawStage,
  frozen: boolean,
  frameMs: number,
  maxFps?: number,
): void {
  const latest = useRef(draw);
  latest.current = draw;
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || frozen) return;
    // こまの間隔が少し揺れても間引きすぎないよう、1ms の余裕をみる
    const minGap = maxFps ? 1000 / maxFps - 1 : 0;
    let last = Number.NEGATIVE_INFINITY;
    let id = requestAnimationFrame(function tick(now) {
      id = requestAnimationFrame(tick);
      if (now - last < minGap) return;
      last = now;
      // キャンバスの大きさを変えると描き方の設定が戻るので、毎こま決め直す
      ctx.imageSmoothingEnabled = false;
      latest.current(ctx, { now, frame: Math.floor(now / frameMs), sec: now / 1000, still: false });
    });
    return () => cancelAnimationFrame(id);
  }, [canvas, frozen, frameMs, maxFps]);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !frozen) return;
    ctx.imageSmoothingEnabled = false;
    const id = requestAnimationFrame((now) => latest.current(ctx, { now, frame: 0, sec: 0, still: true }));
    return () => cancelAnimationFrame(id);
  });
}

/** 親の大きさに収まる倍率。fixed を渡すと、その倍率に固定する。 */
export function useFitScale(width: number, height: number, fixed: number | undefined, options: FitOptions = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(fixed ?? 2);
  const { shrink, min, max, gutter, height: limit } = options;
  useEffect(() => {
    if (fixed !== undefined) return setScale(fixed);
    const el = ref.current?.parentElement;
    if (!el) return;
    const refit = () => setScale(fitScale(el.clientWidth, el.clientHeight, width, height, { shrink, min, max, gutter, height: limit }));
    refit();
    const ro = new ResizeObserver(refit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixed, width, height, shrink, min, max, gutter, limit]);
  return { ref, scale };
}

type Props = {
  /** 舞台の幅と高さ（点）。 */
  readonly width: number;
  readonly height: number;
  /** 描く関数。動く舞台では毎こま、止めた舞台では描き直しのたびに呼ぶ。 */
  readonly draw: DrawStage;
  /** 拡大の倍率。指定しなければ、親の大きさに合わせる。 */
  readonly scale?: number;
  /** 親の大きさに合わせるときの決まり。既定では余白 20 点で、1倍より小さくしない。 */
  readonly fit?: FitOptions;
  /** 止めた舞台。1度だけ描く。動きを減らす設定の利用者にも、いつも止めて描く。 */
  readonly still?: boolean;
  /** 絵の動きの1こまの長さ（ms）。既定は 250 で、1秒に4こま。 */
  readonly frameMs?: number;
  /** 1秒に描く回数の上限。既定は画面の書き換えに合わせる。 */
  readonly maxFps?: number;
  /** キャンバスの読み上げの名前。 */
  readonly label: string;
  /** 根の要素に足す class。関数なら倍率を受け取る（小さく描くときだけ名札を詰める、など）。 */
  readonly className?: string | ((scale: number) => string);
  readonly testId?: string;
  /** 重ねる層。関数なら倍率を受け取る。層の中の要素は、点の座標に倍率を掛けて置く。 */
  readonly children?: ReactNode | ((scale: number) => ReactNode);
};

const DEFAULT_FIT: FitOptions = { gutter: 20 };

export function PixelStage({
  width,
  height,
  draw,
  scale: fixed,
  fit = DEFAULT_FIT,
  still = false,
  frameMs = 250,
  maxFps,
  label,
  className,
  testId,
  children,
}: Props) {
  const { ref, scale } = useFitScale(width, height, fixed, fit);
  const canvas = useRef<HTMLCanvasElement>(null);
  useDrawLoop(canvas, draw, still || prefersReducedMotion(), frameMs, maxFps);

  const size = { width: width * scale, height: height * scale };
  const extra = typeof className === 'function' ? className(scale) : className;
  return (
    <div ref={ref} className={extra ? `px-stage ${extra}` : 'px-stage'} style={size} data-scale={scale} data-testid={testId}>
      <canvas ref={canvas} width={width} height={height} style={size} role="img" aria-label={label} />
      <div className="px-stage-layer">{typeof children === 'function' ? children(scale) : children}</div>
    </div>
  );
}

type FillProps = {
  /** 短い辺のおよその点の数。倍率は、これに近くなる整数にする。 */
  readonly short: number;
  /** 描く関数。動く舞台では毎こま、止めた舞台では描き直しのたびに呼ぶ。 */
  readonly draw: DrawFill;
  /** 止めた舞台。1度だけ描く。動きを減らす設定の利用者にも、いつも止めて描く。 */
  readonly still?: boolean;
  /** 絵の動きの1こまの長さ（ms）。既定は 250 で、1秒に4こま。 */
  readonly frameMs?: number;
  /** 1秒に描く回数の上限。既定は画面の書き換えに合わせる。 */
  readonly maxFps?: number;
  /** キャンバスの読み上げの名前。 */
  readonly label: string;
  readonly className?: string;
  readonly testId?: string;
  /** 重ねる層。関数なら舞台の大きさを受け取る。 */
  readonly children?: ReactNode | ((size: FillSize) => ReactNode);
};

const sameSize = (a: FillSize, b: FillSize): boolean => a.width === b.width && a.height === b.height && a.scale === b.scale;

/** 親を隙間なく覆う舞台。点の数は親の大きさから fillSize で決め、親が変わるたびに決め直す。背景いっぱいに動く絵に使う。 */
export function PixelFill({ short, draw, still = false, frameMs = 250, maxFps, label, className, testId, children }: FillProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<FillSize>({ width: 1, height: 1, scale: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const refit = () =>
      setSize((prev) => {
        const next = fillSize(el.clientWidth, el.clientHeight, short);
        return sameSize(prev, next) ? prev : next;
      });
    refit();
    const ro = new ResizeObserver(refit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [short]);
  const canvas = useRef<HTMLCanvasElement>(null);
  useDrawLoop(canvas, (ctx, clock) => draw(ctx, clock, size), still || prefersReducedMotion(), frameMs, maxFps);
  const css = { width: size.width * size.scale, height: size.height * size.scale };
  return (
    <div ref={ref} className={className ? `px-fill ${className}` : 'px-fill'} data-scale={size.scale} data-testid={testId}>
      <canvas ref={canvas} width={size.width} height={size.height} style={css} role="img" aria-label={label} />
      <div className="px-stage-layer">{typeof children === 'function' ? children(size) : children}</div>
    </div>
  );
}
