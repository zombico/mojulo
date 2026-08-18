/**
 * moduleDir — resolve a lib module's on-disk directory, bundler-safe.
 *
 * `import.meta.url` is the natural anchor for resources that live next to the
 * code (vocab cards, catalysts, templates, vendored fonts), but
 * `next build --webpack` inlines it as a LITERAL string from the build
 * machine, so the published standalone bundle carries the builder's absolute
 * paths — directories that exist on no other machine, and on Windows an
 * ERR_INVALID_FILE_URL_PATH throw at module scope (posix file: URLs have no
 * drive letter). The stdio server never hit this because it runs the raw
 * lib/ tree where `import.meta.url` is genuine; only bundled routes broke.
 *
 * Fix: every entry bin (mcp-stdio / mcp-ui / app-runtime / daemons) exports
 * MOJULO_CONTROL_DIR — the installed package root, which ships the complete
 * lib/ tree — and modules resolve env-first. The fileURLToPath fallback stays
 * for repo-dev flows (vitest, `next dev`/`next start` on the build machine)
 * where the URL is genuine or baked-but-locally-correct, and is only
 * evaluated when the env var is absent, so a foreign baked URL is never
 * parsed on an npm install.
 *
 * @param {string} metaUrl - the caller's `import.meta.url` (each module must
 *   pass its own; a shared helper reading it would get THIS file's baked URL)
 * @param {string} dirFromControlRoot - the caller's directory relative to the
 *   control package root, posix-style (e.g. 'lib/graph/sketch-vocab')
 * @returns {string} absolute path of the caller's directory
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function moduleDir(metaUrl, dirFromControlRoot) {
  const root = process.env.MOJULO_CONTROL_DIR;
  if (root) return path.join(root, ...dirFromControlRoot.split('/'));
  return path.dirname(fileURLToPath(metaUrl));
}
