// 入り切りの設定（docs/design.md#sound）。BGM や効果音の入り切りを、ブラウザーに 'on'・'off' の文字で覚えておく。
// 読めない環境では、初めの値のまま動く。React の画面は ./react の入口の useSetting で読む。
import type { StorageSource } from './storage.ts';

export type Setting = {
  readonly get: () => boolean;
  /** 値を変え、覚えておき、見ている人に知らせる。保存できなくても、この画面では切り替える。 */
  readonly set: (next: boolean) => void;
  /** 値が変わるたびに呼ぶ。止める関数を返す。 */
  readonly subscribe: (listener: () => void) => () => void;
};

const local: StorageSource = () => localStorage;

/** key に覚える入り切りの設定。覚えた値がなければ initial。 */
export function createSetting(key: string, initial: boolean, storage: StorageSource = local): Setting {
  let value = (() => {
    try {
      const raw = storage().getItem(key);
      return raw === null ? initial : raw === 'on';
    } catch {
      return initial;
    }
  })();
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      value = next;
      try {
        storage().setItem(key, next ? 'on' : 'off');
      } catch {
        // 保存できなくても、この画面では切り替える
      }
      for (const l of listeners) l();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
