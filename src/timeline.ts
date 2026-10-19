// 再生の時計（docs/design.md#clock）。決まった数の時点を、決まった長さで再生する。DOM に触れない。
// 時点ごとの重みで長さを配り、重い時点（秒読みや見せ場）はゆっくり流して読めるようにする。全体の長さは変えない。

/**
 * 時点 t の始まりの時刻（ms）の並び。重み weights の時点を、全体で totalMs に配る。
 * 並びの長さは時点の数より1つ多く、最後の要素が全体の長さ（totalMs）になる。
 */
export function tickStarts(weights: readonly number[], totalMs: number): readonly number[] {
  const unit = totalMs / weights.reduce((a, b) => a + b, 0);
  let sum = 0;
  return [0, ...weights.map((w) => (sum += w * unit))];
}

/** 経過の時刻 ms にあたる時点。始まりの並び starts は tickStarts が作る。全体の長さを過ぎたら最後の時点。 */
export function tickAt(starts: readonly number[], ms: number): number {
  const ticks = starts.length - 1;
  if (ms >= (starts[ticks] ?? 0)) return Math.max(0, ticks - 1);
  return Math.max(
    0,
    starts.findLastIndex((s, i) => i < ticks && s <= ms),
  );
}
