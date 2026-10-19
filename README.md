# mojipx

A collection of building blocks for making browser games with a pixel-art look.
It covers drawing sprites, window frames, advancing dialogue, curtains, a canvas stage, sound, saving, a playback clock, and handling screen sizes.
You can build screens that are playable in desktop, tablet, and phone browsers.
The design is in [docs/design.md](docs/design.md).

## Install

```sh
npm install mojipx
```

Install `react` (18 or later) as well only if you use the React components.
Only ES modules are shipped.
The type declarations can be read by TypeScript 5.0 or later.

## Entry points

| Entry point | Contents |
|---|---|
| `mojipx` | Sprites, colors, frames, drawing tools, stage scaling math, viewport, storage, settings, clocks, and sound. Does not depend on React |
| `mojipx/react` | The `Pixel`, `PixelStage`, `Dialogue`, and `Curtain` components, and the `useViewport`, `useSetting`, `useBgm`, `usePlayClock`, `useReveal`, `useCountUp`, and `useBeat` hooks |
| `mojipx/styles.css` | CSS for frames, buttons, dialogue, curtains, and stages. Load it before the game's CSS |

## Usage

### Sprites and palettes

Write a sprite as rows of strings, with each character mapped to one color. `.` is transparent.

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

In React screens, pass the palette at the root and draw with `Pixel`.

```tsx
import { PaletteProvider, Pixel } from 'mojipx/react';

<PaletteProvider palette={PALETTE}>
  <Pixel sprite={HEART} scale={4} title="HP" />
</PaletteProvider>;
```

`spriteProblems(sprite, palette)` lists rows whose lengths don't match and characters missing from the palette. Use it in sprite tests.

### Window frames

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
<button type="button" className="px-btn btn">Start</button>
```

### Stage

`PixelStage` draws a fixed-size pixel screen, scaled up to fit its parent.
The draw function is called every frame, and each render replaces it with the latest one.

```tsx
import { drawSpriteFoot } from 'mojipx';
import { PixelStage } from 'mojipx/react';

<PixelStage
  width={320}
  height={180}
  label="Town view"
  fit={{ gutter: 20, shrink: viewport.layout === 'stack' }}
  draw={(ctx, { frame }) => {
    ctx.clearRect(0, 0, 320, 180);
    drawSpriteFoot(ctx, frame % 2 === 0 ? WALK_A : WALK_B, PALETTE, 160, 120);
  }}
>
  {(scale) => <span className="name" style={{ left: 160 * scale, top: 90 * scale }}>Hero</span>}
</PixelStage>;
```

`PixelFill` is a stage with no fixed size that covers its parent without gaps.
It derives its size in pixels from the parent's size, using the integer scale at which the shorter side is about `short` pixels (`fillSize`).
The draw function receives the current stage size as its third argument. Use it for pictures that move across the whole background.
Both stages accept `maxFps`, which caps how many times per second they draw. Use it on phones with high-refresh-rate screens to keep from draining the battery too fast.

```tsx
<PixelFill short={180} label="Town at night" draw={(ctx, { sec }, { width, height }) => drawTown(ctx, sec, width, height)} />
```

### Screen size

Call `installViewport()` at startup to set `data-layout` (`wide` or `stack`), `data-orientation`, and `data-pointer` on `<html>`.
CSS switches layouts on these attributes, and React components read the same values with `useViewport()`.
You can change the minimum size of the wide layout with `installViewport({ wideMinWidth, wideMinHeight })`.
The rules for stacked screens are in [docs/design.md#screen-size-and-devices](docs/design.md#screen-size-and-devices).

### Sound

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

In a screen, tell it which track to play with `useBgm(bgm, 'title')`, and read whether music is on with `useSetting(bgm.setting)`.

On screens that play tracks one after another, queue the next track with `bgm.cue('next')`. It switches seamlessly when the current track's loop ends.
`bgm.position()` returns the track currently heard, the step, the number of loops completed, and how far into the step it is. Use it to move pictures in time with the beat.
`bgm.setVolume(0.5)` changes the volume.
Playback pauses while the tab is hidden. To keep playing, as on a site meant for listening to music, use `createBgm(scores, setting, { pauseWhenHidden: false })`.
For a track that plays an intro once and then repeats only what follows, write `loopFrom` (the bar where the loop starts, counting from 0) in the score.

Scores are written as one string per bar. One step is an eighth note when `stepsPerBeat` is 2, and a sixteenth note when it is 4.

- For melody, chords, and bass, each space-separated word is one step. `C5`, `F#4`, and `Bb3` are pitches, `E4+G4` is a chord, `-` holds the previous note, and `.` is a rest.
- For drums, each character is one step. `k` is the kick, `s` the snare, `h` the hi-hat, `H` two hi-hats (at the start and middle of the step), `x` the kick and hi-hat, `z` the snare and hi-hat, `o` the open hi-hat, `t` the tom, and `.` a rest.
- `layer` set to `calm` plays only while things are calm, `intense` only at the climax (`bgm.setIntensity(1)`), and `both` all the time.

Choose the voice (`voice`) from `pulse` (25% pulse wave), `pulse12` (12.5%), `square`, `triangle`, `sine`, and `saw`.
Channels can also have the following values.

| Value | Meaning |
|---|---|
| `envelope` | How each note's loudness changes. `hold` (default; fades slowly while held), `pluck` (decays quickly, like a plucked string or a xylophone), or `swell` (swells slowly) |
| `vibrato` | How far to wobble long notes (in cents), starting after a short delay |
| `pan` | Left-right position. -1 is left, 1 is right |
| `echo` | How much to send to the echo (0–1) |

A score can also have `swing` (how far to delay the odd steps to make them bounce; 0–0.5), `echo` (`{ steps, feedback }`; how many steps later it repeats, and how much it fades each time), and `gain` (volume multiplier for the whole track; 0–2; used to even out loudness across tracks).

`compile` throws on scores whose bar lengths don't match and on words it cannot read.

### Storage

```ts
import { canStore, createStore } from 'mojipx';

const progress = createStore('my-game:save', parseSave); // parseSave returns null if the shape doesn't match
progress.save(state);
const saved = progress.load(); // null when missing, unreadable, or the wrong shape
```

## Verification

| Command | What it checks |
|---|---|
| `npm test` | Functions that don't touch the DOM, and the dependency direction |
| `npm run typecheck` | Types |
| `npm run lint` | Code style and formatting (Biome) |
| `npm run build` | JavaScript, type declarations, and CSS can be written to `dist/` |
| `cccc .` | Each function's cognitive and cyclomatic complexity is 15 or less. Install [cccc](https://github.com/moznion/cccc) separately. The limits are in `cccc.toml` |

On pushes to `main` and on pull requests, GitHub Actions (`.github/workflows/ci.yml`) runs every command in the table.
`npm publish` runs lint, type checks, and tests in `prepublishOnly`, and writes `dist/` in `prepare` before publishing.
`prepare` also runs when installing from GitHub, so `npm install github:YuheiNakasaka/mojipx#<commit>` works too.

## License

MIT
