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
 *   ringOf(x, y, z, al, D)             → faces (steel): a bike ring, its post and its ring
 *   shelterOf(rect, z, al, back, inward, D, R)  → faces (shelter, glass, seat): posts, a vaulted roof, glass, a bench
 *   toyCarOf(along, hex, D)            → faces (car, cabin, tyre, lamp) about (0, 0): a toy car in a parked car's place
 *   tube(rings, n, role, caps)         the primitive: rings ({ c: [x, y, z], r, a? (axis, up by default) }) joined
 *
 * Metres, world frame. Pure; the dice are the caller's.
 */
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const TYRE = '#1c1d20', HEADLAMP = '#fff2c2';
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
export const lathe = (x, y, z, prof, n, role, lean = () => [0, 0], caps) => tube(prof.map(([r, h]) => { const [dx, dy] = lean(h); return { c: [x + dx, y + dy, z + h], r }; }), n, role, caps);
/** A lathed form on a TILTED axis: up from (x, y, z), its axis turned `tilt` radians toward (ux, uy) (a toon head or lid
 *  knocked off its body's line); its rings square to that axis. */
export const tilted = (x, y, z, prof, n, role, tilt, ux = 1, uy = 0, caps) => {
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

/** A bike ring: its round post and a ring round it across the walk's line (`al`: the ring in the x–z plane). A toon
 *  ring too big or squashed, tipped off its plane and riding up or down its post, the post bent. */
export function ringOf(x, y, z, al, D) {
  const out = [...postOf(x, y, z, 0.95 * (D.toon ? D.height : 1), 0.03 * Math.sqrt(D.body), 'steel', D)];
  const R = 0.24 * (D.toon ? D.head * 0.6 : 1), sq = D.toon ? D.taper : 1, zc = z + 0.72 * (D.toon ? 0.8 + 0.4 * D.height / 1.7 : 1), tip = D.toon ? D.tilt : 0, n = 14, rr = 0.022 * Math.sqrt(D.body);
  // (the ring's path: a circle round its middle in its plane, squashed by `sq`, tipped by `tip` out of it)
  const at = (t) => { const a = R * Math.cos(t), b = R * sq * Math.sin(t), off = a * Math.sin(tip); return al ? [x + a * Math.cos(tip), y + off, zc + b] : [x + off, y + a * Math.cos(tip), zc + b]; };
  const pts = Array.from({ length: n + 1 }, (_, i) => at((2 * Math.PI * i) / n));
  out.push(...tube(pts.map((c, i) => { const p = pts[(i + n - 1) % n], q = pts[(i + 1) % (n + 1)] ?? pts[1]; return { c, r: rr, a: [q[0] - p[0], q[1] - p[1], q[2] - p[2]] }; }), 6, 'steel', [false, false]));
  return out;
}

/** A shelter over `rect` [x0, y0, x1, y1] on the walk at z: its round posts at its corners, a vaulted roof over them
 *  (its overhang, its rise), its glass back (`back` the line it stands on, along `al`) and sides, and a round bench.
 *  A toon one's roof too big, bulging and tipped (one end higher), its bench fat, its posts each bent its own way. */
export function shelterOf(rect, z, al, back, inward, D, Rd) {
  const [x0, y0, x1, y1] = rect, out = [], H = 2.4, over = 0.12 * (D.toon ? D.head * 1.4 : 1), rise = 0.25 * (D.toon ? D.bulge * 1.6 : 1), tip = D.toon ? 0.35 * D.bend : 0;
  // the roof: a vault across the shelter's depth, along its length, its ends tipped by `tip`
  const [a0, a1] = al ? [x0 - over, x1 + over] : [y0 - over, y1 + over], [b0, b1] = al ? [y0 - over, y1 + over] : [x0 - over, x1 + over], k = 6;
  const P3 = (s, t, zz) => P(al ? [s, t, zz] : [t, s, zz]), zt = (s) => z + H + tip * ((s - (a0 + a1) / 2) / Math.max(0.5, a1 - a0)) * 2;
  // its posts at its corners, each up to the roof over it (a toon one's each bent its own way)
  for (const [px, py] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) out.push(...postOf(px, py, z, zt(al ? px : py) - z - 0.02, 0.045, 'shelter', D.toon ? { ...D, bend: Rd() * 2 - 1 } : D));
  const arc = (s) => Array.from({ length: k + 1 }, (_, i) => { const u = i / k, t = b0 + (b1 - b0) * u; return P3(s, t, zt(s) + rise * Math.sin(Math.PI * u)); });
  const A = arc(a0), B = arc(a1);
  for (let i = 0; i < k; i++) {
    const n = [0, 0, 1];
    out.push({ corners: [A[i], A[i + 1], B[i + 1], B[i]], out: n, role: 'shelter' }, { corners: [B[i], B[i + 1], A[i + 1], A[i]].map((p) => [p[0], p[1], r5(p[2] - 0.05)]), out: [0, 0, -1], role: 'shelter' });
  }
  for (const [S0, s] of [[A, -1], [B, 1]]) for (let i = 0; i < k; i++) out.push({ corners: [S0[i], S0[i + 1], [S0[i + 1][0], S0[i + 1][1], r5(S0[i + 1][2] - 0.05)], [S0[i][0], S0[i][1], r5(S0[i][2] - 0.05)]], out: al ? [s, 0, 0] : [0, s, 0], role: 'shelter' });
  // its glass: the back and the two sides, under the roof's low edge
  const g = (p, q, n) => out.push({ corners: [P([p[0], p[1], z + 0.1]), P([q[0], q[1], z + 0.1]), P([q[0], q[1], Math.min(zt(al ? q[0] : q[1]), zt(al ? p[0] : p[1])) - 0.1]), P([p[0], p[1], Math.min(zt(al ? q[0] : q[1]), zt(al ? p[0] : p[1])) - 0.1])], out: n, role: 'glass' });
  if (al) { g([x0, back], [x1, back], [0, inward, 0]); for (const e of [x0, x1]) g([e, y0], [e, y1], [e === x0 ? -1 : 1, 0, 0]); }
  else { g([back, y0], [back, y1], [inward, 0, 0]); for (const e of [y0, y1]) g([x0, e], [x1, e], [0, e === y0 ? -1 : 1, 0]); }
  // its bench: a round seat along its back
  const br = 0.06 * (D.toon ? D.body * 1.3 : 1), bz = z + 0.45, off = 0.25, [c0, c1] = al ? [[x0 + 0.3, back + inward * off, bz], [x1 - 0.3, back + inward * off, bz]] : [[back + inward * off, y0 + 0.3, bz], [back + inward * off, y1 - 0.3, bz]];
  out.push(...tube([{ c: c0, r: br, a: al ? [1, 0, 0] : [0, 1, 0] }, { c: c1, r: br, a: al ? [1, 0, 0] : [0, 1, 0] }], 8, 'seat', [true, true]));
  return out;
}

/** A side profile [[s, z], …] (s along the car, a closed polygon) extruded across its width, each point's width its
 *  own (`wAt(z)`: the tumblehome), its two side faces fans from the profile's middle. In the car's frame, s along `along`. */
export function extrude(prof, wAt, along, role) {
  const out = [], n = prof.length, m = prof.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]);
  const at = (s, side, zz) => { const w = (wAt(zz) / 2) * side; return P(along === 'u' ? [s, w, zz] : [w, s, zz]); };
  for (let i = 0; i < n; i++) {
    const p = prof[i], q = prof[(i + 1) % n], e = [q[0] - p[0], q[1] - p[1]], nn = norm([e[1], -e[0]]);
    out.push({ corners: [at(p[0], -1, p[1]), at(q[0], -1, q[1]), at(q[0], 1, q[1]), at(p[0], 1, p[1])], out: P(along === 'u' ? [nn[0], 0, nn[1]] : [0, nn[0], nn[1]]), role });
  }
  for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
    const p = prof[i], q = prof[(i + 1) % n];
    out.push({ corners: [at(m[0], side, m[1]), at(p[0], side, p[1]), at(q[0], side, q[1])], out: along === 'u' ? [0, side, 0] : [side, 0, 0], role });
  }
  return out;
}

/** A toy car about (0, 0) at z 0, its length along `along` ('u' x, 'v' y): a shaped body in its paint, a domed cabin
 *  narrower than it (glass, its roof the paint), four round wheels and two headlights. A toon one stubby and tall, its
 *  wheels too big or too small, its cabin a bubble set off its middle, its headlights big round eyes. Its footprint
 *  never past the plain car's (a stall's). Faces carry `hex` (the paint) or a role: tyre, cabin, lamp. */
export function toyCarOf(along, hex, D) {
  const L = 4.1 * (D.toon ? 0.72 + 0.2 * (D.reach - 0.7) / 1.2 : 1), Wd = 1.75, wr = 0.32 * (D.toon ? (D.lid < 1 ? 0.75 : 1.35) : 1), hb = 0.95 * (D.toon ? D.height * 0.45 + 0.55 : 1);
  const h = L / 2, z0 = Math.max(0.18, wr * 0.6), cab = (D.toon ? D.head * 0.22 + 0.4 : 0.55) * 0.9, sh = D.toon ? (D.bend * 0.35) : 0;
  // the body: bumpers, the hood falling to the front, the trunk to the back
  const body = [[-h, z0], [h, z0], [h, hb * 0.62], [h - 0.25, hb * 0.82], [h * 0.35, hb], [-h * 0.55, hb], [-h + 0.2, hb * 0.86], [-h, hb * 0.66]];
  const out = extrude(body, (zz) => Wd * (zz > hb * 0.7 ? 0.97 : 1), along, 'car').map((f) => ({ ...f, hex }));
  // the cabin: a dome over the body's middle, set off it in a toon register, its glass under a roof of the paint
  const c0 = -h * 0.5 + sh, c1 = h * 0.3 + sh, top = hb + cab;
  const cabin = [[c0, hb], [c1, hb], [c1 - 0.45, top - 0.08], [c1 - 0.7, top], [c0 + 0.45, top], [c0 + 0.1, top - 0.12]];
  out.push(...extrude(cabin, (zz) => Wd * (0.9 - 0.18 * (zz - hb) / Math.max(0.1, cab)), along, 'cabin'));
  out.push(...extrude([[c0 + 0.4, top - 0.01], [c1 - 0.68, top - 0.01], [c1 - 0.7, top + 0.05], [c0 + 0.45, top + 0.05]], () => Wd * 0.72, along, 'car').map((f) => ({ ...f, hex })));
  // the wheels: round, across the car at its axles
  const ax = h - Math.max(0.65, wr + 0.3), W2 = Wd / 2 + 0.02;
  for (const s of [-ax, ax]) for (const side of [-1, 1]) {
    const c = (w) => P(along === 'u' ? [s, w, wr] : [w, s, wr]), a = along === 'u' ? [0, 1, 0] : [1, 0, 0];
    out.push(...tube([{ c: c(side * (W2 - 0.24)), r: wr, a }, { c: c(side * W2), r: wr, a }], 10, 'tyre', side < 0 ? [true, false] : [false, true]).map((f) => ({ ...f, hex: TYRE })));
  }
  // its headlights: two discs on its front, a toon one's big
  const lr = 0.09 * (D.toon ? D.head * 0.9 : 1);
  for (const side of [-0.55, 0.55]) {
    const c = P(along === 'u' ? [h + 0.01, side * Wd * 0.8 / 2 * 1.4, hb * 0.66] : [side * Wd * 0.8 / 2 * 1.4, h + 0.01, hb * 0.66]), a = along === 'u' ? [1, 0, 0] : [0, 1, 0];
    out.push(...tube([{ c, r: lr, a }, { c: P(along === 'u' ? [c[0] + 0.03, c[1], c[2]] : [c[0], c[1] + 0.03, c[2]]), r: lr, a }], 10, 'lamp', [false, true]).map((f) => ({ ...f, hex: HEADLAMP })));
  }
  return out;
}
