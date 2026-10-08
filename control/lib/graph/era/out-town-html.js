/**
 * THE TOWN, drawn — the full town in miniature: a top-down map (the ground by level, the fields, every building's cast
 * shadow, the routes paved by rank, the square laid in fans round its well, the retaining walls and their stairs, the
 * door paths, the roofs with their courses, the dress) and the same town in axonometric, terraces standing up. Plus
 * the cards that explain it: routes and levels, paving, roofs, and the town's interceptors. Data: era/out-town.js,
 * era/out-town-dress.js, era/out-structures.js. Pure.
 */
import { TOWN_CARD, TOWN_LAWS, PAVINGS, HEARTBEATS, HEARTBEAT_IDS, heartbeatBand, ribbon, along, placedFaces, designTown, boundaryFaces, streetTile, fortFaces } from './out-town.js';
import { castleFaces } from './out-castle.js';
import { BOUNDARY_FORMS, BOUNDARY_HEIGHTS, BOUNDARY_ROLES, BOUNDARY_ROLE_IDS, WALK_FORMS, WALK_FORM_IDS, boundaryRoles, roleHeight, build as EB } from './out-anchor-elements.js';
import { TOWN_DRESS, TOWN_DRESS_IDS, dressTown } from './out-town-dress.js';
import { COVERINGS, STRUCTURE_RINGS, eyeSpot } from './out-structures.js';
import { decompileAnchor, speak } from './out-anchor-structure.js';
import { drawStructures, fig, SUN } from './out-structures-draw.js';
import { paintStop, streetPaints } from './out-structures-paint.js';
import { hexOfRgb } from './style/swatches.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (v) => (typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : String(v));
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let UID = 0;
/** Clip ids restart per page, so a page is the same bytes every time. */
export const resetTownIds = () => { UID = 0; };
// a surface group at a value: painted by the paint, or its grey when the town is drawn as built
const tint = (paint, group, v) => { if (!paint) { const g = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0'); return `#${g}${g}${g}`; } return hexOfRgb(paintStop(paint, group, v)); };

/** A town's buildings as face groups, each lot in its household's paint (the street's rules) when a paint is given. */
export function townFaces(town, paint, pick = () => true, { tile = () => true } = {}) {
  const P = paint ? streetPaints(paint, town).paints : null;
  return town.lots.map((l, i) => (pick(l) ? placedFaces(l, { tile: tile(l), paint: P?.[i] ?? null }) : null)).filter(Boolean);
}

// ── the map ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The joints of a paving inside a route's ribbon, depicted at a legible scale (a course drawn for every two laid). */
function joints(pts, w, paving, seed) {
  const R = mulberry32(seed), d = [], L = pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  const at = (s, t) => { const c = along(pts, s); return [c.p[0] - c.t[1] * t, c.p[1] + c.t[0] * t]; };
  if (paving === 'setts') for (let s = 0; s < L; s += 0.64) { const a = at(s, -w / 2), b = at(s, w / 2); d.push([a, b]); for (let t = -w / 2 + ((s / 0.64) % 2 ? 0.32 : 0.64); t < w / 2; t += 0.64) d.push([at(s, t), at(s + 0.64, t)]); }
  else if (paving === 'flags') for (let s = 0; s < L; s += 0.9 + R() * 0.3) { const j = (R() - 0.5) * 0.3; d.push([at(s + j, -w / 2), at(s - j, w / 2)]); for (let t = -w / 2 + 0.5 + R() * 0.5; t < w / 2 - 0.3; t += 0.8 + R() * 0.5) d.push([at(s, t), at(s + 1, t + (R() - 0.5) * 0.2)]); }
  else if (paving === 'earth') for (const t of [-0.75, 0.75]) for (let s = 0; s < L; s += 2.2) d.push([at(s, t), at(s + 1.4, t)]);
  return d;
}
const segPath = (segs, X, Y) => segs.map(([a, b]) => `M${X(a[0])} ${Y(a[1])}L${X(b[0])} ${Y(b[1])}`).join('');

/**
 * The town from straight above, at `px` pixels a metre: everything the town map says, in the kit's swatches. The
 * buildings and dress are drawn by the structures drawer in plan, on the same frame as the ground under them.
 */
export function townMapSvg(town, paint, dressed, { px = 7, labels = true } = {}) {
  const B = town.bounds, W = Math.round((B.x1 - B.x0) * px), H = Math.round((B.y1 - B.y0) * px), id = `tm${++UID}`;
  // shade is the ground's deepest stop under a paint, black as built
  const dark = paint ? tint(paint, 'town:grass', 0) : '#000000';
  const X = (x) => ((x - B.x0) * px).toFixed(1), Y = (y) => ((B.y1 - y) * px).toFixed(1), poly = (pts) => pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
  const g = [];
  // the ground, by level: one grass, each level under the top a little deeper in the air's shade
  g.push(`<rect width="${W}" height="${H}" fill="${tint(paint, 'town:grass', 0.45)}"/>`);
  town.terraces.forEach((t, k) => g.push(`<rect x="0" y="${Y(t.y)}" width="${W}" height="${(H - +Y(t.y)).toFixed(1)}" fill="${dark}" opacity="0.09"/>`));
  // the fields, furrowed
  for (const f of town.farms) { g.push(`<polygon points="${poly(f.field)}" fill="${tint(paint, 'town:soil', 0.66)}"/>`); const [a, , c] = f.field, rows = []; for (let y = a[1] + 1; y < c[1]; y += 1.4) rows.push([[a[0] + 0.5, y], [c[0] - 0.5, y]]); g.push(`<path d="${segPath(rows, X, Y)}" stroke="${tint(paint, 'town:soil', 0.3)}" stroke-width="1.1"/>`); }
  // shadows: every building and doodad cast on the ground under it, the sun's way, as one tone
  const shade = [], k = -SUN[2], sx = (0.55 * SUN[0]) / k, sy = (0.55 * SUN[1]) / k;
  const cast = (faces, z0) => { for (const f of faces) if (!f.tile) shade.push(`<polygon points="${f.corners.map((c) => `${X(c[0] + sx * (c[2] - z0))},${Y(c[1] + sy * (c[2] - z0))}`).join(' ')}"/>`); };
  // routes: the section first (the footway either side in its paving), then the road in its paving's stone, kerbed
  // where it has a footway or its rank has kerbs, the joints clipped to each ribbon
  const routeSvg = [];
  for (const r of town.routes.filter((x) => x.foot)) {
    // the walk in its form: boards in timber, a verge's grass between the road and the path
    const rib = ribbon(r.pts, r.w + 2 * r.foot), boards = r.walkForm === 'boards', F = boards ? { group: 'str:timber', value: 0.44 } : PAVINGS[r.footPaving] ?? PAVINGS.flags, cid = `${id}${r.id}f`;
    routeSvg.push(`<clipPath id="${cid}"><polygon points="${poly(rib)}"/></clipPath><polygon points="${poly(rib)}" fill="${tint(paint, F.group, F.value + 0.06)}"/><path clip-path="url(#${cid})" d="${segPath(joints(r.pts, r.w + 2 * r.foot, boards ? 'earth' : r.footPaving === 'setts' ? 'setts' : 'flags', r.pts.length * 17), X, Y)}" stroke="${tint(paint, F.group, 0.4)}" stroke-width="0.5" fill="none" opacity="0.7"/>`);
    if (r.verge) routeSvg.push(`<polygon points="${poly(ribbon(r.pts, r.w + 2 * (r.verge + 0.06)))}" fill="${tint(paint, 'town:grass', 0.55)}"/>`);
  }
  for (const r of town.routes) {
    const rib = ribbon(r.pts, r.w), P = PAVINGS[r.paving], cid = `${id}${r.id}`;
    routeSvg.push(`<clipPath id="${cid}"><polygon points="${poly(rib)}"/></clipPath><polygon points="${poly(rib)}" fill="${tint(paint, P.group, P.value)}"${(P.kerb || r.foot) && r.walkForm !== 'flush' ? ` stroke="${tint(paint, 'town:stone', 0.3)}" stroke-width="${(0.3 * px).toFixed(1)}"` : ''}/>`);
    routeSvg.push(`<path clip-path="url(#${cid})" d="${segPath(joints(r.pts, r.w, r.paving, r.pts.length * 31), X, Y)}" stroke="${tint(paint, P.group, 0.3)}" stroke-width="${r.paving === 'earth' ? 2 : 0.6}" fill="none" opacity="0.8"/>`);
  }
  // the places: the square laid in fans round its well, the pocket in flags
  for (const p of town.places.filter((x) => x.poly)) {
    const cid = `${id}${p.id}`, rings = [];
    if (p.paving === 'fan') for (let r = 1.6; r < 18; r += 0.9) rings.push(`<circle cx="${X(p.centre[0])}" cy="${Y(p.centre[1])}" r="${(r * px).toFixed(1)}"/>`);
    routeSvg.push(`<clipPath id="${cid}"><polygon points="${poly(p.poly)}"/></clipPath><polygon points="${poly(p.poly)}" fill="${tint(paint, 'town:stone', 0.72)}"/><g clip-path="url(#${cid})" fill="none" stroke="${tint(paint, 'town:stone', 0.35)}" stroke-width="0.6" opacity="0.8">${rings.join('')}</g>`);
  }
  // the boundaries, from above: each run its thickness (a fence at least a line's), gates cut, in its form's material;
  // the retaining walls under their guards, and the stairs, every tread drawn
  const walls = [];
  for (const b of [...town.boundaries].sort((a, c) => (a.role === 'retain' ? -1 : 0) - (c.role === 'retain' ? -1 : 0))) {
    const [a, c] = b.pts, L = Math.hypot(c[0] - a[0], c[1] - a[1]), u = [(c[0] - a[0]) / L, (c[1] - a[1]) / L], n = [-u[1], u[0]], F = BOUNDARY_FORMS[b.form];
    const el = town.language.street.bounds[b.el] ?? {}, group = el.group ?? F.group, w = Math.max(b.t, b.role === 'retain' ? 0.7 : 0.22) / 2, cuts = [...b.gates].sort((x, y) => x.s - y.s), spans = [];
    let s0 = 0; for (const g of cuts) { if (g.s - g.w / 2 > s0) spans.push([s0, g.s - g.w / 2]); s0 = g.s + g.w / 2; } if (s0 < L) spans.push([s0, L]);
    const P = (s, k) => [a[0] + u[0] * s + n[0] * k, a[1] + u[1] * s + n[1] * k], timber = ['rail', 'paling', 'picket'].includes(b.form);
    for (const [x0, x1] of spans) walls.push(`<polygon points="${poly([P(x0, -w), P(x1, -w), P(x1, w), P(x0, w)])}" fill="${tint(paint, group, Math.min(1, (el.value ?? F.value) + (timber ? 0 : 0.14)))}" stroke="${tint(paint, group, 0.18)}" stroke-width="${timber ? 0.5 : 0.8}"/>`);
  }
  for (const s of town.stairs) {
    const x0 = s.at[0] - s.width / 2, y1 = s.at[1], y0 = s.at[1] - s.run, treads = [];
    for (let i = 1; i < s.risers; i++) { const y = y0 + (i * s.run) / s.risers; treads.push([[x0, y], [x0 + s.width, y]]); }
    walls.push(`<rect x="${X(x0 - 0.3)}" y="${Y(y1)}" width="${((s.width + 0.6) * px).toFixed(1)}" height="${(s.run * px).toFixed(1)}" fill="${tint(paint, 'town:stone', 0.7)}" stroke="${tint(paint, 'town:stone', 0.2)}" stroke-width="1"/><path d="${segPath(treads, X, Y)}" stroke="${tint(paint, 'town:stone', 0.3)}" stroke-width="0.8"/>`);
  }
  // door paths: stepping slabs across the front setback
  const slabs = [];
  for (const p of town.paths) { const [a, b] = p.pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]]; for (let s = 0.35; s < L - 0.2; s += 0.75) { const c = [a[0] + u[0] * s, a[1] + u[1] * s], h = 0.3; slabs.push(`<polygon points="${poly([[c[0] - u[0] * h - n[0] * 0.45, c[1] - u[1] * h - n[1] * 0.45], [c[0] + u[0] * h - n[0] * 0.45, c[1] + u[1] * h - n[1] * 0.45], [c[0] + u[0] * h + n[0] * 0.45, c[1] + u[1] * h + n[1] * 0.45], [c[0] - u[0] * h + n[0] * 0.45, c[1] - u[1] * h + n[1] * 0.45]])}"/>`); } }
  // the fortified town or the castle: its ditch dug before the curtain, bridged at the gates; a castle's courts, its
  // walk and its platform
  const ditch = [];
  if (town.castle) ditch.push(...castleGroundSvg(town.castle, poly, paint));
  if (town.fort?.ditchRing) { const { inner, outer } = town.fort.ditchRing; ditch.push(`<path d="M${poly(outer).replace(/ /g, 'L')}ZM${poly(inner).replace(/ /g, 'L')}Z" fill-rule="evenodd" fill="${tint(paint, 'town:soil', 0.24)}" stroke="${tint(paint, 'town:soil', 0.12)}"/>`); for (const f of fortFaces(town, { most: 0 }).floor.filter((x) => x.group === 'str:timber')) ditch.push(`<polygon points="${poly(f.corners)}" fill="${tint(paint, 'str:timber', 0.5)}" stroke="${tint(paint, 'str:timber', 0.2)}"/>`); }
  // the buildings, the fortification and the dress, from above
  const groups = townFaces(town, paint), fortG = fortFaces(town, { most: 1 }).groups, dress = dressed ? dressed.items.map((it) => it.faces) : [];
  town.lots.forEach((l, i) => cast(groups[i], l.z));
  for (const g of fortG) cast(g, Math.min(...g.flatMap((f) => f.corners.map((c) => c[2]))));
  if (dressed) dressed.items.forEach((it) => cast(it.faces, it.at[2]));
  const under = g.join('') + ditch.join('') + routeSvg.join('') + `<g fill="${tint(paint, 'town:stone', 0.75)}">${slabs.join('')}</g>` + walls.join('') + `<g fill="${dark}" opacity="0.2">${shade.join('')}</g>`;
  const lab = [];
  if (labels) {
    const tag = (x, y, t, a = 'middle') => lab.push(`<text x="${X(x)}" y="${Y(y)}" text-anchor="${a}" font-size="12" font-weight="700" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(t)}</text>`);
    for (const p of town.places.filter((x) => !(town.castle && x.id === 'top'))) tag(p.centre[0], p.centre[1] + (p.id === 'square' ? -2 : p.id === 'trailhead' ? -6 : 3), { square: 'the square · reveal', landing: 'the landing', top: 'the landmark', pocket: 'the pocket', trailhead: 'trailhead →' }[p.id] ?? p.id, p.id === 'trailhead' ? 'start' : 'middle');
    town.terraces.forEach((t) => tag(t.x1 - 2, t.y + 2, `terrace ${t.level} · +${n2(t.z1)} m`, 'end'));
    const back = town.routes.find((r) => r.id === 'back'); if (back) tag(back.pts[1][0], back.pts[1][1] + 2.2, 'back lane', 'start');
    const up = town.routes.find((r) => r.id === 'upper'); if (up) tag(up.pts[0][0] + 1, up.pts[0][1] + 2.2, 'upper lane', 'start');
    if (town.castle) { const c = town.castle, k = c.keep, mg = c.gates.find((g) => g.main); tag(mg.at[0], mg.at[1] - c.ditch.d1 - 3, 'the castle gate'); tag(k.at[0], k.at[1] + k.K / 2 + 3, 'the keep'); if (c.courts.fore) tag((c.extent.x0 + c.extent.x1) / 2, c.courts.fore[2][1] - 2.5, 'forecourt'); tag((c.extent.x0 + c.extent.x1) / 2, (c.courts.inner[0][1] + c.courts.inner[2][1]) / 2, 'the inner ward'); }
    if (town.fort) { for (const gt of town.fort.gates) tag(gt.at[0] - gt.n[0] * 9, gt.at[1] - gt.n[1] * 9, gt.main ? 'the gate' : gt.ward ? `ward ${gt.ward} gate` : 'gate'); const kp = town.lots[town.fort.keep]; if (kp) tag(kp.front[0], kp.front[1] + 11, 'the keep'); const ap = town.routes.find((r) => r.id === 'approach'); if (ap) tag(ap.pts[0][0] - 1, ap.pts[0][1], 'approach ↑', 'end'); }
    const sb = [B.x0 + 4, B.y0 + 4];
    lab.push(`<g><rect x="${X(sb[0])}" y="${Y(sb[1] + 1)}" width="${(10 * px).toFixed(1)}" height="${(0.8 * px).toFixed(1)}" fill="#111"/><rect x="${X(sb[0] + 10)}" y="${Y(sb[1] + 1)}" width="${(10 * px).toFixed(1)}" height="${(0.8 * px).toFixed(1)}" fill="#fff" stroke="#111"/><text x="${X(sb[0])}" y="${Y(sb[1] + 2.2)}" font-size="11" fill="#111">0</text><text x="${X(sb[0] + 20)}" y="${Y(sb[1] + 2.2)}" font-size="11" text-anchor="middle" fill="#111">20 m</text></g>`);
    const na = [B.x1 - 6, B.y0 + 6];
    lab.push(`<g><path d="M${X(na[0])} ${Y(na[1] + 4)} l${(-1.4 * px).toFixed(1)} ${(4 * px).toFixed(1)} l${(1.4 * px).toFixed(1)} ${(-1.1 * px).toFixed(1)} l${(1.4 * px).toFixed(1)} ${(1.1 * px).toFixed(1)} z" fill="#111"/><text x="${X(na[0])}" y="${Y(na[1] - 1.6)}" font-size="12" font-weight="700" text-anchor="middle" fill="#111">N</text></g>`);
  }
  return drawStructures([...groups, ...fortG, ...dress], { view: 'plan', paint, w: W, h: H, ppm: px, at: [-B.x0 * px, B.y1 * px], under, over: lab.join('') });
}

/** A castle's ground in plan, as SVG under its walls: the ditch ring, then its floor (the courts, the walk, the platform, the bridge). */
export function castleGroundSvg(c, poly, paint) {
  const out = [], { inner, outer } = c.ditch;
  out.push(`<path d="M${poly(outer).replace(/ /g, 'L')}ZM${poly(inner).replace(/ /g, 'L')}Z" fill-rule="evenodd" fill="${tint(paint, 'town:soil', 0.24)}" stroke="${tint(paint, 'town:soil', 0.12)}"/>`);
  for (const f of castleFaces(c, { most: 0, lots: false }).floor.filter((x) => x.group !== 'town:soil' || x.value > 0.3)) out.push(`<polygon points="${poly(f.corners)}" fill="${tint(paint, f.group, f.value)}" stroke="${tint(paint, f.group, Math.max(0, f.value - 0.25))}" stroke-width="0.5"/>`);
  return out;
}

/** The ground of a town as faces: each level's plane, the routes on it, its retaining walls and stairs (each a group). */
function townGround(town) {
  const B = town.bounds, levels = [{ y0: B.y0, z: 0 }, ...town.terraces.map((t) => ({ y0: t.y, z: t.z1 }))], floor = [], groups = [];
  const q = (pts, group, value, normal = [0, 0, 1]) => ({ corners: pts, normal, part: 'ground', group, value });
  levels.forEach((lv, k) => {
    const y1 = levels[k + 1]?.y0 ?? B.y1;
    floor.push(q([[B.x0, lv.y0, lv.z], [B.x1, lv.y0, lv.z], [B.x1, y1, lv.z], [B.x0, y1, lv.z]], 'town:grass', 0.3));
    for (const f of town.farms) if (k === 0) floor.push(q(f.field.map(([x, y]) => [x, y, 0.01]), 'town:soil', 0.55));
    for (const p of town.places.filter((x) => x.poly)) if (k === 0) floor.push(q(p.poly.map(([x, y]) => [x, y, 0.03]), 'town:stone', 0.75));
    // a route on this level: its points on the level, as one ribbon
    // the footways first, raised by the kerb, then the roads
    const on = (r) => r.pts.filter(([, y]) => y >= lv.y0 + (k ? 0.5 : -1e9) && y < y1 - 0.5);
    for (const r of town.routes.filter((x) => x.foot)) { const pts = on(r); if (pts.length >= 2) floor.push(q(ribbon(pts, r.w + 2 * r.foot).map(([x, y]) => [x, y, lv.z + r.kerbH]), 'town:stone', 0.76)); }
    for (const r of town.routes) {
      const pts = on(r);
      if (pts.length >= 2) floor.push(q(ribbon(pts, r.w).map(([x, y]) => [x, y, lv.z + 0.02]), PAVINGS[r.paving].group, PAVINGS[r.paving].value));
    }
  });
  // the boundaries (the retaining walls and their guards among them), in lengths of 8 m so each stands in the right
  // order with the buildings by it
  // (a whole town is too small to read a wall's laying: its lines come at most with their copings and piers)
  for (const b of town.boundaries) groups.push(...boundaryFaces(town, b, { most: 1 }));
  // the stairs: a block per riser, standing out from the wall into the lower terrace
  for (const s of town.stairs) {
    const g = [], x0 = s.at[0] - s.width / 2, x1 = s.at[0] + s.width / 2;
    for (let i = 0; i < s.risers; i++) {
      const ya = s.at[1] - s.run + (i * s.run) / s.risers, z = s.z0 + (i + 1) * s.R;
      g.push(q([[x0, ya, z], [x1, ya, z], [x1, s.at[1], z], [x0, s.at[1], z]], 'town:stone', 0.75));
      g.push(q([[x0, ya, z - s.R], [x1, ya, z - s.R], [x1, ya, z], [x0, ya, z]], 'town:stone', 0.55, [0, -1, 0]));
      g.push(q([[x1, ya, s.z0], [x1, s.at[1], s.z0], [x1, s.at[1], z], [x1, ya, z]], 'town:stone', 0.5, [1, 0, 0]));
    }
    groups.push(g);
  }
  return { floor, groups };
}

/** The town in axonometric: terraces standing up, every building and doodad in place. */
export function townAxonSvg(town, paint, dressed, { w = 1200, h = 720 } = {}) {
  const { floor, groups } = townGround(town);
  const b = townFaces(town, paint, () => true, { tile: (l) => l.ring === 'near' }), d = dressed ? dressed.items.map((it) => it.faces) : [], F = fortFaces(town, { most: 1 });
  return drawStructures([...groups, ...F.groups, ...b, ...d], { view: 'axon', paint, w, h, pad: 14, floor: [...floor, ...F.floor] });
}

// ── cards ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export function townMapCard(town, paint, dressed) {
  const laws = [...town.laws, ...dressed.laws, ...(paint ? streetPaints(paint, town).laws : [])].map((l) => `<tr><td>${esc(l.law)}</td><td class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'ADVISES'}</td><td>${esc(l.value)}</td><td>${esc(l.want ?? '')}</td></tr>`).join('');
  const rings = Object.keys(STRUCTURE_RINGS).map((r) => `${r} ${town.lots.filter((l) => l.ring === r).length}`).join(' · ');
  return `<div class="card"><h3>The town, in miniature <span class="badge solid">top-down map</span></h3>
<p class="note">Routes first: the lane follows the trail and sways with it; it forks at the reveal into the square, a branch climbs from the square's back through ${town.terraces.length} terrace${town.terraces.length === 1 ? '' : 's'} (each wall climbed by a flight of steps) to the landmark, an upper lane runs along the first terrace, a back lane behind the frontage, and a second way drops to a pocket. Every route is laid in the anchor's section, stepped down the ranks (footways ${esc(town.routes.map((r) => `${r.id} ${r.foot ? `${r.foot} m` : 'none'}`).join(', '))}). Then ${town.lots.length} lots are cut behind the footways in walking order (${esc(rings)}), each building the anchor's language spoken on its lot, at the <b>${esc(town.heartbeat)}</b> heartbeat, ${town.lots.filter((l) => l.secondary).length} of them the anchor's secondary set as punctuation, each household painted by the street's rules. Door paths cross each front; ${town.boundaries.length} boundary runs (${esc([...new Set(town.boundaries.map((b) => b.role))].join(', '))}) keep the lots, the fields and the terraces' edges, the plan's own structures; shadows fall the sun's way. ${dressed.items.length} doodads dress it. North is up.</p>
<div style="overflow-x:auto">${townMapSvg(town, paint, dressed)}</div>
<h3 style="margin-top:10px">The town's laws <span class="badge">machine gate</span></h3><table><tr><th>law</th><th></th><th>value</th><th>want</th></tr>${laws}</table></div>`;
}

export function townAxonCard(town, paint, dressed) {
  return `<div class="card"><h3>The same town, standing up</h3><p class="note">The terraces as levels, their walls and stairs, the near ring with its roof courses, the far ring as masses.</p>${townAxonSvg(town, paint, dressed)}</div>`;
}

export function routesCard(town) {
  const len = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  const routes = town.routes.map((r) => `<tr><td><b>${esc(r.id)}</b></td><td>${esc(r.rank)}</td><td>${n2(len(r.pts))} m</td><td>${r.w} m</td><td>${r.walk ? 'walked' : '—'}</td><td>${esc(r.paving)}</td><td>${esc(r.from ? `forks from the ${r.from}` : '')}</td><td>${town.lots.filter((l) => l.route === r.id).length}</td></tr>`).join('');
  const places = town.places.map((p) => `<tr><td><b>${esc(p.id)}</b></td><td>${esc(p.beat)}</td><td>${esc(p.read)}</td></tr>`).join('');
  const levels = town.stairs.map((s) => `<tr><td>terrace ${s.level}</td><td>+${n2(s.rise)} m (to ${n2(s.z0 + s.rise)} m)</td><td>${s.risers} risers of ${s.R} m, treads ${s.T} m, ${s.flights} flight${s.flights > 1 ? 's' : ''}, ${s.run} m run</td><td class="${s.laws.every((l) => l.ok !== false) ? 'ok' : 'no'}">${s.laws.map((l) => `${l.law} ${l.ok === false ? 'BROKEN' : 'holds'}`).join(' · ')}</td></tr>`).join('');
  const card = Object.entries(TOWN_CARD.ranks).map(([k, r]) => `<tr><td><b>${esc(k)}</b></td><td>${r.w} m</td><td>${r.walk ? 'walked' : '—'}</td><td>${esc(r.paving)}</td><td>${esc(r.read)}</td></tr>`).join('');
  return `<div class="grid g2"><div class="card"><h3>Routes</h3><table><tr><th>route</th><th>rank</th><th>length</th><th>width</th><th></th><th>paving</th><th></th><th>lots</th></tr>${routes}</table>
<h3 style="margin-top:10px">Ranks</h3><table>${card}</table></div>
<div class="card"><h3>Places and levels</h3><table><tr><th>place</th><th>beat</th><th></th></tr>${places}</table>
<h3 style="margin-top:10px">Levels, and how the walk climbs them</h3><table><tr><th>level</th><th>rise</th><th>the flight (out-made steps)</th><th>steps laws</th></tr>${levels || '<tr><td colspan="4" class="note">one level: no walls, no stairs</td></tr>'}</table>
<h3 style="margin-top:10px">Town laws</h3><table>${TOWN_LAWS.map((l) => `<tr><td><b>${esc(l.id)}</b></td><td>${esc(l.want)}</td><td class="note">${esc(l.why)}</td></tr>`).join('')}</table></div></div>`;
}

export function pavingCard(paint) {
  const strip = (paving, w = 4) => {
    const pts = [[0, 0], [8, 0]], px = 26, W = 8 * px, H = w * px + 20, id = `pv${++UID}`, P = PAVINGS[paving];
    const X = (x) => (x * px).toFixed(1), Y = (y) => (H / 2 - y * px).toFixed(1), rib = ribbon(pts, w);
    const fill = tint(paint, P.group, P.value), line = tint(paint, P.group, 0.3);
    let body = `<clipPath id="${id}"><polygon points="${rib.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}"/></clipPath><polygon points="${rib.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}" fill="${fill}"${P.kerb ? ` stroke="${tint(paint, 'town:stone', 0.3)}" stroke-width="${(0.3 * px).toFixed(1)}"` : ''}/>`;
    if (paving === 'fan') { body += `<g clip-path="url(#${id})" fill="none" stroke="${line}" stroke-width="1">${Array.from({ length: 14 }, (_, k) => `<circle cx="${X(4)}" cy="${Y(-3)}" r="${((1.6 + 0.9 * k) * px).toFixed(1)}"/>`).join('')}</g>`; }
    else if (paving === 'slabs') { for (let s = 0.4; s < 8; s += 0.75) body += `<rect x="${X(s - 0.3)}" y="${Y(0.45)}" width="${(0.6 * px).toFixed(1)}" height="${(0.9 * px).toFixed(1)}" fill="${tint(paint, 'town:stone', 0.75)}" stroke="${line}"/>`; body = body.replace(/<polygon[^>]*fill="[^"]*"[^>]*\/>/, `<polygon points="${rib.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}" fill="${tint(paint, 'town:grass', 0.45)}"/>`); }
    else body += `<path clip-path="url(#${id})" d="${segPath(joints(pts, w, paving, 7), X, Y)}" stroke="${line}" stroke-width="${paving === 'earth' ? 3 : 1}" fill="none"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`;
  };
  return `<div class="card"><h3>Paving is the route's rank</h3><p class="note">The finer the way, the finer its bond: the lane in setts with kerbs, a branch in the kit's flags, a back lane beaten earth with its ruts, the square in fans round its well, a door's path in stepping slabs. Joints are the paving's tile (drawn, zero faces), depicted a course for every two laid so they read at the map's scale; the lane holds the man-made paving laws.</p>
<div class="views">${Object.entries(PAVINGS).map(([k, P]) => fig(strip(k, k === 'slabs' ? 1.1 : k === 'fan' ? 6 : 4), `<b>${esc(k)}</b> · ${esc(P.read)}`)).join('')}</div></div>`;
}

export function roofsCard(L0, style, paint, seed) {
  // a language with a pitched cap (the town's, or the timber hall's), its covering swapped: the same roof, four ways laid
  const base = L0.vocab.cap && ['gable', 'hip', 'pyramid'].includes(L0.vocab.cap) ? L0 : decompileAnchor('timber-hall'), lot = { w: 11, d: 18 }, cov = Object.keys(COVERINGS);
  const as = (c) => ({ ...base, courses: c !== 'thatch', values: { ...base.values, cap: { group: `str:${c}`, value: COVERINGS[c].value } } });
  const row = cov.map((c) => { const d = speak(as(c), 'dwelling', lot, style, seed); return fig(drawStructures([[...d.faces, ...d.tile]], { view: 'axon', paint, w: 230, h: 210, ppm: 9 }), `<b>${esc(c)}</b> · least ${COVERINGS[c].min}° · courses ${COVERINGS[c].course || 'none'} m · cap ${COVERINGS[c].cap} m`); }).join('');
  const plan = cov.map((c) => { const d = speak(as(c), 'dwelling', lot, style, seed); return fig(drawStructures([[...d.faces, ...d.tile]], { view: 'plan', paint, w: 160, h: 160, ppm: 11 }), `${esc(c)}, from above`); }).join('');
  const caps = Object.keys(STRUCTURE_RINGS).map((r) => `${r}: ${cov.map((c) => `${c} ${COVERINGS[c].cap * style.tokens.chunk >= eyeSpot(r) ? 'geometry' : 'tile'}`).join(', ')}`).join(' · ');
  return `<div class="card"><h3>Roofs are laid in courses</h3><p class="note">Every pitched slope carries its covering's courses: a course every <i>course</i> m up the slope, each throwing a shadow line on the one under it, clipped to the slope, so a hip's triangles and a gable's planes read as laid at any distance, and a town from above reads as roofs. Thatch has no courses: it is combed, and rolled at the ridge. Courses are the roof's tile (drawn, never counted); the ridge cap is geometry where it covers the eye spot (${esc(caps)}). Shown on ${esc(base.id)}'s language, its covering swapped.</p>
<div class="views">${row}</div><div class="views" style="margin-top:6px">${plan}</div></div>`;
}

export function dressCard(town, style, paint, seed) {
  const full = dressTown(town, style, 1, seed), cat = TOWN_DRESS_IDS.map((k) => {
    const it = full.items.find((x) => x.kind === k), c = full.counts[k];
    const svg = it ? drawStructures([it.faces], { view: 'axon', paint, w: 150, h: 130, ppm: k === 'trees' ? 14 : 30 }) : '<div class="note">no site in this town</div>';
    return `<div class="card"><h3>${esc(k)}</h3>${svg}<p class="note">${esc(TOWN_DRESS[k].read)}</p><p class="note">${c.sites} sites · cap ${c.cap} · least span ${TOWN_DRESS[k].span} m</p></div>`;
  }).join('');
  // the square at three aggressivenesses: the dress grows site by site
  const sq = town.places.find((p) => p.id === 'square'), near = (at) => Math.hypot(at[0] - sq.centre[0], at[1] - sq.centre[1]) < 22;
  const lots = town.lots.filter((l) => near(l.front));
  const steps = [0, 0.5, 1].map((a) => { const d = dressTown(town, style, a, seed); return fig(drawStructures([...townFaces(town, paint, (l) => lots.includes(l)), ...d.items.filter((x) => near(x.at)).map((x) => x.faces)], { view: 'axon', paint, w: 380, h: 300 }), `dress ${a} · ${d.items.length} doodads, ${d.tris} tris`); }).join('');
  return `<div class="card"><h3>Town interceptors <span class="badge">site · grower · aggressiveness</span></h3><p class="note">The room stage's interceptors, outdoors: each kind finds its sites on the town map, takes them by its aggressiveness (0 none, 1 every site), seeded from the town, under a cap. A recipe's <code>dress</code> is one number for every kind or one per kind. Nothing here collides; nothing but a lamp or a sign stands on the walk.</p>
<div class="views">${steps}</div><div class="grid g5" style="margin-top:10px">${cat}</div></div>`;
}

// ── heartbeats ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** The heartbeats as curves (storeys off the heart), and the lane's north frontage of one town at each, in elevation. */
export function heartbeatCard(style, paint, seed, recipe = {}) {
  const W = 300, H = 120, X = (t) => (24 + t * (W - 36)).toFixed(1), Y = (n) => (H - 18 - n * 22).toFixed(1);
  const curve = (id) => { const pts = Array.from({ length: 21 }, (_, i) => i / 20), band = pts.map((t) => heartbeatBand(id, t)); return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polygon points="${[...pts.map((t, i) => `${X(t)},${Y(band[i][1])}`), ...pts.map((t, i) => `${X(t)},${Y(band[i][0])}`).reverse()].join(' ')}" fill="#bbb" stroke="#111" stroke-width="1"/>${[1, 2, 3, 4].map((n) => `<text x="4" y="${+Y(n) + 4}" font-size="10">${n}</text><line x1="20" x2="${W - 8}" y1="${Y(n)}" y2="${Y(n)}" stroke="#ddd"/>`).join('')}<text x="${X(0)}" y="${H - 4}" font-size="10">heart</text><text x="${X(1)}" y="${H - 4}" font-size="10" text-anchor="end">edge</text></svg>`; };
  const rows = HEARTBEAT_IDS.map((id) => {
    const t = designTown(style, seed, { ...recipe, heartbeat: id }), run = t.lots.filter((l) => l.route === 'lane' && l.side === 'left').sort((a, b) => a.s - b.s);
    const st = run.map((l) => l.design.dims.n), law = t.laws.find((l) => l.law === 'heartbeat');
    // the frontage in elevation: each building where it stands along the lane, the lane's sway taken out
    const g = run.map((l) => placedFaces(l, { tile: false, paint: paint ? streetPaints(paint, t).paints[t.lots.indexOf(l)] : null }).map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x, y - l.front[1], z]) })));
    return `<div class="card"><h3>${esc(id)} <span class="badge">${HEARTBEATS[id].heart.join('–')} at the heart · ${HEARTBEATS[id].edge.join('–')} at the edge</span></h3><p class="note">${esc(HEARTBEATS[id].read)}</p><div class="views">${fig(curve(id), 'storeys off the heart')}${fig(drawStructures(g, { view: 'front', paint, w: 640, h: 150, ppm: 4.6 }), `the lane's north frontage: ${st.join(' ')} storeys · ${esc(law.value)}`)}</div></div>`;
  }).join('');
  return `<p class="note">A heartbeat is a curve, not a building: the band of storeys a citizen keeps to, at the heart and at the edge, eased between them by distance off the square; a back lane stands a storey lower; workshops, barns, the hall and the tower keep their own. Below, one town at each, its lane's north frontage drawn in elevation at one scale.</p><div class="grid g2">${rows}</div>`;
}

// ── walks and boundaries ────────────────────────────────────────────────────────────────────────────────────────────
const shift = (faces, dx, dy = 0, dz = 0) => faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x + dx, y + dy, z + dz]) }));
const trisOf = (faces) => faces.filter((f) => !f.tile).reduce((a, f) => a + f.corners.length - 2, 0);

/**
 * The street's structures beside its houses: the walk in each of its equivalent forms, the boundaries by role and
 * height class (against a body), each by degree of detail, and one lot of the town with the lines the plan gives it.
 */
export function boundariesCard(town, style, paint) {
  const L = town.language, SX = L.street, R = town.roles;
  // the walks: the same street, its walk laid four ways, a crossing dropped mid-length
  const walks = WALK_FORM_IDS.map((form) => {
    const S = { ...SX, footway: { ...SX.footway, form, w: form === 'verge' ? Math.max(SX.footway.w, 1.9) : SX.footway.w, verge: form === 'verge' ? SX.footway.verge ?? 0.7 : undefined } }, faces = [];
    EB.section(faces, 4.8, 2.2, S, { kind: 'drop' });
    if (form === 'flush') for (const x of [0.5, 0.5 + SX.post.stride, 0.5 + 2 * SX.post.stride].filter((x) => x < 4.6)) { const o = []; EB.post(o, SX.post, style.tokens.chunk); faces.push(...shift(o, x, 0.2)); }
    return fig(drawStructures([faces], { view: 'axon', paint, w: 250, h: 170, ppm: 30 }), `<b>${esc(form)}</b>${(SX.footway.form ?? 'kerbed') === form ? ' · this street\'s' : ''} · a wheel meets ${esc({ kerb: 'a step', channel: 'a post', fascia: 'a step', verge: 'soft ground' }[WALK_FORMS[form].edge])}`);
  }).join('') + `</div><table style="margin-top:6px">${WALK_FORM_IDS.map((f) => `<tr><td><b>${esc(f)}</b></td><td>${esc(WALK_FORMS[f].edge)}</td><td class="note">${esc(WALK_FORMS[f].read)}</td></tr>`).join('')}</table><div>`;
  // the heights: every role this street fills, standing side by side against a body and the eye
  const ladder = [], k = 40, hh = 200, at = [70, hh - 18];
  let x = 0;
  const roles = BOUNDARY_ROLE_IDS.filter((r) => R[r]);
  for (const role of roles) {
    const Rr = role === 'retain' ? boundaryRoles(SX.bounds, 2.8).retain : R[role], h = role === 'retain' ? 2.8 : roleHeight(Rr), len = 2.6, o = [];
    EB.boundary(o, len, { ...(SX.bounds[Rr.id] ?? Rr.el), form: Rr.form }, h, { depth: 3, gates: role === 'front' || role === 'field' ? [{ u: len / 2, w: 1.1 }] : [], seed: 5, retain: role === 'retain' ? h : 0 });
    if (role === 'retain') { const g = []; EB.boundary(g, len, { ...(SX.bounds[R.guard.id] ?? R.guard.el), form: R.guard.form }, roleHeight(R.guard), { depth: 3 }); o.push(...shift(g, 0, 0, h)); }
    ladder.push(shift(o, x)); x += len + 0.9;
  }
  const body = [[-0.9, 0], [-0.9, 1.45], [-0.75, 1.45], [-0.75, 1.75], [-0.45, 1.75], [-0.45, 1.45], [-0.3, 1.45], [-0.3, 0]];
  const W = Math.ceil(at[0] + (x + 1.2) * k + 10), Yz = (z) => (at[1] - z * k).toFixed(1), Xx = (u) => (at[0] + (u + 1.2) * k).toFixed(1);
  // the classes' tops as bands down the left margin; the eye across everything
  const over = `<polygon points="${body.map(([u, z]) => `${Xx(u)},${Yz(z)}`).join(' ')}" fill="#555"/>` + Object.entries(BOUNDARY_HEIGHTS).map(([c, H], i) => `<rect x="${4 + (i % 2) * 6}" y="${Yz(H.h[1])}" width="4" height="${((H.h[1] - H.h[0]) * k).toFixed(1)}" fill="#999"/><text x="${16 + (i % 2) * 6}" y="${(+Yz((H.h[0] + H.h[1]) / 2) + 3).toFixed(1)}" font-size="9" fill="#666">${esc(c)}</text>`).join('') + `<line x1="4" x2="${W - 4}" y1="${Yz(1.6)}" y2="${Yz(1.6)}" stroke="#c00" stroke-dasharray="4 4"/><text x="${W - 6}" y="${+Yz(1.6) - 3}" font-size="10" text-anchor="end" fill="#c00">the eye 1.6 m</text>` + roles.map((r, i) => `<text x="${Xx(i * 3.5 + 1.3)}" y="${hh - 4}" font-size="10" text-anchor="middle">${esc(r)}</text>`).join('');
  const heights = fig(drawStructures(ladder.map((g) => shift(g, 1.2)), { view: 'front', paint, w: W, h: hh, ppm: k, at: [+Xx(-1.2), at[1]], over }), 'every role this street fills, at its height, against a body: the front under the eye, the yard\'s back over it, the drop guarded at the waist, the terrace held as high as its rise');
  const roleRows = BOUNDARY_ROLE_IDS.map((role) => { const Rr = role === 'retain' ? boundaryRoles(SX.bounds, 3.6).retain : R[role], cls = BOUNDARY_ROLES[role].cls; return `<tr><td><b>${esc(role)}</b></td><td>${cls ? `${esc(cls)} ${BOUNDARY_HEIGHTS[cls].h.join('–')} m` : 'its rise'}</td><td class="note">${esc(BOUNDARY_ROLES[role].read)}</td><td>${Rr ? `${esc(Rr.id)} · ${esc(Rr.form)}${Rr.fell ? ' <span class="note">(fell to it)</span>' : ''}` : '<span class="note">open</span>'}</td><td>${Rr ? (role === 'retain' ? 'a 3.6 m rise' : `${n2(roleHeight(Rr))} m`) : '—'}</td></tr>`; }).join('');
  const formRows = Object.entries(BOUNDARY_FORMS).map(([f, F]) => `<tr><td><b>${esc(f)}</b></td><td>${esc(F.group)} ${F.value}</td><td>${F.t} m</td><td>${F.h.join('–')} m</td><td>${F.retain ? `${F.retain} m` : '—'}</td><td class="note">${esc(F.read)}</td></tr>`).join('');
  // degrees of detail: each of this street's boundaries at depth 0 to 3
  const detail = Object.entries(SX.bounds).map(([id, el]) => {
    const role = BOUNDARY_ROLE_IDS.find((r) => R[r]?.id === id && r !== 'retain') ?? 'side', h = R[role]?.id === id ? roleHeight(R[role]) : 1.1;
    const row = [0, 1, 2, 3].map((d) => { const o = []; EB.boundary(o, 3.2, el, h, { depth: d, gates: role === 'front' ? [{ u: 1.6, w: 1.1 }] : [], seed: 9 }); return fig(drawStructures([o], { view: 'axon', paint, w: 170, h: 120, ppm: 26 }), `depth ${d} · ${trisOf(o)} tris${d === 0 ? ' (far)' : d === 1 ? ' (mid)' : d === 3 ? ' (near)' : ''}`); }).join('');
    return `<p class="note" style="margin-top:8px"><b>${esc(id)}</b> · ${esc(el.form)} as the ${esc(role)}, ${n2(h)} m</p><div class="views">${row}</div>`;
  }).join('');
  // one lot of the town and its neighbours, with every line the plan gives them
  const pick = town.lots.find((l, i) => l.ring === 'near' && town.boundaries.some((b) => b.role === 'front' && b.lot === i) && town.boundaries.some((b) => b.between?.includes(i))) ?? town.lots.find((l) => l.ring === 'near');
  const i0 = town.lots.indexOf(pick), near = town.lots.map((l, i) => i).filter((i) => Math.hypot(town.lots[i].front[0] - pick.front[0], town.lots[i].front[1] - pick.front[1]) < 16);
  const mine = town.boundaries.filter((b) => near.includes(b.lot) || b.between?.some((j) => near.includes(j)));
  const groups = [...townFaces(town, paint, (l) => near.includes(town.lots.indexOf(l))), ...mine.flatMap((b) => boundaryFaces(town, b))];
  const xs = mine.flatMap((b) => b.pts.map((p) => p[0])), ys = mine.flatMap((b) => b.pts.map((p) => p[1])), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const plan = drawStructures(groups.map((g) => shift(g, -cx, -cy)), { view: 'plan', paint, w: 330, h: 300 }), axon = drawStructures(groups, { view: 'axon', paint, w: 460, h: 300 });
  const by = (r) => mine.filter((b) => b.role === r).length;
  return `<div class="card"><h3>Walks <span class="badge">a function, four forms</span></h3><p class="note">A sidewalk is a function: keep the walker off the wheel's line. Each form is an equivalent way to do it, and an anchor names one; the town steps it down the ranks like the footway it is (narrower on a branch, gone behind). A crossing drops the walk to the road. A flush walk is posted along its line, at the post's stride.</p><div class="views">${walks}</div></div>
<div class="card"><h3>Boundaries <span class="badge">by role, by height</span></h3><p class="note">A fence, a hedge or a wall is a line that keeps something, and how high it stands says what: the classes are measured against a body. A town's lines take ROLES; an anchor names its boundaries and the roles each takes; a role a named form cannot reach falls to the strongest that can (or a coursed wall, for what a town needs). The street holds each role's height (a household moves its front within its class).</p>
<div class="views">${heights}</div>
<div class="grid g2" style="margin-top:8px"><table><tr><th>role</th><th>class</th><th></th><th>takes it here</th><th>height</th></tr>${roleRows}</table><table><tr><th>form</th><th>material</th><th>thick</th><th>stands</th><th>holds</th><th></th></tr>${formRows}</table></div></div>
<div class="card"><h3>Degrees of detail</h3><p class="note">Each line by depth: 0 its mass (a wall's slab, a hedge's block, a fence's posts and top rail), 1 its coping and piers, a second rail, a hedge's foot, 2 its laying as marks in the tile (courses, stones and through-stones, palings' joints, clipping) and a picket's points, 3 its gates' leaves. The ring gives the depth (near 3, mid 1, far 0); a line under its ring's eye spot is not built.</p>${detail}</div>
<div class="card"><h3>The plan makes room <span class="badge">a lot and its lines</span></h3><p class="note">The lines are the plan's own structures, laid after the buildings: a lived lot's front (gated where its door path crosses, run across half the passage to a lived neighbour), a party line down the passage between neighbours built once, stepping from the front's height to the yard's at the building line, the yard's back; the hall's yard is its precinct; the fields are walled toward their yards; each terrace is held by a wall and guarded along its drop. Here, lot ${i0} and its neighbours: ${by('front')} front runs, ${by('side')} sides, ${by('back')} backs.</p><div class="views">${fig(plan, 'from above')}${fig(axon, 'standing')}</div></div>`;
}

/** Street tiles: each rank's module at each ring, a run of them laid end to end, a crossing and an end. */
export function tilesCard(town, paint) {
  const L = town.language, rows = ['lane', 'branch', 'back'].map((rank) => {
    const cells = ['near', 'mid', 'far'].map((ring) => { const t = streetTile(L, rank, { ring }); return fig(drawStructures([t.faces], { view: 'axon', paint, w: 200, h: 150, ppm: 18 }), `${rank} · ${ring} · ${t.len} m × ${t.w} m · ${t.tris} / ${t.budget} tris`); }).join('');
    return `<div class="views">${cells}</div>`;
  }).join('');
  const run = streetTile(L, 'lane', { ring: 'near' }), drop = streetTile(L, 'lane', { ring: 'near', kind: 'drop' }), end = streetTile(L, 'lane', { ring: 'near', kind: 'end' });
  const laid = [run, run, drop, run, end].map((t, i) => shift(t.faces, i * run.len));
  const laws = ['near', 'mid', 'far'].flatMap((ring) => ['lane', 'branch', 'back'].flatMap((rank) => ['run', 'drop', 'end'].map((kind) => ({ ring, rank, kind, t: streetTile(L, rank, { ring, kind }) }))));
  const ok = laws.filter((x) => x.t.laws.every((l) => l.ok)).length;
  return `<div class="card"><h3>Street tiles <span class="badge">degrees of detail</span></h3><p class="note">A route laid as tiles: each tile a module of its rank's section (both walks and the road), whole paving units long (${run.len} m on the lane: ${esc(run.laws.find((l) => l.law === 'whole-units').value)}), a joint at its start and none at its end, the same section at both ends, so tiles meet edge for edge. Far: one face to a surface. Mid: the edge's own faces, the channel, the verge. Near: the joints, in the tile. A crossing drops the walk; an end returns its edge across it.</p>${rows}
<div class="views" style="margin-top:6px">${fig(drawStructures(laid, { view: 'axon', paint, w: 760, h: 240 }), 'the lane laid: run, run, crossing, run, end')}</div>
<p class="note">${ok} of ${laws.length} tiles (3 ranks × 3 rings × run, crossing, end) hold seamless, whole units and budget (a fifth of the ring's building budget).</p></div>`;
}
