/**
 * THE VOXEL LOOK — a battle racer's world in voxels under the isekai light, where the other poles draw pixels: a thing
 * is a shell of cubes on one grid, each a flat colour (its surface group's stop, a little variation cube to cube), lit
 * the way an isekai stage is (era/style/isekai-*.js `light`: a warm key, a cool ambient fill, bounce from the ground,
 * the cel threshold that cuts lit from shade, the sun's cast shadows: era/sun.js), each corner darkened by the cubes
 * round it (the voxel corner occlusion that makes the read). No tiles.
 *
 *   voxelize(faces, { size, colourOf, priorityOf? }) → { size, cells: Map('i,j,k' → { i, j, k, rgb }) }: every face's surface
 *                                               sampled into the cube it lies in (a shell; a thin panel one cube thick;
 *                                               a detail under the eye spot, drawn as a mark, still claims its cube by its
 *                                               priority: a glass band shows, a seam on a wall does not)
 *   voxelFaces(vox, { light, seed, jitter })   → faces: each cube's exposed sides (a neighbour there hides one), its
 *                                               corners occluded, lit and banded, runs of identical sides merged
 *   voxelSizeFor(box)                          → the grid a thing is drawn at (its largest extent in about CUBES cubes,
 *                                               one of a few sizes, so neighbours share a grid)
 *   VOXEL_LIGHT                                → the meadow's isekai light, for a kit that carries none
 *
 * Pure, deterministic (the variation is a hash of the cube, never dice).
 */
import { makeSunShadow, sunDir } from '../era/sun.js';

export const VOXEL_LIGHT = Object.freeze({ key: { color: '#fff2d0', elevation: 42, azimuth: 60 }, ambient: '#86aede', fill: 0.62, bounce: [0.7, 0.8, 0.5], bounceGain: 0.12, sunGain: 1.15, cel: 0.28 });
/** The corner occlusion's four levels: both sides blocked (or two and the corner) … nothing round it. */
export const AO_LEVELS = Object.freeze([0.5, 0.68, 0.84, 1]);
const SIZES = [0.5, 1, 1.5, 2];   // (one chunky grid for the small things: a scene's furniture shares its cube)
/** About how many cubes across a thing's largest side: chunky, the trend's read (a lamp post a few, a castle two dozen). */
export const CUBES = 24;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toHex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
const r3 = (v) => Math.round(v * 1000) / 1000;
const key = (i, j, k) => `${i},${j},${k}`;
const hash = (i, j, k, s) => { let h = (i * 73856093) ^ (j * 19349663) ^ (k * 83492791) ^ (s * 2654435761); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** The grid a thing is drawn at: its largest extent in about CUBES cubes, one of a few sizes. */
export function voxelSizeFor(box) {
  const big = Math.max(...box.hi.map((v, i) => v - box.lo[i]));
  return SIZES.reduce((b, s) => (Math.abs(big / s - CUBES) < Math.abs(big / b - CUBES) ? s : b), SIZES[0]);
}

function newell(c) {
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  const l = Math.hypot(...n) || 1; return n.map((v) => v / l);
}

/** Faces sampled into a shell of cubes: each sample nudged a hair inside its face (so a box's side lands in its own
 *  cubes, not the next row out); a cube's colour the face of the highest `priorityOf` to claim it (the first among
 *  equals): a detail a hand's breadth proud of a wall (a door, a glass band) wins its cube, as voxel art draws it. */
export function voxelize(faces, { size, colourOf, priorityOf = () => 0 }) {
  const cells = new Map(), step = size * 0.45;
  for (const f of faces) {
    const pr = priorityOf(f);
    const c = f.corners; if (!c || c.length < 3) continue;
    // (each sample a hair inside its face, and a hair toward its centre: an edge on a cube's boundary stays in its own)
    const n = f.normal ?? newell(c), rgb = colourOf(f), m = c.reduce((s0, p) => [s0[0] + p[0] / c.length, s0[1] + p[1] / c.length, s0[2] + p[2] / c.length], [0, 0, 0]);
    for (let t = 1; t + 1 < c.length; t++) {
      const a = c[0], b = c[t], d = c[t + 1], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ad = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const nu = Math.max(1, Math.ceil(Math.hypot(...ab) / step)), nv = Math.max(1, Math.ceil(Math.hypot(...ad) / step));
      for (let u = 0; u <= nu; u++) for (let v = 0; v <= nv - (u * nv) / nu + 1e-9; v++) {
        const q = [a[0] + ab[0] * (u / nu) + ad[0] * (v / nv), a[1] + ab[1] * (u / nu) + ad[1] * (v / nv), a[2] + ab[2] * (u / nu) + ad[2] * (v / nv)];
        const p = q.map((x, k) => x - n[k] * 1e-3 + (m[k] - x) * 1e-3);
        const i = Math.floor(p[0] / size), j = Math.floor(p[1] / size), k = Math.floor(p[2] / size), K = key(i, j, k);
        const was = cells.get(K);
        if (!was || pr > was.pr) cells.set(K, { i, j, k, rgb, pr });
      }
    }
  }
  return { size, cells };
}

// the six sides: the axis, its sign, and the side's two tangents (t1 × t2 = the outward normal for the + side)
const SIDES = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];
const TAN = { 0: [1, 2], 1: [2, 0], 2: [0, 1] };

/** A voxel shell's exposed sides, occluded at their corners, lit by the isekai light (cel, shadows, bounce), runs merged. */
export function voxelFaces(vox, { light = VOXEL_LIGHT, seed = 1, jitter = 0.05, shadows = true } = {}) {
  const { size, cells } = vox, has = (i, j, k) => cells.has(key(i, j, k));
  const L = sunDir(light.key.elevation, light.key.azimuth), keyC = hexRgb(light.key.color), amb = hexRgb(light.ambient).map((v) => v * light.fill);
  const sides = [];
  for (const c of cells.values()) for (const [ax, sg] of SIDES) {
    const nb = [c.i, c.j, c.k]; nb[ax] += sg;
    if (has(...nb)) continue;
    const [t1, t2] = TAN[ax], ao = [];
    for (const [c1, c2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const at = (d1, d2) => { const q = [...nb]; q[t1] += d1; q[t2] += d2; return has(...q) ? 1 : 0; };
      const s1 = at(c1, 0), s2 = at(0, c2), cc = at(c1, c2);
      ao.push(AO_LEVELS[s1 && s2 ? 0 : 3 - (s1 + s2 + cc)]);
    }
    sides.push({ c, ax, sg, ao });
  }
  // the geometry of a side: its four corners, wound outward (the corner occlusion's order matches)
  const quad = (s) => {
    const { c, ax, sg } = s, [t1, t2] = TAN[ax], base = [c.i, c.j, c.k]; if (sg > 0) base[ax] += 1;
    const P = (d1, d2) => { const q = [...base]; q[t1] += d1; q[t2] += d2; return q.map((v) => r3(v * size)); };
    const q = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
    return sg > 0 ? q : [q[0], q[3], q[2], q[1]];
  };
  const aoOrder = (s) => (s.sg > 0 ? s.ao : [s.ao[0], s.ao[3], s.ao[2], s.ao[1]]);
  // the sun: what each side's centre sees of it, past the shell itself
  const geo = sides.map((s) => ({ corners: quad(s) }));
  const sunAt = shadows ? makeSunShadow(geo, L, { cell: Math.max(0.5, size * 1.5) }) : () => 1;
  const colour = (s, q) => {
    const n = [0, 0, 0]; n[s.ax] = s.sg;
    const lam = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]), ctr = q.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
    const reach = lam > 0 ? lam * sunAt([ctr[0] + n[0] * 0.02, ctr[1] + n[1] * 0.02, ctr[2] + n[2] * 0.02], n) : 0, lit = reach >= light.cel;
    const vary = 1 + jitter * (Math.floor(hash(s.c.i, s.c.j, s.c.k, seed) * 3) - 1);   // three steps of variation, cube to cube
    // a cube's colours banded the isekai way ({ lit, top, shade }: a band is a choice of stop); a bare colour is lit by
    // the light's own terms
    if (s.c.rgb.lit) return (lit ? (s.ax === 2 && s.sg > 0 ? s.c.rgb.top : s.c.rgb.lit) : s.c.rgb.shade).map((v) => v * vary);
    const down = Math.max(0, 0.5 - 0.5 * n[2]);
    const lightC = amb.map((a, k) => a + (lit ? keyC[k] * light.sunGain * Math.max(lam, 0.55) : 0) + light.bounce[k] * light.bounceGain * down);
    return s.c.rgb.map((v, k) => v * lightC[k] * vary);
  };
  // runs: sides in the same plane and row, unoccluded and of one colour, merged along their first tangent
  const out = [], runs = new Map();
  for (const s of sides) {
    const q = quad(s), base = colour(s, q), ao = aoOrder(s);
    if (ao.every((v) => v === 1)) {
      const [t1, t2] = TAN[s.ax], cc = [s.c.i, s.c.j, s.c.k], k = `${s.ax}|${s.sg}|${cc[s.ax]}|${cc[t2]}|${toHex(base)}`;
      if (!runs.has(k)) runs.set(k, []);
      runs.get(k).push({ s, at: cc[t1], hex: toHex(base) });
      continue;
    }
    out.push({ corners: q, fill: toHex(base.map((v) => v * (ao.reduce((a, b) => a + b) / 4))), cornerFills: ao.map((f) => toHex(base.map((v) => v * f))) });
  }
  for (const list of runs.values()) {
    list.sort((p, q) => p.at - q.at);
    let i = 0;
    while (i < list.length) {
      let j = i; while (j + 1 < list.length && list[j + 1].at === list[j].at + 1) j++;
      const a = quad(list[i].s), b = quad(list[j].s), s = list[i].s, [t1] = TAN[s.ax];
      // the merged side: the first's corners at its low end, the last's at its high end (along t1)
      const lo = (p) => p[t1] <= Math.min(...a.map((x) => x[t1])) + 1e-9, corners = a.map((p, m) => (lo(p) ? p : b[m]));
      out.push({ corners, fill: list[i].hex });
      i = j + 1;
    }
  }
  return out;
}
