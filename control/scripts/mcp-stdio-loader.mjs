/**
 * ESM resolver hook that maps `@/...` imports to the control directory so the
 * stdio MCP entry can run under plain Node (Next.js handles `@/` natively via
 * jsconfig.json, but Node does not).
 *
 * Registered by [mcp-stdio.mjs](./mcp-stdio.mjs) via `module.register`. Hooks
 * run in a worker thread and fire for every subsequent dynamic import — the
 * stdio entry's `await import('@/lib/mcp/server')` is resolved here.
 *
 * Beyond the `@/` alias this hook covers two more gaps between the bundler's
 * resolution rules and Node's, both of which are fatal to the stdio entry:
 *   - extensionless relative specifiers (`./files`, `./exports-dir`), which
 *     Next resolves and Node rejects with ERR_MODULE_NOT_FOUND;
 *   - `.jsx` sources, which Node cannot parse — `lib/sketch-svg.js`
 *     server-renders `components/graph/CreationMap.jsx` through React, so the
 *     stdio process has to compile JSX itself. See `load` below.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXTS = ['', '.js', '.mjs', '.cjs', '.json', '.jsx'];

const INDEX_EXTS = ['.js', '.mjs', '.jsx'];

function probe(base) {
  for (const ext of EXTS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const ext of INDEX_EXTS) {
      const indexFile = path.join(base, `index${ext}`);
      if (existsSync(indexFile)) return indexFile;
    }
  }
  return null;
}

function resolveAlias(specifier) {
  return probe(path.join(CONTROL_DIR, specifier.slice(2)));
}

// Sibling modules under lib/ import each other without a file extension
// (`./files`, `./exports-dir`, `./meta-context`, `./motion-comic-manifest`).
// Apply the same probing used for `@/` above, but only as a fallback — an
// exact file hit is left to Node so normal resolution is untouched.
function resolveRelative(specifier, parentURL) {
  if (!parentURL) return null;
  let base;
  try {
    base = fileURLToPath(new URL(specifier, parentURL));
  } catch {
    return null;
  }
  if (existsSync(base) && statSync(base).isFile()) return null;
  return probe(base);
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const resolved = resolveAlias(specifier);
    if (resolved) {
      return nextResolve(pathToFileURL(resolved).href, context);
    }
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const resolved = resolveRelative(specifier, context.parentURL);
    if (resolved) {
      return nextResolve(pathToFileURL(resolved).href, context);
    }
  }
  return nextResolve(specifier, context);
}

// JSX has two sources. The published package ships each .jsx with a twin,
// `<name>.jsx.mjs`, compiled at prepack by scripts/precompile-jsx.mjs; its first
// line records the sha256 of the .jsx it came from, and the twin is served while
// that still matches. Otherwise (a dev checkout, or a twin left stale by an edit)
// the .jsx is compiled here with @swc/core, a devDependency. The twin's name is
// one neither this resolver's EXTS probe nor Next's or Vite's resolution tries,
// so it can never shadow the .jsx in a dev checkout.
export const PRECOMPILED_SUFFIX = '.mjs';
const PRECOMPILED_HEADER = /^\/\/ mojulo-precompiled source-sha256=([0-9a-f]{64})\n/;

export function jsxSourceHash(source) {
  return createHash('sha256').update(source).digest('hex');
}

export function precompiledHeader(source) {
  return `// mojulo-precompiled source-sha256=${jsxSourceHash(source)}\n`;
}

/** The same transform the prepack twin uses, so both paths emit the same module. */
export function jsxTransformOptions(filename) {
  return {
    filename,
    jsc: {
      parser: { syntax: 'ecmascript', jsx: true },
      target: 'es2022',
      transform: { react: { runtime: 'automatic' } },
    },
    module: { type: 'es6' },
    sourceMaps: false,
  };
}

/** The twin's code when it exists and was compiled from exactly `source`, else null. */
export function readPrecompiled(filename, source) {
  let twin;
  try {
    twin = readFileSync(filename + PRECOMPILED_SUFFIX, 'utf8');
  } catch {
    return null;
  }
  const header = PRECOMPILED_HEADER.exec(twin);
  return header && header[1] === jsxSourceHash(source) ? twin : null;
}

// swc is a native addon and only a devDependency, so it is required only when a
// .jsx has no fresh twin.
let transformSync = null;
function getTransform(filename) {
  if (!transformSync) {
    const require = createRequire(import.meta.url);
    try {
      ({ transformSync } = require('@swc/core'));
    } catch (err) {
      throw new Error(
        `${path.relative(CONTROL_DIR, filename)} has no up-to-date precompiled twin (${path.basename(filename)}${PRECOMPILED_SUFFIX}, `
          + 'written at prepack) and @swc/core, which compiles it in a dev checkout, is not installed: '
          + `${err.message}`,
      );
    }
  }
  return transformSync;
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file://') && url.endsWith('.jsx')) {
    const filename = fileURLToPath(url);
    const source = readFileSync(filename, 'utf8');
    const code = readPrecompiled(filename, source)
      ?? getTransform(filename)(source, jsxTransformOptions(filename)).code;
    return { format: 'module', source: code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
