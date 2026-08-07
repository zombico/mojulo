#!/usr/bin/env node
// Deterministic half of the /sync-locales flow. Two subcommands:
//
//   extract <locale> [--ref <ref>] [--fresh]
//     Build the per-locale work dir (control/data/locale-sync/<locale>/):
//       todo.json     [{ en, keys }]  unique EN strings still needing translation
//       prefill.json  { "dotted.key": translation }  covered by translation memory
//     The memory pairs en.json at the last commit that touched <locale>.json with
//     the current <locale>.json, keyed by EN string *value* — so exact repeats and
//     unchanged strings are prefilled for free. --fresh skips the memory entirely
//     (full regeneration). Strings already present in translations.jsonl are
//     subtracted from the todo, which is what makes a crashed run resumable.
//
//   mint <locale>
//     Rebuild messages/<locale>.json in exactly current en.json's key shape from
//     prefill + translations.jsonl (+ optional overrides.json, keyed by dotted
//     path, applied last). Refuses to mint unless every leaf is covered. Validates
//     with validate-locale.mjs and restores the previous file on failure. Clears
//     the work dir on success.
//
// The model never touches messages/*.json — it only appends {en, translation}
// lines to translations.jsonl. See locale-sync.plan.md.

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const controlDir = resolve(__dirname, '..');
const repoRoot = resolve(controlDir, '..');
const messagesDir = resolve(controlDir, 'messages');
const workRoot = resolve(controlDir, 'data', 'locale-sync');

const [, , command, locale, ...rest] = process.argv;
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const refIdx = rest.indexOf('--ref');
const explicitRef = refIdx !== -1 ? rest[refIdx + 1] : null;

if (!command || !locale || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(locale) || locale === 'en') {
  console.error('Usage: locale-sync.mjs extract <locale> [--ref <ref>] [--fresh]');
  console.error('       locale-sync.mjs mint <locale>');
  process.exit(2);
}

const workDir = resolve(workRoot, locale);
const localePath = resolve(messagesDir, `${locale}.json`);
const en = JSON.parse(readFileSync(resolve(messagesDir, 'en.json'), 'utf8'));

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// -> Map of dotted path -> string value, walking objects and arrays.
function leaves(node, path = '', out = new Map()) {
  if (typeof node === 'string') {
    out.set(path, node);
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  } else if (isObj(node)) {
    for (const k of Object.keys(node)) leaves(node[k], path ? `${path}.${k}` : k, out);
  }
  return out;
}

function readJsonl(path) {
  const map = new Map();
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row;
    try {
      row = JSON.parse(trimmed);
    } catch {
      console.error(`warning: skipping malformed jsonl line: ${trimmed.slice(0, 80)}`);
      continue;
    }
    if (typeof row.en === 'string' && typeof row.translation === 'string' && row.translation.length > 0) {
      map.set(row.en, row.translation); // last line wins
    }
  }
  return map;
}

if (command === 'extract') {
  const enLeaves = leaves(en);

  // Translation memory: EN value at baseline -> translated value, unless --fresh.
  const memory = new Map();
  if (!flags.has('--fresh') && existsSync(localePath)) {
    let baselineRef = explicitRef;
    if (!baselineRef) {
      try {
        baselineRef = execSync(`git log -1 --format=%H -- control/messages/${locale}.json`, {
          cwd: repoRoot,
        })
          .toString()
          .trim();
      } catch {
        baselineRef = '';
      }
    }
    if (baselineRef) {
      let baselineEn = null;
      try {
        baselineEn = JSON.parse(
          execSync(`git show ${baselineRef}:control/messages/en.json`, {
            cwd: repoRoot,
            stdio: ['pipe', 'pipe', 'pipe'],
          }).toString(),
        );
      } catch {
        console.error(`warning: no en.json at ${baselineRef.slice(0, 12)} — running fresh`);
      }
      if (baselineEn) {
        const baseLeaves = leaves(baselineEn);
        const current = leaves(JSON.parse(readFileSync(localePath, 'utf8')));
        const counts = new Map(); // en value -> Map(translation -> count)
        for (const [path, enValue] of baseLeaves) {
          const t = current.get(path);
          if (typeof t !== 'string' || t.length === 0) continue;
          if (!counts.has(enValue)) counts.set(enValue, new Map());
          const c = counts.get(enValue);
          c.set(t, (c.get(t) || 0) + 1);
        }
        for (const [enValue, c] of counts) {
          const ranked = [...c.entries()].sort((a, b) => b[1] - a[1]);
          memory.set(enValue, ranked[0][0]);
          if (ranked.length > 1) {
            console.error(
              `conflict: ${JSON.stringify(enValue.slice(0, 60))} has ${ranked.length} translations, keeping most frequent`,
            );
          }
        }
        console.error(`memory: ${memory.size} entries from ${baselineRef.slice(0, 12)}`);
      }
    }
  }

  const done = readJsonl(resolve(workDir, 'translations.jsonl'));
  const prefill = {};
  const todo = new Map(); // en value -> [dotted paths]
  for (const [path, value] of enLeaves) {
    if (memory.has(value)) {
      prefill[path] = memory.get(value);
    } else if (!done.has(value) && !todo.has(value)) {
      todo.set(value, []);
    }
    if (todo.has(value)) todo.get(value).push(path);
  }

  mkdirSync(workDir, { recursive: true });
  writeFileSync(
    resolve(workDir, 'todo.json'),
    JSON.stringify([...todo.entries()].map(([en, keys]) => ({ en, keys })), null, 2) + '\n',
  );
  writeFileSync(resolve(workDir, 'prefill.json'), JSON.stringify(prefill, null, 2) + '\n');

  console.log(
    `${locale}: ${enLeaves.size} leaves | ${Object.keys(prefill).length} prefilled | ` +
      `${done.size} already in translations.jsonl | ${todo.size} unique strings to translate ` +
      `(todo.json in ${workDir.replace(repoRoot + '/', '')})`,
  );
  process.exit(0);
}

if (command === 'mint') {
  const enLeaves = leaves(en);
  const prefillPath = resolve(workDir, 'prefill.json');
  const prefill = existsSync(prefillPath) ? JSON.parse(readFileSync(prefillPath, 'utf8')) : {};
  const translated = readJsonl(resolve(workDir, 'translations.jsonl'));
  const overridesPath = resolve(workDir, 'overrides.json');
  const overrides = existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {};

  const missing = [];
  const resolved = new Map();
  for (const [path, value] of enLeaves) {
    const t = overrides[path] ?? translated.get(value) ?? prefill[path];
    if (typeof t !== 'string' || t.length === 0) missing.push(value);
    else resolved.set(path, t);
  }
  if (missing.length > 0) {
    const uniq = [...new Set(missing)];
    console.error(`${locale}: refusing to mint — ${uniq.length} unique strings untranslated:`);
    for (const v of uniq.slice(0, 20)) console.error(`  ${JSON.stringify(v.slice(0, 80))}`);
    if (uniq.length > 20) console.error(`  ...and ${uniq.length - 20} more`);
    process.exit(1);
  }

  function build(node, path = '') {
    if (typeof node === 'string') return resolved.get(path);
    if (Array.isArray(node)) return node.map((v, i) => build(v, `${path}[${i}]`));
    if (isObj(node)) {
      const out = {};
      for (const k of Object.keys(node)) out[k] = build(node[k], path ? `${path}.${k}` : k);
      return out;
    }
    return node; // numbers/booleans/null copy verbatim
  }

  const previous = existsSync(localePath) ? readFileSync(localePath, 'utf8') : null;
  writeFileSync(localePath, JSON.stringify(build(en), null, 2) + '\n');

  const check = spawnSync('node', [resolve(__dirname, 'validate-locale.mjs'), 'en', locale], {
    cwd: controlDir,
    encoding: 'utf8',
  });
  if (check.status !== 0) {
    if (previous !== null) writeFileSync(localePath, previous);
    else rmSync(localePath, { force: true });
    console.error(`${locale}: validation failed — previous file restored`);
    console.error(check.stderr || check.stdout);
    process.exit(1);
  }

  rmSync(workDir, { recursive: true, force: true });
  console.log(`${locale}.json: minted and validated (${enLeaves.size} leaves)`);
  process.exit(0);
}

console.error(`unknown command: ${command}`);
process.exit(2);
