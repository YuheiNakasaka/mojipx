# mojipx

ドット絵の見た目のブラウザーゲームを作るための部品の集まりである。
絵の描き方、窓の枠、会話の送り、幕、キャンバスの舞台、音、保存、再生の時計、画面の大きさの扱いを持つ。
パソコン・タブレット・スマホのブラウザーで遊べる画面を作れる。
設計は [docs/design.md](docs/design.md) にある。

## 入れ方

```sh
npm install mojipx
```

React の部品を使うときだけ、`react`（18 以上）も入れる。
ES モジュールだけを配る。
型の宣言は TypeScript 5.0 以上で読める。

## 入口

| 入口 | 中身 |
|---|---|
| `mojipx` | 絵、色、枠、描く道具、舞台の拡大の計算、画面の型、保存、設定、時計、音。React に依らない |
| `mojipx/react` | `Pixel`・`PixelStage`・`Dialogue`・`Curtain` の部品と、`useViewport`・`useSetting`・`useBgm`・`usePlayClock`・`useReveal`・`useCountUp`・`useBeat` のフック |
| `mojipx/styles.css` | 枠・ボタン・会話・幕・舞台の CSS。ゲームの CSS より先に読み込む |

## 使い方

### 絵と配色

絵は、1文字を1色に対応させた行の文字列で書く。`.` は透明である。

```ts
import type { Palette, Sprite } from 'mojipx';

export const PALETTE: Palette = { k: '#1a1c2c', w: '#f4f4f4', r: '#b13e53' };
export const HEART: Sprite = [
  '.kk.kk.',
  'krrkrrk',
  'krrrrrk',
  '.krrrk.',
  '..krk..',
  '...k...',
];
```

React の画面では、根で配色を渡し、`Pixel` で描く。

```tsx
import { PaletteProvider, Pixel } from 'mojipx/react';

<PaletteProvider palette={PALETTE}>
  <Pixel sprite={HEART} scale={4} title="体力" />
</PaletteProvider>;
```

`spriteProblems(sprite, palette)` は、行の長さのずれと配色にない文字を挙げる。絵のテストに使う。

### 窓の枠

```ts
import { frameUrl, installFrames } from 'mojipx';

installFrames({
  win: frameUrl('window', { O: '#1a1c2c', L: '#f4f4f4', F: '#26337a' }),
  'btn-yellow': frameUrl('button', { O: '#1a1c2c', H: '#fff6c8', F: '#ffcd75', S: '#f7a541' }),
  'btn-yellow-down': frameUrl('buttonDown', { O: '#1a1c2c', F: '#ffcd75', S: '#f7a541' }),
});
```

```css
.win { --px-frame: var(--frame-win); --px-fill: #26337a; }
.btn { --px-frame: var(--frame-btn-yellow); --px-frame-down: var(--frame-btn-yellow-down); --px-fill: #ffcd75; }
```

```tsx
<section className="px-frame win">…</section>
<button type="button" className="px-btn btn">はじめる</button>
```

### 舞台

`PixelStage` は、決まった大きさの点の画面を、親の大きさに合わせて拡大して描く。
描く関数は毎こま呼ばれ、描き直しのたびに最新のものに差し替わる。

```tsx
import { drawSpriteFoot } from 'mojipx';
import { PixelStage } from 'mojipx/react';

<PixelStage
  width={320}
  height={180}
  label="町の様子"
  fit={{ gutter: 20, shrink: viewport.layout === 'stack' }}
  draw={(ctx, { frame }) => {
    ctx.clearRect(0, 0, 320, 180);
    drawSpriteFoot(ctx, frame % 2 === 0 ? WALK_A : WALK_B, PALETTE, 160, 120);
  }}
>
  {(scale) => <span className="name" style={{ left: 160 * scale, top: 90 * scale }}>勇者</span>}
</PixelStage>;
```

`PixelFill` は、大きさを決めずに親を隙間なく覆う舞台である。
点の数は、短い辺がおよそ `short` 点になる整数の倍率で、親の大きさから決める（`fillSize`）。
描く関数は、3つ目の引数で今の舞台の大きさを受け取る。背景いっぱいに動く絵に使う。

```tsx
<PixelFill short={180} label="夜の町" draw={(ctx, { sec }, { width, height }) => drawTown(ctx, sec, width, height)} />
```

### 画面の大きさ

起動のときに `installViewport()` を呼ぶと、`<html>` に `data-layout`（`wide`・`stack`）・`data-orientation`・`data-pointer` が付く。
CSS はこの印で並べ方を変え、React の部品は `useViewport()` で同じ値を読む。
広い画面の下限は `installViewport({ wideMinWidth, wideMinHeight })` で変えられる。
積む画面の決まりは [docs/design.md#画面の大きさと端末](docs/design.md#画面の大きさと端末) にある。

### 音

```ts
import { createBgm, createSetting, createSfx, repeatBars, type Score } from 'mojipx';

const TITLE_SCORE: Score = {
  bpm: 120,
  beatsPerBar: 4,
  stepsPerBeat: 2,
  channels: [
    { voice: 'pulse', volume: 1, layer: 'both', bars: ['C5 - E5 - G5 - E5 -', 'F5 - A5 - G5 - - -'] },
    { voice: 'triangle', volume: 1, layer: 'both', bars: ['C3 - - - G2 - - -', 'F2 - - - G2 - - -'] },
  ],
  drums: [{ volume: 1, layer: 'both', bars: repeatBars(2, 'x.h.z.h.') }],
};

const sfx = createSfx({ select: [{ f: 988, at: 0, len: 0.05 }] }, createSetting('my-game:sound', false));
const bgm = createBgm({ title: TITLE_SCORE }, createSetting('my-game:bgm', false));
sfx.play('select');
```

画面では `useBgm(bgm, 'title')` で流す曲を伝え、`useSetting(bgm.setting)` で入り切りを読む。

曲を次々に流す画面では、`bgm.cue('next')` で次の曲を伝える。今の曲のループが終わったところで、継ぎ目なく替わる。
`bgm.position()` は、今聞こえている曲・刻み・終えたループの数・刻みの中の進み具合を返す。絵を拍に合わせて動かすのに使う。
`bgm.setVolume(0.5)` で大きさを変える。
タブが隠れている間は止める。音楽を聞かせるサイトのように流し続けたいときは、`createBgm(scores, setting, { pauseWhenHidden: false })` とする。
前奏を1度だけ流して、その後ろだけを繰り返す曲は、譜面に `loopFrom`（繰り返しの始まりの小節。0から数える）を書く。

譜面は小節ごとの文字列で書き、`stepsPerBeat` が 2 なら8分音符、4 なら16分音符を1刻みとする。

- 旋律・和音・低音は、空白で区切った1語が1刻みである。`C5`・`F#4`・`Bb3` は音の高さ、`E4+G4` は和音、`-` は前の音を伸ばし、`.` は休み。
- 太鼓は、1文字が1刻みである。`k` は大太鼓、`s` は小太鼓、`h` はハイハット、`H` はハイハットを2つ（刻みの頭と半ば）、`x` は大太鼓とハイハット、`z` は小太鼓とハイハット、`o` は開いたハイハット、`t` はタム、`.` は休み。
- `layer` は、`calm` なら落ち着いているときだけ、`intense` なら山場（`bgm.setIntensity(1)`）のときだけ、`both` ならいつも鳴らす。

音色（`voice`）は、`pulse`（幅25%のパルス波）・`pulse12`（幅12.5%）・`square`・`triangle`・`sine`・`saw` から選ぶ。
チャンネルには、ほかに次の値を書ける。

| 値 | 意味 |
|---|---|
| `envelope` | 音1つの大きさの動き。`hold`（既定。伸ばす間少しずつ弱める）・`pluck`（弾いた弦や木琴のようにすぐ減る）・`swell`（ゆっくりふくらむ） |
| `vibrato` | 長い音を、少し遅れてから揺らす幅（セント） |
| `pan` | 左右の位置。-1 が左、1 が右 |
| `echo` | やまびこに送る割合（0〜1） |

譜面には、ほかに `swing`（奇数の刻みを遅らせて跳ねさせる割合。0〜0.5）と、`echo`（`{ steps, feedback }`。何刻み遅れて、どれだけ弱まりながら繰り返すか）を書ける。

小節の長さが合わない譜面と、読めない語は、`compile` が例外にする。

### 保存

```ts
import { canStore, createStore } from 'mojipx';

const progress = createStore('my-game:save', parseSave); // parseSave は形が合わなければ null を返す
progress.save(state);
const saved = progress.load(); // ない・読めない・形が合わないときは null
```

## 確かめ方

| コマンド | 確かめること |
|---|---|
| `npm test` | DOM に触れない関数と、依存の向き |
| `npm run typecheck` | 型 |
| `npm run lint` | 書き方と整形（Biome） |
| `npm run build` | `dist/` に JavaScript・型の宣言・CSS を書き出せる |
| `cccc .` | 関数ごとの認知的複雑度と循環的複雑度が15以下か。[cccc](https://github.com/moznion/cccc) は別に入れる。上限は `cccc.toml` |

`main` への push と pull request では、GitHub Actions（`.github/workflows/ci.yml`）が表のコマンドをすべて通す。
`npm publish` は、`prepublishOnly` で lint・型・テストを通し、`prepare` で `dist/` を書き出してから配る。
`prepare` は GitHub から入れたときにも走るので、`npm install github:YuheiNakasaka/mojipx#<コミット>` でも使える。

## ライセンス

MIT
