/**
 * THE STREET'S DOODADS, ROUND — a geotown's furniture drawn as the things they are (lathed, not boxes) when its cube draws
 * it exaggerated: a hydrant on its flange with its barrel, its domed bonnet and its nozzles; a bin a drum under its lid; a
 * post box a pillar under its dome and its slot; a streetlight a tapered standard on a collar, its arm and its bell; a
 * sign's and a signal's posts round. In the cube's TOON register (`toonOf`: a cel register, or bands and an outline) each
 * piece is EXAGGERATED and INCONGRUENT: every part sized by its own dice, so no two pieces agree and no part agrees with
 * the one it stands on (a bonnet too big for its barrel, a bent standard under an oversized head, a fat bin under a
 * small lid). The piece stands where it stood, on the walk under it; only its shape is the hand's.
 *
 *   toonOf(register)                   whether a cube's register draws toon
 *   proportions(R, toon)               a piece's dials: each part's own scale (1 for a plain hand)
 *   hydrantOf(x, y, z, toward, D)      → faces [{ corners, out, role }]  (roles: hydrant, yellow, cap)
 *   binOf(x, y, z, D)                  → faces (streetbin, pole)
 *   postboxOf(x, y, z, D)              → faces (postbox, slot)
 *   lampOf(x, y, z, toward, h, D)      → faces (pole, lamp): its standard to h, its arm 1.9 m toward the road, its bell
 *   postOf(x, y, z, h, r, role, D)     → faces: a round post (a sign's, a signal's), bent in a toon register
 *   tube(rings, n, role, caps)         the primitive: rings ({ c: [x, y, z], r, a? (axis, up by default) }) joined
 *
 * Metres, world frame. Pure; the dice are the caller's.
 */
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P = (p) => p.map(r5);
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Whether a cube's register draws toon: a cel register by name, or bands with an outline. */
export const toonOf = (reg) => !!reg && (reg.name === 'cel' || (reg.steps >= 2 && !!reg.outline));

/** A piece's dials: each part's scale, 1 for a plain hand; a toon register's each its own, apart from the others. */
export function proportions(R, toon) {
  if (!toon) return { toon: false, body: 1, height: 1, head: 1, bulge: 1, reach: 1, bend: 0, tilt: 0, lid: 1, taper: 1 };
  const u = (lo, hi) => lo + (hi - lo) * R();
  return {
    toon: true, body: u(0.75, 2), height: u(0.6, 1.7), head: u(1.6, 3), bulge: u(1.15, 1.8), reach: u(0.7, 1.9),
    bend: R() < 0.5 ? u(-1, -0.4) : u(0.4, 1), tilt: (R() < 0.5 ? -1 : 1) * u(0.12, 0.35), lid: R() < 0.5 ? u(0.5, 0.8) : u(1.4, 2.1), taper: R() < 0.5 ? u(0.55, 0.8) : u(1.2, 1.6),
  };
}

/** Rings joined into a tube: each ring a circle of `n` round its centre square to its axis; `caps` closes its ends. */
export function tube(rings, n, role, caps = [false, true]) {
  const out = [];
  const ringPts = rings.map(({ c, r, a = [0, 0, 1] }) => {
    const A = norm(a), ref = Math.abs(A[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], U = norm(cross(A, ref)), V = cross(A, U);
    return Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n, cs = Math.cos(t), sn = Math.sin(t); return [c[0] + r * (cs * U[0] + sn * V[0]), c[1] + r * (cs * U[1] + sn * V[1]), c[2] + r * (cs * U[2] + sn * V[2])]; });
  });
  for (let k = 0; k + 1 < rings.length; k++) {
    const a = ringPts[k], b = ringPts[k + 1], ca = rings[k].c, cb = rings[k + 1].c;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, m = [(a[i][0] + a[j][0] + b[i][0] + b[j][0]) / 4, (a[i][1] + a[j][1] + b[i][1] + b[j][1]) / 4, (a[i][2] + a[j][2] + b[i][2] + b[j][2]) / 4];
      const mid = [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, (ca[2] + cb[2]) / 2];
      out.push({ corners: [P(a[i]), P(a[j]), P(b[j]), P(b[i])], out: norm([m[0] - mid[0], m[1] - mid[1], m[2] - mid[2]]).map(r5), role });
    }
  }
  const cap = (k, sgn) => {
    const pts = ringPts[k], c = rings[k].c, A = norm(rings[k].a ?? [0, 0, 1]).map((v) => v * sgn);
    if (rings[k].r < 1e-4) return;
    for (let i = 0; i < n; i++) out.push({ corners: [P(c), P(pts[i]), P(pts[(i + 1) % n])], out: A.map(r5), role });
  };
  if (caps[0]) cap(0, -1);
  if (caps[1]) cap(rings.length - 1, 1);
  return out;
}
/** A lathed form up from (x, y, z): its profile [[r, h], …] base to top, each ring shifted by `lean(h)` (a bend). */
const lathe = (x, y, z, prof, n, role, lean = () => [0, 0], caps) => tube(prof.map(([r, h]) => { const [dx, dy] = lean(h); return { c: [x + dx, y + dy, z + h], r }; }), n, role, caps);
/** A lathed form on a TILTED axis: up from (x, y, z), its axis turned `tilt` radians toward (ux, uy) (a toon head or lid
 *  knocked off its body's line); its rings square to that axis. */
const tilted = (x, y, z, prof, n, role, tilt, ux = 1, uy = 0, caps) => {
  const a = [Math.sin(tilt) * ux, Math.sin(tilt) * uy, Math.cos(tilt)];
  return tube(prof.map(([r, h]) => ({ c: [x + a[0] * h, y + a[1] * h, z + a[2] * h], r, a })), n, role, caps);
};
/** A toon piece's bend: an S along its height h, `amt` metres at its most, toward (ux, uy). */
const sBend = (H, amt, ux, uy) => (h) => { const t = Math.min(1, h / H), s = amt * Math.sin(Math.PI * t) * (1 - 0.6 * t); return [s * ux, s * uy]; };

export function hydrantOf(x, y, z, [tx, ty], D) {
  const b = 0.13 * D.body, h = 0.62 * D.height, bon = b * 1.05 * D.head, u = [tx, ty];
  const lean = D.toon ? sBend(h, 0.06 * D.bend, -ty, tx) : () => [0, 0];
  const out = [
    ...lathe(x, y, z, [[b * 1.45, 0], [b * 1.45, 0.06], [b, 0.08], [b * D.bulge, h * 0.5], [b, h * 0.92], [b * 1.12, h]], 12, 'hydrant', lean),
    // its bonnet: a dome over the barrel (a toon one too big for it), its operating nut on top
    ...tilted(x + lean(h)[0], y + lean(h)[1], z + h, [[bon, 0], [bon * 0.92, bon * 0.35], [bon * 0.6, bon * 0.7], [bon * 0.12, bon * 0.82]], 12, 'yellow', D.tilt, tx, ty),
    ...tilted(x + lean(h)[0] + Math.sin(D.tilt) * tx * bon * 0.78, y + lean(h)[1] + Math.sin(D.tilt) * ty * bon * 0.78, z + h + Math.cos(D.tilt) * bon * 0.78, [[0.035 * D.head, 0], [0.035 * D.head, 0.07]], 6, 'cap', D.tilt, tx, ty),
  ];
  // its nozzles: two hose outlets either side, the pumper toward the road (a toon one long)
  const zn = z + h * 0.62, nz = (dir, len, r) => { const [ox, oy] = lean(h * 0.62), c0 = [x + ox, y + oy, zn]; return tube([{ c: c0, r, a: [dir[0], dir[1], 0] }, { c: [c0[0] + dir[0] * len, c0[1] + dir[1] * len, zn], r, a: [dir[0], dir[1], 0] }, { c: [c0[0] + dir[0] * (len + 0.03), c0[1] + dir[1] * (len + 0.03), zn], r: r * 1.25, a: [dir[0], dir[1], 0] }], 8, 'cap', [false, true]); };
  out.push(...nz(u, (b + 0.1) * D.reach, 0.055 * Math.sqrt(D.body)), ...nz([-ty, tx], b + 0.06, 0.035 * Math.sqrt(D.body)), ...nz([ty, -tx], b + 0.06, 0.035 * Math.sqrt(D.body)));
  return out;
}

export function binOf(x, y, z, D) {
  const r = 0.28 * D.body, h = 0.95 * D.height, top = r * D.taper, lid = top * 1.08 * D.lid, lean = D.toon ? sBend(h, 0.05 * D.bend, 1, 0) : () => [0, 0];
  const [lx, ly] = lean(h);
  return [
    ...lathe(x, y, z, [[r * 0.92, 0], [r, 0.05], [(r + top) / 2 * D.bulge, h * 0.5], [top, h]], 12, 'streetbin', lean, [false, false]),
    ...tilted(x + lx, y + ly, z + h, [[lid, 0], [lid, 0.06], [lid * 0.8, 0.1], [lid * 0.35, 0.12 + 0.08 * D.head]], 12, 'pole', D.tilt, 0.6, 0.8),
  ];
}

export function postboxOf(x, y, z, D) {
  const r = 0.26 * D.body, h = 1.15 * D.height, dome = r * 1.12 * (D.toon ? D.head * 0.8 : 1), lean = D.toon ? sBend(h, 0.07 * D.bend, 0, 1) : () => [0, 0];
  const [lx, ly] = lean(h);
  return [
    ...lathe(x, y, z, [[r * 1.15, 0], [r * 1.15, 0.08], [r, 0.12], [r * D.bulge, h * 0.55], [r, h]], 12, 'postbox', lean, [false, false]),
    ...tilted(x + lx, y + ly, z + h, [[dome, 0], [dome, 0.05], [dome * 0.85, dome * 0.4], [dome * 0.4, dome * 0.75], [0, dome * 0.85]], 12, 'postbox', D.tilt, -0.8, 0.6),
    // its slot: a dark band round its neck
    // (the body's own radius there, between its bulge at 0.55 of its height and its neck: the band hugs it)
    ...((rr) => lathe(x + lean(h * 0.8)[0], y + lean(h * 0.8)[1], z + h * 0.8, [[rr + 0.012, 0], [rr + 0.012, 0.05]], 12, 'slot', () => [0, 0], [false, false]))(r * D.bulge + (r - r * D.bulge) * ((0.8 - 0.55) / 0.45)),
  ];
}

export function lampOf(x, y, z, [tx, ty], h, D) {
  const H = h * (D.toon ? 0.9 + 0.2 * D.height : 1), r0 = 0.09 * Math.sqrt(D.body), lean = D.toon ? sBend(H, 0.35 * D.bend, -ty, tx) : () => [0, 0];
  const [lx, ly] = lean(H), reach = 1.9 * D.reach, top = [x + lx, y + ly, z + H];
  const head = 0.2 * D.head, hx = top[0] + tx * reach, hy = top[1] + ty * reach;
  return [
    // its standard: a collar, then tapering to its top (a toon one bent, its foot kept)
    ...lathe(x, y, z, [[r0 * 1.8, 0], [r0 * 1.8, 0.35], [r0, 0.45], [r0 * 0.8, H * 0.5], [r0 * 0.5, H]], 10, 'pole', lean),
    // its arm out over the road, curling down at its end in a toon register
    ...tube([{ c: top, r: 0.04, a: [tx, ty, 0] }, { c: [top[0] + tx * reach * 0.7, top[1] + ty * reach * 0.7, top[2] + (D.toon ? 0.25 * D.reach : 0)], r: 0.04, a: [tx, ty, 0.2] }, { c: [hx, hy, top[2] - (D.toon ? 0.05 : 0)], r: 0.04, a: [tx, ty, -0.3] }], 6, 'pole', [false, false]),
    // its bell hung under the arm's end, its glass a ring under it
    ...lathe(hx, hy, top[2] - head * 0.95, [[0, -0.02], [head * 0.55, 0], [head, head * 0.35], [head * 0.7, head * 0.75], [head * 0.15, head * 0.95]], 12, 'pole', () => [0, 0], [false, true]),
    ...lathe(hx, hy, top[2] - head * 1.12, [[head * 0.45, 0], [head * 0.55, head * 0.18]], 12, 'lamp', () => [0, 0], [true, false]),
  ];
}

export function postOf(x, y, z, h, r, role, D) {
  const lean = D.toon ? sBend(h, 0.12 * D.bend, 1, 0.3) : () => [0, 0];
  return lathe(x, y, z, [[r * 1.4, 0], [r * 1.4, 0.06], [r, 0.08], [r * (D.toon ? 0.75 : 0.92), h]], 8, role, lean);
}
