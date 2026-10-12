// 音1つの大きさの動き（docs/design.md#音）の、値の計算。DOM と Web Audio には触れない。

/** 'hold' は伸ばす間少しずつ弱める（既定）、'pluck' は弾いた弦や木琴のようにすぐ減る、'swell' はゆっくりふくらむ。 */
export type Envelope = 'hold' | 'pluck' | 'swell';

/** 弾いた音の減り方の時定数（秒）。 */
export const PLUCK_TAU_SEC = 0.16;

/** 大きさ vol から、時定数 tau で dur 秒かけて減る値を、等間隔に n 個並べる。setValueCurveAtTime に渡す。 */
export function decayCurve(vol: number, dur: number, tau: number, n = 24): Float32Array {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) curve[i] = vol * Math.exp(-((dur * i) / (n - 1)) / tau);
  return curve;
}

/** ふくらむ音の立ち上がりの秒数。長い音ほど長く、上限 0.4 秒。 */
export const swellAttackOf = (len: number): number => Math.min(0.4, len * 0.35);

/** 揺らす幅（セント）を、周波数 freq での Hz の幅にする。 */
export const vibratoDepthHz = (freq: number, cents: number): number => freq * (2 ** (cents / 1200) - 1);

/** 揺れの割合（0〜0.5）だけ、奇数の刻みを遅らせる量（刻みの長さに対する割合）。 */
export const swingShift = (step: number, swing: number): number => (step % 2 === 1 ? swing : 0);
