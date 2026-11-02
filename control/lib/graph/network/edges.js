/**
 * A NETWORK'S EDGES — which nodes a network joins, and the path each passage takes (network/passage.js builds it). A node
 * is a building with a room its passages leave from (a concourse, a basement) standing on a site (a block, a lot); two
 * nodes are joined where they face each other across one gap (a street, a yard) with nothing else between:
 *
 *   straight   their rooms overlap along the gap by a doorway and its frames: one leg across it, its middle where they
 *              overlap
 *   dog-leg    they do not, though their sites face each other across it: a leg out of each room to the gap's middle
 *              line and a leg along it between them (a Z), each way out as near the other room as its wall lets it
 *              stand, the jog at least a section's width so its two junctions keep apart
 *
 *   networkEdges(nodes, { section, blocks, gap }) → [{ a, b, roomA, roomB, axis, uA, uB, mid, kind, sideA, sideB, doorA,
 *     doorB }]   (each end's doorway: its node's `door`, narrowed to what its room's wall holds, a single door's at least)
 *     nodes    [{ id, rect (its site), door (its doorway's width), room (its one room's inside, every wall facing out) |
 *              rooms ([{ id, rect, sides }]: the rooms it may be left from, each its inside and the walls that face out:
 *              network/building.js) }]; of two nodes' rooms, the pair facing each other straight across the gap first,
 *              the nearest pair of those
 *     blocks   every site a passage may not pass under but its two ends' (the sites between: a passage crosses one gap);
 *              a node's `solid` ([{ id, rect }]: its own rooms) are crossed by none of its passages but at the room each
 *              leaves
 *     gap      the widest gap it crosses (m)
 *     → `axis` the one it runs out along, `uA` / `uB` its way out's middle on each room's wall (across the axis), `mid`
 *       the dog-leg's line along the gap (null when straight), `sideA` / `sideB` the walls it leaves through
 *   pathOf(edge, A, B) → [[x, y], …]   its middle, from A's way out's outer face (`A.plane`) to B's
 *
 * Metres, plan. Pure.
 */
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
// a way's frame each side (a kit's door frame, the widest a bay kit takes, and a hand), so a way stands on its wall
const FRAME = 0.4;
// the narrowest doorway a passage meets a room by (a single door, m)
const LEAST = 1.2;
const SIDES = [['+x', '-x'], ['+y', '-y']];

export function networkEdges(nodes, { section, blocks = [], gap: most = 80 } = {}) {
  const W = section.width, half = W / 2, edges = [], used = new Map();
  const free = (id, side, lo, hi) => (used.get(`${id}${side}`) ?? []).every(([p, q]) => hi + 1 <= p || lo - 1 >= q);
  const hits = (q, R) => q[0] < R[2] - 1e-6 && q[2] > R[0] + 1e-6 && q[1] < R[3] - 1e-6 && q[3] > R[1] + 1e-6;
  // (clear of every site but its two ends', and of its two nodes' own rooms but the two it leaves: `solid`)
  const clearOf = (A, B, rects, ra = null, rb = null) => rects.every((R) => blocks.every((q) => q === A.rect || q === B.rect || !hits(q, R))
    && [...(A.solid ?? []).filter((x) => x.id !== ra), ...(B.solid ?? []).filter((x) => x.id !== rb)].every((x) => !hits(x.rect, R)));
  const roomsOf = (N) => N.rooms ?? [{ id: null, rect: N.room, sides: ['-x', '+x', '-y', '+y'] }];
  for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) {
    if (i === j) continue;
    const A0 = nodes[i], B0 = nodes[j];
    for (const k of [0, 1]) {
      // B beyond A along k, across one gap
      const gap = B0.rect[k] - A0.rect[k + 2];
      if (!(gap > 0 && gap <= most)) continue;
      const o = 1 - k, [sideA, sideB] = SIDES[k];
      // (a room's doorway: its node's, narrowed to what its wall holds between its frames, a single door's at least)
      const doorOf = (N, r) => Math.min(N.door, r.rect[o + 2] - r.rect[o] - 2 * FRAME);
      // (each pair of rooms whose walls face each other across it: the straight ones first, the nearest of them)
      const pairs = [];
      for (const ra of roomsOf(A0).filter((r) => r.sides.includes(sideA) && doorOf(A0, r) >= LEAST)) for (const rb of roomsOf(B0).filter((r) => r.sides.includes(sideB) && doorOf(B0, r) >= LEAST)) {
        const lo = Math.max(ra.rect[o], rb.rect[o]), hi = Math.min(ra.rect[o + 2], rb.rect[o + 2]);
        pairs.push({ ra, rb, straight: hi - lo >= Math.max(doorOf(A0, ra), doorOf(B0, rb)) + 2 * FRAME, dist: rb.rect[k] - ra.rect[k + 2] + Math.max(0, lo - hi) });
      }
      pairs.sort((p, q) => q.straight - p.straight || p.dist - q.dist);
      let edge = null;
      for (const { ra, rb } of pairs) {
      const A = { ...A0, room: ra.rect }, B = { ...B0, room: rb.rect }, dA = doorOf(A0, ra), dB = doorOf(B0, rb), door = Math.max(dA, dB);
      // (where a way out may stand on each room's wall, across the axis)
      const span = (N, d) => [N.room[o] + FRAME + d / 2, N.room[o + 2] - FRAME - d / 2], [a0, a1] = span(A, dA), [b0, b1] = span(B, dB);
      if (a1 < a0 || b1 < b0) continue;
      const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
      const box = (p0, p1, u) => (k === 0 ? [Math.min(p0, p1), u - half, Math.max(p0, p1), u + half] : [u - half, Math.min(p0, p1), u + half, Math.max(p0, p1)]);
      if (hi >= lo) {
        const u = r5((lo + hi) / 2);
        if (clearOf(A0, B0, [box(A.room[k + 2], B.room[k], u)], ra.id, rb.id)) edge = { uA: u, uB: u, mid: null, kind: 'straight', roomA: ra.id, roomB: rb.id, doorA: r5(dA), doorB: r5(dB) };
      } else if (Math.min(A.rect[o + 2], B.rect[o + 2]) - Math.max(A.rect[o], B.rect[o]) >= W) {
        // a dog-leg (only between sites that face each other across the gap, overlapping along it by a section's width:
        // never a run down a street to a site round a corner): each way out as near the other room as its wall lets it,
        // the jog a section's width at least
        let uA = b0 > a1 ? a1 : a0, uB = b0 > a1 ? b0 : b1;
        // (a jog too short for its two junctions: B's way out moved away as far as its wall lets it, then A's)
        const need = W + 0.5, sg = Math.sign(uB - uA) || 1;
        if (Math.abs(uB - uA) < need) { uB = Math.max(b0, Math.min(b1, uA + sg * need)); uA = Math.max(a0, Math.min(a1, uB - sg * need)); }
        const mid = r5((A.rect[k + 2] + B.rect[k]) / 2);
        if (Math.abs(uB - uA) >= W + 0.5 - 1e-6 && mid - half - A.room[k + 2] > 2 && B.room[k] - mid - half > 2) {
          const legs = [box(A.room[k + 2], mid + half, uA), k === 0 ? [mid - half, Math.min(uA, uB) - half, mid + half, Math.max(uA, uB) + half] : [Math.min(uA, uB) - half, mid - half, Math.max(uA, uB) + half, mid + half], box(mid - half, B.room[k], uB)];
          if (clearOf(A0, B0, legs, ra.id, rb.id)) edge = { uA: r5(uA), uB: r5(uB), mid, kind: 'dog-leg', roomA: ra.id, roomB: rb.id, doorA: r5(dA), doorB: r5(dB) };
        }
      }
      if (edge && free(A0.id, sideA, edge.uA - half, edge.uA + half) && free(B0.id, sideB, edge.uB - half, edge.uB + half)) break;
      edge = null;
      }
      const A = A0, B = B0;
      if (!edge || !free(A.id, sideA, edge.uA - half, edge.uA + half) || !free(B.id, sideB, edge.uB - half, edge.uB + half)) continue;
      used.set(`${A.id}${sideA}`, [...(used.get(`${A.id}${sideA}`) ?? []), [edge.uA - half, edge.uA + half]]);
      used.set(`${B.id}${sideB}`, [...(used.get(`${B.id}${sideB}`) ?? []), [edge.uB - half, edge.uB + half]]);
      edges.push({ a: A.id, b: B.id, axis: k === 0 ? 'x' : 'y', ...edge, sideA, sideB });
    }
  }
  return edges;
}

/** A passage's middle, from A's way out (its outer face's plane along the axis, `A.plane`) to B's. */
export function pathOf(edge, A, B) {
  const k = edge.axis === 'x' ? 0 : 1, P = (along, u) => { const p = [0, 0]; p[k] = along; p[1 - k] = u; return p.map(r5); };
  return edge.mid === null || edge.mid === undefined
    ? [P(A.plane, edge.uA), P(B.plane, edge.uB)]
    : [P(A.plane, edge.uA), P(edge.mid, edge.uA), P(edge.mid, edge.uB), P(B.plane, edge.uB)];
}
