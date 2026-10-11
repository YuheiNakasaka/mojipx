// 動きを減らす設定（docs/design.md#要件）。設定のある利用者には、アニメーションを止めて最後の状態を出す。

/** 利用者が動きを減らす設定にしているか。 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
