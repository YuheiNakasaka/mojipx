// 音を鳴らす AudioContext と、雑音の素（docs/design.md#音）。効果音と BGM が1つを分け合う。

let ctx: AudioContext | null = null;

/**
 * 音を鳴らす AudioContext。create が true のときだけ作る（ブラウザーは、利用者の操作の中で作らないと止めたままにするため）。
 * 作れない環境では null。
 */
export function audioContext(create: boolean): AudioContext | null {
  try {
    if (!ctx && create) ctx = new AudioContext();
    if (ctx?.state === 'suspended' && create) void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();
/** 1秒分の白い雑音。太鼓と効果音の雑音に使う。AudioContext ごとに1度だけ作る。 */
export function noiseOf(ac: BaseAudioContext): AudioBuffer {
  const hit = noises.get(ac);
  if (hit) return hit;
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noises.set(ac, buf);
  return buf;
}

// 利用者の操作があるまで、ブラウザーは音を止めている。最初の操作で AudioContext を動かし、待っている関数を呼ぶ。
let waiting: Set<() => void> | null = null;

/** 次の利用者の操作（押す・キー）で AudioContext を動かしてから then を呼ぶ。同じ関数は1度だけ呼ぶ。 */
export function onFirstGesture(then: () => void): void {
  if (typeof document === 'undefined') return;
  if (waiting) {
    waiting.add(then);
    return;
  }
  waiting = new Set([then]);
  const unlock = () => {
    const calls = [...(waiting ?? [])];
    waiting = null;
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
    audioContext(true)
      ?.resume()
      .then(
        () => {
          for (const f of calls) f();
        },
        () => {},
      );
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
}
