#!/usr/bin/env node
/**
 * One-shot less-rounded corner bump for inline StyleSheet borderRadius.
 * Skips pill chips (999) and tiny radii (<=7).
 * Rollback: revert the commit that ran this script.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.expo', 'server']);
const SKIP_FILES = new Set(['uiCornerRadius.ts', 'segmentTabBar.ts', 'tabBar.ts', 'groupedFeedList.ts']);

const REPLACEMENTS = [
  [/(\bborderRadius:\s*)30\b/g, '$122'],
  [/(\bborderTopLeftRadius:\s*)30\b/g, '$122'],
  [/(\bborderTopRightRadius:\s*)30\b/g, '$122'],
  [/(\bborderBottomLeftRadius:\s*)30\b/g, '$122'],
  [/(\bborderBottomRightRadius:\s*)30\b/g, '$122'],
  [/(\bborderRadius:\s*)22\b/g, '$116'],
  [/(\bborderTopLeftRadius:\s*)22\b/g, '$116'],
  [/(\bborderTopRightRadius:\s*)22\b/g, '$116'],
  [/(\bborderBottomLeftRadius:\s*)22\b/g, '$116'],
  [/(\bborderBottomRightRadius:\s*)22\b/g, '$116'],
  [/(\bborderRadius:\s*)18\b/g, '$114'],
  [/(\bborderRadius:\s*)16\b/g, '$112'],
  [/(\bborderRadius:\s*)14\b/g, '$110'],
  [/(\bborderRadius:\s*)13\b/g, '$110'],
  [/(\bborderRadius:\s*)12\b/g, '$110'],
  [/(\bborderRadius:\s*)10\b/g, '$18'],
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
  if (rel.startsWith('scripts/')) continue;
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
