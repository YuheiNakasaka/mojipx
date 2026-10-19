# mojipx design

This document sets out the design of mojipx (hereafter "the engine"), a collection of building blocks for making browser games with a pixel-art look.
Its readers are the people who build and fix the engine, and the people who make games with it.

## Purpose

Stop rebuilding sprite drawing, window frames, dialogue advancing, canvas scaling, sound, and saving for every pixel-art game.
Gather the mechanisms that don't depend on a game's content into one package, in a form any game can use as is.

## Requirements

| Item | Decision |
|---|---|
| Capabilities | Has the mechanisms listed in [Features](#features) |
| Devices | Can build screens playable in desktop, tablet, and phone browsers, in both portrait and landscape |
| Input | Mouse, keyboard, and touch. Never makes information that you can only find by hovering the mouse |
| Motion | For users who prefer reduced motion, can stop animations and show their final state |
| Dependencies | Runs on standard browser features alone. The React components live in a separate entry point, and React is an optional dependency |
| Game-agnostic | Holds no game rules, text, sprite content, or colors. All of them come from the game |
| Code style | Written with functional domain modeling. Types are expressed with discriminated unions and readonly, and classes are not used |

## Boundary

The engine is a standalone npm package.
A game lists this package as a dependency and imports it.

Dependencies point one way only: from the game to the engine.
Engine files (under `src/`) don't import files outside the engine.
The only outside package they may import is React (tests also import Vitest and Node's built-in modules).
An engine unit test (`src/boundary.test.ts`) enforces this rule by checking the imports of every engine file.
The direction is enforced by rule so that the engine never comes to rely on something in one game and then fails to work in other games.

The engine and the game split responsibilities as follows.

| Mechanism | Engine | Game |
|---|---|---|
| Pixel art | Turns row-string sprites into rects, SVG, and canvases. Recoloring | Sprite content and palettes |
| Window frames | The 9-slice frame shapes, the mechanism that puts frames into CSS variables, and the CSS that uses frames | Frame colors and the names of window kinds |
| Dialogue | A window that shows text one character at a time and advances on press | Speakers, faces, and lines |
| Curtain | The opening and closing curtain animations | The card shown on the curtain |
| Stage | Scales a fixed-size pixel screen to fit its parent and draws it every frame. A DOM layer on top | What to draw on the stage, and the name tags on top |
| Drawing tools | Rects, sprite placement, sprites that grow from the bottom, thick lines, color mixing, deterministic random numbers | How to draw things and people |
| Sound | SFX tone lists, reading and playing BGM scores, and the on/off setting | The content of the SFX and tracks |
| Storage | localStorage reads and writes that never throw, and loading through a shape check | The shape of saved values and their check |
| Clock | A playback clock that hands out time by tick weight, and a reveal that shows items one at a time | The number of ticks and the highlights |
| Screen size | Detecting the viewport, attributes on the root element, and touch handling | The layout for each viewport |

## Features

The engine has three entry points.

| Entry point | Contents | DOM |
|---|---|---|
| `mojipx` | Sprites, colors, frames, drawing tools, stage scaling math, viewport, storage, clock, and sound | Has both functions that touch it and ones that don't. The ones that don't also run on Node |
| `mojipx/react` | Sprite, stage, dialogue, and curtain components, and hooks for the viewport, settings, and clocks | Touches it |
| `mojipx/styles.css` | CSS for frames, buttons, dialogue, curtains, and stages, plus a base for drawing pixel art (it stops the color overlay on tap and the text enlargement in landscape) | – |

### Pixel art

A sprite (`Sprite`) is written as an array of row strings, with each character mapped to one color.
`.` is transparent.
A palette (`Palette`) maps characters to colors, and the game provides it.
A recolor (`Recolor`) swaps some of the palette's characters to other colors.
This lets a character's hair or clothes change color while keeping the same sprite.

| Function | What it does |
|---|---|
| `sizeOf` | The sprite's width and height |
| `flipped` | The sprite mirrored left to right |
| `runsOf` | Merges horizontal runs of same-colored pixels into single rects |
| `svgOf`, `svgUrl` | Turns a sprite into an SVG string and a CSS `url()` |
| `canvasOf` | Turns a sprite into a canvas at 1x. Builds it only once per combination of sprite, palette, and recolor |
| `spriteProblems` | Lists rows whose lengths don't match and characters missing from the palette. Used to check sprites |

### Window frames

Frames for windows, paper, speech bubbles, and buttons are 12×12 sprites cut into nine 4-pixel pieces and stretched with CSS `border-image`.
Frame shapes (`FRAME_SHAPES`) are written with role characters instead of colors.

| Character | Role |
|---|---|
| `O` | Outline |
| `L` | Light edge color |
| `F` | Fill |
| `H` | Light color on the top of a button |
| `S` | Shadow under a button, shadow of paper |

The game builds a frame image from a shape and colors for its roles with `frameUrl`, and puts it into the root element's CSS variable `--frame-<name>` with `installFrames`.
The CSS class `.px-frame` draws a box with the `--px-frame` frame and the `--px-fill` fill.
`.px-btn` also uses `--px-frame-down`, the frame while pressed, and `--px-frame-disabled`, the frame when it can't be pressed.
Window kinds (such as the game's `.win`) are made by the game's CSS setting these variables.

### Stage

A stage (`PixelStage`) is a pixel screen of a fixed size (the game decides it, for example 320 wide and 180 tall).
It draws on a canvas at 1x and scales it up with CSS.
The scale is the largest value that fits in the parent, rounded by the following rules (`fitScale`).

| Scale that fits | Rounding |
|---|---|
| 2 or more | Round down to an integer |
| At least 1 and under 2 | Round down to a multiple of 0.5 |
| Under 1 | If shrinking is allowed, the value as is (minimum 0.5). Otherwise 1 |

Large scales are integers so that all pixels come out the same size.
Scales under 1 are allowed so that a wider stage fits the width of a phone in portrait (about 360–430 px).
Phone screens draw one CSS pixel with 2–3 device pixels, so pixels keep their shape almost intact even below 1x.
The game decides whether to shrink, based on the viewport.

The scaling options (`FitOptions`) also have the following values.

| Value | Meaning |
|---|---|
| `gutter` | Margin (px) subtracted from the parent's size |
| `max` | The largest allowed scale. Used for stages that shouldn't grow beyond 1x, such as small illustrations |
| `height` | Height (px) used instead of the parent's height |

`height` exists for screens that scroll vertically.
On such screens the stage's height sets the parent's height, so fitting to the parent's height makes the stage keep shrinking.
The game passes a value derived from the screen's height.

The stage calls the draw function on every `requestAnimationFrame`.
The draw function receives the animation frame number (4 frames per second by default) and the elapsed seconds.
For still stages and for users who prefer reduced motion, it draws once and stops.
Each render replaces the draw function with the latest one.
This keeps per-frame drawing outside React, so the screen's components aren't re-rendered every frame.

A DOM layer sits on top of the canvas.
It holds things people should read as text, such as name tags and markers, and things they should press.
Elements in the layer are positioned by multiplying the stage's pixel coordinates by the scale.
The root element's class can also be given as a function that receives the scale.
Use it for switches such as tightening the name-tag text only when the stage is drawn small.

The fill stage (`PixelFill`) is a stage without a fixed size.
It picks the integer scale at which the shorter side is about a chosen number of pixels (for example 180), and sets its size in pixels so that it covers the parent without gaps (`fillSize`).
It overflows the parent by fewer px than the scale, and the parent clips the overflow.
It exists for screens that want the drawn area to follow the screen's aspect ratio, such as pictures that move across the whole background.

### Dialogue and curtain

The dialogue window (`Dialogue`) shows text one character at a time.
Pressing it, Enter, or Space moves it through these steps in order: show the whole line, go to the next line, and finish.
The game passes the speaker's name and face for each line.
It has callbacks so the game can play a sound each time a character appears and each time a line advances.

The curtain (`Curtain`) has an opening animation, in which the left and right curtains part, and a closing animation.
The game can show a card on top of the curtain.

### Sound

SFX and BGM are synthesized with Web Audio, so there are no sound files.
BGM voices are built around the sounds of old game consoles (pulse, square, and triangle waves, and noise), plus sine and sawtooth waves that lean toward the 16-bit era.
Note envelopes (pluck, swell), vibrato, pan, echo, and swing are set by values written in the score (the notation is in the README).
Both have an on/off setting (`createSetting`) that the browser remembers.
The game decides the initial value.

| Mechanism | What it does |
|---|---|
| `createSfx` | Builds SFX that play by name from a table of tone lists (frequency, start, length, waveform, volume). Frequency 0 is noise |
| `compile` | Turns a score written as one string per bar into a list of notes per step. Doesn't touch the DOM |
| `createBgm` | Builds a player that plays a track per scene from a table of scores. Lookahead scheduling, climax intensity, seamless switching, pausing while the tab is hidden (can be turned off), resuming on the first user action, and volume |
| `cue`, `position` | Switch to the next track at the end of the current track's loop. Work out the track and step currently heard from the scheduled step markers (`StepMark`) and the time (`positionAt`). For screens that play tracks one after another and screens that sync pictures to the beat |

The score notation is in [Sound in the README](../README.md#sound).

### Storage

`createStore` keeps one JSON value under one key.
Values it reads go through a check function the game provides.
Values that are missing, unreadable, or the wrong shape are treated as missing.
localStorage can throw on any read or write, for example when the browser is set to block site data.
None of the functions throw.
`canStore` checks whether this browser allows saving.

### Clock

This is for screens that play back a fixed number of ticks over a fixed duration, such as replaying a match record.

| Mechanism | What it does |
|---|---|
| `tickStarts` | Sets the start time of each tick from per-tick weights. Heavier ticks pass more slowly |
| `tickAt` | Which tick an elapsed time falls in |
| `usePlayClock` | Advances the elapsed time. The speed can be changed, and it can be skipped |
| `useReveal` | Shows items one at a time at a fixed interval. Pressing shows them all |

## Screen size and devices

### Viewport

The engine determines the viewport (`Viewport`) from the screen size and the kind of input.

| Value | How it is decided |
|---|---|
| `layout` | `wide` if both width and height are at least the wide layout's minimum (1000 wide and 600 tall by default), otherwise `stack` |
| `orientation` | `landscape` if the width is at least the height, otherwise `portrait` |
| `pointer` | `coarse` if the primary input is a finger (CSS `pointer: coarse`), otherwise `fine` |

`installViewport` sets `data-layout`, `data-orientation`, and `data-pointer` on the root element (`<html>`), and sets them again whenever the screen size changes.
The game's CSS switches layouts on these attributes.
React components read the same values with `useViewport`.
This is because writing the breakpoints separately in CSS media queries and in JavaScript lets them drift apart.

Devices map to viewports as follows.

| Device | Orientation | Example viewport |
|---|---|---|
| Desktop | – | `wide`, `fine`. `stack` when the window is narrowed |
| Tablet | Landscape | `wide`, `coarse` |
| Tablet | Portrait | `stack`, `coarse` |
| Phone | Portrait, landscape | `stack`, `coarse` |

### Rules for stacked screens

These are the rules a game follows on `stack` screens.
The engine's CSS and components are built so that these rules can be followed.

- Stack the screen in a single column; vertical scrolling is fine. Never scroll horizontally.
- Measure height with `100dvh`, so the screen doesn't shift when the phone browser's toolbars appear and disappear.
- Keep the screen's edges clear of notches and rounded corners (`env(safe-area-inset-*)`).
- Main action buttons may be fixed to the bottom of the screen.
- Fit the stage to the width, shrinking it below 1x too. Derive its height from the screen's height, not the parent's ([Stage](#stage)).
- When the screen changes, show it from the top.

### Touch

- Make anything pressable at least 44 px wide and 44 px tall.
- Never put information only behind a mouse hover. Use `title` only as a supplement, and show the same thing on press or focus too.
- Respond to presses right away. Give buttons `touch-action: manipulation` so double-tap zoom doesn't add a delay.
- Never require long presses or swipes to move forward.

## Verification

| What to check | How |
|---|---|
| Functions that don't touch the DOM | Engine unit tests (Vitest, Node) |
| Dependency direction | Engine unit test (`src/boundary.test.ts`) |
| Components and viewports | End-to-end checks of the screens of games that use the engine (Playwright or similar), at desktop, tablet landscape and portrait, and phone portrait and landscape sizes. Not kept inside the engine |
| Publishability | `npm run build` writes JavaScript, type declarations, and CSS to `dist/`. `npm pack --dry-run` shows what goes into the package |
| Per-function complexity | [cccc](https://github.com/moznion/cccc) checks that each function's cognitive and cyclomatic complexity is 15 or less. The limits are in `cccc.toml`, and tests aren't measured |

On pushes to `main` and on pull requests, GitHub Actions runs lint, type checks, tests, the build, and the complexity check.
cccc isn't an npm package, so it isn't in `prepublishOnly`; CI enforces it instead.

## Distribution

Only ES modules are shipped.
The `exports` in `package.json` point to the JavaScript, type declarations, and CSS in `dist/`.
`dist/` isn't committed to Git; `prepare` writes it before `npm pack`, `npm publish`, and `npm install` from GitHub.
This lets games that want changes not yet published to npm install the engine by pointing at a commit.
Before `npm publish`, `prepublishOnly` runs lint, type checks, and tests.
The package contains `dist/`, `docs/`, `README.md`, and `LICENSE`, but not the TypeScript sources or tests.
Dependencies needed to develop the engine (TypeScript, Vitest, Biome, type declarations, React) are listed in `devDependencies`.
React is listed in `peerDependencies` and marked optional, for games that don't use the React components.
The license is MIT.

## Open questions

- How to number versions.
