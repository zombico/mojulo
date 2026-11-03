/**
 * rupa/shell-blocks.js — a world's big things as the blocks destructible physics breaks: a fractal structure's tiers,
 * plinth steps, columns and ring beam, and a town's shell houses as walls and a roof. Under `destruction: 'physical'`
 * only (world-scene.js); every other world keeps its colliders as they are. rupa is the internal name.
 *
 * The rules, each so the load pass reads the building the way it stands:
 *   COURSES   a solid tier, step or shaft is cut into courses no wider than COURSE (3 m, or a sixth of it when wider,
 *             so a great tower stays a few hundred blocks) and no taller: each sits flat on the course under it, so a
 *             blow takes a course out and what it held comes down, never the whole tier
 *   RINGS     a hollow tier or a ring beam (an annulus, one box per ring edge where it is a walker's collider, boxes that
 *             overlap at every corner) is filled with cells as wide as its wall, in courses, from its outline (`rings`,
 *             fractal-structure grownRings): neighbours share faces exactly and hold each other (a ring beam's are hung,
 *             `bond: 'lateral'`: it spans between its columns and bends where one goes)
 *   SEATING   a block that rests on nothing is seated on the highest top under it when the gap is a small part of what
 *             is under it (a column's capital, which has faces but no collider, is carried by its shaft: the shaft's
 *             course is raised to meet the beam, never by more than a third of its own height);
 *             with nothing under it at all, within a storey of its group's foot, it reaches down to the foot
 *   FOOTING   each group's lowest blocks stand on a fixed footing under them (the land, which holds), so a building on
 *             raised ground stands at minute zero instead of falling to the level's floor
 *   HOUSES    a shell house (`<id>:house`) is its walls, panels no wider or taller than COURSE, from its footing to its
 *             eave (the lowest face that looks up, above its first storey), and its roof from the eave to the ridge
 *             resting on them; walls take the cube's wall matter, the roof its roof matter at a roof's fill (ROOF_FILL:
 *             rafters and tiles, mostly air)
 *   FACES     every face of a group goes with the block that holds its middle (else the nearest): `node` and the
 *             `break:<id>` group, so the page hides what broke and pre-cuts it in its colour
 *
 *   shellBlocks(payload, { rings?, matterOf?, floor?, hp? }) → { breakables, faces, colliders, footings, groups } | null
 *     payload: { faces, colliders }; rings: the structures' annuli (an annulus without its outline keeps its edges' boxes); matterOf: era/geocube.js cubeMatter's roles (wall, roof); null when the
 *     world has no structure and no shell house
 */
import { blockMatter, resolveMatter, cutOfMatter } from './matter.js';

export const COURSE = 3;
export const WALL = 0.25;
export const ROOF_FILL = 0.15;
const TOUCH = 0.02, SEAT = 3.5;   // (SEAT: how far a block with nothing under it reaches down to its foot)
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const ovl = (a, b, k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]);
const mid = (f) => [0, 1, 2].map((k) => f.corners.reduce((s, c) => s + c[k], 0) / f.corners.length);
const boxDist = (b, p) => Math.hypot(...[0, 1, 2].map((k) => Math.max(b.min[k] - p[k], 0, p[k] - b.max[k])));

// split [a, b] into n equal parts no longer than `most`
function cuts(a, b, most) {
  const n = Math.max(1, Math.ceil((b - a) / most - 1e-9)), out = [];
  for (let i = 0; i <= n; i++) out.push(r4(a + ((b - a) * i) / n));
  return out;
}
// a box as courses: cells no wider than the course (a sixth of its width when wider), no taller than the course
function courses(min, max, id) {
  const wx = max[0] - min[0], wy = max[1] - min[1];
  const xs = cuts(min[0], max[0], Math.max(COURSE, wx / 6)), ys = cuts(min[1], max[1], Math.max(COURSE, wy / 6)), zs = cuts(min[2], max[2], COURSE);
  const out = [];
  for (let k = 0; k + 1 < zs.length; k++) for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++)
    out.push({ id: `${id}#${k}.${j}.${i}`, min: [xs[i], ys[j], zs[k]], max: [xs[i + 1], ys[j + 1], zs[k + 1]] });
  return out;
}
// a point in a polygon (even–odd)
function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// an annulus filled with cells as wide as its wall (its rings' least gap, at least WALL, at most the course), in
// courses: a cell is in where its middle is inside the outer ring and outside the inner; neighbours share faces exactly
function ringCells(R, id) {
  const gap = Math.min(...R.outer.map((p, i) => Math.hypot(p[0] - R.inner[i][0], p[1] - R.inner[i][1])));
  const cell = Math.min(COURSE, Math.max(WALL, gap));
  const xs = R.outer.map((p) => p[0]), ys = R.outer.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), nx = Math.ceil((Math.max(...xs) - x0) / cell), ny = Math.ceil((Math.max(...ys) - y0) / cell);
  const zs = cuts(R.z0, R.z1, COURSE), out = [], on = new Set();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cx = x0 + (i + 0.5) * cell, cy = y0 + (j + 0.5) * cell;
    if (inside(R.outer, cx, cy) && !inside(R.inner, cx, cy)) on.add(j * nx + i);
  }
  // cells that meet only at a corner hold nothing sideways: the cell beside them bridges the corner
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!on.has(j * nx + i)) continue;
    for (const [di, dj] of [[1, 1], [-1, 1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || a >= nx || b >= ny || !on.has(b * nx + a) || on.has(j * nx + a) || on.has(b * nx + i)) continue;
      on.add(j * nx + a);
    }
  }
  for (const n of [...on].sort((p, q) => p - q)) {
    const i = n % nx, j = (n - i) / nx;
    for (let k = 0; k + 1 < zs.length; k++) out.push({ id: `${id}#${k}.${j}.${i}`, min: [r4(x0 + i * cell), r4(y0 + j * cell), zs[k]], max: [r4(x0 + (i + 1) * cell), r4(y0 + (j + 1) * cell), zs[k + 1]] });
  }
  return out;
}

// a structure's colliders (`structure:<id>:<role>-<i>` or, an annulus's edges, `…-<i>.<e>`) → its blocks, by structure
function structureGroups(colliders, rings) {
  const ringOf = new Map((rings || []).map((r) => [r.of, r]));
  const groups = new Map();
  for (const c of colliders) {
    const m = /^structure:(.+):([a-z]+)-(\d+)(?:\.(\d+))?$/.exec(c?.of || '');
    if (!m) continue;
    const [, sid, role, i, e] = m, g = groups.get(sid) || { id: `structure:${sid}`, kind: 'structure', parts: new Map(), colliders: [] };
    const key = `${role}-${i}`, part = g.parts.get(key) || { role, key, ring: e !== undefined, boxes: [] };
    part.boxes.push(c); g.parts.set(key, part); g.colliders.push(c);
    groups.set(sid, g);
  }
  return [...groups.values()].map((g) => ({
    id: g.id, kind: 'structure', colliders: g.colliders,
    blocks: [...g.parts.values()].flatMap((p) => {
      const at = `${g.id}:${p.key}`, R = p.ring ? ringOf.get(at) : null;
      const list = R ? ringCells(R, at) : p.ring ? p.boxes.map((b, e) => ({ id: `${at}#${e}`, min: [...b.min], max: [...b.max] })) : courses(p.boxes[0].min, p.boxes[0].max, at);
      return list.map((b) => ({ ...b, role: p.role, ...(p.role === 'entablature' ? { lateral: true } : {}) }));
    }),
  }));
}

// a shell house's eave: the lowest face looking up, above its first storey (its roof's foot); none, a flat roof's slab
function eaveOf(box, faces) {
  const z0 = box.min[2], top = box.max[2];
  let eave = Infinity;
  for (const f of faces) {
    const n = f.outNormal || f.normal;
    if (!n || n[2] < 0.3) continue;
    const lo = Math.min(...f.corners.map((c) => c[2]));
    if (lo > z0 + 1.6 && lo < eave) eave = lo;
  }
  return Number.isFinite(eave) && eave < top - 0.05 ? eave : Math.max(z0 + 1, top - 0.3);
}
function houseGroups(colliders, faces) {
  const out = [];
  for (const c of colliders) {
    const m = /^(.+):house$/.exec(c?.of || '');
    if (!m) continue;
    const id = m[1], near = (f) => { const p = mid(f); return p[0] >= c.min[0] - 0.4 && p[0] <= c.max[0] + 0.4 && p[1] >= c.min[1] - 0.4 && p[1] <= c.max[1] + 0.4; };
    const own = faces.filter((f) => f && /^town:/.test(f.group || '') && near(f));
    const eave = r4(eaveOf(c, own)), [x0, y0, z0] = c.min, [x1, y1, z1] = c.max, t = Math.min(WALL, (x1 - x0) / 3, (y1 - y0) / 3);
    const walls = [
      ['s', [x0, y0], [x1, y0 + t], 0], ['n', [x0, y1 - t], [x1, y1], 0],
      ['w', [x0, y0 + t], [x0 + t, y1 - t], 1], ['e', [x1 - t, y0 + t], [x1, y1 - t], 1],
    ];
    const blocks = [];
    for (const [s, a, b, ax] of walls) {
      const along = cuts(a[ax], b[ax], COURSE), zs = cuts(z0, eave, COURSE);
      for (let k = 0; k + 1 < zs.length; k++) for (let i = 0; i + 1 < along.length; i++) {
        const lo = [a[0], a[1], zs[k]], hi = [b[0], b[1], zs[k + 1]]; lo[ax] = along[i]; hi[ax] = along[i + 1];
        blocks.push({ id: `${id}:wall-${s}${k}.${i}`, min: lo.map(r4), max: hi.map(r4), role: 'wall' });
      }
    }
    blocks.push({ id: `${id}:roof`, min: [x0, y0, eave].map(r4), max: [x1, y1, z1].map(r4), role: 'roof' });
    out.push({ id, kind: 'house', colliders: [c], blocks, eave });
  }
  return out;
}

// seat what rests on nothing on the top under it (a capital's gap), lowest first
function seat(blocks, footZ) {
  const sorted = [...blocks].sort((a, b) => a.min[2] - b.min[2]);
  let seated = 0;
  for (const b of sorted) {
    if (b.min[2] <= footZ + TOUCH) continue;
    const under = sorted.filter((s) => s !== b && ovl(b, s, 0) > 1e-3 && ovl(b, s, 1) > 1e-3 && s.max[2] <= b.min[2] + TOUCH);
    // nothing under it at all, a storey or less off its group's foot: it reaches down to the foot (a column's plinth on the land)
    if (!under.length) { if (!b.lateral && b.min[2] - footZ <= SEAT) { b.min[2] = r4(footZ); seated++; } continue; }
    const top = Math.max(...under.map((s) => s.max[2]));
    if (b.min[2] - top <= TOUCH) continue;
    // (a capital's gap is a small part of the shaft under it: a course is never stretched past a third again its height)
    const gap = b.min[2] - top;
    for (const s of under) if (Math.abs(s.max[2] - top) <= TOUCH && gap <= Math.max(0.25, (s.max[2] - s.min[2]) / 3)) { s.max[2] = r4(b.min[2]); seated++; }
  }
  return seated;
}

function matterFor(role, matterOf, kind) {
  const pick = (r) => (matterOf && matterOf[r] ? matterOf[r] : null);
  if (role === 'roof') { const m = pick('roof') || pick('wall'); return { matter: m ? m.matter : 'ceramic', fill: m?.fill ?? ROOF_FILL }; }
  const m = pick('wall');
  return m ? { matter: m.matter, ...(m.fill !== undefined ? { fill: m.fill } : {}) } : { matter: kind === 'house' ? 'brick' : 'stone' };
}

export function shellBlocks(payload, { rings = null, matterOf = null, floor = 0, hp = 6 } = {}) {
  const faces = Array.isArray(payload?.faces) ? payload.faces : [], colliders = Array.isArray(payload?.colliders) ? payload.colliders : [];
  const groups = [...structureGroups(colliders, rings), ...houseGroups(colliders, faces)];
  if (!groups.length) return null;
  const breakables = [], footings = [], gone = new Set(), owner = new Map();
  for (const g of groups) {
    for (const c of g.colliders) gone.add(c);
    const footZ = Math.min(...g.blocks.map((b) => b.min[2]));
    const seated = seat(g.blocks, footZ);
    g.seated = seated;
    // the land under its lowest blocks holds: a fixed footing a hand deep under each, where the level's floor does not
    if (footZ > floor + TOUCH) for (const b of g.blocks) if (b.min[2] <= footZ + TOUCH) footings.push({ min: [b.min[0], b.min[1], r4(footZ - 0.1)], max: [b.max[0], b.max[1], r4(footZ)], of: `${g.id}:footing` });
    for (const b of g.blocks) {
      const own = matterFor(b.role, matterOf, g.kind), m = resolveMatter(own.matter, `${b.id}.matter`);
      breakables.push({ id: b.id, min: b.min, max: b.max, hp, ...(b.lateral ? { bond: 'lateral' } : {}), ...blockMatter(b, own, `${b.id}.matter`), cut: cutOfMatter(m) });
      owner.set(b.id, g);
    }
  }
  // each face of a group to the block that holds its middle, else the nearest of its group's
  const byGroup = new Map(groups.map((g) => [g.id, breakables.filter((b) => owner.get(b.id) === g)]));
  const structureOf = (f) => { const m = /^structure:(.+):[a-z]+$/.exec(f.group || ''); return m ? `structure:${m[1]}` : null; };
  const houses = groups.filter((g) => g.kind === 'house');
  const out = faces.map((f) => {
    if (!f || !Array.isArray(f.corners) || typeof f.node === 'string') return f;
    let list = null;
    const sid = structureOf(f);
    if (sid && byGroup.has(sid)) list = byGroup.get(sid);
    else if (/^town:/.test(f.group || '')) {
      const p = mid(f), h = houses.find((g) => { const c = g.colliders[0]; return p[0] >= c.min[0] - 0.4 && p[0] <= c.max[0] + 0.4 && p[1] >= c.min[1] - 0.4 && p[1] <= c.max[1] + 0.4; });
      if (h) list = byGroup.get(h.id);
    }
    if (!list || !list.length) return f;
    const p = mid(f);
    let best = null, bd = Infinity;
    for (const b of list) { const d = boxDist(b, p); if (d < bd - 1e-9) { bd = d; best = b; } }
    return { ...f, node: best.id, group: `break:${best.id}` };
  });
  return {
    breakables, faces: out, colliders: [...colliders.filter((c) => !gone.has(c)), ...footings], footings,
    groups: groups.map((g) => ({ id: g.id, kind: g.kind, blocks: g.blocks.length, seated: g.seated, ...(g.eave !== undefined ? { eave: g.eave } : {}) })),
  };
}
