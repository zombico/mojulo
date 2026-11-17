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
  for (const b of laid) out.push({ id: b.id, min: [b.at[0] - b.size[0] / 2, b.at[1] - b.size[1] / 2, 0], max: [b.at[0] + b.size[0] / 2, b.at[1] + b.size[1] / 2, b.size[2]] });
  // (what the land grew: a shrub's box, its height its own over its foot)
  for (const c of colliders) if (/^shrub/.test(c.of ?? '')) out.push({ id: c.of, min: [c.min[0], c.min[1], 0], max: [c.max[0], c.max[1], c.max[2] - c.min[2]] });
  return out;
}

export function watchersOf(L) {
  return L.watchers.map((w) => ({ id: w.id, at: w.at, ...(w.kind === 'patrol' ? { to: w.to, speed: w.speed ?? GUARD.speed } : { heading: Math.atan2(w.facing[1] - w.at[1], w.facing[0] - w.at[0]) }),
    cone: w.cone ?? GUARD.cone, range: w.range ?? GUARD.range, eye: GUARD.eye, hear: w.hear ?? GUARD.hear }));
}

export function planLevel(L, colliders = [], field = [-8, 0, 30, 75.5]) {
  const boxes = coverBoxes(L, colliders), watchers = watchersOf(L);
  const points = L.points.map((P) => ({ id: P.id, reads: P.reads,
    routes: sneakRoutes({ bounds: [field[0], P.window[0], field[2], P.window[1]], boxes, watchers, start: P.from, goal: P.to, goalRadius: 2, seconds: P.seconds ?? 240 }) }));
  return { boxes, watchers, points, laws: points.flatMap((P) => P.routes.verdicts.map((v) => ({ ...v, law: `${P.id}: ${v.law}` }))) };
}

export function planSvg(L, plan, field = [-8, 0, 30, 75.5], trail = []) {
  const S = 12, [X0, Y0, X1, Y1] = field, W = (X1 - X0) * S, H = (Y1 - Y0) * S, px = (x) => (x - X0) * S, py = (y) => (Y1 - y) * S;
  const line = (pts, style) => `<polyline fill="none" ${style} points="${pts.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ')}"/>`;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W + 260}" height="${H}" viewBox="0 0 ${W + 260} ${H}" font-family="ui-monospace,monospace" font-size="11">`, `<rect width="${W + 260}" height="${H}" fill="#101418"/>`, `<rect width="${W}" height="${H}" fill="#1c2a1e"/>`];
  if (trail.length) out.push(line(trail, 'stroke="#6b5a40" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" opacity=".55"'));
  for (const b of plan.boxes) { const sh = /^shrub/.test(b.id); out.push(`<rect x="${px(b.min[0])}" y="${py(b.max[1])}" width="${(b.max[0] - b.min[0]) * S}" height="${(b.max[1] - b.min[1]) * S}" fill="${sh ? '#3f6b3a' : b.max[2] < 0.7 ? '#7a5c3a' : b.max[2] < 1.2 ? '#8a8060' : '#59636b'}" stroke="#0b0e10"/>`); }
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
  for (const t of ['thin: a run', 'thick: a crouch', 'dotted: a crawl', '', 'grey: parked (tall)', 'tan: crates (1 m)', 'brown: logs (0.55 m)', 'green: shrubs', 'red fans: what a watcher', '  sees (two moments)']) { out.push(`<text x="${W + 14}" y="${24 + row * 18}" fill="#9aa4aa">${t}</text>`); row++; }
  out.push('</svg>');
  return out.join('\n');
}
