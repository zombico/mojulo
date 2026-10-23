/**
 * playscape aura — SPIRIT ONIONS: the form of a power-up, drawn as overlapping onion shells round a centre, each shell a
 * ring of flat petals along an onion's profile (a round bulb rising to a point), each shell spinning its own way at its
 * own rate, and rings of spikes round them, each ring turning at its own interval. Cel by nature: a petal is one flat
 * band (light, mid or shade, by how it faces the eye), a spike a flat blade with a lighter core. Closed form in time;
 * the page runs these same sources.
 *
 *   aura: '<preset>' | { onions?: [onion], spikes?: [ring], color?, from? }
 *     onion  { r: 0.9 m the bulb's widest, h: 2.2 m base to tip, z: 0 m off the centre's foot, petals: 7, width: 0.55 (a
 *              petal's share of its slot), turn: 0.4 turns a second (below 0 the other way), phase: 0, twist: 0.15 (turns,
 *              base to tip: the petals lean as they rise), pulse: 0.05 (its breath, a share of its size), hz: 1.2 }
 *     ring   { count: 8, r: 1.1 m, z: 0.9 m, len: 0.6 m, width: 0.16 m, tilt: 35° up from level, turn: 0.7 turns a
 *              second, phase: 0, flick: 0.25 (a share each spike's length flickers by), hz: 3 }
 *
 *   AURAS / AURA_NAMES        presets, by what they do
 *   readAura(v, where)        a preset's name or a spec → the aura, every field filled (teaches on a bad one)
 *   scaleAura(A, k, zk?)      the aura k times its size (z by zk, k by default): a blast's fire sized to its blast
 *   onionPetals(O, cc, t, k)  one onion's petals at t s round foot cc, k its grown share (0..1): [{ L, R, a }] each
 *                             petal's two edges base to tip, and the angle it faces (the page shades by it)
 *   spikeTips(S, cc, t, k)    one ring's spikes: [{ b, tip, a }]
 *   auraBands(c)              the three flat bands a colour is drawn in: [light, mid, shade]
 *   auraSignature(A)          what reads with the colour taken out
 */
import { FIRE_COLORANTS } from '../../fire/fire.js';

// (its colour read here, as elements.js reads one: elements.js reads an aura as a look's layer, so this file does not
// import it back)
const HEX = /^#[0-9a-f]{6}$/i;
function colourOf(c, where) {
  if (typeof c === 'string' && FIRE_COLORANTS[c]) return FIRE_COLORANTS[c].slice();
  if (typeof c === 'string' && HEX.test(c)) return [1, 3, 5].map((i) => Math.round((parseInt(c.slice(i, i + 2), 16) / 255) * 1000) / 1000);
  if (Array.isArray(c) && c.length === 3 && c.every((x) => typeof x === 'number' && x >= 0 && x <= 1)) return c.slice();
  throw new Error(`${where} is '#rrggbb', [r, g, b] in 0..1, or a colorant (${Object.keys(FIRE_COLORANTS).join(', ')})`);
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);

// each field: [default, lo, hi, what it is]
const ONION = {
  r: [0.9, 0.05, 30, 'metres, the bulb at its widest'], h: [2.2, 0.1, 60, 'metres, base to tip'], z: [0, -30, 60, 'metres off the foot'],
  petals: [7, 2, 24, 'petals round the shell'], width: [0.55, 0.1, 1, 'a petal\'s share of its slot'], turn: [0.4, -6, 6, 'turns a second'],
  phase: [0, 0, 1, 'a share of a turn'], twist: [0.15, -2, 2, 'turns base to tip'], pulse: [0.05, 0, 0.5, 'a share of its size'], hz: [1.2, 0, 12, 'breaths a second'],
};
const RING = {
  count: [8, 1, 48, 'spikes round the ring'], r: [1.1, 0, 40, 'metres out'], z: [0.9, -30, 60, 'metres off the foot'], len: [0.6, 0.02, 30, 'metres'],
  width: [0.16, 0.005, 10, 'metres at the base'], tilt: [35, -90, 90, 'degrees up from level'], turn: [0.7, -6, 6, 'turns a second'],
  phase: [0, 0, 1, 'a share of a turn'], flick: [0.25, 0, 0.9, 'a share of its length'], hz: [3, 0, 24, 'flickers a second'],
};
const fill = (o, F, where) => {
  if (!isObj(o)) throw new Error(`${where} is { ${Object.keys(F).join(', ')} }`);
  const bad = Object.keys(o).filter((k) => !F[k]);
  if (bad.length) throw new Error(`${where} has no ${bad.join(', ')}: it is { ${Object.keys(F).join(', ')} }`);
  const out = {};
  for (const [k, [d, lo, hi, say]] of Object.entries(F)) {
    const x = o[k] ?? d;
    if (!(num(x) && x >= lo && x <= hi)) throw new Error(`${where}.${k} is ${say}, ${lo} to ${hi}`);
    out[k] = x;
  }
  return out;
};

/** A preset's name or a spec → the aura, every onion and ring filled. */
export function readAura(v, where = 'aura') {
  if (typeof v === 'string') { if (!AURAS[v]) throw new Error(`${where} '${v}' is not an aura: ${AURA_NAMES.join(', ')}, or its onions and spikes`); return AURAS[v]; }
  if (!isObj(v)) throw new Error(`${where} is an aura: a preset's name (${AURA_NAMES.join(', ')}) or { onions?, spikes?, color? }`);
  const bad = Object.keys(v).filter((k) => !['onions', 'spikes', 'color'].includes(k));
  if (bad.length) throw new Error(`${where} has no ${bad.join(', ')}: an aura is { onions?, spikes?, color? }`);
  const list = (x) => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
  const onions = list(v.onions).map((o, i) => fill(o, ONION, `${where}.onions[${i}]`));
  const spikes = list(v.spikes).map((o, i) => fill(o, RING, `${where}.spikes[${i}]`));
  if (!onions.length && !spikes.length) throw new Error(`${where} has neither onions nor spikes`);
  return { onions, spikes, ...(v.color !== undefined ? { color: colourOf(v.color, `${where}.color`) } : {}) };
}

/** The aura k times its size (its heights by zk): its spin and flicker as they were. */
export function scaleAura(A, k, zk = k) {
  const r = (x) => Math.round(x * 1e4) / 1e4;
  return { ...A, onions: A.onions.map((o) => ({ ...o, r: r(o.r * k), h: r(o.h * zk), z: r(o.z * zk) })), spikes: A.spikes.map((s) => ({ ...s, r: r(s.r * k), z: r(s.z * zk), len: r(s.len * k), width: r(s.width * k) })) };
}

/** One onion's petals at t s round foot cc, grown to k. The page runs this source. */
export function onionPetals(O, cc, t, k) {
  const TAU = 6.283185307179586, N = 10, out = [];
  // the profile: a round bulb rising to a point (its widest a little below the middle), 1 at its widest
  const prof = (s) => Math.sin(Math.PI * Math.pow(s, 0.72)) * Math.pow(1 - s, 0.3) / 0.876;
  const g = k * (1 + O.pulse * Math.sin(TAU * O.hz * t + TAU * O.phase)), hw = (Math.PI * O.width) / O.petals;
  for (let j = 0; j < O.petals; j++) {
    const a0 = TAU * (O.phase + j / O.petals + O.turn * t), L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N, a = a0 + TAU * O.twist * s, rho = O.r * g * prof(s), z = cc[2] + O.z * k + O.h * g * s;
      L.push([cc[0] + rho * Math.cos(a - hw), cc[1] + rho * Math.sin(a - hw), z]);
      R.push([cc[0] + rho * Math.cos(a + hw), cc[1] + rho * Math.sin(a + hw), z]);
    }
    out.push({ L, R, a: a0 + TAU * O.twist * 0.4 });
  }
  return out;
}

/** One ring's spikes at t s round foot cc, grown to k: each its base, its tip and the angle it points. The page runs
 *  this source. */
export function spikeTips(S, cc, t, k) {
  const TAU = 6.283185307179586, out = [], ct = Math.cos((S.tilt * Math.PI) / 180), st = Math.sin((S.tilt * Math.PI) / 180);
  for (let j = 0; j < S.count; j++) {
    const a = TAU * (S.phase + j / S.count + S.turn * t), len = S.len * k * (1 + S.flick * Math.sin(TAU * S.hz * t + j * 7.31));
    const b = [cc[0] + S.r * k * Math.cos(a), cc[1] + S.r * k * Math.sin(a), cc[2] + S.z * k];
    out.push({ b, tip: [b[0] + Math.cos(a) * ct * len, b[1] + Math.sin(a) * ct * len, b[2] + st * len], a });
  }
  return out;
}

/** The three flat bands a colour is drawn in: a light one (a little toward white: the colour still leads), the colour
 *  pushed to full chroma, a shade (darker, warmer). */
export function auraBands(c) {
  const r3 = (x) => Math.round(Math.max(0, Math.min(1, x)) * 1000) / 1000, mx = Math.max(...c), mn = Math.min(...c);
  const full = mx - mn < 1e-6 ? c : c.map((x) => (x - mn) / (mx - mn) * mx * 0.95 + mn * 0.05);
  return [full.map((x) => r3(x + (1 - x) * 0.3)), full.map(r3), [r3(full[0] * 0.66 + 0.05), r3(full[1] * 0.46), r3(full[2] * 0.5)]];
}

/** What reads with the colour taken out: how many shells, which ways they spin, how many rings and spikes. */
export function auraSignature(A) {
  const way = (x) => (x > 0 ? '↻' : x < 0 ? '↺' : '·');
  return [`${A.onions.length} onions ${A.onions.map((o) => `${o.petals}${way(o.turn)}`).join(' ')}`, `${A.spikes.length} rings ${A.spikes.map((s) => `${s.count}${way(s.turn)}`).join(' ')}`].join(' | ');
}

// ── presets ────────────────────────────────────────────────────────────────────────────────────────────────────────
const A = (spec) => readAura(spec, 'preset');
export const AURAS = Object.freeze({
  // powering up: three shells round the body, the inner fast one way, the outer slow the other, and two rings of spikes
  // turning against each other at their own intervals
  'power-up': A({
    onions: [{ r: 0.55, h: 2.0, petals: 6, width: 0.6, turn: 0.9, twist: 0.2, pulse: 0.06, hz: 1.6 }, { r: 0.8, h: 2.35, petals: 8, width: 0.5, turn: -0.45, phase: 0.31, twist: -0.12, pulse: 0.05, hz: 1.1 }, { r: 1.05, h: 2.7, petals: 9, width: 0.38, turn: 0.22, phase: 0.57, twist: 0.08, pulse: 0.04, hz: 0.7 }],
    spikes: [{ count: 9, r: 0.95, z: 0.35, len: 0.75, width: 0.17, tilt: 62, turn: 0.55, flick: 0.3, hz: 4 }, { count: 7, r: 0.7, z: 1.5, len: 0.6, width: 0.14, tilt: 70, turn: -0.8, phase: 0.2, flick: 0.35, hz: 5.5 }],
  }),
  // a blast's fire as spirit onions (sized to the blast by scaleAura): squat shells spinning fast, spikes thrown flat out
  burst: A({
    onions: [{ r: 1, h: 1.6, petals: 7, width: 0.6, turn: 1.4, twist: 0.25, pulse: 0.08, hz: 3 }, { r: 1.3, h: 2, petals: 9, width: 0.45, turn: -0.9, phase: 0.4, twist: -0.18, pulse: 0.06, hz: 2.2 }],
    spikes: [{ count: 12, r: 1.15, z: 0.3, len: 1.1, width: 0.24, tilt: 18, turn: 0.6, flick: 0.35, hz: 6 }, { count: 8, r: 0.9, z: 0.9, len: 0.8, width: 0.2, tilt: 45, turn: -1.1, phase: 0.15, flick: 0.4, hz: 7 }],
  }),
});
export const AURA_NAMES = Object.freeze(Object.keys(AURAS));
