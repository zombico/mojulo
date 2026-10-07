// Spotted coats as data, shared by the families that wear them (feline, canine).
const steps = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

// ── a FINE coat shell for spot / rosette coats: the same loft a hair proud of the trunk, but on a fine ring (`half`
// bands a side, default 16) and fine stations (`n` bands from y `from` to `to`), its band colours read off a pattern
// FIELD in metres (`field(y, s, t)`: y along the trunk, s the arc down from the back line, t = 0 back line → 1 belly),
// so a spot is a cluster of small faces, not one coarse band. It follows the trunk's centre line (a sloping back too:
// frame 'keep') and a station's `top` (the ring raised by top/2, its front radius grown by top/2).
export const fineSlots = (h) => (h === 10 ? 'ring20' : ['front', ...Array.from({ length: h - 1 }, (_, k) => `c${k + 1}R`), 'back', ...Array.from({ length: h - 1 }, (_, k) => `c${h - 1 - k}L`)]);
export const fineCoat = (name, torso, { bulk = 1, proud = 1.035, from, to, n, half = 16, field }) => {
  const T = torso, at = (y) => { let k = 0; while (k < T.length - 2 && y > T[k + 1].at[1]) k++; const A = T[k], B = T[k + 1], t = Math.max(0, Math.min(1, (y - A.at[1]) / (B.at[1] - A.at[1])));
    const L = (a, b) => a + (b - a) * t; return { z: L(A.at[2], B.at[2]), rs: L(A.r[0], B.r[0]) * bulk, rf: L(A.r[1], B.r[1]) * bulk, top: L(A.top || 0, B.top || 0) }; };
  const ys = steps(from, to, n), S = ys.map(at);
  const band = (i) => { const y = (ys[i] + ys[i + 1]) / 2, a = at(y), H = Math.PI * (a.rs + a.rf + a.top / 2) / 2;
    return Array.from({ length: half }, (_, j) => field(y, H * (j + 0.5) / half, (j + 0.5) / half)); };
  return { name, kind: 'loft', slots: fineSlots(half), frame: 'keep', group: 'Coat', mirror: 'plane',
    stations: ys.map((y, i) => ({ at: [0, y, S[i].z + S[i].top / 2], r: [S[i].rs * proud, (S[i].rf + S[i].top / 2) * proud] })),
    bandGroups: Object.fromEntries(ys.slice(1).map((_, i) => [`st${i}-st${i + 1}`, band(i)])),
    caps: { back: [0, from - 0.02, S[0].z + S[0].top / 2], tip: [0, to + 0.02, S[n].z + S[n].top / 2] }, capGroups: { back: 'Coat', tip: 'Coat' } };
};
// a deterministic hash of integers → [0, 1)
export const hash3 = (a, b, c) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
// the spot centres near (y, s): a brick lattice of `cell` m, each centre jittered, each spot its own radius and
// stretch; calls `f(dy, ds, r, h)` for the nearest centre (dy, ds its offset, r its radius, h its own hash seed)
const nearSpot = (y, s, { cell, rad, jitter = 0.6, seed = 0, stretch = 0.3 }) => {
  const cy = Math.floor(y / cell); let best = null;
  for (let a = cy - 1; a <= cy + 1; a++) { const off = a & 1 ? 0.5 : 0, cs = Math.floor(s / cell - off);
    for (let b = cs - 1; b <= cs + 1; b++) {
      const py = (a + 0.5 + jitter * (hash3(a, b, seed) - 0.5)) * cell, ps = (b + off + 0.5 + jitter * (hash3(a, b, seed + 1) - 0.5)) * cell;
      const k = 1 + stretch * (hash3(a, b, seed + 2) - 0.5) * 2, dy = (y - py) * k, ds = (s - ps) / k, r = rad[0] + (rad[1] - rad[0]) * hash3(a, b, seed + 3);
      const d = Math.sqrt(dy * dy + ds * ds) / r; if (!best || d < best.d) best = { d, dy, ds, r, h: (a * 7919 + b * 104729) | 0 };
    } }
  return best;
};
// SPOTS: round-ish solid patches of radius `rad` [min, max] m on a jittered lattice; from t = `belly` down the coat is
// `under` (spotted there too when `bellySpots`)
export const spotField = ({ cell, rad, seed = 0, jitter, stretch, belly = 0.8, bellySpots = false, under = 'Belly', dark = 'Mane' }) => (y, s, t) => {
  const p = nearSpot(y, s, { cell, rad, jitter, seed, stretch });
  if (t >= belly) return bellySpots && p.d < 0.9 ? dark : under;
  return p.d < 1 ? dark : 'Coat';
};
// ROSETTES: on the same jittered lattice, each spot a RING of dark broken blotches (its outer `ring` share of the
// radius, cut into `arcs` arcs with a share `gap` left open) round a deeper-tawny centre ('Hoof'), a dark DOT inside
// some (`dot` the share of rosettes that carry one)
export const rosetteField = ({ cell, rad, seed = 0, jitter, stretch, ring = 0.5, arcs = 5, gap = 0.25, dot = 0.6 }) => (y, s) => {
  const p = nearSpot(y, s, { cell, rad, jitter, seed, stretch });
  if (p.d >= 1) return 'Coat';
  if (p.d < ring) return p.d < 0.24 && hash3(p.h, 1, seed) < dot ? 'Mane' : 'Hoof';
  // a diamond angle (0..4 round the centre, no trig) picks the arc; some arcs are left open
  const ay = Math.abs(p.dy), as = Math.abs(p.ds), q = ay + as > 0 ? as / (ay + as) : 0;
  const ang = p.dy >= 0 ? (p.ds >= 0 ? q : 4 - q) : (p.ds >= 0 ? 2 - q : 2 + q);
  const arc = Math.floor(((ang / 4) * arcs + hash3(p.h, 2, seed) * arcs) % arcs);
  return hash3(p.h, 3 + arc, seed) < gap ? 'Coat' : 'Mane';
};
