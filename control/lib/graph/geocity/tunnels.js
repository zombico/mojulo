/**
 * THE TUNNELS UNDER THE STREETS — the geocity's walked-in podiums (geocity/podium.js) joined below grade: a passage from
 * one concourse to the next under the street between their blocks, the network a northern downtown keeps out of the
 * weather. Its own geometry (a lit box section), not a room-kit stage: a stage's floors are level and its storeys
 * stepped, and a passage under a street follows the street's grade down to its cover and back up to each concourse.
 *
 *   TUNNEL                               its numbers: its section (width, height), its cover under the street, the
 *                                        steepest ramp (1:12), a stair's riser and going, its lamps' spacing, the longest
 *                                        run between two concourses (a law), how far apart two blocks may stand across
 *                                        the street it crosses
 *   tunnelEdges(nodes, blocks) → edges   the passages a network lays: each two concourses whose blocks face each other
 *                                        across one street, their concourses overlapping along it by a doorway and its
 *                                        frames, nothing else standing between them: [{ a, b, axis, u, sideA, sideB }]
 *                                        (`axis` the one it runs along, `u` its middle across it, `sideA` / `sideB` the
 *                                        walls of the concourses it leaves through)
 *   tunnelOf(edge, A, B, ctx) → tunnel   one passage between two concourses' ways out (podium.js `ports`), `ctx` the
 *                                        land (`S`), the two blocks' rects and the concourse's look: { faces, colliders,
 *                                        line (its middle, each point at its floor), length, level, cover, grade, steps,
 *                                        cuts (the plan rects under its blocks where the land's drape must go) }
 *   networkLaws(nodes, tunnels)          reached (every concourse from every other), cover (under the street and the
 *                                        plazas), grade
 *                                        (the steepest ramp), run (the longest passage): [{ law, ok, value, want }]
 *
 * Metres, the design's frame (x east, y north, z up). Pure: no dice (a passage follows from its two concourses).
 */
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);

export const TUNNEL = Object.freeze({
  width: 4, height: 3,
  // the least earth (and paving) over its ceiling under a street, and under a plaza (m); the steepest ramp; a stair's
  // most riser and going
  cover: 1, slab: 0.3, grade: 1 / 12, riser: 0.3, going: 0.3,
  // a level landing before its ramp or stair at each concourse (m); its lamps along its middle (m); a wall's thickness
  landing: 1, lamp: 6, wall: 0.3,
  // the longest passage between two concourses (m: a law, advice), and the widest street it crosses
  longest: 120, gap: 80,
});
// a concourse way's frame each side (era/stage.js STAGE_KITS: the bay kit's door frame), so a way stands on its wall
const FRAME = 0.3;
const SIDES = [['+x', '-x'], ['+y', '-y']];

/** The passages a network lays over its concourses. `nodes`: [{ id, rect (its block's), concourse (its room's inside in
 *  the world, [x0, y0, x1, y1]), width (its doorway) }]; `blocks`: every other block's rect a passage may not pass under
 *  (the blocks between two concourses: a passage crosses one street, never a block). */
export function tunnelEdges(nodes, blocks = []) {
  const edges = [], used = new Map();
  const free = (id, side, lo, hi) => (used.get(`${id}${side}`) ?? []).every(([a, b]) => hi + 1 <= a || lo - 1 >= b);
  for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) {
    if (i === j) continue;
    const A = nodes[i], B = nodes[j];
    for (const k of [0, 1]) {
      // B beyond A along k, across one street
      const gap = B.rect[k] - A.rect[k + 2];
      if (!(gap > 0 && gap <= TUNNEL.gap)) continue;
      const o = 1 - k, half = TUNNEL.width / 2, door = Math.max(A.width, B.width);
      const lo = Math.max(A.concourse[o], B.concourse[o]) + FRAME + door / 2, hi = Math.min(A.concourse[o + 2], B.concourse[o + 2]) - FRAME - door / 2;
      if (hi < lo) continue;
      const u = r5((lo + hi) / 2);
      // (nothing between them: no other block under its run)
      const run = [A.concourse[k + 2], B.concourse[k]], R = k === 0 ? [run[0], u - half, run[1], u + half] : [u - half, run[0], u + half, run[1]];
      if (blocks.some((q) => q !== A.rect && q !== B.rect && q[0] < R[2] && q[2] > R[0] && q[1] < R[3] && q[3] > R[1])) continue;
      const [sideA, sideB] = SIDES[k];
      if (!free(A.id, sideA, u - half, u + half) || !free(B.id, sideB, u - half, u + half)) continue;
      for (const [id, s] of [[A.id, sideA], [B.id, sideB]]) used.set(`${id}${s}`, [...(used.get(`${id}${s}`) ?? []), [u - half, u + half]]);
      edges.push({ a: A.id, b: B.id, axis: k === 0 ? 'x' : 'y', u, sideA, sideB });
    }
  }
  return edges;
}

/**
 * One passage, from A's way out to B's (podium.js `ports`: { plane, lo, hi, z0, top }), along `edge.axis` at `edge.u`.
 * Its floor is the highest that keeps its cover over its whole width and run (`cover` under the street's land, `slab`
 * under a block's plaza) and climbs no steeper than a ramp: the constraint's envelope, slope-limited both ways. It meets
 * each concourse's floor at a level landing and climbs from there as the envelope allows; where the envelope stands
 * under a concourse's floor at the landing's end, a stair takes it down. `ctx`: { S (the land under a point), top (a
 * block's plaza under a point), rectA, rectB (the two blocks), look: { floor, wall, ceiling: { texture, scale }, light }
 * (the concourse's: its tiles and the light its floor is baked at) }.
 */
export function tunnelOf(edge, A, B, ctx) {
  const { S, top: topOf = null, rectA, rectB, look } = ctx, k = edge.axis === 'x' ? 0 : 1, o = 1 - k, u = edge.u, half = TUNNEL.width / 2, H = TUNNEL.height;
  const s0 = A.plane, L = r5(B.plane - A.plane), at = (s, v) => { const p = [0, 0]; p[k] = s0 + s; p[o] = v; return p; };
  // what stands over it: the street between the blocks (its land, `cover` under it), each block's plaza (`topOf`, a
  // slab's cover under it)
  const st0 = rectA[k + 2] - s0, st1 = rectB[k] - s0, inStreet = (s) => s >= st0 - 1e-6 && s <= st1 + 1e-6;
  const over = (s) => Math.min(...[u - half, u, u + half].map((v) => { const p = at(s, v); return inStreet(s) || !topOf ? S(...p) : topOf(...p); }));
  const coverAt = (s) => (inStreet(s) ? TUNNEL.cover : TUNNEL.slab);
  // its floor: the highest that keeps its cover over its whole run and climbs no steeper than a ramp (the constraint's
  // envelope, a forward and a backward pass), meeting each concourse at its landing; where the envelope stands under a
  // concourse's floor at the landing's end, a stair down to it
  const ds = 0.5, n = Math.max(2, Math.ceil(L / ds)), ss = Array.from({ length: n + 1 }, (_, i) => (L * i) / n), g = TUNNEL.grade * (L / n);
  // (solved with a margin over the cover it wants: the land between its samples is measured too)
  const env = ss.map((s) => over(s) - coverAt(s) - 0.05 - H);
  for (let i = 1; i <= n; i++) env[i] = Math.min(env[i], env[i - 1] + g);
  for (let i = n - 1; i >= 0; i--) env[i] = Math.min(env[i], env[i + 1] + g);
  const F = ss.map((s, i) => Math.min(env[i], A.z0 + TUNNEL.grade * Math.max(0, s - TUNNEL.landing), B.z0 + TUNNEL.grade * Math.max(0, L - s - TUNNEL.landing)));
  const Fat = (s) => { const i = Math.max(0, Math.min(n - 1, Math.floor(s / (L / n)))), t = (s - ss[i]) / (ss[i + 1] - ss[i]); return F[i] + (F[i + 1] - F[i]) * Math.max(0, Math.min(1, t)); };
  // (a stair from a concourse's floor down to the envelope: as many treads as keep each riser a riser, from its landing)
  const stairOf = (z, dir) => {
    const from = dir > 0 ? TUNNEL.landing : L - TUNNEL.landing;
    if (z - Fat(from) < 1e-3) return null;
    for (let m = 1; m < 200; m++) { const end = from + dir * m * TUNNEL.going, drop = z - Fat(end); if (drop / m <= TUNNEL.riser + 1e-9) return { from, dir, m, end, drop, rise: drop / m, z }; }
    return null;
  };
  const sa = stairOf(A.z0, 1), sb = stairOf(B.z0, -1);
  // the floor as spans [s0, s1, z0, z1]: the landings level, a stair's treads level, the rest the profile's slope
  const spans = [], risers = [];
  const treads = (St) => {
    for (let i = 0; i < St.m; i++) {
      const p = St.from + St.dir * i * TUNNEL.going, q = p + St.dir * TUNNEL.going, zt = St.z - (i + 1) * St.rise;
      risers.push([p, St.z - i * St.rise, zt, St.dir]);
      spans.push(St.dir > 0 ? [p, q, zt, zt] : [q, p, zt, zt]);
    }
  };
  const a0 = sa ? (treads(sa), spans.push([0, sa.from, A.z0, A.z0]), sa.end) : 0, b0 = sb ? (treads(sb), spans.push([sb.from, L, B.z0, B.z0]), sb.end) : L;
  for (let i = 0; i < n; i++) {
    const p = Math.max(ss[i], a0), q = Math.min(ss[i + 1], b0);
    if (q - p > 1e-6) spans.push([p, q, Fat(p), Fat(q)]);
  }
  spans.sort((p, q) => p[0] - q[0]);
  const cut = spans;
  // the ceiling: over a stair, the line from its top to its foot, everywhere else its floor's, a section's height over it
  const smooth = (s) => {
    for (const St of [sa, sb]) {
      if (!St) continue;
      const t = (s - St.from) * St.dir, len = St.m * TUNNEL.going;
      if (t >= 0 && t <= len) return St.z - (St.drop * t) / len;
    }
    const sp = spans.find(([a, b]) => s >= a - 1e-6 && s <= b + 1e-6) ?? spans[spans.length - 1];
    return sp[2] + ((sp[3] - sp[2]) * (s - sp[0])) / ((sp[1] - sp[0]) || 1);
  };
  const ceil = (s) => smooth(s) + H;
  const eA = sa ? { kind: 'stair', drop: sa.drop, n: sa.m } : { kind: Math.abs(Fat(TUNNEL.landing + 2) - A.z0) > 1e-3 ? 'ramp' : 'flat', drop: A.z0 - Math.min(...F) };
  const eB = sb ? { kind: 'stair', drop: sb.drop, n: sb.m } : { kind: Math.abs(Fat(L - TUNNEL.landing - 2) - B.z0) > 1e-3 ? 'ramp' : 'flat', drop: B.z0 - Math.min(...F) };
  const level = r5(Math.min(...F)), short = false;
  // the light: lamps along its middle under its ceiling, the concourse's floor light where a lamp stands, falling off
  // between them
  const lamps = [];
  for (let s = TUNNEL.lamp / 2; s < L - 0.5; s += TUNNEL.lamp) lamps.push(s);
  const lit = (s, v, z) => {
    let e = 0;
    for (const ls of lamps) { const d = Math.hypot(ls - s, v - u, ceil(ls) - 0.1 - z); e += Math.max(0, 1 - d / 7) ** 2; }
    const g = Math.max(0.12, Math.min(1, (look.light ?? 0.32) * (0.55 + 0.9 * Math.min(1, e))));
    const h = Math.round(255 * g).toString(16).padStart(2, '0');
    return `#${h}${h}${h}`;
  };
  const faces = [], W = (s, v, z) => { const p = at(s, v); return P3([p[0], p[1], z]); };
  const face = (cs, n, group, tile, uvOf) => {
    const c = cs.map((p) => W(...p)), fills = cs.map(([s, v, z]) => lit(s, v, z)), N = P3([k === 0 ? n[0] : n[1], k === 0 ? n[1] : n[0], n[2]]);
    // (wound so its normal points along `n`)
    const e1 = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], e2 = [c[c.length - 1][0] - c[0][0], c[c.length - 1][1] - c[0][1], c[c.length - 1][2] - c[0][2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], flip = cr[0] * N[0] + cr[1] * N[1] + cr[2] * N[2] < 0;
    const cc = flip ? c.slice().reverse() : c, ff = flip ? fills.slice().reverse() : fills, uv = tile ? (flip ? cs.slice().reverse() : cs).map((p) => uvOf(p).map((x) => r5(x / tile.scale))) : null;
    faces.push({ corners: cc, normal: N, outNormal: N, group, fill: ff[0], cornerFills: ff, ...(tile ? { texture: tile.texture, textureLit: true, uv } : {}) });
  };
  // (n in the passage's frame: [along, across, up])
  for (const [a, b, za, zb] of cut) {
    face([[a, u - half, za], [b, u - half, zb], [b, u + half, zb], [a, u + half, za]], [0, 0, 1], 'geocity:tunnel-floor', look.floor, ([s, v]) => [s, v]);
    face([[a, u - half, ceil(a)], [b, u - half, ceil(b)], [b, u + half, ceil(b)], [a, u + half, ceil(a)]], [0, 0, -1], 'geocity:tunnel-ceiling', look.ceiling, ([s, v]) => [s, v]);
    for (const sg of [-1, 1]) face([[a, u + sg * half, za], [b, u + sg * half, zb], [b, u + sg * half, ceil(b)], [a, u + sg * half, ceil(a)]], [0, -sg, 0], 'geocity:tunnel-wall', look.wall, ([s, , z]) => [s, z]);
  }
  for (const [s, zHi, zLo, dir] of risers) face([[s, u - half, zLo], [s, u + half, zLo], [s, u + half, zHi], [s, u - half, zHi]], [dir, 0, 0], 'geocity:tunnel-floor', look.floor, ([, v, z]) => [v, z]);
  // each end: its section round the concourse's doorway, facing in
  for (const [s, P, z, dir] of [[0, A, A.z0, 1], [L, B, B.z0, -1]]) {
    const strips = [[u - half, P.lo, z, z + H], [P.hi, u + half, z, z + H], [P.lo, P.hi, z + P.top, z + H]].filter(([a, b, c, d]) => b - a > 1e-3 && d - c > 1e-3);
    for (const [a, b, c, d] of strips) face([[s, a, c], [s, b, c], [s, b, d], [s, a, d]], [dir, 0, 0], 'geocity:tunnel-wall', look.wall, ([, v, zz]) => [v, zz]);
  }
  // its lamps: a bright strip under the ceiling over its middle
  for (const ls of lamps) {
    const z = ceil(ls) - 0.04, cs = [[ls - 0.6, u - 0.15, z], [ls + 0.6, u - 0.15, z], [ls + 0.6, u + 0.15, z], [ls - 0.6, u + 0.15, z]].map((p) => W(...p)), N = [0, 0, -1];
    const flip = ((cs[1][0] - cs[0][0]) * (cs[3][1] - cs[0][1]) - (cs[1][1] - cs[0][1]) * (cs[3][0] - cs[0][0])) > 0;
    const c4 = flip ? cs.slice().reverse() : cs;
    faces.push({ corners: c4, normal: N, outNormal: N, group: 'geocity:tunnel-lamp', fill: '#f4f6ff', cornerFills: c4.map(() => '#f4f6ff') });
  }
  // its walls held: a box down each side, its floor's lowest to its ceiling's highest
  const zLo = Math.min(...cut.map((c) => Math.min(c[2], c[3]))), zHi = Math.max(...cut.map(([a, b]) => Math.max(ceil(a), ceil(b))));
  const colliders = [-1, 1].map((sg) => {
    const v0 = sg < 0 ? u - half - TUNNEL.wall : u + half, v1 = v0 + TUNNEL.wall, p = at(0, v0), q = at(L, v1);
    return { min: P3([Math.min(p[0], q[0]), Math.min(p[1], q[1]), zLo]), max: P3([Math.max(p[0], q[0]), Math.max(p[1], q[1]), zHi]), of: `tunnel:${edge.a}-${edge.b}:${sg < 0 ? 'l' : 'r'}` };
  });
  // its cover, measured on what was built: under the street (`cover`) and under the plazas (`slab`, what is left over its
  // ceiling against what it wants there); its steepest ramp
  let cover = Infinity, slab = Infinity;
  for (let s = 0; s <= L + 1e-6; s += 0.5) { const c = over(s) - ceil(s); if (inStreet(s)) cover = Math.min(cover, c); else slab = Math.min(slab, c); }
  const grade = Math.max(0, ...cut.filter(([a, b, za, zb]) => b - a > 1e-6 && Math.abs(zb - za) > 1e-9).map(([a, b, za, zb]) => Math.abs(zb - za) / (b - a)));
  // its middle walked, each point at its floor: from A's way out, over each tread, to B's
  const zAt = (s) => { const sp = cut.find(([a, b]) => s >= a - 1e-6 && s <= b + 1e-6) ?? cut[cut.length - 1]; return sp[2] + ((sp[3] - sp[2]) * (s - sp[0])) / ((sp[1] - sp[0]) || 1); };
  const marks = [...new Set([0, ...cut.map((c) => r5((c[0] + c[1]) / 2)), L])].sort((p, q) => p - q);
  const st0c = Math.max(0, Math.min(L, st0)), st1c = Math.max(0, Math.min(L, st1));
  const line = marks.map((s) => W(s, u, zAt(s)));
  // under its blocks the land's own drape is cut over its run (podium.js groundLess): from each way out to its block's edge
  const rectOf = (a, b) => { const p = at(a, u - half - TUNNEL.wall), q = at(b, u + half + TUNNEL.wall); return P3([Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]); };
  return {
    id: `${edge.a}-${edge.b}`, a: edge.a, b: edge.b, faces, colliders, line, length: L, level, cover: r5(cover), slab: r5(slab), grade: r5(grade),
    ends: [eA, eB].map((e) => ({ kind: e.kind, drop: r5(e.drop), ...(e.n ? { steps: e.n } : {}) })),
    cuts: [{ block: edge.a, rect: rectOf(0, st0c), below: zHi + 0.2 }, { block: edge.b, rect: rectOf(st1c, L), below: zHi + 0.2 }],
    findings: short ? [`the passage ${edge.a}-${edge.b} is too short for its two ends: its ramps meet before its level`] : [],
  };
}

/** The network's laws: every concourse reached from every other (the passages' graph one piece), the street's cover over
 *  every passage, the steepest ramp, the longest passage. Advice: each says what it measured. */
export function networkLaws(nodes, tunnels) {
  const ids = nodes.map((n) => n.id), parent = new Map(ids.map((i) => [i, i]));
  const find = (i) => (parent.get(i) === i ? i : find(parent.get(i)));
  for (const t of tunnels) parent.set(find(t.a), find(t.b));
  const groups = new Map();
  for (const i of ids) { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), i]); }
  const pieces = [...groups.values()].sort((p, q) => q.length - p.length);
  const cover = Math.min(Infinity, ...tunnels.map((t) => t.cover)), slab = Math.min(Infinity, ...tunnels.map((t) => t.slab)), grade = Math.max(0, ...tunnels.map((t) => t.grade)), run = Math.max(0, ...tunnels.map((t) => t.length));
  return [
    { law: 'under-reached', ok: pieces.length <= 1, value: pieces.length <= 1 ? `${ids.length} concourse${ids.length === 1 ? '' : 's'} joined by ${tunnels.length} passage${tunnels.length === 1 ? '' : 's'}` : `${pieces.length} pieces: ${pieces.slice(1).map((p) => p.join(', ')).join('; ')} not reached from ${pieces[0].join(', ')}`, want: 'every concourse reached from every other' },
    { law: 'under-cover', ok: !tunnels.length || (cover >= TUNNEL.cover - 1e-6 && slab >= TUNNEL.slab - 1e-6), value: tunnels.length ? `${r5(cover)} m least under a street, ${r5(slab)} m under a plaza` : 'no passage', want: `${TUNNEL.cover} m of cover under every street, ${TUNNEL.slab} m under every plaza` },
    { law: 'under-grade', ok: grade <= TUNNEL.grade + 1e-6, value: `1:${grade > 0 ? r5(1 / grade) : '∞'} steepest ramp`, want: `no ramp steeper than 1:${1 / TUNNEL.grade}` },
    { law: 'under-run', ok: run <= TUNNEL.longest, value: `${r5(run)} m longest passage`, want: `no passage longer than ${TUNNEL.longest} m between two concourses` },
  ];
}
