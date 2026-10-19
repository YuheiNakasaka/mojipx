// ./react の入口（docs/design.md#features）。React の部品とフックを出す。

export { CURTAIN_MS, Curtain } from './Curtain.tsx';
export { Dialogue, type DialogueLine } from './Dialogue.tsx';
export { useBeat, useBgm, useCountUp, usePlayClock, useReveal, useSetting, useViewport } from './hooks.ts';
export { PaletteProvider, Pixel, usePalette } from './Pixel.tsx';
export { type DrawFill, type DrawStage, PixelFill, PixelStage, type StageClock, useFitScale } from './PixelStage.tsx';
