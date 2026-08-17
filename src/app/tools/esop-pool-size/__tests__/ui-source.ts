/**
 * Shared source-reading helpers for the UI quality checks.
 *
 * These tests read the route's own source rather than a rendered tree. The
 * suite runs in `node` with no DOM and no testing-library, and — more to the
 * point — the rules being enforced here (copy budget, one formatter per
 * chart, no half-transparent disabled labels) are properties of the source. A
 * rendered assertion would pass on the one state it renders and say nothing
 * about the other fifteen.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROUTE_DIR = fileURLToPath(new URL('..', import.meta.url));
export const APP_DIR = fileURLToPath(new URL('../../..', import.meta.url));

export interface SourceFile {
  readonly path: string;
  readonly rel: string;
  readonly text: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

/** `rel` is always `/dir/File.tsx`, on Windows too, so the assertions below
 *  can name a file without caring which separator the platform uses. */
export function sourceFiles(exts: readonly string[], root = ROUTE_DIR): readonly SourceFile[] {
  return walk(root)
    .filter((p) => exts.some((e) => p.endsWith(e)))
    .map((p) => ({
      path: p,
      rel: `/${relative(root, p).replace(/\\/g, '/')}`,
      text: readFileSync(p, 'utf8'),
    }));
}

/** The files a founder actually looks at: components, not the PDF renderer. */
export function onScreenFiles(): readonly SourceFile[] {
  return sourceFiles(['.tsx']).filter((f) => !f.rel.includes('/report'));
}

/** Strip block and line comments so a comment's prose is not audited as copy. */
export function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * JSX text runs: the characters between `>` and `<` that are not inside a
 * `{...}` expression. Interpolations collapse to one placeholder word, which
 * is the honest count — a rendered `{formatShares(n)}` is one number on the
 * page.
 */
export function jsxTextRuns(text: string): readonly string[] {
  const withoutExpressions = text.replace(/\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, ' X ');
  const runs: string[] = [];

  for (const match of withoutExpressions.matchAll(/>([^<>]+)</g)) {
    const run = (match[1] ?? '').replace(/\s+/g, ' ').trim();
    if (run && !looksLikeCode(run)) runs.push(run);
  }
  return runs;
}

/**
 * `>` and `<` also appear in generics, arrows and comparisons, so the run
 * scanner picks up stretches of TypeScript between them. Prose in this app
 * never contains a semicolon, a brace, an equals sign or a statement keyword;
 * code between two angle brackets essentially always does.
 */
function looksLikeCode(run: string): boolean {
  return /[;{}=]|=>|\b(const|let|function|return|import|export|interface|type|await|async)\b/.test(run);
}

/**
 * Prose passed as a prop. `className` and friends are excluded by name rather
 * than by a shape heuristic, because a Tailwind class list and a sentence
 * both look like lowercase words separated by spaces.
 */
const PROSE_PROPS = ['caption', 'helper', 'note', 'title', 'label', 'description', 'placeholder', 'finding', 'action'];

export function prosePropValues(text: string): readonly string[] {
  const out: string[] = [];
  for (const prop of PROSE_PROPS) {
    for (const match of text.matchAll(new RegExp(`\\b${prop}=(?:"([^"]*)"|'([^']*)'|\\{\`([^\`]*)\`\\})`, 'g'))) {
      const value = match[1] ?? match[2] ?? match[3];
      if (value) out.push(value);
    }
    for (const match of text.matchAll(new RegExp(`\\b${prop}:\\s*(?:'([^']*)'|"([^"]*)"|\`([^\`]*)\`)`, 'g'))) {
      const value = match[1] ?? match[2] ?? match[3];
      if (value) out.push(value);
    }
  }
  return out;
}

/** Words, with `${...}` interpolations counted as the one word they render. */
export function wordCount(copy: string): number {
  return copy
    .replace(/\$\{[^}]*\}/g, ' X ')
    .replace(/&[a-z]+;/g, 'x')
    .split(/\s+/)
    .filter(Boolean).length;
}
