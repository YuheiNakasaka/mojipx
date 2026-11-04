// 会話の窓の言葉（docs/design.md#dialogue-and-curtain）。読み上げの文と、何行目かの書き方を、ゲームの言語に合わせて選ぶ。
// 行の文と話す人の名前はゲームが渡すので、ここには窓の操作の案内と区切りだけを置く。

/** 会話の窓の読み上げの文と、何行目かの書き方。 */
export type DialogueWording = {
  /** 窓の読み上げの文。label は窓の名前、text は行の文、name は話す人（語りの行では undefined）。 */
  readonly ariaLabel: (label: string, text: string, name?: string) => string;
  /** 何行目か。at は1から数える。 */
  readonly count: (at: number, total: number) => string;
};

/** 日本語（既定）。例: 面談。高瀬「こんにちは」。押すか、→・Enter・Space で次へ ／ 1／5 */
export const DIALOGUE_JA: DialogueWording = {
  ariaLabel: (label, text, name) => `${label}。${name ? `${name}「${text}」` : text}。押すか、→・Enter・Space で次へ`,
  count: (at, total) => `${at}／${total}`,
};

/** 英語。例: Meeting. Takase: "Hello." Press, or use →, Enter, or Space to continue. ／ 1/5 */
export const DIALOGUE_EN: DialogueWording = {
  ariaLabel: (label, text, name) => `${label}. ${name ? `${name}: "${text}"` : text} Press, or use →, Enter, or Space to continue.`,
  count: (at, total) => `${at}/${total}`,
};
