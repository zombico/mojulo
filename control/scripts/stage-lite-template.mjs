#!/usr/bin/env node
/**
 * Stages lite-template/ into the dashboard package for npm publish.
 *
 *   node scripts/stage-lite-template.mjs [dest]   (default: control/ui-package/lite-template)
 *
 * The dashboard needs the bot template at runtime: the preview routes serve lite-template/client/*
 * into the wizard iframe, and the deployer reads it in offline-build mode. lite-template lives
 * outside control/ in the source tree, and since 2.2.0 it ships in the dashboard package, not in
 * core; the stdio server has no preview surface. stage-ui-package.mjs runs this.
 *
 * Uses `git ls-files` as the enumeration so only tracked files travel — auto-excludes .env, data/,
 * documents/, integration/, the 113MB .onnx, node_modules/, and anything else gitignored. models/
 * stays behind too (17 MB of tokenizer files only the bot image reads; its build fetches the model
 * itself). Hard guards abort the publish if a known-sensitive path leaks anyway.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTROL_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(CONTROL_DIR, '..');
const SRC = path.join(REPO_ROOT, 'lite-template');
const DST = path.resolve(process.argv[2] ?? path.join(CONTROL_DIR, 'ui-package', 'lite-template'));

if (!existsSync(SRC)) {
  console.error(`stage-lite-template: source not found at ${SRC}`);
  process.exit(1);
}

if (existsSync(DST)) rmSync(DST, { recursive: true, force: true });
mkdirSync(DST, { recursive: true });

const out = execSync('git ls-files lite-template', { cwd: REPO_ROOT, encoding: 'utf8' });
const files = out
  .split('\n')
  .filter(Boolean)
  .filter((relPath) => !relPath.startsWith('lite-template/models/'));

for (const relPath of files) {
  const rel = relPath.replace(/^lite-template\//, '');
  const srcFile = path.join(REPO_ROOT, relPath);
  const dstFile = path.join(DST, rel);
  mkdirSync(path.dirname(dstFile), { recursive: true });
  copyFileSync(srcFile, dstFile);
}

// Defense-in-depth: refuse to continue if anything sensitive made it through.
// These paths should already be gitignored, but a bad commit could undo that.
const FORBIDDEN = ['.env', 'data', 'node_modules', 'integration', 'models'];
for (const name of FORBIDDEN) {
  const probe = path.join(DST, name);
  if (existsSync(probe)) {
    console.error(`stage-lite-template: ABORT — sensitive path leaked: ${probe}`);
    process.exit(1);
  }
}

process.stderr.write(`stage-lite-template: staged ${files.length} files to ${DST}\n`);
