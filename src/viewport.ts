// 画面の型（docs/design.md#screen-size-and-devices）。画面の大きさと主な入力から、並べ方の型を決める。
// classify は DOM に触れない。installViewport と watchViewport は、根の要素の印と、大きさの変化を受け持つ。

export type Layout = 'wide' | 'stack';
export type Orientation = 'landscape' | 'portrait';
export type Pointer = 'fine' | 'coarse';
export type Viewport = {
  readonly width: number;
  readonly height: number;
  readonly layout: Layout;
  readonly orientation: Orientation;
  readonly pointer: Pointer;
};

/** 広い画面（wide）の下限。横と縦の両方がこの値以上なら wide。 */
export type Breakpoints = { readonly wideMinWidth: number; readonly wideMinHeight: number };
export const DEFAULT_BREAKPOINTS: Breakpoints = { wideMinWidth: 1000, wideMinHeight: 600 };

/** 画面の大きさ（CSS の点）と、主な入力が指かどうかから、画面の型を決める。 */
export function classify(width: number, height: number, coarse: boolean, bp: Breakpoints = DEFAULT_BREAKPOINTS): Viewport {
  return {
    width,
    height,
    layout: width >= bp.wideMinWidth && height >= bp.wideMinHeight ? 'wide' : 'stack',
    orientation: width >= height ? 'landscape' : 'portrait',
    pointer: coarse ? 'coarse' : 'fine',
  };
}

const same = (a: Viewport, b: Viewport): boolean =>
  a.width === b.width && a.height === b.height && a.layout === b.layout && a.orientation === b.orientation && a.pointer === b.pointer;

let breakpoints = DEFAULT_BREAKPOINTS;
let current: Viewport | null = null;
const listeners = new Set<(v: Viewport) => void>();

const coarseQuery = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null;

function measure(): Viewport {
  if (typeof window === 'undefined') return classify(breakpoints.wideMinWidth, breakpoints.wideMinHeight, false, breakpoints);
  return classify(window.innerWidth, window.innerHeight, coarseQuery()?.matches ?? false, breakpoints);
}

function refresh(): void {
  const next = measure();
  if (current && same(current, next)) return;
  current = next;
  for (const l of listeners) l(next);
}

let watching = false;
function watch(): void {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  window.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', refresh);
  coarseQuery()?.addEventListener('change', refresh);
}

/** 今の画面の型。 */
export function currentViewport(): Viewport {
  if (!current) current = measure();
  return current;
}

/** 画面の型が変わるたびに呼ぶ。止める関数を返す。 */
export function watchViewport(listener: (v: Viewport) => void): () => void {
  watch();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 根の要素に data-layout・data-orientation・data-pointer を付け、画面の型が変わるたびに付け直す。
 * 起動のときに1度だけ呼ぶ。CSS とスクリプトで、画面の型の境目をそろえるため。
 */
export function installViewport(options: Partial<Breakpoints> = {}, root: HTMLElement = document.documentElement): () => void {
  breakpoints = { ...DEFAULT_BREAKPOINTS, ...options };
  current = measure();
  const mark = (v: Viewport) => {
    root.dataset.layout = v.layout;
    root.dataset.orientation = v.orientation;
    root.dataset.pointer = v.pointer;
  };
  mark(current);
  return watchViewport(mark);
}
