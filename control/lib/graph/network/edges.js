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
 *   networkEdges(nodes, { section, blocks, gap }) → [{ a, b, axis, uA, uB, mid, kind, sideA, sideB }]
 *     nodes    [{ id, rect (its site), room (its room's inside), door (its doorway's width) }]
 *     blocks   every site a passage may not pass under but its two ends' (the sites between: a passage crosses one gap)
 *     gap      the widest gap it crosses (m)
 *     → `axis` the one it runs out along, `uA` / `uB` its way out's middle on each room's wall (across the axis), `mid`
 *       the dog-leg's line along the gap (null when straight), `sideA` / `sideB` the walls it leaves through
 *   pathOf(edge, A, B) → [[x, y], …]   its middle, from A's way out's outer face (`A.plane`) to B's
 *
 * Metres, plan. Pure.
 */
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
// a way's frame each side (the bay kit's door frame), so a way stands on its wall
const FRAME = 0.3;
const SIDES = [['+x', '-x'], ['+y', '-y']];

export function networkEdges(nodes, { section, blocks = [], gap: most = 80 } = {}) {
  const W = section.width, half = W / 2, edges = [], used = new Map();
  const free = (id, side, lo, hi) => (used.get(`${id}${side}`) ?? []).every(([p, q]) => hi + 1 <= p || lo - 1 >= q);
  const clearOf = (A, B, rects) => rects.every((R) => blocks.every((q) => q === A.rect || q === B.rect || !(q[0] < R[2] && q[2] > R[0] && q[1] < R[3] && q[3] > R[1])));
  for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) {
    if (i === j) continue;
    const A = nodes[i], B = nodes[j];
    for (const k of [0, 1]) {
      // B beyond A along k, across one gap
      const gap = B.rect[k] - A.rect[k + 2];
      if (!(gap > 0 && gap <= most)) continue;
      const o = 1 - k, door = Math.max(A.door, B.door);
      // (where a way out may stand on each room's wall, across the axis)
      const span = (N) => [N.room[o] + FRAME + door / 2, N.room[o + 2] - FRAME - door / 2], [a0, a1] = span(A), [b0, b1] = span(B);
      if (a1 < a0 || b1 < b0) continue;
      const lo = Math.max(a0, b0), hi = Math.min(a1, b1), [sideA, sideB] = SIDES[k];
      const box = (p0, p1, u) => (k === 0 ? [Math.min(p0, p1), u - half, Math.max(p0, p1), u + half] : [u - half, Math.min(p0, p1), u + half, Math.max(p0, p1)]);
      let edge = null;
      if (hi >= lo) {
        const u = r5((lo + hi) / 2);
        if (clearOf(A, B, [box(A.room[k + 2], B.room[k], u)])) edge = { uA: u, uB: u, mid: null, kind: 'straight' };
      } else if (Math.min(A.rect[o + 2], B.rect[o + 2]) - Math.max(A.rect[o], B.rect[o]) >= W) {
        // a dog-leg (only between sites that face each other across the gap, overlapping along it by a section's width:
        // never a run down a street to a site round a corner): each way out as near the other room as its wall lets it,
        // the jog a section's width at least
        let uA = b0 > a1 ? a1 : a0, uB = b0 > a1 ? b0 : b1;
        const short = W + 0.5 - Math.abs(uB - uA);
        if (short > 0) { const sg = Math.sign(uB - uA) || 1; uA = Math.max(a0, Math.min(a1, uA - (sg * short) / 2)); uB = Math.max(b0, Math.min(b1, uB + (sg * short) / 2)); }
        const mid = r5((A.rect[k + 2] + B.rect[k]) / 2);
        if (Math.abs(uB - uA) >= W + 0.5 - 1e-6 && mid - half - A.room[k + 2] > 2 && B.room[k] - mid - half > 2) {
          const legs = [box(A.room[k + 2], mid + half, uA), k === 0 ? [mid - half, Math.min(uA, uB) - half, mid + half, Math.max(uA, uB) + half] : [Math.min(uA, uB) - half, mid - half, Math.max(uA, uB) + half, mid + half], box(mid - half, B.room[k], uB)];
          if (clearOf(A, B, legs)) edge = { uA: r5(uA), uB: r5(uB), mid, kind: 'dog-leg' };
        }
      }
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
