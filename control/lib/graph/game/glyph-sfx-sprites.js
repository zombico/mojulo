/**
 * glyph-sfx-sprites — the GAME SFX backend (game-ui-language.plan.md §V, geometry-only decision
 * 2026-07-08). Verbs render as ADDITIVE CAMERA-FACING SPRITES, not a raymarch overlay: one sprite
 * per emission bead, moved each frame along the verb's parametric path. Cost is O(beads) per frame
 * (a few hundred sprites), the same near-free class as a static glow sprite — no fullscreen march.
 *
 * This module is the AUTHORITATIVE verb-path shelf. The old raymarch composer (glyph-sfx.js) built
 * the same paths as GLSL; that path is retired for game sfx, so the math lives here in JS as the one
 * source of truth. Each verb is a pure function `(cc, ph, p) → [{ p:[x,y,z], w }]`:
 *   cc = world anchor · ph = uTime × rate (seconds) · p = merged params · w = bead brightness [0..1].
 * The in-page channel ([spriteSfxChannelScript]) creates a sprite pool per layer and, each frame,
 * evaluates the verb and writes position/scale/opacity — deterministic in `ph`, so bakes reproduce.
 *
 * MECHANISMS: 'bead' (points on a path) and 'field' (a soft blob / stacked column). 'extinction'
 * (kokusen — darkness that ABSORBS) has no additive-sprite equivalent and is DEFERRED to a later
 * dark-mesh treatment; it is absent from this shelf.
 */

const TAU = Math.PI * 2;
const frac = (x) => x - Math.floor(x);
// a small deterministic hash matching the spike's scatter (its own impl — not the GLSL vrHash13).
const hsh = (a, b) => frac(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);

// Each verb: { mechanism, rate, defaults, beads(cc, ph, p) → [{ p, w }] }. Params/defaults mirror
// the retired SFX_VERBS so colours/sizes/anchors carry over unchanged.
export const SPRITE_VERBS = {
  enchant: {
    mechanism: 'bead', rate: 1.0, defaults: { color: [0.2, 1.0, 0.75], orbitR: 0.85, cz: 0.62 },
    beads: (cc, ph, p) => { const o = []; for (let w = 0; w < 2; w++) for (let k = 0; k < 8; k++) { const A = ph + w * Math.PI - k * 0.35; o.push({ p: [cc[0] + p.orbitR * Math.cos(A), cc[1] + p.orbitR * Math.sin(A), cc[2] + p.cz + 0.22 * Math.sin(2 * A + w * 1.57)], w: Math.exp(-0.5 * k) }); } return o; },
  },
  heal: {
    mechanism: 'bead', rate: 1.0, defaults: { color: [1.0, 0.75, 0.4], cz: 0.12, height: 1.5 },
    beads: (cc, ph, p) => { const o = []; for (let w = 0; w < 2; w++) for (let k = 0; k < 8; k++) { const s = frac(ph / TAU + w * 0.5 - k * 0.045), A = s * 12.566 + w * Math.PI, r = 0.5 * (1 - 0.3 * s); o.push({ p: [cc[0] + r * Math.cos(A), cc[1] + r * Math.sin(A), cc[2] + p.cz + p.height * s], w: Math.sin(Math.PI * s) * Math.exp(-0.3 * k) }); } return o; },
  },
  charge: {
    mechanism: 'bead', rate: 1.0, defaults: { color: [0.55, 0.75, 1.0], cz: 0.65 },
    beads: (cc, ph, p) => { const o = []; for (let w = 0; w < 2; w++) for (let k = 0; k < 8; k++) { const s = 1 - frac(ph / TAU + w * 0.5 - k * 0.05), A = s * 9.42478 + w * Math.PI, r = 0.15 + 1.3 * s; o.push({ p: [cc[0] + r * Math.cos(A), cc[1] + r * Math.sin(A), cc[2] + p.cz + 0.55 * s], w: (0.15 + 0.85 * (1 - s) * (1 - s)) * Math.sin(Math.PI * s) }); } return o; },
  },
  hit: {
    mechanism: 'bead', rate: 1.0, defaults: { color: [1.0, 0.35, 0.15], cz: 0.75 },
    beads: (cc, ph, p) => { const o = []; const s0 = frac(ph / TAU); for (let j = 0; j < 6; j++) for (let k = 0; k < 4; k++) { const s = Math.max(s0 - k * 0.05, 0), A = j * 1.0472 + 0.35, e = 1 - (1 - s) * (1 - s), r = 0.25 + 1.35 * e; o.push({ p: [cc[0] + r * Math.cos(A), cc[1] + r * Math.sin(A), cc[2] + p.cz + 0.8 * s - 0.85 * s * s], w: (1 - s) * (1 - s) * Math.exp(-0.6 * k) }); } return o; },
  },
  accumulate: {
    mechanism: 'bead', rate: 1.0, defaults: { color: [0.75, 0.45, 1.0], reach: 2.1, cz: 0.65 },
    beads: (cc, ph, p) => { const o = []; for (let w = 0; w < 3; w++) for (let k = 0; k < 10; k++) { const s = frac(ph / TAU + w * 0.3333 - k * 0.03), A = s * 18.85 + w * 2.094, r = 0.18 + p.reach * s; o.push({ p: [cc[0] + r * Math.cos(A), cc[1] + r * Math.sin(A), cc[2] + p.cz + 1.1 * s * s], w: Math.min(Math.pow(1 - s, 1.6), 0.55) * Math.exp(-0.25 * k) + 0.02 }); } return o; },
  },
  ward: {
    mechanism: 'bead', rate: 1.0, defaults: { color: [1.0, 0.85, 0.35], ringR: 0.95, cz: 0.72 },
    beads: (cc, ph, p) => { const o = []; for (let w = 0; w < 3; w++) for (let k = 0; k < 6; k++) { const A = ph + w * 2.094 - k * 0.22; o.push({ p: [cc[0] + p.ringR * Math.cos(A), cc[1] + 0.22 * Math.sin(A * 3.0), cc[2] + p.cz + 0.85 * Math.sin(A)], w: Math.exp(-0.45 * k) }); } return o; },
  },
  sparkle: {
    mechanism: 'bead', rate: 1.0, defaults: { color: [1.0, 0.95, 0.7], spread: [1.7, 1.1, 1.3], cz: 0.75 },
    beads: (cc, ph, p) => { const o = []; const sp = p.spread; for (let k = 0; k < 12; k++) { const q = [cc[0] + (hsh(k, 3.1) - 0.5) * sp[0], cc[1] + (hsh(k, 11.3) - 0.5) * sp[1], cc[2] + p.cz + (hsh(k, 5.7) - 0.5) * sp[2]]; const tw = frac(ph / TAU + hsh(k, 1.0)); o.push({ p: q, w: Math.pow(Math.max(Math.sin(Math.PI * tw), 0), 8) }); } return o; },
  },
  drain: {
    mechanism: 'bead', rate: 1.0, defaults: { color: [0.45, 0.9, 0.35], cz: 1.5 },
    beads: (cc, ph, p) => { const o = []; for (let w = 0; w < 2; w++) for (let k = 0; k < 8; k++) { const s = frac(ph / TAU + w * 0.5 - k * 0.04), A = -s * 9.42478 + w * Math.PI, r = 0.25 + 1.1 * s; o.push({ p: [cc[0] + r * Math.cos(A), cc[1] + r * Math.sin(A), cc[2] + p.cz - 1.45 * s], w: Math.pow(1 - s, 1.5) * Math.sin(Math.PI * s) * Math.exp(-0.3 * k) }); } return o; },
  },
  aura: {
    mechanism: 'field', rate: 1.0, defaults: { color: [0.6, 0.8, 1.0], base: 0.55, pulse: 0.35, cz: 0.65 },
    beads: (cc, ph, p) => [{ p: [cc[0], cc[1], cc[2] + p.cz], w: p.base + p.pulse * (0.5 + 0.5 * Math.sin(ph)) }],
  },
  // beacon — a breathing vertical column (goal marker). A ground pool + a stack of climbing sprites.
  beacon: {
    mechanism: 'field', rate: 1.0, defaults: { color: [0.27, 0.77, 0.41], height: 4.2, cz: 0.05, count: 9 },
    beads: (cc, ph, p) => { const o = [{ p: [cc[0], cc[1], cc[2] + p.cz], w: 0.9 }]; const n = p.count | 0; for (let k = 0; k < n; k++) { const u = k / (n - 1); o.push({ p: [cc[0], cc[1], cc[2] + 0.3 + p.height * u], w: (0.55 + 0.35 * Math.sin(ph * 1.5 - u * 3.0)) * (1 - 0.4 * u) }); } return o; },
  },
};

export const SPRITE_VERB_IDS = Object.keys(SPRITE_VERBS);

// Verbs the geometry backend cannot render additively (they absorb light) — surfaced so callers can
// warn/skip rather than silently drop. Deferred to a dark-mesh treatment (plan §V promotion #2).
export const DEFERRED_VERBS = ['kokusen', 'ssj-aura'];

/**
 * beadsFor(verb, cc, ph, params) → [{ p:[x,y,z], w }] — evaluate one verb's beads at phase `ph`
 * (seconds). Unknown/deferred verb → []. `params` overrides the verb defaults (color is carried by
 * the channel, not here). Pure + deterministic.
 */
export function beadsFor(verb, cc, ph, params = {}) {
  const V = SPRITE_VERBS[verb];
  if (!V || !Array.isArray(cc) || cc.length !== 3) return [];
  return V.beads(cc, ph, { ...V.defaults, ...params });
}

/**
 * resolveSpriteSfxLayers(sfxSpec, entities) → [{ verb, cc, color, rate, size, params }] with anchors
 * resolved from `at:[x,y,z]` or `on:'<entityId>'`. Mirrors resolveSfxLayers (the raymarch resolver)
 * so the manifest `sfx` surface is unchanged. Unknown/deferred verbs and unresolvable anchors drop.
 */
export function resolveSpriteSfxLayers(sfxSpec, entities) {
  const list = Array.isArray(sfxSpec) ? sfxSpec : [];
  const byId = {};
  for (const e of Array.isArray(entities) ? entities : []) if (e && e.id) byId[e.id] = e;
  const out = [];
  for (const L of list) {
    if (!L || !SPRITE_VERBS[L.verb]) continue;
    let at = Array.isArray(L.at) && L.at.length === 3 ? L.at : null;
    if (!at && L.on && byId[L.on] && byId[L.on].transform && Array.isArray(byId[L.on].transform.pos)) at = byId[L.on].transform.pos;
    if (!at) continue;
    const V = SPRITE_VERBS[L.verb];
    out.push({ verb: L.verb, cc: at, color: L.color || V.defaults.color, rate: Number.isFinite(L.rate) ? L.rate : V.rate, size: Number.isFinite(L.size) ? L.size : 0.6, params: L.params || {} });
  }
  return out;
}
