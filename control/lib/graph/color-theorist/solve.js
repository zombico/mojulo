/**
 * THE COLOR THEORIST — a palette solved for what a world is trying to be, instead of picked off a short shelf of kits.
 *
 * A palette SPEC is what a recipe stores: a seed and whatever the agent read from the world's intent —
 *   { seed, intent?, heat?, weight?, activity?, scheme?, key?, hue?, hues?, lock?, shift?, script? }
 * heat (cool −1 … warm 1), weight (light −1 … heavy 1) and activity (calm −1 … active 1) are the three colour-emotion
 * factors that held across cultures (Ou, Luo et al. 2004); the agent reads the words, this file never does. What the
 * spec leaves out is rolled from its seed. The CONTRACT is what the spec solves to, every time the same:
 *   { id, spec, read, roles: { <role>: ['#hex' × 5] }, light, shadow, fog, ui, checks }
 *
 * The order is the art director's, not the colour wheel's (hue templates alone do not predict a palette people like:
 * O'Donovan, Agarwala & Hertzmann 2011):
 *   1. VALUE: the key (high / mid / low) sets every role's band of lightness; the sky is the brightest thing by day
 *   2. CHROMA: activity sets the ceiling; most roles stay well under it, the accent spends it
 *   3. HUE: the scheme only says how the hues relate — the world's (A), its secondary (B), its accent (C, C2)
 *   4. TEMPERATURE: each ramp leans to the world's shadow hue below its middle and to its light hue above
 *   5. CHECKS: candidates are sampled from the seed and the one the laws like best is kept (Huemint's way)
 *
 *   readPaletteSpec(v, at) → the spec as written, checked (false stays false: the stock look)
 *   solvePalette(spec)     → the contract
 *   scriptShift(script, i, n) → the shift a world's colour script gives its i-th of n levels (a `shift` moves a palette
 *                          and keeps its identity: the same seed and candidate, its hues turned, its values moved)
 *   rampOf(contract, role, n) → that role's ramp at n stops ([r, g, b]), for a kit whose ramps are other lengths
 *   PALETTE_SCHEMES, PALETTE_KEYS, PALETTE_ROLES, PALETTE_LAWS, PALETTE_SCRIPTS
 *
 * Pure: seeded dice only. The output for a spec is a compatibility promise over every recipe that stores one.
 */
import { oklch, lchOf, rgbToHex, hexToRgb, deltaE, contrast, apca, simulate, CVD_KINDS, mixHue, wrapHue, hueGap, gamutLoss, rgbToOklab, oklabToRgb } from './oklab.js';
import { luma, chroma } from '../era/look-facets.js';
import { COLOURS } from '../gameworld/tunnel-land.js';
import { SWATCHES } from '../era/style/swatches.js';
import { STYLE_DEFAULTS } from '../game/hud-widgets.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A short print of a value (FNV-1a over its JSON), for ids a content decides. */
export function fingerprint(v) { let h = 2166136261; for (const c of JSON.stringify(v)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); }
const streamOf = (seed, key) => { let h = 2166136261 >>> 0; for (const c of `${seed}|palette-v1|${key}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return mulberry32(h); };

/** How the hues relate (degrees from the world's hue A): its secondary B, its accent C, a second accent C2. `mute`
 * takes every role but the accents down (a grey world and one colour: Inside). */
export const PALETTE_SCHEMES = Object.freeze({
  analogous: { B: 35, C: -40, C2: 70, says: 'neighbours on the wheel; the accent pops by chroma and value, not hue' },
  complementary: { B: 180, C: 30, C2: 210, says: 'the world and its sky opposite; the accent beside the world' },
  'split-complementary': { B: 150, C: 210, C2: 30, says: 'the world against the two neighbours of its opposite' },
  triad: { B: 120, C: 240, C2: 30, says: 'three hues a third of the wheel apart' },
  tetrad: { B: 90, C: 180, C2: 270, says: 'four hues a quarter apart: rich, held together by value' },
  'mono-accent': { B: 0, C: 180, C2: 200, mute: 0.3, says: 'one hue, nearly grey, and one accent for what matters' },
  duotone: { B: 180, C: 180, C2: 0, mute: 0.7, says: 'two hues only; the accent is the second, lifted and bright' },
});
export const PALETTE_SCHEME_IDS = Object.freeze(Object.keys(PALETTE_SCHEMES));
/** The key: where the values sit. */
export const PALETTE_KEYS = Object.freeze({ high: 'light and airy', mid: 'a full range', low: 'dark and heavy: dusk, night, the deep' });

// The roles: each a band of lightness (mid key), a share of the chroma ceiling, and the hue it takes. `sky`/`cloud`
// are light ramps (zenith to horizon); `far` is not solved but laid between the ground and the sky (aerial
// perspective); `accent` is placed in value against the ground so it reads in grey.
const ROLES = Object.freeze({
  sky: { L: [0.64, 0.93], c: 0.42, slot: 'B', airy: true },
  cloud: { L: [0.74, 0.97], c: 0.14, slot: 'B', airy: true },
  far: { derived: true },
  ground: { L: [0.32, 0.84], c: 0.72, slot: 'A' },
  foliage: { L: [0.26, 0.76], c: 0.78, slot: 'F' },
  soil: { L: [0.30, 0.78], c: 0.42, slot: 'E' },
  rock: { L: [0.28, 0.82], c: 0.2, slot: 'B' },
  bark: { L: [0.24, 0.58], c: 0.38, slot: 'E' },
  made: { L: [0.28, 0.76], c: 0.45, slot: 'E' },
  rope: { L: [0.42, 0.82], c: 0.32, slot: 'E' },
  accent: { L: null, c: 1, slot: 'C', accent: true },
  accent2: { L: [0.44, 0.88], c: 0.9, slot: 'C2', accent: true },
});
export const PALETTE_ROLES = Object.freeze(Object.keys(ROLES));

/** AIR: what the sky is made of. `full` is a world with air (the roles above). `thin` (Mars, Titan): the sky the dust's
 * hue, pale and quiet; the far layers half as hazed. `none` (vacuum): the sky is the void, near-black and tinted, the
 * same in every key (`fixed`); a nebula for the clouds; the land regolith and ice, low in chroma; the colour in the
 * hulls (`made`), the cables and trim (`rope`), the lights (`accent`) and the engine glow or a planet (`accent2`). */
export const PALETTE_AIRS = Object.freeze({ full: 'a world with air: the sky the brightest thing, distance hazed', thin: 'a thin, dusty air: a pale sky the dust\'s colour, a little haze', none: 'vacuum: the void for a sky, no haze, hard light, the shade lit by a planet' });
const AIR_ROLES = Object.freeze({
  full: ROLES,
  thin: Object.freeze({ ...ROLES, sky: { L: [0.6, 0.9], c: 0.3, slot: 'E', airy: true }, cloud: { L: [0.72, 0.95], c: 0.12, slot: 'E', airy: true } }),
  none: Object.freeze({
    sky: { L: [0.18, 0.32], c: 0.12, slot: 'B', airy: true, fixed: true, floor: 0.16 },
    cloud: { L: [0.26, 0.6], c: 0.8, slot: 'C2', airy: true, fixed: true, floor: 0.2 },
    far: { derived: true },
    ground: { L: [0.3, 0.88], c: 0.15, slot: 'A' },
    foliage: { L: [0.42, 0.93], c: 0.5, slot: 'B' },
    soil: { L: [0.34, 0.86], c: 0.18, slot: 'A' },
    rock: { L: [0.24, 0.8], c: 0.12, slot: 'A' },
    bark: { L: [0.22, 0.5], c: 0.18, slot: 'E' },
    made: { L: [0.3, 0.9], c: 0.4, slot: 'B' },
    rope: { L: [0.28, 0.72], c: 0.55, slot: 'C2' },
    accent: ROLES.accent,
    accent2: { L: [0.5, 0.92], c: 1, slot: 'C2', accent: true },
  }),
});
// how far the far layers go toward the sky: [start, span] of the mix (vacuum: a little toward the void, the farthest
// the darkest, so the ramp still climbs)
const FAR_MIX = Object.freeze({ full: [0.45, 0.45], thin: [0.3, 0.3], none: [0.22, -0.16] });

/** PRESETS: a starting spec for a kind of place (its own fields over it). Space first; the void is named blue-black to
 * violet-black (a void rolled with the scheme can come out brown). */
export const PALETTE_PRESETS = Object.freeze({
  moon: { says: 'grey regolith under a black sky, a white sun, the shade lit by the planet', spec: { air: 'none', hues: { sky: 255 }, heat: -0.1, weight: 0.5, activity: -0.85, scheme: 'mono-accent', key: 'mid' } },
  'asteroid-belt': { says: 'dark carbon rock, a warm hard sun, ice glints and running lights', spec: { air: 'none', hues: { sky: 240 }, heat: 0.15, weight: 0.75, activity: -0.4, scheme: 'complementary', key: 'low' } },
  mars: { says: 'rust dust under a pale butterscotch sky', spec: { air: 'thin', heat: 0.75, weight: 0.1, activity: -0.1, scheme: 'analogous', hue: 'rust' } },
  'icy-moon': { says: 'a bright ice crust, blue in its cracks, a banded giant overhead', spec: { air: 'none', hues: { sky: 228 }, heat: -0.8, weight: -0.4, activity: -0.3, scheme: 'analogous', key: 'high' } },
  station: { says: 'painted hull, cable runs and warning stripes against the void', spec: { air: 'none', hues: { sky: 250 }, heat: -0.3, weight: 0.3, activity: 0.2, scheme: 'split-complementary', key: 'mid' } },
  'deep-space': { says: 'a space sim: the void, a vivid nebula, neon on the HUD', spec: { air: 'none', hues: { sky: 275 }, heat: -0.5, weight: 0.9, activity: 0.75, scheme: 'triad', key: 'low' } },
});
export const PALETTE_PRESET_IDS = Object.freeze(Object.keys(PALETTE_PRESETS));
/** A spec over its preset: its own fields win, its own hues over the preset's role by role. */
const overPreset = (spec) => {
  const P = spec.preset ? PALETTE_PRESETS[spec.preset].spec : null;
  if (!P) return spec;
  const hues = P.hues || spec.hues ? { ...(P.hues ?? {}), ...(spec.hues ?? {}) } : undefined;
  return { ...P, ...spec, ...(hues ? { hues } : {}) };
};
const LOCKABLE = PALETTE_ROLES.filter((r) => !ROLES[r].derived);
// how much of a world each role covers, roughly (for the hue-family count)
const COVER = { sky: 3, cloud: 1, ground: 4, foliage: 2, soil: 1, rock: 1.5, bark: 0.4, made: 1, rope: 0.2 };
const SPEC_KEYS = ['seed', 'intent', 'heat', 'weight', 'activity', 'scheme', 'key', 'hue', 'hues', 'lock', 'shift', 'script', 'air', 'preset'];
// a shift: the same palette moved (its seed, its candidate, its hue relations kept)
const SHIFT_RANGE = Object.freeze({ turn: [-180, 180, 'degrees every hue turns'], light: [-1, 1, 'toward night (−1) or day (1)'], chroma: [0.25, 2, 'chroma scaled'], warm: [-1, 1, 'hues and the light pulled cool (−1) or warm (1)'] });
const NEUTRAL = Object.freeze({ turn: 0, light: 0, chroma: 1, warm: 0 });

/** COLOUR SCRIPTS: a world's palette moved level by level along an arc (keyframes at 0…1 over the world's levels, in
 * their written order), the way a film's colour script moves one palette through its acts. */
export const PALETTE_SCRIPTS = Object.freeze({
  dusk: { says: 'day into night: gold at the middle, a cool dark at the end', keys: [[0, {}], [0.5, { warm: 0.6, light: -0.2, chroma: 1.15 }], [1, { warm: -0.5, light: -0.8, chroma: 0.75 }]] },
  dawn: { says: 'night into day: a cool dark first, gold, then the day', keys: [[0, { warm: -0.5, light: -0.8, chroma: 0.75 }], [0.5, { warm: 0.6, light: -0.2, chroma: 1.15 }], [1, {}]] },
  descent: { says: 'deeper and quieter: each level darker, colder and greyer', keys: [[0, {}], [1, { light: -0.8, chroma: 0.6, warm: -0.4 }]] },
  thaw: { says: 'cold and grey to warm and full', keys: [[0, { warm: -0.8, chroma: 0.45, light: 0.25 }], [1, { warm: 0.5, chroma: 1.5 }]] },
  fever: { says: 'rising: louder, hotter and darker toward the end', keys: [[0, {}], [1, { chroma: 1.5, warm: 0.5, light: -0.3, turn: -20 }]] },
  journey: { says: 'the hues travel a third of the wheel; the values hold', keys: [[0, {}], [1, { turn: 120 }]] },
  seasons: { says: 'spring, summer, autumn, winter', keys: [[0, { warm: -0.1, chroma: 1.25, light: 0.1 }], [1 / 3, { warm: 0.3, chroma: 1.45 }], [2 / 3, { warm: 0.85, turn: -30, chroma: 1.2 }], [1, { warm: -0.8, chroma: 0.4, light: 0.25 }]] },
});
export const PALETTE_SCRIPT_IDS = Object.freeze(Object.keys(PALETTE_SCRIPTS));

/** The shift a script gives the i-th of n levels (null where it moves nothing). */
export function scriptShift(script, i, n) {
  const S = PALETTE_SCRIPTS[script];
  if (!S) throw new Error(`palette: script is one of ${PALETTE_SCRIPT_IDS.join(', ')}`);
  const t = n <= 1 ? 0 : i / (n - 1), K = S.keys;
  let j = 0;
  while (j < K.length - 2 && t > K[j + 1][0]) j += 1;
  const [t0, a] = K[j], [t1, b] = K[Math.min(j + 1, K.length - 1)], u = t1 > t0 ? clamp((t - t0) / (t1 - t0), 0, 1) : 0;
  const out = {};
  for (const [k, z] of Object.entries(NEUTRAL)) {
    const v = r3((a[k] ?? z) + ((b[k] ?? z) - (a[k] ?? z)) * u);
    if (Math.abs(v - z) > 1e-9) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}
const CANDIDATES = 12;

const HEX = /^#[0-9a-fA-F]{6}$/;
/** A hue named: degrees (OKLCH), a '#hex', or a colour word (the land tunnel's: rust, teal, violet …). */
function hueOf(v) {
  if (typeof v === 'number') return wrapHue(v);
  if (typeof v === 'string' && HEX.test(v)) return lchOf(hexToRgb(v))[2];
  if (typeof v === 'string' && COLOURS[v.toLowerCase()]) return lchOf(COLOURS[v.toLowerCase()])[2];
  return null;
}
const hueWords = () => Object.keys(COLOURS).join(', ');

/** The spec as written, checked; `false` (the stock look) and `'auto'` (a seed rolled where it is stored) pass. */
export function readPaletteSpec(v, at = 'palette') {
  if (v === false || v === 'auto') return v;
  if (isObj(v) && isObj(v.spec) && Array.isArray(v.checks)) return readPaletteSpec(v.spec, at);   // a contract handed back
  if (!isObj(v)) throw new Error(`${at} is a palette spec { ${SPEC_KEYS.join('?, ')}? } (pick_palette solves and shows one), 'auto', or false (the stock look)`);
  for (const k of Object.keys(v)) if (!SPEC_KEYS.includes(k)) throw new Error(`${at}.${k} is not part of a palette spec (${SPEC_KEYS.join(', ')})`);
  if (v.seed !== undefined && !(Number.isInteger(v.seed) && v.seed >= 1)) throw new Error(`${at}.seed is a whole number from 1`);
  if (v.intent !== undefined && typeof v.intent !== 'string') throw new Error(`${at}.intent is the words the palette was read from`);
  for (const k of ['heat', 'weight', 'activity']) if (v[k] !== undefined && !(typeof v[k] === 'number' && v[k] >= -1 && v[k] <= 1)) throw new Error(`${at}.${k} is −1 to 1 (${{ heat: 'cool to warm', weight: 'light to heavy', activity: 'calm to active' }[k]})`);
  if (v.scheme !== undefined && !PALETTE_SCHEMES[v.scheme]) throw new Error(`${at}.scheme is one of ${PALETTE_SCHEME_IDS.join(', ')}`);
  if (v.key !== undefined && !PALETTE_KEYS[v.key]) throw new Error(`${at}.key is ${Object.keys(PALETTE_KEYS).join(', ')}`);
  if (v.hue !== undefined && hueOf(v.hue) === null) throw new Error(`${at}.hue is degrees (OKLCH, 0–360), a '#hex', or a colour word (${hueWords()})`);
  if (v.hues !== undefined) {
    if (!isObj(v.hues)) throw new Error(`${at}.hues is { <role>: hue } (roles: ${LOCKABLE.join(', ')})`);
    for (const [r, h] of Object.entries(v.hues)) {
      if (!LOCKABLE.includes(r)) throw new Error(`${at}.hues.${r} is not a role (${LOCKABLE.join(', ')})`);
      if (hueOf(h) === null) throw new Error(`${at}.hues.${r} is degrees, a '#hex', or a colour word (${hueWords()})`);
    }
  }
  if (v.shift !== undefined) {
    if (!isObj(v.shift)) throw new Error(`${at}.shift is { ${Object.keys(SHIFT_RANGE).join('?, ')}? }: the same palette moved`);
    for (const [k, x] of Object.entries(v.shift)) {
      const R = SHIFT_RANGE[k];
      if (!R) throw new Error(`${at}.shift.${k} is not part of a shift (${Object.keys(SHIFT_RANGE).join(', ')})`);
      if (!(typeof x === 'number' && x >= R[0] && x <= R[1])) throw new Error(`${at}.shift.${k} is ${R[0]} to ${R[1]} (${R[2]})`);
    }
  }
  if (v.air !== undefined && !PALETTE_AIRS[v.air]) throw new Error(`${at}.air is ${Object.entries(PALETTE_AIRS).map(([k, d]) => `${k} (${d})`).join('; ')}`);
  if (v.preset !== undefined && !PALETTE_PRESETS[v.preset]) throw new Error(`${at}.preset is one of ${PALETTE_PRESET_IDS.join(', ')}`);
  if (v.script !== undefined && !PALETTE_SCRIPTS[v.script]) throw new Error(`${at}.script is a world's colour script across its levels: ${PALETTE_SCRIPT_IDS.join(', ')}`);
  if (v.lock !== undefined) {
    if (!isObj(v.lock)) throw new Error(`${at}.lock is { <role>: '#hex' }: that role's middle stop, kept`);
    for (const [r, h] of Object.entries(v.lock)) {
      if (!LOCKABLE.includes(r)) throw new Error(`${at}.lock.${r} is not a role (${LOCKABLE.join(', ')})`);
      if (typeof h !== 'string' || !HEX.test(h)) throw new Error(`${at}.lock.${r} is a '#hex'`);
    }
  }
  return { ...v };
}

// ── the solve ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** What the spec leaves open, read from its seed: one identity per seed, whatever the candidates do. */
function readAxes(spec) {
  const seed = spec.seed ?? 1, R = streamOf(seed, 'axes'), roll = () => r3(R() * 2 - 1);
  const heat = spec.heat ?? roll(), weight = spec.weight ?? roll(), activity = spec.activity ?? roll();
  const sch = R(), scheme = spec.scheme ?? PALETTE_SCHEME_IDS[Math.floor(sch * PALETTE_SCHEME_IDS.length)];
  const key = spec.key ?? (weight > 0.35 ? 'low' : weight < -0.35 ? 'high' : 'mid');
  // the world's hue: named, or rolled in the band its heat leans to (warm 20–100°, cool 160–290°, anywhere between)
  const hr = R(), named = spec.hue !== undefined ? hueOf(spec.hue) : null;
  const hue = named ?? (heat > 0.25 ? 20 + hr * 80 : heat < -0.25 ? 160 + hr * 130 : hr * 360);
  return { seed, heat, weight, activity, scheme, key, hue: r3(wrapHue(hue)), named: named !== null, air: spec.air ?? 'full' };
}

const KEY_SHIFT = { high: [0.1, 0.04], mid: [0, 0], low: [-0.08, -0.14] };

/** One candidate's role parameters: { <role>: { L: [lo, hi], C, h, airy?, exact? } } + its light and shadow hues. */
function candidate(spec, A, k) {
  const R = streamOf(A.seed, `cand-${k}`), j = (span) => (R() * 2 - 1) * span;
  const S = PALETTE_SCHEMES[A.scheme], mute = S.mute ?? 1;
  const base = A.named ? A.hue : wrapHue(A.hue + j(14));
  const slot = { A: base, B: wrapHue(base + S.B + j(10)), C: wrapHue(base + S.C + j(12)), C2: wrapHue(base + S.C2 + j(12)) };
  slot.F = wrapHue(slot.A + j(18));
  slot.E = mixHue(wrapHue(slot.A + j(30)), 55, 0.3);   // the earth leans warm, wherever the world sits
  const cmax = 0.06 + 0.12 * ((A.activity + 1) / 2);
  // light and shadow: a warm key and a cool fill; a cold low key inverts them (a cool moon, a warm dark)
  // (in vacuum the light is the sun's, near white, and the shade is lit by the planet in the sky: its hue, C2's)
  const vac = A.air === 'none', moon = !vac && A.key === 'low' && A.heat < -0.2;
  const Hl = moon ? wrapHue(210 + j(15)) : wrapHue(80 + j(20) + A.heat * 10), Hs = vac ? wrapHue(slot.C2 + j(10)) : moon ? wrapHue(50 + j(20)) : wrapHue(260 + j(30));
  const [dlo, dhi] = KEY_SHIFT[A.key], RL = AIR_ROLES[A.air];
  const P = {};
  for (const [role, D] of Object.entries(RL)) {
    if (D.derived || D.accent) continue;
    const lo = clamp(D.L[0] + (D.fixed ? 0 : dlo), D.floor ?? 0.22, 0.9), hi = clamp(D.L[1] + (D.fixed ? 0 : dhi), lo + (D.fixed ? 0.12 : 0.18), 0.97);
    P[role] = { L: [r3(lo), r3(hi)], C: r3(cmax * D.c * mute), h: r3(spec.hues?.[role] !== undefined ? hueOf(spec.hues[role]) : slot[D.slot]), ...(D.airy ? { airy: true } : {}) };
  }
  // the sky stays the brightest thing (by day its light end above the ground's); in vacuum the void stays the darkest
  if (!vac) P.sky.L[1] = r3(Math.max(P.sky.L[1], Math.min(0.97, P.ground.L[1] + 0.05)));
  // the accent: set in value against the ground (to read in grey), spending the ceiling (never under 0.12)
  const gMid = (P.ground.L[0] + P.ground.L[1]) / 2, aMid = A.key === 'low' ? clamp(gMid + 0.24, 0.62, 0.86) : gMid <= 0.7 ? gMid + 0.18 : gMid - 0.2;
  P.accent = { L: [r3(clamp(aMid - 0.24, 0.22, 0.7)), r3(clamp(aMid + 0.22, 0.5, 0.95))], C: r3(Math.max(0.12, cmax)), h: r3(spec.hues?.accent !== undefined ? hueOf(spec.hues.accent) : slot.C) };
  const D2 = RL.accent2;
  P.accent2 = { L: [r3(D2.L[0] + dlo / 2), r3(clamp(D2.L[1] + dhi / 2, 0.6, 0.95))], C: r3(Math.max(0.1, cmax * D2.c)), h: r3(spec.hues?.accent2 !== undefined ? hueOf(spec.hues.accent2) : slot.C2) };
  // a locked role: its middle stop is the colour given, exactly; the band slides to centre on it
  for (const [role, hex] of Object.entries(spec.lock ?? {})) {
    const [L, C, h] = lchOf(hexToRgb(hex)), half = (P[role].L[1] - P[role].L[0]) / 2, mid = clamp(L, 0.22 + half * 0.5, 0.97 - half * 0.5);
    P[role] = { ...P[role], L: [r3(clamp(mid - half, 0.2, 0.9)), r3(clamp(mid + half, 0.3, 0.97))], C: r3(C), h: r3(h), exact: hex.toLowerCase() };
  }
  return { P, Hl: r3(Hl), Hs: r3(Hs), moon, ...(A.air !== 'full' ? { air: A.air, lc: vac ? 0.012 : 0.04 } : {}) };
}

/** A candidate moved by a shift: every hue turned (the accents too, so the scheme holds), the bands moved toward night
 * or day, chroma scaled, the land's hues and the light pulled warm or cool (the accents keep their hue, to stay unique),
 * the accent set again in value against the moved ground. */
function shiftCandidate(cand, s, A) {
  const turn = s.turn ?? 0, li = s.light ?? 0, kC = s.chroma ?? 1, w = s.warm ?? 0;
  if (!turn && !li && kC === 1 && !w) return cand;
  const dlo = li < 0 ? li * 0.14 : li * 0.1, dhi = li < 0 ? li * 0.26 : li * 0.04;
  // warmth: the land's hues pulled toward gold or toward blue, the sky's harder (a sunset, a cold sky), and warm light
  // fuller in chroma (the golden hour), cold light greyer
  const pull = (h, k) => (w ? mixHue(h, w > 0 ? 55 : 245, Math.min(1, Math.abs(w) * k)) : h), kW = 1 + 0.45 * w, vac = cand.air === 'none';
  const P = {};
  for (const [role, { exact: _x, ...p }] of Object.entries(cand.P)) {
    const acc = role.startsWith('accent'), airy = role === 'sky' || role === 'cloud', h = wrapHue(p.h + turn);
    // (the void is the void by day and by night)
    const lo = vac && airy ? p.L[0] : clamp(p.L[0] + dlo, 0.22, 0.9), hi = vac && airy ? p.L[1] : clamp(p.L[1] + dhi, lo + 0.18, 0.97);
    // the accents stay louder than the land however loud the land gets
    const C = p.C * kC * (acc ? Math.max(1, kW) : kW) + (airy && w > 0 ? 0.04 * w : 0);
    P[role] = { ...p, L: [r3(lo), r3(hi)], C: r3(clamp(C, 0, 0.32)), h: r3(acc ? h : pull(h, airy ? 0.8 : 0.6)) };
  }
  if (!vac) P.sky.L[1] = r3(Math.max(P.sky.L[1], Math.min(0.97, P.ground.L[1] + 0.05)));
  const low = A.key === 'low' || li < -0.35, gMid = (P.ground.L[0] + P.ground.L[1]) / 2;
  const aMid = low ? clamp(gMid + 0.24, 0.62, 0.86) : gMid <= 0.7 ? gMid + 0.18 : gMid - 0.2;
  // a land hue pulled onto the accent's: the accent steps aside, on the side it was
  let ah = P.accent.h;
  for (const r of ['ground', 'foliage']) {
    const d = wrapHue(ah - P[r].h), gap = Math.min(d, 360 - d);
    if (gap < 35 && P[r].C > 0.04) ah = wrapHue(P[r].h + (d <= 180 ? 35 : -35));
  }
  P.accent = { ...P.accent, h: r3(ah), L: [r3(clamp(aMid - 0.24, 0.22, 0.7)), r3(clamp(aMid + 0.22, 0.5, 0.95))], C: r3(Math.max(0.12, P.accent.C)) };
  const Hl = w ? mixHue(cand.Hl, w > 0 ? 45 : 225, Math.abs(w) * 0.6) : cand.Hl, Hs = w ? mixHue(cand.Hs, w > 0 ? 290 : 235, Math.abs(w) * 0.3) : cand.Hs;
  return { P, Hl: r3(Hl), Hs: r3(Hs), moon: !vac && (cand.moon || (li < -0.5 && w < 0)), lc: r3((cand.lc ?? 0.05) + 0.05 * Math.abs(w)), ...(cand.air ? { air: cand.air } : {}) };
}

/** A role's ramp at n stops: lightness across its band; chroma fullest at the middle; the hue leaning to the shadow's
 * below the middle and to the light's above it, so the middle is the role's own colour. */
function rampAt(p, n, Hl, Hs) {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1), L = p.L[0] + (p.L[1] - p.L[0]) * t;
    const below = t < 0.5 ? ((0.5 - t) / 0.5) : 0, above = t > 0.5 ? ((t - 0.5) / 0.5) : 0;
    const h = mixHue(mixHue(p.h, Hs, (p.airy ? 0.15 : 0.4) * below ** 1.4), Hl, 0.3 * above ** 2);
    const C = Math.max(i === 0 ? 0.035 : 0.012, p.C * (1 - 0.8 * Math.abs(t - 0.5)));
    if (p.exact && Math.abs(t - 0.5) < 1e-9) return hexToRgb(p.exact);
    return oklch(L, C, h);
  });
}
/** The far layers: the ground seen through the air, laid from the ground's middle toward the sky's light end. */
function farAt(ground, sky, n, air = 'full') {
  const g = rgbToOklab(ground[Math.floor(ground.length / 2)]), s = rgbToOklab(sky.at(-1)), [t0, dt] = FAR_MIX[air];
  return Array.from({ length: n }, (_, i) => {
    const t = t0 + dt * (n === 1 ? 0.5 : i / (n - 1)), lab = g.map((v, k) => v + (s[k] - v) * t);
    const [L, C, h] = lchOf(oklabToRgb(lab).map((v) => clamp(v, 0, 255)));
    // (in vacuum a grey ground toward a grey void goes grey: its darkest stop keeps a colour, the ground's hue)
    if (air === 'none') return oklch(L, Math.max(C, i ? 0.012 : 0.03), C < 0.012 ? lchOf(ground[Math.floor(ground.length / 2)])[2] : h);
    return oklch(L, C, h);
  });
}

function rolesOf({ P, Hl, Hs, air }, n = 5) {
  const out = {};
  for (const role of PALETTE_ROLES) if (!ROLES[role].derived) out[role] = rampAt(P[role], n, Hl, Hs);
  out.far = farAt(out.ground, out.sky, n, air);
  return out;
}

/** The HUD: dark panels in the shadow's hue and ink in the light's (a high key turns it over), the accent the world's,
 * each moved in lightness until it reads (WCAG 2: text 4.5:1, the accent 3:1). */
function uiOf(roles, { Hl, Hs }, key, P) {
  const light = key === 'high';
  const bg = light ? oklch(0.95, 0.02, Hl) : oklch(0.17, 0.025, Hs), panel = light ? oklch(0.985, 0.012, Hl) : oklch(0.21, 0.03, Hs);
  const line = light ? oklch(0.8, 0.035, Hs) : oklch(0.37, 0.05, Hs);
  let inkL = light ? 0.24 : 0.96, ink = oklch(inkL, 0.025, light ? Hs : Hl);
  while ((contrast(ink, panel) < 4.6 || contrast(ink, bg) < 4.6) && inkL > 0.05 && inkL < 0.995) { inkL += light ? -0.03 : 0.01; ink = oklch(inkL, 0.025, light ? Hs : Hl); }
  const reads = (hue, C, L0) => { let L = L0, c = oklch(L, C, hue); while (contrast(c, panel) < 3.1 && L > 0.08 && L < 0.98) { L += light ? -0.03 : 0.03; c = oklch(L, C, hue); } return c; };
  const accent = reads(P.accent.h, Math.max(0.12, P.accent.C), lchOf(roles.accent[2])[0]), accent2 = reads(P.accent2.h, P.accent2.C, light ? 0.5 : 0.8);
  return { bg, panel, line, ink, accent, accent2 };
}

// ── the laws: what a palette is checked by (advice, stamped on the contract; none refuses) ───────────────────────────
const mid = (r) => r[Math.floor(r.length / 2)];
const Lof = (c) => lchOf(c)[0];
const STOCK = Object.entries(SWATCHES).filter(([, s]) => s.land?.grass && s.land?.sky && s.land?.foliage).map(([id, s]) => ({ id, ground: mid(s.land.grass), sky: s.land.sky.at(-1), foliage: mid(s.land.foliage) }));
const HUD_STOCK = { bg: hexToRgb(STYLE_DEFAULTS.bg), accent: hexToRgb(STYLE_DEFAULTS.accent) };
const LAND_ROLES = ['sky', 'cloud', 'ground', 'foliage', 'soil', 'rock', 'bark', 'made', 'rope', 'far'];
function hueFamilies(roles) {
  const fams = [];
  for (const r of Object.keys(COVER)) {
    const [, C, h] = lchOf(mid(roles[r]));
    if (C < 0.02) continue;
    const f = fams.find((x) => hueGap(x.h, h) <= 30);
    if (f) f.w += COVER[r]; else fams.push({ h, w: COVER[r] });
  }
  const total = Object.values(COVER).reduce((a, b) => a + b, 0);
  return fams.filter((f) => f.w >= total * 0.1);
}

export const PALETTE_LAWS = Object.freeze([
  { law: 'ramps-climb', want: 'every ramp climbs from shadow to light', test: (K) => { const bad = Object.entries(K.roles).filter(([, r]) => r.some((c, i) => i && Lof(c) < Lof(r[i - 1]) - 0.004)).map(([k]) => k); return { ok: !bad.length, value: bad.join(', ') || 'all climb' }; } },
  { law: 'shade-is-colour', want: 'the darkest stop of every ramp is a colour, never black', test: (K) => { const bad = Object.entries(K.roles).filter(([, r]) => luma(r[0]) < 14 || chroma(r[0]) < 6).map(([k]) => k); return { ok: !bad.length, value: bad.join(', ') || 'all coloured' }; } },
  { law: 'sky-brightest', air: ['full', 'thin'], want: 'the sky\'s light end is as light as anything on the ground', test: (K) => { const s = luma(K.roles.sky.at(-1)), g = Math.max(luma(K.roles.ground.at(-1)), luma(K.roles.rock.at(-2))); return { ok: s >= g - 4, value: `sky ${Math.round(s)} · ground ${Math.round(g)}` }; } },
  { law: 'sky-darkest', air: ['none'], want: 'in vacuum the void is the darkest thing: the sky\'s light end well under the ground\'s middle', test: (K) => { const s = Lof(K.roles.sky.at(-1)), g = Lof(mid(K.roles.ground)); return { ok: g - s >= 0.15, value: `L: sky ${s.toFixed(2)} · ground ${g.toFixed(2)}` }; } },
  { law: 'accent-unique', want: 'the accent is nothing else\'s colour: every land and made stop sits ≥ 0.08 (OKLab) from it', test: (K) => { const a = mid(K.roles.accent); let near = Infinity, who = ''; for (const r of LAND_ROLES) for (const c of K.roles[r]) { const d = deltaE(a, c); if (d < near) { near = d; who = r; } } return { ok: near >= 0.08, value: `nearest: ${who} at ${near.toFixed(3)}` }; } },
  { law: 'greyscale-read', want: 'it reads in grey: the sky, the ground and the accent sit apart in lightness', test: (K) => { const g = Lof(mid(K.roles.ground)), s = Lof(K.roles.sky.at(-1)), a = Lof(mid(K.roles.accent)); return { ok: (K.read.air === 'none' ? g - s >= 0.15 : s - g >= 0.08) && Math.abs(a - g) >= 0.08, value: `L: sky ${s.toFixed(2)} · ground ${g.toFixed(2)} · accent ${a.toFixed(2)}` }; } },
  { law: 'ui-contrast', want: 'the HUD reads: ink on the panel and the bg ≥ 4.5:1, the accent on the panel ≥ 3:1 (WCAG 2)', test: (K) => { const u = Object.fromEntries(Object.entries(K.ui).map(([k, v]) => [k, hexToRgb(v)])); const ip = contrast(u.ink, u.panel), ib = contrast(u.ink, u.bg), ap = contrast(u.accent, u.panel); return { ok: ip >= 4.5 && ib >= 4.5 && ap >= 3, value: `ink/panel ${ip.toFixed(1)} · ink/bg ${ib.toFixed(1)} · accent/panel ${ap.toFixed(1)} · APCA ink Lc ${Math.round(apca(u.ink, u.panel))}` }; } },
  { law: 'colour-vision', want: 'the accent still parts from the ground for protan, deutan and tritan eyes (≥ 0.06)', test: (K) => { const a = mid(K.roles.accent), g = mid(K.roles.ground); const d = CVD_KINDS.map((k) => [k, deltaE(simulate(a, k), simulate(g, k))]); const worst = d.reduce((x, y) => (y[1] < x[1] ? y : x)); return { ok: worst[1] >= 0.06, value: `weakest: ${worst[0]} ${worst[1].toFixed(3)}` }; } },
  { law: 'few-hues', want: 'two or three hue families carry the land (one only on purpose; four is busy)', test: (K) => { const n = hueFamilies(K.roles).length, one = ['mono-accent', 'duotone'].includes(K.read.scheme) || !!K.read.shift || K.read.air === 'none'; return { ok: n <= 3 && (n >= 2 || one), value: `${n} famil${n === 1 ? 'y' : 'ies'}` }; } },
  { law: 'no-cliche', want: 'not teal-and-orange, not black shadows, not every role at full chroma', test: (K) => {
    const [, sc, sh] = lchOf(mid(K.roles.sky)), warm = ['ground', 'accent'].some((r) => { const [, c, h] = lchOf(mid(K.roles[r])); return c > 0.08 && h >= 35 && h <= 80; });
    const tealOrange = sc > 0.08 && sh >= 180 && sh <= 240 && warm;
    const black = Object.values(K.roles).some((r) => r.some((c) => { const [L, C] = lchOf(c); return L < 0.2 && C < 0.02; }));
    const loud = ['sky', 'ground', 'foliage', 'soil', 'rock'].every((r) => lchOf(mid(K.roles[r]))[1] > 0.14);
    const hits = [tealOrange && 'teal-and-orange', black && 'black shadows', loud && 'everything loud'].filter(Boolean);
    return { ok: !hits.length, value: hits.join(', ') || 'none' };
  } },
  { law: 'off-the-shelf', want: 'not a stock kit again: the ground, sky and foliage sit away from every shipped kit\'s, the HUD from the stock HUD', test: (K) => {
    const near = STOCK.map((s) => ({ id: s.id, d: (deltaE(mid(K.roles.ground), s.ground) + deltaE(K.roles.sky.at(-1), s.sky) + deltaE(mid(K.roles.foliage), s.foliage)) / 3 })).reduce((x, y) => (y.d < x.d ? y : x), { id: '', d: Infinity });
    const hud = Math.min(deltaE(hexToRgb(K.ui.bg), HUD_STOCK.bg) + deltaE(hexToRgb(K.ui.accent), HUD_STOCK.accent), 1);
    return { ok: near.d >= 0.05 && hud >= 0.06, value: `nearest kit ${near.id} at ${near.d.toFixed(3)} · HUD ${hud.toFixed(3)} from stock`, novelty: Math.min(near.d, 0.25) / 0.25 };
  } },
]);
function check(K) { const air = K.read.air ?? 'full'; return PALETTE_LAWS.filter((l) => !l.air || l.air.includes(air)).map((l) => ({ law: l.law, want: l.want, ...l.test(K) })); }

const hexRoles = (roles) => Object.fromEntries(Object.entries(roles).map(([k, r]) => [k, r.map(rgbToHex)]));

const SOLVED = new Map();
/** One candidate's ramps, HUD, checks and score. */
function weigh(cand, A, shift) {
  const roles = rolesOf(cand), ui = Object.fromEntries(Object.entries(uiOf(roles, cand, A.key, cand.P)).map(([n, c]) => [n, rgbToHex(c)]));
  const K = { roles, ui, read: { scheme: A.scheme, ...(shift ? { shift } : {}), ...(A.air !== 'full' ? { air: A.air } : {}) } }, checks = check(K);
  const passed = checks.filter((c) => c.ok).length, novelty = checks.find((c) => c.law === 'off-the-shelf').novelty, fams = hueFamilies(roles).length;
  return { cand, roles, ui, checks, score: passed * 10 + novelty * 8 + (fams >= 2 && fams <= 3 ? 2 : 0) };
}
/** The spec solved: the best of the candidates its seed samples, by its laws, its distance from the shelf, and its
 * hue families; a shift moves the candidate its spec without the shift chose. `script` is a world's, never solved.
 * → the contract */
export function solvePalette(spec0 = {}) {
  const spec = readPaletteSpec(spec0 === 'auto' ? {} : spec0);
  if (spec === false) throw new Error('palette: false is the stock look; there is nothing to solve');
  const key = JSON.stringify(spec);
  if (SOLVED.has(key)) return SOLVED.get(key);
  const { script: _script, ...solved } = spec, { shift, ...still } = solved;
  // a preset is a spec to start from: the spec's own fields over it
  const A = readAxes(overPreset(still));
  let best = null;
  if (shift) {
    const base = solvePalette(still);
    best = { k: base.read.candidate, ...weigh(shiftCandidate(base.params, shift, A), A, shift) };
  } else {
    for (let k = 0; k < CANDIDATES; k += 1) {
      const w = weigh(candidate(overPreset(spec), A, k), A);
      if (!best || w.score > best.score + 1e-9) best = { k, ...w };
    }
  }
  const { cand, roles, ui, checks } = best;
  const light = oklch(0.95, cand.lc ?? 0.05, cand.Hl), shadow = oklch(0.34, 0.07, cand.Hs);
  const lost = Object.entries(cand.P).filter(([, p]) => gamutLoss((p.L[0] + p.L[1]) / 2, p.C, p.h) > 0.02).map(([r]) => r);
  const contract = {
    id: `pal-${fingerprint([solved, best.k]).slice(0, 8)}`,
    spec,
    read: { heat: A.heat, weight: A.weight, activity: A.activity, scheme: A.scheme, key: A.key, hue: A.hue, says: PALETTE_SCHEMES[A.scheme].says, ...(cand.moon ? { moonlit: true } : {}), candidate: best.k, ...(shift ? { shift } : {}), ...(A.air !== 'full' ? { air: A.air } : {}), ...(still.preset ? { preset: still.preset } : {}), ...(lost.length ? { gamut: `chroma taken in for ${lost.join(', ')}` } : {}) },
    roles: hexRoles(roles),
    light: rgbToHex(light), shadow: rgbToHex(shadow), fog: rgbToHex(A.air === 'none' ? roles.sky[1] : roles.far[Math.min(roles.far.length - 1, Math.floor(roles.far.length * 0.6))]),   // (in vacuum what the view fades into is the void)
    ui,
    checks: checks.map(({ novelty: _n, ...c }) => c),
  };
  Object.defineProperty(contract, 'params', { value: cand, enumerable: false });   // for rampOf, never stored
  if (SOLVED.size > 256) SOLVED.clear();
  SOLVED.set(key, Object.freeze(contract));
  return SOLVED.get(key);
}

/** A role's ramp at n stops ([r, g, b] each), solved again at that length, for a kit whose ramps are not five long. */
export function rampOf(contract, role, n) {
  const C = contract.params;
  if (role === 'far') return farAt(rampAt(C.P.ground, n, C.Hl, C.Hs), rampAt(C.P.sky, n, C.Hl, C.Hs), n, C.air);
  if (!C.P[role]) throw new Error(`palette: '${role}' is not a role (${PALETTE_ROLES.join(', ')})`);
  return rampAt(C.P[role], n, C.Hl, C.Hs);
}
/** A ramp off one of the contract's roles, for a ramp the palette has no role for (a blossom, a glow, a vault): its
 * hue turned by `turn` degrees, its band moved by `dL` and its chroma scaled by `kC`. */
export function rampNear(contract, role, n, turn = 0, { dL = 0, kC = 1 } = {}) {
  const C = contract.params, p = C.P[role];
  return rampAt({ ...p, h: wrapHue(p.h + turn), L: [clamp(p.L[0] + dL, 0.2, 0.9), clamp(p.L[1] + dL, 0.3, 0.97)], C: p.C * kC, exact: undefined }, n, C.Hl, C.Hs);
}
