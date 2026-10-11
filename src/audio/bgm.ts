// BGM（docs/design.md#音）。譜面（score.ts）を、Web Audio の矩形波・三角波・雑音で鳴らす。音の素材は持たない。
// 曲の表と入り切りの設定はゲームが渡す。
// 先読みの予約（setInterval で数十ミリ秒ごとに、少し先までの音を予約する）で、ループの継ぎ目を空けない。
// 画面は流したい曲を want で伝える。タブが隠れている間は止める。
import type { Setting } from '../setting.ts';
import { audioContext, noiseOf, onFirstGesture } from './context.ts';
import { audible, type Compiled, compile, frequencyOf, type Score, stepSecOf, type Voice } from './score.ts';

export type BgmOptions = {
  /** BGM 全体の大きさ。既定 0.16 で、効果音（1音あたり約0.09）より控えめにする。 */
  readonly master?: number;
};

export type Bgm<Track extends string> = {
  /** 入り切りの設定。 */
  readonly setting: Setting;
  /** 入り切りを変える。押した操作の中で呼ぶ（ブラウザーが音を許すのは、利用者の操作の中だけのため）。 */
  readonly setOn: (next: boolean) => void;
  /** この画面で流す曲を伝える。null なら止める。同じ曲なら頭から流し直さない。 */
  readonly want: (track: Track | null) => void;
  /** 画面が閉じたときに呼ぶ。その画面の曲を流していたら止める。 */
  readonly release: (track: Track | null) => void;
  /** 山場の強さ。1 にすると、山場の層が鳴り、山場の速さの曲は速くなる。曲を替えると0に戻る。 */
  readonly setIntensity: (level: 0 | 1) => void;
  /** 曲の1刻みの音を、時刻 at に予約する。OfflineAudioContext にも同じ手順で書き出せる。 */
  readonly playStep: (ac: BaseAudioContext, out: AudioNode, track: Track, step: number, at: number, peak: boolean) => void;
  /** 1刻みの秒数（山場では速い）。 */
  readonly stepSec: (track: Track, peak: boolean) => number;
};

const LOOKAHEAD_SEC = 0.12;
const PUMP_MS = 25;
const FADE_IN_SEC = 0.25;
const FADE_OUT_SEC = 0.4;
// 音色ごとの大きさ。矩形波は耳に強く、三角波は弱く聞こえるので、そろえる。
const VOICE_GAIN: Readonly<Record<Voice, number>> = { pulse: 0.3, square: 0.2, triangle: 0.55 };
const DRUM_GAIN = { kick: 0.9, snare: 0.45, hat: 0.22 } as const;

// ---- 音色 ----

// 幅25%のパルス波。昔のゲーム機の主旋律の音。AudioContext ごとに1度だけ作る。
const pulses = new WeakMap<BaseAudioContext, PeriodicWave>();
function pulseOf(ac: BaseAudioContext): PeriodicWave {
  const hit = pulses.get(ac);
  if (hit) return hit;
  const n = 32;
  const duty = 0.25;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    real[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k);
    imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k);
  }
  const wave = ac.createPeriodicWave(real, imag);
  pulses.set(ac, wave);
  return wave;
}

function tone(ac: BaseAudioContext, out: AudioNode, voice: Voice, freq: number, at: number, len: number, vol: number): void {
  const osc = ac.createOscillator();
  if (voice === 'pulse') osc.setPeriodicWave(pulseOf(ac));
  else osc.type = voice;
  osc.frequency.setValueAtTime(freq, at);
  const gain = ac.createGain();
  // 立ち上がりを短く、伸ばす間は少しずつ弱め、次の音の前に切って粒を立てる
  const end = at + len * 0.92;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(vol, at + 0.006);
  gain.gain.linearRampToValueAtTime(voice === 'triangle' ? vol * 0.85 : vol * 0.6, Math.max(at + 0.01, end - 0.02));
  gain.gain.linearRampToValueAtTime(0, end);
  osc.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(end + 0.01);
}

function noiseHit(ac: BaseAudioContext, out: AudioNode, at: number, cutoff: number, decay: number, vol: number): void {
  const src = ac.createBufferSource();
  src.buffer = noiseOf(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(cutoff, at);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + decay);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(at, Math.random() * 0.5);
  src.stop(at + decay + 0.01);
}

function drum(ac: BaseAudioContext, out: AudioNode, kind: keyof typeof DRUM_GAIN, at: number, vol: number): void {
  const v = DRUM_GAIN[kind] * vol;
  if (kind === 'hat') {
    noiseHit(ac, out, at, 7000, 0.035, v);
    return;
  }
  if (kind === 'snare') {
    noiseHit(ac, out, at, 1200, 0.13, v);
    tone(ac, out, 'triangle', 190, at, 0.06, v * 0.8);
    return;
  }
  // 大太鼓は、低い正弦波の高さを素早く下げて作る
  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(140, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(v, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
  osc.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(at + 0.17);
}

type Player<Track> = { readonly track: Track; readonly bus: GainNode; timer: number; step: number; next: number };

/** 曲の表 scores から BGM を作る。setting が切ってあるときは流さない。 */
export function createBgm<Track extends string>(
  scores: Readonly<Record<Track, Score>>,
  setting: Setting,
  options: BgmOptions = {},
): Bgm<Track> {
  const master = options.master ?? 0.16;
  const compiled = new Map<Track, Compiled>();
  const compiledOf = (track: Track): Compiled => {
    const hit = compiled.get(track);
    if (hit) return hit;
    const c = compile(scores[track]);
    compiled.set(track, c);
    return c;
  };
  let desired: Track | null = null;
  let intense = false;
  let player: Player<Track> | null = null;

  const stepSec = (track: Track, peak: boolean): number => stepSecOf(compiledOf(track), peak);

  const playStep = (ac: BaseAudioContext, out: AudioNode, track: Track, step: number, at: number, peak: boolean): void => {
    const c = compiledOf(track);
    const sec = stepSecOf(c, peak);
    for (const n of c.notes[step % c.length] ?? []) {
      if (!audible(n.layer, peak)) continue;
      const vol = (VOICE_GAIN[n.voice] * n.volume) / Math.sqrt(n.midi.length); // 和音は音の数で割って、大きさをそろえる
      for (const m of n.midi) tone(ac, out, n.voice, frequencyOf(m), at, n.steps * sec, vol);
    }
    for (const d of c.drums[step % c.length] ?? []) if (audible(d.layer, peak)) drum(ac, out, d.drum, at + d.offset * sec, d.volume);
  };

  const pump = (ac: AudioContext, p: Player<Track>): void => {
    if (p.next < ac.currentTime - 0.2) p.next = ac.currentTime + 0.02; // 遅れたら、追いかけずに今から鳴らす
    while (p.next < ac.currentTime + LOOKAHEAD_SEC) {
      playStep(ac, p.bus, p.track, p.step, p.next, intense);
      p.next += stepSec(p.track, intense);
      p.step = (p.step + 1) % compiledOf(p.track).length;
    }
  };

  const startPlayer = (ac: AudioContext, track: Track): Player<Track> => {
    const now = ac.currentTime;
    const bus = ac.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(master, now + FADE_IN_SEC);
    bus.connect(ac.destination);
    const p: Player<Track> = { track, bus, timer: 0, step: 0, next: now + 0.05 };
    p.timer = window.setInterval(() => pump(ac, p), PUMP_MS);
    pump(ac, p);
    return p;
  };

  const stopPlayer = (ac: AudioContext | null, p: Player<Track>): void => {
    window.clearInterval(p.timer);
    if (!ac) return;
    const now = ac.currentTime;
    p.bus.gain.cancelScheduledValues(now);
    p.bus.gain.setValueAtTime(p.bus.gain.value, now);
    p.bus.gain.linearRampToValueAtTime(0, now + FADE_OUT_SEC);
    // 先に予約した伸ばす音が残っていても、消えた後に切る
    window.setTimeout(() => p.bus.disconnect(), (FADE_OUT_SEC + 0.2) * 1000);
  };

  /** 今流すべき曲に合わせる。同じ曲なら何もしない（頭から流し直さない）。 */
  const apply = (): void => {
    try {
      const want = setting.get() && typeof document !== 'undefined' && !document.hidden ? desired : null;
      if (player?.track === want) return;
      const ac = audioContext(false);
      if (player) {
        stopPlayer(ac, player);
        intense = false; // 曲を離れたら、山場の強さを戻す
      }
      player = null;
      if (want === null) return;
      if (ac?.state === 'running') player = startPlayer(ac, want);
      else onFirstGesture(apply);
    } catch {
      // 音が出せない環境では黙る
      player = null;
    }
  };

  // 曲の切り替えは、描き直しのあとにまとめて行う。画面が替わって同じ曲を選び直したときに、頭から流し直さないため。
  let queued = false;
  const queueApply = (): void => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      apply();
    });
  };

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', apply);

  return {
    setting,
    setOn: (next) => {
      setting.set(next);
      if (next)
        audioContext(true)
          ?.resume()
          .then(apply, () => {});
      apply();
    },
    want: (track) => {
      desired = track;
      queueApply();
    },
    release: (track) => {
      if (desired === track) desired = null;
      queueApply();
    },
    setIntensity: (level) => {
      intense = level === 1;
    },
    playStep,
    stepSec,
  };
}
