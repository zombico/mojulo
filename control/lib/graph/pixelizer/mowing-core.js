/**
 * mowing core — a pure reducer for a lawn-mowing minigame, seen from above: a zero-turn mower on a park's lawn, its long
 * grass cut where the deck passes, each pass laid as a stripe light or dark by the way it was driven (as a mown lawn
 * reads). Trees and the park's things stop it; its paths are driven on and have no grass; its flowerbeds are driven
 * over at a cost. The round ends when the grass is all cut or the clock runs out; the score is the share cut, less what
 * the flowerbeds lost. step(state, action) → state; pure and deterministic (mulberry32 carried in the state, the lawn
 * laid on it where none is given), so it runs headless in node, replays byte for byte, and inlines into a page as the
 * other pixelizer cores do.
 *
 *   newGame(seed, { lawn?, time? })  → state
 *     lawn  { rows: [string], start: [x, y, heading] }: a lawn's tiles, row 0 the north (TILES), and where the mower
 *           starts (tile units, x east, y south; heading radians, 0 east, π/2 south); a seeded park where absent
 *     time  seconds a round lasts (TIME)
 *   step(state, action)  actions: { type: 'tick', dt } (ms) · { type: 'key', key: up | down | left | right, on } · 'restart'
 *   TILES   what a lawn's characters are
 *   score   1000 × the share of the long grass cut, less TRAMPLE a flowerbed driven over; 1000 when all is cut and none is
 */

export const TILES = Object.freeze({ '.': 'grass', '=': 'path', 'T': 'tree', '#': 'thing', '*': 'flowers' });
export const TIME = 120;          // seconds a round
export const SPEED = 3.4;         // tiles a second, flat out forward
export const BACK = 1.7;          // reversing
export const ACCEL = 7;           // tiles a second² toward the throttle's speed
export const TURN = 2.6;          // radians a second (a zero-turn mower turns where it stands)
export const DECK = 0.42;         // the deck's half width across the way it goes (tiles): it cuts the tile under it and those
export const TRAMPLE = 25;        // the score a flowerbed driven over costs
export const BUMP_MS = 450;       // how long a bump says so

/** mulberry32 over a carried state: → [value in [0, 1), next state]. */
export function rngNext(s) {
  const n = (s + 0x6d2b79f5) >>> 0;
  let t = n;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, n];
}

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** A seeded park where no lawn is given: a cross of paths, a few trees, a flowerbed or two by them; the mower at the
 *  east end of the path across. */
export function seededLawn(seed, W = 24, H = 13) {
  let rng = seed >>> 0, u;
  const g = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
  const my = Math.floor(H / 2), mx = Math.floor(W / 2);
  for (let x = 0; x < W; x++) g[my][x] = '=';
  for (let y = 0; y < H; y++) g[y][mx] = '=';
  for (let k = 0, tries = 0; k < 6 && tries < 60; tries++) {
    let a, b; [a, rng] = rngNext(rng); [b, rng] = rngNext(rng);
    const x = 1 + Math.floor(a * (W - 2)), y = 1 + Math.floor(b * (H - 2));
    if (g[y][x] !== '.' || Math.abs(y - my) < 2 || Math.abs(x - mx) < 2) continue;
    g[y][x] = 'T'; k++;
    [u, rng] = rngNext(rng);
    if (u < 0.5) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g[y + dy]?.[x + dx] === '.') g[y + dy][x + dx] = '*';
  }
  return { rows: g.map((r) => r.join('')), start: [W - 0.5, my + 0.5, Math.PI] };
}

const readLawn = (lawn) => {
  const rows = lawn.rows.slice(), H = rows.length, W = rows[0].length;
  if (!H || rows.some((r) => r.length !== W || [...r].some((c) => !TILES[c]))) throw new Error(`mowing: a lawn is rows of one width, each tile one of ${Object.keys(TILES).join(' ')}`);
  return { rows, W, H, start: lawn.start };
};

export function newGame(seed, { lawn = null, time = TIME } = {}) {
  const L = readLawn(lawn ?? seededLawn(seed >>> 0)), cut = L.rows.map((r) => [...r].map(() => 0)), total = L.rows.reduce((n, r) => n + [...r].filter((c) => c === '.').length, 0);
  const [x, y, h] = L.start ?? [L.W / 2, L.H / 2, 0];
  return { seed: seed >>> 0, rngState: seed >>> 0, W: L.W, H: L.H, rows: L.rows, cut, total, mown: 0, trampled: 0, score: 0, time: time * 1000, left: time * 1000,
    mower: { x: r5(x), y: r5(y), h: r5(h), v: 0 }, keys: { up: false, down: false, left: false, right: false }, bump: 0, over: false, lawn: lawn ? { rows: L.rows, start: L.start } : null };
}

const tileAt = (s, x, y) => { const i = Math.floor(x), j = Math.floor(y); return i < 0 || j < 0 || i >= s.W || j >= s.H ? null : s.rows[j][i]; };
const blocked = (s, x, y) => { const c = tileAt(s, x, y); return c === null || c === 'T' || c === '#'; };
const scoreOf = (s) => Math.max(0, Math.round((1000 * s.mown) / Math.max(1, s.total)) - TRAMPLE * s.trampled);

/** The deck's pass at the mower: each long tile under it cut, its stripe the way it was driven (1 east or south, 2 west or
 *  north, by the way's larger part); a flowerbed under its middle trampled once. */
function mow(s) {
  const { x, y, h } = s.mower, c = Math.cos(h), n = Math.sin(h), stripe = Math.abs(c) >= Math.abs(n) ? (c >= 0 ? 1 : 2) : (n >= 0 ? 1 : 2);
  let cut = s.cut, mown = s.mown, trampled = s.trampled;
  for (const o of [-DECK, 0, DECK]) {
    const px = x - n * o, py = y + c * o, i = Math.floor(px), j = Math.floor(py), t = tileAt(s, px, py);
    if (t === '.' && cut[j][i] === 0) { if (cut === s.cut) cut = cut.map((r) => r.slice()); cut[j][i] = stripe; mown++; }
    if (o === 0 && t === '*' && cut[j][i] === 0) { if (cut === s.cut) cut = cut.map((r) => r.slice()); cut[j][i] = 3; trampled++; }
  }
  return cut === s.cut ? s : { ...s, cut, mown, trampled };
}

function tick(state, ms) {
  if (state.over) return state;
  const dt = Math.min(ms, 100) / 1000, K = state.keys, M = state.mower;
  const want = K.up && !K.down ? SPEED : K.down && !K.up ? -BACK : 0;
  const v = r5(Math.abs(want - M.v) <= ACCEL * dt ? want : M.v + Math.sign(want - M.v) * ACCEL * dt);
  const h = r5(M.h + ((K.right ? 1 : 0) - (K.left ? 1 : 0)) * TURN * dt);
  let x = r5(M.x + Math.cos(h) * v * dt), y = r5(M.y + Math.sin(h) * v * dt), bump = Math.max(0, state.bump - ms), vv = v;
  // (a tree, a thing or the park's edge ahead: it stops short, and says so)
  if (blocked(state, x, y)) { x = M.x; y = M.y; vv = 0; if (Math.abs(v) > 0.5) bump = BUMP_MS; }
  let s = mow({ ...state, mower: { x, y, h, v: vv }, bump });
  const left = state.left - ms;
  s = { ...s, left: Math.max(0, left), score: scoreOf(s) };
  if (s.mown >= s.total || left <= 0) s = { ...s, over: true };
  return s;
}

export function step(state, action) {
  const type = typeof action === 'string' ? action : action?.type;
  if (type === 'restart') return newGame((state.seed + 1) >>> 0, { lawn: state.lawn, time: state.time / 1000 });
  if (type === 'key') return state.over || !(action.key in state.keys) ? state : { ...state, keys: { ...state.keys, [action.key]: !!action.on } };
  if (type === 'tick') return tick(state, action.dt || 0);
  return state;
}
