/**
 * playscape elements — LOOKS a status wears. A status is a name the play chooses ('poisoned', 'blessed', 'cursed',
 * 'marked': any lower-case word, with no meaning built in); its look is what the page draws on the body while it lasts,
 * as layers:
 *
 *   color    the look's colour: '#rrggbb', [r, g, b] in 0..1, or a flame colorant (sodium, strontium, lithium, calcium,
 *            barium, boron, copper, potassium). A layer may name its own.
 *   coat     the FRESNEL COAT: a rim glow over the body's own surfaces, "this is happening now".
 *            { k: strength 0..1, hz: breaths a second, p: rim falloff (higher is thinner), shape: 'breathe' | 'grow' |
 *              'flash' | 'flicker' | 'hold', dark?: true (a black rim) } · false for none
 *   motes    lights moving round the body: one WAVE or a list of them (below). Every orbiting, rising, spiralling,
 *            bursting, twinkling light is one of these.
 *   bolts    jagged black-flash lightning round the body (kokusen): { width?, color? } (the glow edge takes color)
 *   fire     the world's own fire on the body (fire/fire.js): { size: 1 licks · 3.5 engulfs, color? }
 *   ice      { mode: 'encase' (a randomized angular block round the body) | 'spikes' (crystals grown from its surface) }
 *   water    drops run off it, fall and ring out at its feet: {} or { count }
 *   steam    vapour rises off it, swells and thins: {} or { count }
 *
 * A WAVE: `count` streams of lights, each a head and `trail` lights behind it, travelling one path per `cycle`
 * seconds; at u (0 → 1 along a cycle) a light stands at angle a0 + turn·u turns, radius r(u), height z(u) above the
 * feet:
 *   { count: 2, trail: 6, lag: 0.05 (u between trail lights), cycle: 3, turn: 1 (turns a cycle; 0 straight, < 0 the
 *     other way), r: 0.8 | [from, to], z: 0.7 | [from, to], arc: 0 (a hump in z), tilt: 0 (degrees: 90 stands the
 *     orbit up as a ring), wobble: [amp, per turn], spread: 'even' | 'random', env: 'steady' | 'ends' (fades in and
 *     out) | 'in' (brightens as it arrives) | 'out' (fades as it goes), tail: 0.4 (dimming down the trail),
 *     pulse: 0..1 (breathes with the cycle), size: 0.6, scatter?: [sx, sy, sz] (fixed lights in a box that twinkle,
 *     `twinkle` sharpness), color? }
 *
 *   LOOKS / LOOK_NAMES     presets to start from (named by what they do, not what they mean)
 *   readLook(v, where)     a preset's name or a spec → the look, read and filled (teaches on a bad one)
 *   readLooks(play)        play.looks: { name: spec }, read
 *   valueSignature(look)   what reads with the colour taken out (two looks a play uses should differ in it)
 *   wavePoints(w, cc, t)   one wave's lights at t seconds round feet cc: [{ p, w }] (the page runs the same source)
 *   kokusenBolts(cc, ph, p)  the black-flash currents
 *
 * Designed in values first: a look is told apart by light or dark, how strong its coat is, how fast it breathes and how
 * its lights move. Colour comes last.
 */
import { FIRE_COLORANTS } from '../../fire/fire.js';

const TAU = Math.PI * 2;
const frac = (x) => x - Math.floor(x);
const h3 = (a, b, c) => frac(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);

// ── the wave: every orbiting light is one ─────────────────────────────────────────────────────────────────────────
/** One wave's lights at t seconds round feet cc. Deterministic in t; the page runs this same source. */
export function wavePoints(W, cc, t) {
  const out = [], TAU = 6.283185307179586, fr = (x) => x - Math.floor(x), hs = (a, b) => fr(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
  const env = (u) => (W.env === 'ends' ? Math.sin(Math.PI * u) : W.env === 'in' ? u * u : W.env === 'out' ? (1 - u) * (1 - u) : 1);
  const breathe = 1 - W.pulse * (0.5 - 0.5 * Math.sin((TAU * t) / W.cycle));
  const ct = Math.cos((W.tilt * Math.PI) / 180), st = Math.sin((W.tilt * Math.PI) / 180);
  for (let j = 0; j < W.count; j++) {
    if (W.scatter) {
      const q = [cc[0] + (hs(j, 3.1) - 0.5) * W.scatter[0], cc[1] + (hs(j, 11.3) - 0.5) * W.scatter[1], cc[2] + W.z[0] + (hs(j, 5.7) - 0.5) * W.scatter[2]];
      out.push({ p: q, w: Math.pow(Math.max(Math.sin(Math.PI * fr(t / W.cycle + hs(j, 1))), 0), W.twinkle) * breathe });
      continue;
    }
    const j0 = W.spread === 'random' ? hs(j, 2.7) : j / W.count, a0 = (W.spread === 'random' ? hs(j, 6.3) : j / W.count) * TAU;
    for (let k = 0; k < W.trail; k++) {
      const u = fr(t / W.cycle + j0 - k * W.lag), A = a0 + W.turn * TAU * u;
      const R = W.r[0] + (W.r[1] - W.r[0]) * u, Z = W.z[0] + (W.z[1] - W.z[0]) * u + W.arc * 4 * u * (1 - u) + W.wobble[0] * Math.sin(W.wobble[1] * A);
      const x = R * Math.cos(A), y = R * Math.sin(A);
      out.push({ p: [cc[0] + x, cc[1] + y * ct, cc[2] + Z + y * st], w: env(u) * Math.exp(-W.tail * k) * breathe });
    }
  }
  return out;
}

// ── kokusen's black-flash currents ───────────────────────────────────────────────────────────────────────────────
// nine jagged arcs round the body, struck afresh 8 times a second; one whose dice fall under 0.3 sits the frame out
// (w 0). Each strike its own weight and every node its own kink of it, tapering root to tip; a fork from the middle.
// Nine bolts then nine fork slots, always, so a page's pools stay one size: { nodes, t: per-node thickness, w, fork? }.
export function kokusenBolts(cc, ph, p) {
  const frame = Math.floor(ph * 8), N = 12, out = [], forks = [];
  for (let j = 0; j < 9; j++) {
    const gj = h3(j, frame, 7.3), A0 = h3(j, 3.3, 1.7) * TAU + ph, weight = 0.6 + 1.2 * h3(j, 9.1, frame), nodes = [], t = [];
    for (let k = 0; k < N; k++) {
      const u = k / (N - 1), A = A0 + u * 2.2, rr = p.arcR + 0.18 * Math.sin(u * 9 + j * 2.1);
      nodes.push([cc[0] + rr * Math.cos(A) + (h3(j, k, frame) - 0.5) * 0.3, cc[1] + rr * Math.sin(A) + (h3(k, j, frame + 3) - 0.5) * 0.3, cc[2] + p.zBase + p.zSpan * u + (h3(frame, j, k) - 0.5) * 0.3]);
      t.push(weight * Math.pow(1 - 0.8 * u, 0.9) * (0.6 + 0.8 * h3(j, k, frame + 11)));
    }
    const w = gj < 0.3 ? 0 : gj;
    out.push({ nodes, t, w });
    const at = 4 + Math.floor(h3(j, frame, 2.2) * 4), o = nodes[at], fa = h3(j, frame, 4.4) * TAU, fn = [], ft = [];
    for (let k = 0; k < 5; k++) {
      const u = k / 4, len = 0.45 * u;
      fn.push([o[0] + len * Math.cos(fa) + (h3(j, k, frame + 5) - 0.5) * 0.12, o[1] + len * Math.sin(fa) + (h3(k, j, frame + 6) - 0.5) * 0.12, o[2] + 0.25 * u + (h3(frame, k, j + 7) - 0.5) * 0.12]);
      ft.push(t[at] * 0.55 * (1 - 0.85 * u));
    }
    forks.push({ nodes: fn, t: ft, w: w && h3(j, frame, 8.8) > 0.45 ? w : 0, fork: 1 });
  }
  return out.concat(forks);
}
export const BOLT_SHAPE = Object.freeze({ arcR: 0.6, zBase: 0.3, zSpan: 1.3 });

// ── reading a look ───────────────────────────────────────────────────────────────────────────────────────────────
const COAT_SHAPES = ['breathe', 'grow', 'flash', 'flicker', 'hold'];
const ENVS = ['steady', 'ends', 'in', 'out'];
const ICE_MODES = ['encase', 'spikes'];
export const LOOK_LAYERS = Object.freeze(['color', 'coat', 'motes', 'bolts', 'fire', 'ice', 'water', 'steam']);
const HEX = /^#[0-9a-f]{6}$/i;

export function readColor(c, where) {
  if (typeof c === 'string' && (HEX.test(c) || FIRE_COLORANTS[c])) return c;
  if (Array.isArray(c) && c.length === 3 && c.every((x) => num(x) && x >= 0 && x <= 1)) return c.slice();
  throw new Error(`${where} is '#rrggbb', [r, g, b] in 0..1, or a colorant (${Object.keys(FIRE_COLORANTS).join(', ')})`);
}
/** A colour as [r, g, b] (a colorant's lines). */
export function colorRGB(c) {
  if (Array.isArray(c)) return c;
  if (typeof c === 'string' && FIRE_COLORANTS[c]) return FIRE_COLORANTS[c].slice();
  if (typeof c === 'string' && HEX.test(c)) return [1, 3, 5].map((i) => Math.round((parseInt(c.slice(i, i + 2), 16) / 255) * 1000) / 1000);
  return [1, 1, 1];
}

const pair = (v, where, what) => {
  if (num(v)) return [v, v];
  if (Array.isArray(v) && v.length === 2 && v.every(num)) return v.slice();
  throw new Error(`${where} is ${what}: a number, or [from, to] over a cycle`);
};
function readWave(w, where) {
  if (!isObj(w)) throw new Error(`${where} is a wave: { count, trail, cycle, turn, r, z, … } (see the play-elements card)`);
  const n = (k, d, ok, say) => { const v = w[k] ?? d; if (!num(v) || !ok(v)) throw new Error(`${where}.${k} is ${say}`); return v; };
  const out = {
    count: Math.round(n('count', 2, (v) => v >= 1 && v <= 40, 'how many streams (1 to 40)')),
    trail: Math.round(n('trail', 6, (v) => v >= 1 && v <= 16, 'the lights in a stream (1 to 16)')),
    lag: n('lag', 0.05, (v) => v >= 0 && v < 1, 'the gap down a trail, as a share of a cycle'),
    cycle: n('cycle', 3, (v) => v > 0, 'seconds a cycle'),
    turn: n('turn', 1, () => true, 'turns a cycle (0 straight, below 0 the other way)'),
    r: pair(w.r ?? 0.8, `${where}.r`, 'the radius round the body (m)'),
    z: pair(w.z ?? 0.7, `${where}.z`, 'the height above the feet (m)'),
    arc: n('arc', 0, () => true, 'a hump in the height (m)'),
    tilt: n('tilt', 0, () => true, 'degrees (90 stands the orbit up as a ring)'),
    wobble: w.wobble === undefined ? [0, 0] : pair(w.wobble, `${where}.wobble`, '[amp, waves a turn]'),
    spread: w.spread ?? 'even',
    env: w.env ?? 'steady',
    tail: n('tail', 0.4, (v) => v >= 0, 'how fast a trail dims'),
    pulse: n('pulse', 0, (v) => v >= 0 && v <= 1, 'a breath with the cycle, 0..1'),
    size: n('size', 0.6, (v) => v > 0, 'a light across (m)'),
    twinkle: n('twinkle', 8, (v) => v > 0, 'how sharp a scattered light twinkles'),
  };
  if (!['even', 'random'].includes(out.spread)) throw new Error(`${where}.spread is 'even' or 'random'`);
  if (!ENVS.includes(out.env)) throw new Error(`${where}.env is one of: ${ENVS.join(', ')}`);
  if (w.scatter !== undefined) { if (!(Array.isArray(w.scatter) && w.scatter.length === 3 && w.scatter.every((v) => num(v) && v >= 0))) throw new Error(`${where}.scatter is [sx, sy, sz] (m)`); out.scatter = w.scatter.slice(); out.trail = 1; }
  if (w.color !== undefined) out.color = readColor(w.color, `${where}.color`);
  return out;
}

/** A look: a preset's name (or one in `looks`, play.looks read), or a spec of layers. */
export function readLook(v, where, looks = null) {
  if (typeof v === 'string') {
    const L = (looks && looks[v]) || LOOKS[v];
    if (!L) throw new Error(`${where} '${v}' is not a look: name a preset (${LOOK_NAMES.join(', ')}), one in play.looks, or give its layers`);
    return L;
  }
  if (!isObj(v)) throw new Error(`${where} is a look: a preset's name, or its layers { ${LOOK_LAYERS.join(', ')} }`);
  const bad = Object.keys(v).filter((k) => !LOOK_LAYERS.includes(k));
  if (bad.length) throw new Error(`${where} has no layer ${bad.join(', ')}: its layers are ${LOOK_LAYERS.join(', ')}`);
  const out = { color: v.color === undefined ? [1, 1, 1] : readColor(v.color, `${where}.color`), coat: null, motes: [], bolts: null, fire: null, ice: null, water: null, steam: null };
  if (v.coat !== undefined && v.coat !== false) {
    const c = v.coat === true ? {} : v.coat;
    if (!isObj(c)) throw new Error(`${where}.coat is { k, hz, p, shape, dark? } or false`);
    const shape = c.shape ?? 'breathe';
    if (!COAT_SHAPES.includes(shape)) throw new Error(`${where}.coat.shape is one of: ${COAT_SHAPES.join(', ')}`);
    for (const [k, ok] of [['k', (x) => x >= 0 && x <= 1.5], ['hz', (x) => x >= 0], ['p', (x) => x > 0]]) if (c[k] !== undefined && !(num(c[k]) && ok(c[k]))) throw new Error(`${where}.coat.${k} is out of range`);
    out.coat = { k: c.k ?? 0.6, hz: c.hz ?? 0.6, p: c.p ?? 2, shape, ...(c.dark ? { dark: true } : {}), ...(c.color !== undefined ? { color: readColor(c.color, `${where}.coat.color`) } : {}) };
  }
  if (v.motes !== undefined) out.motes = (Array.isArray(v.motes) ? v.motes : [v.motes]).map((w, i) => readWave(w, `${where}.motes${Array.isArray(v.motes) ? `[${i}]` : ''}`));
  if (v.bolts !== undefined && v.bolts !== false) {
    const b = v.bolts === true ? {} : v.bolts;
    if (!isObj(b)) throw new Error(`${where}.bolts is { width?, color? } or true`);
    out.bolts = { width: num(b.width) && b.width > 0 ? b.width : 0.02, ...(b.color !== undefined ? { color: readColor(b.color, `${where}.bolts.color`) } : {}) };
  }
  if (v.fire !== undefined && v.fire !== false) {
    const f = v.fire === true ? {} : v.fire;
    if (!isObj(f)) throw new Error(`${where}.fire is { size?, color? }`);
    if (f.size !== undefined && !(num(f.size) && f.size >= 0.5 && f.size <= 5)) throw new Error(`${where}.fire.size is 0.5 to 5 (1 licks, 3.5 engulfs)`);
    out.fire = { size: f.size ?? 1.5, ...(f.color !== undefined ? { color: readColor(f.color, `${where}.fire.color`) } : {}) };
  }
  if (v.ice !== undefined && v.ice !== false) {
    const c = v.ice === true ? {} : v.ice;
    if (!isObj(c) || (c.mode !== undefined && !ICE_MODES.includes(c.mode))) throw new Error(`${where}.ice is { mode: ${ICE_MODES.join(' | ')} }`);
    out.ice = c.mode === 'spikes' ? { mode: 'spikes', count: 34, length: 0.34, width: 0.06 } : { mode: 'encase' };
  }
  for (const k of ['water', 'steam']) if (v[k] !== undefined && v[k] !== false) {
    const c = v[k] === true ? {} : v[k];
    if (!isObj(c) || (c.count !== undefined && !(num(c.count) && c.count >= 1 && c.count <= 40))) throw new Error(`${where}.${k} is {} or { count: 1 to 40 }`);
    out[k] = { count: Math.round(c.count ?? (k === 'water' ? 14 : 18)) };
  }
  return out;
}

/** play.looks: { name: layers }, read (a name is any lower-case word). */
export function readLooks(play) {
  const L = play && play.looks;
  if (L === undefined) return {};
  if (!isObj(L)) throw new Error(`play.looks is { name: { ${LOOK_LAYERS.join('?, ')}? } }`);
  const out = {};
  for (const [k, v] of Object.entries(L)) {
    if (!/^[a-z][a-z0-9-]*$/.test(k)) throw new Error(`play.looks: '${k}' is a lower-case word`);
    out[k] = readLook(v, `play.looks.${k}`);
  }
  return out;
}

// ── presets: named by what they do ───────────────────────────────────────────────────────────────────────────────
const P = (spec) => readLook(spec, 'preset');
export const LOOKS = Object.freeze({
  glow: P({ color: [0.6, 0.8, 1], coat: { k: 0.6, hz: 0.6 }, motes: { count: 1, trail: 1, r: 0, z: 0.65, size: 1.8, pulse: 0.4, cycle: 10.5 } }),
  orbit: P({ color: [0.2, 1, 0.75], coat: { k: 0.5, hz: 0.5 }, motes: { count: 2, trail: 8, lag: 0.056, cycle: 6.28, turn: 1, r: 0.85, z: 0.62, wobble: [0.22, 2] } }),
  rise: P({ color: [1, 0.75, 0.4], coat: { k: 0.55, hz: 0.8 }, motes: { count: 2, trail: 8, lag: 0.045, cycle: 6.28, turn: 2, r: [0.5, 0.35], z: [0.12, 1.62], env: 'ends' } }),
  spiral: P({ color: [0.55, 0.75, 1], coat: { k: 0.85, hz: 0, shape: 'grow' }, motes: { count: 2, trail: 8, lag: 0.05, cycle: 6.28, turn: -1.5, r: [1.45, 0.15], z: [1.2, 0.65], env: 'in' } }),
  burst: P({ color: [1, 0.35, 0.15], coat: { k: 1, hz: 0, shape: 'flash' }, motes: { count: 6, trail: 4, lag: 0.05, cycle: 0.7, turn: 0, r: [0.25, 1.6], z: [0.75, 0.7], arc: 0.2, env: 'out' } }),
  converge: P({ color: [0.75, 0.45, 1], coat: { k: 0.45, hz: 1.5, shape: 'grow' }, motes: { count: 3, trail: 10, lag: 0.03, cycle: 6.28, turn: -3, r: [2.3, 0.18], z: [1.75, 0.65], env: 'in' } }),
  ring: P({ color: [1, 0.85, 0.35], coat: { k: 0.85, hz: 0.25, p: 1.4 }, motes: { count: 3, trail: 6, lag: 0.035, cycle: 6.28, turn: 1, r: 0.95, z: 0.72, tilt: 90 } }),
  twinkle: P({ color: [1, 0.95, 0.7], coat: { k: 0.3, hz: 2, p: 3 }, motes: { count: 12, cycle: 6.28, scatter: [1.7, 1.1, 1.3], z: 0.75 } }),
  fall: P({ color: [0.45, 0.9, 0.35], coat: { k: 0.55, hz: 0.6, p: 3 }, motes: { count: 2, trail: 8, lag: 0.04, cycle: 6.28, turn: -1.5, r: [0.25, 1.35], z: [1.5, 0.05], env: 'ends' } }),
  column: P({ color: [0.27, 0.77, 0.41], coat: { k: 0.35, hz: 0.4 }, motes: { count: 1, trail: 9, lag: 0.111, cycle: 3, turn: 0, r: 0, z: [0.3, 4.5], pulse: 0.3 } }),
  flare: P({ color: [1, 0.82, 0.25], coat: { k: 1, hz: 1.2, p: 1.6 }, motes: [{ count: 1, trail: 1, r: 0, z: 0.95, size: 1.8, pulse: 0.3, cycle: 6.28 }, { count: 14, trail: 1, spread: 'random', cycle: 6.28, turn: 0.08, r: [0.72, 0.1], z: [0.1, 2.2], env: 'ends', size: 0.55 }] }),
  kokusen: P({ color: [1, 0.12, 0.15], coat: { k: 0.9, hz: 0, p: 1.8, shape: 'flicker', dark: true }, bolts: { width: 0.02 }, motes: { count: 1, trail: 1, r: 0, z: 0.95, size: 1.5, pulse: 0.3, cycle: 3.14 } }),
  fire: P({ color: [1, 0.52, 0.22], coat: { k: 0.6, hz: 4, p: 1.6 }, fire: { size: 1.5 } }),
  blaze: P({ color: [1, 0.5, 0.2], coat: { k: 0.95, hz: 2, p: 1.3 }, fire: { size: 3.5 } }),
  ice: P({ color: [0.78, 0.92, 1], coat: { k: 0.7, hz: 0, p: 1.8, shape: 'hold' }, ice: { mode: 'encase' } }),
  frost: P({ color: [0.78, 0.92, 1], coat: { k: 0.7, hz: 0, p: 1.8, shape: 'hold' }, ice: { mode: 'spikes' } }),
  wet: P({ color: [0.62, 0.82, 1], coat: { k: 0.45, hz: 0.3, p: 3.2 }, water: {} }),
  steam: P({ color: [1, 0.95, 0.9], coat: { k: 0.35, hz: 0.5, p: 2.2 }, steam: {} }),
});
export const LOOK_NAMES = Object.freeze(Object.keys(LOOKS));

// what a wave reads as with the colour taken out: which way it turns, goes in or out, up or down, stands as a ring,
// scatters, trails, how it brightens
const sgn = (a, b) => (b > a + 1e-6 ? 'up' : b < a - 1e-6 ? 'down' : 'still');
const waveSig = (w) => (w.scatter ? 'scatter' : [Math.sign(w.turn), sgn(w.r[0], w.r[1]), sgn(w.z[0], w.z[1]), Math.abs(w.tilt) > 45 ? 'ring' : 'flat', w.trail > 1 ? 'trail' : 'one', w.env, w.count > 4 ? 'many' : 'few'].join(' '));
const band = (x, cuts) => cuts.findIndex((c) => x <= c);
/** What a look reads as with the colour taken out. */
export function valueSignature(L) {
  const c = L.coat;
  return [c && c.dark ? 'dark' : L.bolts ? 'dark' : 'light', c ? c.shape : 'none', c ? band(c.k, [0.4, 0.7, 2]) : -1, c ? band(c.hz, [0, 0.5, 1, 99]) : -1,
    L.motes.map(waveSig).join(' + ') || 'still', L.bolts ? 'bolts' : '', L.fire ? `fire ${L.fire.size > 2.5 ? 'big' : 'small'}` : '', L.ice ? `ice ${L.ice.mode}` : '', L.water ? 'water' : '', L.steam ? 'steam' : ''].join(' | ');
}
