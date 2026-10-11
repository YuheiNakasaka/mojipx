// 窓・紙・吹き出し・ボタンの枠（docs/design.md#窓の枠）。12×12 の絵を、4点ずつの9分割で border-image に使う。
// 枠の形は色の代わりに役目の文字で書き、ゲームが役目ごとの色を渡す。
// O は輪郭、L は縁の明るい色、F は塗り、H はボタンの上の明るい色、S はボタンの下の影と紙の影。
import { type Recolor, type Sprite, svgUrl } from './sprite.ts';

/** 枠の役目の文字。 */
export type FrameRole = 'O' | 'L' | 'F' | 'H' | 'S';
/** 役目ごとの色。形が使う役目の色を、すべて渡す。 */
export type FrameColors = Readonly<Partial<Record<FrameRole, string>>>;

// biome-ignore format: 枠の絵は1行ずつ縦に並べ、形のまま読めるようにする
export const FRAME_SHAPES = {
  // 角を欠いた窓。白い縁と黒い輪郭の二重の縁
  window: [
    '..OOOOOOOO..',
    '.OLLLLLLLLO.',
    'OLLFFFFFFLLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OLLFFFFFFLLO',
    '.OLLLLLLLLO.',
    '..OOOOOOOO..',
  ],
  // 紙。右下に影を落とす
  paper: [
    '.OOOOOOOOOO.',
    'OLLLLLLLLLLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OLFFFFFFFFLO',
    'OSSSSSSSSSSO',
    '.OOOOOOOOOO.',
  ],
  // ボタン。上を明るく、下を暗くする
  button: [
    '..OOOOOOOO..',
    '.OHHHHHHHHO.',
    'OHHFFFFFFFSO',
    'OHFFFFFFFFSO',
    'OHFFFFFFFFSO',
    'OHFFFFFFFFSO',
    'OHFFFFFFFFSO',
    'OHFFFFFFFFSO',
    'OSFFFFFFFFSO',
    'OSSSSSSSSSSO',
    '.OSSSSSSSSO.',
    '..OOOOOOOO..',
  ],
  // 押したボタン。上下の明るさを入れ替える
  buttonDown: [
    '..OOOOOOOO..',
    '.OSSSSSSSSO.',
    'OSSFFFFFFFFO',
    'OSFFFFFFFFFO',
    'OSFFFFFFFFFO',
    'OSFFFFFFFFFO',
    'OSFFFFFFFFFO',
    'OSFFFFFFFFFO',
    'OSFFFFFFFFFO',
    'OFFFFFFFFFFO',
    '.OFFFFFFFFO.',
    '..OOOOOOOO..',
  ],
  // 吹き出し。角を大きく丸める
  bubble: [
    '...OOOOOO...',
    '.OOFFFFFFOO.',
    '.OFFFFFFFFO.',
    'OFFFFFFFFFFO',
    'OFFFFFFFFFFO',
    'OFFFFFFFFFFO',
    'OFFFFFFFFFFO',
    'OFFFFFFFFFFO',
    'OFFFFFFFFFFO',
    '.OFFFFFFFFO.',
    '.OOFFFFFFOO.',
    '...OOOOOO...',
  ],
} as const satisfies Readonly<Record<string, Sprite>>;

export type FrameShape = keyof typeof FRAME_SHAPES;

const NO_PALETTE = {};

/** 枠の絵を CSS の url() にする。 */
export const frameUrl = (shape: FrameShape | Sprite, colors: FrameColors): string =>
  svgUrl(typeof shape === 'string' ? FRAME_SHAPES[shape] : shape, NO_PALETTE, colors as Recolor);

/** 枠を根の要素の CSS 変数 --frame-<名前> に入れる。起動のときに1度だけ呼ぶ。 */
export function installFrames(frames: Readonly<Record<string, string>>, root: HTMLElement = document.documentElement): void {
  for (const [name, url] of Object.entries(frames)) root.style.setProperty(`--frame-${name}`, url);
}
