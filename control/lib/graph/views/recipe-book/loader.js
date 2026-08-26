/**
 * recipe-book loader — attaches the operator's recipe BOOKS
 * (recipe-book.plan.md). A book is a folder of chapters; each entry is either
 * a Door-1 RECIPE (card.md + recipe.json — pure params over a kind core
 * already ships; nothing executed) or a Door-2 BUILDER (card.md + builder.js —
 * a new view kind whose pure `assemble(recipe, ctx)` is dynamically imported
 * here and registered for mint + render).
 *
 * MULTI-BOOK (Phase 5): the attachment is the ordered list from
 * cards.js/bookDirs() — the operator's COOKBOOK (save_recipe's write target)
 * first, then the upstream clone ($MOJULO_RECIPE_BOOK). First-wins per kind;
 * core wins over both. SCOPE GUARD: the cookbook is Door-1 ONLY — a `builder`
 * entry there is skipped with a warning, because auto-loading code from a
 * directory the agent writes into is a deliberate decision Phase 5 does not
 * make (recipe-book.plan.md, Phase 5 scope guard).
 *
 * Attachment is strictly additive and loopback-honest: no env vars / no dirs
 * ⇒ the empty snapshot and byte-for-byte prior behavior. Nothing is ever
 * fetched at runtime. Module split: ./cards.js is the fs-only sync half
 * (card reads for the view-vocab merge), ./registry.js the import-nothing
 * snapshot for sync readers; THIS file owns dynamic import + the version
 * handshake and is only reached from async seams (MCP ensureToolsRegistered,
 * the /world route's kind-miss path, save_recipe's post-save refresh).
 *
 * Handshake: each book's manifest.json may declare `requiresMojulo`
 * (">=x.y.z"); a book newer than the installed control plane loads NO entries
 * and warns — knowledge drift is tolerable, code drift is gated, never
 * trusted. Builder manifestKinds colliding with core WORLD_KINDS are skipped
 * per-entry (core wins), as are malformed builders — a user-editable book
 * must never take the substrate down.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WORLD_KINDS } from '@/lib/graph/worlds/world-kinds';
import { bookDirs, readBookManifest, readBookCards, controlVersion, _resetBookCards } from './cards.js';
import { setBookSnapshot, _resetBookRegistry } from './registry.js';
import { buildBookToolkit } from './toolkit.js';

// Bundler-proof dynamic import: the book's builder files live OUTSIDE the
// repo at a path only known at runtime, so both bundlers must leave this
// import() to Node's native ESM loader — webpackIgnore for `next build`,
// @vite-ignore for vitest. (`new Function('return import(u)')` is the usual
// third trick but vitest's VM rejects imports from evaluated code.)
const importExternal = (u) => import(/* webpackIgnore: true */ /* @vite-ignore */ u);

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
 * Load every attached book's Door-2 builders and publish the full registry
 * snapshot. Memoized promise — every caller past the first awaits the same
 * load. Absent any book, publishes the empty (loaded) snapshot so callers
 * stop retrying. Overrides ({ dir, cookbook }) are test seams; `dir` names
 * the upstream book dir.
 */
let _loadPromise = null;
export function ensureBookLoaded(opts = {}) {
  if (_loadPromise) return _loadPromise;
  _loadPromise = loadBooks(opts);
  return _loadPromise;
}

async function loadBooks({ dir: upstreamOverride, cookbook: cookbookOverride } = {}) {
  const warnings = [];
  const warn = (msg) => { warnings.push(msg); console.warn(`recipe-book: ${msg}`); };

  const dirs = bookDirs({ cookbook: cookbookOverride, upstream: upstreamOverride });
  // An explicitly-passed upstream dir that lacks a manifest still deserves a
  // warning (the env-var misconfiguration case).
  if (upstreamOverride !== undefined || process.env.MOJULO_RECIPE_BOOK) {
    const up = (upstreamOverride ?? process.env.MOJULO_RECIPE_BOOK ?? '').trim();
    if (up && !existsSync(join(up, 'manifest.json'))) {
      warn(`MOJULO_RECIPE_BOOK=${up} has no manifest.json — book not loaded`);
    }
  }
  if (!dirs.length) { setBookSnapshot({ warnings }); return { kinds: 0, warnings }; }

  const installed = controlVersion();
  const kinds = new Map();
  const worldKinds = new Map();
  const renderKinds = new Set();
  // The injected primitive API (toolkit.js) — handed to every builder call as
  // ctx.toolkit. Built once; Tier-0 builders ignore it, Tier-2 builders
  // feature-check ctx.toolkit.version.
  const toolkit = buildBookToolkit();

  for (const { dir, source } of dirs) {
    const manifest = readBookManifest(dir);
    if (!manifest) continue;
    if (manifest.requiresMojulo && !satisfiesMin(manifest.requiresMojulo, installed)) {
      warn(`${source} requires mojulo ${manifest.requiresMojulo} but ${installed} is installed — the clone is ahead; update mojulo or check out an older book tag. No entries loaded from it.`);
      continue;
    }
    for (const entry of Array.isArray(manifest.entries) ? manifest.entries : []) {
      if (entry.type !== 'builder') continue;   // recipe entries are card-only (Door 1)
      if (source === 'cookbook') {
        warn(`cookbook entry '${entry.id}' is a builder — the cookbook is Door-1 only (recipes); skipped`);
        continue;
      }
      // Door-2 lanes are per-family and only the VIEW lane exists (Phase 4
      // built Door-1 routing for the other families; their builder lanes come
      // by demonstrated need). A builder entry declaring a non-view entry tool
      // must not be mis-registered as a view kind.
      if (entry.entry && entry.entry !== 'create_view') {
        warn(`entry '${entry.id}' declares a builder for '${entry.entry}' — no Door-2 lane exists for that family yet (views only); skipped`);
        continue;
      }
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
      if (kinds.has(meta.id) || worldKinds.has(meta.manifestKind)) { warn(`entry '${entry.id}': duplicate kind across books — first book wins, skipped`); continue; }
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
  }

  const cards = readBookCards({ dirs });
  setBookSnapshot({ kinds, worldKinds, renderKinds, cards, warnings });
  return { kinds: kinds.size, warnings };
}

// Test seam — clears the memo, the card cache, and the published registry.
// save_recipe also calls this so a fresh save becomes visible immediately.
export function _resetBookLoader() {
  _loadPromise = null;
  _resetBookCards();
  _resetBookRegistry();
}
