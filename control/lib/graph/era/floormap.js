/**
 * THE FLOORMAP — scapeshift's primitive for fixed-camera levels (the pre-rendered-background game). The meru stacks
 * tiers, the out-trail strings beats on a spine, the stage and the dungeon place rooms; a floormap places FLOOR:
 * regions of any shape, how they join, what lies along their edges, what stands on them, and (floormap-cameras.js)
 * where the cameras sit. Everything off the floor is backdrop to be depicted, baked or painted, never walked. Its
 * outcome is the walkmesh (playscape/walkmesh): one plate per camera.
 *
 *   { kind: 'floormap', title, seed, edge: 'wall',
 *     regions: [{ id, rect: [x, y, w, d] | poly: [[x, y]…] | disc: { at, r, sides } | strip: { path, width }, z, shots }],
 *     links:   [{ from, to, as: 'open' | 'door' | 'stair' | 'gap', width }],
 *     edges:   [{ region, side: 'n' | 'e' | 's' | 'w' | 'all', span: [lo, hi], as, id?, to? }],
 *     items:   [{ id, kind, at, form, … }],
 *     cameras: 'auto' | [{ id, zone, shot, from, at?, look?, fov? }],
 *     direction: { map, items, cameras } }
 *
 * EDGES are semantic: the floor ends, and its kind says why (EDGE_KINDS); it is what the backdrop depicts there. A
 * region's boundary is cut into pieces: where it lies inside or along a linked region it is open (or a door), along an
 * unlinked one a wall between, and elsewhere the floormap's `edge` unless an edge rule names it (later rules win). A
 * side is a compass word over the piece's outward normal, a span the world x (n, s) or y (e, w) it runs over.
 *
 *   EDGE_KINDS, ITEM_KINDS, LINK_KINDS
 *   readFloormap(m)        → { title, seed, regions, links, pieces, items, rules, edgeDefault } (shape errors throw)
 *   floormapAnchors(fm)    → { rooms, anchors } in the stage's anchor payload shape (anchors.js)
 *   floormapFaces(fm)      → the greybox: [{ corners, normal, kind, of }] (bakeFloor reads it as a world's faces);
 *                            edges face into their region, items out
 *   regionAt(fm, [x, y])   the region whose floor holds a point, or null
 *   triggerArea(it)        a trigger's floor: a disc (`r`) or a turned rect (`size`, `rot`)
 *
 * A CAMERA TRIGGER is a trigger with `cut`: a camera's id (walking in switches to it, until the next cut; with `from`,
 * only while that camera is live), or a shot `{ shot, at, look, fov }` (an insert: a camera of its own holding the
 * trigger's floor, in on entering, back out on leaving).
 *
 * Pure; coordinates rounded to 1e-5 (geom.js r5) so a re-read is byte-identical.
 */
import { r5 } from './geom.js';

export const EDGE_KINDS = Object.freeze({
  wall: { h: 3, about: 'a wall: the floor ends at a face that stands and hides' },
  rail: { h: 1, about: 'a rail: the floor ends at a balustrade, the view runs on past it (a drop, a courtyard, the sea)' },
  drop: { h: -2.5, about: 'a drop: the floor ends at a lip over a fall' },
  water: { h: -0.4, about: 'water: the floor ends at a bank' },
  foliage: { h: 1.4, about: 'foliage: the floor ends in hedges, reeds, undergrowth' },
  void: { h: 0, about: 'void: the floor simply ends; the backdrop decides' },
  exit: { h: 0, about: 'an exit: the floor runs on off the map, to another map\'s door' },
});
export const LINK_KINDS = Object.freeze(['open', 'door', 'stair', 'gap']);
export const ITEM_KINDS = Object.freeze({
  stand: { about: 'something to walk behind: a pillar, a tree, a statue; holes the floor and hides', solid: true },
  block: { about: 'furniture or a car: holes the floor; hides when it is tall', solid: true },
  hotspot: { about: 'something to examine, use, take, talk to or open' },
  pickup: { about: 'an item to take' },
  spawn: { about: 'where the figure starts' },
  trigger: { about: 'a zone that does something when the figure enters' },
  light: { about: 'a light the backdrop shows and the figure is lit by' },
});
export const VERBS = Object.freeze(['examine', 'use', 'take', 'talk', 'open']);
export const DOOR_WIDTH = 1.2, DOOR_HEIGHT = 2.2;
const TOL = 0.02;
const ID = /^[a-z][a-z0-9-]*$/;

// ── plane helpers ────────────────────────────────────────────────────────────────────────────────────────────────────
const area = (p) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
export const ccw = (p) => (area(p) < 0 ? [...p].reverse() : p);
export function inPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function segDist([x, y], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}
export const edgeDist = (p, poly) => poly.reduce((d, a, i) => Math.min(d, segDist(p, a, poly[(i + 1) % poly.length])), Infinity);
export function centroid(poly) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length], c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; }
  return Math.abs(A) < 1e-12 ? poly[0] : [cx / (3 * A), cy / (3 * A)];
}
export const polyArea = (p) => Math.abs(area(p));
// t along a→b where the segment c→d crosses it (or touches it end-on), within [0, 1]
function cuts(a, b, c, d) {
  const out = [], r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0], L2 = r[0] * r[0] + r[1] * r[1];
  if (Math.abs(den) > 1e-12) {
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    if (t > -1e-9 && t < 1 + 1e-9 && u > -1e-9 && u < 1 + 1e-9) out.push(t);
  }
  for (const q of [c, d]) if (segDist(q, a, b) < TOL) out.push(((q[0] - a[0]) * r[0] + (q[1] - a[1]) * r[1]) / L2);   // collinear overlap ends
  return out;
}

// ── shapes ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const num = (v, what) => { if (!Number.isFinite(v)) throw new Error(`floormap: ${what} is not a number`); return v; };
const pt = (p, what) => { if (!Array.isArray(p) || p.length < 2) throw new Error(`floormap: ${what} is not a point [x, y]`); return [num(p[0], what), num(p[1], what)]; };
const SHAPES = ['rect', 'poly', 'disc', 'strip'];

function shapeOf(r, id) {
  const has = SHAPES.filter((k) => r[k] !== undefined);
  if (has.length !== 1) throw new Error(`floormap: region '${id}' has one shape (${SHAPES.join(' | ')}), it has ${has.length ? has.join(' and ') : 'none'}`);
  const k = has[0], v = r[k];
  if (k === 'rect') {
    if (!Array.isArray(v) || v.length !== 4 || !v.every(Number.isFinite) || !(v[2] > 0 && v[3] > 0)) throw new Error(`floormap: region '${id}' rect is [x, y, w, d] with w, d > 0`);
    const [x, y, w, d] = v;
    return { shape: 'rect', poly: [[x, y], [x + w, y], [x + w, y + d], [x, y + d]] };
  }
  if (k === 'poly') {
    if (!Array.isArray(v) || v.length < 3) throw new Error(`floormap: region '${id}' poly needs three points or more`);
    const p = ccw(v.map((q, i) => pt(q, `region '${id}' point ${i}`)));
    if (polyArea(p) < 1e-6) throw new Error(`floormap: region '${id}' poly has no area`);
    return { shape: 'poly', poly: p };
  }
  if (k === 'disc') {
    const at = pt(v.at, `region '${id}' disc.at`), rr = num(v.r, `region '${id}' disc.r`), n = Number.isInteger(v.sides) && v.sides >= 3 ? v.sides : 16;
    if (!(rr > 0)) throw new Error(`floormap: region '${id}' disc.r is > 0`);
    return { shape: 'disc', poly: Array.from({ length: n }, (_, i) => [at[0] + rr * Math.cos((2 * Math.PI * i) / n), at[1] + rr * Math.sin((2 * Math.PI * i) / n)]) };
  }
  // a strip: a path walked at a width, joints mitred, ends cut square
  const path = (v.path || []).map((q, i) => pt(q, `region '${id}' strip point ${i}`)), w = num(v.width, `region '${id}' strip.width`) / 2;
  if (path.length < 2 || !(w > 0)) throw new Error(`floormap: region '${id}' strip is { path: two points or more, width > 0 }`);
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 1e-9) throw new Error(`floormap: region '${id}' strip repeats a point`); return [-dy / L, dx / L]; };
  const side = (s) => path.map((p, i) => {
    const n0 = i > 0 ? nrm(path[i - 1], p) : null, n1 = i < path.length - 1 ? nrm(p, path[i + 1]) : null;
    if (!n0 || !n1) { const n = n0 || n1; return [p[0] + s * w * n[0], p[1] + s * w * n[1]]; }
    const m = [n0[0] + n1[0], n0[1] + n1[1]], L = Math.hypot(...m), k = (w / Math.max(0.25, (m[0] * n0[0] + m[1] * n0[1]) / L)) / L;
    return [p[0] + s * k * m[0], p[1] + s * k * m[1]];
  });
  const L = side(1), Rr = side(-1);
  // its legs: one quad per path segment, cut at the mitred joints (a corridor's natural zones)
  const legs = path.slice(1).map((_, k) => ccw([L[k], L[k + 1], Rr[k + 1], Rr[k]]));
  return { shape: 'strip', poly: ccw([...L, ...Rr.reverse()]), path, legs };
}

// ── reading ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const idOf = (x, what) => { if (typeof x !== 'string' || !ID.test(x)) throw new Error(`floormap: ${what} '${x}' is not a lower-case word`); return x; };
const COMPASS = { n: [0, 1], e: [1, 0], s: [0, -1], w: [-1, 0] };

export function readFloormap(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('floormap: no manifest');
  if (!Array.isArray(manifest.regions) || !manifest.regions.length) throw new Error('floormap: regions is a list of one or more regions');
  const edgeDefault = manifest.edge ?? 'wall';
  if (!EDGE_KINDS[edgeDefault] || edgeDefault === 'exit') throw new Error(`floormap: edge '${edgeDefault}' is one of ${Object.keys(EDGE_KINDS).filter((k) => k !== 'exit').join(', ')}`);
  const regions = manifest.regions.map((r, i) => {
    const id = idOf(r && r.id, `region ${i} id`), s = shapeOf(r, id);
    return { id, ...s, poly: s.poly.map((p) => p.map(r5)), ...(s.legs ? { legs: s.legs.map((q) => q.map((p) => p.map(r5))) } : {}), z: Number.isFinite(r.z) ? r.z : 0, shots: Array.isArray(r.shots) ? r.shots : null, form: typeof r.form === 'string' ? r.form : null };
  });
  const byId = new Map();
  for (const r of regions) { if (byId.has(r.id)) throw new Error(`floormap: two regions called '${r.id}'`); byId.set(r.id, r); }
  const links = (manifest.links || []).map((l, i) => {
    for (const k of ['from', 'to']) if (!byId.has(l && l[k])) throw new Error(`floormap: link ${i} ${k} '${l && l[k]}' is not a region`);
    const as = l.as ?? 'open';
    if (!LINK_KINDS.includes(as)) throw new Error(`floormap: link ${l.from}–${l.to} is '${as}'; it is ${LINK_KINDS.join(', ')}`);
    if (l.from === l.to) throw new Error(`floormap: link ${i} joins '${l.from}' to itself`);
    return { from: l.from, to: l.to, as, width: Number.isFinite(l.width) && l.width > 0 ? l.width : DOOR_WIDTH };
  });
  const rules = (manifest.edges || []).map((e, i) => {
    if (!byId.has(e && e.region)) throw new Error(`floormap: edge rule ${i} region '${e && e.region}' is not a region`);
    const side = e.side ?? 'all';
    if (side !== 'all' && !COMPASS[side]) throw new Error(`floormap: edge rule ${i} side '${side}' is n, e, s, w or all`);
    if (!EDGE_KINDS[e.as]) throw new Error(`floormap: edge rule ${i} as '${e.as}' is one of ${Object.keys(EDGE_KINDS).join(', ')}`);
    if (e.span !== undefined && !(Array.isArray(e.span) && e.span.length === 2 && e.span.every(Number.isFinite) && e.span[0] < e.span[1])) throw new Error(`floormap: edge rule ${i} span is [lo, hi]`);
    if (e.as === 'exit') {
      idOf(e.id, `edge rule ${i} (an exit) id`);
      if (!e.to || typeof e.to.map !== 'string') throw new Error(`floormap: exit '${e.id}' goes to { map, door }`);
    }
    return { i, region: e.region, side, span: e.span || null, as: e.as, id: e.id ?? null, to: e.as === 'exit' ? { map: e.to.map, door: e.to.door ?? null } : null };
  });
  const fm = { title: manifest.title || 'floormap', seed: Number.isInteger(manifest.seed) ? manifest.seed : 1, edgeDefault, regions, links, rules };
  fm.pieces = edgePieces(fm);
  fm.items = (manifest.items || []).map((it, i) => readItem(it, i, fm));
  const seen = new Set();
  for (const x of [...fm.items, ...rules.filter((r) => r.as === 'exit')]) { if (seen.has(x.id)) throw new Error(`floormap: two items or exits called '${x.id}'`); seen.add(x.id); }
  return fm;
}

function readItem(it, i, fm) {
  if (!it || typeof it !== 'object') throw new Error(`floormap: item ${i} is not an object`);
  const id = idOf(it.id, `item ${i} id`);
  if (!ITEM_KINDS[it.kind]) throw new Error(`floormap: item '${id}' kind '${it.kind}' is one of ${Object.keys(ITEM_KINDS).join(', ')}`);
  const at = pt(it.at, `item '${id}' at`), out = { id, kind: it.kind, at, form: typeof it.form === 'string' ? it.form : it.kind };
  const r = regionAt(fm, at);
  out.region = r ? r.id : null;
  out.z = r ? r.z : 0;
  if (it.kind === 'stand') {
    out.h = Number.isFinite(it.h) && it.h > 0 ? it.h : 3;
    if (Array.isArray(it.size)) out.size = [num(it.size[0], `item '${id}' size`), num(it.size[1], `item '${id}' size`)];
    else out.r = Number.isFinite(it.r) && it.r > 0 ? it.r : 0.35;
  }
  if (it.kind === 'block') {
    out.size = Array.isArray(it.size) ? [num(it.size[0], `item '${id}' size`), num(it.size[1], `item '${id}' size`)] : [1, 1];
    out.h = Number.isFinite(it.h) && it.h > 0 ? it.h : 0.9;
    out.rot = Number.isFinite(it.rot) ? it.rot : 0;
  }
  if (it.kind === 'hotspot') {
    const verb = it.verb ?? 'examine';
    if (!VERBS.includes(verb)) throw new Error(`floormap: hotspot '${id}' verb '${verb}' is one of ${VERBS.join(', ')}`);
    out.verb = verb;
  }
  if (it.kind === 'pickup') out.item = typeof it.item === 'string' ? it.item : id;
  if (it.kind === 'spawn') out.face = Number.isFinite(it.face) ? it.face : 90;
  if (it.kind === 'trigger') {
    if (Array.isArray(it.size)) { out.size = [num(it.size[0], `item '${id}' size`), num(it.size[1], `item '${id}' size`)]; out.rot = Number.isFinite(it.rot) ? it.rot : 0; }
    else out.r = Number.isFinite(it.r) && it.r > 0 ? it.r : 1;
    out.does = typeof it.does === 'string' ? it.does : '';
    // a camera trigger: a switch to a named camera (from one, when `from` says), or an insert shot of its own
    if (typeof it.cut === 'string') { out.cut = idOf(it.cut, `trigger '${id}' cut`); out.from = it.from === undefined ? null : idOf(it.from, `trigger '${id}' from`); }
    else if (it.cut && typeof it.cut === 'object') {
      if (it.from !== undefined) throw new Error(`floormap: trigger '${id}' is an insert; it cuts in from whatever holds its floor, so drop from`);
      out.cut = { shot: it.cut.shot ?? 'corner', at: it.cut.at, look: it.cut.look, fov: it.cut.fov };
    } else if (it.cut !== undefined) throw new Error(`floormap: trigger '${id}' cut is a camera's id or a shot ({ shot, at, look, fov })`);
  }
  if (it.kind === 'light') out.h = Number.isFinite(it.h) ? it.h : 2.5;
  return out;
}

/** The footprint an item holes the floor with (a stand or a block), as a polygon, or null. */
export function footprint(it) {
  if (it.kind === 'stand' && it.r) return Array.from({ length: 8 }, (_, k) => [it.at[0] + it.r * Math.cos((Math.PI * k) / 4 + Math.PI / 8), it.at[1] + it.r * Math.sin((Math.PI * k) / 4 + Math.PI / 8)]);
  if ((it.kind === 'stand' || it.kind === 'block') && it.size) {
    const a = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), [w, d] = [it.size[0] / 2, it.size[1] / 2];
    return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([x, y]) => [it.at[0] + x * c - y * s, it.at[1] + x * s + y * c]);
  }
  return null;
}

/** A trigger's area on the floor: a disc (16 sides) or a turned rect. */
export function triggerArea(it) {
  if (it.size) {
    const a = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), [w, d] = [it.size[0] / 2, it.size[1] / 2];
    return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([x, y]) => [it.at[0] + x * c - y * s, it.at[1] + x * s + y * c]);
  }
  return Array.from({ length: 16 }, (_, k) => [it.at[0] + it.r * Math.cos((Math.PI * k) / 8), it.at[1] + it.r * Math.sin((Math.PI * k) / 8)]);
}

export const regionAt = (fm, p) => fm.regions.find((r) => inPoly(p, r.poly) || edgeDist(p, r.poly) < TOL) || null;
const linkOf = (fm, a, b) => fm.links.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a)) || null;

// every region's boundary cut into pieces, each with a kind
function edgePieces(fm) {
  const raw = [];
  fm.regions.forEach((R, ri) => {
    const P = R.poly;
    for (let e = 0; e < P.length; e++) {
      const a = P[e], b = P[(e + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-9) continue;
      const n = [(b[1] - a[1]) / L, -(b[0] - a[0]) / L];   // outward on a counter-clockwise ring
      const ts = new Set([0, 1]);
      for (const O of fm.regions) if (O !== R) for (let k = 0; k < O.poly.length; k++) for (const t of cuts(a, b, O.poly[k], O.poly[(k + 1) % O.poly.length])) if (t > 1e-6 && t < 1 - 1e-6) ts.add(r5(t));
      for (const rule of fm.rules) if (rule.region === R.id && rule.span) {
        const axis = rule.side === 'n' || rule.side === 's' ? 0 : 1, d = b[axis] - a[axis];
        if (Math.abs(d) > 1e-9) for (const v of rule.span) { const t = (v - a[axis]) / d; if (t > 1e-6 && t < 1 - 1e-6) ts.add(r5(t)); }
      }
      const sorted = [...ts].sort((x, y) => x - y);
      for (let k = 0; k + 1 < sorted.length; k++) {
        const t0 = sorted[k], t1 = sorted[k + 1];
        if ((t1 - t0) * L < 1e-4) continue;
        const A = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], B = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1], m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
        let kind = null, other = null;
        for (const O of fm.regions) {
          if (O === R) continue;
          const on = edgeDist(m, O.poly) < TOL, inside = !on && inPoly(m, O.poly);
          if (!on && !inside) continue;
          const l = linkOf(fm, R.id, O.id);
          other = O.id;
          if (inside) kind = 'open';
          else kind = !l || l.as === 'gap' ? 'wall' : l.as === 'door' ? 'door-wall' : 'open';
          break;
        }
        if (!kind) {
          kind = fm.edgeDefault;
          for (const rule of fm.rules) {
            if (rule.region !== R.id) continue;
            if (rule.side !== 'all' && n[0] * COMPASS[rule.side][0] + n[1] * COMPASS[rule.side][1] < Math.SQRT1_2 - 1e-9) continue;
            if (rule.span) { const axis = rule.side === 'n' || rule.side === 's' ? 0 : 1; if (m[axis] < rule.span[0] - 1e-9 || m[axis] > rule.span[1] + 1e-9) continue; }
            kind = rule.as; rule.hit = true;
            if (rule.as === 'exit') other = { exit: rule.id, to: rule.to };
          }
        }
        // a shared piece is built once, by the earlier region
        const shared = other && typeof other === 'string';
        if (shared && fm.regions.findIndex((x) => x.id === other) < ri) continue;
        raw.push({ region: R.id, a: A.map(r5), b: B.map(r5), n: n.map(r5), kind, ...(shared ? { with: other } : {}), ...(other && other.exit ? { id: other.exit, to: other.to } : {}) });
      }
    }
  });
  // doors: one opening per door link, centred on the longest piece the two regions share
  const out = [];
  for (const p of raw) {
    if (p.kind !== 'door-wall') { out.push(p); continue; }
    const l = linkOf(fm, p.region, p.with), mine = raw.filter((q) => q.kind === 'door-wall' && ((q.region === p.region && q.with === p.with) || (q.region === p.with && q.with === p.region)));
    const len = (q) => Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]), best = mine.reduce((x, y) => (len(y) > len(x) ? y : x));
    if (best !== p) { out.push({ ...p, kind: 'wall' }); continue; }
    const L = len(p), w = Math.min(l.width, L), t0 = (L - w) / 2 / L, t1 = 1 - t0, at = (t) => [p.a[0] + (p.b[0] - p.a[0]) * t, p.a[1] + (p.b[1] - p.a[1]) * t].map(r5);
    if (t0 > 1e-6) out.push({ ...p, b: at(t0), kind: 'wall' });
    out.push({ ...p, a: at(t0), b: at(t1), kind: 'door' });
    if (t1 < 1 - 1e-6) out.push({ ...p, a: at(t1), kind: 'wall' });
  }
  return out;
}

// ── outcomes ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The anchor payload: regions as rooms (a polygon, not a box), items, doorways and exits as anchors. */
export function floormapAnchors(fm) {
  const rooms = fm.regions.map((r) => ({ id: r.id, poly: r.poly, z: r.z, shape: r.shape, ...(r.form ? { form: r.form } : {}) }));
  const anchors = fm.items.map((it) => ({ id: it.id, kind: it.kind, room: it.region, at: [...it.at, it.z].map(r5), form: it.form,
    ...(it.verb ? { verb: it.verb } : {}), ...(it.item ? { item: it.item } : {}), ...(it.face !== undefined ? { face: it.face } : {}), ...(it.h !== undefined ? { h: it.h } : {}), ...(footprint(it) ? { foot: footprint(it).map((p) => p.map(r5)) } : {}) }));
  for (const p of fm.pieces) {
    const at = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, fm.regions.find((r) => r.id === p.region).z].map(r5), width = r5(Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]));
    if (p.kind === 'door') anchors.push({ id: `doorway-${p.region}-${p.with}`, kind: 'doorway', between: [p.region, p.with], at, N: [...p.n, 0], width, height: DOOR_HEIGHT });
    if (p.kind === 'exit') {
      const prev = anchors.find((a) => a.id === p.id);
      if (!prev) anchors.push({ id: p.id, kind: 'door', room: p.region, at, N: [...p.n, 0], width, to: p.to });
      else if (width > prev.width) Object.assign(prev, { at, N: [...p.n, 0], width });
    }
  }
  return { rooms, anchors };
}

const up = (corners, kind, of) => ({ corners, normal: [0, 0, 1], kind, of });
const side = (a, b, z0, z1, n, kind, of) => ({ corners: [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]].map((p) => p.map(r5)), normal: [n[0], n[1], 0], kind, of });
// an edge faces into its region, so a fixed camera standing behind it looks through its back
const inward = (p, z0, z1, kind) => side(p.b, p.a, z0, z1, [-p.n[0], -p.n[1]].map(r5), kind, p.region);

/** The greybox: each region's floor, its edges built by kind, a lintel over each door, the stands and blocks as prisms. */
export function floormapFaces(fm) {
  const out = [], zOf = new Map(fm.regions.map((r) => [r.id, r.z]));
  for (const r of fm.regions) out.push(up(r.poly.map(([x, y]) => [x, y, r.z]), 'floor', r.id));
  for (const p of fm.pieces) {
    const z = zOf.get(p.region), h = (EDGE_KINDS[p.kind] || {}).h;
    if (p.kind === 'door') { out.push(inward(p, z + DOOR_HEIGHT, z + EDGE_KINDS.wall.h, 'lintel')); continue; }
    if (!h) continue;
    out.push(inward(p, Math.min(z, z + h), Math.max(z, z + h), p.kind));
  }
  for (const it of fm.items) {
    const f = footprint(it);
    if (!f) continue;
    for (let k = 0; k < f.length; k++) {
      const a = f[k], b = f[(k + 1) % f.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      out.push(side(a, b, it.z, it.z + it.h, [(b[1] - a[1]) / L, -(b[0] - a[0]) / L], it.kind, it.id));
    }
    out.push(up(f.map(([x, y]) => [x, y, it.z + it.h].map(r5)), it.kind, it.id));
  }
  return out;
}

// ── the World payload ────────────────────────────────────────────────────────────────────────────────────────────────
// the greybox in values: what a bake renders and a painter is guided by; the backdrop's look comes later
export const GREY = Object.freeze({ floor: '#8d8a83', wall: '#6d6f74', lintel: '#6d6f74', rail: '#a3a5a9', foliage: '#5d7a55', drop: '#3d4a5a', water: '#3a5a7a', stand: '#d8d2c4', block: '#b8b0a0' });
const SUN = (() => { const v = [-0.35, -0.55, 0.76], L = Math.hypot(...v); return v.map((x) => x / L); })();
const shadeHex = (hex, n) => { const s = 0.58 + 0.42 * Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]); return `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * s).toString(16).padStart(2, '0')).join('')}`; };

/** A simple polygon (counter-clockwise, no holes) cut into triangles by ear clipping. */
export function triangulate(poly) {
  const idx = poly.map((_, i) => i), tris = [];
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inside = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length], a = poly[i0], b = poly[i1], c = poly[i2];
      if (cross(a, b, c) <= 1e-12) continue;
      if (idx.some((j) => j !== i0 && j !== i1 && j !== i2 && inside(poly[j], a, b, c))) continue;
      tris.push([i0, i1, i2]); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) tris.push([...idx]);
  return tris;
}

/**
 * The floormap as a World payload (scene-three.js emitThreeWorld): the greybox shaded in values, floors cut into
 * triangles, the edges and items single-sided (a fixed camera behind a wall sees through its back), the cameras as
 * the page's shots, and the anchor payload riding along.
 */
export function floormapPayload(fm, cams = []) {
  const faces = [];
  for (const f of floormapFaces(fm)) {
    const fill = shadeHex(GREY[f.kind] || GREY.floor, f.normal), group = `floormap:${f.kind}`;
    if (f.kind === 'floor' || f.corners.length > 4) {
      for (const [a, b, c] of triangulate(f.corners)) faces.push({ corners: [f.corners[a], f.corners[b], f.corners[c], f.corners[a]], normal: f.normal, fill, group, of: f.of });
    } else faces.push({ corners: f.corners, normal: f.normal, fill, group, of: f.of, singleSide: true });
  }
  return { faces, cameras: cams.map((c) => ({ name: c.id, worldFraming: c.framing })), viewBox: { width: 1280, height: 720 }, title: fm.title, bg: '#16171b', ...floormapAnchors(fm) };
}
