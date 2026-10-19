// 効果音（docs/design.md#sound）。Web Audio の矩形波と雑音で作り、音の素材は持たない。
// 音の並びの表はゲームが渡す。入り切りは設定（setting.ts）で持ち、切ってあるときは鳴らさない。
import type { Setting } from '../setting.ts';
import { audioContext, noiseOf } from './context.ts';

/** 音1つ。f は周波数（Hz）で、0なら雑音。at と len は秒。vol は大きさ（既定 0.18）。 */
export type Tone = { readonly f: number; readonly at: number; readonly len: number; readonly type?: OscillatorType; readonly vol?: number };

export type Sfx<Name extends string> = {
  /** 効果音を鳴らす。切ってあるとき、または鳴らせない環境では何もしない。 */
  readonly play: (name: Name) => void;
};

const DEFAULT_VOL = 0.18;
const MASTER = 0.5;

/** 名前ごとの音の並び scores から、効果音を作る。setting が切ってあるときは鳴らさない。 */
export function createSfx<Name extends string>(scores: Readonly<Record<Name, readonly Tone[]>>, setting: Setting): Sfx<Name> {
  return {
    play: (name) => {
      if (!setting.get()) return;
      const ac = audioContext(true);
      if (!ac) return;
      try {
        const t0 = ac.currentTime + 0.01;
        for (const n of scores[name]) {
          const gain = ac.createGain();
          const vol = (n.vol ?? DEFAULT_VOL) * MASTER;
          gain.gain.setValueAtTime(vol, t0 + n.at);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + n.at + n.len);
          gain.connect(ac.destination);
          if (n.f === 0) {
            const src = ac.createBufferSource();
            src.buffer = noiseOf(ac);
            src.connect(gain);
            src.start(t0 + n.at);
            src.stop(t0 + n.at + n.len);
          } else {
            const osc = ac.createOscillator();
            osc.type = n.type ?? 'square';
            osc.frequency.setValueAtTime(n.f, t0 + n.at);
            osc.connect(gain);
            osc.start(t0 + n.at);
            osc.stop(t0 + n.at + n.len + 0.02);
          }
        }
      } catch {
        // 音が出せない環境では黙る
      }
    },
  };
}
