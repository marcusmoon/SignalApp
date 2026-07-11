#!/usr/bin/env node
/**
 * One-shot comfortable density bump for inline StyleSheet spacing.
 * Rollback: revert the commit that ran this script.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.expo']);
const SKIP_FILES = new Set([
  'comfortDensity.ts',
  'screenLayout.ts',
  'digestStripLayout.ts',
  'segmentTabBar.ts',
]);

const REPLACEMENTS = [
  [/(\bgap:\s*)24\b/g, '$128'],
  [/(\bgap:\s*)16\b/g, '$120'],
  [/(\bmarginBottom:\s*)12\b/g, '$116'],
  [/(\bmarginTop:\s*)12\b/g, '$116'],
  [/(\bmarginVertical:\s*)12\b/g, '$116'],
  [/(\bgap:\s*)12\b/g, '$116'],
  [/(\bmarginBottom:\s*)10\b/g, '$114'],
  [/(\bmarginTop:\s*)10\b/g, '$112'],
  [/(\bmarginVertical:\s*)10\b/g, '$112'],
  [/(\bgap:\s*)10\b/g, '$112'],
  [/(\bpaddingVertical:\s*)10\b/g, '$112'],
  [/(\bgap:\s*)8\b/g, '$112'],
  [/(\bpaddingVertical:\s*)8\b/g, '$110'],
  [/(\bgap:\s*)6\b/g, '$18'],
  [/(\bgap:\s*)5\b/g, '$16'],
  [/(\bgap:\s*)4\b/g, '$16'],
  [/(\bpaddingTop:\s*)4\b/g, '$18'],
  [/(\bpaddingBottom:\s*)4\b/g, '$18'],
  [/(\bmarginBottom:\s*)9\b/g, '$112'],
  [/(\bmarginTop:\s*)9\b/g, '$112'],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?)$/.test(ent.name) && !SKIP_FILES.has(ent.name)) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('scripts/') || rel.startsWith('server/')) continue;
  let src = fs.readFileSync(file, 'utf8');
  let next = src;
  for (const [re, rep] of REPLACEMENTS) next = next.replace(re, rep);
  if (next !== src) {
    fs.writeFileSync(file, next);
    changed += 1;
    console.log(rel);
  }
}
console.log(`Updated ${changed} files.`);
