import { describe, expect, it } from 'vitest';
import { advancesDialogue, createWindowStack, isEditable, type KeyPress } from './keys.ts';

const press = (key: string, more: Partial<KeyPress> = {}): KeyPress => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  editable: false,
  ...more,
});

describe('会話の窓を進めるキー', () => {
  it.each(['ArrowRight', 'Enter', ' '])('%j で進む', (key) => expect(advancesDialogue(press(key))).toBe(true));

  it.each(['ArrowLeft', 'ArrowDown', 'Escape', 'Tab', 'n', '1'])('%j では進まない', (key) =>
    expect(advancesDialogue(press(key))).toBe(false),
  );

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
    ['Alt', { altKey: true }],
  ] as const)('%s を押しながらでは進まない（ブラウザーの操作）', (_, more) => expect(advancesDialogue(press('Enter', more))).toBe(false));

  it('押したままの繰り返しでは進まない', () => expect(advancesDialogue(press('ArrowRight', { repeat: true }))).toBe(false));

  it('文字を打つ欄では進まない', () => expect(advancesDialogue(press('Enter', { editable: true }))).toBe(false));
});

describe('文字を打てる欄', () => {
  it.each(['INPUT', 'TEXTAREA', 'SELECT', 'input'])('%s は打てる欄', (tagName) => expect(isEditable({ tagName })).toBe(true));
  it('contenteditable の要素は打てる欄', () => expect(isEditable({ tagName: 'DIV', isContentEditable: true })).toBe(true));
  it.each(['BUTTON', 'DIV', 'BODY'])('%s は打てる欄でない', (tagName) => expect(isEditable({ tagName })).toBe(false));
  it('要素が無ければ打てる欄でない', () => expect(isEditable(null)).toBe(false));
});

describe('開いている窓の並び', () => {
  it('窓が無ければ、キーを受ける窓は無い', () => expect(createWindowStack().top()).toBeNull());

  it('最後に開いた窓だけがキーを受ける', () => {
    const s = createWindowStack();
    const a = s.open();
    const b = s.open();
    expect(s.top()).toBe(b);
    expect(s.top()).not.toBe(a);
  });

  it('後の窓を閉じると、前の窓がキーを受ける', () => {
    const s = createWindowStack();
    const a = s.open();
    const b = s.open();
    s.close(b);
    expect(s.top()).toBe(a);
  });

  it('前の窓を先に閉じても、後の窓がキーを受けたまま', () => {
    const s = createWindowStack();
    const a = s.open();
    const b = s.open();
    s.close(a);
    expect(s.top()).toBe(b);
    s.close(b);
    expect(s.top()).toBeNull();
  });

  it('同じ窓を開き直すと、別の番号になる（閉じた番号を使い回さない）', () => {
    const s = createWindowStack();
    const a = s.open();
    s.close(a);
    expect(s.open()).not.toBe(a);
  });
});
