// React のフック（docs/design.md#features）。画面の型、入り切りの設定、BGM、時計、読み上げ、こまの番号。
// 時計と読み上げは、動きを減らす設定の利用者には、はじめから最後の状態を返す。
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Bgm } from '../audio/bgm.ts';
import { prefersReducedMotion } from '../motion.ts';
import type { Setting } from '../setting.ts';
import { currentViewport, type Viewport, watchViewport } from '../viewport.ts';

/** 今の画面の型。画面の大きさが変わると描き直す。境目は installViewport で決める。 */
export function useViewport(): Viewport {
  return useSyncExternalStore(watchViewport, currentViewport, currentViewport);
}

/** 入り切りの設定の今の値。 */
export function useSetting(setting: Setting): boolean {
  return useSyncExternalStore(setting.subscribe, setting.get, setting.get);
}

/** この画面で流す曲。null なら止める。画面が閉じたら、その曲を止める。 */
export function useBgm<Track extends string>(bgm: Bgm<Track>, track: Track | null): void {
  useEffect(() => {
    bgm.want(track);
    return () => bgm.release(track);
  }, [bgm, track]);
}

/**
 * 再生の時計。開いてからの経過の時刻（ms）を、speed の速さで、durationMs まで進める。
 * skip で最後まで飛ばす。動きを減らす設定の利用者には、はじめから最後の時刻を返す。
 */
export function usePlayClock(durationMs: number, speed = 1): { readonly ms: number; readonly done: boolean; readonly skip: () => void } {
  const [ms, setMs] = useState(() => (prefersReducedMotion() ? Number.POSITIVE_INFINITY : 0));
  const rate = useRef(speed);
  rate.current = speed;
  const done = ms >= durationMs;
  // 時計は経過だけを持つ。画面が描き直されても、再生をやり直さない。
  useEffect(() => {
    if (done) return;
    let last = performance.now();
    let id = requestAnimationFrame(function frame(now) {
      const dt = Math.max(0, now - last) * rate.current;
      last = now;
      setMs((x) => x + dt);
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [done]);
  return { ms, done, skip: () => setMs(Number.POSITIVE_INFINITY) };
}

/**
 * total 件の項目を、intervalMs ごとに1件ずつ出す。最初の1件は firstDelayMs だけ遅らせる。
 * 1件出すたびに onReveal を呼ぶ。出した件数と、全部出す関数を返す。
 */
export function useReveal(
  total: number,
  { intervalMs, firstDelayMs = 0, onReveal }: { intervalMs: number; firstDelayMs?: number; onReveal?: () => void },
): readonly [number, () => void] {
  const [count, setCount] = useState(() => (prefersReducedMotion() ? total : 0));
  const notify = useRef(onReveal);
  notify.current = onReveal;
  useEffect(() => {
    if (count >= total) return;
    const id = setTimeout(
      () => {
        setCount((n) => n + 1);
        notify.current?.();
      },
      intervalMs + (count === 0 ? firstDelayMs : 0),
    );
    return () => clearTimeout(id);
  }, [count, total, intervalMs, firstDelayMs]);
  return [count, () => setCount(total)];
}

/**
 * 0 から target まで、intervalMs ごとに step ずつ数え上げる。running が false の間は数えない。
 * 動きを減らす設定の利用者には、はじめから target を返す。
 */
export function useCountUp(
  target: number,
  { step, intervalMs, running = true }: { step: number; intervalMs: number; running?: boolean },
): number {
  const [n, setN] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (!running || n >= target) return;
    const id = setTimeout(() => setN((x) => Math.min(target, x + step)), intervalMs);
    return () => clearTimeout(id);
  }, [running, n, target, step, intervalMs]);
  return n;
}

/** intervalMs ごとに1つ増える、こまの番号。DOM のドット絵を歩かせるのに使う。動きを減らす設定の利用者には0のまま。 */
export function useBeat(intervalMs: number): number {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => setBeat((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return beat;
}
