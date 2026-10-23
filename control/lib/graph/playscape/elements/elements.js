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
 *   bolts    jagged lightning round the body: { width?, color?, bright? } (black strokes over a glow edge in color,
 *            kokusen's black flash; bright: white-hot strokes, lightning)
 *   drift    particles thrown, blown or dropped round the body: one SPRAY or a list of them (below). Rain, snow, leaves
 *            on the wind, embers, sparks, dust are each one of these.
 *   fire     the world's own fire on the body (fire/fire.js): { size: 1 licks · 3.5 engulfs, color? }
 *   ice      { mode: 'encase' (a randomized angular block round the body) | 'spikes' (crystals grown from its surface) }
 *   water    drops run off it, fall and ring out at its feet: {} or { count }
 *   steam    vapour rises off it, swells and thins: {} or { count }
 *   shield   a half-sphere of hex cells over the body (a fresnel rim, a shimmer), rippling where a beam lands on it:
 *            { r?: metres, cells?: across, color? }
 *   aura     SPIRIT ONIONS round the body (aura.js): overlapping onion shells spinning their own ways, rings of spikes
 *            round them turning at their own intervals, flat cel bands: a preset's name (power-up) or { onions, spikes }
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
 * A SPRAY: `count` particles, each living `life` seconds and born again (a moment's spray goes once): it starts at
 * `from` (point: the feet + z · ground: a disc of radius r at height z · shell: round the body at r, z [lo, hi] ·
 * cloud: a disc at z, and a small cloud is drawn there), leaves at `v` m/s at an elevation in `el` [lo, hi] degrees
 * (outward from a shell), drifts by `go` [vx, vy, vz], falls by `gravity` (below 0 it rises), swirls round the body
 * `swirl` turns a second; it swells by `grow`, spins `spin` turns a second, and fades by `env`:
 *   { glyph: 'dot' | 'soft' | 'streak' | 'drop' | 'flake' | 'leaf' | 'spark' | 'chip', count: 12, from: 'shell', r: 0.6,
 *     z: 0.9 | [lo, hi], v: 0, el: [-90, 90], go: [0, 0, 0], gravity: 0, swirl: 0, life: 1.5, grow: 0, spin: 0,
 *     size: 0.12, env: 'out', trail: 1, lag: 0.04 (ghosts behind each, s apart), drag: 0 (1/s: it slows, going v / drag
 *     at most, and lies on the ground), ramp?: [colour, …] (over its life), rings?: true (a drop that lands rings out),
 *     color? }   v below 0: a shell's particles go inward
 *
 *   LOOKS / LOOK_NAMES     presets to start from (named by what they do, not what they mean)
 *   readLook(v, where)     a preset's name or a spec → the look, read and filled (teaches on a bad one)
 *   readLooks(play)        play.looks: { name: spec }, read
 *   valueSignature(look)   what reads with the colour taken out (two looks a play uses should differ in it)
 *   wavePoints(w, cc, t)   one wave's lights at t seconds round feet cc: [{ p, w }] (the page runs the same source)
 *   sprayPoints(s, cc, t, loop)  one spray's particles at t seconds: [{ p, v, w, s, rot, ring }] (the same, the page's)
 *   kokusenBolts(cc, ph, p)  the black-flash currents
 *   lookRGB(look)          a look with every colour as [r, g, b] (for an engine with no colorant table)
 *
 * Designed in values first: a look is told apart by light or dark, how strong its coat is, how fast it breathes and how
 * its lights move. Colour comes last.
 */
import { FIRE_COLORANTS } from '../../fire/fire.js';
import { readAura, auraSignature } from './aura.js';

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

// ── the spray: every thrown, blown or dropped particle is one ───────────────────────────────────────────────────
/** One spray's particles at t seconds round feet cc: each { p, v (its velocity), w (0 hidden), s (size), rot, ring (its
 *  share of a ring's time since it landed, a drop that rings out; else -1), u (its life, 0 → 1) }, then its trail's ghosts. count × trail
 *  entries, always, so a page's pool stays one size.
 *  loop: each particle born again every life (a status); else once, from t = 0 (a moment). The page runs this source. */
export function sprayPoints(S, cc, t, loop) {
  const out = [], TAU = 6.283185307179586, fr = (x) => x - Math.floor(x), hs = (a, b) => fr(Math.sin(a * 12.9898 + b * 78.233 + 4.1) * 43758.5453);
  const env = (u) => (S.env === 'ends' ? Math.sin(Math.PI * u) : S.env === 'in' ? u * u : S.env === 'out' ? Math.min(1, u * 12) * (1 - u) * (1 - u) : Math.min(1, u * 12) * Math.min(1, (1 - u) * 6));
  const RING = 0.45, sl0 = Math.sin((S.el[0] * Math.PI) / 180), sl1 = Math.sin((S.el[1] * Math.PI) / 180), trail = S.trail || 1, lag = S.lag || 0;
  for (let i = 0; i < S.count; i++) {
    const life = S.life * (loop ? 0.75 + 0.5 * hs(i, 1) : 0.85 + 0.3 * hs(i, 1));
    const tau0 = loop ? fr(t / life + hs(i, 2)) * life : t - S.delay - S.stagger * hs(i, 2);
    // where it starts
    const a = hs(i, 3) * TAU, d = Math.sqrt(hs(i, 4)) * S.r, zz = S.z[0] + (S.z[1] - S.z[0]) * hs(i, 10);
    const x0 = S.from === 'point' ? 0 : S.from === 'shell' ? S.r * Math.cos(a) : d * Math.cos(a), y0 = S.from === 'point' ? 0 : S.from === 'shell' ? S.r * Math.sin(a) : d * Math.sin(a);
    // how it leaves: at v, an elevation spread even over the sphere's band, outward from a shell
    const sp = S.v * (0.6 + 0.8 * hs(i, 5)), se = sl0 + (sl1 - sl0) * hs(i, 6), ce = Math.sqrt(1 - se * se);
    const az = S.from === 'shell' ? a + (hs(i, 7) - 0.5) * 0.6 : hs(i, 7) * TAU;
    const lx = sp * ce * Math.cos(az), ly = sp * ce * Math.sin(az), lz = sp * se, g = S.gravity, k = S.drag || 0;
    const vx = lx + S.go[0], vy = ly + S.go[1], vz = lz + S.go[2];
    // where it falls to: the feet's ground, once (a dragged one lies on it instead)
    const land = k ? Infinity : g > 0 ? (vz + Math.sqrt(vz * vz + 2 * g * zz)) / g : vz < 0 ? zz / -vz : Infinity;
    // the particle and its trail: the same flight a lag behind, dimmer down the trail
    for (let q = 0; q < trail; q++) {
      const tau = tau0 - q * lag;
      if (tau < 0 || tau > life || (q && tau > land)) { out.push({ p: [cc[0], cc[1], cc[2]], v: [0, 0, 0], w: 0, s: 0, rot: 0, ring: -1 }); continue; }
      const tt = Math.min(tau, land), ring = tau > land ? tau - land : -1;
      if (ring >= 0 && !(S.rings && ring < RING)) { out.push({ p: [cc[0], cc[1], cc[2]], v: [0, 0, 0], w: 0, s: 0, rot: 0, ring: -1 }); continue; }
      // the launch slows by its drag (it goes v / drag at most); a wind and gravity do not
      const dk = k ? (1 - Math.exp(-k * tt)) / k : tt, ek = k ? Math.exp(-k * tt) : 1;
      const x = x0 + lx * dk + S.go[0] * tt, y = y0 + ly * dk + S.go[1] * tt, z = Math.max(k ? 0 : -Infinity, zz + lz * dk + S.go[2] * tt - 0.5 * g * tt * tt);
      // swirled round the body's axis
      const sw = S.swirl * TAU * tt, cs = Math.cos(sw), sn = Math.sin(sw), rx = x * cs - y * sn, ry = x * sn + y * cs;
      const u = tau / life, s = S.size * (0.7 + 0.6 * hs(i, 8)) * (1 + S.grow * u) * (1 - (0.6 * q) / trail);
      out.push({
        p: [cc[0] + rx, cc[1] + ry, cc[2] + z],
        v: [(lx * ek + S.go[0]) * cs - (ly * ek + S.go[1]) * sn - S.swirl * TAU * ry, (lx * ek + S.go[0]) * sn + (ly * ek + S.go[1]) * cs + S.swirl * TAU * rx, lz * ek + S.go[2] - g * tt],
        w: ring >= 0 ? 0 : env(u) * Math.pow(0.7, q), s, rot: hs(i, 9) * TAU + S.spin * TAU * tau, ring: ring >= 0 ? ring / RING : -1, u,
      });
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
export const LOOK_LAYERS = Object.freeze(['color', 'coat', 'motes', 'drift', 'bolts', 'fire', 'ice', 'water', 'steam', 'shield', 'aura']);
export const GLYPHS = Object.freeze(['dot', 'soft', 'streak', 'drop', 'flake', 'leaf', 'spark', 'chip']);
const SPRAY_FROM = ['point', 'ground', 'shell', 'cloud'];
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

/** A spray (see the top): read and filled. */
export function readSpray(w, where) {
  if (!isObj(w)) throw new Error(`${where} is a spray: { glyph, count, from, v, el, go, gravity, swirl, life, … } (see the play-elements card)`);
  const n = (k, d, ok, say) => { const v = w[k] ?? d; if (!num(v) || !ok(v)) throw new Error(`${where}.${k} is ${say}`); return v; };
  const vec = (k) => { const v = w[k] ?? [0, 0, 0]; if (!(Array.isArray(v) && v.length === 3 && v.every(num))) throw new Error(`${where}.${k} is [x, y, z] (m a second)`); return v.slice(); };
  const out = {
    glyph: w.glyph ?? 'dot',
    count: Math.round(n('count', 12, (v) => v >= 1 && v <= 80, 'how many particles (1 to 80)')),
    from: w.from ?? 'shell',
    r: n('r', 0.6, (v) => v >= 0, 'the radius they start in (m)'),
    z: pair(w.z ?? 0.9, `${where}.z`, 'the height they start at above the feet (m)'),
    v: n('v', 0, (v) => v >= -50 && v <= 100, 'the speed they leave at (m a second; below 0 a shell\'s go inward)'),
    el: w.el === undefined ? [-90, 90] : pair(w.el, `${where}.el`, 'the elevation they leave at, degrees [lo, hi]'),
    go: vec('go'),
    gravity: n('gravity', 0, () => true, 'm a second² down (below 0 they rise)'),
    swirl: n('swirl', 0, () => true, 'turns a second round the body'),
    life: n('life', 1.5, (v) => v > 0 && v <= 20, 'seconds a particle lives (to 20)'),
    grow: n('grow', 0, (v) => v >= 0, 'how much a particle swells over its life'),
    spin: n('spin', 0, () => true, 'turns a second'),
    size: n('size', 0.12, (v) => v > 0, 'a particle across (m)'),
    env: w.env ?? 'out',
    delay: n('delay', 0, (v) => v >= 0, 'seconds before a moment\'s spray goes'),
    stagger: n('stagger', 0, (v) => v >= 0, 'seconds a moment\'s particles leave over'),
    trail: Math.round(n('trail', 1, (v) => v >= 1 && v <= 8, 'the ghosts behind each particle (1 to 8)')),
    lag: n('lag', 0.04, (v) => v >= 0, 'seconds between a trail\'s ghosts'),
    drag: n('drag', 0, (v) => v >= 0 && v <= 50, 'how fast they slow (1/s: they go v / drag at most)'),
  };
  if (w.ramp !== undefined) {
    if (!(Array.isArray(w.ramp) && w.ramp.length >= 2 && w.ramp.length <= 6)) throw new Error(`${where}.ramp is 2 to 6 colours over a particle's life`);
    out.ramp = w.ramp.map((c, i) => colorRGB(readColor(c, `${where}.ramp[${i}]`)));
  }
  if (out.count * out.trail > 400) throw new Error(`${where}: count × trail is at most 400`);
  if (!GLYPHS.includes(out.glyph)) throw new Error(`${where}.glyph is one of: ${GLYPHS.join(', ')}`);
  if (!SPRAY_FROM.includes(out.from)) throw new Error(`${where}.from is one of: ${SPRAY_FROM.join(', ')}`);
  if (!ENVS.includes(out.env)) throw new Error(`${where}.env is one of: ${ENVS.join(', ')}`);
  if (out.el.some((x) => x < -90 || x > 90)) throw new Error(`${where}.el is degrees in -90..90`);
  if (w.rings) out.rings = true;
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
  const out = { color: v.color === undefined ? [1, 1, 1] : readColor(v.color, `${where}.color`), coat: null, motes: [], drift: [], bolts: null, fire: null, ice: null, water: null, steam: null };
  if (v.coat !== undefined && v.coat !== false) {
    const c = v.coat === true ? {} : v.coat;
    if (!isObj(c)) throw new Error(`${where}.coat is { k, hz, p, shape, dark? } or false`);
    const shape = c.shape ?? 'breathe';
    if (!COAT_SHAPES.includes(shape)) throw new Error(`${where}.coat.shape is one of: ${COAT_SHAPES.join(', ')}`);
    for (const [k, ok] of [['k', (x) => x >= 0 && x <= 1.5], ['hz', (x) => x >= 0], ['p', (x) => x > 0]]) if (c[k] !== undefined && !(num(c[k]) && ok(c[k]))) throw new Error(`${where}.coat.${k} is out of range`);
    out.coat = { k: c.k ?? 0.6, hz: c.hz ?? 0.6, p: c.p ?? 2, shape, ...(c.dark ? { dark: true } : {}), ...(c.color !== undefined ? { color: readColor(c.color, `${where}.coat.color`) } : {}) };
  }
  if (v.motes !== undefined) out.motes = (Array.isArray(v.motes) ? v.motes : [v.motes]).map((w, i) => readWave(w, `${where}.motes${Array.isArray(v.motes) ? `[${i}]` : ''}`));
  if (v.drift !== undefined) out.drift = (Array.isArray(v.drift) ? v.drift : [v.drift]).map((w, i) => readSpray(w, `${where}.drift${Array.isArray(v.drift) ? `[${i}]` : ''}`));
  if (v.bolts !== undefined && v.bolts !== false) {
    const b = v.bolts === true ? {} : v.bolts;
    if (!isObj(b)) throw new Error(`${where}.bolts is { width?, color?, bright? } or true`);
    out.bolts = { width: num(b.width) && b.width > 0 ? b.width : 0.02, ...(b.bright ? { bright: true } : {}), ...(b.color !== undefined ? { color: readColor(b.color, `${where}.bolts.color`) } : {}) };
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
  // a SHIELD: a half-sphere of hex cells over the body, a fresnel rim and a shimmer, rippling where a beam lands on it
  // (only when given, so a look without one is the one it was)
  if (v.shield !== undefined && v.shield !== false) {
    const c = v.shield === true ? {} : v.shield;
    if (!isObj(c) || (c.r !== undefined && !(num(c.r) && c.r >= 0.4 && c.r <= 8)) || (c.cells !== undefined && !(num(c.cells) && c.cells >= 2 && c.cells <= 20))) throw new Error(`${where}.shield is { r?: metres 0.4 to 8, cells?: 2 to 20 across, color? }`);
    out.shield = { r: c.r ?? 1.3, cells: c.cells ?? 6, ...(c.color !== undefined ? { color: readColor(c.color, `${where}.shield.color`) } : {}) };
  }
  // an AURA: spirit onions and rings of spikes round the body (only when given, so a look without one is the one it was)
  if (v.aura !== undefined && v.aura !== false) out.aura = readAura(v.aura, `${where}.aura`);
  for (const k of ['water', 'steam']) if (v[k] !== undefined && v[k] !== false) {
    const c = v[k] === true ? {} : v[k];
    if (!isObj(c) || (c.count !== undefined && !(num(c.count) && c.count >= 1 && c.count <= 40))) throw new Error(`${where}.${k} is {} or { count: 1 to 40 }`);
    out[k] = { count: Math.round(c.count ?? (k === 'water' ? 14 : 18)) };
  }
  return out;
}

/** A look with every colour as [r, g, b]: its own, its coat's, each wave's and spray's, its bolts' and fire's. */
export function lookRGB(L) {
  const c = (o) => (o && o.color !== undefined ? { ...o, color: colorRGB(o.color) } : o);
  return { ...L, color: colorRGB(L.color), coat: c(L.coat), motes: L.motes.map(c), drift: (L.drift || []).map(c), bolts: c(L.bolts), fire: c(L.fire) };
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
  shock: P({ color: [0.55, 0.75, 1], coat: { k: 0.8, hz: 0, p: 1.6, shape: 'flicker' }, bolts: { width: 0.016, bright: true }, drift: { glyph: 'streak', count: 14, from: 'shell', r: 0.35, z: [0.3, 1.5], v: 2.6, el: [-30, 60], gravity: 6, life: 0.45, size: 0.08, color: [0.85, 0.93, 1] } }),
  rain: P({ color: [0.6, 0.75, 1], coat: { k: 0.4, hz: 0.25, p: 3 }, drift: { glyph: 'drop', count: 26, from: 'cloud', r: 0.5, z: 2.45, go: [0, 0, -6.5], life: 0.55, size: 0.07, env: 'steady', rings: true } }),
  snow: P({ color: [0.92, 0.96, 1], coat: { k: 0.35, hz: 0, p: 3, shape: 'hold' }, drift: { glyph: 'flake', count: 30, from: 'ground', r: 1.1, z: 2.4, go: [0, 0, -0.55], swirl: 0.05, life: 4.4, spin: 0.2, size: 0.1, env: 'ends' } }),
  wind: P({ color: [0.85, 0.95, 0.9], coat: false, drift: [{ glyph: 'streak', count: 10, from: 'shell', r: 0.9, z: [0.2, 1.7], swirl: 0.55, life: 1.1, size: 0.16, env: 'ends' }, { glyph: 'leaf', count: 9, from: 'shell', r: 0.75, z: [0.1, 1.5], go: [0, 0, 0.35], swirl: 0.4, life: 2.6, spin: 0.9, size: 0.13, env: 'ends', color: [0.55, 0.72, 0.3] }] }),
  embers: P({ color: [1, 0.55, 0.2], coat: { k: 0.45, hz: 1.4, p: 2.4 }, drift: { glyph: 'spark', count: 22, from: 'shell', r: 0.3, z: [0.1, 1.2], v: 0.3, el: [30, 90], gravity: -0.9, swirl: 0.08, life: 2, size: 0.07, env: 'ends' } }),
  ward: P({ color: [0.45, 0.85, 1], coat: { k: 0.3, hz: 0.5, p: 2.6 }, shield: { r: 1.3, cells: 6 } }),
  dusty: P({ color: [0.72, 0.62, 0.48], coat: false, drift: { glyph: 'soft', count: 14, from: 'ground', r: 0.55, z: 0.06, v: 0.35, el: [0, 25], life: 1.8, grow: 1.8, size: 0.28, env: 'ends' } }),
  // powering up: a gold rim breathing fast, spirit onions spinning round the body, spikes turning round them, sparks rising
  'power-up': P({ color: [1, 0.84, 0.28], coat: { k: 0.75, hz: 2.2, p: 1.5 }, aura: 'power-up', drift: { glyph: 'spark', count: 16, from: 'shell', r: 0.5, z: [0.1, 1.6], v: 0.4, el: [60, 90], gravity: -2.2, life: 0.9, size: 0.08, env: 'ends' } }),
});
export const LOOK_NAMES = Object.freeze(Object.keys(LOOKS));

// what a wave reads as with the colour taken out: which way it turns, goes in or out, up or down, stands as a ring,
// scatters, trails, how it brightens
const sgn = (a, b) => (b > a + 1e-6 ? 'up' : b < a - 1e-6 ? 'down' : 'still');
const waveSig = (w) => (w.scatter ? 'scatter' : [Math.sign(w.turn), sgn(w.r[0], w.r[1]), sgn(w.z[0], w.z[1]), Math.abs(w.tilt) > 45 ? 'ring' : 'flat', w.trail > 1 ? 'trail' : 'one', w.env, w.count > 4 ? 'many' : 'few'].join(' '));
const spraySig = (s) => [s.glyph, s.from, s.gravity > 0 || s.go[2] < 0 ? 'falls' : s.gravity < 0 || s.go[2] > 0 ? 'rises' : 'level', Math.abs(s.swirl) > 0.2 ? 'swirls' : 'straight', s.v > 1.5 ? 'thrown' : 'loose'].join(' ');
const band = (x, cuts) => cuts.findIndex((c) => x <= c);
/** What a look reads as with the colour taken out. */
export function valueSignature(L) {
  const c = L.coat;
  return [c && c.dark ? 'dark' : L.bolts && !L.bolts.bright ? 'dark' : 'light', c ? c.shape : 'none', c ? band(c.k, [0.4, 0.7, 2]) : -1, c ? band(c.hz, [0, 0.5, 1, 99]) : -1,
    L.motes.map(waveSig).join(' + ') || 'still', (L.drift || []).map(spraySig).join(' + '), L.bolts ? (L.bolts.bright ? 'bright bolts' : 'bolts') : '', L.fire ? `fire ${L.fire.size > 2.5 ? 'big' : 'small'}` : '', L.ice ? `ice ${L.ice.mode}` : '', L.water ? 'water' : '', L.steam ? 'steam' : '', ...(L.aura ? [`aura ${auraSignature(L.aura)}`] : [])].join(' | ');
}
