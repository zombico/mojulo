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
 *   - `.jsx` sources, which Node cannot parse — `lib/graph/sketch/sketch-svg.js`
 *     server-renders `components/graph/CreationMap.jsx` through React, so the
 *     stdio process has to compile JSX itself. See `load` below.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

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

// swc is loaded lazily: it is a native addon, and the overwhelming majority of
// stdio processes never touch a `.jsx` file. Requiring it at module scope would
// put that load on every MCP server start.
let transformSync = null;
function getTransform() {
  if (!transformSync) {
    const require = createRequire(import.meta.url);
    ({ transformSync } = require('@swc/core'));
  }
  return transformSync;
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file://') && url.endsWith('.jsx')) {
    const filename = fileURLToPath(url);
    const { code } = getTransform()(readFileSync(filename, 'utf8'), {
      filename,
      jsc: {
        parser: { syntax: 'ecmascript', jsx: true },
        target: 'es2022',
        transform: { react: { runtime: 'automatic' } },
      },
      module: { type: 'es6' },
      sourceMaps: false,
    });
    return { format: 'module', source: code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
