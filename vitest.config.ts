import { defineConfig } from 'vitest/config';

// DOM に触れない関数を Node で試す（docs/design.md#確かめ方）。
export default defineConfig({
  test: { name: 'engine', include: ['src/**/*.test.ts'] },
});
