import { describe, expect, it } from 'vitest';
import { DIALOGUE_EN, DIALOGUE_JA } from './dialogue.ts';

describe('会話の窓の言葉', () => {
  it('日本語は、窓の名前・話す人・文を「。」と「」でつなぎ、操作の案内を足す（今までと同じ）', () => {
    expect(DIALOGUE_JA.ariaLabel('面談', 'こんにちは', '高瀬')).toBe('面談。高瀬「こんにちは」。押すか、→・Enter・Space で次へ');
    expect(DIALOGUE_JA.ariaLabel('序章', '2026年6月。')).toBe('序章。2026年6月。。押すか、→・Enter・Space で次へ');
    expect(DIALOGUE_JA.count(1, 5)).toBe('1／5');
  });

  it('英語は、話す人をコロンと引用符で示し、何行目かを半角の / で書く', () => {
    expect(DIALOGUE_EN.ariaLabel('Meeting', 'Hello.', 'Takase')).toBe(
      'Meeting. Takase: "Hello." Press, or use →, Enter, or Space to continue.',
    );
    expect(DIALOGUE_EN.ariaLabel('Prologue', 'June 2026.')).toBe('Prologue. June 2026. Press, or use →, Enter, or Space to continue.');
    expect(DIALOGUE_EN.count(1, 5)).toBe('1/5');
  });

  it('英語の言葉に日本語の文字を使わない', () => {
    const japanese = /[　-〿぀-ヿ㐀-鿿＀-￯]/;
    expect(DIALOGUE_EN.ariaLabel('a', 'b', 'c')).not.toMatch(japanese);
    expect(DIALOGUE_EN.count(2, 3)).not.toMatch(japanese);
  });
});
