// 幕（docs/design.md#会話と幕）。opening は閉じた幕が開き、closing は幕が閉じる。children は幕の上に出す札。
// 動きの長さは styles.css の .px-curtain と合わせる。動きを減らす設定の利用者には、すぐ終える。
import { type ReactNode, useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../motion.ts';

/** 幕の動きの長さ（ms）。styles.css のアニメーションの終わりと同じ。 */
export const CURTAIN_MS = { opening: 3300, closing: 1500 } as const;

export function Curtain({
  mode,
  children,
  onStart,
  onEnd,
  cardClassName,
}: {
  mode: 'opening' | 'closing';
  children?: ReactNode;
  /** 幕が動き始めたときに呼ぶ（音を鳴らすなど）。 */
  onStart?: () => void;
  /** 幕が動き終えたときに呼ぶ。 */
  onEnd?: () => void;
  /** 札の箱に足す class。 */
  cardClassName?: string;
}) {
  const start = useRef(onStart);
  start.current = onStart;
  useEffect(() => {
    start.current?.();
    const ms = prefersReducedMotion() ? 0 : CURTAIN_MS[mode];
    const id = setTimeout(() => onEnd?.(), ms);
    return () => clearTimeout(id);
  }, [mode, onEnd]);
  return (
    <div className={`px-curtain px-curtain-${mode}`} aria-hidden="true">
      <div className="px-curtain-valance" />
      {children && <div className={cardClassName ? `px-curtain-card ${cardClassName}` : 'px-curtain-card'}>{children}</div>}
    </div>
  );
}
