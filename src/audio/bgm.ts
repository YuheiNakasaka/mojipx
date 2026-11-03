// BGM（docs/design.md#sound）。譜面（score.ts）を、Web Audio の矩形波・三角波・雑音で鳴らす。音の素材は持たない。
// 曲の表と入り切りの設定はゲームが渡す。
// 先読みの予約（setInterval で数十ミリ秒ごとに、少し先までの音を予約する）で、ループの継ぎ目を空けない。
// 画面は流したい曲を want で伝える。cue で伝えた曲には、今の曲のループの終わりで継ぎ目なく替える。
// 画面の上に画面を重ねるときは、優先度を付けて request で頼む。いちばん高い優先度の、いちばん新しい頼みの曲を流し、
// 頼みを外すと下の頼みの曲に戻す。山場の強さは頼みごとに持つ（requests.ts）。
// タブが隠れている間は、既定では止める。
import type { Setting } from '../setting.ts';
import { audioContext, noiseOf, onFirstGesture } from './context.ts';
import { decayCurve, type Envelope, PLUCK_TAU_SEC, swellAttackOf, swingShift, vibratoDepthHz } from './envelope.ts';
import {
  cued,
  cueOf,
  handedOver,
  type Intensity,
  released,
  requested,
  type TrackRequest,
  topRequest,
  wanted,
  withdrawn,
  withIntensity,
} from './requests.ts';
import { audible, type Compiled, compile, type Drum, frequencyOf, type NoteEvent, type Score, stepSecOf, type Voice } from './score.ts';
import { advanceStep, type BgmPosition, positionAt, recentMarks, type StepMark } from './transport.ts';

export type BgmOptions = {
  /** BGM 全体の大きさ。既定 0.16 で、効果音（1音あたり約0.09）より控えめにする。 */
  readonly master?: number;
  /** タブが隠れている間は止めるか。既定は true。音楽を聞かせるサイトのように、隠れても流し続けたいときは false にする。 */
  readonly pauseWhenHidden?: boolean;
};

/** request の選び方。 */
export type BgmRequestOptions = {
  /** 優先度。上に重ねる画面ほど大きくし、いちばん高い優先度の頼みの曲を流す。既定は0。 */
  readonly priority?: number;
  /** この頼みの山場の強さ。既定は0。 */
  readonly intensity?: Intensity;
};

/** request で足した頼み。 */
export type BgmRequest = {
  /** この頼みの山場の強さを変える。上に無い間も強さは残り、上に戻ったときに効く。 */
  readonly setIntensity: (level: Intensity) => void;
  /** 頼みを外す。上にあった頼みなら、下の頼みの曲に戻す。 */
  readonly release: () => void;
};

export type Bgm<Track extends string> = {
  /** 入り切りの設定。 */
  readonly setting: Setting;
  /** 入り切りを変える。押した操作の中で呼ぶ（ブラウザーが音を許すのは、利用者の操作の中だけのため）。 */
  readonly setOn: (next: boolean) => void;
  /**
   * 流す曲を伝える（優先度0の、じかの頼み）。null なら止める。同じ曲なら頭から流し直さない。違う曲なら、すぐに替える。
   * request で上に重ねた頼みがあれば、それが外れてから流す。
   */
  readonly want: (track: Track | null) => void;
  /** 今の曲のループが終わったところで、track に継ぎ目なく替える。曲を流していなければ want と同じ。 */
  readonly cue: (track: Track) => void;
  /** 画面が閉じたときに呼ぶ。want で伝えた曲が track なら止める。 */
  readonly release: (track: Track | null) => void;
  /**
   * 曲を頼む。いちばん高い優先度（priority）の、いちばん新しい頼みの曲を流し、頼みを外すと下の頼みの曲に戻す。
   * track が null の頼みは、上にある間は止める。画面の上に画面を重ねるときに使う。
   */
  readonly request: (track: Track | null, options?: BgmRequestOptions) => BgmRequest;
  /**
   * いま上にある頼みの山場の強さ。1 にすると、山場の層が鳴り、山場の速さの曲は速くなる。
   * 強さは頼みに残り、上に重ねた頼みが外れて戻ると当て直す。want で違う曲にすると0に戻る。
   */
  readonly setIntensity: (level: Intensity) => void;
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
// 音色ごとの大きさ。矩形波やのこぎり波は耳に強く、三角波や正弦波は弱く聞こえるので、そろえる。
const VOICE_GAIN: Readonly<Record<Voice, number>> = { pulse: 0.3, pulse12: 0.3, square: 0.2, triangle: 0.55, sine: 0.5, saw: 0.17 };
const DRUM_GAIN: Readonly<Record<Drum, number>> = { kick: 0.9, snare: 0.45, hat: 0.22, open: 0.16, tom: 0.7 };
const VIBRATO_HZ = 5.5;
const VIBRATO_DELAY_SEC = 0.12;

// ---- 音色 ----

// パルス波。昔のゲーム機の主旋律の音。幅（duty）と AudioContext の組ごとに1度だけ作る。
const pulses = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();
function pulseOf(ac: BaseAudioContext, duty: number): PeriodicWave {
  let byDuty = pulses.get(ac);
  if (!byDuty) {
    byDuty = new Map();
    pulses.set(ac, byDuty);
  }
  const hit = byDuty.get(duty);
  if (hit) return hit;
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    real[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k);
    imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k);
  }
  const wave = ac.createPeriodicWave(real, imag);
  byDuty.set(duty, wave);
  return wave;
}

const BUILT_IN: Readonly<Partial<Record<Voice, OscillatorType>>> = {
  square: 'square',
  triangle: 'triangle',
  sine: 'sine',
  saw: 'sawtooth',
};

function oscillatorOf(ac: BaseAudioContext, voice: Voice): OscillatorNode {
  const osc = ac.createOscillator();
  const type = BUILT_IN[voice];
  if (type) osc.type = type;
  else osc.setPeriodicWave(pulseOf(ac, voice === 'pulse12' ? 0.125 : 0.25));
  return osc;
}

/** 音1つ。len は次の音までの長さ（秒）。 */
type ToneSpec = {
  readonly voice: Voice;
  readonly freq: number;
  readonly at: number;
  readonly len: number;
  readonly vol: number;
  readonly envelope?: Envelope;
  readonly vibrato?: number;
};

// 大きさの動きを gain に予約し、音の終わりの時刻を返す。
function shapeGain(g: AudioParam, t: ToneSpec): number {
  const { at, len, vol } = t;
  if (t.envelope === 'pluck') {
    const end = at + len * 0.98;
    g.setValueAtTime(0, at);
    g.linearRampToValueAtTime(vol, at + 0.004);
    g.setValueCurveAtTime(decayCurve(vol, Math.max(0.01, end - at - 0.014), PLUCK_TAU_SEC), at + 0.004, Math.max(0.01, end - at - 0.014));
    g.linearRampToValueAtTime(0, end);
    return end;
  }
  if (t.envelope === 'swell') {
    const end = at + len * 0.98;
    g.setValueAtTime(0, at);
    g.linearRampToValueAtTime(vol, at + swellAttackOf(len));
    g.linearRampToValueAtTime(vol * 0.8, Math.max(at + swellAttackOf(len) + 0.01, end - len * 0.15));
    g.linearRampToValueAtTime(0, end);
    return end;
  }
  // 立ち上がりを短く、伸ばす間は少しずつ弱め、次の音の前に切って粒を立てる
  const end = at + len * 0.92;
  const soft = t.voice === 'triangle' || t.voice === 'sine';
  g.setValueAtTime(0, at);
  g.linearRampToValueAtTime(vol, at + 0.006);
  g.linearRampToValueAtTime(soft ? vol * 0.85 : vol * 0.6, Math.max(at + 0.01, end - 0.02));
  g.linearRampToValueAtTime(0, end);
  return end;
}

// 長い音を、少し遅れてから揺らす
function addVibrato(ac: BaseAudioContext, osc: OscillatorNode, t: ToneSpec, end: number): void {
  const cents = t.vibrato ?? 0;
  if (cents <= 0 || end - t.at < VIBRATO_DELAY_SEC * 2) return;
  const lfo = ac.createOscillator();
  lfo.frequency.setValueAtTime(VIBRATO_HZ, t.at);
  const depth = ac.createGain();
  depth.gain.setValueAtTime(0, t.at);
  depth.gain.linearRampToValueAtTime(vibratoDepthHz(t.freq, cents), t.at + VIBRATO_DELAY_SEC * 2);
  lfo.connect(depth);
  depth.connect(osc.frequency);
  lfo.start(t.at + VIBRATO_DELAY_SEC);
  lfo.stop(end + 0.01);
}

function tone(ac: BaseAudioContext, outs: readonly AudioNode[], t: ToneSpec): void {
  const osc = oscillatorOf(ac, t.voice);
  osc.frequency.setValueAtTime(t.freq, t.at);
  const gain = ac.createGain();
  const end = shapeGain(gain.gain, t);
  addVibrato(ac, osc, t, end);
  osc.connect(gain);
  for (const out of outs) gain.connect(out);
  osc.start(t.at);
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

// 正弦波の高さを素早く下げて、胴の鳴る太鼓にする（大太鼓とタム）
function thump(ac: BaseAudioContext, out: AudioNode, at: number, from: number, to: number, decay: number, vol: number): void {
  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + decay * 0.75);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + decay);
  osc.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(at + decay + 0.01);
}

function drum(ac: BaseAudioContext, out: AudioNode, kind: Drum, at: number, vol: number): void {
  const v = DRUM_GAIN[kind] * vol;
  if (kind === 'hat') noiseHit(ac, out, at, 7000, 0.035, v);
  else if (kind === 'open') noiseHit(ac, out, at, 6000, 0.22, v);
  else if (kind === 'tom') thump(ac, out, at, 190, 80, 0.26, v);
  else if (kind === 'kick') thump(ac, out, at, 140, 45, 0.16, v);
  else {
    noiseHit(ac, out, at, 1200, 0.13, v);
    tone(ac, [out], { voice: 'triangle', freq: 190, at, len: 0.06, vol: v * 0.8 });
  }
}

// ---- 左右とやまびこ ----

const panners = new WeakMap<AudioNode, Map<number, AudioNode>>();
/** out の手前に置く、左右の位置 pan の入口。出口ごと・位置ごとに1つだけ作る。 */
function pannedOf(ac: BaseAudioContext, out: AudioNode, pan: number): AudioNode {
  if (pan === 0) return out;
  let byPan = panners.get(out);
  if (!byPan) {
    byPan = new Map();
    panners.set(out, byPan);
  }
  const hit = byPan.get(pan);
  if (hit) return hit;
  const node = ac.createStereoPanner();
  node.pan.setValueAtTime(Math.min(1, Math.max(-1, pan)), 0);
  node.connect(out);
  byPan.set(pan, node);
  return node;
}

const echoes = new WeakMap<AudioNode, Map<string, AudioNode>>();
/** out に返す、やまびこの入口。出口・遅れ・弱まり方ごとに1つだけ作る。 */
function echoOf(ac: BaseAudioContext, out: AudioNode, delaySec: number, feedback: number): AudioNode {
  const key = `${delaySec}:${feedback}`;
  let byKey = echoes.get(out);
  if (!byKey) {
    byKey = new Map();
    echoes.set(out, byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit;
  const input = ac.createGain();
  const delay = ac.createDelay(2);
  delay.delayTime.setValueAtTime(Math.min(2, delaySec), 0);
  const loop = ac.createGain();
  loop.gain.setValueAtTime(Math.min(0.9, Math.max(0, feedback)), 0);
  input.connect(delay);
  delay.connect(loop);
  loop.connect(delay);
  delay.connect(out);
  byKey.set(key, input);
  return input;
}

// 1つの音を送る先。やまびこには、送る割合の大きさにした枝を足す。
function sendsOf(ac: BaseAudioContext, out: AudioNode, n: NoteEvent, echo: AudioNode | null, at: number): readonly AudioNode[] {
  const dry = pannedOf(ac, out, n.pan);
  if (!echo || n.echo <= 0) return [dry];
  const send = ac.createGain();
  send.gain.setValueAtTime(n.echo, at);
  send.connect(echo);
  return [dry, send];
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
  let requests: readonly TrackRequest<Track>[] = [];
  let lastId = 0;
  const newId = (): number => {
    lastId += 1;
    return lastId;
  };
  /** 流す曲（上の頼みの曲）と、山場か */
  const desired = (): Track | null => topRequest(requests)?.track ?? null;
  const peak = (): boolean => topRequest(requests)?.intensity === 1;
  let volume = 1;
  let player: Player<Track> | null = null;
  let marks: readonly StepMark<Track>[] = [];

  const level = (track: Track): number => master * volume * compiledOf(track).gain;
  const lookahead = (): number => (isHidden() ? HIDDEN_LOOKAHEAD_SEC : LOOKAHEAD_SEC);
  const stepSec = (track: Track, peak: boolean): number => stepSecOf(compiledOf(track), peak);

  const playStep = (ac: BaseAudioContext, out: AudioNode, track: Track, step: number, at: number, peak: boolean): void => {
    const c = compiledOf(track);
    const sec = stepSecOf(c, peak);
    const i = step % c.length;
    // 跳ねる曲は、奇数の刻みを遅らせる。音の長さは、次に鳴る刻みの頭までにする。
    const shift = (k: number): number => swingShift(k, c.swing) * sec;
    const start = at + shift(i);
    const echo = c.echo ? echoOf(ac, out, c.echo.steps * stepSecOf(c, false), c.echo.feedback) : null;
    for (const n of c.notes[i] ?? []) {
      if (!audible(n.layer, peak)) continue;
      const vol = (VOICE_GAIN[n.voice] * n.volume) / Math.sqrt(n.midi.length); // 和音は音の数で割って、大きさをそろえる
      const len = n.steps * sec + shift(i + n.steps) - shift(i);
      const outs = sendsOf(ac, out, n, echo, start);
      for (const m of n.midi)
        tone(ac, outs, { voice: n.voice, freq: frequencyOf(m), at: start, len, vol, envelope: n.envelope, vibrato: n.vibrato });
    }
    for (const d of c.drums[i] ?? []) if (audible(d.layer, peak)) drum(ac, out, d.drum, start + d.offset * sec, d.volume);
  };

  const pump = (ac: AudioContext, p: Player<Track>): void => {
    if (p.next < ac.currentTime - 0.2) p.next = ac.currentTime + 0.02; // 遅れたら、追いかけずに今から鳴らす
    const until = ac.currentTime + lookahead();
    while (p.next < until) {
      const c = compiledOf(p.track);
      // ループの頭に着いたところで、待っている曲に替える
      const next = cueOf(requests, p.track);
      if (next !== null && p.loop > 0 && p.step === c.loopStart) {
        handOver(ac, p, next);
        return;
      }
      const intense = peak();
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
      bus.gain.linearRampToValueAtTime(level(track), now + FADE_IN_SEC);
    } else bus.gain.setValueAtTime(level(track), now);
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
    requests = handedOver(requests, track);
    player = startPlayer(ac, track, at);
  };

  /** 今流すべき曲に合わせる。同じ曲なら何もしない（頭から流し直さない）。 */
  const apply = (): void => {
    try {
      const on = setting.get() && typeof document !== 'undefined' && !(pauseWhenHidden && document.hidden);
      const want = on ? desired() : null;
      if (player?.track === want) return;
      const ac = audioContext(false);
      if (player) stopPlayer(ac, player);
      player = null;
      if (want === null) {
        marks = [];
        return;
      }
      if (ac?.state === 'running') player = startPlayer(ac, want);
      else {
        onFirstGesture(apply);
        // 押した操作の中で resume を呼んだ直後は、まだ動いていない。動き出したところで流す。
        ac?.addEventListener('statechange', apply, { once: true });
      }
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
      requests = wanted(requests, newId(), track);
      queueApply();
    },
    cue: (track) => {
      requests = cued(requests, newId(), track, player?.track ?? null);
      queueApply();
    },
    release: (track) => {
      requests = released(requests, track);
      queueApply();
    },
    request: (track, options = {}) => {
      const id = newId();
      requests = requested(requests, id, track, options.priority ?? 0, options.intensity ?? 0);
      queueApply();
      return {
        setIntensity: (level) => {
          requests = withIntensity(requests, id, level);
        },
        release: () => {
          requests = withdrawn(requests, id);
          queueApply();
        },
      };
    },
    setIntensity: (level) => {
      const top = topRequest(requests);
      if (top) requests = withIntensity(requests, top.id, level);
    },
    setVolume: (next) => {
      volume = Math.min(1, Math.max(0, next));
      const ac = audioContext(false);
      if (!ac || !player) return;
      player.bus.gain.cancelScheduledValues(ac.currentTime);
      player.bus.gain.setTargetAtTime(level(player.track), ac.currentTime, 0.03);
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
