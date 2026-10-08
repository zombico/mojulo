/**
 * FLOORMAP LAWS — what a floormap and its shots are judged by. Measured and advised, never refused.
 *
 *   FLOORMAP_LAWS                     law → one line
 *   floormapAdvice(fm, cams, cuts)    [{ law, at, advice }]
 *   project(basis, P)                 world point → { px, depth } through a camera, or null behind it
 */
import { inPoly, edgeDist, footprint, regionAt } from './floormap.js';
import { FIGURE, VIEW, fitPoints, COVER_MIN } from './floormap-cameras.js';

export const FLOORMAP_LAWS = Object.freeze({
  'regions-apart': 'Two regions overlap only when they are one floor (linked open).',
  'links-touch': 'Linked regions touch (open, door, stair); a gap is a jump: apart, and within reach.',
  'rule-lands': 'An edge rule names some edge: its region, side and span meet the boundary.',
  'reachable': 'From the spawn, every region is reached by its links.',
  'items-on-floor': 'An item stands on the floor, and nothing but a stand or a block stands in another\'s footprint.',
  'shot-covers': 'A camera sees most of its zone (all but the floor under the lens and along its own walls) within a lens it can hold.',
  'figure-reads': 'The figure reads in every shot: no taller than the frame at the front, no smaller than a glyph at the back.',
  'screen-direction': 'Across a cut the figure keeps its screen direction: walking right out of one shot, it walks right into the next.',
  'stand-hides': 'A stand is cover: some camera sees floor behind it, so the figure can walk out of sight.',
});

const GAP_REACH = 3;
const TOO_BIG = 0.92, TOO_SMALL = 0.035;

export function project(B, P) {
  const V = [P[0] - B.position[0], P[1] - B.position[1], (P[2] ?? 0) - B.position[2]];
  const depth = V[0] * B.forward[0] + V[1] * B.forward[1] + V[2] * B.forward[2];
  if (depth < 0.05) return null;
  const x = V[0] * B.right[0] + V[1] * B.right[1] + V[2] * B.right[2], y = V[0] * B.up[0] + V[1] * B.up[1] + V[2] * B.up[2];
  return { px: [B.pictureCenter[0] + (x / depth) * B.f, B.pictureCenter[1] - (y / depth) * B.f], depth };
}

const overlaps = (A, B) => A.some((p) => inPoly(p, B) && edgeDist(p, B) > 0.02) || B.some((p) => inPoly(p, A) && edgeDist(p, A) > 0.02);
const near = (A, B, tol) => A.some((p) => edgeDist(p, B) <= tol) || B.some((p) => edgeDist(p, A) <= tol);
const apart = (A, B) => Math.min(...A.map((p) => edgeDist(p, B)), ...B.map((p) => edgeDist(p, A)));

export function floormapAdvice(fm, cams = [], cuts = []) {
  const out = [], R = new Map(fm.regions.map((r) => [r.id, r]));
  const linked = (a, b) => fm.links.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
  for (let i = 0; i < fm.regions.length; i++) for (let j = i + 1; j < fm.regions.length; j++) {
    const a = fm.regions[i], b = fm.regions[j], l = linked(a.id, b.id);
    if (overlaps(a.poly, b.poly) && !(l && l.as === 'open')) out.push({ law: 'regions-apart', at: `${a.id} · ${b.id}`, advice: 'they overlap; link them open to make one floor, or move one' });
  }
  for (const l of fm.links) {
    const A = R.get(l.from).poly, B = R.get(l.to).poly;
    if (l.as === 'gap') {
      const d = apart(A, B);
      if (overlaps(A, B) || near(A, B, 0.02)) out.push({ law: 'links-touch', at: `${l.from} · ${l.to}`, advice: 'a gap between regions that touch: link them open, or by a door' });
      else if (d > GAP_REACH) out.push({ law: 'links-touch', at: `${l.from} · ${l.to}`, advice: `a gap of ${d.toFixed(1)} m is past a jump (${GAP_REACH} m)` });
    } else if (!overlaps(A, B) && !near(A, B, 0.02)) out.push({ law: 'links-touch', at: `${l.from} · ${l.to}`, advice: `linked ${l.as} but ${apart(A, B).toFixed(1)} m apart` });
    else if (l.as === 'door' && !fm.pieces.some((p) => p.kind === 'door' && ((p.region === l.from && p.with === l.to) || (p.region === l.to && p.with === l.from)))) out.push({ law: 'links-touch', at: `${l.from} · ${l.to}`, advice: 'a door between regions that share no wall to cut it in' });
  }
  for (const rule of fm.rules) if (!rule.hit) out.push({ law: 'rule-lands', at: `${rule.region}${rule.id ? ` · ${rule.id}` : ''}`, advice: `the ${rule.as} rule on side ${rule.side}${rule.span ? ` ${rule.span.join('..')}` : ''} meets no outer edge` });
  // reachable from the spawn
  const spawn = fm.items.find((it) => it.kind === 'spawn' && it.region);
  if (!spawn) out.push({ law: 'reachable', at: 'spawn', advice: 'no spawn on the floor: the figure has nowhere to start' });
  else {
    const seen = new Set([spawn.region]), stack = [spawn.region];
    while (stack.length) { const a = stack.pop(); for (const l of fm.links) { const b = l.from === a ? l.to : l.to === a ? l.from : null; if (b && !seen.has(b)) { seen.add(b); stack.push(b); } } }
    const lost = fm.regions.filter((r) => !seen.has(r.id)).map((r) => r.id);
    if (lost.length) out.push({ law: 'reachable', at: lost.join(', '), advice: `not reached from the spawn (${spawn.id}); link ${lost.length > 1 ? 'them' : 'it'} in` });
  }
  const solids = fm.items.filter((it) => footprint(it));
  for (const it of fm.items) {
    if (!it.region) { out.push({ law: 'items-on-floor', at: it.id, advice: 'off the floor' }); continue; }
    const under = solids.find((s) => s !== it && inPoly(it.at, footprint(s)));
    if (under && !(it.kind === 'pickup' || it.kind === 'hotspot' || it.kind === 'light')) out.push({ law: 'items-on-floor', at: it.id, advice: `inside ${under.id}'s footprint` });
  }
  // the shots
  const H = VIEW.height;
  for (const c of cams) {
    const z = R.get(c.zone.region).z;
    if (c.fit.cover < COVER_MIN) out.push({ law: 'shot-covers', at: c.id, advice: `it sees ${Math.round(c.fit.cover * 100)}% of its zone at ${Math.round(c.framing.horizontalFov)}° (it would need ${Math.round(c.fit.need)}°); split the zone or move the camera` });
    // the figure over the floor in frame: at the front (the nearest tenth of it) and at the back
    const spans = fitPoints(c.zone.poly, c.basis.position, z).floor.map(([x, y]) => {
      const f = project(c.basis, [x, y, z]), h = project(c.basis, [x, y, z + FIGURE]);
      return f && h && f.px[0] >= 0 && f.px[0] <= VIEW.width && f.px[1] >= 0 && f.px[1] <= H ? { span: Math.hypot(f.px[0] - h.px[0], f.px[1] - h.px[1]), depth: f.depth } : null;
    }).filter(Boolean).sort((p, q) => p.depth - q.depth);
    if (spans.length) {
      const front = spans[Math.floor(spans.length * 0.1)], back = spans[spans.length - 1];
      if (front.span > H * TOO_BIG) out.push({ law: 'figure-reads', at: c.id, advice: `the figure is ${Math.round((front.span / H) * 100)}% of the frame across the front of its zone (${front.depth.toFixed(1)} m); stand the camera higher or farther back` });
      if (back.span < H * TOO_SMALL) out.push({ law: 'figure-reads', at: c.id, advice: `the figure is ${Math.round(back.span)} px at the back of its zone (${back.depth.toFixed(1)} m); split the zone` });
    }
  }
  for (const k of cuts) if (k.flips) out.push({ law: 'screen-direction', at: `${k.from} → ${k.to}`, advice: 'crossing this cut, the figure turns round on screen; move one camera to the same side of the line of travel' });
  // a stand hides floor in some shot: a floor point behind it on the line from the lens
  for (const s of fm.items.filter((it) => it.kind === 'stand')) {
    const hides = cams.some((c) => {
      const P = c.basis.position, d = [s.at[0] - P[0], s.at[1] - P[1]], L = Math.hypot(...d);
      if (!project(c.basis, [s.at[0], s.at[1], s.z])) return false;
      const reach = (s.r || Math.max(...s.size) / 2) + 0.6, q = [s.at[0] + (d[0] / L) * reach, s.at[1] + (d[1] / L) * reach], r = regionAt(fm, q);
      return r && inPoly(q, c.zone.poly) && !inPoly(q, footprint(s));
    });
    if (!hides) out.push({ law: 'stand-hides', at: s.id, advice: 'no shot sees floor behind it: it reads as a prop, not cover; move it off the wall or turn a camera onto it' });
  }
  return out;
}
