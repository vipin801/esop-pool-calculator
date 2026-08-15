/**
 * `src/lib/esop` is the engine. It is pure TypeScript: functions of their
 * arguments, no framework, no rendering, no clock, no I/O.
 *
 * That is worth a test rather than a convention, because the first React import
 * to land here is the one that makes the engine untestable outside a component
 * tree, and it will arrive as a small convenience.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ENGINE_DIR = join(process.cwd(), 'src', 'lib', 'esop');

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() ? [path] : [];
  });
}

const FILES = sourceFiles(ENGINE_DIR);

const IMPORT_PATTERN = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

const BANNED_MODULE = /^(react|react-dom|next)(\/|$)/;

describe('the engine is a pure library', () => {
  it('has files to check', () => {
    expect(FILES.length).toBeGreaterThan(5);
  });

  it('holds only .ts files, so nothing here can render', () => {
    for (const file of FILES) {
      expect(file.endsWith('.ts'), `${relative(ENGINE_DIR, file)} is not a .ts file`).toBe(true);
    }
  });

  it('imports neither React nor Next', () => {
    for (const file of FILES) {
      const source = readFileSync(file, 'utf8');

      for (const match of source.matchAll(IMPORT_PATTERN)) {
        const specifier = match[1] ?? '';
        expect(
          BANNED_MODULE.test(specifier),
          `${relative(ENGINE_DIR, file)} imports ${specifier}`,
        ).toBe(false);
      }
    }
  });

  it('carries no client or server directive', () => {
    for (const file of FILES) {
      const source = readFileSync(file, 'utf8');

      expect(source, `${relative(ENGINE_DIR, file)} has a runtime directive`).not.toMatch(
        /^\s*['"]use (client|server)['"]/m,
      );
    }
  });
});
