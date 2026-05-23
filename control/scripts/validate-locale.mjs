#!/usr/bin/env node
// Compare a translated locale file against en.json. Used by the
// translate-messages skill to verify subagent output before the new
// locale gets wired into the app.
//
// Usage: node scripts/validate-locale.mjs <source-locale> <target-locale>
//   e.g. node scripts/validate-locale.mjs en es

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = resolve(__dirname, '..', 'messages');

const [, , sourceLocale, targetLocale] = process.argv;
if (!sourceLocale || !targetLocale) {
  console.error('Usage: validate-locale.mjs <source-locale> <target-locale>');
  process.exit(2);
}

const source = JSON.parse(readFileSync(resolve(messagesDir, `${sourceLocale}.json`), 'utf8'));
let target;
try {
  target = JSON.parse(readFileSync(resolve(messagesDir, `${targetLocale}.json`), 'utf8'));
} catch (e) {
  console.error(`failed to read or parse ${targetLocale}.json: ${e.message}`);
  process.exit(1);
}

const errors = [];
const ICU_INNER = /^(\w+)\s*,\s*(plural|select|selectordinal)\s*,/;

function placeholderSet(str) {
  // Walk top-level `{...}` blocks. An ICU plural/select block contributes a
  // single `{name, type}` token; its branch text is *not* a placeholder set
  // and may be freely translated (e.g. `{count, plural, one {capability}
  // other {capabilities}}` legitimately becomes `... one {võimekus} other
  // {võimekust}` in Estonian). A plain `{name}` block contributes `{name}`.
  // Anything else is surfaced verbatim so it still shows up as a mismatch.
  const result = new Set();
  let i = 0;
  while (i < str.length) {
    if (str[i] !== '{') {
      i++;
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < str.length; j++) {
      if (str[j] === '{') depth++;
      else if (str[j] === '}' && --depth === 0) break;
    }
    if (depth !== 0) {
      // Unbalanced brace — give up on this block, keep scanning.
      i++;
      continue;
    }
    const body = str.slice(i + 1, j);
    const icu = body.match(ICU_INNER);
    if (icu) {
      result.add(`{${icu[1]}, ${icu[2]}}`);
    } else if (/^\w+$/.test(body.trim())) {
      result.add(`{${body.trim()}}`);
    } else {
      result.add(`{${body}}`);
    }
    i = j + 1;
  }
  return result;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function walk(srcNode, tgtNode, path) {
  if (typeof srcNode === 'string') {
    if (typeof tgtNode !== 'string') {
      errors.push(`${path}: expected string, got ${typeof tgtNode}`);
      return;
    }
    if (tgtNode.length === 0) {
      errors.push(`${path}: empty translation`);
      return;
    }
    const srcPh = placeholderSet(srcNode);
    const tgtPh = placeholderSet(tgtNode);
    if (!setsEqual(srcPh, tgtPh)) {
      errors.push(
        `${path}: placeholder mismatch — source ${[...srcPh].join(',') || '(none)'} vs target ${[...tgtPh].join(',') || '(none)'}`,
      );
    }
    return;
  }
  if (Array.isArray(srcNode)) {
    if (!Array.isArray(tgtNode) || tgtNode.length !== srcNode.length) {
      errors.push(`${path}: array shape mismatch`);
      return;
    }
    srcNode.forEach((v, i) => walk(v, tgtNode[i], `${path}[${i}]`));
    return;
  }
  if (srcNode && typeof srcNode === 'object') {
    if (!tgtNode || typeof tgtNode !== 'object' || Array.isArray(tgtNode)) {
      errors.push(`${path}: expected object`);
      return;
    }
    const srcKeys = Object.keys(srcNode);
    const tgtKeys = Object.keys(tgtNode);
    for (const k of srcKeys) {
      if (!(k in tgtNode)) {
        errors.push(`${path ? `${path}.` : ''}${k}: missing in target`);
        continue;
      }
      walk(srcNode[k], tgtNode[k], path ? `${path}.${k}` : k);
    }
    for (const k of tgtKeys) {
      if (!(k in srcNode)) {
        errors.push(`${path ? `${path}.` : ''}${k}: extra key in target`);
      }
    }
    return;
  }
  // primitives (number, boolean, null) — require strict equality
  if (srcNode !== tgtNode) {
    errors.push(`${path}: literal mismatch (${JSON.stringify(srcNode)} vs ${JSON.stringify(tgtNode)})`);
  }
}

walk(source, target, '');

if (errors.length > 0) {
  console.error(`${targetLocale}.json: ${errors.length} validation error(s)`);
  for (const e of errors.slice(0, 50)) console.error(`  ${e}`);
  if (errors.length > 50) console.error(`  ...and ${errors.length - 50} more`);
  process.exit(1);
}

console.log(`${targetLocale}.json: ok`);
