// 会話の窓のキー（docs/design.md#dialogue-and-curtain）。DOM に触れずに、押されたキーで窓を進めるかを決める。
// 窓は焦点に依らず文書全体のキーを受けるので、文字を打つ欄と、修飾キー付きの押下（ブラウザーの操作）は受けない。

/** 押されたキー。KeyboardEvent から、決めるのに要るものだけを写す。 */
export type KeyPress = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  /** 押したままで繰り返し来た押下 */
  readonly repeat: boolean;
  /** 押下を受けた要素が、文字を打てる欄か（isEditable） */
  readonly editable: boolean;
};

/** 会話の窓を進めるキー。→ ・Enter・Space。 */
export const DIALOGUE_KEYS: readonly string[] = ['ArrowRight', 'Enter', ' '];

/** 会話の窓を進める押下か。押したままの繰り返しは受けない（1回押すと1つ進む）。 */
export const advancesDialogue = (k: KeyPress): boolean =>
  DIALOGUE_KEYS.includes(k.key) && !k.ctrlKey && !k.metaKey && !k.altKey && !k.repeat && !k.editable;

/** 押下を受けた要素の形。DOM の要素はこの形を満たす。 */
export type KeyTarget = { readonly tagName?: string; readonly isContentEditable?: boolean } | null;

const EDITABLE_TAGS: readonly string[] = ['INPUT', 'TEXTAREA', 'SELECT'];

/** 文字を打てる欄か（input・textarea・select・contenteditable）。 */
export const isEditable = (target: KeyTarget): boolean =>
  target !== null && (EDITABLE_TAGS.includes((target.tagName ?? '').toUpperCase()) || target.isContentEditable === true);

/** 開いている窓の並び。最後に開いた窓だけがキーを受ける。 */
export type WindowStack = {
  /** 窓を開き、その窓の番号を返す */
  readonly open: () => number;
  readonly close: (id: number) => void;
  /** キーを受ける窓（最後に開いた窓）の番号。窓が無ければ null */
  readonly top: () => number | null;
};

export const createWindowStack = (): WindowStack => {
  let next = 0;
  let open: readonly number[] = [];
  return {
    open: () => {
      next += 1;
      open = [...open, next];
      return next;
    },
    close: (id) => {
      open = open.filter((x) => x !== id);
    },
    top: () => open.at(-1) ?? null,
  };
};
