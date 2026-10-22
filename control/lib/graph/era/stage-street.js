/**
 * THE STREET THROUGH A STAGE TOWN — the stretch of a stage's trail its town stands along laid as the town's language's
 * street: the lane's section (era/out-town.js TOWN_CARD: its road five metres, its footway the anchor's) built by the
 * anchor's own section (era/out-anchor-elements.js `build.section`: the road in its paving, the edge in its walk's form
 * (a kerb set on end, a flush channel with posts, a boardwalk's fascia, a verge), the walk at its lift) on both sides,
 * draped on the land along the trail's line; its lamps at their stride on one side, the head over the road; its posts
 * where the walk is flush; a path of slabs from the walk to each house's door. The houses are seated to front it
 * (era/stage-buildings.js), so they stand behind its footway.
 *
 *   streetSpan(L)                     { R, foot, half }: the road's half width, the footway's width, the street's half
 *   layStreet(site, L, span, opts)    → { faces, clear(x, y) }: the street's faces (painted, lit and dressed as the
 *                                       houses are) and what of the land it covers (its growth and its trail cleared)
 *
 * Faces carry their surface: the road and walk in their paving's (`street:road`, `street:walk`, a kerb `street:kerb`),
 * lamps and posts in the language's timber and stone. On a gen-7 cube the town's `dress` lays each paving from relief
 * (era/town-dress.js: `street:<paving>`, or a style's `street:road` / `street:walk` words). Pure: no dice.
 */
import { build as EB } from './out-anchor-elements.js';
import { TOWN_CARD } from './out-town.js';
import { dressTownFace } from './town-dress.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const STEP = 1, LIFT = 0.035, GLOW = '#f4e2b0';

/** The lane's section in the language: the road's half width, its footway, the street's half width to the walk's back. */
export function streetSpan(L) {
  const R = TOWN_CARD.ranks.lane.w / 2, foot = Math.round(L.street.footway.w * TOWN_CARD.section.lane.foot * 1000) / 1000;
  return { R, foot, half: R + foot };
}

// the surface a section's face stands for, and the dress key that lays its paving
function surfaceOf(f, S) {
  if (f.part === 'kerb') return { paint: f.group === 'str:timber' ? 'str:timber' : 'str:stone', key: 'kerb' };
  const road = f.corners.every((c) => c[1] <= 1e-6), grass = f.group === 'town:grass';
  if (grass) return { paint: 'grass', key: null };
  if (road) return { paint: S.road.paving === 'earth' ? 'soil' : 'str:stone', key: S.road.paving === 'earth' ? null : 'road', paving: S.road.paving };
  return { paint: f.group === 'str:timber' ? 'str:timber' : 'str:stone', key: f.group === 'str:timber' ? null : 'walk', paving: S.footway.paving };
}

/**
 * The street from `y0` to `y1` along the trail (`site.trailX(y)`), on the land (`opts.ground(x, y)`, else the site's),
 * both sides; `opts.paint(group, value)` the stage's paint, `opts.lit(n)` its light, `opts.soil` / `opts.grass` the
 * trail's and the land's own colours, `opts.dress` the town's dress, `opts.doors` the houses' doors ({ at, N, floor })
 * each given a path of slabs from the walk.
 */
export function layStreet(site, L, span, { y0, y1, ground, paint, lit, soil, grass, dress, doors = [] }) {
  const S = L.street, { R, foot, half } = span, out = [];
  const zAt = (x, y) => ground?.(x, y) ?? site.ground(x, y);
  const lineAt = (y) => { const x = site.trailX(y), d = (site.trailX(y + 0.5) - site.trailX(y - 0.5)), t = unit([d, 1, 0]); return { p: [x, y], t, n: [t[1], -t[0]] }; };
  // (a lamp's glass glows warm whatever the light: it is the light)
  const colour = (sf, v, n) => (sf.paint === 'soil' ? soil : sf.paint === 'grass' ? grass : sf.paint === 'glow' ? GLOW : paint(sf.paint, Math.min(1, v * lit(n))));
  const put = (corners, sf, v, extra = {}) => {
    const n = unit(cross(sub3(corners[1], corners[0]), sub3(corners[corners.length - 1], corners[0])));
    const fill = colour(sf, v, n);
    let F = { corners: corners.map((c) => c.map(r5)), group: `street:${sf.key ?? sf.paint}`, fill, cornerFills: corners.map(() => fill), normal: n.map(r5), outNormal: n.map(r5), ...extra };
    // (a gen-7 cube's paving laid from relief: the style's road or walk word, else the paving's own)
    if (dress && sf.key && (sf.key === 'road' || sf.key === 'walk')) { const k = dress[`street:${sf.key}`] ? `street:${sf.key}` : `street:${sf.paving}`; F = dressTownFace(F, k, dress); }
    out.push(F);
  };
  // (along, across, up is a mirror on one side: a mapped face is wound so it faces as its local normal says)
  const orient = (P, ln, A, s) => {
    const n = unit(cross(sub3(P[1], P[0]), sub3(P[P.length - 1], P[0]))), tn = unit([A.t[0] * ln[0] + s * A.n[0] * ln[1], A.t[1] * ln[0] + s * A.n[1] * ln[1], ln[2]]);
    return dot(n, tn) < 0 ? P.slice().reverse() : P;
  };
  // a local face (x along, y across from the kerb line, z up) mapped onto the trail between two lines, on the land
  const mapFace = (f, A, B, len, s) => {
    const P = f.corners.map(([x, y, z]) => {
      const k = len > 0 ? x / len : 0, across = s * (R + y), a = [A.p[0] + A.n[0] * across, A.p[1] + A.n[1] * across], b = [B.p[0] + B.n[0] * across, B.p[1] + B.n[1] * across];
      const px = a[0] + (b[0] - a[0]) * k, py = a[1] + (b[1] - a[1]) * k;
      return [px, py, zAt(px, py) + LIFT + z];
    });
    return orient(P, f.normal, A, s);
  };
  for (let y = y0; y < y1 - 1e-6; y += STEP) {
    const ya = y, yb = Math.min(y1, y + STEP), A = lineAt(ya), B = lineAt(yb), len = Math.hypot(B.p[0] - A.p[0], B.p[1] - A.p[1]);
    for (const s of [1, -1]) {
      const local = [];
      EB.section(local, len, R, S, { depth: 1 });
      for (const f of local) { if (f.tile) continue; put(mapFace(f, A, B, len, s), surfaceOf(f, S), f.value); }
    }
  }
  // furniture: lamps on one side at their stride, the arm reaching over the road; posts along a flush walk, both sides
  const furniture = (build, el, yy, across, s) => {
    const A = lineAt(yy), base = [A.p[0] + A.n[0] * s * across, A.p[1] + A.n[1] * s * across], z0 = zAt(base[0], base[1]) + LIFT + (S.footway.form === 'kerbed' || S.footway.form === 'boards' ? S.kerb.h : 0), local = [];
    build(local, el, 1);
    for (const f of local) {
      // (as the section: local y away from the road, so a bracket's −y reaches over it)
      const P = f.corners.map(([x, y, z]) => [base[0] + A.t[0] * x + s * A.n[0] * y, base[1] + A.t[1] * x + s * A.n[1] * y, z0 + z]);
      const sf = { paint: f.group === 'dress:timber' ? 'str:timber' : f.group === 'dress:paint' ? 'glow' : 'str:stone', key: null };
      put(orient(P, f.normal, A, s), sf, f.value, { group: f.group === 'dress:paint' ? 'street:lamp' : `street:${sf.paint.replace('str:', '')}` });
    }
  };
  const lampAt = R + S.kerb.w + 0.4, flush = S.footway.form === 'flush';
  for (let yy = y0 + S.lamp.stride / 2; yy < y1; yy += S.lamp.stride) furniture(EB.lamp, S.lamp, yy, lampAt, 1);
  if (flush) for (const s of [1, -1]) for (let yy = y0 + 0.6; yy < y1; yy += S.post.stride) furniture(EB.post, S.post, yy, R + 0.2, s);
  // a path of slabs from the walk's back to each door: the town map's door path
  for (const d of doors) {
    const back = [d.at[0] + d.N[0] * 0.2, d.at[1] + d.N[1] * 0.2], A = lineAt(back[1]), side = Math.sign((back[0] - A.p[0]) * A.n[0] + (back[1] - A.p[1]) * A.n[1]) || 1;
    const edge = [A.p[0] + A.n[0] * side * half, A.p[1] + A.n[1] * side * half], run = Math.hypot(back[0] - edge[0], back[1] - edge[1]);
    if (run < 0.3) continue;
    const u = [(edge[0] - back[0]) / run, (edge[1] - back[1]) / run], w = [-u[1] * 0.6, u[0] * 0.6], nSl = Math.max(1, Math.round(run / 0.75));
    for (let k = 0; k < nSl; k++) {
      const a = (k / nSl) * run + 0.06, b = ((k + 1) / nSl) * run - 0.06, pa = [back[0] + u[0] * a, back[1] + u[1] * a], pb = [back[0] + u[0] * b, back[1] + u[1] * b];
      const C = [[pa[0] - w[0], pa[1] - w[1]], [pb[0] - w[0], pb[1] - w[1]], [pb[0] + w[0], pb[1] + w[1]], [pa[0] + w[0], pa[1] + w[1]]].map(([x, yy]) => [x, yy, zAt(x, yy) + LIFT]);
      const n = unit(cross(sub3(C[1], C[0]), sub3(C[3], C[0])));
      put(n[2] < 0 ? C.slice().reverse() : C, { paint: 'str:stone', key: 'walk', paving: 'slabs' }, 0.68);
    }
  }
  // what the street covers: the land's growth and its trail, between its walks
  const clear = (x, y) => { if (y < y0 - 0.5 || y > y1 + 0.5) return false; const A = lineAt(y); return Math.abs((x - A.p[0]) * A.n[0] + (y - A.p[1]) * A.n[1]) <= half + 0.3; };
  return { faces: out, clear };
}
