#!/usr/bin/env node
/**
 * Prepack step: compile every .jsx the package ships into its `<name>.jsx.mjs` twin, so the
 * published stdio server never needs @swc/core (a devDependency). scripts/mcp-stdio-loader.mjs
 * serves the twin while the sha256 on its first line matches the .jsx beside it.
 *
 * The shipped .jsx files are the plain `.jsx` entries in package.json `files`; each needs its
 * twin listed there too (scripts/precompile-jsx.test.js checks both).
 *
 *   node scripts/precompile-jsx.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRECOMPILED_SUFFIX, jsxTransformOptions, precompiledHeader } from './mcp-stdio-loader.mjs';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The .jsx sources package.json `files` ships, repo-relative. */
export function shippedJsx(pkg = JSON.parse(readFileSync(path.join(CONTROL_DIR, 'package.json'), 'utf8'))) {
  return pkg.files.filter((f) => f.endsWith('.jsx') && !f.startsWith('!') && !f.includes('*'));
}

/** Compile one .jsx to its twin and return the twin's path. */
export function precompileJsx(filename) {
  const { transformSync } = createRequire(import.meta.url)('@swc/core');
  const source = readFileSync(filename, 'utf8');
  const { code } = transformSync(source, jsxTransformOptions(filename));
  const out = filename + PRECOMPILED_SUFFIX;
  writeFileSync(out, precompiledHeader(source) + code);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const rel of shippedJsx()) {
    const out = precompileJsx(path.join(CONTROL_DIR, rel));
    process.stdout.write(`precompile-jsx: ${rel} → ${path.relative(CONTROL_DIR, out)}\n`);
  }
}
