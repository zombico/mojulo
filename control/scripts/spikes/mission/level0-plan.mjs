/**
 * LEVEL 0'S PLAN — a sneak's level read from its recipe (level0.json) and what the land grew: the cover's boxes (what is
 * parked and laid, and the land's own shrubs), the watchers as the route search knows them, and for each interaction
 * point the ways through it (gameworld/stealth-routes.js). Pure but for the vehicle registry's boxes: no page is made.
 *
 *   coverBoxes(L, colliders)  → [{ id, min, max }] flat to the search (a box's foot on the ground, its height its own)
 *   watchersOf(L)             → the recipe's watchers as the search reads them
 *   planLevel(L, colliders)   → { boxes, watchers, points: [{ id, reads, routes }], laws }
 *   planSvg(L, plan, field)   → the level seen from above: cover, each watcher's round and fan, each point's first try
 *                               (seen), its way unseen and its second way
 */
import { sneakRoutes, watcherAt } from '../../../lib/graph/gameworld/stealth-routes.js';
import { withParked } from '../../../lib/graph/vehicle-registry/parked.js';
import { readTallGrass } from '../../../lib/graph/form/tall-grass.js';

/** The trail's line from its own faces (the land's `trail` group): x across the site at each metre up it, the mean of
 *  the faces' middles there, read between the metres. → { x(y), samples: [[y, x]] } */
export function spineFrom(faces) {
  const by = new Map();
  for (const f of faces) {
    if (!/trail/.test(String(f.group ?? '')) || !Array.isArray(f.corners)) continue;
    const n = f.corners.length, cx = f.corners.reduce((a, q) => a + q[0], 0) / n, cy = f.corners.reduce((a, q) => a + q[1], 0) / n, k = Math.round(cy);
    const b = by.get(k) ?? [0, 0]; b[0] += cx; b[1]++; by.set(k, b);
  }
  return spineOf([...by].sort((a, b) => a[0] - b[0]).map(([y, [sx, n]]) => [y, +(sx / n).toFixed(3)]));
}
export function spineOf(samples) {
  const x = (y) => {
    if (!samples.length) return 0;
    if (y <= samples[0][0]) return samples[0][1];
    for (let k = 1; k < samples.length; k++) if (y <= samples[k][0]) { const [y0, x0] = samples[k - 1], [y1, x1] = samples[k]; return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1); }
    return samples[samples.length - 1][1];
  };
  return { x, samples };
}
/** The recipe with every place said along the trail (`{ trail, off }`: metres up it from its head, metres to its side,
 *  east positive) set down as [x, y] on this land's trail; a place already [x, y] stays as it is. */
const laneOf = (spine, [y0, y1], [lo, hi]) => { let a = Infinity, b = -Infinity; for (let y = y0; y <= y1; y += 1) { a = Math.min(a, spine.x(y) + lo); b = Math.max(b, spine.x(y) + hi); } return [+a.toFixed(2), +b.toFixed(2)]; };
export function placeRecipe(L, spine) {
  const at = (p) => (Array.isArray(p) ? p : p && typeof p === 'object' ? [+(spine.x(p.trail) + (p.off ?? 0)).toFixed(2), p.trail] : p);
  const structures = (L.structures ?? []).map((t) => ({ ...t, ...(t.at ? { at: at(t.at) } : {}), ...(t.from ? { from: at(t.from), to: at(t.to) } : {}) }));
  // (a watcher posted on a tower stands where the tower does)
  const posted = (w) => (w.on ? (structures.find((t) => t.id === w.on) ?? {}).at : at(w.at));
  return { ...L, structures, start: at(L.start), exit: at(L.exit), ...(L.backup ? { backup: { ...L.backup, from: at(L.backup.from) } } : {}),
    cover: L.cover.map((c) => ({ ...c, at: at(c.at) })), watchers: L.watchers.map((w) => ({ ...w, at: posted(w), ...(w.to ? { to: at(w.to) } : {}), ...(w.facing ? { facing: at(w.facing) } : {}) })),
    // (a point searched in a LANE, `off: [lo, hi]`: metres to the trail's side, the band of the field it may go through,
    // laid as the trail's own x either side over its window)
    points: L.points.map((P) => ({ ...P, from: at(P.from), to: at(P.to), ...(P.off ? { lane: laneOf(spine, P.window, P.off) } : {}) })), hints: L.hints.map((h) => ({ ...h, at: at(h.at) })), ...(L.supplies ? { supplies: L.supplies.map((x) => ({ ...x, at: at(x.at) })) } : {}),
    // (its tall grass, each patch's middle along the trail too: form/tall-grass.js)
    ...(L.grass ? { grass: L.grass.map((g) => ({ ...g, at: at(g.at) })) } : {}) };
}

/**
 * THE STRUCTURES a patrol builds where it stands, static and cheap (a few boxes each, drawn as the static world's own
 * faces, never a body): `sandbags` a run of bags a metre high from `from` to `to` (it hides a crouch); `wire` a run of
 * coiled wire on stakes (it stops a body, it hides nothing); `tower` a watchtower at `at`, its platform `height` up on
 * four legs (a watcher posted `on` it sees from there, over what a guard on the ground cannot).
 */
export const STRUCTURE = Object.freeze({
  sandbags: Object.freeze({ h: 1.0, d: 0.75, fill: '#8a7a55', top: '#9c8b62' }),
  wire: Object.freeze({ h: 0.9, d: 0.6, fill: '#3a3d40', stake: '#5a4630' }),
  tower: Object.freeze({ height: 4, side: 2.6, leg: 0.22, deck: 0.18, rail: 1.0, fill: '#5d4a33', deckFill: '#6d5a40' }),
});
/** A structure's boxes: { min, max, fill, sight?, walk? } (a box the search and the page both read). */
export function structureBoxes(t) {
  const out = [];
  if (t.kind === 'sandbags' || t.kind === 'wire') {
    const S = STRUCTURE[t.kind], [a, b] = [t.from, t.to], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 1.2));
    // (a run laid as short boxes along its line, so a slanted run is still axis-aligned boxes)
    for (let k = 0; k < n; k++) {
      const u0 = k / n, u1 = (k + 1) / n, x0 = a[0] + (b[0] - a[0]) * u0, y0 = a[1] + (b[1] - a[1]) * u0, x1 = a[0] + (b[0] - a[0]) * u1, y1 = a[1] + (b[1] - a[1]) * u1, r = S.d / 2;
      out.push({ min: [Math.min(x0, x1) - r, Math.min(y0, y1) - r, 0], max: [Math.max(x0, x1) + r, Math.max(y0, y1) + r, S.h], fill: k % 2 ? S.fill : (S.top ?? S.fill), ...(t.kind === 'wire' ? { sight: false } : {}) });
    }
  } else if (t.kind === 'tower') {
    const T = STRUCTURE.tower, H = t.height ?? T.height, h = T.side / 2, [x, y] = t.at;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push({ min: [x + sx * h - (sx > 0 ? T.leg : 0), y + sy * h - (sy > 0 ? T.leg : 0), 0], max: [x + sx * h + (sx < 0 ? T.leg : 0), y + sy * h + (sy < 0 ? T.leg : 0), H], fill: T.fill, sight: false });
    out.push({ min: [x - h, y - h, H - T.deck], max: [x + h, y + h, H], fill: T.deckFill, sight: false, walk: false, deck: true });
    for (const [mn, mx] of [[[x - h, y - h], [x + h, y - h + 0.08]], [[x - h, y + h - 0.08], [x + h, y + h]], [[x - h, y - h], [x - h + 0.08, y + h]], [[x + h - 0.08, y - h], [x + h, y + h]]]) out.push({ min: [mn[0], mn[1], H], max: [mx[0], mx[1], H + T.rail], fill: T.fill, sight: false, walk: false });
  }
  return out;
}

export const GUARD = Object.freeze({ cone: 0.6, range: 14, speed: 1.6, eye: 1.35, hear: 7 });
const rad = (d) => (d * Math.PI) / 180;

/** The recipe's cover as the manifest takes it: what is parked (the registry's vehicles), and what is laid (boxes). */
export function coverOf(L) {
  const parked = L.cover.filter((c) => c.vehicle).map((c) => ({ vehicle: c.vehicle, at: [c.at[0], c.at[1], 0], heading: rad(c.heading ?? 0) }));
  const laid = L.cover.filter((c) => c.box).map((c) => ({ id: c.id, size: c.box, at: c.at }));
  return { parked, laid };
}

export function coverBoxes(L, colliders = []) {
  const { parked, laid } = coverOf(L), out = [];
  // (a parked vehicle's box, the registry's own, on flat ground)
  const P = parked.length ? withParked({ parked }).colliders : [];
  P.forEach((c, i) => out.push({ id: L.cover.filter((x) => x.vehicle)[i].id, min: [c.min[0], c.min[1], 0], max: [c.max[0], c.max[1], c.max[2] - c.min[2]] }));
  for (const t of L.structures ?? []) for (const b of structureBoxes(t)) out.push({ id: t.id, ...b });
  for (const b of laid) out.push({ id: b.id, min: [b.at[0] - b.size[0] / 2, b.at[1] - b.size[1] / 2, 0], max: [b.at[0] + b.size[0] / 2, b.at[1] + b.size[1] / 2, b.size[2]] });
  // (what the land grew: a shrub's box, its height its own over its foot)
  for (const c of colliders) if (/^shrub/.test(c.of ?? '')) out.push({ id: c.of, min: [c.min[0], c.min[1], 0], max: [c.max[0], c.max[1], c.max[2] - c.min[2]] });
  return out;
}

export function watchersOf(L) {
  // (a watcher posted on a tower sees from its deck)
  const up = (w) => { const T = w.on && (L.structures ?? []).find((t) => t.id === w.on); return T ? (T.height ?? STRUCTURE.tower.height) : 0; };
  return L.watchers.map((w) => ({ id: w.id, at: w.at, elevation: up(w), ...(w.near ? { near: w.near } : {}), ...(w.kind === 'patrol' ? { to: w.to, speed: w.speed ?? GUARD.speed, ...(w.look ? { look: w.look } : {}) } : { heading: Math.atan2(w.facing[1] - w.at[1], w.facing[0] - w.at[0]) }),
    cone: w.cone ?? GUARD.cone, range: w.range ?? GUARD.range, eye: GUARD.eye + up(w), hear: w.hear ?? GUARD.hear }));
}

/** The level's tall grass as the geocube reads it (`tallGrass`, form/tall-grass.js) and as the search's veils. */
export function tallGrassOf(L) { return L.grass && L.grass.length ? { patches: L.grass.map((g) => ({ at: g.at, r: g.r, ...(g.h ? { h: g.h } : {}) })), ...(L.grassElsewhere ? { elsewhere: L.grassElsewhere } : {}) } : null; }
export function grassVeils(L) { const T = readTallGrass(tallGrassOf(L)); return T ? T.patches : []; }

export function planLevel(L, colliders = [], field = [-8, 0, 30, 75.5]) {
  const boxes = coverBoxes(L, colliders), watchers = watchersOf(L);
  const points = L.points.map((P) => ({ id: P.id, reads: P.reads,
    // (a lane's bounds its own band of the field; `needs: 'takedown'` a place only a takedown of one of `takedown` opens)
    routes: sneakRoutes({ bounds: [P.lane ? Math.max(field[0], P.lane[0]) : field[0], P.window[0], P.lane ? Math.min(field[2], P.lane[1]) : field[2], P.window[1]], boxes, veils: grassVeils(L), watchers, start: P.from, goal: P.to, goalRadius: 2, seconds: P.seconds ?? 240,
      ...(P.takedown ? { takedown: { by: P.takedown } } : {}), ...(P.needs ? { needs: P.needs } : {}) }) }));
  return { boxes, watchers, points, laws: points.flatMap((P) => P.routes.verdicts.map((v) => ({ ...v, law: `${P.id}: ${v.law}` }))) };
}

export function planSvg(L, plan, field = [-8, 0, 30, 75.5], trail = [], relief = null) {
  const S = 12, [X0, Y0, X1, Y1] = field, W = (X1 - X0) * S, H = (Y1 - Y0) * S, px = (x) => (x - X0) * S, py = (y) => (Y1 - y) * S;
  const line = (pts, style) => `<polyline fill="none" ${style} points="${pts.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ')}"/>`;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W + 260}" height="${H}" viewBox="0 0 ${W + 260} ${H}" font-family="ui-monospace,monospace" font-size="11">`, `<rect width="${W + 260}" height="${H}" fill="#101418"/>`, `<rect width="${W}" height="${H}" fill="#1c2a1e"/>`];
  // (the land's relief, a metre a cell: lit from the north-west, a bank's face dark, its steepness the more so; the search
  // reads the ground as flat, so a way that climbs one is the eye's to judge)
  if (relief) {
    const [W0, H0] = relief.size, Z = (i, j) => relief.z[Math.min(H0 - 1, Math.max(0, j)) * W0 + Math.min(W0 - 1, Math.max(0, i))];
    for (let j = 0; j < H0; j++) for (let i = 0; i < W0; i++) {
      const z = Z(i, j); if (z == null) continue;
      const gx = ((Z(i + 1, j) ?? z) - (Z(i - 1, j) ?? z)) / 2, gy = ((Z(i, j + 1) ?? z) - (Z(i, j - 1) ?? z)) / 2, steep = Math.hypot(gx, gy), lit = Math.max(-1, Math.min(1, (-gx + gy) * 0.9));
      if (steep < 0.12) continue;
      out.push(`<rect x="${px(relief.origin[0] + i)}" y="${py(relief.origin[1] + j + 1)}" width="${S}" height="${S}" fill="${lit > 0 ? '#d8d2b8' : '#000'}" opacity="${Math.min(0.55, 0.12 + steep * 0.35).toFixed(2)}"/>`);
    }
  }
  if (trail.length) out.push(line(trail, 'stroke="#6b5a40" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" opacity=".55"'));
  for (const g of grassVeils(L)) out.push(`<circle cx="${px(g.at[0]).toFixed(1)}" cy="${py(g.at[1]).toFixed(1)}" r="${(g.r * S).toFixed(1)}" fill="#7fae4a" opacity=".45" stroke="#a6d46a" stroke-width="1"/>`);
  for (const b of plan.boxes) { if (b.fill) { if (b.walk === false && !b.deck) continue; out.push(`<rect x="${px(b.min[0])}" y="${py(b.max[1])}" width="${(b.max[0] - b.min[0]) * S}" height="${(b.max[1] - b.min[1]) * S}" fill="${b.fill}" opacity="${b.deck ? 0.55 : 1}" stroke="${b.sight === false && !b.deck ? '#aab' : '#0b0e10'}" stroke-dasharray="${b.sight === false && !b.deck ? '3 2' : ''}"/>`); continue; } const sh = /^shrub/.test(b.id); out.push(`<rect x="${px(b.min[0])}" y="${py(b.max[1])}" width="${(b.max[0] - b.min[0]) * S}" height="${(b.max[1] - b.min[1]) * S}" fill="${sh ? '#3f6b3a' : b.max[2] < 0.7 ? '#7a5c3a' : b.max[2] < 1.2 ? '#8a8060' : '#59636b'}" stroke="#0b0e10"/>`); }
  for (const w of plan.watchers) {
    if (w.to) out.push(line([w.at, w.to], 'stroke="#ff7a59" stroke-width="1.5" stroke-dasharray="5 4"'));
    for (const t of w.to ? [0, (Math.hypot(w.to[0] - w.at[0], w.to[1] - w.at[1]) / w.speed) * 1.5] : [0]) {
      const g = watcherAt(w, t), a0 = g.heading - w.cone, a1 = g.heading + w.cone, r = w.range;
      const p = (a) => `${px(g.pos[0] + Math.cos(a) * r).toFixed(1)},${py(g.pos[1] + Math.sin(a) * r).toFixed(1)}`;
      out.push(`<path d="M${px(g.pos[0]).toFixed(1)},${py(g.pos[1]).toFixed(1)} L${p(a0)} A${r * S},${r * S} 0 0 0 ${p(a1)} Z" fill="#ff5a4a" opacity=".13"/>`, `<circle cx="${px(g.pos[0])}" cy="${py(g.pos[1])}" r="5" fill="#ff5a4a"/>`);
    }
    out.push(`<text x="${px(w.at[0]) + 8}" y="${py(w.at[1]) - 6}" fill="#ffb4a8">${w.id}</text>`);
  }
  let row = 0; const key = (c, text) => { out.push(`<rect x="${W + 14}" y="${18 + row * 18}" width="18" height="4" fill="${c}"/>`, `<text x="${W + 40}" y="${24 + row * 18}" fill="#cfd6da">${text}</text>`); row++; };
  for (const P of plan.points) {
    const R = P.routes;
    if (R.direct) { out.push(line(R.direct.path, 'stroke="#ff5a4a" stroke-width="2.5" opacity=".9"')); if (R.direct.seen) out.push(`<circle cx="${px(R.direct.seen.at[0])}" cy="${py(R.direct.seen.at[1])}" r="7" fill="none" stroke="#ff5a4a" stroke-width="2"/>`); }
    for (const [way, c] of [[R.sneak, '#5fe08a'], [R.other, '#5fb8ff']]) if (way) {
      // (thin while it runs, thick while it crouches, dotted while it crawls)
      let seg = [way.path[0]];
      const flush = () => { if (seg.length > 1) out.push(line(seg.map((p) => p.at), `stroke="${c}" stroke-width="${seg[1].stance === 'stand' ? 1.6 : 3.2}" ${seg[1].stance === 'prone' ? 'stroke-dasharray="2 5"' : ''}`)); };
      for (let k = 1; k < way.path.length; k++) { if (way.path[k].stance !== seg[seg.length - 1].stance && seg.length > 1) { flush(); seg = [way.path[k - 1]]; } seg.push(way.path[k]); }
      flush();
    }
    out.push(`<text x="${px(L.points.find((p) => p.id === P.id).from[0]) + 10}" y="${py(L.points.find((p) => p.id === P.id).from[1]) + 4}" fill="#e8ecef" font-size="13">${P.id}</text>`);
  }
  key('#ff5a4a', 'the first try: seen at the ring'); key('#5fe08a', 'the way unseen'); key('#5fb8ff', 'a second way'); row++;
  for (const t of ['thin: a run', 'thick: a crouch', 'dotted: a crawl', '', 'grey: parked (tall)', 'khaki: sandbags (1 m)', 'dashed: wire, seen through', 'square: a tower', 'tan: crates (1 m)', 'brown: logs (0.55 m)', 'green: shrubs', 'pale green: tall grass', '  (hides a crouch, a crawl)', 'light / dark cells: a slope', '  (a bank: the search reads', '  the ground as flat)', 'red fans: what a watcher', '  sees (two moments)']) { out.push(`<text x="${W + 14}" y="${24 + row * 18}" fill="#9aa4aa">${t}</text>`); row++; }
  out.push('</svg>');
  return out.join('\n');
}
