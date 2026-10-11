import { describe, expect, it, vi } from 'vitest';
import { createSetting } from './setting.ts';
import type { StorageLike } from './storage.ts';

const memory = (init: Record<string, string> = {}): StorageLike => {
  const data = new Map(Object.entries(init));
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const broken: StorageLike = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
  removeItem: () => {},
};

describe('createSetting', () => {
  it('覚えた値がなければ、初めの値', () => {
    expect(createSetting('s', false, () => memory()).get()).toBe(false);
    expect(createSetting('s', true, () => memory()).get()).toBe(true);
  });
  it('覚えた on・off を読む。初めの値より先に使う', () => {
    expect(createSetting('s', false, () => memory({ s: 'on' })).get()).toBe(true);
    expect(createSetting('s', true, () => memory({ s: 'off' })).get()).toBe(false);
  });
  it('変えると、値を on・off で覚え、見ている人に知らせる', () => {
    const s = memory();
    const setting = createSetting('s', false, () => s);
    const seen = vi.fn();
    setting.subscribe(seen);
    setting.set(true);
    expect(setting.get()).toBe(true);
    expect(s.getItem('s')).toBe('on');
    expect(seen).toHaveBeenCalledTimes(1);
  });
  it('見るのをやめた人には知らせない', () => {
    const setting = createSetting('s', false, () => memory());
    const seen = vi.fn();
    const stop = setting.subscribe(seen);
    stop();
    setting.set(true);
    expect(seen).not.toHaveBeenCalled();
  });
  it('置き場所が投げても、初めの値で始まり、変えた値はこの画面で効く', () => {
    const setting = createSetting('s', true, () => broken);
    expect(setting.get()).toBe(true);
    setting.set(false);
    expect(setting.get()).toBe(false);
  });
});
