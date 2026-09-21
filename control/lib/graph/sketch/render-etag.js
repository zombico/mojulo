/**
 * Render-route cache keys with a code-version salt.
 *
 * A rendered page is a pure function of (recipe, flags, THE CODE THAT RENDERS
 * IT). The world route keyed its server cache and its browser ETag on the first
 * two only, so after an upgrade that changed the emitter, a browser's
 * `If-None-Match` still matched and was handed a 304 over stale HTML. The
 * process-scoped server cache never had this problem (a restart empties it); the
 * browser's cache survives restarts, so its key must carry the code version.
 *
 * Two salts, same posture as sketch-png.js `SCENE_CACHE_VERSION`:
 *   · `version` — a hand-bumped constant the ROUTE owns, for an emitter change
 *     inside one release (dev, or a patch that should invalidate held pages);
 *   · the package version (`getServerVersion`) — the upgrade signal nobody has
 *     to remember to bump.
 *
 * Server-only (node:crypto, package.json).
 */

import crypto from 'node:crypto';

import { getServerVersion } from '@/lib/server-version';

/**
 * sha256 hex over (ref, flags, code version, package version, manifest). Stable
 * across processes for the same inputs; different the moment any of them moves.
 */
export function renderCacheKey({ ref, manifest, flags = {}, version = 'v1' }) {
  const payload = JSON.stringify({
    ref,
    flags,
    code: version,
    server: getServerVersion(),
    manifest,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/** The query flags that change a route's output, read off its search params in a fixed order. */
export function pickFlags(search, names) {
  const out = {};
  for (const name of names) out[name] = search.get(name) ?? '';
  return out;
}

/** A quoted ETag from a cache key: `"<prefix>-<first 32 hex>"`. */
export function etagFor(prefix, key) {
  return `"${prefix}-${key.slice(0, 32)}"`;
}
