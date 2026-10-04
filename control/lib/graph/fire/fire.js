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
});
export const FIRE_MAX_SOURCES = 64;

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
 * smokeColor?: '#rrggbb' }`; `color` (a colorant, a mix of them, or '#rrggbb') on the fire sets every source's.
 */
export function validateFire(fire) {
  if (fire === undefined || fire === null || fire === false) return [];
  if (fire === true) return [];
  if (typeof fire !== 'object' || Array.isArray(fire)) return ['fire must be true or { sources: [{ kind, at }], embers?, smoke?, light? }'];
  const e = [], kinds = Object.keys(FIRE_KINDS).join(', ');
  for (const k of Object.keys(fire)) if (!['sources', 'embers', 'smoke', 'light', 'color'].includes(k)) e.push(`fire.${k} is not a fire option (sources, embers, smoke, light, color)`);
  e.push(...colorErrors(fire.color, 'fire.color'));
  if (fire.sources !== undefined) {
    if (!Array.isArray(fire.sources)) e.push('fire.sources must be a list of { kind, at: [x, y] or [x, y, z] }');
    else {
      if (fire.sources.length > FIRE_MAX_SOURCES) e.push(`fire.sources has ${fire.sources.length} fires; at most ${FIRE_MAX_SOURCES}`);
      fire.sources.forEach((s, i) => {
        if (!s || typeof s !== 'object') { e.push(`fire.sources[${i}] must be { kind, at }`); return; }
        if (!FIRE_KINDS[s.kind]) e.push(`fire.sources[${i}].kind must be one of ${kinds}`);
        if (!Array.isArray(s.at) || (s.at.length !== 2 && s.at.length !== 3) || !s.at.every(isNum)) e.push(`fire.sources[${i}].at must be [x, y] (on the ground) or [x, y, z]`);
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
 * them (`explicit: false` when the world already grounded them into `placed`). baked: the world's own light already holds this fire (the page then only flickers it).
 */
export function resolveFire(fire, placed = [], { explicit: withExplicit = true } = {}) {
  if (!fire) return null;
  const o = fire === true ? {} : fire;
  // a 2D `at` stands on the ground: a world that knows its ground hands these over placed (and says so); elsewhere z = 0
  const explicit = withExplicit ? (o.sources || []).map((s) => ({ kind: s.kind, at: s.at.length === 3 ? s.at : [s.at[0], s.at[1], 0], size: s.size, phi: s.phi, color: s.color, soot: s.soot, smokeColor: s.smokeColor })) : [];
  const all = [...placed, ...explicit].slice(0, FIRE_MAX_SOURCES);
  if (!all.length) return null;
  return {
    embers: o.embers !== false, smoke: o.smoke !== false, light: isNum(o.light) ? o.light : 1,
    sources: all.map((s, i) => {
      const K = FIRE_KINDS[s.kind], k = isNum(s.size) ? s.size : 1;
      // a bigger fire of a kind: its bed scales with size, its flame and light with size^(2/5)·… as Heskestad's do
      const at = [s.at[0], s.at[1], s.at[2] + (K.seat || 0) * k], col = resolveColor(s.color !== undefined ? s.color : o.color);
      // a coloured flame burns clean unless told: its soot is what is left of an ordinary flame's
      const soot = isNum(s.soot) ? s.soot : col ? (col.magic ? 0.06 : 0.12) : 1;
      return { kind: s.kind, at: at.map((v) => +v.toFixed(4)), D: K.D * k, L: K.L * Math.pow(k, 0.8), n: K.n, lam: K.lam, light: K.light * Math.pow(k, 1.6),
        embers: Math.round(K.embers * k), smoke: K.smoke, soot: K.soot * soot, phi: isNum(s.phi) ? s.phi : 1, baked: !!s.baked, seed: (i * 7919 + 17) | 0,
        ...(col ? { line: col.line, lineK: col.k } : {}), ...(s.smokeColor ? { smokeColor: hexLin(s.smokeColor).map((v) => +v.toFixed(4)) } : {}) };
    }),
  };
}

// ── the kernel, as one self-contained function ───────────────────────────────────────────────────────────────────
/**
 * fireKernel(F, air) closes over nothing (the World page inlines its source). F: resolveFire's config; air(x, y, z,
 * t) → [ux, uy, uz] (null for still air). → { flames(i, t), light(i, t), embers(i, t), smoke(i, t), NP }.
 *   flames: one entry per flamelet { pts (NP×3), rad (NP), L }; light: the flicker, 1 on average;
 *   embers: [x, y, z, xPrev, yPrev, zPrev, heat, …] (7 a spark in flight); smoke: [x, y, z, radius, alpha, …].
 */
export function fireKernel(F, air) {
  const G = 9.81, NP = 12, MS = 18, GN = 20;
  const hash = (a, b) => { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const S = F.sources.map((s, si) => {
    let a = s.seed | 0; const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const R = s.D / 2, fl = [];
    for (let k = 0; k < s.n; k++) {
      // the first flamelet stands at the centre; the rest on a ring, the outer ones shorter
      const q = 2 * Math.PI * (k / Math.max(1, s.n - 1) + 0.13 * rnd()), r = k === 0 ? 0 : R * (0.45 + 0.4 * rnd());
      const eddies = []; for (let j = 0; j < 5; j++) eddies.push([0.6 + 2.6 * rnd(), 2 * Math.PI * rnd(), 2 * Math.PI * rnd(), 2 * Math.PI * rnd()]);
      fl.push({ dx: r * Math.cos(q), dy: r * Math.sin(q), tall: 1 - 0.38 * (r / Math.max(R, 1e-9)) - 0.1 * rnd(), ph: 2 * Math.PI * rnd(), eddies });
    }
    const puff = s.lam ? 0 : 1.5 / Math.sqrt(Math.max(s.D, 0.02));
    // the burnt gas rises on its buoyancy: a candle's at an effective 28 m/s², a big fire's slower (mixing)
    const gp = s.lam ? 28 : 18, wmax = 3 * Math.sqrt(G * Math.max(s.L, 0.03));
    return { s, si, fl, puff, gp, wmax, own: s.lam ? 0 : 0.2 * Math.sqrt(G * s.D) };
  });
  const take = (S1, p, t) => { if (!air || !(S1.s.phi > 0)) return [0, 0, 0]; const u = air(p[0], p[1], p[2], t); return [S1.s.phi * u[0], S1.s.phi * u[1], S1.s.phi * u[2]]; };
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
    const S1 = S[i], s = S1.s, out = [];
    for (const f of S1.fl) {
      const L = lengthOf(S1, f, t), base = [s.at[0] + f.dx, s.at[1] + f.dy, s.at[2]];
      const aMax = Math.sqrt((2 * L) / S1.gp), dg = aMax / GN, cum = new Float64Array(3 * (GN + 1)), tw = S1.wmax / S1.gp;
      for (let g = 0; g < GN; g++) { const u = baseAir(S1, f, base, t - (g + 0.5) * dg); for (let c = 0; c < 3; c++) cum[3 * (g + 1) + c] = cum[3 * g + c] + u[c] * dg; }
      const rise = (age) => (age < tw ? 0.5 * S1.gp * age * age : 0.5 * S1.gp * tw * tw + S1.wmax * (age - tw));
      const path = new Float64Array(3 * MS), arc = new Float64Array(MS);
      for (let k = 0; k < MS; k++) {
        const age = aMax * Math.sqrt(k / (MS - 1)), gi = Math.min(GN - 1e-9, age / dg), g0 = Math.floor(gi), fg = gi - g0;
        for (let c = 0; c < 3; c++) path[3 * k + c] = base[c] + cum[3 * g0 + c] + fg * (cum[3 * g0 + 3 + c] - cum[3 * g0 + c]);
        path[3 * k + 2] += rise(age);
        if (k) arc[k] = arc[k - 1] + Math.hypot(path[3 * k] - path[3 * k - 3], path[3 * k + 1] - path[3 * k - 2], path[3 * k + 2] - path[3 * k - 1]);
      }
      // a bent flame is carried sideways, not stretched: it ends about L along its own arc
      const Larc = Math.min(arc[MS - 1], L) || 1e-9, pts = new Float64Array(3 * NP), rad = new Float64Array(NP);
      const Rm = s.lam ? 0.0044 * (s.L / 0.03) ** 0.6 : (0.62 * s.D) / Math.sqrt(s.n) + 0.08 * L;
      for (let k = 0, j = 0; k < NP; k++) {
        const want = (Larc * k) / (NP - 1);
        while (j < MS - 2 && arc[j + 1] < want) j++;
        const fr0 = Math.min(1, Math.max(0, (want - arc[j]) / Math.max(1e-12, arc[j + 1] - arc[j])));
        for (let c = 0; c < 3; c++) pts[3 * k + c] = path[3 * j + c] + fr0 * (path[3 * j + 3 + c] - path[3 * j + c]);
        const fr = k / (NP - 1), peak = s.lam ? 0.28 : 0.18;
        rad[k] = Rm * (fr < peak ? 0.5 + 0.5 * Math.sin((fr / peak) * Math.PI / 2) : Math.pow(Math.cos(((fr - peak) / (1 - peak)) * Math.PI / 2), s.lam ? 0.85 : 0.7));
      }
      out.push({ pts, rad, L });
    }
    return out;
  }
  // the light follows the flames: the fire's flame length now over its mean, sharpened a little
  function light(i, t) {
    const S1 = S[i]; if (S1.s.lam) return 1 + 0.02 * Math.sin(2 * Math.PI * 9.1 * t + S1.si);
    let a = 0, b = 0; for (const f of S1.fl) { a += lengthOf(S1, f, t); b += S1.s.L * f.tall; }
    return Math.pow(a / b, 1.4);
  }
  // embers: each slot is relaunched every `period` seconds from the bed, rises on the plume (slowing as it leaves it),
  // drifts with the air at its launch and wanders; it glows, cooling, for its life
  function emberAt(S1, k, t) {
    const s = S1.s, P = 0.9 + 2.2 * hash(S1.si * 131 + k, 1), off = P * hash(S1.si * 131 + k, 2), n = Math.floor((t - off) / P), t0 = off + n * P, age = t - t0;
    const r = (j) => hash(S1.si * 131 + k + 977 * j, n * 7 + 3);
    const life = (0.5 + 1.6 * r(1)) * Math.sqrt(s.L / 0.8);
    if (!(age >= 0 && age < life)) return null;
    const q = 2 * Math.PI * r(2), rr = 0.4 * s.D * Math.sqrt(r(3)), x0 = s.at[0] + rr * Math.cos(q), y0 = s.at[1] + rr * Math.sin(q), z0 = s.at[2] + 0.2 * s.L * r(4);
    const u = take(S1, [x0, y0, z0], t0), w0 = (1.2 + 1.8 * r(5)) * Math.sqrt(s.L / 0.8) * 2.2, tau = 0.45, sway = 0.12 * s.D + 0.05;
    const at = (a1) => [x0 + 0.85 * u[0] * a1 + sway * Math.sin(5.1 * a1 + 6 * r(6)) * a1, y0 + 0.85 * u[1] * a1 + sway * Math.cos(4.3 * a1 + 6 * r(7)) * a1, z0 + w0 * tau * (1 - Math.exp(-a1 / tau)) + 0.25 * a1 + 0.5 * u[2] * a1];
    const p = at(age), pp = at(Math.max(0, age - 0.035));
    return [p[0], p[1], p[2], pp[0], pp[1], pp[2], Math.exp(-age / (0.55 * life))];
  }
  function embers(i, t) { const S1 = S[i], out = []; if (!F.embers) return out; for (let k = 0; k < S1.s.embers; k++) { const e = emberAt(S1, k, t); if (e) out.push(...e); } return out; }
  // smoke: a puff let go every 1/rate seconds from the flame tops, rising (slowing) and drifting with the air of its
  // middle age, swelling as it mixes, thinning out over a few seconds
  function smoke(i, t) {
    const S1 = S[i], s = S1.s, out = []; if (!F.smoke || !(s.smoke > 0)) return out;
    const life = 4.5, rate = s.smoke, j1 = Math.floor(t * rate);
    for (let j = j1; j > j1 - life * rate; j--) {
      const t0 = j / rate, age = t - t0; if (age < 0 || age > life) continue;
      const h = (m) => hash(S1.si * 31 + 5, j * 13 + m), z0 = s.at[2] + 0.95 * s.L;
      const u = take(S1, [s.at[0], s.at[1], z0 + 0.5], t0 + 0.5 * age), rise = (0.6 + 0.6 * Math.sqrt(s.L)) * 1.2 * (1 - Math.exp(-age / 1.2)) + 0.12 * age;
      out.push(s.at[0] + u[0] * age + 0.15 * s.D * (h(1) - 0.5) * (1 + 2 * age), s.at[1] + u[1] * age + 0.15 * s.D * (h(2) - 0.5) * (1 + 2 * age), z0 + rise + 0.3 * u[2] * age,
        0.4 * s.D + 0.12 + (0.18 + 0.25 * s.D) * age, 0.5 * (1 - Math.exp(-age / 0.35)) * Math.exp(-age / 1.6));
    }
    return out;
  }
  return { NP, flames, light, embers, smoke, N: S.length };
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
