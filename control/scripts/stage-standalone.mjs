#!/usr/bin/env node
/**
 * Bundles the client static assets into the Next.js standalone output dir.
 *
 * Background: `next build --webpack` with `output: 'standalone'` produces
 * a self-contained server at .next/standalone/server.js, BUT deliberately
 * leaves the browser-facing static assets at .next/static/ and the public/
 * folder at the project root. The Next docs explicitly call this out — any
 * deployer is expected to copy those two trees into the standalone dir.
 *
 * The standalone server.js does `process.chdir(__dirname)` at boot, then
 * Next serves `_next/static/*` from `<cwd>/.next/static/`. Without this
 * staging step the browser hits 404 on every chunk, font, and css file —
 * the HTML loads but the page is unstyled and non-interactive. We learned
 * this the bad way on 0.2.0; 0.2.1 is the fix.
 *
 * Runs as part of `prepack` after `next build --webpack` so the published
 * tarball ships a standalone bundle that boots into a fully working dashboard.
 */

import { existsSync, rmSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTROL_DIR = path.resolve(__dirname, '..');
const STANDALONE_DIR = path.join(CONTROL_DIR, '.next', 'standalone');
const STATIC_SRC = path.join(CONTROL_DIR, '.next', 'static');
const STATIC_DST = path.join(STANDALONE_DIR, '.next', 'static');
const PUBLIC_SRC = path.join(CONTROL_DIR, 'public');
const PUBLIC_DST = path.join(STANDALONE_DIR, 'public');

if (!existsSync(STANDALONE_DIR)) {
  console.error(
    `stage-standalone: ${STANDALONE_DIR} missing — run \`next build --webpack\` first.`
  );
  process.exit(1);
}

if (!existsSync(STATIC_SRC)) {
  console.error(`stage-standalone: ${STATIC_SRC} missing — Next build did not emit static assets.`);
  process.exit(1);
}

// Re-stage clean — leftover assets from a previous build would otherwise
// linger if the build hash changes.
if (existsSync(STATIC_DST)) rmSync(STATIC_DST, { recursive: true, force: true });
cpSync(STATIC_SRC, STATIC_DST, { recursive: true });

if (existsSync(PUBLIC_SRC)) {
  if (existsSync(PUBLIC_DST)) rmSync(PUBLIC_DST, { recursive: true, force: true });
  cpSync(PUBLIC_SRC, PUBLIC_DST, { recursive: true });
}

process.stderr.write(
  `stage-standalone: copied .next/static → .next/standalone/.next/static` +
    (existsSync(PUBLIC_SRC) ? ` and public → .next/standalone/public` : '') +
    '\n'
);
