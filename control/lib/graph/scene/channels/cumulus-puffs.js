// THE CUMULUS' PUFFS (a page's own function, inlined by toString): each cumulus a cluster of camera-facing puffs, laid by
// its own dice. A fair cloud is a dome: a broad low body over its flat base, its puffs heaped toward its middle as it
// climbs, drawn out along the wind, its puffs large and overlapping so it reads as one cloud; a thunderhead a broad foot,
// a tower narrowing a little as it climbs and an anvil spread wide downwind. The flight sky (flight-sky.js) and the ground
// worlds' sky (form-sky.js, sky-cumulus.js) lay them the same way.
//
//   cumulusPuffs(C, n0, wind, sun) → { P, I }   C: the clouds, six numbers each [x, y, base, radius, height, seed]; wind
//     [x, y] (a unit direction); sun { x, y, z }. P: four numbers a puff (x, y, z, radius); I: four (its dice, its share of
//     the sun (a tower's dice negative: its puffs stay round), its cloud's base and top)
//
// Closes over nothing: no imports, no module state.
export function cumulusPuffs(C, n0, wind, sun) {
  const mul = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const P = [], I = [];
  for (let k = 0; k < n0; k++) {
    const x = C[k * 6], y = C[k * 6 + 1], base = C[k * 6 + 2], rad = C[k * 6 + 3], hgt = C[k * 6 + 4], R = mul(C[k * 6 + 5]);
    const tower = hgt > 1.5 * rad, n = Math.max(10, Math.min(tower ? 140 : 110, Math.round(tower ? 8 + rad / 45 + hgt / 70 : 14 + rad / 30 + hgt / 60))), top = base + hgt;
    for (let i = 0; i < n; i++) {
      // a fair cumulus: wide, a flat base under a broad low body and a heaped dome over it, drawn out along the wind; its
      // puffs large and overlapping so they read as one cloud, not a heap of small balls
      // (a thunderhead: a broad foot, a tower narrowing a little as it climbs, an anvil spread wide at its top, downwind)
      // (a fair cloud as a dome: its body low and wide, its puffs heaped toward its middle as it climbs, a rounded crown)
      const t = tower ? (i < n * 0.4 ? R() * 0.25 : Math.min(1, 0.2 + R() * 0.85 * (i / n) + 0.15)) : (i < n * 0.4 ? R() * 0.15 : 0.15 + 0.85 * Math.pow(R(), 0.85)), spread = tower ? (t > 0.86 ? 1.7 : 0.85 - 0.25 * t) : Math.sqrt(Math.max(0.08, 1 - 0.92 * t * t));
      const ang = R() * 6.2832, rr = Math.sqrt(R()) * rad * (tower ? 0.7 : 0.8) * spread, pr = rad * (tower ? (t > 0.86 ? 0.3 : 0.27 - 0.06 * t) : 0.36 - 0.12 * t) * (tower ? 0.65 + 0.7 * R() : 0.75 + 0.5 * R());
      const ax = tower && t > 0.85 ? wind[0] * rad * 0.6 : 0, ay = tower && t > 0.85 ? wind[1] * rad * 0.6 : 0;
      // (along the wind a fair cloud runs a third longer, across it a fifth narrower)
      const al = Math.cos(ang) * rr * (tower ? 1 : 1.25), ac = Math.sin(ang) * rr * (tower ? 1 : 0.85);
      const px = x + al * wind[0] - ac * wind[1] + ax, py = y + al * wind[1] + ac * wind[0] + ay, pz = base + pr * (tower ? 0.55 : 0.75) + (tower && t > 0.86 ? (0.9 + 0.1 * R()) : t) * Math.max(0, hgt - pr * (tower ? 1 : 1.1));
      // its light inside its cloud: the side toward the sun bright, the far side and the deep middle shaded
      const ox = (px - x) / rad, oy = (py - y) / rad, oz = (pz - (base + hgt / 2)) / Math.max(hgt, 1), toward = ox * sun.x + oy * sun.y + oz * sun.z;
      // (a tower's puff marked by its sign: round, where a fair cloud's are a little wider than tall)
      const rn = R();
      P.push(px, py, pz, pr); I.push(tower ? -(rn + 0.001) : rn, tower ? Math.min(1, Math.max(0.35, 0.68 + 0.45 * toward)) : Math.min(1, Math.max(0.6, 0.8 + 0.25 * toward)), base, top);
    }
  }
  return { P, I };
}
