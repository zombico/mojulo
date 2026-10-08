/**
 * THE TOWN, drawn — the full town in miniature: a top-down map (the ground by level, the fields, every building's cast
 * shadow, the routes paved by rank, the square laid in fans round its well, the retaining walls and their stairs, the
 * door paths, the roofs with their courses, the dress) and the same town in axonometric, terraces standing up. Plus
 * the cards that explain it: routes and levels, paving, roofs, and the town's interceptors. Data: era/out-town.js,
 * era/out-town-dress.js, era/out-structures.js. Pure.
 */
import { TOWN_CARD, TOWN_LAWS, PAVINGS, HEARTBEATS, HEARTBEAT_IDS, heartbeatBand, ribbon, along, placedFaces, designTown } from './out-town.js';
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
    const rib = ribbon(r.pts, r.w + 2 * r.foot), F = PAVINGS[r.footPaving] ?? PAVINGS.flags, cid = `${id}${r.id}f`;
    routeSvg.push(`<clipPath id="${cid}"><polygon points="${poly(rib)}"/></clipPath><polygon points="${poly(rib)}" fill="${tint(paint, F.group, F.value + 0.06)}"/><path clip-path="url(#${cid})" d="${segPath(joints(r.pts, r.w + 2 * r.foot, r.footPaving === 'setts' ? 'setts' : 'flags', r.pts.length * 17), X, Y)}" stroke="${tint(paint, F.group, 0.4)}" stroke-width="0.5" fill="none" opacity="0.7"/>`);
  }
  for (const r of town.routes) {
    const rib = ribbon(r.pts, r.w), P = PAVINGS[r.paving], cid = `${id}${r.id}`;
    routeSvg.push(`<clipPath id="${cid}"><polygon points="${poly(rib)}"/></clipPath><polygon points="${poly(rib)}" fill="${tint(paint, P.group, P.value)}"${P.kerb || r.foot ? ` stroke="${tint(paint, 'town:stone', 0.3)}" stroke-width="${(0.3 * px).toFixed(1)}"` : ''}/>`);
    routeSvg.push(`<path clip-path="url(#${cid})" d="${segPath(joints(r.pts, r.w, r.paving, r.pts.length * 31), X, Y)}" stroke="${tint(paint, P.group, 0.3)}" stroke-width="${r.paving === 'earth' ? 2 : 0.6}" fill="none" opacity="0.8"/>`);
  }
  // the places: the square laid in fans round its well, the pocket in flags
  for (const p of town.places.filter((x) => x.poly)) {
    const cid = `${id}${p.id}`, rings = [];
    if (p.paving === 'fan') for (let r = 1.6; r < 18; r += 0.9) rings.push(`<circle cx="${X(p.centre[0])}" cy="${Y(p.centre[1])}" r="${(r * px).toFixed(1)}"/>`);
    routeSvg.push(`<clipPath id="${cid}"><polygon points="${poly(p.poly)}"/></clipPath><polygon points="${poly(p.poly)}" fill="${tint(paint, 'town:stone', 0.72)}"/><g clip-path="url(#${cid})" fill="none" stroke="${tint(paint, 'town:stone', 0.35)}" stroke-width="0.6" opacity="0.8">${rings.join('')}</g>`);
  }
  // the retaining walls (coping lit, the face's foot in shade) and their stairs, every tread drawn
  const walls = [];
  for (const t of town.terraces) {
    walls.push(`<rect x="${X(t.x0)}" y="${Y(t.y + 0.35)}" width="${((t.x1 - t.x0) * px).toFixed(1)}" height="${(0.7 * px).toFixed(1)}" fill="${tint(paint, 'town:stone', 0.82)}" stroke="${tint(paint, 'town:stone', 0.2)}" stroke-width="1"/>`);
  }
  for (const s of town.stairs) {
    const x0 = s.at[0] - s.width / 2, y1 = s.at[1], y0 = s.at[1] - s.run, treads = [];
    for (let i = 1; i < s.risers; i++) { const y = y0 + (i * s.run) / s.risers; treads.push([[x0, y], [x0 + s.width, y]]); }
    walls.push(`<rect x="${X(x0 - 0.3)}" y="${Y(y1)}" width="${((s.width + 0.6) * px).toFixed(1)}" height="${(s.run * px).toFixed(1)}" fill="${tint(paint, 'town:stone', 0.7)}" stroke="${tint(paint, 'town:stone', 0.2)}" stroke-width="1"/><path d="${segPath(treads, X, Y)}" stroke="${tint(paint, 'town:stone', 0.3)}" stroke-width="0.8"/>`);
  }
  // door paths: stepping slabs across the front setback
  const slabs = [];
  for (const p of town.paths) { const [a, b] = p.pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]]; for (let s = 0.35; s < L - 0.2; s += 0.75) { const c = [a[0] + u[0] * s, a[1] + u[1] * s], h = 0.3; slabs.push(`<polygon points="${poly([[c[0] - u[0] * h - n[0] * 0.45, c[1] - u[1] * h - n[1] * 0.45], [c[0] + u[0] * h - n[0] * 0.45, c[1] + u[1] * h - n[1] * 0.45], [c[0] + u[0] * h + n[0] * 0.45, c[1] + u[1] * h + n[1] * 0.45], [c[0] - u[0] * h + n[0] * 0.45, c[1] - u[1] * h + n[1] * 0.45]])}"/>`); } }
  // the buildings and the dress, from above
  const groups = townFaces(town, paint), dress = dressed ? dressed.items.map((it) => it.faces) : [];
  town.lots.forEach((l, i) => cast(groups[i], l.z));
  if (dressed) dressed.items.forEach((it) => cast(it.faces, it.at[2]));
  const under = g.join('') + routeSvg.join('') + `<g fill="${tint(paint, 'town:stone', 0.75)}">${slabs.join('')}</g>` + walls.join('') + `<g fill="${dark}" opacity="0.2">${shade.join('')}</g>`;
  const lab = [];
  if (labels) {
    const tag = (x, y, t, a = 'middle') => lab.push(`<text x="${X(x)}" y="${Y(y)}" text-anchor="${a}" font-size="12" font-weight="700" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(t)}</text>`);
    for (const p of town.places) tag(p.centre[0], p.centre[1] + (p.id === 'square' ? -2 : p.id === 'trailhead' ? -6 : 3), { square: 'the square · reveal', landing: 'the landing', top: 'the landmark', pocket: 'the pocket', trailhead: 'trailhead →' }[p.id] ?? p.id, p.id === 'trailhead' ? 'start' : 'middle');
    town.terraces.forEach((t) => tag(t.x1 - 2, t.y + 2, `terrace ${t.level} · +${n2(t.z1)} m`, 'end'));
    const back = town.routes.find((r) => r.id === 'back'); if (back) tag(back.pts[1][0], back.pts[1][1] + 2.2, 'back lane', 'start');
    const up = town.routes.find((r) => r.id === 'upper'); if (up) tag(up.pts[0][0] + 1, up.pts[0][1] + 2.2, 'upper lane', 'start');
    const sb = [B.x0 + 4, B.y0 + 4];
    lab.push(`<g><rect x="${X(sb[0])}" y="${Y(sb[1] + 1)}" width="${(10 * px).toFixed(1)}" height="${(0.8 * px).toFixed(1)}" fill="#111"/><rect x="${X(sb[0] + 10)}" y="${Y(sb[1] + 1)}" width="${(10 * px).toFixed(1)}" height="${(0.8 * px).toFixed(1)}" fill="#fff" stroke="#111"/><text x="${X(sb[0])}" y="${Y(sb[1] + 2.2)}" font-size="11" fill="#111">0</text><text x="${X(sb[0] + 20)}" y="${Y(sb[1] + 2.2)}" font-size="11" text-anchor="middle" fill="#111">20 m</text></g>`);
    const na = [B.x1 - 6, B.y0 + 6];
    lab.push(`<g><path d="M${X(na[0])} ${Y(na[1] + 4)} l${(-1.4 * px).toFixed(1)} ${(4 * px).toFixed(1)} l${(1.4 * px).toFixed(1)} ${(-1.1 * px).toFixed(1)} l${(1.4 * px).toFixed(1)} ${(1.1 * px).toFixed(1)} z" fill="#111"/><text x="${X(na[0])}" y="${Y(na[1] - 1.6)}" font-size="12" font-weight="700" text-anchor="middle" fill="#111">N</text></g>`);
  }
  return drawStructures([...groups, ...dress], { view: 'plan', paint, w: W, h: H, ppm: px, at: [-B.x0 * px, B.y1 * px], under, over: lab.join('') });
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
  // the retaining walls, in lengths of 8 m so each stands in the right order with the buildings by it
  for (const t of town.terraces) for (let x = t.x0; x < t.x1 - 1e-6; x += 8) groups.push([q([[x, t.y, t.z0], [Math.min(t.x1, x + 8), t.y, t.z0], [Math.min(t.x1, x + 8), t.y, t.z1], [x, t.y, t.z1]], 'town:stone', 0.62, [0, -1, 0])]);
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
  const b = townFaces(town, paint, () => true, { tile: (l) => l.ring === 'near' }), d = dressed ? dressed.items.map((it) => it.faces) : [];
  return drawStructures([...groups, ...b, ...d], { view: 'axon', paint, w, h, pad: 14, floor });
}

// ── cards ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export function townMapCard(town, paint, dressed) {
  const laws = [...town.laws, ...dressed.laws, ...(paint ? streetPaints(paint, town).laws : [])].map((l) => `<tr><td>${esc(l.law)}</td><td class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'ADVISES'}</td><td>${esc(l.value)}</td><td>${esc(l.want ?? '')}</td></tr>`).join('');
  const rings = Object.keys(STRUCTURE_RINGS).map((r) => `${r} ${town.lots.filter((l) => l.ring === r).length}`).join(' · ');
  return `<div class="card"><h3>The town, in miniature <span class="badge solid">top-down map</span></h3>
<p class="note">Routes first: the lane follows the trail and sways with it; it forks at the reveal into the square, a branch climbs from the square's back through ${town.terraces.length} terrace${town.terraces.length === 1 ? '' : 's'} (each wall climbed by a flight of steps) to the landmark, an upper lane runs along the first terrace, a back lane behind the frontage, and a second way drops to a pocket. Every route is laid in the anchor's section, stepped down the ranks (footways ${esc(town.routes.map((r) => `${r.id} ${r.foot ? `${r.foot} m` : 'none'}`).join(', '))}). Then ${town.lots.length} lots are cut behind the footways in walking order (${esc(rings)}), each building the anchor's language spoken on its lot, at the <b>${esc(town.heartbeat)}</b> heartbeat, ${town.lots.filter((l) => l.secondary).length} of them the anchor's secondary set as punctuation, each household painted by the street's rules. Door paths cross each front; shadows fall the sun's way. ${dressed.items.length} doodads dress it. North is up.</p>
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
    const svg = it ? drawStructures([it.faces], { view: 'axon', paint, w: 150, h: 130, ppm: k === 'trees' ? 14 : k === 'fences' ? 12 : 30 }) : '<div class="note">no site in this town</div>';
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
