// 会話の窓（docs/design.md#会話と幕）。文字を1つずつ出し、押す・Enter・Space で、出しきる・次の行へ・終わる、と進む。
// 話す人の名前と顔は、ゲームが行ごとに渡す。行の位置は持ち越さない。開き直すと最初の行から出す。
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from '../motion.ts';

export type DialogueLine = {
  readonly text: string;
  /** 話す人の名前。語りの行では空。 */
  readonly name?: string;
  /** 顔。 */
  readonly face?: ReactNode;
  /** 語りの行。文字の色を変えるのに使う（px-dialog-text に is-narration が付く）。 */
  readonly narration?: boolean;
};

const TEXT_MS = 28; // 1文字を出す間隔

export function Dialogue({
  lines,
  onDone,
  label,
  delayMs = 0,
  onType,
  onNext,
  className,
  testId,
}: {
  lines: readonly DialogueLine[];
  onDone: () => void;
  /** 窓の読み上げの名前。行の文は後ろに足す。 */
  label: string;
  /** 文字を出し始めるまでの待ち（幕が開くのを待つなど）。 */
  delayMs?: number;
  /** 文字を出したときに呼ぶ。n は出した文字の数。 */
  onType?: (n: number) => void;
  /** 次の行へ送ったときに呼ぶ。 */
  onNext?: () => void;
  className?: string;
  testId?: string;
}) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? Number.POSITIVE_INFINITY : 0));
  const line = lines[index];
  const chars = useMemo(() => Array.from(line?.text ?? ''), [line]);
  const typing = shown < chars.length;
  const box = useRef<HTMLDivElement>(null);
  const typed = useRef(onType);
  typed.current = onType;
  // 待ちの間は、文字を出し始めない
  const [ready, setReady] = useState(delayMs <= 0 || prefersReducedMotion());
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(id);
  }, [ready, delayMs]);

  useEffect(() => {
    if (!typing || !ready) return;
    const id = setInterval(() => {
      setShown((n) => {
        typed.current?.(n);
        return n + 1;
      });
    }, TEXT_MS);
    return () => clearInterval(id);
  }, [typing, ready]);
  useEffect(() => box.current?.focus(), []);

  const next = () => {
    if (typing) return setShown(chars.length);
    if (index + 1 < lines.length) {
      setIndex(index + 1);
      setShown(prefersReducedMotion() ? Number.POSITIVE_INFINITY : 0);
      onNext?.();
    } else onDone();
  };
  if (!line) return null;
  return (
    // biome-ignore lint/a11y/useSemanticElements: 会話の窓は大きな押せる領域で、中に見出しと文を持つ
    <div
      ref={box}
      className={className ? `px-dialog ${className}` : 'px-dialog'}
      role="button"
      tabIndex={0}
      aria-label={`${label}。${line.name ? `${line.name}「${line.text}」` : line.text}。押すと次へ`}
      onClick={next}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          next();
        }
      }}
      data-testid={testId}
    >
      {line.face !== undefined && <div className="px-dialog-face">{line.face}</div>}
      <div className="px-dialog-body">
        {line.name && <span className="px-dialog-name">{line.name}</span>}
        <p className={line.narration ? 'px-dialog-text is-narration' : 'px-dialog-text'}>{chars.slice(0, shown).join('')}</p>
      </div>
      <span className="px-dialog-count">
        {index + 1}／{lines.length}
      </span>
      {!typing && <span className="px-dialog-more">▼</span>}
    </div>
  );
}
