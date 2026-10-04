// fire — flames in worlds, as consumers of the air.
//
// A fire is a few FLAMELETS standing on a bed of fuel (a wick, a torch's head, a brazier's coals, a campfire's
// logs). Each flamelet is a streakline: the burning gas leaves its base and rises on its own buoyancy while the air
// carries it sideways, so the flame at time t is where the gas let go over the last fraction of a second now is.
// The sideways part is one running integral of the air its base saw; the rise is in closed form. Nothing is stored:
// a fire at any time is a function of that time and the air (the World page asks in any order; captures pin it).
//
// What makes the kinds differ is size. A candle (a wick, D ≈ 1 cm) burns laminar and steady; past about 10 cm a
// buoyant fire is turbulent, wanders on its own eddies and PUFFS: a toroidal vortex rolls up at its base and lifts
// the flame in pulses at f ≈ 1.5/√D Hz (Cetegen & Ahmed 1993; a torch ≈ 5.7 Hz, a campfire ≈ 2 Hz). Flame height
// follows Heskestad's L ≈ 0.235 Q^0.4 − 1.02 D (a pitch torch at ~3 kW ≈ 0.3 m, a campfire at ~60 kW ≈ 0.6–0.9 m);
// FIRE_KINDS holds the result per kind rather than solving it.
//
// The air is the wind's (vegetation/wind.js windField when the world has one): a flamelet takes φ of it (born 1;
// φ = 0 stands straight up in any wind), plus eddies a third of the air's strength and the fire's own turbulence,
// a share of √(g D). Embers ride the plume and the air; smoke puffs rise and drift; both are on analytic paths
// released on fixed schedules, so they too are functions of time. The light a fire gives flickers with its flames.
//
// Estimates, not measurements: sizes, rates, the buoyant acceleration and the light are chosen in the ranges the
// literature and a look at real fires give.

// D: the fuel bed across (m); L: mean flame height (m); n: flamelets; lam: laminar (no puffing, no own eddies);
// light: strength I (a surface d metres off takes I/(d² + r²) of full light, r = the flame's size); embers: how
// many in flight at once (about); smoke: puffs a second; soot: how yellow-bright its flame (a candle's is the
// brightest per area, a pitch torch's the smokiest); seat: how far above `at` the flames stand (a campfire's on its logs).
export const FIRE_KINDS = Object.freeze({
  candle: Object.freeze({ D: 0.012, L: 0.045, n: 1, lam: true, light: 0.35, embers: 0, smoke: 0, soot: 1 }),
  torch: Object.freeze({ D: 0.07, L: 0.4, n: 3, lam: false, light: 3, embers: 5, smoke: 7, soot: 0.9 }),
  brazier: Object.freeze({ D: 0.38, L: 0.5, n: 5, lam: false, light: 7, embers: 14, smoke: 5, soot: 0.85 }),
  campfire: Object.freeze({ D: 0.55, L: 0.8, n: 7, lam: false, light: 12, embers: 30, smoke: 9, soot: 0.85, seat: 0.1 }),
  // a moving fire: D the ball across, L its tail; it needs a `path`
  fireball: Object.freeze({ D: 0.36, L: 1.2, n: 3, lam: false, light: 8, embers: 12, smoke: 4, soot: 0.9 }),
});
export const FIRE_MAX_SOURCES = 64, FIRE_MAX_SPREAD = 4;

// COLORANTS, as fireworks are coloured: a metal salt in the flame, its atoms (or the molecules they form in the flame)
// excited by the heat and giving light at their own lines: sodium's 589 nm doublet (yellow, and it drowns the rest),
// strontium's SrOH/SrCl bands 600–690 nm (red), lithium 671 nm (crimson), calcium's CaOH (orange), barium's BaCl
// 505–535 nm (green), boron's BO₂ (green), copper's CuCl 420–460 nm (blue), potassium 766/404 nm (lilac). rgb: the
// line light as linear display colour. A coloured flame must burn clean: glowing soot is the yellow of an ordinary
// flame, and it outshines the lines, so a colorant thins the soot unless `soot` says otherwise (pyrotechnic stars
// carry their own oxidiser and a chlorine donor for exactly this).
export const FIRE_COLORANTS = Object.freeze({
  sodium: [1, 0.66, 0.06], strontium: [1, 0.05, 0.06], lithium: [1, 0.03, 0.16], calcium: [1, 0.32, 0.04],
  barium: [0.32, 1, 0.08], boron: [0.12, 1, 0.22], copper: [0.06, 0.32, 1], potassium: [0.62, 0.32, 1],
});
const HEX = /^#[0-9a-fA-F]{6}$/;
const hexLin = (h) => [1, 3, 5].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2));
function colorErrors(c, where) {
  if (c === undefined) return [];
  const salts = Object.keys(FIRE_COLORANTS).join(', ');
  if (typeof c === 'string') return FIRE_COLORANTS[c] || HEX.test(c) ? [] : [`${where} must be a colorant (${salts}), a mix { strontium: 1, copper: 0.5 }, or '#rrggbb'`];
  if (!c || typeof c !== 'object' || Array.isArray(c)) return [`${where} must be a colorant (${salts}), a mix, or '#rrggbb'`];
  const e = []; for (const [k, v] of Object.entries(c)) { if (!FIRE_COLORANTS[k]) e.push(`${where}.${k} is not a colorant (${salts})`); else if (!(isNum(v) && v >= 0)) e.push(`${where}.${k} must be a weight ≥ 0`); }
  if (!e.length && !Object.values(c).some((v) => v > 0)) e.push(`${where} needs at least one weight above 0`);
  return e;
}
// → { line: [r, g, b] (normalised so its brightest channel is 1), k: how much of the flame's light it is, magic }
function resolveColor(c) {
  if (c === undefined) return null;
  if (typeof c === 'string' && HEX.test(c)) { const l = hexLin(c), m = Math.max(...l, 1e-6); return { line: l.map((v) => +(v / m).toFixed(4)), k: 1, magic: true }; }
  const mix = typeof c === 'string' ? { [c]: 1 } : c; let r = 0, g = 0, b = 0, w = 0;
  for (const [k, v] of Object.entries(mix)) { const q = FIRE_COLORANTS[k]; r += q[0] * v; g += q[1] * v; b += q[2] * v; w += v; }
  const m = Math.max(r, g, b, 1e-6); return { line: [r / m, g / m, b / m].map((v) => +v.toFixed(4)), k: 0.85, magic: false };
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * validateFire(fire) → [] when valid, else teaching messages. `fire` is `true` (a world that knows where its fires
 * are: a dungeon's chambers and tunnels) or `{ sources?, embers?, smoke?, light? }` where a source is
 * `{ kind: 'candle'|'torch'|'brazier'|'campfire', at: [x, y] | [x, y, z], size?: 0.25–4, phi?: 0–1, color?, soot?: 0–1,
 * smokeColor?: '#rrggbb', life?: { start?, kindle?, out?, die? }, flares?: { every, strength? }, path? }`; `color` (a
 * colorant, a mix of them, or '#rrggbb') on the fire sets every source's. A fireball takes `path: { from: [x, y, z],
 * to: [x, y, z], speed? (m/s, 14), arc? (m), every? (s), delay? (s) }` in place of `at`.
 */
export function validateFire(fire) {
  if (fire === undefined || fire === null || fire === false) return [];
  if (fire === true) return [];
  if (typeof fire !== 'object' || Array.isArray(fire)) return ['fire must be true or { sources: [{ kind, at }], embers?, smoke?, light? }'];
  const e = [], kinds = Object.keys(FIRE_KINDS).join(', ');
  for (const k of Object.keys(fire)) if (!['sources', 'spread', 'embers', 'smoke', 'light', 'color'].includes(k)) e.push(`fire.${k} is not a fire option (sources, spread, embers, smoke, light, color)`);
  if (fire.spread !== undefined) {
    if (!Array.isArray(fire.spread)) e.push('fire.spread must be a list of { at: [x, y], start?, rate?, extent?, phi? } (grass fires lit at a point)');
    else {
      if (fire.spread.length > FIRE_MAX_SPREAD) e.push(`fire.spread has ${fire.spread.length} fires; at most ${FIRE_MAX_SPREAD}`);
      fire.spread.forEach((g, i) => {
        const w = `fire.spread[${i}]`;
        if (!g || typeof g !== 'object' || !Array.isArray(g.at) || (g.at.length !== 2 && g.at.length !== 3) || !g.at.every(isNum)) { e.push(`${w}.at must be [x, y] (where it is lit, on the ground) or [x, y, z]`); return; }
        if (g.start !== undefined && !(isNum(g.start) && g.start >= 0)) e.push(`${w}.start must be seconds ≥ 0 (when it is lit)`);
        if (g.rate !== undefined && !(isNum(g.rate) && g.rate >= 0.01 && g.rate <= 0.5)) e.push(`${w}.rate must be 0.01–0.5 m/s (how fast it spreads in still air; 0.05 for dry grass)`);
        if (g.extent !== undefined && !(isNum(g.extent) && g.extent >= 5 && g.extent <= 500)) e.push(`${w}.extent must be 5–500 m (how far its head runs before it burns out)`);
        if (g.phi !== undefined && !(isNum(g.phi) && g.phi >= 0 && g.phi <= 1)) e.push(`${w}.phi must be from 0 (spreads as in still air) to 1`);
      });
    }
  }
  e.push(...colorErrors(fire.color, 'fire.color'));
  if (fire.sources !== undefined) {
    if (!Array.isArray(fire.sources)) e.push('fire.sources must be a list of { kind, at: [x, y] or [x, y, z] }');
    else {
      if (fire.sources.length > FIRE_MAX_SOURCES) e.push(`fire.sources has ${fire.sources.length} fires; at most ${FIRE_MAX_SOURCES}`);
      fire.sources.forEach((s, i) => {
        if (!s || typeof s !== 'object') { e.push(`fire.sources[${i}] must be { kind, at }`); return; }
        if (!FIRE_KINDS[s.kind]) e.push(`fire.sources[${i}].kind must be one of ${kinds}`);
        const pt3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum), where = `fire.sources[${i}]`;
        if (s.kind === 'fireball' || s.path !== undefined) {
          const P = s.path;
          if (s.kind !== 'fireball') e.push(`${where}.path is for a fireball (kind 'fireball'); a ${s.kind} stands at \`at\``);
          else if (!P || typeof P !== 'object' || !pt3(P.from) || !pt3(P.to)) e.push(`${where}.path must be { from: [x, y, z], to: [x, y, z], speed?, arc?, every?, delay? } (a fireball flies from → to)`);
          else {
            if (P.speed !== undefined && !(isNum(P.speed) && P.speed > 0 && P.speed <= 80)) e.push(`${where}.path.speed must be m/s, above 0 and at most 80`);
            if (P.arc !== undefined && !isNum(P.arc)) e.push(`${where}.path.arc must be metres (how far the middle of the flight lifts)`);
            if (P.every !== undefined && !(isNum(P.every) && P.every > 0)) e.push(`${where}.path.every must be seconds between casts, above 0`);
            if (P.delay !== undefined && !(isNum(P.delay) && P.delay >= 0)) e.push(`${where}.path.delay must be seconds ≥ 0`);
          }
        } else if (!Array.isArray(s.at) || (s.at.length !== 2 && s.at.length !== 3) || !s.at.every(isNum)) e.push(`${where}.at must be [x, y] (on the ground) or [x, y, z]`);
        if (s.life !== undefined) {
          const L = s.life;
          if (!L || typeof L !== 'object' || Array.isArray(L)) e.push(`${where}.life must be { start?, kindle?, out?, die? } (seconds)`);
          else for (const k of Object.keys(L)) { if (!['start', 'kindle', 'out', 'die'].includes(k)) e.push(`${where}.life.${k} is not a life stage (start, kindle, out, die)`); else if (!(isNum(L[k]) && L[k] >= 0)) e.push(`${where}.life.${k} must be seconds ≥ 0`); }
        }
        if (s.flares !== undefined) {
          const Fl = s.flares;
          if (!Fl || typeof Fl !== 'object' || !(isNum(Fl.every) && Fl.every >= 1)) e.push(`${where}.flares must be { every: seconds ≥ 1, strength?: 0–3 }`);
          else if (Fl.strength !== undefined && !(isNum(Fl.strength) && Fl.strength >= 0 && Fl.strength <= 3)) e.push(`${where}.flares.strength must be 0–3 (how much harder it burns at the peak of a flare)`);
        }
        if (s.size !== undefined && !(isNum(s.size) && s.size >= 0.25 && s.size <= 4)) e.push(`fire.sources[${i}].size must be a number from 0.25 to 4`);
        if (s.phi !== undefined && !(isNum(s.phi) && s.phi >= 0 && s.phi <= 1)) e.push(`fire.sources[${i}].phi must be from 0 (still air) to 1`);
        e.push(...colorErrors(s.color, `fire.sources[${i}].color`));
        if (s.soot !== undefined && !(isNum(s.soot) && s.soot >= 0 && s.soot <= 1)) e.push(`fire.sources[${i}].soot must be from 0 (a clean, line-coloured flame) to 1 (all yellow soot)`);
        if (s.smokeColor !== undefined && !(typeof s.smokeColor === 'string' && HEX.test(s.smokeColor))) e.push(`fire.sources[${i}].smokeColor must be '#rrggbb' (a coloured signal smoke)`);
      });
    }
  }
  for (const k of ['embers', 'smoke']) if (fire[k] !== undefined && typeof fire[k] !== 'boolean') e.push(`fire.${k} must be true or false`);
  if (fire.light !== undefined && !(isNum(fire.light) && fire.light >= 0 && fire.light <= 4)) e.push('fire.light must be a number from 0 to 4 (a scale on how far the fires light)');
  return e;
}

/**
 * resolveFire(fire, placed) → the page's fire config, or null. `placed` are the sources a world kind knows (a
 * dungeon's, or a terrain's grounded ones: { kind, at: [x, y, z], baked? }); explicit `fire.sources` come after
 * them (`explicit: false` when the world already grounded them into `placed`); `spread`: the grass fires with their
 * `at` on the ground, when the world grounded them (else `fire.spread`, a 2D `at` at z = 0). baked: the world's own light already holds this fire (the page then only flickers it).
 */
export function resolveFire(fire, placed = [], { explicit: withExplicit = true, spread: placedSpread = null } = {}) {
  if (!fire) return null;
  const o = fire === true ? {} : fire;
  // a 2D `at` stands on the ground: a world that knows its ground hands these over placed (and says so); elsewhere z = 0
  const explicit = withExplicit ? (o.sources || []).map((s) => ({ ...s, at: s.path ? s.path.from : s.at.length === 3 ? s.at : [s.at[0], s.at[1], 0] })) : [];
  const all = [...placed, ...explicit].slice(0, FIRE_MAX_SOURCES);
  // grass fires: lit at a point (on the ground: a terrain grounds `at` as it does sources'), 36 flamelets on the front
  const spread = (placedSpread || o.spread || []).slice(0, FIRE_MAX_SPREAD).map((g, j) => ({ at: (g.at.length === 3 ? g.at : [g.at[0], g.at[1], 0]).map((v) => +(+v).toFixed(4)),
    start: isNum(g.start) ? g.start : 2, rate: isNum(g.rate) ? g.rate : 0.05, extent: isNum(g.extent) ? g.extent : 60, phi: isNum(g.phi) ? g.phi : 1, n: 36, seed: (j * 6151 + 991) | 0 }));
  if (!all.length && !spread.length) return null;
  return {
    embers: o.embers !== false, smoke: o.smoke !== false, light: isNum(o.light) ? o.light : 1, ...(spread.length ? { spread } : {}),
    sources: all.map((s, i) => {
      const K = FIRE_KINDS[s.kind], k = isNum(s.size) ? s.size : 1;
      // a bigger fire of a kind: its bed scales with size, its flame and light with size^(2/5)·… as Heskestad's do
      const at = [s.at[0], s.at[1], s.at[2] + (K.seat || 0) * k], col = resolveColor(s.color !== undefined ? s.color : o.color);
      // a coloured flame burns clean unless told: its soot is what is left of an ordinary flame's
      const soot = isNum(s.soot) ? s.soot : col ? (col.magic ? 0.06 : 0.12) : 1;
      return { kind: s.kind, at: at.map((v) => +v.toFixed(4)), D: K.D * k, L: K.L * Math.pow(k, 0.8), n: K.n, lam: K.lam, light: K.light * Math.pow(k, 1.6),
        embers: Math.round(K.embers * k), smoke: K.smoke, soot: K.soot * soot, phi: isNum(s.phi) ? s.phi : 1, baked: !!s.baked, seed: (i * 7919 + 17) | 0,
        ...(col ? { line: col.line, lineK: col.k } : {}), ...(s.smokeColor ? { smokeColor: hexLin(s.smokeColor).map((v) => +v.toFixed(4)) } : {}),
        ...(s.life ? { life: { start: s.life.start || 0, kindle: s.life.kindle || 0, ...(isNum(s.life.out) ? { out: s.life.out, die: isNum(s.life.die) ? s.life.die : 4 } : {}) } } : {}),
        ...(s.flares ? { flares: { every: s.flares.every, strength: isNum(s.flares.strength) ? s.flares.strength : 1 } } : {}),
        ...(s.path ? { path: flightOf(s.path) } : {}) };
    }),
  };
}

// ── the kernel, as one self-contained function ───────────────────────────────────────────────────────────────────
/**
 * fireKernel(F, air) closes over nothing (the World page inlines its source). F: resolveFire's config; air(x, y, z,
 * t) → [ux, uy, uz] (null for still air). → { flames(i, t), light(i, t), intensity(i, t), centre(i, t), embers(i, t),
 * smoke(i, t), NP, N }.
 *   flames: one entry per flamelet { pts (NP×3), rad (NP), L }, or null where it is out; light: the light now, 1 for
 *   the fire burning steadily (flicker × intensity); intensity: k(t) (below); centre: where the fire is now (a
 *   fireball moves), null when there is none; embers: [x, y, z, xPrev, yPrev, zPrev, heat, …] (7 a spark);
 *   smoke: [x, y, z, radius, alpha, …].
 *
 * INTENSITY k(t), how hard a fire burns against its steady self: it KINDLES (grows from a spark over `life.kindle`
 * seconds), can DIE back (from `life.out` over `life.die` seconds, to embers), FLARES (`flares`: every so often a
 * whoosh — fuel catching, a gust into the coals — that jumps and settles over about a second), and the wind it is
 * not blown out by FEEDS it (the bellows: more air to the bed, a hotter fire). A fireball BURSTS where it lands.
 * k drives the rest as a fire's heat release does: flame length ∝ k^0.5 (Heskestad's Q^0.4, a little steeper so a
 * flare reads), flame width ∝ k^0.3, light ∝ k, embers and smoke ∝ k.
 *
 * A GRASS FIRE (`F.spread`) runs from where it was lit. In a steady wind a point fire's perimeter is an ellipse
 * (Huygens spread; Anderson 1983): its head runs downwind at R = R0 (1 + 2.2 U^1.3) (Rothermel's wind factor read for
 * grass: 5 cm/s in still air, about 0.5 m/s at 3 m/s, 1 m/s at 5), its back creeps upwind at R / HB, and its
 * length over breadth LB grows with the wind (Anderson's fit, at the mid-flame wind); HB follows from LB
 * (Alexander 1985). It runs until its head has gone `extent` metres, then burns out. Flames stand along the front,
 * as long as Byram's L = 0.0775 I^0.46 m for the intensity I = H w R there (grass, 18 MJ/kg at 0.25 kg/m²), so the head's
 * are metres high and the back's a hand's breadth. Behind it the ground is burnt (`burn` gives the page the
 * ellipse), with a band of embers glowing behind the front.
 *
 * A FIREBALL is a moving fire. Its trail is the streakline itself: the gas let go `age` ago left the ball where the
 * ball WAS then, and has been drifting and rising since, so a fast ball draws a long tail and a slow one a short
 * one, and a gust bends the tail. It flies `path.from` → `path.to` at `speed` (an `arc` lifts the middle of its
 * flight), again every `every` seconds, and bursts where it lands: a flash, a swell, a shell of sparks.
 */
export function fireKernel(F, air, world) {
  const G = 9.81, NP = 12, MS = 18, GN = 20, BURST = 0.9, groundAt = world && world.groundAt, burnable = world && world.burnable;
  const hash = (a, b) => { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const sm = (e0, e1, x) => { const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
  const S = F.sources.map((s, si) => {
    let a = s.seed | 0; const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const R = s.D / 2, fl = [], ball = !!s.path;
    for (let k = 0; k < s.n; k++) {
      // the first flamelet stands at the centre; the rest on a ring, the outer ones shorter (a ball's crowd its core)
      const q = 2 * Math.PI * (k / Math.max(1, s.n - 1) + 0.13 * rnd()), r = k === 0 ? 0 : R * (ball ? 0.25 : 0.45 + 0.4 * rnd());
      const eddies = []; for (let j = 0; j < 5; j++) eddies.push([0.6 + 2.6 * rnd(), 2 * Math.PI * rnd(), 2 * Math.PI * rnd(), 2 * Math.PI * rnd()]);
      fl.push({ dx: r * Math.cos(q), dy: r * Math.sin(q), dz: ball ? R * 0.25 * (rnd() - 0.5) : 0, tall: ball ? 1 - 0.2 * rnd() : 1 - 0.38 * (r / Math.max(R, 1e-9)) - 0.1 * rnd(), ph: 2 * Math.PI * rnd(), eddies });
    }
    const puff = s.lam ? 0 : 1.5 / Math.sqrt(Math.max(s.D, 0.02));
    // the burnt gas rises on its buoyancy: a candle's at an effective 28 m/s², a big fire's slower (mixing)
    const gp = s.lam ? 28 : 18, wmax = 3 * Math.sqrt(G * Math.max(s.L, 0.03));
    const P = s.path, T = P ? Math.hypot(P.to[0] - P.from[0], P.to[1] - P.from[1], P.to[2] - P.from[2]) / P.speed : 0;
    return { s, si, fl, puff, gp, wmax, own: s.lam ? 0 : 0.2 * Math.sqrt(G * s.D), ball, T };
  });
  // grass fires, after the standing ones: a fire's front, its flamelets spaced along it
  for (const g of F.spread || []) {
    let a = g.seed | 0; const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const U = (F.wind ? F.wind.speed : 0) * g.phi, dir = F.wind ? F.wind.dir : 0, Um = 0.5 * U * 2.237;   // mid-flame wind, mph
    const Rh = g.rate * (1 + 2.2 * Math.pow(U, 1.3)), LB = Math.min(8, Math.max(1, 0.936 * Math.exp(0.2566 * Um) + 0.461 * Math.exp(-0.1548 * Um) - 0.397));
    const q = Math.sqrt(LB * LB - 1), HB = (LB + q) / Math.max(1e-9, LB - q), byram = (R) => 0.0775 * Math.pow(18000 * 0.25 * R, 0.46);
    const fl = []; for (let k = 0; k < g.n; k++) { const eddies = []; for (let j = 0; j < 5; j++) eddies.push([0.6 + 2.6 * rnd(), 2 * Math.PI * rnd(), 2 * Math.PI * rnd(), 2 * Math.PI * rnd()]); fl.push({ j: k + 0.4 * (rnd() - 0.5), dx: 0, dy: 0, dz: 0, tall: 0.8 + 0.2 * rnd(), ph: 2 * Math.PI * rnd(), eddies }); }
    const Lh = byram(Rh), D = 1.4;
    S.push({ s: { kind: 'grass', at: g.at, D, L: Lh, n: g.n, lam: false, light: 6 + 10 * Lh, embers: 30, smoke: 10, soot: 0.85, phi: g.phi, seed: g.seed }, si: S.length, fl, puff: 1.5 / Math.sqrt(D),
      gp: 18, wmax: 3 * Math.sqrt(G * Lh), own: 0.2 * Math.sqrt(G * D), ball: false, T: 0,
      spread: { Rh, Rb: Rh / HB, LB, ux: Math.cos(dir), uy: Math.sin(dir), start: g.start, tEnd: g.extent / Rh, Lh, byram, extent: g.extent } });
  }
  // a grass fire's front now: its ellipse (centre, half-length along the wind, half-breadth), how far its head has
  // gone, and how hard it still burns (1 while it runs, dying over a few seconds once it has run its course)
  function frontAt(S1, t) {
    const g = S1.spread, tau = t - g.start; if (tau < 0) return null;
    const tc = Math.min(tau, g.tEnd), head = g.Rh * tc, back = g.Rb * tc, a = Math.max(0.05, (head + back) / 2), off = (head - back) / 2;
    return { tau, head, a, b: a / g.LB, cx: S1.s.at[0] + g.ux * off, cy: S1.s.at[1] + g.uy * off, k: tau < g.tEnd ? Math.min(1, tau / 2 + 0.2) : Math.exp(-(tau - g.tEnd) / 5) };
  }
  // the point of the front at parameter angle φ (0 = the head), the ground's height under it, and the flame there
  function frontPoint(S1, fr, phi) {
    const g = S1.spread, c = Math.cos(phi), sn = Math.sin(phi), x = fr.cx + fr.a * c * g.ux - fr.b * sn * g.uy, y = fr.cy + fr.a * c * g.uy + fr.b * sn * g.ux;
    const r = Math.hypot(x - S1.s.at[0], y - S1.s.at[1]), R = fr.head > 1e-6 ? (g.Rh * r) / fr.head : g.Rh;
    return [x, y, groundAt ? groundAt(x, y) : S1.s.at[2], g.byram(Math.max(R, 0.02))];
  }
  const take = (S1, p, t) => { if (!air || !(S1.s.phi > 0) || !p) return [0, 0, 0]; const u = air(p[0], p[1], p[2], t); return [S1.s.phi * u[0], S1.s.phi * u[1], S1.s.phi * u[2]]; };
  // a fireball's flight: where it is (null between casts), and how long since it landed (−1 in flight)
  function flight(S1, t) {
    const P = S1.s.path, tt = t - P.delay; if (tt < 0) return null;
    const n = Math.floor(tt / P.every), tau = tt - n * P.every;
    if (tau > S1.T + BURST) return null;
    const u = Math.min(1, tau / S1.T);
    return { tau, n, burst: tau >= S1.T ? tau - S1.T : -1, p: [0, 1, 2].map((c) => P.from[c] + (P.to[c] - P.from[c]) * u + (c === 2 ? P.arc * 4 * u * (1 - u) : 0)) };
  }
  const centreOf = (S1, t) => { if (S1.spread) { const fr = frontAt(S1, t); return fr ? frontPoint(S1, fr, 0).slice(0, 3) : null; } return S1.ball ? (flight(S1, t) || { p: null }).p : S1.s.at; };
  function intensity(S1, t) {
    const s = S1.s; let k = 1;
    if (S1.spread) { const fr = frontAt(S1, t); return fr ? fr.k : 0; }
    const L = s.life;
    if (L) {
      const t0 = L.start || 0;
      if (t < t0) return 0;
      if (L.kindle > 0) k *= 1 - Math.exp(-3 * (t - t0) / L.kindle);
      if (Number.isFinite(L.out) && t > L.out) k *= Math.exp(-3 * (t - L.out) / Math.max(0.1, L.die || 4));
    }
    const Fl = s.flares;
    if (Fl) {
      const off = Fl.every * 0.5, n = Math.floor((t - off) / Fl.every), tau = t - off - n * Fl.every - Fl.every * 0.35 * hash(S1.si * 53 + 7, n);
      if (tau >= 0) k *= 1 + Fl.strength * (tau < 0.15 ? tau / 0.15 : Math.exp(-(tau - 0.15) / 0.8));
    }
    if (S1.ball) {
      const f = flight(S1, t); if (!f) return 0;
      if (f.burst >= 0) k *= (1 + 3 * Math.exp(-f.burst / 0.12)) * Math.exp(-f.burst / 0.3);
    } else if (!s.lam) {
      // the bellows: wind at the bed feeds a fire it does not blow out, a little, up to a point
      const u = take(S1, s.at, t); k *= 1 + 0.07 * Math.min(6, Math.hypot(u[0], u[1]));
    }
    return k;
  }
  // a flamelet's length now: its share of the fire, lifted by the puff (all of a fire puffs together, each flamelet
  // a little out of step) and by its own eddies
  const lengthOf = (S1, f, t) => {
    const s = S1.s; if (s.lam) return s.L;
    const w = 2 * Math.PI * S1.puff * t;
    return s.L * f.tall * (1 + 0.24 * Math.sin(w + 0.35 * f.ph) + 0.08 * Math.sin(2.3 * w + f.ph) + 0.06 * Math.sin(0.37 * w + 2 * f.ph));
  };
  function baseAir(S1, f, base, t) {
    const u = take(S1, base, t), m = Math.hypot(u[0], u[1], u[2]), k = 0.33 * m + S1.own;
    if (!(k > 0)) return u;
    let x = 0, y = 0, z = 0;
    for (const [fr, p, q, r] of f.eddies) { const w = 2 * Math.PI * fr * Math.max(1, S1.puff) * t; x += Math.sin(w + p); y += Math.sin(1.07 * w + q); z += Math.sin(0.93 * w + r); }
    return [u[0] + 0.45 * k * x, u[1] + 0.45 * k * y, u[2] + 0.3 * k * z];
  }
  function flames(i, t) {
    const S1 = S[i], s = S1.s, out = [], kNow = intensity(S1, t), fNow = S1.ball ? flight(S1, t) : null;
    const front = S1.spread ? frontAt(S1, t) : null;
    for (const f of S1.fl) {
      if (!(kNow > 0.03) || (S1.ball && !fNow) || (S1.spread && !front)) { out.push(null); continue; }
      // a grass fire's flamelet stands on its front at its own angle (the head first), as tall as the fire there
      const fp = S1.spread ? frontPoint(S1, front, (2 * Math.PI * f.j) / S1.s.n) : null;
      if (fp && burnable && !burnable(fp[0], fp[1])) { out.push(null); continue; }
      const L = (fp ? fp[3] * f.tall * (1 + 0.2 * Math.sin(2 * Math.PI * S1.puff * t + f.ph)) : lengthOf(S1, f, t)) * Math.sqrt(kNow);
      if (fp && L < 0.08) { out.push(null); continue; }
      // where the gas let go `age` ago left from: a standing fire's bed, or the ball where it was then (no earlier
      // than this cast's launch)
      const since = S1.ball ? fNow.tau : Infinity;
      const baseAt = (age) => { if (fp) return [fp[0], fp[1], fp[2]]; if (!S1.ball) return [s.at[0] + f.dx, s.at[1] + f.dy, s.at[2]]; const g = flight(S1, t - Math.min(age, since)); const p = g ? g.p : fNow.p; return [p[0] + f.dx, p[1] + f.dy, p[2] + f.dz]; };
      const aMax = S1.ball ? 0.28 : Math.sqrt((2 * L) / S1.gp), dg = aMax / GN, cum = new Float64Array(3 * (GN + 1)), tw = S1.wmax / S1.gp, base0 = baseAt(0);
      for (let g = 0; g < GN; g++) { const u = baseAir(S1, f, base0, t - (g + 0.5) * dg); for (let c = 0; c < 3; c++) cum[3 * (g + 1) + c] = cum[3 * g + c] + u[c] * dg; }
      // a ball's gas is young and fast-cooling: it rises less in its short life than a standing flame's
      const rise = (age) => (S1.ball ? 0.35 : 1) * (age < tw ? 0.5 * S1.gp * age * age : 0.5 * S1.gp * tw * tw + S1.wmax * (age - tw));
      const path = new Float64Array(3 * MS), arc = new Float64Array(MS);
      for (let k = 0; k < MS; k++) {
        const age = aMax * Math.sqrt(k / (MS - 1)), gi = Math.min(GN - 1e-9, age / dg), g0 = Math.floor(gi), fg = gi - g0, b = baseAt(age);
        for (let c = 0; c < 3; c++) path[3 * k + c] = b[c] + cum[3 * g0 + c] + fg * (cum[3 * g0 + 3 + c] - cum[3 * g0 + c]);
        path[3 * k + 2] += rise(age);
        if (k) arc[k] = arc[k - 1] + Math.hypot(path[3 * k] - path[3 * k - 3], path[3 * k + 1] - path[3 * k - 2], path[3 * k + 2] - path[3 * k - 1]);
      }
      // a bent flame is carried sideways, not stretched: it ends about L along its own arc
      const Larc = Math.min(arc[MS - 1], L) || 1e-9, pts = new Float64Array(3 * NP), rad = new Float64Array(NP);
      // a grass fire's flamelets are as wide as their share of the front (and no wider than tall)
      const wk = Math.pow(kNow, 0.3), Rm = fp ? Math.min(0.55 * L, (0.6 * Math.PI * (front.a + front.b)) / s.n + 0.15) : (s.lam ? 0.0044 * (s.L / 0.03) ** 0.6 : (0.62 * s.D) / Math.sqrt(s.n) + 0.08 * L) * wk;
      // a landed ball swells as it bursts (to about three and a half times across in a fifth of a second) and fades
      const Rb = (s.D / 2) * wk * (fNow && fNow.burst >= 0 ? 1 + 2.5 * (1 - Math.exp(-fNow.burst / 0.08)) : 1);
      for (let k = 0, j = 0; k < NP; k++) {
        const want = (Larc * k) / (NP - 1);
        while (j < MS - 2 && arc[j + 1] < want) j++;
        const fr0 = Math.min(1, Math.max(0, (want - arc[j]) / Math.max(1e-12, arc[j + 1] - arc[j])));
        for (let c = 0; c < 3; c++) pts[3 * k + c] = path[3 * j + c] + fr0 * (path[3 * j + 3 + c] - path[3 * j + c]);
        const fr = k / (NP - 1), peak = s.lam ? 0.28 : 0.18;
        // a ball is round where it is and tapers down its tail; a standing flame is a teardrop
        rad[k] = S1.ball ? Rb * (0.18 + 0.82 * Math.pow(1 - fr, 1.6))
          : Rm * (fr < peak ? 0.5 + 0.5 * Math.sin((fr / peak) * Math.PI / 2) : Math.pow(Math.cos(((fr - peak) / (1 - peak)) * Math.PI / 2), s.lam ? 0.85 : 0.7));
      }
      out.push({ pts, rad, L });
    }
    return out;
  }
  // the light follows the flames: the fire's flame length now over its mean, sharpened a little, times how hard it burns
  function light(i, t) {
    const S1 = S[i], k = intensity(S1, t); if (!(k > 0)) return 0;
    if (S1.s.lam) return k * (1 + 0.02 * Math.sin(2 * Math.PI * 9.1 * t + S1.si));
    if (S1.spread) { const fr = frontAt(S1, t); return k * Math.min(4, Math.sqrt(1 + fr.head / 4)) * (1 + 0.12 * Math.sin(2 * Math.PI * S1.puff * t)); }
    let a = 0, b = 0; for (const f of S1.fl) { a += lengthOf(S1, f, t); b += S1.s.L * f.tall; }
    return k * Math.pow(a / b, 1.4);
  }
  // embers: each slot is relaunched every `period` seconds from the bed, rises on the plume (slowing as it leaves it),
  // drifts with the air at its launch and wanders; it glows, cooling, for its life. A harder fire fills more slots.
  // A fireball sheds them along its flight.
  function emberAt(S1, k, t) {
    const s = S1.s, P = (S1.ball ? 0.35 : 0.9) + (S1.ball ? 0.5 : 2.2) * hash(S1.si * 131 + k, 1), off = P * hash(S1.si * 131 + k, 2), n = Math.floor((t - off) / P), t0 = off + n * P, age = t - t0;
    const r = (j) => hash(S1.si * 131 + k + 977 * j, n * 7 + 3);
    const life = (0.5 + 1.6 * r(1)) * Math.sqrt(Math.max(s.L, 0.2) / 0.8);
    if (!(age >= 0 && age < life)) return null;
    const k0 = intensity(S1, t0); if (!(k < s.embers * Math.min(3, k0))) return null;
    let c0 = centreOf(S1, t0); if (!c0) return null;
    if (S1.spread) { const fr = frontAt(S1, t0); const fp = frontPoint(S1, fr, 2 * Math.PI * hash(S1.si * 17 + k, n * 3 + 1)); if (burnable && !burnable(fp[0], fp[1])) return null; c0 = fp.slice(0, 3); }
    if (S1.ball && flight(S1, t0).burst >= 0) return null;   // a landed ball's sparks are its shell (below)
    const q = 2 * Math.PI * r(2), rr = 0.4 * s.D * Math.sqrt(r(3)), x0 = c0[0] + rr * Math.cos(q), y0 = c0[1] + rr * Math.sin(q), z0 = c0[2] + (S1.ball ? 0 : 0.2 * s.L * r(4));
    const u = take(S1, [x0, y0, z0], t0), w0 = (S1.ball ? 0.4 : (1.2 + 1.8 * r(5)) * 2.2) * Math.sqrt(Math.max(s.L, 0.2) / 0.8), tau = 0.45, sway = 0.12 * s.D + 0.05;
    const at = (a1) => [x0 + 0.85 * u[0] * a1 + sway * Math.sin(5.1 * a1 + 6 * r(6)) * a1, y0 + 0.85 * u[1] * a1 + sway * Math.cos(4.3 * a1 + 6 * r(7)) * a1, z0 + w0 * tau * (1 - Math.exp(-a1 / tau)) + 0.25 * a1 + 0.5 * u[2] * a1];
    const p = at(age), pp = at(Math.max(0, age - 0.035));
    return [p[0], p[1], p[2], pp[0], pp[1], pp[2], Math.exp(-age / (0.55 * life))];
  }
  // a burst throws its whole shell at once: every slot leaves the landing point at the moment of impact
  function shell(S1, t) {
    const out = [], P = S1.s.path, tt = t - P.delay; if (tt < 0) return out;
    const n = Math.floor(tt / P.every), b = tt - n * P.every - S1.T; if (!(b >= 0 && b < BURST)) return out;
    for (let k = 0; k < 3 * S1.s.embers; k++) {
      const r = (j) => hash(S1.si * 191 + k + 613 * j, n * 11 + 5), life = 0.35 + 0.5 * r(1); if (b > life) continue;
      const q = 2 * Math.PI * r(2), c = 0.2 + 0.8 * r(3), sq = Math.sqrt(1 - c * c), v = 4 + 6 * r(4), tau = 0.22;
      const at = (a1) => { const e = tau * (1 - Math.exp(-a1 / tau)); return [P.to[0] + v * sq * Math.cos(q) * e, P.to[1] + v * sq * Math.sin(q) * e, P.to[2] + v * c * e - 2 * a1 * a1]; };
      const p = at(b), pp = at(Math.max(0, b - 0.03)); out.push(p[0], p[1], p[2], pp[0], pp[1], pp[2], Math.exp(-b / (0.5 * life)));
    }
    return out;
  }
  function embers(i, t) { const S1 = S[i], out = []; if (!F.embers) return out; for (let k = 0; k < 3 * S1.s.embers; k++) { const e = emberAt(S1, k, t); if (e) out.push(...e); } if (S1.ball) out.push(...shell(S1, t)); return out; }
  // smoke: a puff let go every 1/rate seconds from the flame tops, rising (slowing) and drifting with the air of its
  // middle age, swelling as it mixes, thinning out over a few seconds; as thick as the fire was hard when it left
  function smoke(i, t) {
    const S1 = S[i], s = S1.s, out = []; if (!F.smoke || !(s.smoke > 0)) return out;
    const life = 4.5, rate = s.smoke, j1 = Math.floor(t * rate);
    for (let j = j1; j > j1 - life * rate; j--) {
      const t0 = j / rate, age = t - t0; if (age < 0 || age > life) continue;
      let c0 = centreOf(S1, t0), k0 = c0 ? intensity(S1, t0) : 0; if (!(k0 > 0.05)) continue;
      if (S1.spread) { const fr = frontAt(S1, t0); c0 = frontPoint(S1, fr, (hash(S1.si * 29 + 3, j) - 0.5) * 2.2).slice(0, 3); }
      const h = (m) => hash(S1.si * 31 + 5, j * 13 + m), z0 = c0[2] + (S1.ball ? 0 : 0.95 * s.L);
      const u = take(S1, [c0[0], c0[1], z0 + 0.5], t0 + 0.5 * age), rise = (0.6 + 0.6 * Math.sqrt(s.L)) * 1.2 * (1 - Math.exp(-age / 1.2)) + 0.12 * age;
      out.push(c0[0] + u[0] * age + 0.15 * s.D * (h(1) - 0.5) * (1 + 2 * age), c0[1] + u[1] * age + 0.15 * s.D * (h(2) - 0.5) * (1 + 2 * age), z0 + rise + 0.3 * u[2] * age,
        0.4 * s.D + 0.12 + (0.18 + 0.25 * s.D) * age, Math.min(1, 0.5 * Math.min(2, k0)) * (1 - Math.exp(-age / 0.35)) * Math.exp(-age / 1.6));
    }
    return out;
  }
  // a grass fire's burnt ground, for the page: [cx, cy, a, b, ux, uy, band, k] (the band of embers behind the front, in
  // metres: what burned in the last dozen seconds), or null before it is lit
  function burn(i, t) { const S1 = S[i]; if (!S1 || !S1.spread) return null; const fr = frontAt(S1, t); if (!fr) return null; const g = S1.spread; return [fr.cx, fr.cy, fr.a, fr.b, g.ux, g.uy, Math.max(0.4, g.Rh * 12), fr.k]; }
  return { NP, flames, light, intensity: (i, t) => intensity(S[i], t), centre: (i, t) => centreOf(S[i], t), embers, smoke, burn, src: (i) => S[i].s, N: S.length, NS: F.sources.length };
}

// a fireball's flight with its defaults: 14 m/s, flat, again every flight + 2.5 s, first after half a second
function flightOf(P) {
  const speed = isNum(P.speed) ? P.speed : 14, T = Math.hypot(P.to[0] - P.from[0], P.to[1] - P.from[1], P.to[2] - P.from[2]) / speed;
  return { from: P.from, to: P.to, speed, arc: isNum(P.arc) ? P.arc : 0, every: isNum(P.every) ? Math.max(P.every, T + 1) : +(T + 2.5).toFixed(4), delay: isNum(P.delay) ? P.delay : 0.5 };
}

/** fireLightColor(color, kind) → the [r, g, b] a fire of that colour lights the world with (what a world's bake should
 *  use for it): its kind's warm yellow, or as much of the colorant's lines as the clean flame gives. */
export function fireLightColor(color, kind = 'brazier', soot) {
  const base = { candle: [1, 0.66, 0.34], torch: [1, 0.55, 0.24], brazier: [1, 0.52, 0.22], campfire: [1, 0.5, 0.2] }[kind] || [1, 0.56, 0.24];
  const c = resolveColor(color); if (!c) return base;
  const st = isNum(soot) ? soot : c.magic ? 0.06 : 0.12, k = c.k * (1 - 0.6 * st);
  return base.map((v, j) => +(v * (1 - k) + c.line[j] * k).toFixed(4));
}

/** firePageChannel(resolved, { terrainAir, day }) → the page block's cfg. day: the world's daylight 0–1 (a fire lights
 *  a night, barely a noon). */
export function firePageChannel(resolved, { terrainAir = false, day = 0 } = {}) {
  return { ...resolved, terrainAir: !!terrainAir, day: Math.max(0, Math.min(1, +day || 0)) };
}
