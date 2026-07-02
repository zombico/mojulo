/**
 * theme-registry — the extensible "world flavor" layer for the world-composer.
 *
 * A world splits into orthogonal axes (see world-composer.plan.md): a `base` decides the
 * SHAPE (which geometry generator), a `theme` decides the FLAVOR (materials / assets /
 * context). This module is the theme half: a small registry of named THEME PACKS that a
 * base's adapter resolves onto its own knobs.
 *
 * A theme pack is pure data:
 *   { id, family, label, description, slots: { context?, material?, asset?, style? } }
 * `slots` is an ABSTRACT role vocabulary; each base consumes only the slots it can render
 * and ignores the rest — so the same pack can flavor a city today and a dungeon later.
 *
 * `family` ('earth' | 'scifi' | 'fantasy' | …) is a free grouping tag; the point of the
 * registry is that new families (a Mars colony, a dwarven hold) are new packs, not forked
 * generators. Packs self-register at import time via the explicit list at the bottom.
 */

const REGISTRY = new Map();

/** Register (or replace) a theme pack. Validates the minimal shape. */
export function registerTheme(pack) {
  if (!pack || typeof pack !== 'object') throw new Error('registerTheme: pack must be an object');
  if (typeof pack.id !== 'string' || !pack.id) throw new Error('registerTheme: pack.id must be a non-empty string');
  if (pack.slots != null && typeof pack.slots !== 'object') throw new Error(`registerTheme('${pack.id}'): slots must be an object`);
  REGISTRY.set(pack.id, { family: 'earth', label: pack.id, description: '', slots: {}, ...pack });
  return pack.id;
}

/** True if a theme id is registered. */
export function hasTheme(id) {
  return REGISTRY.has(id);
}

/** Resolve a theme id to its full pack. Throws (with the known ids) on miss. */
export function resolveTheme(id) {
  const pack = REGISTRY.get(id);
  if (!pack) {
    throw new Error(`theme-registry: unknown theme '${id}'. Known: ${[...REGISTRY.keys()].join(', ') || '(none)'}`);
  }
  return pack;
}

/** List registered themes as summaries (optionally filtered by family), in registration order. */
export function listThemes({ family } = {}) {
  const out = [];
  for (const p of REGISTRY.values()) {
    if (family && p.family !== family) continue;
    out.push({ id: p.id, family: p.family, label: p.label, description: p.description });
  }
  return out;
}

// ── the shipped packs ────────────────────────────────────────────────────────────────
// Imported for their side effect of registering. Explicit (not a glob) so load order — and
// therefore listThemes() order — is deterministic.
import earthTemperate from './themes/earth-temperate.js';
import oldWorldEurope from './themes/old-world-europe.js';
import pacificaTropical from './themes/pacifica-tropical.js';
import marsColony from './themes/mars-colony.js';

for (const pack of [earthTemperate, oldWorldEurope, pacificaTropical, marsColony]) {
  registerTheme(pack);
}
