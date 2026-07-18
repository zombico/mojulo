/**
 * g-series livery — role-based recolor over a frozen g-series assembler manifest.
 *
 * Phase 1 of the descendant-generator line (mobile-suit-builder.plan.md, g-series
 * addendum): colors in the g-series language are ROLES, not decoration, so a
 * livery descendant is a pure tint transform over the reference unit's manifest.
 * The role anchors and the four-livery shelf are pinned by the vocab card
 * (sketch-vocab/g-series.md §1/§1b) — this module is that table as code, and the
 * card stays the source of truth: change the card, change these literals with it.
 *
 * Sovereignty: the OUTPUT manifest is the sovereign recipe, same as any assembler
 * mint (mint-at-import; no live ref back to the source unit). The livery/seed pair
 * is provenance the caller records in the title or a manifest note, per the card.
 *
 * Rules encoded here:
 *   - armor / identity / signal roles re-hue per livery; frame, emblem, and the
 *     eye cyan NEVER change — the shared inner frame + gold points + eyes are
 *     what make mixed squads read as one series.
 *   - card-pinned hexes map EXACTLY to their card-pinned livery targets; unlisted
 *     near-tints (panel-break drift like #d8d0c1) map by nearest paired anchor
 *     plus the residual RGB delta, so tint variety survives the re-hue.
 *   - a hex too far from every anchor is UNKNOWN: left untouched, reported.
 *   - seeded dice only (mulberry32, house invariant): the default livery pick and
 *     the optional panel-break jitter both draw from mulberry32(seed).
 */

export const GSERIES_LIVERY_SHELF = ['akai-comet', 'titanic', 'eff-ground', 'union-green'];

// Role anchors from the card's reference-livery table (the v78 unit). `rehue`
// roles take livery targets; fixed roles are series identity and never change.
export const GSERIES_ROLES = {
  armor: { rehue: true, anchors: ['#e7dfcf', '#d8d0c0', '#d6cfc2', '#c8c0b3', '#b9b2a5'] },
  frame: { rehue: false, anchors: ['#111315', '#17191b', '#191b1d', '#151719', '#252a2e'] },
  identity: { rehue: true, anchors: ['#214f95', '#1f4f93', '#173b70', '#2e67b0'] },
  signal: { rehue: true, anchors: ['#b13b28', '#cf4a35', '#8f2c22', '#7f241e'] },
  emblem: { rehue: false, anchors: ['#d59a19', '#5b4108'] },
  eyes: { rehue: false, anchors: ['#35e7ef'] },
};

// Card-pinned src→tgt anchor pairs per livery (§1b). Only the hexes the card
// names are paired; everything else in a re-hued role rides the residual rule.
// Identity/signal pairings follow each livery's lightness direction: a target
// lighter than its mate pairs with the light/bright source anchor, a darker one
// with the deep source anchor (the two dark bases invert the chest contrast).
export const GSERIES_LIVERIES = {
  'akai-comet': {
    armor: { '#e7dfcf': '#c05540', '#d8d0c0': '#b04a37', '#d6cfc2': '#a13f2e', '#c8c0b3': '#8a3323' },
    identity: { '#214f95': '#571a15', '#2e67b0': '#6d241d' },
    signal: { '#b13b28': '#3d1210', '#cf4a35': '#4a1512' },
  },
  titanic: {
    armor: { '#e7dfcf': '#243a5e', '#d8d0c0': '#1f3352', '#d6cfc2': '#1a2c47', '#c8c0b3': '#15243a' },
    identity: { '#214f95': '#c7cfdb', '#173b70': '#a9b4c6' },
    signal: { '#b13b28': '#8f2c22', '#cf4a35': '#a63c2a' },
  },
  'eff-ground': {
    armor: { '#e7dfcf': '#c8b48c', '#d8d0c0': '#b9a67e', '#d6cfc2': '#ab9872', '#c8c0b3': '#8f7d5c' },
    identity: { '#214f95': '#5f5333', '#2e67b0': '#75683f' },
    signal: { '#b13b28': '#96412a', '#8f2c22': '#7a3421' },
  },
  'union-green': {
    armor: { '#e7dfcf': '#a9c9c0', '#d8d0c0': '#98bab0', '#d6cfc2': '#88aba1', '#c8c0b3': '#6f9187' },
    identity: { '#214f95': '#245c54', '#2e67b0': '#2f7268' },
    signal: { '#b13b28': '#a03b26', '#8f2c22': '#83301f' },
  },
};

// A source hex farther than this (RGB Euclidean) from every anchor is unknown.
// Generous: v78's widest anchor-to-stray gap is ~6; cross-role gaps are 60+.
const CLASSIFY_MAX_DISTANCE = 48;

const MONOMER_KEYS = ['lathes', 'extrudes', 'sweeps', 'reliefs'];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function toHex([r, g, b]) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function dist2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function isHex(v) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

// Nearest anchor across a set of candidate hexes; returns { hex, d2 }.
function nearest(h, candidates) {
  const p = rgb(h);
  let best = null;
  for (const c of candidates) {
    const d = dist2(p, rgb(c));
    if (!best || d < best.d2) best = { hex: c, d2: d };
  }
  return best;
}

// Classify one hex → { role, anchor } or null (unknown).
export function classifyGSeriesHex(hex) {
  if (!isHex(hex)) return null;
  const h = hex.toLowerCase();
  let best = null;
  for (const [role, def] of Object.entries(GSERIES_ROLES)) {
    const n = nearest(h, def.anchors);
    if (!best || n.d2 < best.d2) best = { role, anchor: n.hex, d2: n.d2 };
  }
  if (!best || best.d2 > CLASSIFY_MAX_DISTANCE ** 2) return null;
  return { role: best.role, anchor: best.anchor };
}

// Every monomer tint in an assembler/workbench-shaped manifest, in place order.
function* tintSites(manifest) {
  const sources = Array.isArray(manifest?.items)
    ? manifest.items.map((it) => it?.source)
    : [manifest]; // bare workbench manifest: monomer arrays at the top level
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of MONOMER_KEYS) {
      for (const monomer of Array.isArray(source[key]) ? source[key] : []) {
        if (monomer && isHex(monomer.tint)) yield monomer;
      }
    }
  }
}

/**
 * Role census over a manifest's tints. Returns:
 *   { total, roles: { role: { monomers, hexes: { hex: count } } }, unknown: { hex: count } }
 */
export function classifyGSeriesTints(manifest) {
  const roles = {};
  const unknown = {};
  let total = 0;
  for (const monomer of tintSites(manifest)) {
    total += 1;
    const hex = monomer.tint.toLowerCase();
    const hit = classifyGSeriesHex(hex);
    if (!hit) {
      unknown[hex] = (unknown[hex] || 0) + 1;
      continue;
    }
    const bucket = (roles[hit.role] ||= { monomers: 0, hexes: {} });
    bucket.monomers += 1;
    bucket.hexes[hex] = (bucket.hexes[hex] || 0) + 1;
  }
  return { total, roles, unknown };
}

// Resolve one source hex under a livery: exact pair, or nearest paired anchor
// plus the residual delta. Fixed roles and unknowns return the hex unchanged.
function remapHex(hex, liveryMap) {
  const h = hex.toLowerCase();
  const hit = classifyGSeriesHex(h);
  if (!hit || !GSERIES_ROLES[hit.role].rehue) return { hex: h, role: hit?.role ?? null, changed: false };
  const pairs = liveryMap[hit.role];
  if (pairs[h]) return { hex: pairs[h], role: hit.role, changed: true };
  const paired = nearest(h, Object.keys(pairs));
  const src = rgb(paired.hex);
  const tgt = rgb(pairs[paired.hex]);
  const p = rgb(h);
  return { hex: toHex([tgt[0] + p[0] - src[0], tgt[1] + p[1] - src[1], tgt[2] + p[2] - src[2]]), role: hit.role, changed: true };
}

/**
 * Re-hue a frozen g-series manifest into a livery. Pure: returns a deep-cloned
 * manifest; the input is untouched. When `livery` is omitted the shelf pick is
 * rolled from mulberry32(seed) (card §1b). `jitter: true` nudges each distinct
 * panel-break tint ±4 per channel from the same seeded stream, for squad variance.
 *
 * Returns { manifest, livery, seed, picked, remapped, counts, unknown } where
 * `remapped` is { sourceHex: targetHex } and `counts` is per-role monomer counts.
 */
export function applyGSeriesLivery(manifest, { livery, seed = 1, jitter = false } = {}) {
  const rng = mulberry32(seed);
  let picked = false;
  if (!livery) {
    livery = GSERIES_LIVERY_SHELF[Math.floor(rng() * GSERIES_LIVERY_SHELF.length)];
    picked = true;
  }
  const liveryMap = GSERIES_LIVERIES[livery];
  if (!liveryMap) {
    throw new Error(`Unknown livery '${livery}' — the shelf is: ${GSERIES_LIVERY_SHELF.join(', ')}`);
  }

  // Resolve every distinct source hex once (sorted, so the jitter stream is
  // order-independent of manifest layout), then rewrite tints in a clone.
  const distinct = new Set();
  for (const monomer of tintSites(manifest)) distinct.add(monomer.tint.toLowerCase());
  const BREAK_ANCHORS = ['#d8d0c0', '#d6cfc2'];
  const table = {};
  const counts = {};
  const unknown = [];
  for (const hex of [...distinct].sort()) {
    const { hex: out, role, changed } = remapHex(hex, liveryMap);
    let final = out;
    if (jitter && role === 'armor' && BREAK_ANCHORS.includes(nearest(hex, GSERIES_ROLES.armor.anchors).hex)) {
      const d = Math.round((rng() * 2 - 1) * 4);
      const p = rgb(out);
      final = toHex([p[0] + d, p[1] + d, p[2] + d]);
    }
    if (role) counts[role] = counts[role] || 0;
    if (changed || final !== hex) table[hex] = final;
    if (!role) unknown.push(hex);
  }

  const clone = structuredClone(manifest);
  for (const monomer of tintSites(clone)) {
    const hex = monomer.tint.toLowerCase();
    const hit = classifyGSeriesHex(hex);
    if (hit) counts[hit.role] = (counts[hit.role] || 0) + 1;
    if (table[hex]) monomer.tint = table[hex];
  }

  return { manifest: clone, livery, seed, picked, remapped: table, counts, unknown };
}
