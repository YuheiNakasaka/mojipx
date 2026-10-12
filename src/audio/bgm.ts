// BGM（docs/design.md#音）。譜面（score.ts）を、Web Audio の矩形波・三角波・雑音で鳴らす。音の素材は持たない。
// 曲の表と入り切りの設定はゲームが渡す。
// 先読みの予約（setInterval で数十ミリ秒ごとに、少し先までの音を予約する）で、ループの継ぎ目を空けない。
// 画面は流したい曲を want で伝える。cue で伝えた曲には、今の曲のループの終わりで継ぎ目なく替える。
// タブが隠れている間は、既定では止める。
import type { Setting } from '../setting.ts';
import { audioContext, noiseOf, onFirstGesture } from './context.ts';
import { audible, type Compiled, compile, frequencyOf, type Score, stepSecOf, type Voice } from './score.ts';
import { advanceStep, type BgmPosition, positionAt, recentMarks, type StepMark } from './transport.ts';

export type BgmOptions = {
  /** BGM 全体の大きさ。既定 0.16 で、効果音（1音あたり約0.09）より控えめにする。 */
  readonly master?: number;
  /** タブが隠れている間は止めるか。既定は true。音楽を聞かせるサイトのように、隠れても流し続けたいときは false にする。 */
  readonly pauseWhenHidden?: boolean;
};

export type Bgm<Track extends string> = {
  /** 入り切りの設定。 */
  readonly setting: Setting;
  /** 入り切りを変える。押した操作の中で呼ぶ（ブラウザーが音を許すのは、利用者の操作の中だけのため）。 */
  readonly setOn: (next: boolean) => void;
  /** この画面で流す曲を伝える。null なら止める。同じ曲なら頭から流し直さない。違う曲なら、すぐに替える。 */
  readonly want: (track: Track | null) => void;
  /** 今の曲のループが終わったところで、track に継ぎ目なく替える。曲を流していなければ want と同じ。 */
  readonly cue: (track: Track) => void;
  /** 画面が閉じたときに呼ぶ。その画面の曲を流していたら止める。 */
  readonly release: (track: Track | null) => void;
  /** 山場の強さ。1 にすると、山場の層が鳴り、山場の速さの曲は速くなる。曲を替えると0に戻る。 */
  readonly setIntensity: (level: 0 | 1) => void;
  /** 大きさ（0〜1）。master に掛ける。既定は1。 */
  readonly setVolume: (volume: number) => void;
  /** 今聞こえている曲と位置。音の出口の遅れを差し引く。曲を流していなければ null。画面を音に合わせて動かすのに使う。 */
  readonly position: () => BgmPosition<Track> | null;
  /** 曲の1刻みの音を、時刻 at に予約する。OfflineAudioContext にも同じ手順で書き出せる。 */
  readonly playStep: (ac: BaseAudioContext, out: AudioNode, track: Track, step: number, at: number, peak: boolean) => void;
  /** 1刻みの秒数（山場では速い）。 */
  readonly stepSec: (track: Track, peak: boolean) => number;
};

const LOOKAHEAD_SEC = 0.12;
// 隠れたタブでは、ブラウザーが setInterval を1秒に1度ほどに間引くので、その間を埋めるだけ先まで予約する。
const HIDDEN_LOOKAHEAD_SEC = 1.5;
const PUMP_MS = 25;
const FADE_IN_SEC = 0.25;
const FADE_OUT_SEC = 0.4;
const MARK_KEEP_SEC = 2;
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

type Player<Track> = { readonly track: Track; readonly bus: GainNode; timer: number; step: number; loop: number; next: number };

const isHidden = (): boolean => typeof document !== 'undefined' && document.hidden;

// 音の出口までの遅れ（秒）。Bluetooth のイヤホンなどでは大きい。測れない環境では0。
const latencyOf = (ac: AudioContext): number => (ac.baseLatency || 0) + (ac.outputLatency || 0);

/** 曲の表 scores から BGM を作る。setting が切ってあるときは流さない。 */
export function createBgm<Track extends string>(
  scores: Readonly<Record<Track, Score>>,
  setting: Setting,
  options: BgmOptions = {},
): Bgm<Track> {
  const master = options.master ?? 0.16;
  const pauseWhenHidden = options.pauseWhenHidden ?? true;
  const compiled = new Map<Track, Compiled>();
  const compiledOf = (track: Track): Compiled => {
    const hit = compiled.get(track);
    if (hit) return hit;
    const c = compile(scores[track]);
    compiled.set(track, c);
    return c;
  };
  let desired: Track | null = null;
  let cued: Track | null = null;
  let intense = false;
  let volume = 1;
  let player: Player<Track> | null = null;
  let marks: readonly StepMark<Track>[] = [];

  const level = (): number => master * volume;
  const lookahead = (): number => (isHidden() ? HIDDEN_LOOKAHEAD_SEC : LOOKAHEAD_SEC);
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
    const until = ac.currentTime + lookahead();
    while (p.next < until) {
      const c = compiledOf(p.track);
      // ループの頭に着いたところで、待っている曲に替える
      if (cued !== null && p.loop > 0 && p.step === c.loopStart) {
        handOver(ac, p, cued);
        return;
      }
      const sec = stepSec(p.track, intense);
      playStep(ac, p.bus, p.track, p.step, p.next, intense);
      marks = [...recentMarks(marks, ac.currentTime, MARK_KEEP_SEC), { track: p.track, step: p.step, loop: p.loop, at: p.next, sec }];
      p.next += sec;
      const n = advanceStep(p.step, p.loop, c.length, c.loopStart);
      p.step = n.step;
      p.loop = n.loop;
    }
  };

  /** at を指定すると、その時刻から継ぎ目なく鳴らす（曲の切り替えでは、ふくらませずにすぐの大きさにする）。 */
  const startPlayer = (ac: AudioContext, track: Track, at?: number): Player<Track> => {
    const now = ac.currentTime;
    const bus = ac.createGain();
    if (at === undefined) {
      bus.gain.setValueAtTime(0, now);
      bus.gain.linearRampToValueAtTime(level(), now + FADE_IN_SEC);
    } else bus.gain.setValueAtTime(level(), now);
    bus.connect(ac.destination);
    const p: Player<Track> = { track, bus, timer: 0, step: 0, loop: 0, next: at ?? now + 0.05 };
    p.timer = window.setInterval(() => pump(ac, p), PUMP_MS);
    pump(ac, p);
    return p;
  };

  const stopPlayer = (ac: AudioContext | null, p: Player<Track>): void => {
    window.clearInterval(p.timer);
    if (!ac) return;
    const now = ac.currentTime;
    // 先に予約した刻みは、消えていく音なので、位置には数えない
    marks = marks.filter((m) => m.at <= now);
    p.bus.gain.cancelScheduledValues(now);
    p.bus.gain.setValueAtTime(p.bus.gain.value, now);
    p.bus.gain.linearRampToValueAtTime(0, now + FADE_OUT_SEC);
    // 先に予約した伸ばす音が残っていても、消えた後に切る
    window.setTimeout(() => p.bus.disconnect(), (FADE_OUT_SEC + lookahead() + 0.2) * 1000);
  };

  // 古い曲は継ぎ目の時刻 old.next まで予約してあるので、そこから新しい曲を鳴らす。
  const handOver = (ac: AudioContext, old: Player<Track>, track: Track): void => {
    const at = old.next;
    window.clearInterval(old.timer);
    // 古い曲で伸ばしている音は、継ぎ目のあと少しで消す
    old.bus.gain.setTargetAtTime(0, at, 0.05);
    window.setTimeout(() => old.bus.disconnect(), (at - ac.currentTime + 1) * 1000);
    cued = null;
    desired = track;
    intense = false;
    player = startPlayer(ac, track, at);
  };

  /** 今流すべき曲に合わせる。同じ曲なら何もしない（頭から流し直さない）。 */
  const apply = (): void => {
    try {
      const on = setting.get() && typeof document !== 'undefined' && !(pauseWhenHidden && document.hidden);
      const want = on ? desired : null;
      if (player?.track === want) return;
      const ac = audioContext(false);
      if (player) {
        stopPlayer(ac, player);
        intense = false; // 曲を離れたら、山場の強さを戻す
      }
      player = null;
      if (want === null) {
        marks = [];
        return;
      }
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
      cued = null;
      queueApply();
    },
    cue: (track) => {
      if (player && player.track === desired) {
        cued = track === player.track ? null : track;
        return;
      }
      desired = track;
      cued = null;
      queueApply();
    },
    release: (track) => {
      if (desired === track) {
        desired = null;
        cued = null;
      }
      queueApply();
    },
    setIntensity: (level) => {
      intense = level === 1;
    },
    setVolume: (next) => {
      volume = Math.min(1, Math.max(0, next));
      const ac = audioContext(false);
      if (!ac || !player) return;
      player.bus.gain.cancelScheduledValues(ac.currentTime);
      player.bus.gain.setTargetAtTime(level(), ac.currentTime, 0.03);
    },
    position: () => {
      const ac = audioContext(false);
      if (!ac || !player) return null;
      return positionAt(marks, ac.currentTime - latencyOf(ac));
    },
    playStep,
    stepSec,
  };
}
