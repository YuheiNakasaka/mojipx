import { describe, expect, it } from 'vitest';
import { classify, DEFAULT_BREAKPOINTS } from './viewport.ts';

describe('classify', () => {
  it('横と縦がどちらも下限以上なら、広い画面', () => {
    expect(classify(1280, 800, false).layout).toBe('wide');
    expect(classify(DEFAULT_BREAKPOINTS.wideMinWidth, DEFAULT_BREAKPOINTS.wideMinHeight, false).layout).toBe('wide');
  });
  it('横か縦のどちらかが下限より狭ければ、積む画面', () => {
    expect(classify(999, 800, false).layout).toBe('stack');
    expect(classify(1280, 599, false).layout).toBe('stack');
    expect(classify(390, 844, true).layout).toBe('stack');
    expect(classify(844, 390, true).layout).toBe('stack');
  });
  it('横が縦以上なら横向き、それ以外は縦向き', () => {
    expect(classify(844, 390, true).orientation).toBe('landscape');
    expect(classify(600, 600, true).orientation).toBe('landscape');
    expect(classify(390, 844, true).orientation).toBe('portrait');
  });
  it('主な入力が指なら coarse、それ以外は fine', () => {
    expect(classify(1180, 820, true).pointer).toBe('coarse');
    expect(classify(1180, 820, false).pointer).toBe('fine');
  });
  it('広い画面の下限は、ゲームが変えられる', () =>
    expect(classify(1100, 800, false, { wideMinWidth: 1200, wideMinHeight: 600 }).layout).toBe('stack'));
  it('大きさは、そのまま返す', () => expect(classify(390, 844, true)).toMatchObject({ width: 390, height: 844 }));
});
