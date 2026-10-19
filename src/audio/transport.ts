// BGM の再生の位置（docs/design.md#sound）。予約した刻みの印から、今聞こえている曲と刻みを求める。DOM と Web Audio には触れない。
// 先読みの予約は少し先までの音を置くので、予約の進み具合ではなく、時刻と印の組で今の位置を決める。

/** 予約した刻みの印。at はその刻みが鳴り始める時刻（秒）、sec は刻みの長さ（秒）。 */
export type StepMark<Track> = {
  readonly track: Track;
  /** ループの中の刻みの番号。 */
  readonly step: number;
  /** その刻みまでに終えたループの数。 */
  readonly loop: number;
  readonly at: number;
  readonly sec: number;
};

/** 今聞こえている位置。phase は刻みの中の進み具合（0〜1）。 */
export type BgmPosition<Track> = {
  readonly track: Track;
  readonly step: number;
  readonly loop: number;
  readonly phase: number;
  readonly stepSec: number;
};

/** 時刻 now に聞こえている位置。最初の印より前なら null。印は時刻の順に並んでいるものとする。 */
export function positionAt<Track>(marks: readonly StepMark<Track>[], now: number): BgmPosition<Track> | null {
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i] as StepMark<Track>;
    if (m.at > now) continue;
    return { track: m.track, step: m.step, loop: m.loop, phase: Math.min(1, (now - m.at) / m.sec), stepSec: m.sec };
  }
  return null;
}

/** 時刻 now より keepSec 以上前に終わった印を捨てる。最後の印はいつも残す。 */
export const recentMarks = <Track>(marks: readonly StepMark<Track>[], now: number, keepSec: number): readonly StepMark<Track>[] =>
  marks.filter((m, i) => i === marks.length - 1 || m.at + m.sec >= now - keepSec);

/**
 * 刻み step の次の刻み。ループの終わり（length）に着いたら loopStart に戻り、終えたループの数を1つ増やす。
 * loopStart は、前奏を1度だけ流して、その後ろだけを繰り返す曲のためにある。
 */
export function advanceStep(step: number, loop: number, length: number, loopStart = 0): { readonly step: number; readonly loop: number } {
  const next = step + 1;
  return next < length ? { step: next, loop } : { step: Math.min(loopStart, Math.max(0, length - 1)), loop: loop + 1 };
}
