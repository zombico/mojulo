// SPIKE flame: a lit match. Self-contained (no imports), so the page inlines the same closure by toString() and the
// verifier runs it in Node, as the wind spike's kernel does. Geometry is z-up, metres, seconds.
//
// What the wind spike taught, carried over:
//   · one air field moves everything. `air(x, y, z, t)` is handed in (the page passes vegetation/wind.js windField's
//     at() plus a breath), and a flame, its sparks and its smoke are consumers with a flaccidity φ ∈ [0, 1], the share
//     of the air's push they take. φ = 0 is still air exactly: the flame stands straight up whatever blows.
//   · seekable where it can be. The flame is a STREAKLINE: the burning gas leaves the base and rises under its own
//     buoyancy while the air carries it sideways, so the visible flame at time t is where the gas let go over the last
//     ~50 ms now is. Each point of it is integrated over the air the base saw since that gas left, so a gust bends
//     the base first and the tip after, and a flicker travels up the flame. Nothing about it is stored: flame(t) is a
//     function of the burn state and the air. Sparks are analytic too (linear drag in the air at launch).
//   · only what has a history is stepped, at a fixed tick: the burn (the char front, the flame's growth, going out)
//     and the smoke (Lagrangian strands, like debris).
//
// The match. A safety-match splint (aspen, square, ~2.1 mm, 47 mm), its head (~4.7 mm: chlorate, sulfur, glass,
// binder), the splint under the head waxed. Held at `hold` (a clip) at `clip` from the head's tip; s runs along the
// stick from the tip of the head toward the clip.
//   strike   the head deflagrates: a ball of flame twice the steady size, whiter, sputtering, throwing sparks and a
//            puff of white smoke (potassium chloride), ~0.3 s;
//   head     the sulfur and wax burn (bluer), the flame settles, the head chars through by ~1.4 s;
//   wood     a laminar diffusion flame on the pyrolysing wood behind the char front. The front creeps along the stick
//            at a rate set by how much of the flame's heat reaches unburnt wood: held head down the flame bathes the
//            wood ahead and races (~6 mm/s), level it creeps (~1.2 mm/s), head up the wood ahead sits below the flame
//            and starves (it goes out). Air blowing toward the unburnt wood speeds it (concurrent spread).
//            The flame grows with the burning rate (more fuel, a taller flame: Roper's height ∝ fuel flow).
//   out      blown (the air at the base passes the blow-off speed, which grows with the flame), starved, or burnt
//            (the front reaches the clip). The char front glows a moment (the splint is dipped in a phosphate that
//            stops afterglow) and lets go a thin wisp of smoke: laminar for a few centimetres, then wavering.
//
// Estimates, not measurements: the rates, sizes, blow-off law and buoyant acceleration are chosen in the ranges the
// literature and a box of matches give; they are written once, below, in M_DEFAULTS and the constants.
export function matchKernel(M, air) {
  const G = 9.81, N = 16, TICK = 1 / 240, HEAD_T = 1.4, FLARE_T = 0.32;
  const M_DEFAULTS = { seed: 1, head: 0.0058, clip: 0.038, side: 0.0021, theta: 0, psi: 0, hold: [0, 0, 0.12], L0: 0.026, vLevel: 0.0012, vMin: 0.00032 };
  const P = { ...M_DEFAULTS, ...M, phi: { flame: 1, sparks: 1, smoke: 1, ...(M && M.phi) } };
  let a = (P.seed ^ 0x9e3779b9) | 0;
  const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  // the flame-scale turbulence: eddies of the flame's own size passing at 3–16 Hz. Its strength is a share of the air
  // speed at the base (no air, no eddies: a match in still air burns steady), plus the head's own sputter at the strike.
  const TURB = [];
  for (let i = 0; i < 6; i++) TURB.push([3 + 13 * rnd(), 2 * Math.PI * rnd(), 2 * Math.PI * rnd(), 2 * Math.PI * rnd()]);
  const eddy = (t) => { let x = 0, y = 0, z = 0; for (const [f, p, q, r] of TURB) { const w = 2 * Math.PI * f * t; x += Math.sin(w + p); y += Math.sin(1.07 * w + q); z += Math.sin(0.93 * w + r); } return [x / 2.4, y / 2.4, z / 2.4]; };
  // a small seeded value noise for the smoke's instability
  const hash = (i, j, k) => { let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(k | 0, 0x7feb352d) ^ Math.imul(P.seed | 0, 0x85ebca77); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15; return ((h >>> 0) / 4294967296) * 2 - 1; };
  const vnoise = (x, y, z) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), fx = x - x0, fy = y - y0, fz = z - z0;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz), l = (p, q, f) => p + (q - p) * f;
    const c = (i, j, k) => hash(x0 + i, y0 + j, z0 + k);
    return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
  };

  // ── the stick ──────────────────────────────────────────────────────────────────────────────────────────────────
  const S = { t: 0, struck: -1, lit: false, out: false, outAt: -1, why: '', front: 0, L: 0, starve: 0, strain: 0, lift: 0, rate: 0, sparks: [], P };
  let dir = [1, 0, 0];
  S.aim = (theta, psi = P.psi) => { P.theta = theta; P.psi = psi; dir = [Math.cos(theta) * Math.cos(psi), Math.cos(theta) * Math.sin(psi), Math.sin(theta)]; };
  S.aim(P.theta, P.psi);
  S.dir = () => dir.slice();
  S.at = (s) => [P.hold[0] + dir[0] * (P.clip - s), P.hold[1] + dir[1] * (P.clip - s), P.hold[2] + dir[2] * (P.clip - s)];
  // the flame sits on the burning zone just behind the front (on the head while the head burns), and wraps under it
  const baseS = () => (S.t - S.struck < HEAD_T ? 0.55 * P.head : Math.max(0.55 * P.head, S.front - 0.0028));
  S.base = () => { const p = S.at(baseS()); p[2] -= 0.0026; return p; };

  // ── the air a consumer takes ───────────────────────────────────────────────────────────────────────────────────
  const meanAir = (p, t, phi) => { if (!(phi > 0)) return [0, 0, 0]; const u = air(p[0], p[1], p[2], t); return [phi * u[0], phi * u[1], phi * u[2]]; };
  // the air at the flame's base: the mean, plus eddies a third of its strength, plus the head's sputter
  function baseAir(t) {
    const tau = t - S.struck, u = meanAir(S.base(), t, P.phi.flame), m = Math.hypot(u[0], u[1], u[2]);
    const sputter = tau < HEAD_T ? 0.22 * (1 - smooth(0.05, FLARE_T, tau)) + 0.04 * (1 - smooth(0.6, HEAD_T, tau)) : 0;
    const k = 0.35 * m + sputter, e = eddy(t);
    return [u[0] + k * e[0], u[1] + k * e[1], u[2] + 0.6 * k * e[2]];
  }
  // blow-off: a small flame lets go at a few metres a second, a bigger one holds longer; the head's own oxidiser
  // holds it harder while it burns
  const blowOff = (L, tau) => 1.85 * Math.sqrt(Math.max(L, 1e-4) * 100) * (tau < HEAD_T ? 1.6 : 1);

  // the stage's target flame length, and how white, blue and sputtering it is
  function stageOf(tau) {
    const flare = 1 - smooth(0.04, FLARE_T, tau), head = 1 - smooth(0.9, 1.7, tau);
    const Lhead = tau < 0.05 ? 0.046 * Math.sqrt(tau / 0.05) : 0.031 + 0.015 * Math.exp(-(tau - 0.05) / 0.12);
    const blue = 0.35 * smooth(0.12, 0.3, tau) * (1 - smooth(0.6, 1.2, tau));
    return { flare, head, Lhead, blue };
  }
  function woodRate(t) {
    const u = meanAir(S.base(), t, P.phi.flame), along = -(u[0] * dir[0] + u[1] * dir[1] + u[2] * dir[2]);
    return P.vLevel * Math.exp(-1.6 * dir[2]) * Math.exp(0.25 * clamp(along, -2, 3));
  }

  // ── sparks at the strike: a dozen or so grains of the head thrown off burning, analytic, seekable ───────────────────────────────────────────────────────────────────
  function makeSparks() {
    const list = [];
    for (let i = 0; i < 16; i++) {
      const t0 = S.struck + 0.15 * rnd() * rnd(), q = 2 * Math.PI * rnd(), c = 2 * rnd() - 1, sq = Math.sqrt(1 - c * c), sp = 0.25 + 0.8 * rnd();
      const v0 = [0.5 * dir[0] + sp * sq * Math.cos(q), 0.5 * dir[1] + sp * sq * Math.sin(q), 0.5 * dir[2] + sp * c + 0.3];
      list.push({ t0, v0, life: 0.08 + 0.3 * rnd() * rnd(), tau: 0.04 + 0.05 * rnd(), x0: S.at(0.4 * P.head) });
    }
    return list;
  }
  function sparkAt(k, t) {
    const age = t - k.t0; if (age < 0 || age > k.life) return null;
    const u = meanAir(k.x0, k.t0, P.phi.sparks), vi = [u[0], u[1], u[2] - G * k.tau], e = k.tau * (1 - Math.exp(-age / k.tau));
    return [0, 1, 2].map((i) => k.x0[i] + vi[i] * age + (k.v0[i] - vi[i]) * e);
  }
  // → [[x, y, z, xPrev, yPrev, zPrev, heat], …]: where each live spark is, where it was 8 ms ago (its streak), and its heat 0..1
  S.sparksAt = (t) => {
    const out = [];
    for (const k of S.sparks) { const p = sparkAt(k, t); if (!p) continue; const q = sparkAt(k, Math.max(k.t0, t - 0.008)) || p; out.push([...p, ...q, Math.exp(-(t - k.t0) / (0.4 * k.life))]); }
    return out;
  };

  // ── smoke: Lagrangian strands, stepped ─────────────────────────────────────────────────────────────────────────
  const CAP = 3000, f = () => new Float64Array(CAP);
  const SM = { x: f(), y: f(), z: f(), vx: f(), vy: f(), vz: f(), age: f(), life: f(), w0: f(), dens: f(), ph: f(), dirx: f(), diry: f(), kind: new Uint8Array(CAP), strand: new Uint8Array(CAP), prev: new Int32Array(CAP).fill(-1), seq: new Float64Array(CAP), alive: new Uint8Array(CAP), next: 0, last: [-1, -1, -1, -1], acc: [0, 0, 0, 0], count: [0, 0, 0, 0] };
  // a strand is a thread of puffs let go one after another: i follows prev[i] when that slot is alive and holds the
  // puff just before it (seq one less, same strand), so a recycled slot never stitches two threads together
  S.linked = (i) => { const j = SM.prev[i]; return j >= 0 && SM.alive[j] === 1 && SM.strand[j] === SM.strand[i] && SM.seq[j] === SM.seq[i] - 1; };
  S.smoke = SM;
  // kinds: 0 the strike's white puff, 1 soot shed from a struggling flame, 2 the wisp from the dying ember. A wisp off
  // an ember rises slowly (10–20 cm/s), slow enough that the room's eddies bend it within a few centimetres
  const LIFE = [1.4, 1.1, 6], W0 = [0.35, 0.3, 0.16], FULL = [260, 90, 150, 150];
  function emit(kind, strand, p, dens) {
    const i = SM.next; SM.next = (SM.next + 1) % CAP;
    for (let j = 0; j < 4; j++) if (SM.last[j] === i) SM.last[j] = -1;
    SM.x[i] = p[0]; SM.y[i] = p[1]; SM.z[i] = p[2]; SM.vx[i] = 0; SM.vy[i] = 0; SM.vz[i] = W0[kind]; SM.age[i] = 0; SM.life[i] = LIFE[kind] * (0.85 + 0.3 * rnd()); SM.w0[i] = W0[kind]; SM.dens[i] = dens;
    // the sinuous wave of a thin plume: each puff leaves with the phase the source is at (4–7 Hz, wandering), and a
    // direction that turns slowly, so the thread snakes in three dimensions
    const tt = S.t; SM.ph[i] = 2 * Math.PI * (5.2 * tt + 0.35 * vnoise(0.8 * tt, 3.1, 7.7)) ; const q = 1.7 * vnoise(0.25 * tt, 9.2, 1.3) + 0.6 * tt;
    SM.dirx[i] = Math.cos(q); SM.diry[i] = Math.sin(q);
    SM.kind[i] = kind; SM.strand[i] = strand; SM.alive[i] = 1; SM.prev[i] = SM.last[strand]; SM.last[strand] = i; SM.seq[i] = SM.count[strand]++;
  }
  function stepSmoke(dt, t) {
    const k = 1 - Math.exp(-dt / 0.08);
    for (let i = 0; i < CAP; i++) {
      if (!SM.alive[i]) continue;
      const age = (SM.age[i] += dt);
      if (age > SM.life[i]) { SM.alive[i] = 0; continue; }
      const p = [SM.x[i], SM.y[i], SM.z[i]], u = meanAir(p, t, P.phi.smoke);
      // the plume rises on its heat and slows as it mixes; past a quarter second the laminar thread starts to waver,
      // and the waver grows with age (the sinuous instability of a thin plume)
      // the room's eddies, two sizes: big lazy ones (~6 cm, about a hertz) swing the thread, small quick ones (~2 cm,
      // three hertz) curl it. They grow with age: the thread is laminar for its first few centimetres.
      const rise = SM.w0[i] * Math.exp(-age / 1.5) + 0.04, amp = smooth(0.06, 0.6, age) * (SM.kind[i] === 2 ? 1 : 1.5);
      let n = [0, 0, 0];
      if (amp > 0) {
        // each size is two layers sliding different ways, so the field changes along a puff's own path (one layer
        // rising with the smoke would be frozen to it, and the thread would hold one shape)
        const fine = 0.15 + 0.35 * smooth(0.5, 2.5, age);   // the small curls take over as the thread ages
        n = [0, 1, 2].map((c) => {
          const big = vnoise(16 * p[0] + 19.1 * c, 16 * p[1] + 1.1 * t - 7.3 * c, 11 * p[2] + 5.3 * c) + vnoise(16 * p[0] - 0.9 * t - 3.7 * c, 16 * p[1] + 8.2 * c, 11 * p[2] + 1.4 * t + 2.9 * c);
          const small = vnoise(55 * p[0] - 5.2 * c, 55 * p[1] - 3.4 * t + 11.7 * c, 38 * p[2] + 3.1 * c) + vnoise(55 * p[0] + 3.0 * t + 6.6 * c, 55 * p[1] - 9.9 * c, 38 * p[2] + 4.2 * t - 1.7 * c);
          return 0.16 * big + 0.3 * fine * small;
        });
      }
      // the wave grows as it rises (amplitude ~1 cm by a hand's breadth up), riding on the puff as a drift A'(age)
      const A = 0.0045 * (Math.exp(age / 0.4) - 1), dA = A < 0.014 ? (0.0045 / 0.4) * Math.exp(age / 0.4) * Math.sin(SM.ph[i]) : 0;
      SM.vx[i] += (u[0] + amp * n[0] + dA * SM.dirx[i] - SM.vx[i]) * k; SM.vy[i] += (u[1] + amp * n[1] + dA * SM.diry[i] - SM.vy[i]) * k; SM.vz[i] += (u[2] + rise + 0.4 * amp * n[2] - SM.vz[i]) * k;
      SM.x[i] += SM.vx[i] * dt; SM.y[i] += SM.vy[i] * dt; SM.z[i] += SM.vz[i] * dt;
    }
  }
  function emitSmoke(dt, t) {
    const tau = t - S.struck, rate = [0, 0, 0, 0], where = [null, null, null, null], kinds = [0, 1, 2, 2];
    if (S.lit) {
      const puff = tau > 0.02 && tau < 0.45, soot = S.lift > 0.55;
      if (puff || soot) {
        const tip = S.flameAt(t), top = tip ? tip.pts.slice(3 * (N - 1), 3 * N) : S.base();
        if (puff) { rate[0] = 260 * (1 - smooth(0.1, 0.45, tau)); where[0] = top; }
        if (soot) { rate[1] = 90 * Math.max(smooth(0.55, 1, S.lift), 1 - smooth(0.04, FLARE_T, tau)); where[1] = top; }
      }
    } else if (S.out && S.struck >= 0) {
      const since = t - S.outAt, g = S.emberAt(t);
      const p = S.at(Math.max(0.5 * P.head, S.front - 0.0006)); p[2] += 0.0011;
      rate[2] = rate[3] = 150 * Math.exp(-since / 3) * (0.4 + 0.6 * g);
      where[2] = [p[0] + 0.0005 * dir[1], p[1] - 0.0005 * dir[0], p[2]]; where[3] = [p[0] - 0.0005 * dir[1], p[1] + 0.0005 * dir[0], p[2]];
    }
    // a thread is let go at a steady 120 puffs a second, so it stays one thread; how much smoke it carries is the
    // puff's density (the rate over its full rate), which the page draws as opacity
    for (let j = 0; j < 4; j++) {
      const dens = rate[j] / FULL[j];
      if (!(dens > 0.01)) { if (SM.last[j] >= 0) SM.count[j]++; SM.last[j] = -1; SM.acc[j] = 0; continue; }
      SM.acc[j] += 120 * dt;
      while (SM.acc[j] >= 1) { SM.acc[j] -= 1; emit(kinds[j], j, where[j], dens); }
    }
  }

  // ── the burn: fixed tick ───────────────────────────────────────────────────────────────────────────────────────
  S.strike = () => {
    S.struck = S.t; S.lit = true; S.out = false; S.outAt = -1; S.why = ''; S.front = 0; S.L = 0; S.starve = 0; S.strain = 0; S.lift = 0;
    S.sparks = makeSparks();
  };
  const goOut = (why) => { S.lit = false; S.out = true; S.outAt = S.t; S.why = why; S.L = 0; };
  function tick(dt) {
    const t = S.t, tau = t - S.struck;
    if (S.lit) {
      const st = stageOf(tau);
      let target = st.Lhead;
      if (tau < HEAD_T) S.front = P.head * Math.min(1, tau / HEAD_T), S.rate = P.head / HEAD_T;
      else {
        const v = (S.rate = woodRate(t)); S.front += v * dt;
        if (tau > 2 && v < P.vMin) S.starve += dt; else S.starve = Math.max(0, S.starve - dt);
      }
      if (tau > 0.9) {
        const r = Math.min(2.5, S.rate / P.vLevel), Lw = P.L0 * (0.55 + 0.45 * Math.pow(r, 0.7)) * (0.4 + 0.6 * smooth(P.vMin, 2 * P.vMin, S.rate)) * (1 - 0.6 * smooth(0, 1.2, S.starve));
        target = st.head * st.Lhead + (1 - st.head) * Lw;
        S.L += (target - S.L) * (1 - Math.exp(-dt / 0.25));
      } else S.L = target;
      const u = baseAir(t), U = Math.hypot(u[0], u[1], u[2]);
      S.lift = U / blowOff(S.L, tau);
      if (S.lift > 1) S.strain += dt; else S.strain = Math.max(0, S.strain - 0.5 * dt);
      if (S.strain > 0.025) goOut('blown');
      else if (S.starve > 1.2) goOut('starved');
      else if (S.front >= P.clip - 0.002) goOut('burnt');
    }
    emitSmoke(dt, t);
    if ((S.ticks = (S.ticks || 0) + 1) % 2 === 0) stepSmoke(2 * dt, t);   // the smoke moves at 120 Hz
    S.t += dt;
  }
  S.step = (dt) => { const n = Math.round(dt / TICK); for (let i = 0; i < n; i++) tick(TICK); return S; };
  S.advanceTo = (t) => { while (S.t < t - 1e-9) tick(TICK); return S; };

  // the ember: the char front glows while it burns and a moment after (the splint's phosphate kills the afterglow)
  S.emberAt = (t) => (S.lit ? 1 : S.out ? (S.why === 'blown' && S.outAt - S.struck < HEAD_T ? 0.4 : 1) * Math.exp(-(t - S.outAt) / 1.4) : 0);

  // ── the flame, as a streakline: a function of the burn state and the air ───────────────────────────────────────
  // → { pts (N×3, base to tip), rad (N), L, heat, blue, soot, flare, lift, edge } or null when not lit.
  //   rad: the flame's radius along it (a teardrop, rounder at the strike); heat: the light it gives (1 = steady);
  //   blue: the share of the blue reaction zone; soot: the yellow glow's share; edge: how ragged its surface is.
  S.flameAt = (t) => {
    if (!S.lit || !(S.L > 0)) return null;
    const tau = t - S.struck, st = stageOf(tau), L = S.L, base = S.base();
    // buoyancy: the burnt gas is ~6× lighter than the air; its rise slowed by mixing, an effective 28 m/s², at most 2.4 m/s
    const gp = 28, wmax = 2.4, tw = wmax / gp;
    const lift = clamp(S.lift, 0, 1.2), aMax = Math.sqrt(2 * L / gp);
    const pts = new Float64Array(3 * N), rad = new Float64Array(N), MS = 24;
    const Rmax = 0.0044 * Math.pow(L / 0.03, 0.6) * (1 + 0.3 * st.flare);
    // where the gas let go `age` ago is now. The air carries it sideways by the integral of what the base saw since
    // it left (one running sum over the last aMax, shared by every point); it rises on its own buoyancy, in closed form.
    const GN = 48, dg = aMax / GN, cum = new Float64Array(3 * (GN + 1));
    for (let g = 0; g < GN; g++) {
      const u = baseAir(t - (g + 0.5) * dg);
      for (let c = 0; c < 3; c++) cum[3 * (g + 1) + c] = cum[3 * g + c] + u[c] * dg;
    }
    const rise = (age) => (age < tw ? 0.5 * gp * age * age : 0.5 * gp * tw * tw + wmax * (age - tw));
    const path = new Float64Array(3 * MS), arc = new Float64Array(MS);
    for (let k = 0; k < MS; k++) {
      const age = aMax * Math.sqrt(k / (MS - 1)), gi = Math.min(GN - 1e-9, age / dg), g0 = Math.floor(gi), fg = gi - g0;
      for (let c = 0; c < 3; c++) path[3 * k + c] = base[c] + cum[3 * g0 + c] + fg * (cum[3 * g0 + 3 + c] - cum[3 * g0 + c]);
      path[3 * k + 2] += rise(age);
      if (k) arc[k] = arc[k - 1] + Math.hypot(path[3 * k] - path[3 * k - 3], path[3 * k + 1] - path[3 * k - 2], path[3 * k + 2] - path[3 * k - 1]);
    }
    // the flame ends where its gas has burnt: about L along its own arc, sooner as cross-flow stirs it (a bent flame
    // is carried sideways, not stretched)
    const Larc = Math.min(arc[MS - 1], L * (1 - 0.3 * Math.min(1, lift))) || 1e-9;
    for (let k = 0, j = 0; k < N; k++) {
      const want = (Larc * k) / (N - 1);
      while (j < MS - 2 && arc[j + 1] < want) j++;
      const f = Math.min(1, Math.max(0, (want - arc[j]) / Math.max(1e-12, arc[j + 1] - arc[j])));
      for (let c = 0; c < 3; c++) pts[3 * k + c] = path[3 * j + c] + f * (path[3 * j + 3 + c] - path[3 * j + c]);
      const fr = k / (N - 1), peak = 0.28 + 0.12 * st.flare;
      const shape = fr < peak ? 0.45 + 0.55 * Math.sin((fr / peak) * Math.PI / 2) : Math.pow(Math.cos(((fr - peak) / (1 - peak)) * Math.PI / 2), 0.85 - 0.3 * st.flare);
      rad[k] = Rmax * shape * (1 - 0.35 * smooth(0.6, 1, lift) * (1 - fr));
    }
    const heat = Math.pow(L / P.L0, 2) * (1 + 1.6 * st.flare) * (1 - 0.6 * smooth(0.5, 1, lift));
    return { pts, rad, L, heat, blue: Math.min(1, 0.18 + st.blue + 0.7 * smooth(0.5, 1, lift)), soot: (1 - 0.85 * smooth(0.55, 1, lift)) * (1 + 0.4 * st.flare), flare: st.flare, lift, edge: 0.06 + 0.3 * st.flare + 0.25 * Math.min(1, lift) };
  };

  // a summary for the HUD and the tests
  S.stage = () => {
    if (S.struck < 0) return 'unlit';
    if (S.out) return S.emberAt(S.t) > 0.05 ? `out (${S.why}), ember` : `out (${S.why})`;
    const tau = S.t - S.struck;
    return tau < FLARE_T ? 'strike' : tau < HEAD_T ? 'head' : S.lift > 0.6 ? 'wood, struggling' : 'wood';
  };
  S.N = N;
  return S;
}

// A breath: a puff from `from` toward `to`, `U` m/s leaving the lips, spreading and slowing as a round jet does
// (centreline speed falls with distance, the jet widens about 0.11 per unit distance), arriving after its travel time
// and lasting `dur` seconds. → the air velocity it adds at (x, y, z, t).
export function breathAt(B, x, y, z, t) {
  const ax = B.to[0] - B.from[0], ay = B.to[1] - B.from[1], az = B.to[2] - B.from[2], n = Math.hypot(ax, ay, az) || 1;
  const ex = ax / n, ey = ay / n, ez = az / n, px = x - B.from[0], py = y - B.from[1], pz = z - B.from[2];
  const d = px * ex + py * ey + pz * ez; if (d <= 0) return [0, 0, 0];
  const rx = px - d * ex, ry = py - d * ey, rz = pz - d * ez, r2 = rx * rx + ry * ry + rz * rz, b = 0.03 + 0.11 * d;
  const arrive = B.t0 + d / (0.5 * B.U), s = (t - arrive) / B.dur;
  if (s < 0 || s > 1) return [0, 0, 0];
  const U = B.U * Math.exp(-d / 0.6) * Math.exp(-r2 / (b * b)) * Math.sin(Math.PI * s) ** 2;
  return [U * ex, U * ey, U * ez];
}
