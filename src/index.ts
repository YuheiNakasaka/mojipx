// パッケージの入口（docs/design.md#features）。React に依らない仕組みを出す。React の部品は ./react の入口にある。

export { type Bgm, type BgmOptions, createBgm } from './audio/bgm.ts';
export { audioContext, noiseOf, onFirstGesture } from './audio/context.ts';
export type { Envelope } from './audio/envelope.ts';
export {
  audible,
  type Channel,
  type Compiled,
  compile,
  type Drum,
  type DrumChannel,
  type DrumEvent,
  frequencyOf,
  type Layer,
  midiOf,
  type NoteEvent,
  repeatBars,
  type Score,
  stepSecOf,
  tokensOf,
  type Voice,
} from './audio/score.ts';
export { createSfx, type Sfx, type Tone } from './audio/sfx.ts';
export { advanceStep, type BgmPosition, positionAt, recentMarks, type StepMark } from './audio/transport.ts';
export { mixColor, tintedPalette } from './color.ts';
export {
  type Ctx,
  drawSprite,
  drawSpriteFoot,
  drawSpriteRising,
  type Facing,
  fillRect,
  hash2,
  type Point,
  pathLength,
  pointOnPath,
  strip,
} from './draw.ts';
export { type FillSize, type FitOptions, fillSize, fitScale, SHRINK_MIN } from './fit.ts';
export { FRAME_SHAPES, type FrameColors, type FrameRole, type FrameShape, frameUrl, installFrames } from './frame.ts';
export { prefersReducedMotion } from './motion.ts';
export { canvasOf } from './raster.ts';
export { createSetting, type Setting } from './setting.ts';
export {
  flipped,
  type Palette,
  type Recolor,
  type Run,
  runsOf,
  type Sprite,
  sizeOf,
  spriteProblems,
  svgOf,
  svgUrl,
  TRANSPARENT,
} from './sprite.ts';
export { canStore, createStore, type StorageLike, type StorageSource, type Store } from './storage.ts';
export { tickAt, tickStarts } from './timeline.ts';
export {
  type Breakpoints,
  classify,
  currentViewport,
  DEFAULT_BREAKPOINTS,
  installViewport,
  type Layout,
  type Orientation,
  type Pointer,
  type Viewport,
  watchViewport,
} from './viewport.ts';
