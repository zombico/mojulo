/**
 * historic/solver/views — the eye-level views read off the armature (the street, the monument, the water, a gate, an
 * activity), what a slice of life may be cut round (its foci), and the slice's window when the scene is a slice.
 */
import { C } from '../layout-kit.js';
import { toward } from './site.js';
import { centre, frontEdge, sideToward } from './context.js';

/** The scales a historic scene is solved at: the town, the town in its region, a slice of life cut from the region. */
export const SCENES = Object.freeze(['city', 'region', 'slice']);
/** A slice of life: this much ground, metres, round its focus. */
export const SLICE = Object.freeze([170, 125]);
/** What a slice may be cut round, besides a form's activities. */
export const SLICE_FOCI = Object.freeze(['street', 'monument', 'water', 'gate', 'market']);

/** The views and foci; for a slice, the window cut round its focus. */
export function layViews(X) {
  const { rows, cols, at, surf, mid, hAt, gate, mRect, mFacing, front, apron, mcx, mcy, mZ, M, AR, square, terrace, water, frame, gates, townCentre, approach, activities, view, focus, culture } = X;
  const views = X.views = {}, foci = X.foci = {};
  const eyeOn = (x, y) => [x, y, hAt(x, y) + 1.7];
  const look = (x, y, z) => [x, y, z];
  const [MW, MD] = M.size;
  const mTop = mZ + Math.min(30, Math.max(MW, MD) * 0.25);
  // the street view: on a main street some 70 m from the precinct's gate, looking up at the monument
  {
    let best = null;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (at(c, r) !== C.LANE || !surf[r * cols + c]) continue;
      const [x, y] = mid(c, r), dd = Math.abs(Math.hypot(x - gate[0], y - gate[1]) - 70);
      if (!best || dd < best.dd) best = { x, y, dd };
    }
    if (best) { views.street = { eye: eyeOn(best.x, best.y), at: look(mcx, mcy, mTop) }; foci.street = [best.x, best.y]; }
  }
  {
    const [fx, fy] = frontEdge(mRect, mFacing), off = apron + 14, ex = fx + front[0] * off, ey = fy + front[1] * off;
    views.monument = { eye: [ex, ey, hAt(ex, ey) + 1.7 + (square || AR.eyeLevel ? 0 : terrace)], at: look(mcx, mcy, mZ + Math.min(14, mTop - mZ)) };
    foci.monument = [ex, ey];
  }
  if (water.kind !== 'none') {
    let best = null;
    const o = Math.min(8, water.width / 3);   // open water round the eye: a canal is narrow
    for (let k = 0; k < 1600; k++) { const x = (k % 40) / 40 * frame.w + 2, y = Math.floor(k / 40) / 40 * frame.d + 2; if (!water.isWater(x, y) || ![[o, 0], [-o, 0], [0, o], [0, -o]].every(([dx, dy]) => water.isWater(x + dx, y + dy))) continue; const dd = Math.hypot(x - mcx, y - mcy); if (!best || dd < best.dd) best = { x, y, dd }; }
    if (best) { views.water = { eye: [best.x, best.y, water.z + 2.2], at: look(mcx, mcy, mTop) }; foci.water = [best.x, best.y]; }
  }
  if (gates.length) { const [gc, gr] = gates[0], [x, y] = mid(gc, gr), o = toward(sideToward(townCentre, [x, y])); views.gate = { eye: eyeOn(x + o[0] * 30, y + o[1] * 30), at: look(x, y, hAt(x, y) + 6) }; foci.gate = [x, y]; }
  if (approach.market) { const [x, y] = centre(approach.market); foci.market = [x, y]; }
  for (const a of activities) { const [x, y] = a.centre, ex = x + a.rect.w * 0.5 + 16, ey = y + 18; views[a.id] = { eye: eyeOn(ex, ey), at: look(x, y, hAt(x, y) + 2) }; foci[a.id] = [x, y]; }
  X.win = { x: 0, y: 0, w: frame.w, d: frame.d };
  if (view === 'slice') {
    const fid = focus ?? (activities[0]?.id ?? 'street');
    if (!foci[fid]) throw new Error(`historic: ${culture} has no slice of life round '${fid}' — one of ${Object.keys(foci).map((f) => `'${f}'`).join(', ')}`);
    const [fx, fy] = foci[fid], [sw, sd] = SLICE;
    const win = X.win = { x: Math.max(0, Math.min(frame.w - sw, fx - sw / 2)), y: Math.max(0, Math.min(frame.d - sd, fy - sd / 2)), w: sw, d: sd };
    // the slice's own eye: at its focus, looking across it
    const eye = eyeOn(fx + sw * 0.28, fy + sd * 0.3);
    for (const k of Object.keys(views)) if (!views[k].eye.every((v, i) => i > 1 || (v >= win.x && v <= (i ? win.y + win.d : win.x + win.w)))) delete views[k];
    views.slice = { eye, at: look(fx, fy, hAt(fx, fy) + 2) };
  }
}
