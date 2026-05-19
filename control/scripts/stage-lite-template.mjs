#!/usr/bin/env node
/**
 * Stages lite-template/ inside control/ for npm publish.
 *
 * The published mojulo package needs the bot template at runtime — preview
 * routes serve lite-template/client/* into the wizard iframe, and the
 * deployer reads it in offline-build mode. But lite-template lives outside
 * control/ in the source tree.
 *
 * Uses `git ls-files` as the enumeration so only tracked files travel —
 * auto-excludes .env, data/, documents/, integration/, the 113MB .onnx,
 * node_modules/, and anything else gitignored. Hard guards abort the
 * publish if a known-sensitive path leaks anyway.
 *
 * Runs as `prepack` so `npm publish` and `npm pack` both stage first.
 * The staged dir (control/lite-template/) is gitignored so it doesn't
 * pollute dev working trees between publishes.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTROL_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(CONTROL_DIR, '..');
const SRC = path.join(REPO_ROOT, 'lite-template');
const DST = path.join(CONTROL_DIR, 'lite-template');

if (!existsSync(SRC)) {
  console.error(`stage-lite-template: source not found at ${SRC}`);
  process.exit(1);
}

if (existsSync(DST)) rmSync(DST, { recursive: true, force: true });
mkdirSync(DST, { recursive: true });

const out = execSync('git ls-files lite-template', { cwd: REPO_ROOT, encoding: 'utf8' });
const files = out.split('\n').filter(Boolean);

for (const relPath of files) {
  const rel = relPath.replace(/^lite-template\//, '');
  const srcFile = path.join(REPO_ROOT, relPath);
  const dstFile = path.join(DST, rel);
  mkdirSync(path.dirname(dstFile), { recursive: true });
  copyFileSync(srcFile, dstFile);
}

// Defense-in-depth: refuse to continue if anything sensitive made it through.
// These paths should already be gitignored, but a bad commit could undo that.
const FORBIDDEN = ['.env', 'data', 'node_modules', 'integration'];
for (const name of FORBIDDEN) {
  const probe = path.join(DST, name);
  if (existsSync(probe)) {
    console.error(`stage-lite-template: ABORT — sensitive path leaked: ${probe}`);
    process.exit(1);
  }
}

process.stderr.write(`stage-lite-template: staged ${files.length} files to ${DST}\n`);
