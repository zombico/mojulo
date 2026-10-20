/** body-relational-correctives.js — a sliced recipe's CORRECTIVES (morph-like offsets at rest, by an arm's raise): their sum on a
 * mesh's rest for posed nodes (correctiveRest), and the shoulder's blend overhead (shoulderBlend), computed on the
 * posed slice. */
import { add, sub, scl, dot, cross, len, unit, r6 } from './body-relational-vec.js';
import { compileLayered } from './station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered } from './station-loft-rig.js';

/** A sliced recipe's CORRECTIVES (formSlice: the pauldron) added to a compiled mesh's rest for posed nodes: each its
 * offsets by its weight, the raise of its driver's bone (the angle from the trunk's down, the navel from the neck's
 * root) eased from `from` to `full`. The rest vertices as they are without correctives or at weight 0. */
export function correctiveRest(mesh, recipe, nodes) {
  const C = recipe?.correctives; if (!C?.length) return mesh.vertices;
  const sm = (v) => { const y = Math.max(0, Math.min(1, v)); return y * y * (3 - 2 * y); };
  let V = null;
  for (const c of C) {
    const a = nodes[c.driver.joint], b = nodes[c.driver.to]; if (!a || !b || !nodes.navel || !nodes.neckHub) continue;
    const raise = (Math.acos(Math.max(-1, Math.min(1, dot(unit(sub(b, a)), unit(sub(nodes.navel, nodes.neckHub)))))) * 180) / Math.PI;
    const w = sm((raise - c.driver.from) / (c.driver.full - c.driver.from)); if (w <= 0) continue;
    V ??= mesh.vertices.map((v) => [...v]);
    mesh.pointIds.forEach((id, i) => { const o = c.d[id]; if (o) V[i] = [V[i][0] + o[0] * w, V[i][1] + o[1] * w, V[i][2] + o[2] * w]; });
  }
  return V ?? mesh.vertices;
}


/** the shoulder's blend overhead, added to a sliced recipe's correctives (two stages per side); see below */
export function shoulderBlend(r) {
  // THE SHOULDER BLENDED OVERHEAD (with the pauldron): a raised arm crumpled the torso's skin round its root, in the
  // armpit and over the blade, into folds, and at rest the torso's cap lies over the arm's top a few millimetres out, so
  // the two skins, carried apart unevenly, crossed and recrossed: the torso's stood through the arm's in a sawtooth of
  // spikes. The slice is posed with both arms overhead (the pauldron on); there the torso's skin round the shoulder (by
  // its share of the arm's and the girdle's bones) is SMOOTHED over its grid (Taubin's two steps, so it does not shrink),
  // and a point lying on the arm's skin or through it, beside it within `reach`, SUNK under it by `under`. The change
  // carried back to the rest through the skin's own map at each point (linear blend skinning is linear in the rest
  // point: three unit nudges give its matrix), a corrective per side over the raise, whole at the pose's own. In two
  // STAGES, the arms level and the arms overhead, each sampled over the one before it, so the raise between is blended
  // too (one stage, whole only overhead, left the level arm's armpit at a fifth of it)
  const blendStage = (pose, from, id) => {
    // (the torso and the upper arms alone, all it reads and writes: compiled whole, the head, the hands and the feet
    // were most of a stage's cost)
    const few = { ...r, dials: {}, parts: Object.fromEntries(['torso', 'upperArmR', 'upperArmL'].filter((k) => r.parts[k]).map((k) => [k, r.parts[k]])) };
    const mesh = compileLayered(few, {}, { details: false, creases: false }), R2 = validateRig(r.rig), skin = bindLayered(mesh, few, R2);
    const nodes = rigNodesAt(R2, pose).nodes, frames = boneFrames(R2, R2.joints, nodes);
    const rest0 = correctiveRest(mesh, r, nodes), V = skinLayered({ ...mesh, vertices: rest0 }, skin, frames);
    const raise = (Math.acos(Math.max(-1, Math.min(1, dot(unit(sub(nodes.elbowR, nodes.shoulderR)), unit(sub(nodes.navel, nodes.neckHub)))))) * 180) / Math.PI;
    const T = r.parts.torso, SL = T.slots, st = T.stations, nS = SL.length, at = Object.fromEntries(mesh.pointIds.map((id, i) => [id, i]));
    const idx = st.map((x) => SL.map((sl) => at[`torso/${x.id}.${sl}`]));
    // the region: a point's share of the arm's and the girdle's bones, or its nearness to the posed arm (the flank under
    // the armpit, the torso's own), eased over the grid so its edge is soft
    const SHOULDER = /^(upperArm|shoulderFold|scapula|clavicle)[RL]$/, own = { [T.bind.bone]: 1 };
    const isArm = (i) => /^upperArm[RL]$/.test(mesh.provenance[i]?.part), arm = mesh.vertices.map((_, i) => i).filter(isArm);
    // (the arm's nearest vertex, from a grid of 2 cm cells, within the 6 cm the region and the sink read; the lowest
    // index of the nearest, as a search of every vertex finds it; none further, which reads the same in both)
    const H = 0.02, cellOf = (x) => Math.floor(x / H), grid = new Map();
    for (const k of arm) { const key = `${cellOf(V[k][0])},${cellOf(V[k][1])},${cellOf(V[k][2])}`; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(k); }
    const nearest = (q) => {
      let best = null, bd = Infinity; const c = q.map(cellOf);
      for (let a = -3; a <= 3; a++) for (let b2 = -3; b2 <= 3; b2++) for (let e = -3; e <= 3; e++) for (const k of grid.get(`${c[0] + a},${c[1] + b2},${c[2] + e}`) || []) { const d = len(sub(q, V[k])); if (d < bd || (d === bd && k < best)) { bd = d; best = k; } }
      return bd <= 0.06 ? [best, bd] : [null, Infinity];
    };
    let mask = st.map((x, i) => SL.map((sl, j) => { const w = T.bind.blend[`${x.id}.${sl}`] || T.bind.blend[x.id] || own, v = idx[i][j]; return Math.min(1, Math.max(Object.entries(w).reduce((t, [k, val]) => t + (SHOULDER.test(k) ? val : 0), 0) * 2, v === undefined ? 0 : 1 - nearest(V[v])[1] / 0.06)); }));
    const nbOf = (i, j) => [[i, (j + 1) % nS], [i, (j + nS - 1) % nS], [i + 1, j], [i - 1, j]];
    for (let it = 0; it < 3; it++) mask = mask.map((row, i) => row.map((m, j) => (i === 0 || i === st.length - 1 ? m : (m + nbOf(i, j).reduce((t, [a, b]) => t + mask[a][b], 0) / 4) / 2)));
    let P = idx.map((row) => row.map((v) => [...V[v]]));
    for (let it = 0; it < 10; it++) for (const lam of [0.5, -0.53]) {
      P = P.map((row, i) => row.map((p, j) => {
        if (i === 0 || i === st.length - 1 || !mask[i][j]) return p;
        const m = scl(nbOf(i, j).reduce((a, [x, y]) => add(a, P[x][y]), [0, 0, 0]), 1 / 4);
        return add(p, scl(sub(m, p), lam * mask[i][j]));
      }));
    }
    // the sink, against the posed arms' skins (their outward normals by vertex)
    const N = mesh.vertices.map(() => [0, 0, 0]);
    for (const t of mesh.faces) if (isArm(t[0])) { const [a, b, c] = t.map((i) => V[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t) N[i] = add(N[i], n); }
    const reach = 0.035, under = 0.006;
    let sink = P.map((row) => row.map(() => null));
    P.forEach((row, i) => row.forEach((q, j) => {
      const [best, bd] = nearest(q); if (bd > reach) return;
      const n = unit(N[best]), out = (dot(sub(q, V[best]), n) + under) * (1 - Math.max(0, bd - reach / 2) / (reach / 2));
      if (out > 0) sink[i][j] = scl(n, -out);
    }));
    // (the depths eased over the grid, never shallower than a point must go: the edge one curve)
    for (let it = 0; it < 4; it++) sink = sink.map((row, i) => row.map((v, j) => {
      if (i === 0 || i === st.length - 1) return v;
      const nb = nbOf(i, j).map(([a, b]) => sink[a][b]); if (!v && !nb.some(Boolean)) return v;
      const mean = scl(nb.reduce((a, x) => add(a, x || [0, 0, 0]), [0, 0, 0]), 1 / 4), m = scl(add(v || [0, 0, 0], mean), 0.5);
      return !v || len(m) > len(v) ? m : v;
    }));
    // each point's change at the pose carried back to the rest by the inverse of its skin's map there
    const e = 1e-3, nudged = [0, 1, 2].map((k) => skinLayered({ ...mesh, vertices: rest0.map((v) => v.map((x, a) => (a === k ? x + e : x))) }, skin, frames));
    const inv3 = (M) => { const [a, b, c] = M, det = dot(a, cross(b, c)); if (Math.abs(det) < 1e-9) return null; const r0 = cross(b, c), r1 = cross(c, a), r2 = cross(a, b); return (v) => [dot(r0, v) / det, dot(r1, v) / det, dot(r2, v) / det]; };
    const d = { R: {}, L: {} };
    P.forEach((row, i) => row.forEach((q, j) => {
      const v = idx[i][j]; if (v === undefined) return;
      const dp = add(sub(q, V[v]), sink[i][j] || [0, 0, 0]); if (len(dp) < 1e-4) return;
      const cols = [0, 1, 2].map((k) => scl(sub(nudged[k][v], V[v]), 1 / e)), un = inv3(cols); if (!un) return;
      const x = st[i].points[SL[j]][0]; if (x === 0) return;
      d[x < 0 ? 'L' : 'R'][`torso/${st[i].id}.${SL[j]}`] = un(dp).map(r6);
    }));
    for (const S of ['R', 'L']) if (Object.keys(d[S]).length) r.correctives.push({ id: `${id}${S}`, driver: { joint: `shoulder${S}`, to: `elbow${S}`, from, full: r6(raise) }, d: d[S] });
    return raise;
  };
  const level = blendStage({ armR: { x: 1, y: 0, z: 0.1 }, armL: { x: -1, y: 0, z: 0.1 } }, 30, 'shoulderLevel');
  blendStage({ armR: { x: 0.3, y: 0, z: 1 }, armL: { x: -0.3, y: 0, z: 1 } }, r6(level), 'shoulderOverhead');
}
