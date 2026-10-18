/**
 * fishing core — a pure reducer for a reel-in fishing minigame: a fish darts up and down the water column, and the
 * player holds a catch zone over it (hold to rise, let go to sink) until the catch meter fills; let it drain and the
 * fish gets away. A session is a few casts; each fish is drawn from the pond on the seeded dice, the rarer the livelier
 * and the more it is worth. step(state, action) → state; pure and deterministic (mulberry32 carried in the state), so
 * it runs headless in node, replays byte for byte, and inlines into a page as the other pixelizer cores do.
 *
 *   newGame(seed, { casts? })   → state
 *   step(state, action)         actions: { type: 'tick', dt } (ms) · { type: 'hold', on } · 'restart'
 *   FISH                        the pond: { id, name, value, speed, dart, weight }
 */

export const COLUMN = 1;          // the water column, 0 (the bottom) … 1 (the surface)
export const ZONE = 0.26;         // the catch zone's height, a share of the column
export const CASTS = 5;           // fish a session
export const FILL = 0.42;         // catch meter gained a second with the fish in the zone
export const DRAIN = 0.3;         // lost a second with it out
export const RISE = 2.6;          // the zone's lift while held (column a second²)
export const SINK = 2.0;          // its fall when let go
export const WAIT_MS = 900;       // the pause between one fish and the next bite

/** The pond, commonest first. `speed` how fast it swims (column a second), `dart` how often it changes its mind. */
export const FISH = Object.freeze([
  { id: 'minnow', name: 'Minnow', value: 10, speed: 0.35, dart: 0.6, weight: 5 },
  { id: 'trout', name: 'Trout', value: 25, speed: 0.5, dart: 0.9, weight: 4 },
  { id: 'bass', name: 'Bass', value: 40, speed: 0.65, dart: 1.1, weight: 3 },
  { id: 'pike', name: 'Pike', value: 70, speed: 0.85, dart: 1.4, weight: 2 },
  { id: 'koi', name: 'Golden Koi', value: 150, speed: 1.05, dart: 1.8, weight: 1 },
]);

/** mulberry32 over a carried state: → [value in [0, 1), next state]. */
export function rngNext(s) {
  const n = (s + 0x6d2b79f5) >>> 0;
  let t = n;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, n];
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const r5 = (x) => Math.round(x * 1e5) / 1e5;

function bite(state) {
  let [u, rng] = rngNext(state.rngState);
  const total = FISH.reduce((s, f) => s + f.weight, 0);
  let pick = FISH[FISH.length - 1];
  for (let acc = 0, i = 0; i < FISH.length; i++) { acc += FISH[i].weight / total; if (u < acc) { pick = FISH[i]; break; } }
  let v; [v, rng] = rngNext(rng);
  const f = r5(0.2 + 0.6 * v);
  return { ...state, rngState: rng, fish: { id: pick.id, f, target: f, timer: 0 }, progress: 0.3, phase: 'reel', wait: 0 };
}

export function newGame(seed, { casts = CASTS } = {}) {
  const base = { seed: seed >>> 0, rngState: seed >>> 0, casts, cast: 0, zone: { z: 0.1, v: 0 }, hold: false, progress: 0, score: 0, caught: [], escaped: 0, fish: null, phase: 'reel', wait: 0, last: null, over: false };
  return bite(base);
}

const fishOf = (id) => FISH.find((f) => f.id === id);

/** The fish's turn: it swims toward where it has decided to go, and changes its mind on its own dice. */
function swim(state, dt) {
  const F = fishOf(state.fish.id);
  let { f, target, timer } = state.fish, rng = state.rngState;
  timer -= dt;
  if (timer <= 0) {
    let u, w; [u, rng] = rngNext(rng); [w, rng] = rngNext(rng);
    target = r5(clamp(f + (u - 0.5) * 1.2 * F.dart, 0.04, 0.96));
    timer = (0.35 + 0.9 * w) / F.dart;
  }
  const step = F.speed * dt, d = target - f;
  f = r5(Math.abs(d) <= step ? target : f + Math.sign(d) * step);
  return { ...state, rngState: rng, fish: { ...state.fish, f, target, timer: r5(timer) } };
}

/** The zone's turn: it rises while held and sinks when let go, stopped at the ends of the column. */
function float(state, dt) {
  let { z, v } = state.zone;
  v = clamp(v + (state.hold ? RISE : -SINK) * dt, -1.6, 1.6);
  z += v * dt;
  if (z < 0) { z = 0; v = 0; }
  if (z > COLUMN - ZONE) { z = COLUMN - ZONE; v = 0; }
  return { ...state, zone: { z: r5(z), v: r5(v) } };
}

function tick(state, ms) {
  if (state.over) return state;
  const dt = Math.min(ms, 100) / 1000;
  if (state.phase !== 'reel') {
    const wait = state.wait - ms;
    if (wait > 0) return { ...state, wait };
    if (state.cast >= state.casts) return { ...state, wait: 0, over: true };
    return bite({ ...state, wait: 0 });
  }
  let s = float(swim(state, dt), dt);
  const inZone = s.fish.f >= s.zone.z && s.fish.f <= s.zone.z + ZONE;
  const progress = r5(clamp(s.progress + (inZone ? FILL : -DRAIN) * dt, 0, 1));
  s = { ...s, progress };
  if (progress >= 1) {
    const F = fishOf(s.fish.id);
    return { ...s, phase: 'caught', cast: s.cast + 1, score: s.score + F.value, caught: [...s.caught, F.id], last: F.id, fish: null, wait: WAIT_MS };
  }
  if (progress <= 0) return { ...s, phase: 'escaped', cast: s.cast + 1, escaped: s.escaped + 1, last: s.fish.id, fish: null, wait: WAIT_MS };
  return s;
}

export function step(state, action) {
  const type = typeof action === 'string' ? action : action?.type;
  if (type === 'restart') return newGame((state.seed + 1) >>> 0, { casts: state.casts });
  if (type === 'hold') return state.over ? state : { ...state, hold: !!action.on };
  if (type === 'tick') return tick(state, action.dt || 0);
  return state;
}
