/**
 * WALKMESH LAWS — what a plate is judged by. Measured and advised, never refused.
 *
 *   WALK_LAWS            law → one line
 *   walkAdvice(wm)       [{ law, at, advice }] over a read walkmesh (walkmesh.js readWalkmesh)
 *   floorGroups(plate)   the floor's connected pieces: painted polygons that touch, or the bake's 4-connected cells
 *   groupOf(plate, x)    the piece a point (an exit's middle, a spawn) stands on, or −1
 */
import { figureSpan, lift } from './camera.js';
import { plateMask } from './mask.js';
import { inPoly, edgeDist, touches } from './geom.js';
import { components, cellOf } from './bake.js';

export const WALK_LAWS = Object.freeze({
  'floor-below-horizon': 'Every floor point sits below the horizon: a point on or above it never lands on the ground.',
  'floor-in-plate': 'The floor lies inside the plate; what the camera cannot see, the figure cannot walk.',
  'exit-on-edge': 'An exit lies on the floor\'s edge, where the figure leaves the walkable ground.',
  'exit-resolves': 'An exit goes to an exit that exists, on a plate that exists, and that exit leads back.',
  'spawn-on-floor': 'A spawn stands on the floor.',
  'reachable': 'From where the figure starts on a plate, it reaches every exit on it.',
  'occluder-grounded': 'An occluder stands on the floor: its base line meets the walkable ground, so the figure is behind it exactly when its feet are farther.',
  'figure-scale': 'The figure reads at every depth: no taller than the plate at the front, no smaller than a glyph at the back.',
  'start-resolves': 'The walkmesh starts at a spawn that exists.',
});

const EDGE_TOL = 0.012;      // of the plate's diagonal
const TOO_BIG = 0.92, TOO_SMALL = 0.035;   // of the plate's height
const REACH = 3;             // bake cells an exit may sit off the walking floor (a wall's thickness)

export function floorGroups(plate) {
  if (plate.source === 'baked') { const c = components(plate.bake); return { count: c.count, label: c.label }; }
  const polys = plate.floor.map((f) => f.px), tol = Math.hypot(...plate.size) * EDGE_TOL, group = polys.map((_, i) => i);
  const root = (i) => (group[i] === i ? i : (group[i] = root(group[i])));
  for (let a = 0; a < polys.length; a++) for (let b = a + 1; b < polys.length; b++) if (touches(polys[a], polys[b], tol)) group[root(a)] = root(b);
  const roots = [...new Set(polys.map((_, i) => root(i)))];
  return { count: roots.length, of: polys.map((_, i) => roots.indexOf(root(i))) };
}

export function groupOf(plate, x, groups = floorGroups(plate)) {
  if (plate.source === 'baked') {
    if (!x.m) return -1;
    const k = cellOf(plate.bake, x.m);
    if (k >= 0 && groups.label[k] >= 0) return groups.label[k];
    // an exit sits on the edge (in a wall's doorway, past the grid): the nearest walking cell within REACH cells
    const { nx, ny, cell, origin } = plate.bake, i0 = Math.floor((x.m[0] - origin[0]) / cell), j0 = Math.floor((x.m[1] - origin[1]) / cell);
    for (let d = 1; d <= REACH; d++) for (let j = j0 - d; j <= j0 + d; j++) for (let i = i0 - d; i <= i0 + d; i++) if (i >= 0 && i < nx && j >= 0 && j < ny && groups.label[j * nx + i] >= 0) return groups.label[j * nx + i];
    return -1;
  }
  const tol = Math.hypot(...plate.size) * EDGE_TOL;
  const i = plate.floor.findIndex((f) => inPoly(x.px, f.px) || edgeDist(x.px, f.px) <= tol);
  return i < 0 ? -1 : groups.of[i];
}

const mid = (e) => ({ px: e.px.every(Boolean) ? [(e.px[0][0] + e.px[1][0]) / 2, (e.px[0][1] + e.px[1][1]) / 2] : null, m: e.m.every(Boolean) ? [(e.m[0][0] + e.m[1][0]) / 2, (e.m[0][1] + e.m[1][1]) / 2, 0] : null });

export function walkAdvice(wm) {
  const out = [], byId = new Map(wm.plates.map((p) => [p.id, p]));
  for (const p of wm.plates) {
    const [W, H] = p.size, tol = Math.hypot(W, H) * EDGE_TOL, groups = floorGroups(p);
    if (!p.floor.length) { out.push({ law: 'reachable', at: p.id, advice: 'the plate has no floor: draw the walkable ground as floor polygons' }); continue; }
    if (p.source === 'painted') {
      for (const f of p.floor) {
        const above = f.px.filter((q, k) => !f.m[k]);
        if (above.length) out.push({ law: 'floor-below-horizon', at: `${p.id} · ${f.id}`, advice: `${above.length} point${above.length > 1 ? 's' : ''} at or above the horizon (y ${Math.round(p.horizon)}); bring ${above.length > 1 ? 'them' : 'it'} down onto the ground` });
        const out_ = f.px.filter(([x, y]) => x < -1 || y < -1 || x > W + 1 || y > H + 1);
        if (out_.length) out.push({ law: 'floor-in-plate', at: `${p.id} · ${f.id}`, advice: `${out_.length} point${out_.length > 1 ? 's' : ''} outside the plate (${W}×${H})` });
      }
      for (const o of p.occluders) {
        const on = p.floor.some((f) => inPoly(o.foot, f.px) || edgeDist(o.foot, f.px) <= tol);
        if (!o.m || !on) out.push({ law: 'occluder-grounded', at: `${p.id} · ${o.id}`, advice: `its base (y ${Math.round(o.base)}) does not meet the floor; set base to where it stands, or extend the floor under it` });
      }
    }
    const starts = [];
    for (const s of p.spawns) {
      const g = groupOf(p, s, groups);
      if (g < 0 || (p.source === 'painted' && !p.floor.some((f) => inPoly(s.px, f.px)))) out.push({ law: 'spawn-on-floor', at: `${p.id} · ${s.id}`, advice: 'the spawn is off the floor' });
      else starts.push(g);
    }
    for (const e of p.exits) {
      const g = groupOf(p, mid(e), groups);
      if (g < 0) { out.push({ law: 'exit-on-edge', at: `${p.id} · ${e.id}`, advice: 'the exit is off the floor; lay it on the floor\'s edge' }); continue; }
      if (p.source === 'painted' && !e.px.every((q) => p.floor.some((f) => edgeDist(q, f.px) <= tol))) out.push({ law: 'exit-on-edge', at: `${p.id} · ${e.id}`, advice: 'the exit crosses the floor instead of lying on its edge' });
      if (starts.length && !starts.includes(g)) out.push({ law: 'reachable', at: `${p.id} · ${e.id}`, advice: 'no spawn on this plate reaches it: the floor it stands on is cut off' });
      if (e.to.plate) {
        const t = byId.get(e.to.plate), back = t && t.exits.find((x) => x.id === e.to.exit);
        if (!t) out.push({ law: 'exit-resolves', at: `${p.id} · ${e.id}`, advice: `goes to plate '${e.to.plate}', which does not exist` });
        else if (!back) out.push({ law: 'exit-resolves', at: `${p.id} · ${e.id}`, advice: `goes to '${e.to.plate}.${e.to.exit}', which does not exist` });
        else if (!(back.to.plate === p.id && back.to.exit === e.id)) out.push({ law: 'exit-resolves', at: `${p.id} · ${e.id}`, advice: `'${e.to.plate}.${e.to.exit}' does not lead back here: a one-way cut` });
      }
    }
    if (!p.spawns.length && !p.exits.length) out.push({ law: 'reachable', at: p.id, advice: 'no spawn and no exit: nothing enters this plate' });
    // the figure at the front and at the back of the floor the plate shows (the mask's nearest and farthest rows)
    const mask = plateMask(p, 96), rows = [];
    for (let j = 0; j < mask.h; j++) { const xs = []; for (let i = 0; i < mask.w; i++) if (mask.cells[j * mask.w + i]) xs.push(i); if (xs.length) rows.push([j, xs[xs.length >> 1]]); }
    const at = ([j, i]) => { const m = lift(p.basis, [((i + 0.5) * W) / mask.w, ((j + 0.5) * H) / mask.h]); return m && figureSpan(p.basis, m, p.figure); };
    const near = rows.length && at(rows[rows.length - 1]), far = rows.length && at(rows[0]);
    if (near && near.span > H * TOO_BIG) out.push({ law: 'figure-scale', at: p.id, advice: `the figure is ${Math.round((near.span / H) * 100)}% of the plate at the front (${near.depth.toFixed(1)} m); raise the eye${p.source === 'painted' ? ' (ground.height)' : ''} or pull the floor back` });
    if (far && far.span < H * TOO_SMALL) out.push({ law: 'figure-scale', at: p.id, advice: `the figure is ${Math.max(1, Math.round(far.span))} px at the back (${far.depth.toFixed(1)} m); end the floor nearer or lower the eye` });
  }
  const [sp, ss] = String(wm.start).split('.'), sPlate = byId.get(sp);
  if (!sPlate || !sPlate.spawns.some((s) => s.id === ss)) out.push({ law: 'start-resolves', at: 'start', advice: `starts at '${wm.start}', which is not a spawn` });
  return out;
}
