/**
 * A PASSAGE — one edge of a network built: a box section (network/sections.js) along a path of straight legs square to
 * the axes, from one node's way out to another's (a concourse's, a basement's, a portal's), turning at square junctions,
 * its floor following the ground over it at its cover.
 *
 * Its floor is the highest that keeps the section's cover under what stands over it along its whole width and run (the
 * section's `cover` under open ground, its `slab` under a building's plaza or floor: `over(x, y)` says which and how high)
 * and climbs no steeper than the section's grade: the constraint's envelope, slope-limited both ways, then held LEVEL
 * through each junction (a turn is never on a ramp) and slope-limited again. It leaves each node's floor level for a
 * landing and climbs from there as the envelope allows; where the envelope stands under the node's floor at the landing's
 * end, a stair takes it down (a section without a stair notes the drop instead).
 *
 *   passageOf({ id, path, a, b, section, over, look, prefix }) → passage
 *     path     [[x, y], …]: its middle, each leg square to the axes, from a's way out (on its outer face) to b's
 *     a, b     each end's way out: { z0 (its floor), lo, hi ([x, y]: its jambs), top (its head over its floor) }
 *     section  a row of network/sections.js (readSection)
 *     over     (x, y) → { z, under: 'ground' | 'slab' }: what stands over a point, and which cover it wants
 *     look     { floor, wall, ceiling: { texture, scale } (tiles), light: a number or { floor, wall, ceiling } (the light
 *              each surface is baked at, a node's own), stripe?: its route's colour }
 *     prefix   its faces' groups' prefix (`<prefix>:tunnel-floor` …)
 *     walkSide a rail tunnel's walkway along its left wall (1, the default) or its right (-1): its finish mirrored
 *   → { id, faces, colliders, line (its middle walked, each point at its floor), length, level (its lowest floor), cover,
 *       slab (each the least it keeps, measured on what was built), grade (its steepest), turns, ends ([{ kind: flat |
 *       ramp | stair, drop, steps? }]), footprint ([[x0, y0, x1, y1]]: its legs and junctions in plan, its walls with
 *       them), top (its ceiling's highest), findings }
 *
 * Its finishes by the section's `finish`: `concourse` (back-painted glass between steel battens over a stainless kick
 * band, a steel frieze, handrails each side, a lit glass strip down its ceiling, a stripe a route), `service` (concrete
 * panels and their joints, a conduit pair along one wall, yellow edge lines, caged lamps), `road` (asphalt, a dashed
 * centre line and edge lines, a raised walkway each side behind a kerb, a tiled band down each wall, a lamp line along
 * each wall's head), `rail` (railFinish: a subway's tracks, its walkway, its walls, columns, a tube's rings). A section's
 * `profile` is its shape across: a box, or a vault (its walls to its springing, an arch over them). A rail tunnel's
 * `line` runs along its walkway, on it where it is raised.
 *
 * Metres, the design's frame (x east, y north, z up). Pure: a passage follows from its path and its ends.
 */
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);

// a stair's most riser and its going, the landing at each end, a wall's thickness (m)
export const STAIR = Object.freeze({ riser: 0.3, going: 0.3 });
const LANDING = 1, WALL = 0.3;

const grey = (g) => { const h = Math.round(255 * Math.max(0.08, Math.min(1, g))).toString(16).padStart(2, '0'); return `#${h}${h}${h}`; };
const tint = (hex, g) => `#${[1, 3, 5].map((i) => Math.round(Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) * g))).toString(16).padStart(2, '0')).join('')}`;

export function passageOf({ id, path, a, b, section: sec, over, look = {}, prefix = 'network', walkSide = 1 }) {
  const hw = sec.width / 2, H = sec.height, findings = [];
  // ── its legs: each a start, a direction, its left, its length and where it lies along the whole ──
  const legs = [];
  let acc = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const A = path[i], B = path[i + 1], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (len < 1e-6) continue;
    const d = [Math.round((B[0] - A[0]) / len), Math.round((B[1] - A[1]) / len)];
    if (Math.abs(Math.hypot(...d) - 1) > 1e-6) throw new Error(`network: passage ${id}'s leg ${i} is not square to the axes`);
    legs.push({ A, B, d, n: [-d[1], d[0]], len, s0: acc, s1: acc + len });
    acc += len;
  }
  const L = acc;
  const turns = legs.slice(1).map((g, i) => ({ at: g.A, s: g.s0, d1: legs[i].d, d2: g.d }));
  for (const [i, g] of legs.entries()) {
    const need = (i === 0 || i === legs.length - 1 ? LANDING + hw : 0) + (i > 0 && i < legs.length - 1 ? sec.width : 0);
    if (legs.length > 1 && g.len < need - 1e-6) findings.push(`the passage ${id}'s leg ${i} is ${r5(g.len)} m, short of the ${need} m its turns and landing want`);
  }
  const legAt = (s) => legs.find((g) => s <= g.s1 + 1e-9) ?? legs[legs.length - 1];
  const pos = (s, v) => { const g = legAt(s), t = s - g.s0; return [g.A[0] + g.d[0] * t + g.n[0] * v, g.A[1] + g.d[1] * t + g.n[1] * v]; };
  const turnAt = (s) => turns.find((c) => s > c.s - hw + 1e-9 && s < c.s + hw - 1e-9) ?? null;
  // ── what stands over it, and the floor that keeps its cover under it ──
  const need = (s) => {
    let lo = Infinity;
    for (const v of [-hw, 0, hw]) { const o = over(...pos(s, v)); lo = Math.min(lo, o.z - (o.under === 'slab' ? sec.slab : sec.cover)); }
    return lo;
  };
  const grid = [...new Set([...Array.from({ length: Math.max(2, Math.ceil(L / 0.5)) + 1 }, (_, i) => (L * i) / Math.max(2, Math.ceil(L / 0.5))), ...turns.flatMap((c) => [c.s - hw, c.s + hw]).filter((s) => s > 0 && s < L)].map(r5))].sort((p, q) => p - q);
  const pass = (F) => {
    for (let i = 1; i < grid.length; i++) F[i] = Math.min(F[i], F[i - 1] + sec.grade * (grid[i] - grid[i - 1]));
    for (let i = grid.length - 2; i >= 0; i--) F[i] = Math.min(F[i], F[i + 1] + sec.grade * (grid[i + 1] - grid[i]));
  };
  // (solved with a margin over the cover it wants: the ground between its samples is measured too)
  const env = grid.map((s) => need(s) - 0.05 - H);
  pass(env);
  // (a rail tunnel holds the line between its two track levels, deeper only where its cover wants it; a passage climbs
  // toward the ground as its envelope allows)
  const F = grid.map((s, i) => Math.min(env[i], sec.finish === 'rail' ? a.z0 + ((b.z0 - a.z0) * s) / (L || 1) : Infinity, a.z0 + sec.grade * Math.max(0, s - LANDING), b.z0 + sec.grade * Math.max(0, L - s - LANDING)));
  // (level through each turn: its lowest held across the junction, and the slope limit taken again round it)
  for (const c of turns) {
    const idx = grid.map((s, i) => (s >= c.s - hw - 1e-9 && s <= c.s + hw + 1e-9 ? i : -1)).filter((i) => i >= 0), m = Math.min(...idx.map((i) => F[i]));
    for (const i of idx) F[i] = m;
  }
  pass(F);
  const Fat = (s) => {
    let i = grid.findIndex((g) => g >= s - 1e-9);
    if (i <= 0) return F[0];
    const t = (s - grid[i - 1]) / ((grid[i] - grid[i - 1]) || 1);
    return F[i - 1] + (F[i] - F[i - 1]) * t;
  };
  // (a stair from a node's floor down to the envelope: as many treads as keep each riser a riser, from its landing)
  const stairOf = (z, dir) => {
    const from = dir > 0 ? LANDING : L - LANDING;
    if (z - Fat(from) < 1e-3) return null;
    if (!sec.stair) { findings.push(`the passage ${id} falls ${r5(z - Fat(from))} m from its ${dir > 0 ? 'first' : 'last'} landing and its section takes no stair`); return null; }
    for (let m = 1; m < 400; m++) { const end = from + dir * m * STAIR.going, drop = z - Fat(end); if (drop / m <= STAIR.riser + 1e-9) return { from, dir, m, end, drop, rise: drop / m, z }; }
    return null;
  };
  const sa = stairOf(a.z0, 1), sb = stairOf(b.z0, -1);
  for (const [St, c, w] of [[sa, turns[0], 'first'], [sb, turns[turns.length - 1], 'last']]) if (St && c && (St.dir > 0 ? St.end > c.s - hw : St.end < c.s + hw)) findings.push(`the passage ${id}'s ${w} stair runs into its turn`);
  // ── the floor as spans [s0, s1, z0, z1], each inside one leg or one junction: the landings level, a stair's treads
  // level, a junction level, the rest the profile's slope ──
  const spans = [], risers = [];
  const treads = (St) => {
    for (let i = 0; i < St.m; i++) {
      const p = St.from + St.dir * i * STAIR.going, q = p + St.dir * STAIR.going, zt = St.z - (i + 1) * St.rise;
      risers.push([p, St.z - i * St.rise, zt, St.dir]);
      spans.push(St.dir > 0 ? [p, q, zt, zt] : [q, p, zt, zt]);
    }
  };
  const a0 = sa ? (treads(sa), spans.push([0, sa.from, a.z0, a.z0]), sa.end) : 0, b0 = sb ? (treads(sb), spans.push([sb.from, L, b.z0, b.z0]), sb.end) : L;
  const cutsAt = [...new Set([...grid, ...legs.map((g) => g.s0), L, Math.ceil(0)].map(r5))].sort((p, q) => p - q);
  for (let i = 0; i + 1 < cutsAt.length; i++) {
    const p = Math.max(cutsAt[i], a0), q = Math.min(cutsAt[i + 1], b0);
    if (q - p > 1e-6) spans.push([p, q, Fat(p), Fat(q)]);
  }
  // (each span cut at the metre, so the light has corners to land on, and at every leg's and junction's bounds)
  const bounds = [...legs.map((g) => g.s0), ...turns.flatMap((c) => [c.s - hw, c.s + hw])];
  const cut = spans.sort((p, q) => p[0] - q[0]).flatMap(([s0, s1, z0, z1]) => {
    const marks = [s0, ...bounds.filter((x) => x > s0 + 1e-6 && x < s1 - 1e-6), s1], out = [];
    for (let k = 0; k + 1 < marks.length; k++) {
      const p = marks[k], q = marks[k + 1], m = Math.max(1, Math.ceil(q - p - 1e-9));
      for (let j = 0; j < m; j++) { const u0 = p + ((q - p) * j) / m, u1 = p + ((q - p) * (j + 1)) / m, z = (u) => z0 + ((z1 - z0) * (u - s0)) / ((s1 - s0) || 1); out.push([u0, u1, z(u0), z(u1)]); }
    }
    return out;
  });
  const zf = (s) => { const sp = cut.find(([p, q]) => s >= p - 1e-6 && s <= q + 1e-6) ?? cut[cut.length - 1]; return sp[2] + ((sp[3] - sp[2]) * (s - sp[0])) / ((sp[1] - sp[0]) || 1); };
  // the ceiling: over a stair, the line from its top to its foot, everywhere else its floor's, a section's height over it
  const ceil = (s) => {
    for (const St of [sa, sb]) {
      if (!St) continue;
      const t = (s - St.from) * St.dir, len = St.m * STAIR.going;
      if (t >= 0 && t <= len) return St.z - (St.drop * t) / len + H;
    }
    return zf(s) + H;
  };
  // its profile across: a box's walls to its ceiling; a vault's to its springing, an arch (an ellipse's half) over them
  const vault = sec.profile === 'vault', rise = vault ? Math.min(hw, H * 0.6) : 0, spring = H - rise, ARC = 10;
  const arcZ = (v) => (vault ? spring + rise * Math.sqrt(Math.max(0, 1 - (v / hw) ** 2)) : H);
  const arcVs = Array.from({ length: ARC + 1 }, (_, i) => -hw + (2 * hw * i) / ARC);
  const wallTop = (s) => ceil(s) - H + spring;
  // a rail tunnel's walk: its safety walkway, raised a step along its left wall from a metre in at each end
  // (along its left wall, or its right where `walkSide` is -1: toward the platform it meets)
  const ws = walkSide < 0 ? -1 : 1, walk = sec.finish === 'rail' ? { v: hw - 0.5, w: 1, lift: 0.3, s0: 1, s1: L - 1, side: ws } : null;
  // ── its light: lamps down its middle under its ceiling, each surface at its node's light for it (`look.light`) and over
  // it under a lamp (a passage is narrow: the page's occlusion takes more of its light than of a room's) ──
  const lamps = [];
  for (let s = sec.lamp / 2; s < L - 0.5; s += sec.lamp) { const p = pos(s, 0); lamps.push([p[0], p[1], ceil(s) - 0.1]); }
  const near = (p) => { let e = 0; for (const l of lamps) e += Math.max(0, 1 - Math.hypot(l[0] - p[0], l[1] - p[1], l[2] - p[2]) / 7) ** 2; return 0.95 + 0.6 * Math.min(1, e); };
  const base = (surf) => (typeof look.light === 'number' ? look.light : look.light?.[surf] ?? 0.45);
  const faces = [], G = (k) => `${prefix}:tunnel-${k}`;
  /** a face from world corners, wound so its normal points along `n`: lit as its surface (`surf`), or a plain colour
   *  (`hex`) under the lamps; tiled where a tile is given (its uv from `uvOf`) */
  const emit = (cw, n, group, { surf = null, hex = null, g = 1, tile = null, uvOf = null } = {}) => {
    const e1 = [cw[1][0] - cw[0][0], cw[1][1] - cw[0][1], cw[1][2] - cw[0][2]], e2 = [cw[cw.length - 1][0] - cw[0][0], cw[cw.length - 1][1] - cw[0][1], cw[cw.length - 1][2] - cw[0][2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
    const cs = flip ? cw.slice().reverse() : cw, fills = cs.map((p) => (hex ? tint(hex, g * near(p)) : grey(base(surf ?? 'wall') * g * near(p)))), N = P3(n);
    faces.push({ corners: cs.map(P3), normal: N, outNormal: N, group, fill: fills[0], cornerFills: fills, ...(tile?.texture && uvOf ? { texture: tile.texture, textureLit: true, uv: cs.map((p) => uvOf(p).map((x) => r5(x / tile.scale))) } : {}) });
  };
  const at = (s, v, z) => [...pos(s, v), z];
  const legSpans = cut.filter(([p, q]) => !turnAt((p + q) / 2));
  const across = (s, sg) => { const g = legAt(s); return [-sg * g.n[0], -sg * g.n[1], 0]; };
  const along = (s) => { const g = legAt(s); return [g.d[0], g.d[1], 0]; };
  // (a vault's normal at `v` across, facing in toward its axis)
  const inward = (s, v) => { const g = legAt(s), nv = -(v / (hw * hw)), nz = -((arcZ(v) - spring) / (rise * rise || 1)), l = Math.hypot(nv, nz) || 1; return [g.n[0] * nv / l, g.n[1] * nv / l, nz / l]; };
  // its legs: floor, ceiling and walls, span by span
  for (const [p, q, za, zb] of legSpans) {
    const m = (p + q) / 2;
    emit([at(p, -hw, za), at(q, -hw, zb), at(q, hw, zb), at(p, hw, za)], [0, 0, 1], G('floor'), { surf: 'floor', tile: look.floor, uvOf: (w) => [w[0], w[1]] });
    if (!vault) emit([at(p, -hw, ceil(p)), at(q, -hw, ceil(q)), at(q, hw, ceil(q)), at(p, hw, ceil(p))], [0, 0, -1], G('ceiling'), { surf: 'ceiling', tile: look.ceiling, uvOf: (w) => [w[0], w[1]] });
    else for (let k = 0; k < ARC; k++) {
      // (the arch in its segments, each facing in toward its axis)
      const v0 = arcVs[k], v1 = arcVs[k + 1], cz = (u, v) => ceil(u) - H + arcZ(v), N = inward(m, (v0 + v1) / 2);
      emit([at(p, v0, cz(p, v0)), at(q, v0, cz(q, v0)), at(q, v1, cz(q, v1)), at(p, v1, cz(p, v1))], N, G('ceiling'), { surf: 'ceiling', tile: look.ceiling, uvOf: (w) => [w[0] + w[1], w[2]] });
    }
    for (const sg of [-1, 1]) emit([at(p, sg * hw, za), at(q, sg * hw, zb), at(q, sg * hw, wallTop(q)), at(p, sg * hw, wallTop(p))], across(m, sg), G('wall'), { surf: 'wall', tile: look.wall, uvOf: (w) => [w[0] + w[1], w[2]] });
  }
  for (const [s, zHi, zLo, dir] of risers) { const d = along(s); emit([at(s, -hw, zLo), at(s, hw, zLo), at(s, hw, zHi), at(s, -hw, zHi)], [d[0] * dir, d[1] * dir, 0], G('floor'), { surf: 'floor', tile: look.floor, uvOf: (w) => [w[0] + w[1], w[2]] }); }
  // its junctions: a square, level, its floor and its ceiling, a wall on each of its two outer sides
  for (const c of turns) {
    const z = zf(c.s), [x, y] = c.at, sq = [[x - hw, y - hw], [x + hw, y - hw], [x + hw, y + hw], [x - hw, y + hw]];
    emit(sq.map(([px, py]) => [px, py, z]), [0, 0, 1], G('floor'), { surf: 'floor', tile: look.floor, uvOf: (w) => [w[0], w[1]] });
    emit(sq.map(([px, py]) => [px, py, z + H]), [0, 0, -1], G('ceiling'), { surf: 'ceiling', tile: look.ceiling, uvOf: (w) => [w[0], w[1]] });
    for (const e of [c.d1, [-c.d2[0], -c.d2[1]]]) {
      const pp = [-e[1], e[0]], m0 = [x + e[0] * hw - pp[0] * hw, y + e[1] * hw - pp[1] * hw], m1 = [x + e[0] * hw + pp[0] * hw, y + e[1] * hw + pp[1] * hw];
      emit([[...m0, z], [...m1, z], [...m1, z + H], [...m0, z + H]], [-e[0], -e[1], 0], G('wall'), { surf: 'wall', tile: look.wall, uvOf: (w) => [w[0] + w[1], w[2]] });
    }
  }
  // (a vault meets a junction's flat ceiling: the spandrel over its arch, at each of the junction's bounds, facing the leg)
  if (vault) for (const c of turns) for (const [sb, d] of [[c.s - hw, [-c.d1[0], -c.d1[1]]], [c.s + hw, c.d2]]) {
    const z = zf(c.s);
    for (let k = 0; k < ARC; k++) { const v0 = arcVs[k], v1 = arcVs[k + 1]; emit([at(sb, v0, z + arcZ(v0)), at(sb, v1, z + arcZ(v1)), at(sb, v1, z + H), at(sb, v0, z + H)], [d[0], d[1], 0], G('wall'), { surf: 'wall', tile: look.wall, uvOf: (w) => [w[0] + w[1], w[2]] }); }
  }
  // each end: its section round its node's doorway, facing in
  for (const [s, E, dirIn] of [[0, a, 1], [L, b, -1]]) {
    const g = legAt(s), o = pos(s, 0), vOf = (p) => (p[0] - o[0]) * g.n[0] + (p[1] - o[1]) * g.n[1], [vlo, vhi] = [vOf(E.lo), vOf(E.hi)].sort((p, q) => p - q), z = E.z0;
    if (!vault) {
      const strips = [[-hw, vlo, z, z + H], [vhi, hw, z, z + H], [vlo, vhi, z + E.top, z + H]].filter(([p, q, c0, c1]) => q - p > 1e-3 && c1 - c0 > 1e-3);
      for (const [p, q, c0, c1] of strips) emit([at(s, p, c0), at(s, q, c0), at(s, q, c1), at(s, p, c1)], [g.d[0] * dirIn, g.d[1] * dirIn, 0], G('wall'), { surf: 'wall', tile: look.wall, uvOf: (w) => [w[0] + w[1], w[2]] });
    } else {
      // (a vault's end in columns across, each from the floor, or the doorway's head, to the arch)
      const vs = [...new Set([...arcVs, vlo, vhi].filter((v) => v >= -hw - 1e-9 && v <= hw + 1e-9).map(r5))].sort((p, q) => p - q);
      for (let k = 0; k + 1 < vs.length; k++) {
        const v0 = vs[k], v1 = vs[k + 1], inDoor = v0 >= vlo - 1e-6 && v1 <= vhi + 1e-6, b0 = inDoor ? E.top : 0;
        if (v1 - v0 < 1e-3 || Math.max(arcZ(v0), arcZ(v1)) <= b0 + 1e-3) continue;
        emit([at(s, v0, z + b0), at(s, v1, z + b0), at(s, v1, z + Math.max(b0, arcZ(v1))), at(s, v0, z + Math.max(b0, arcZ(v0)))], [g.d[0] * dirIn, g.d[1] * dirIn, 0], G('wall'), { surf: 'wall', tile: look.wall, uvOf: (w) => [w[0] + w[1], w[2]] });
      }
    }
  }
  // (a finish drawn on its walkway's side: mirrored across where the walkway is on the right)
  const atF = ws > 0 ? at : (s, v, z) => at(s, -v, z), acrossF = ws > 0 ? across : (s, sg) => across(s, -sg), inwardF = ws > 0 ? inward : (s, v) => inward(s, -v);
  const extra = finish(sec.finish, { emit, at: atF, legSpans, turns, cut, ceil, zf, across: acrossF, along, hw, H, L, G, look, legAt, sec, vault, arcZ, arcVs, spring, wallTop, inward: inwardF, walk, clear: (s, r = 0.3) => !turns.some((c) => Math.abs(s - c.s) < hw + r) });
  // ── its walls held: a box down each side of each leg (to its junctions' bounds), and each junction's outer sides ──
  const colliders = [...(extra?.colliders ?? []).map((c) => ({ min: P3(c.min), max: P3(c.max), of: `tunnel:${id}:${c.of}` }))];
  const zLo = Math.min(...cut.map((c) => Math.min(c[2], c[3]))), zHi = Math.max(...cut.map(([p, q]) => Math.max(ceil(p), ceil(q))));
  const box = (p, q, of) => colliders.push({ min: P3([Math.min(p[0], q[0]), Math.min(p[1], q[1]), zLo]), max: P3([Math.max(p[0], q[0]), Math.max(p[1], q[1]), zHi]), of: `tunnel:${id}:${of}` });
  const footprint = [];
  legs.forEach((g, i) => {
    const s0 = g.s0 + (i > 0 ? hw : 0), s1 = g.s1 - (i < legs.length - 1 ? hw : 0);
    if (s1 - s0 < 1e-6) return;
    box(at(s0, -hw - WALL, 0), at(s1, -hw, 0), `${i}l`);
    box(at(s0, hw, 0), at(s1, hw + WALL, 0), `${i}r`);
    const p = at(s0, -hw - WALL, 0), q = at(s1, hw + WALL, 0);
    footprint.push(P3([Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]));
  });
  turns.forEach((c, i) => {
    const [x, y] = c.at;
    for (const e of [c.d1, [-c.d2[0], -c.d2[1]]]) {
      const pp = [-e[1], e[0]], R = hw + WALL, p = [x + e[0] * hw - pp[0] * R, y + e[1] * hw - pp[1] * R], q = [x + e[0] * R + pp[0] * R, y + e[1] * R + pp[1] * R];
      box(p, q, `j${i}`);
    }
    footprint.push(P3([x - hw - WALL, y - hw - WALL, x + hw + WALL, y + hw + WALL]));
  });
  // ── measured on what was built: its cover (under open ground and under a slab), its steepest ramp ──
  let cover = Infinity, slab = Infinity;
  for (let s = 0; s <= L + 1e-6; s += 0.5) for (const v of [-hw, 0, hw]) { const o = over(...pos(s, v)), c = o.z - ceil(s); if (o.under === 'slab') slab = Math.min(slab, c); else cover = Math.min(cover, c); }
  const grade = Math.max(0, ...cut.filter(([p, q, za, zb]) => q - p > 1e-6 && Math.abs(zb - za) > 1e-9).map(([p, q, za, zb]) => Math.abs(zb - za) / (q - p)));
  // its middle walked, each point at its floor: from a's way out, over each tread and through each junction, to b's
  const marks = [...new Set([0, ...cut.map((c) => r5((c[0] + c[1]) / 2)), ...turns.map((c) => r5(c.s)), L])].sort((p, q) => p - q);
  // (a rail tunnel's along its walkway, on it where it is raised)
  const line = marks.map((s) => P3(at(s, walk ? ws * walk.v : 0, zf(s) + (walk && s > walk.s0 && s < walk.s1 && !turnAt(s) ? walk.lift : 0))));
  const endOf = (St, z) => (St ? { kind: 'stair', drop: r5(St.drop), steps: St.m } : { kind: Math.abs(Fat(LANDING + 2) - z) > 1e-3 || Math.abs(Fat(L - LANDING - 2) - z) > 1e-3 ? 'ramp' : 'flat', drop: r5(z - Math.min(...F)) });
  return {
    id, faces, colliders, line, length: r5(L), level: r5(Math.min(...F)), cover: r5(cover), slab: r5(slab), grade: r5(grade), turns: turns.length,
    ends: [endOf(sa, a.z0), endOf(sb, b.z0)], footprint, top: r5(zHi), findings,
  };
}

/** A passage's finish, by its section's: what dresses its walls, its floor and its ceiling. */
function finish(kind, { emit, at, legSpans, turns, ceil, zf, across, along, hw, H, L, G, look, clear, legAt, vault, arcZ, arcVs, wallTop, inward, walk }) {
  // (a plain strip along a wall: `v` its line off the middle, from `z0` to `z1` over the floor, `d` off the wall)
  const band = (p, q, za, zb, sg, d, z0, z1, group, hex, g = 1) => emit([at(p, sg * (hw - d), za + z0), at(q, sg * (hw - d), zb + z0), at(q, sg * (hw - d), zb + z1), at(p, sg * (hw - d), za + z1)], across((p + q) / 2, sg), group, { hex, g });
  const flat = (p, q, za, zb, v0, v1, lift, group, hex, g = 1, n = [0, 0, 1]) => emit([at(p, v0, za + lift), at(q, v0, zb + lift), at(q, v1, zb + lift), at(p, v1, za + lift)], n, group, { hex, g });
  const turnWalls = (fn) => { for (const c of turns) for (const e of [c.d1, [-c.d2[0], -c.d2[1]]]) fn(c, e); };
  const junctionBand = (c, e, d, z0, z1, group, hex, g = 1) => {
    const [x, y] = c.at, z = zf(c.s), pp = [-e[1], e[0]], o = hw - d, m0 = [x + e[0] * o - pp[0] * hw, y + e[1] * o - pp[1] * hw], m1 = [x + e[0] * o + pp[0] * hw, y + e[1] * o + pp[1] * hw];
    emit([[...m0, z + z0], [...m1, z + z0], [...m1, z + z1], [...m0, z + z1]], [-e[0], -e[1], 0], group, { hex, g });
  };
  if (kind === 'concourse') {
    // back-painted glass between steel battens over a stainless kick band, a brushed steel frieze, a handrail each side,
    // a lit glass strip down the ceiling's middle in a steel edge; a stripe a route down the floor
    for (const [p, q, za, zb] of legSpans) for (const sg of [-1, 1]) {
      band(p, q, za, zb, sg, 0.02, 0, 0.15, G('steel'), '#7a7f86', 0.9);
      band(p, q, za, zb, sg, 0.03, 0.15, 2.45, G('glass'), '#b9c4ca', 0.62);
      emit([at(p, sg * (hw - 0.03), za + 2.45), at(q, sg * (hw - 0.03), zb + 2.45), at(q, sg * (hw - 0.03), ceil(q) - 0.01), at(p, sg * (hw - 0.03), ceil(p) - 0.01)], across((p + q) / 2, sg), G('steel'), { hex: '#8a9096', g: 0.7 });
      flat(p, q, za, zb, sg * (hw - 0.17), sg * (hw - 0.12), 0.95, G('steel'), '#b4b9be');
      band(p, q, za, zb, sg, 0.17, 0.9, 0.95, G('steel'), '#9aa0a6');
    }
    for (let s = 2.4; s < L - 0.3; s += 2.4) for (const sg of [-1, 1]) { if (!clear(s)) continue; const z = zf(s); emit([at(s - 0.04, sg * (hw - 0.07), z + 0.15), at(s + 0.04, sg * (hw - 0.07), z + 0.15), at(s + 0.04, sg * (hw - 0.07), z + 2.45), at(s - 0.04, sg * (hw - 0.07), z + 2.45)], across(s, sg), G('steel'), { hex: '#8a9096' }); }
    turnWalls((c, e) => { junctionBand(c, e, 0.02, 0, 0.15, G('steel'), '#7a7f86', 0.9); junctionBand(c, e, 0.03, 0.15, 2.45, G('glass'), '#b9c4ca', 0.62); junctionBand(c, e, 0.03, 2.45, H - 0.01, G('steel'), '#8a9096', 0.7); junctionBand(c, e, 0.17, 0.9, 0.95, G('steel'), '#9aa0a6'); });
    for (const [p, q] of legSpans) {
      emit([at(p, -0.35, ceil(p) - 0.03), at(q, -0.35, ceil(q) - 0.03), at(q, 0.35, ceil(q) - 0.03), at(p, 0.35, ceil(p) - 0.03)], [0, 0, -1], G('lamp'), { hex: '#f4f8fb', g: 1.6 });
      for (const e of [-0.42, 0.35]) emit([at(p, e, ceil(p) - 0.04), at(q, e, ceil(q) - 0.04), at(q, e + 0.07, ceil(q) - 0.04), at(p, e + 0.07, ceil(p) - 0.04)], [0, 0, -1], G('steel'), { hex: '#6c7176' });
    }
    for (const c of turns) { const [x, y] = c.at, z = zf(c.s) + H - 0.03; emit([[x - 0.35, y - 0.35, z], [x + 0.35, y - 0.35, z], [x + 0.35, y + 0.35, z], [x - 0.35, y + 0.35, z]], [0, 0, -1], G('lamp'), { hex: '#f4f8fb', g: 1.6 }); }
    if (look.stripe) {
      for (const [p, q, za, zb] of legSpans) flat(p, q, za, zb, -0.15, 0.15, 0.012, G('stripe'), look.stripe, 0.8);
      for (const c of turns) { const [x, y] = c.at, z = zf(c.s) + 0.012; for (const [d, s] of [[c.d1, -1], [c.d2, 1]]) { const p0 = [x + s * d[0] * hw, y + s * d[1] * hw], lo = [Math.min(x, p0[0]) - (d[0] ? 0 : 0.15), Math.min(y, p0[1]) - (d[1] ? 0 : 0.15)], hi = [Math.max(x, p0[0]) + (d[0] ? 0 : 0.15), Math.max(y, p0[1]) + (d[1] ? 0 : 0.15)]; emit([[lo[0], lo[1], z], [hi[0], lo[1], z], [hi[0], hi[1], z], [lo[0], hi[1], z]], [0, 0, 1], G('stripe'), { hex: look.stripe, g: 0.8 }); } }
    }
  } else if (kind === 'service') {
    // concrete panels and their joints, a conduit pair along one wall's head, yellow edge lines, caged lamps
    for (const [p, q, za, zb] of legSpans) {
      for (const sg of [-1, 1]) band(p, q, za, zb, sg, 0.02, 0, H - 0.05, G('concrete'), '#a29e96', 0.8);
      for (const k of [0, 1]) band(p, q, za, zb, 1, 0.12 + k * 0.1, H - 0.45 - k * 0.12, H - 0.37 - k * 0.12, G('conduit'), k ? '#6d7a86' : '#8a7e5a', 0.85);
      for (const sg of [-1, 1]) flat(p, q, za, zb, sg * (hw - 0.3), sg * (hw - 0.2), 0.01, G('stripe'), '#d8b23a', 0.8);
    }
    for (let s = 3; s < L - 0.3; s += 3) for (const sg of [-1, 1]) { if (!clear(s)) continue; const z = zf(s); emit([at(s - 0.015, sg * (hw - 0.03), z), at(s + 0.015, sg * (hw - 0.03), z), at(s + 0.015, sg * (hw - 0.03), z + H - 0.05), at(s - 0.015, sg * (hw - 0.03), z + H - 0.05)], across(s, sg), G('concrete'), { hex: '#6e6a64', g: 0.8 }); }
    turnWalls((c, e) => junctionBand(c, e, 0.02, 0, H - 0.05, G('concrete'), '#a29e96', 0.8));
    for (let s = 2.5; s < L - 0.5; s += 5) { if (!clear(s, 0)) continue; const z = ceil(s) - 0.06; emit([at(s - 0.4, -0.12, z), at(s + 0.4, -0.12, z), at(s + 0.4, 0.12, z), at(s - 0.4, 0.12, z)], [0, 0, -1], G('lamp'), { hex: '#f6f2e2', g: 1.5 }); }
  } else if (kind === 'road') {
    // asphalt, a dashed centre line and an edge line each side, a raised walkway each side behind its kerb, a tiled band
    // down each wall, a lamp line along each wall's head
    const walk = Math.min(1.2, hw * 0.25), kerb = 0.15;
    for (const [p, q, za, zb] of legSpans) {
      flat(p, q, za, zb, -hw + walk, hw - walk, 0.004, G('asphalt'), '#3a3b3e', 0.8);
      for (const sg of [-1, 1]) {
        flat(p, q, za, zb, sg * (hw - walk - 0.35), sg * (hw - walk - 0.2), 0.008, G('stripe'), '#e8e8e2', 0.9);
        // (the walkway: its top a kerb over the road, its kerb's face)
        flat(p, q, za, zb, sg * (hw - walk), sg * hw, kerb, G('walkway'), '#9a968e', 0.85);
        emit([at(p, sg * (hw - walk), za), at(q, sg * (hw - walk), zb), at(q, sg * (hw - walk), zb + kerb), at(p, sg * (hw - walk), za + kerb)], across((p + q) / 2, -sg), G('walkway'), { hex: '#b4b0a6', g: 0.85 });
        band(p, q, za, zb, sg, 0.02, kerb, 3.2, G('tile'), '#d8dcdc', 0.75);
        band(p, q, za, zb, sg, 0.03, 3.2, 3.45, G('tile'), look.stripe ?? '#2f6f8a', 0.85);
        band(p, q, za, zb, sg, 0.04, H - 0.35, H - 0.25, G('lamp'), '#fff4d6', 1.5);
      }
    }
    for (let s = 2; s < L - 3; s += 9) { if (!clear(s) || !clear(s + 3)) continue; const z = zf(s); flat(s, s + 3, z, zf(s + 3), -0.08, 0.08, 0.009, G('stripe'), '#e8e8e2', 0.9); }
    turnWalls((c, e) => junctionBand(c, e, 0.02, 0, 3.2, G('tile'), '#d8dcdc', 0.75));
  } else if (kind === 'rail') return railFinish({ emit, at, legSpans, zf, across, along, hw, H, L, G, look, clear, legAt, vault, arcZ, arcVs, wallTop, inward, walk });
}

// a rail's measures (m): standard gauge, a rail's head and its height, a sleeper's length, depth, height and spacing,
// the third rail off its track and its height, the cover board over it, a column's side and spacing between two tracks
const RAIL = Object.freeze({ gauge: 1.435, head: 0.07, rail: 0.17, sleeper: [2.5, 0.24, 0.14], every: 0.7, third: 1.55, thirdTop: 0.4, board: 0.28, column: 0.5, columns: 5, signals: 120, lamps: 10 });

/**
 * A rail tunnel's finish (a section whose finish is `rail`): its tracks across the floor beside its walkway (two where it
 * is wide enough, the line of columns between them in a box; one in a tube), each a concrete bed, sleepers, two running
 * rails at standard gauge and a third rail on insulators under its cover board; the walkway raised a step along its left
 * wall, its edge lined yellow, a handrail on the wall over it; the walls sooted toward the track, cable trays along them
 * on brackets, bulkhead lamps between them, a signal now and then over the walkway; a box's soffit dark, a tube's rings.
 * → { colliders } (its columns, its walkway's edge where it runs).
 */
function railFinish({ emit, at, legSpans, zf, across, along, hw, H, L, G, look, clear, legAt, vault, arcZ, arcVs, wallTop, inward, walk }) {
  const colliders = [];
  const flat = (p, q, za, zb, v0, v1, lift, group, hex, g = 1) => emit([at(p, v0, za + lift), at(q, v0, zb + lift), at(q, v1, zb + lift), at(p, v1, za + lift)], [0, 0, 1], group, { hex, g });
  // (a face square to the run at `s`, between v0 and v1, from z0 to z1 over the floor, facing along `dir`)
  const cross = (s, v0, v1, z0, z1, dir, group, hex, g = 1) => { const z = zf(s), d = along(s); emit([at(s, v0, z + z0), at(s, v1, z + z0), at(s, v1, z + z1), at(s, v0, z + z1)], [d[0] * dir, d[1] * dir, 0], group, { hex, g }); };
  // (a face along the run at `v` across, from z0 to z1 over the floor, facing toward +v or -v)
  const side = (p, q, za, zb, v, z0, z1, sg, group, hex, g = 1) => emit([at(p, v, za + z0), at(q, v, zb + z0), at(q, v, zb + z1), at(p, v, za + z1)], across((p + q) / 2, -sg), group, { hex, g });
  // (a little box on the floor at s: its top and its four sides)
  const block = (s, v0, v1, ds, z0, z1, group, hex, g = 1) => {
    flat(s - ds, s + ds, zf(s - ds), zf(s + ds), v0, v1, z1, group, hex, g);
    cross(s - ds, v0, v1, z0, z1, -1, group, hex, g * 0.8); cross(s + ds, v0, v1, z0, z1, 1, group, hex, g * 0.8);
    side(s - ds, s + ds, zf(s - ds), zf(s + ds), v0, z0, z1, -1, group, hex, g * 0.7); side(s - ds, s + ds, zf(s - ds), zf(s + ds), v1, z0, z1, 1, group, hex, g * 0.7);
  };
  // the tracks: across what the walkway leaves, two where each has 4 m, the column line between them in a box
  const free0 = -hw, free1 = hw - walk.w, n = !vault && free1 - free0 >= 8 ? 2 : 1, each = (free1 - free0) / n;
  const tracks = Array.from({ length: n }, (_, i) => free0 + each * (i + 0.5)), colAt = n === 2 ? free0 + each : null;
  const run = (fn) => { for (const [p, q, za, zb] of legSpans) fn(p, q, za, zb); };
  for (const vt of tracks) layTrack({ emit, at, zf, along, across, clear, L, G, run }, vt, -1);
  return railRest({ emit, at, legSpans, zf, across, along, hw, H, L, G, look, clear, legAt, vault, arcZ, arcVs, wallTop, inward, walk, run, flat, cross, side, colAt, colliders });
}

/**
 * A track laid along a run (a rail tunnel's, a station's): its concrete bed and drain, two running rails at standard
 * gauge on sleepers, its third rail outboard toward `third` (-1 the -v side, +1 the +v side) on insulators under its
 * cover board. `ctx` the run's own frame: `at(s, v, z)`, `zf(s)` its floor, `along`, `across`, `clear(s, r)` (where a
 * detail may stand), `run(fn)` over its spans [p, q, za, zb], `emit`, `G(name)` its groups, `L` its length.
 */
export function layTrack(ctx, vt, third = -1) {
  const { emit, at, zf, along, across, clear, L, G, run } = ctx;
  const flat = (p, q, za, zb, v0, v1, lift, group, hex, g = 1) => emit([at(p, v0, za + lift), at(q, v0, zb + lift), at(q, v1, zb + lift), at(p, v1, za + lift)], [0, 0, 1], group, { hex, g });
  const cross = (s, v0, v1, z0, z1, dir, group, hex, g = 1) => { const z = zf(s), d = along(s); emit([at(s, v0, z + z0), at(s, v1, z + z0), at(s, v1, z + z1), at(s, v0, z + z1)], [d[0] * dir, d[1] * dir, 0], group, { hex, g }); };
  const side = (p, q, za, zb, v, z0, z1, sg, group, hex, g = 1) => emit([at(p, v, za + z0), at(q, v, zb + z0), at(q, v, zb + z1), at(p, v, za + z1)], across((p + q) / 2, -sg), group, { hex, g });
  const block = (s, v0, v1, ds, z0, z1, group, hex, g = 1) => {
    flat(s - ds, s + ds, zf(s - ds), zf(s + ds), v0, v1, z1, group, hex, g);
    cross(s - ds, v0, v1, z0, z1, -1, group, hex, g * 0.8); cross(s + ds, v0, v1, z0, z1, 1, group, hex, g * 0.8);
    side(s - ds, s + ds, zf(s - ds), zf(s + ds), v0, z0, z1, -1, group, hex, g * 0.7); side(s - ds, s + ds, zf(s - ds), zf(s + ds), v1, z0, z1, 1, group, hex, g * 0.7);
  };
  {
    run((p, q, za, zb) => {
      // (its bed: a darker concrete slab, a drain down its middle)
      flat(p, q, za, zb, vt - 1.45, vt + 1.45, 0.004, G('trackbed'), '#5a5650', 0.85);
      flat(p, q, za, zb, vt - 0.12, vt + 0.12, 0.006, G('trackbed'), '#2e2c2a', 0.8);
      // (the running rails: a bright head on a dark web, standing on the sleepers)
      for (const r of [-RAIL.gauge / 2, RAIL.gauge / 2]) {
        const z0 = RAIL.sleeper[2], z1 = z0 + RAIL.rail;
        flat(p, q, za, zb, vt + r - RAIL.head / 2, vt + r + RAIL.head / 2, z1, G('rail'), '#c9cdd1', 1.1);
        for (const sg of [-1, 1]) side(p, q, za, zb, vt + r + sg * RAIL.head / 2, z0, z1, sg, G('rail'), '#5e564e', 0.9);
      }
      // (the third rail, outboard, and its cover board over it)
      const v3 = vt + third * RAIL.third;
      flat(p, q, za, zb, v3 - 0.05, v3 + 0.05, RAIL.thirdTop, G('third-rail'), '#8d9298', 0.9);
      side(p, q, za, zb, v3 - third * 0.05, RAIL.thirdTop - 0.12, RAIL.thirdTop, -third, G('third-rail'), '#6a6e72', 0.8);
      flat(p, q, za, zb, v3 - RAIL.board / 2, v3 + RAIL.board / 2, RAIL.thirdTop + 0.1, G('third-rail'), '#cdb45c', 0.85);
    });
    // (the sleepers, and the third rail's insulators every fourth)
    let k = 0;
    for (let s = RAIL.every / 2; s < L - 0.2; s += RAIL.every, k++) {
      if (!clear(s, 0.4)) continue;
      block(s, vt - RAIL.sleeper[0] / 2, vt + RAIL.sleeper[0] / 2, RAIL.sleeper[1] / 2, 0, RAIL.sleeper[2], G('sleeper'), '#7a746b', 0.8);
      if (k % 4 === 0) block(s, vt + third * RAIL.third - 0.06, vt + third * RAIL.third + 0.06, 0.06, 0, RAIL.thirdTop - 0.12, G('third-rail'), '#e6e1d4', 0.9);
    }
  }
}

/** The rest of a rail tunnel's finish: its walkway, walls, lamps, signals, columns, rings. */
function railRest({ emit, at, legSpans, zf, across, along, hw, H, L, G, look, clear, legAt, vault, arcZ, arcVs, wallTop, inward, walk, run, flat, cross, side, colAt, colliders }) {
  // the walkway: raised a step along the left wall from a metre in, its kerb, its yellow edge, a handrail on the wall
  run((p0, q0, za0, zb0) => {
    const p = Math.max(p0, walk.s0), q = Math.min(q0, walk.s1);
    if (q - p < 1e-6) return;
    const za = zf(p), zb = zf(q), e = hw - walk.w;
    flat(p, q, za, zb, e, hw, walk.lift, G('walkway'), '#8e8a82', 0.85);
    side(p, q, za, zb, e, 0, walk.lift, -1, G('walkway'), '#a6a198', 0.8);
    flat(p, q, za, zb, e + 0.02, e + 0.1, walk.lift + 0.004, G('stripe'), '#e2c23e', 0.9);
    emit([at(p, hw - 0.06, za + walk.lift + 0.95), at(q, hw - 0.06, zb + walk.lift + 0.95), at(q, hw - 0.06, zb + walk.lift + 1.0), at(p, hw - 0.06, za + walk.lift + 1.0)], across((p + q) / 2, 1), G('rail-hand'), { hex: '#a8adb2', g: 1 });
  });
  // (its ends where it rises and falls a step: their faces)
  for (const [s, dir] of [[walk.s0, -1], [walk.s1, 1]]) if (clear(s, 0)) cross(s, hw - walk.w, hw, 0, walk.lift, dir, G('walkway'), '#a6a198', 0.8);
  // the walls: soot to a man's height, concrete over it, cable trays on brackets along both, lamps between
  run((p, q, za, zb) => {
    for (const sg of [-1, 1]) {
      const top = (u) => wallTop(u) - zf(u);
      emit([at(p, sg * (hw - 0.01), za), at(q, sg * (hw - 0.01), zb), at(q, sg * (hw - 0.01), zb + 1.4), at(p, sg * (hw - 0.01), za + 1.4)], across((p + q) / 2, sg), G('soot'), { hex: '#4b4844', g: 0.85 });
      emit([at(p, sg * (hw - 0.01), za + 1.4), at(q, sg * (hw - 0.01), zb + 1.4), at(q, sg * (hw - 0.01), zb + top(q)), at(p, sg * (hw - 0.01), za + top(p))], across((p + q) / 2, sg), G('concrete'), { hex: '#8c8882', g: 0.8 });
      for (let c = 0; c < 3; c++) {
        const zc = Math.min(top(p), top(q)) - 0.6 - c * 0.14;
        if (zc < 1.6) continue;
        flat(p, q, za, zb, sg * (hw - 0.32), sg * (hw - 0.04), zc, G('cable'), c === 1 ? '#3a3632' : '#262628', 0.9);
      }
    }
    // (a box's soffit: soot over the trains)
    if (!vault) emit([at(p, -hw, za + H - 0.01), at(q, -hw, zb + H - 0.01), at(q, hw, zb + H - 0.01), at(p, hw, za + H - 0.01)], [0, 0, -1], G('soffit'), { hex: '#3a3835', g: 0.9 });
  });
  for (let s = 1.5; s < L - 0.5; s += 1.5) {
    if (!clear(s, 0.2)) continue;
    const top = wallTop(s) - zf(s), zc = top - 0.6;
    if (zc < 1.6) continue;
    for (const sg of [-1, 1]) cross(s, sg * (hw - 0.34), sg * (hw - 0.01), zc - 0.36, zc - 0.3, 1, G('cable'), '#55524e', 0.8);
  }
  for (let s = RAIL.lamps / 2; s < L - 1; s += RAIL.lamps) {
    if (!clear(s, 0.5)) continue;
    const zl = Math.min(3.0, wallTop(s) - zf(s) - 0.3), z = zf(s);
    for (const sg of [-1, 1]) emit([at(s - 0.3, sg * (hw - 0.05), z + zl - 0.12), at(s + 0.3, sg * (hw - 0.05), z + zl - 0.12), at(s + 0.3, sg * (hw - 0.05), z + zl + 0.12), at(s - 0.3, sg * (hw - 0.05), z + zl + 0.12)], across(s, sg), G('lamp'), { hex: '#fff0c8', g: 1.6 });
  }
  // (a signal on the wall over the walkway: its black head and its aspect)
  for (let s = RAIL.signals / 2; s < L - 2; s += RAIL.signals) {
    if (!clear(s, 1)) continue;
    const z = zf(s) + Math.min(2.6, wallTop(s) - zf(s) - 0.8), plate = (s0, s1, z0, z1, v, group, hex, g) => emit([at(s0, v, z0), at(s1, v, z0), at(s1, v, z1), at(s0, v, z1)], across(s, 1), group, { hex, g });
    plate(s - 0.17, s + 0.17, z, z + 0.7, hw - 0.04, G('signal'), '#1c1d20', 1);
    plate(s - 0.07, s + 0.07, z + 0.46, z + 0.6, hw - 0.05, G('lamp'), '#e2382a', 1.6);
    plate(s - 0.07, s + 0.07, z + 0.1, z + 0.24, hw - 0.05, G('signal'), '#2f5a36', 1);
  }
  // a box's columns between its two tracks; a tube's rings round its vault
  if (colAt !== null) for (let s = RAIL.columns / 2; s < L - 1; s += RAIL.columns) {
    if (!clear(s, 0.6)) continue;
    const c = RAIL.column / 2, z = zf(s), top = wallTop(s) - z;
    cross(s - c, colAt - c, colAt + c, 0, top, -1, G('column'), '#8a857d', 0.8);
    cross(s + c, colAt - c, colAt + c, 0, top, 1, G('column'), '#8a857d', 0.8);
    side(s - c, s + c, z, zf(s + c), colAt - c, 0, top, -1, G('column'), '#9a958d', 0.85);
    side(s - c, s + c, z, zf(s + c), colAt + c, 0, top, 1, G('column'), '#9a958d', 0.85);
    const a = at(s - c, colAt - c, z), b = at(s + c, colAt + c, z + top);
    colliders.push({ min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), z], max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), z + top], of: `column-${Math.round(s * 10)}` });
  }
  if (vault) for (let s = 0.6; s < L - 0.3; s += 1.2) {
    if (!clear(s, 0.2)) continue;
    const z = zf(s);
    for (let k = 0; k < arcVs.length - 1; k++) {
      const v0 = arcVs[k] * 0.985, v1 = arcVs[k + 1] * 0.985, N = inward(s, (v0 + v1) / 2), z0 = z + arcZ(arcVs[k]) - 0.04, z1 = z + arcZ(arcVs[k + 1]) - 0.04;
      emit([at(s - 0.07, v0, z0), at(s + 0.07, v0, z0), at(s + 0.07, v1, z1), at(s - 0.07, v1, z1)], N, G('ring'), { hex: '#3f3c38', g: 0.9 });
    }
  }
  return { colliders };
}
