import { describe, expect, it } from 'vitest';
import { canStore, createStore, type StorageLike } from './storage.ts';

const memory = (): StorageLike & { readonly data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};
const broken: StorageLike = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
  removeItem: () => {
    throw new Error('denied');
  },
};
const isCount = (x: unknown): { n: number } | null =>
  typeof x === 'object' && x !== null && typeof (x as { n?: unknown }).n === 'number' ? { n: (x as { n: number }).n } : null;

describe('createStore', () => {
  it('保存した値を、検査を通して読む', () => {
    const s = memory();
    const store = createStore('k', isCount, () => s);
    store.save({ n: 3 });
    expect(s.data.get('k')).toBe('{"n":3}');
    expect(store.load()).toEqual({ n: 3 });
  });
  it('保存がなければ null', () => expect(createStore('k', isCount, () => memory()).load()).toBeNull());
  it('JSON として読めなければ null', () => {
    const s = memory();
    s.setItem('k', '{');
    expect(createStore('k', isCount, () => s).load()).toBeNull();
  });
  it('形が合わなければ null', () => {
    const s = memory();
    s.setItem('k', '{"n":"3"}');
    expect(createStore('k', isCount, () => s).load()).toBeNull();
  });
  it('消すと、保存がない状態に戻る', () => {
    const s = memory();
    const store = createStore('k', isCount, () => s);
    store.save({ n: 1 });
    store.clear();
    expect(store.load()).toBeNull();
  });
  it('置き場所が読み書きのたびに投げても、どの関数も投げない', () => {
    const store = createStore('k', isCount, () => broken);
    expect(store.load()).toBeNull();
    expect(() => store.save({ n: 1 })).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });
  it('置き場所そのものを取り出せなくても投げない', () => {
    const store = createStore('k', isCount, () => {
      throw new Error('no storage');
    });
    expect(store.load()).toBeNull();
    expect(() => store.save({ n: 1 })).not.toThrow();
  });
});

describe('canStore', () => {
  it('書いて消せるなら true で、確かめたキーを残さない', () => {
    const s = memory();
    expect(canStore('probe', () => s)).toBe(true);
    expect(s.data.size).toBe(0);
  });
  it('書けなければ false', () => expect(canStore('probe', () => broken)).toBe(false));
});
