// ブラウザーへの保存（docs/design.md#storage）。1つのキーに JSON の値を1件置き、読んだ値はゲームの検査を通す。
// localStorage は、サイトのデータを拒む設定などで、読み書きのたびに投げることがある。どの関数も投げない。

/** 保存の置き場所。既定は localStorage。テストでは Map で作った置き場所を渡せる。 */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type StorageSource = () => StorageLike;

const local: StorageSource = () => localStorage;

export type Store<T> = {
  /** 保存を読む。ない、読めない、形が合わないときは null。 */
  readonly load: () => T | null;
  /** 保存する。保存できなくても遊び続けられるよう、失敗は無視する。 */
  readonly save: (value: T) => void;
  /** 保存を消す。 */
  readonly clear: () => void;
};

/** key に値を1件置く保存。parse は読んだ JSON の値を検査し、形が合わなければ null を返す。 */
export function createStore<T>(key: string, parse: (raw: unknown) => T | null, storage: StorageSource = local): Store<T> {
  return {
    load: () => {
      try {
        const raw = storage().getItem(key);
        return raw === null ? null : parse(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    save: (value) => {
      try {
        storage().setItem(key, JSON.stringify(value));
      } catch {
        // 保存できないことは、canStore で確かめて知らせる
      }
    },
    clear: () => {
      try {
        storage().removeItem(key);
      } catch {
        // 消せなくても遊び続けられる
      }
    },
  };
}

/** このブラウザーが保存を許すか。probe のキーに書いて消してみる。 */
export function canStore(probe: string, storage: StorageSource = local): boolean {
  try {
    const s = storage();
    s.setItem(probe, '1');
    s.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
