/**
 * recipe-book loader — attaches an operator-cloned mojulo-recipe-book folder
 * (recipe-book.plan.md). The book is a separate git repo of chapters; each
 * entry is either a Door-1 RECIPE (card.md + recipe.json — pure params over a
 * kind core already ships; nothing executed) or a Door-2 BUILDER (card.md +
 * builder.js — a new view kind whose pure `assemble(recipe, ctx)` is
 * dynamically imported here and registered for mint + render).
 *
 * Attachment is strictly additive and loopback-honest: the operator clones the
 * repo and points MOJULO_RECIPE_BOOK at it; no env var (or no dir) ⇒ the empty
 * snapshot and byte-for-byte today's behavior. Nothing is ever fetched at
 * runtime. Module split: ./cards.js is the fs-only sync half (card reads for
 * the view-vocab merge), ./registry.js the import-nothing snapshot for sync
 * readers; THIS file owns dynamic import + the version handshake and is only
 * reached from async seams (MCP ensureToolsRegistered, the /world route's
 * kind-miss path).
 *
 * Handshake: manifest.json declares `requiresMojulo` (">=x.y.z"); a book newer
 * than the installed control plane loads NO entries and warns — knowledge
 * drift is tolerable, code drift is gated, never trusted (the plan's clone-of-
 * master posture). Builder manifestKinds colliding with core WORLD_KINDS are
 * skipped per-entry (core wins), as are malformed builders — a user-editable
 * clone must never take the substrate down.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { moduleDir } from '../../../module-dir.js';
import { WORLD_KINDS } from '@/lib/graph/worlds/world-kinds';
import { bookDir, readBookManifest, readBookCards, _resetBookCards } from './cards.js';
import { setBookSnapshot, _resetBookRegistry } from './registry.js';
import { buildBookToolkit } from './toolkit.js';

const HERE = moduleDir(import.meta.url, 'lib/graph/views/recipe-book');

// Bundler-proof dynamic import: the book's builder files live OUTSIDE the
// repo at a path only known at runtime, so both bundlers must leave this
// import() to Node's native ESM loader — webpackIgnore for `next build`,
// @vite-ignore for vitest. (`new Function('return import(u)')` is the usual
// third trick but vitest's VM rejects imports from evaluated code.)
const importExternal = (u) => import(/* webpackIgnore: true */ /* @vite-ignore */ u);

function controlVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(HERE, '..', '..', '..', '..', 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch { return '0.0.0'; }
}

// ">=1.4.2" / "1.4.2" → true when the installed control plane satisfies it.
function satisfiesMin(required, installed) {
  const req = String(required || '').replace(/^>=/, '').trim();
  const parse = (s) => s.split('.').map((n) => parseInt(n, 10) || 0);
  const [ra, rb, rc] = parse(req), [ia, ib, ic] = parse(installed);
  if (ia !== ra) return ia > ra;
  if (ib !== rb) return ib > rb;
  return ic >= rc;
}

/**
 * Load the book's Door-2 builders and publish the full registry snapshot.
 * Memoized promise — every caller past the first awaits the same load. Absent
 * a book, publishes the empty (loaded) snapshot so callers stop retrying.
 */
let _loadPromise = null;
export function ensureBookLoaded({ dir: dirOverride, cardParse } = {}) {
  if (_loadPromise) return _loadPromise;
  _loadPromise = loadBook(dirOverride, cardParse);
  return _loadPromise;
}

async function loadBook(dirOverride, cardParse) {
  const warnings = [];
  const warn = (msg) => { warnings.push(msg); console.warn(`recipe-book: ${msg}`); };
  const dir = bookDir(dirOverride);
  const empty = () => { setBookSnapshot({ warnings }); return { kinds: 0, warnings }; };
  if (!dir) return empty();
  const manifest = readBookManifest(dir);
  if (!manifest) {
    if (!existsSync(join(dir, 'manifest.json'))) warn(`MOJULO_RECIPE_BOOK=${dir} has no manifest.json — book not loaded`);
    else warn('unreadable manifest.json — book not loaded');
    return empty();
  }

  const installed = controlVersion();
  if (manifest.requiresMojulo && !satisfiesMin(manifest.requiresMojulo, installed)) {
    warn(`book requires mojulo ${manifest.requiresMojulo} but ${installed} is installed — the clone is ahead; update mojulo or check out an older book tag. No entries loaded.`);
    return empty();
  }

  const kinds = new Map();
  const worldKinds = new Map();
  const renderKinds = new Set();
  // The injected primitive API (toolkit.js) — handed to every builder call as
  // ctx.toolkit. Built once; Tier-0 builders ignore it, Tier-2 builders
  // feature-check ctx.toolkit.version.
  const toolkit = buildBookToolkit();
  for (const entry of Array.isArray(manifest.entries) ? manifest.entries : []) {
    if (entry.type !== 'builder') continue;   // recipe entries are card-only (Door 1)
    const file = join(dir, 'chapters', String(entry.chapter || ''), String(entry.dir || ''), 'builder.js');
    if (!existsSync(file)) { warn(`entry '${entry.id}' declares a builder but ${file} is missing — skipped`); continue; }
    let mod;
    try {
      mod = await importExternal(pathToFileURL(file).href);
    } catch (err) {
      warn(`entry '${entry.id}': builder failed to import — ${err.message} — skipped`);
      continue;
    }
    const meta = mod.kind;
    if (!meta || typeof meta.id !== 'string' || typeof meta.manifestKind !== 'string' || typeof mod.assemble !== 'function') {
      warn(`entry '${entry.id}': builder must export { kind: { id, manifestKind, family, title }, assemble } — skipped`);
      continue;
    }
    if (meta.id !== entry.id) { warn(`entry '${entry.id}': builder kind.id '${meta.id}' does not match the manifest entry — skipped`); continue; }
    if (WORLD_KINDS[meta.manifestKind]) { warn(`entry '${entry.id}': manifestKind '${meta.manifestKind}' collides with a core world kind — core wins, skipped`); continue; }
    if (kinds.has(meta.id)) { warn(`entry '${entry.id}': duplicate kind id — skipped`); continue; }
    kinds.set(meta.id, {
      id: meta.id,
      manifestKind: meta.manifestKind,
      family: ['science', 'math', 'bio'].includes(meta.family) ? meta.family : 'science',
      title: typeof meta.title === 'string' && meta.title ? meta.title : `mojulo ${meta.id}`,
      plan: typeof mod.plan === 'function' ? mod.plan : null,
      assemble: mod.assemble,
      toolkit,
    });
    // the WORLD_KINDS row shape (world-kinds.js `view()` convention), so the
    // /world route's resolveWorldScene dispatch treats a book kind like any other.
    worldKinds.set(meta.manifestKind, { title: meta.title, resolve: (m, ctx) => mod.assemble(m, { title: ctx.title, toolkit }) });
    renderKinds.add(meta.manifestKind);
  }

  const cards = cardParse ? readBookCards({ parse: cardParse, dir }) : readBookCards({ dir });
  setBookSnapshot({ kinds, worldKinds, renderKinds, cards, warnings });
  return { kinds: kinds.size, warnings };
}

// Test seam — clears the memo, the card cache, and the published registry.
export function _resetBookLoader() {
  _loadPromise = null;
  _resetBookCards();
  _resetBookRegistry();
}
