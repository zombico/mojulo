/**
 * rupa/vayo.js — RUPA-VAYO, the flow an effect moves in (vayu: the air). An effect (a blast, a power-up's charge, its
 * aura, its release) is a disturbance in the world's air, or water; what is seen is tracers carried by it. Nothing is
 * simulated on the page: the air round the spot is PRESOLVED once, when the effect fires (vayoEnvelope), and every
 * tracer's path is then a formula of time (vayoPoints), as the physics' wind and smoke already are. So a page stays
 * cheap and a seed gives the same frames, and the same effect differs by where it goes off.
 *
 *   THE ENVELOPE  what the spot is: the OPEN DIRECTIONS (a ray each way, against the world's boxes and its ground: how far
 *                 the air can go, and the face it meets, so what is stopped slides along it), the floor under it, the
 *                 wind at it, the medium (air, or water when the spot is in a pool) and the effect's size. A corridor
 *                 opens two ways, a wall half the sky, a ceiling a flat disc; open ground an even dome.
 *   THE LAWS      (their shapes and how they scale, the time stretched for the eye as anime holds a frame)
 *     front       a blast's front races out and slows: r = R·(τ/T)^0.4 (Sedov–Taylor's r ∝ t^⅖), to R, which grows
 *                 as the cube root of its energy; stopped by a face it slides along it
 *     rise        a hot core lifts on its heat, √(g·R) (a thermal's speed), less in thin air, a pulsing bubble in water
 *     roll        lifting, it rolls into a ring vortex: up through the middle, out over the top, down the outside, so
 *                 the cap curls over into a mushroom and needs no stem of its own
 *     swirl       a real vortex (Lamb–Oseen): fast in its core, slow outside (Ω = Γ/r²·(1 − e^(−r²/rc²))), so smoke
 *                 curls rather than turning like a plate
 *     plume       smoke climbs as a plume does, Δz ∝ t^⅔ (Briggs), leaning with the wind of its height
 *     drift       everything rides the wind, more as it climbs (the log profile's ⅐ power near enough)
 *     inflow      a charge draws in on a log spiral: r falls, the angle grows as ln(r₀/r) (a sink in a vortex)
 *
 *   KINDS (a spray's `flow`): core (a fireball's body), skirt (the dust the blast runs along the ground), smoke, debris,
 *   embers (hot sparks cooling), inflow (a charge's motes drawn in), column (an aura's flames rising round the body),
 *   motes (pebbles lifting off the ground), gust (a ring of dust pushed out along the ground)
 *
 *   vayoEnvelope(at, { colliders?, ground?, floor?, wind?, pools?, size?, reach?, density?, g?, n? }) → the envelope
 *   vayoPoints(S, E, t, loop?)  → [{ p, v, w, s, rot, ring: −1, u }] (sprayPoints' points: the page's sprite step
 *                                 draws them as it is), S a spray with its `flow` kind and E an envelope
 *
 * Both are self-contained (no imports, every helper inside), so a page carries them as their source.
 */

/** The air round a spot, solved once when an effect fires. */
export function vayoEnvelope(at, o = {}) {
  const size = o.size > 0 ? o.size : 1.5, reach = o.reach > 0 ? o.reach : 2.5 * size, n = o.n || 32;
  const boxes = Array.isArray(o.colliders) ? o.colliders : [], ground = typeof o.ground === 'function' ? o.ground : null;
  const gAt = (x, y) => { const z = ground ? ground(x, y) : null; return typeof z === 'number' && Number.isFinite(z) ? z : null; };
  const floor = Number.isFinite(o.floor) ? o.floor : (gAt(at[0], at[1]) ?? at[2]);
  const o0 = [at[0], at[1], Math.max(at[2], floor) + 0.1];
  // the boxes near enough to matter (a city's thousands are not all asked)
  const near = boxes.filter((b) => b && b.min && b.max && b.min[0] - reach <= o0[0] && b.max[0] + reach >= o0[0] && b.min[1] - reach <= o0[1] && b.max[1] + reach >= o0[1] && b.min[2] - reach <= o0[2] && b.max[2] + reach >= o0[2]
    && !(o0[0] > b.min[0] && o0[0] < b.max[0] && o0[1] > b.min[1] && o0[1] < b.max[1] && o0[2] > b.min[2] && o0[2] < b.max[2]));
  // a ray against a box: the distance in, and the face's normal
  const slab = (b, d) => {
    let t0 = -Infinity, t1 = Infinity, ax = -1, sg = 0;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (o0[k] < b.min[k] || o0[k] > b.max[k]) return null; continue; }
      const a = (b.min[k] - o0[k]) / d[k], c = (b.max[k] - o0[k]) / d[k], lo = Math.min(a, c);
      if (lo > t0) { t0 = lo; ax = k; sg = d[k] > 0 ? -1 : 1; }
      t1 = Math.min(t1, Math.max(a, c));
    }
    if (!(t1 >= t0 && t0 >= 0)) return null;
    const nn = [0, 0, 0]; if (ax >= 0) nn[ax] = sg;
    return { t: t0, n: nn };
  };
  // the directions, even over the sphere (a Fibonacci lattice, so the same every time)
  const dirs = [], golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(Math.max(0, 1 - z * z)), a = golden * i, d = [r * Math.cos(a), r * Math.sin(a), z];
    let hit = reach, nrm = null;
    for (const b of near) { const h = slab(b, d); if (h && h.t < hit) { hit = h.t; nrm = h.n; } }
    // the ground along it (a few steps; the floor plane where no ground is asked)
    if (d[2] < 0) {
      if (!ground) { const t = (o0[2] - floor) / -d[2]; if (t < hit) { hit = t; nrm = [0, 0, 1]; } }
      else for (let s = 1; s <= 8; s++) { const t = (hit * s) / 8, z0 = gAt(o0[0] + d[0] * t, o0[1] + d[1] * t) ?? floor; if (o0[2] + d[2] * t <= z0) { hit = t; nrm = [0, 0, 1]; break; } }
    } else if (ground) for (let s = 1; s <= 8; s++) { const t = (hit * s) / 8, z0 = gAt(o0[0] + d[0] * t, o0[1] + d[1] * t); if (z0 !== null && o0[2] + d[2] * t <= z0) { hit = t; nrm = [0, 0, 1]; break; } }
    dirs.push({ d, hit: Math.max(0.05, hit), open: Math.max(0.05, hit) / reach, n: nrm });
  }
  // the faces the rays met, as planes from the cast point (n toward it, P a point on it): what a slide may not pass
  const planes = [];
  for (const x of dirs) {
    if (!x.n) continue;
    const P = [x.d[0] * x.hit, x.d[1] * x.hit, x.d[2] * x.hit], c = x.n[0] * P[0] + x.n[1] * P[1] + x.n[2] * P[2];
    if (!planes.some((q) => q.n[0] === x.n[0] && q.n[1] === x.n[1] && q.n[2] === x.n[2] && Math.abs(q.c - c) < 0.05)) planes.push({ n: x.n, c });
  }
  // how much each direction gets: its openness, squared (a closed way takes little); and the ground's ways alone
  const cdf = (pick) => { let s = 0; const c = dirs.map((x) => (s += pick(x) ? x.open * x.open : 0)); return s > 0 ? c.map((v) => v / s) : dirs.map((_, i) => (i + 1) / dirs.length); };
  const pool = (Array.isArray(o.pools) ? o.pools : []).find((p) => p && p.min && p.max && at[0] >= p.min[0] && at[0] <= p.max[0] && at[1] >= p.min[1] && at[1] <= p.max[1] && at[2] >= p.min[2] && at[2] <= p.max[2]);
  const w = Array.isArray(o.wind) ? o.wind : [0, 0];
  return { at: [at[0], at[1], at[2]], o: o0, size, reach, floor, dirs, planes, all: cdf(() => true), up: cdf((x) => x.d[2] > -0.2), flat: cdf((x) => Math.abs(x.d[2]) < 0.45),
    wind: [w[0] || 0, w[1] || 0], medium: pool ? 'water' : 'air', surface: pool ? pool.max[2] : null, density: o.density > 0 ? o.density : 1.2, g: o.g > 0 ? o.g : 9.81 };
}

/** A spray's tracers along the flow at time t: sprayPoints' points, so the page's sprite step draws them as it is. */
export function vayoPoints(S, E, t, loop) {
  const out = [], TAU = 6.283185307179586, fr = (x) => x - Math.floor(x), hs = (a, b) => fr(Math.sin(a * 12.9898 + b * 78.233 + 4.1) * 43758.5453);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const env = (u) => (S.env === 'ends' ? Math.sin(Math.PI * u) : S.env === 'in' ? u * u : S.env === 'out' ? Math.min(1, u * 12) * (1 - u) * (1 - u) : Math.min(1, u * 12) * Math.min(1, (1 - u) * 6));
  const kind = S.flow, R = (S.r > 0 ? S.r : E.size), D = E.dirs, trail = S.trail || 1, lag = S.lag || 0, at = E.at, fl = E.floor;
  const pick = (c, x) => { let i = 0; while (i < c.length - 1 && c[i] < x) i++; return D[i]; };
  const front = (u) => Math.pow(clamp(u, 0, 1), 0.4);   // Sedov–Taylor's r ∝ t^⅖, its time stretched for the eye
  const thin = clamp(E.density / 1.2, 0, 2), water = E.medium === 'water';
  // the wind of a height: the log profile, near enough (⅐ power), half at the ground, none in water
  const drift = (z, tt) => { if (water) return [0, 0]; const k = clamp(Math.pow(Math.max(0.2, z - fl + 0.5) / 10, 1 / 7), 0.5, 1.3) * (S.windK ?? 1) * tt; return [E.wind[0] * k, E.wind[1] * k]; };
  // the vortex's turn at a radius (Lamb–Oseen): fast in its core, slow outside
  const turn = (h, G, rc, tt) => (G ? ((G / Math.max(1e-6, h * h)) * (1 - Math.exp(-(h * h) / (rc * rc)))) * tt : 0);
  // out along d to r, stopped where its way meets a face and sliding along it
  // (from where its rays were cast: the spot, lifted off its floor)
  const lift = [E.o[0] - at[0], E.o[1] - at[1], E.o[2] - at[2]];
  const along = (q, r) => {
    const stop = 0.9 * q.hit;
    if (r <= stop || !q.n) { const s = Math.min(r, q.n ? stop : r); return [lift[0] + q.d[0] * s, lift[1] + q.d[1] * s, lift[2] + q.d[2] * s]; }
    const dn = q.d[0] * q.n[0] + q.d[1] * q.n[1] + q.d[2] * q.n[2], tg = [q.d[0] - dn * q.n[0], q.d[1] - dn * q.n[1], q.d[2] - dn * q.n[2]], L = Math.hypot(tg[0], tg[1], tg[2]) || 1;
    // (the slide stops short of every face it runs toward: a floor run into a wall goes no further than the wall)
    const t = [tg[0] / L, tg[1] / L, tg[2] / L], sp = [q.d[0] * stop, q.d[1] * stop, q.d[2] * stop];
    let e = (r - stop) * 0.8;
    for (const pl of E.planes || []) { const nt = pl.n[0] * t[0] + pl.n[1] * t[1] + pl.n[2] * t[2]; if (nt >= -1e-6) continue; const room = pl.n[0] * sp[0] + pl.n[1] * sp[1] + pl.n[2] * sp[2] - pl.c; e = Math.min(e, Math.max(0, (0.9 * room) / -nt)); }
    return [lift[0] + q.d[0] * stop + (tg[0] / L) * e, lift[1] + q.d[1] * stop + (tg[1] / L) * e, lift[2] + q.d[2] * stop + (tg[2] / L) * e];
  };
  const T = S.front > 0 ? S.front : 0.22;   // the share of its life the front takes to stall
  // where tracer i is at its age tau (of its life): { x, y, z (from the spot), sz, w }
  const place = (i, tau, life) => {
    const u = tau / life;
    let x = 0, y = 0, z = 0, sz = S.size * (0.7 + 0.6 * hs(i, 8)), w = env(u);
    if (kind === 'core' || kind === 'embers' || kind === 'debris') {
      const dir = pick(kind === 'core' ? E.all : E.up, hs(i, 3)), jit = dir.n ? 0 : (hs(i, 4) - 0.5) * 0.35;   // (a way that meets a face keeps its line: its stop is for that line)
      const dd = { ...dir, d: [dir.d[0] + jit * dir.d[1], dir.d[1] - jit * dir.d[0], dir.d[2]] };
      if (kind === 'core') {
        // out on the front, then lifted on its heat and rolled into a ring
        const uf = u / T, r = R * (0.45 + 0.55 * hs(i, 5)) * front(uf), off = along(dd, r), after = Math.max(0, tau - T * life);
        const rise = (S.rise ?? 1) * 0.5 * Math.sqrt(E.g * R) * (water ? 1.4 : thin) * after;
        let h = Math.hypot(off[0], off[1]), az = Math.atan2(off[1], off[0]), oz = off[2];
        // the ring's roll: about its core circle, top outward, outside down (it widens as it lifts)
        const ring = 0.7 * R * (1 + 0.5 * sm(after / (life * 0.6))), ph = (S.roll ?? 1.6) * (1 - Math.exp(-after / (0.35 * life)));
        const qh = h - ring, qz = oz, c = Math.cos(ph), s = Math.sin(ph);
        h = Math.max(0, ring + qh * c + qz * s); oz = -qh * s + qz * c;
        // a bubble in water pulses as it climbs
        if (water) { const k = 1 + 0.22 * Math.sin((TAU * after) / Math.max(0.05, 0.12 * life)) * Math.exp(-after / (0.5 * life)); h *= k; oz *= k; }
        az += turn(h, (S.swirl ?? 0.4) * R * R, 0.3 * R, tau);
        x = h * Math.cos(az); y = h * Math.sin(az); z = oz + rise;
        sz *= (0.45 + 0.55 * front(uf)) * (1 + (S.grow || 0) * u);
      } else {
        // thrown along an open way, slowed by the air, falling; stopped where its way meets a face
        const sp = (S.v || 6) * (0.6 + 0.8 * hs(i, 5)), k = S.drag ?? (kind === 'embers' ? 2.2 : 0.6), g = (S.gravity ?? (kind === 'embers' ? 0.25 : 1)) * E.g;
        const dk = k ? (1 - Math.exp(-k * tau)) / k : tau, lift = Math.max(0.15, dd.d[2] + 0.35);
        const L = Math.hypot(dd.d[0], dd.d[1], lift) || 1, ux = dd.d[0] / L, uy = dd.d[1] / L, uz = lift / L;
        const hz = Math.min(sp * dk, 0.9 * dd.hit / Math.max(0.2, Math.hypot(ux, uy)));
        x = ux * hz; y = uy * hz; z = uz * sp * dk - 0.5 * g * tau * tau;
        if (at[2] + z < fl) { z = fl - at[2]; if (kind === 'embers') w *= 0.4; }
      }
    } else if (kind === 'skirt' || kind === 'gust') {
      // run out along the ground and slow, lifting a little and curling, wider than the core
      const dir = pick(E.flat, hs(i, 3)), a = Math.atan2(dir.d[1], dir.d[0]) + (dir.n && dir.n[2] < 0.5 ? 0 : (hs(i, 4) - 0.5) * 0.5), base = { ...dir, d: [Math.cos(a), Math.sin(a), 0] };
      const Rs = (S.reach ?? 2.2) * R, uf = kind === 'gust' ? u : u / Math.max(T * 1.6, 0.05), r = Rs * (0.55 + 0.45 * hs(i, 5)) * front(uf) + (Number.isFinite(S.from) ? S.from : 0);
      const off = along(base, r), k = r / Rs;
      x = off[0]; y = off[1]; z = fl - at[2] + R * (0.08 + 0.3 * k * k) * (0.7 + 0.6 * hs(i, 6)) + (Number.isFinite(S.lift) ? S.lift : 0.3) * R * sm(u);
      sz *= 0.6 + 0.9 * k; w *= 1 - 0.5 * k;
    } else if (kind === 'smoke') {
      // a plume from the top of the fire: climbing as t^⅔, widening, curling slowly, leaning with the wind
      const a = hs(i, 3) * TAU, r0 = R * 0.6 * Math.sqrt(hs(i, 4)), climb = (S.rise ?? 1) * R * 0.9 * Math.pow(Math.max(0, tau), 2 / 3) * (water ? 1.5 : thin);
      const h = r0 * (1 + 0.6 * u) + R * 0.25 * u, az = a + turn(h, (S.swirl ?? 0.25) * R * R, 0.4 * R, tau);
      x = h * Math.cos(az); y = h * Math.sin(az); z = R * 0.7 + climb;
      sz *= 1 + (S.grow ?? 1.4) * u;
    } else if (kind === 'inflow') {
      // drawn in on a log spiral toward the middle, brightening as it nears
      const dir = pick(E.all, hs(i, 3)), r0 = R * (0.7 + 0.6 * hs(i, 5)), r = r0 * Math.pow(1 - clamp(u, 0, 1), 1.4) + 0.04;
      const a = Math.atan2(dir.d[1], dir.d[0]) + (S.swirl ?? 1.2) * Math.log(r0 / r), zz = dir.d[2] * r * 0.8 + (Array.isArray(S.z) ? (S.z[0] + S.z[1]) / 2 : Number.isFinite(S.z) ? S.z : 0);
      x = r * Math.cos(a); y = r * Math.sin(a); z = zz;
      sz *= 0.5 + 0.7 * (1 - r / r0); w = Math.min(1, u * 3) * (1 - sm((u - 0.9) / 0.1));
    } else if (kind === 'column') {
      // an aura's flames: born round the feet, rising, tapering, turning round the body, leaning with the wind
      const H = S.height ?? 2.2, a = hs(i, 3) * TAU, rb = R * (0.6 + 0.5 * hs(i, 4)), zz = H * u * (0.8 + 0.4 * hs(i, 5));
      const h = rb * (1 - 0.55 * (zz / H)), az = a + turn(h, (S.swirl ?? 0.35), 0.5 * R, tau);
      x = h * Math.cos(az); y = h * Math.sin(az); z = fl - at[2] + zz;
      sz *= 1 - 0.5 * u;
    } else if (kind === 'motes') {
      // pebbles lifting off the ground round the feet, wobbling, turning slowly
      const a = hs(i, 3) * TAU + 0.15 * tau, r = R * (0.5 + hs(i, 4)), H = (S.height ?? 1.4) * (0.4 + 0.6 * hs(i, 5));
      x = r * Math.cos(a); y = r * Math.sin(a); z = fl - at[2] + 0.05 + H * sm(u * 1.6) + 0.06 * Math.sin(tau * 4 + i);
    }
    const dw = drift(at[2] + z, kind === 'inflow' || kind === 'column' || kind === 'motes' ? 0 : tau);
    return { x: x + dw[0], y: y + dw[1], z, sz, w };
  };
  const streak = S.glyph === 'streak' || S.glyph === 'spark' || S.glyph === 'tongue' || S.glyph === 'drop';   // (laid along their flight)
  for (let i = 0; i < S.count; i++) {
    const life = S.life * (loop ? 0.75 + 0.5 * hs(i, 1) : 0.85 + 0.3 * hs(i, 1));
    const tau0 = loop ? fr(t / life + hs(i, 2)) * life : t - (S.delay || 0) - (S.stagger || 0) * hs(i, 2);
    for (let q = 0; q < trail; q++) {
      const tau = tau0 - q * lag, u = tau / life;
      if (tau < 0 || u > 1) { out.push({ p: [at[0], at[1], at[2]], v: [0, 0, 0], w: 0, s: 0, rot: 0, ring: -1 }); continue; }
      const P = place(i, tau, life);
      // the velocity a streak reads (it lies along its flight): the same law a moment on
      let v = [0, 0, 0];
      if (streak) { const N = place(i, Math.min(life, tau + 0.02), life); v = [(N.x - P.x) / 0.02, (N.y - P.y) / 0.02, (N.z - P.z) / 0.02]; }
      out.push({ p: [at[0] + P.x, at[1] + P.y, at[2] + P.z], v, w: P.w * Math.pow(0.7, q), s: P.sz * (1 - (0.6 * q) / trail), rot: hs(i, 9) * TAU + (S.spin || 0) * TAU * tau, ring: -1, u });
    }
  }
  return out;
}
