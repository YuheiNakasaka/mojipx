import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// 依存の向き（docs/design.md#境界）。エンジンのファイルは、エンジンの外のファイルを読まない。
// 読んでよい外のパッケージは、React と、テストのための Vitest と Node の標準の部品だけとする。
const SRC = dirname(fileURLToPath(import.meta.url));
const ALLOWED = [/^react$/, /^react\/jsx-runtime$/, /^vitest$/, /^node:/];

const filesOf = (dir: string): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesOf(join(dir, e.name)) : /\.(ts|tsx|css)$/.test(e.name) ? [join(dir, e.name)] : [],
  );
const importsOf = (code: string): readonly string[] =>
  [...code.matchAll(/(?:from\s+|import\s*\(\s*|import\s+|@import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1] as string);

describe('依存の向き', () => {
  const files = filesOf(SRC);
  it('エンジンのファイルを見つける', () => expect(files.length).toBeGreaterThan(10));
  it.each(files.map((f) => [relative(SRC, f), f]))('%s は、エンジンの外のファイルと、許したパッケージ以外を読まない', (_, file) => {
    const outside = importsOf(readFileSync(file, 'utf-8')).filter((spec) =>
      spec.startsWith('.') ? relative(SRC, resolve(dirname(file), spec)).startsWith('..') : !ALLOWED.some((re) => re.test(spec)),
    );
    expect(outside).toEqual([]);
  });
});
