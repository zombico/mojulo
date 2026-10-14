/**
 * THE ARENA PLAN — the venue laid out in plan before anything is built. A structure is never one-shot: the ground round
 * the track is first divided into ZONES, each a footprint with a use, reached by a road, drawn on a plan sheet the
 * operator reviews; each zone is then built on its own (a local area, in passes). The plan's opinions:
 *
 *   pits         a pit lane beside the main straight (the start's: a lap's, a stage's first), the pit building behind
 *                it, the paddock behind that, on the side with room (no other leg of the track near)
 *   stands       where a SPECTATOR sees the most of the lap: a stand's eye (its top row) looks at the track within its
 *                range, facing it, over the land; the best sites taken greedily, apart from each other
 *   car park     behind the paddock, on its own flat; hospitality beside the paddock (a circuit's)
 *   landmark     the ground round the trackscape's landmark
 *   roads        a service road round the venue (its hull, pushed out: it never crosses the track), a spur to every
 *                zone, a tunnel where a spur must cross the track
 *
 *   planArena(plan, { scape, seed }) → { zones: [{ id, use, poly, at, heading, size, side, … }], roads: [{ id, pts }],
 *                                       tunnels, out, laws }
 *   arenaLaws(plan, arena, scape)    → advisories: off the road, apart, out of the sight lines, reached, each stand's
 *                                       share of the lap, the pits on the main straight
 *   arenaSheetSvg(plan, arena, { scape?, title? }) → the plan sheet (SVG)
 *   zoneOf(arena, [x, y])            → the zone a point stands in (a trackscape slot there is the zone's to fill)
 *
 * The plan holds no geometry beyond footprints: what stands in a zone is the local area's (A2). Pure, deterministic.
 */

const r2 = (v) => Math.round(v * 100) / 100;
/** A class's venue: the pit lane's width, the pit building's depth, the paddock's, the pit run's length; a stand's length,
 *  depth, eye height and range; how many stands and how far apart; the car park; the service road's offset. */
export const ARENA = Object.freeze({
  circuit: { lane: 14, building: 18, paddock: 45, pitLen: 300, stand: [70, 18], eye: 9, range: 380, stands: 3, apart: 160, park: [140, 70], hospitality: [60, 30], road: 7 },
  kart: { lane: 6, building: 8, paddock: 16, pitLen: 70, stand: [28, 8], eye: 4.5, range: 130, stands: 2, apart: 50, park: [50, 26], hospitality: null, road: 5 },
  rally: { lane: 0, building: 10, paddock: 40, pitLen: 90, stand: [30, 10], eye: 5, range: 200, stands: 2, apart: 120, park: [80, 40], hospitality: null, road: 6 },
});
const STRAIGHT_K = 1 / 300;   // the curvature under which the road runs straight (track.js's kerb line)

export function planArena(plan, { scape = null, seed = 1 } = {}) {
  const a = plan.alignment, X = plan.X, L = a.length, closed = a.closed, A = ARENA[plan.course.class] ?? ARENA.circuit;
  const C = Array.from({ length: Math.max(32, Math.round(L / 2)) + 1 }, (_, i) => a.at(Math.min(L, (i * L) / Math.max(32, Math.round(L / 2)))));
  const nearest = (x, y) => { let b = C[0], d = Infinity; for (const c of C) { const e = (c.x - x) ** 2 + (c.y - y) ** 2; if (e < d) { d = e; b = c; } } return { c: b, d: Math.sqrt(d) }; };
  const P = (st, off) => [st.x - Math.sin(st.heading) * off, st.y + Math.cos(st.heading) * off];
  // the outside of a lap: its left is inside when it runs anticlockwise (its signed area); a stage's has none
  let area = 0;
  for (let i = 0; i < C.length - 1; i++) area += C[i].x * C[i + 1].y - C[i + 1].x * C[i].y;
  const out = closed ? (area > 0 ? -1 : 1) : 1;
  const zones = [], roads = [], tunnels = [];
  const strip = (s0, s1, off0, off1, side) => {   // a footprint along the road: offsets from the centreline on `side`
    const n = Math.max(2, Math.ceil((s1 - s0) / 8)), near = [], far = [];
    for (let i = 0; i <= n; i++) { const st = a.at(Math.max(0, Math.min(L, s0 + ((s1 - s0) * i) / n))); near.push(P(st, side * off0)); far.push(P(st, side * off1)); }
    return [...near, ...far.reverse()].map((p) => p.map(r2));
  };
  const rect = (cx, cy, h, len, dep) => { const u = [Math.cos(h), Math.sin(h)], v = [-Math.sin(h), Math.cos(h)]; return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [r2(cx + u[0] * (i * len) / 2 + v[0] * (j * dep) / 2), r2(cy + u[1] * (i * len) / 2 + v[1] * (j * dep) / 2)]); };
  // a footprint clear of every leg of the road (a lap's other side too)
  const clearOf = (poly, m = 2) => poly.every(([x, y]) => nearest(x, y).d > X.outer + m);

  // ── the main straight: the start's, run out both ways while the road is straight ──
  const s0 = plan.lines?.start ?? 0, kAt = (s) => Math.abs(a.at(closed ? ((s % L) + L) % L : Math.max(0, Math.min(L, s))).k);
  let sA = s0, sB = s0;
  while (sB - s0 < L * 0.45 && kAt(sB + 5) < STRAIGHT_K && (closed || sB + 5 < L)) sB += 5;
  while (s0 - sA < L * 0.45 && kAt(sA - 5) < STRAIGHT_K && (closed || sA - 5 > 0)) sA -= 5;
  const runLen = Math.min(A.pitLen, Math.max(30, sB - sA - 20)), mid = (sA + sB) / 2;
  const pr0 = closed ? mid - runLen / 2 : Math.max(0, s0 - runLen * 0.3), pr1 = pr0 + runLen;
  const wrapS = (s) => (closed ? ((s % L) + L) % L : Math.max(0, Math.min(L, s)));
  // ── pits: lane, building, paddock, on the side with room (the outside first) ──
  const depth = [A.lane, A.building, A.paddock];
  let pitSide = null;
  for (const side of [out, -out]) {
    const whole = strip(pr0, pr1, X.outer + 1, X.outer + 1 + depth.reduce((x, y) => x + y, 0), side);
    if (clearOf(whole, 0.5)) { pitSide = side; break; }
  }
  pitSide ??= out;
  const seg = (k) => { const o0 = X.outer + 1 + depth.slice(0, k).reduce((x, y) => x + y, 0); return [o0, o0 + depth[k]]; };
  const stS = (s) => a.at(wrapS(s));
  const pitMid = stS((pr0 + pr1) / 2);
  if (A.lane) zones.push({ id: 'pit-lane', use: 'pit lane', poly: strip(pr0, pr1, ...seg(0), pitSide), side: pitSide, s: [r2(wrapS(pr0)), r2(wrapS(pr1))], heading: r2(pitMid.heading) });
  zones.push({ id: 'pit-building', use: 'pit building', poly: strip(pr0, pr1, ...seg(1), pitSide), side: pitSide, s: [r2(wrapS(pr0)), r2(wrapS(pr1))], heading: r2(pitMid.heading) });
  zones.push({ id: 'paddock', use: 'paddock', poly: strip(pr0, pr1, ...seg(2), pitSide), side: pitSide, s: [r2(wrapS(pr0)), r2(wrapS(pr1))], heading: r2(pitMid.heading) });
  const back = X.outer + 1 + depth.reduce((x, y) => x + y, 0);
  // car park behind the paddock, hospitality beside it
  const [pk, pd] = A.park, behind = P(pitMid, pitSide * (back + 6 + pd / 2));
  zones.push({ id: 'car-park', use: 'car park', poly: rect(behind[0], behind[1], pitMid.heading, pk, pd), side: pitSide, heading: r2(pitMid.heading) });
  if (A.hospitality) {
    const [hl, hd] = A.hospitality, end = stS(pr1 + hl / 2 + 10), hp = P(end, pitSide * (X.outer + 1 + A.lane + A.building + hd / 2));
    const poly = rect(hp[0], hp[1], end.heading, hl, hd);
    if (clearOf(poly)) zones.push({ id: 'hospitality', use: 'hospitality', poly, side: pitSide, heading: r2(end.heading) });
  }

  // ── stands: where a spectator sees the most of the lap ──
  const ground = plan.groundAt ?? (() => 0), samples = C.filter((_, i) => i % 5 === 0);
  const seen = (eye, facing) => {
    let len = 0;
    for (const t of samples) {
      const dx = t.x - eye[0], dy = t.y - eye[1], d = Math.hypot(dx, dy);
      if (d > A.range || d < 1) continue;
      const off = Math.atan2(Math.sin(Math.atan2(dy, dx) - facing), Math.cos(Math.atan2(dy, dx) - facing));
      if (Math.abs(off) > (70 * Math.PI) / 180) continue;
      let hidden = false;
      for (let k = 1; k < 12 && !hidden; k++) { const u = k / 12, x = eye[0] + dx * u, y = eye[1] + dy * u; if (ground(x, y) > eye[2] + (t.z + 1 - eye[2]) * u + 0.3) hidden = true; }
      if (!hidden) len += L / samples.length;
    }
    return len;
  };
  const taken = zones.map((z) => z.poly);
  const overlaps = (poly) => taken.some((q) => polysOverlap(poly, q));
  const sightBlocked = (poly) => (scape?.keepClear ?? []).some((k) => polyHitsSeg(poly, k.from, k.to));
  const cands = [];
  const [sl, sd] = A.stand;
  for (let i = 0; i < C.length; i += 4) for (const side of [1, -1]) {
    const st = C[i], c = P(st, side * (X.outer + 6 + sd / 2)), poly = rect(c[0], c[1], st.heading, sl, sd);
    if (!clearOf(poly, 3) || sightBlocked(poly)) continue;
    const facing = Math.atan2(st.y - c[1], st.x - c[0]), eye = [c[0], c[1], ground(c[0], c[1]) + A.eye];
    cands.push({ s: st.s, side, c, poly, facing, sees: seen(eye, facing), heading: st.heading });
  }
  cands.sort((p, q) => q.sees - p.sees || p.s - q.s);
  const stands = [];
  for (const k of cands) {
    if (stands.length >= A.stands) break;
    if (stands.some((s) => Math.hypot(s.c[0] - k.c[0], s.c[1] - k.c[1]) < A.apart) || overlaps(k.poly)) continue;
    stands.push(k); taken.push(k.poly);
  }
  stands.forEach((k, i) => zones.push({ id: `stand-${i + 1}`, use: 'grandstand', poly: k.poly, side: k.side, heading: r2(k.heading), facing: r2(k.facing), sees: r2(k.sees), share: r2(k.sees / L) }));

  // ── the landmark's ground ──
  const lm = scape?.slots?.find((s) => s.landmark);
  if (lm) { const w = Math.max(20, Math.min(120, lm.span * 1.6)); zones.push({ id: 'landmark', use: 'landmark ground', poly: rect(lm.at[0], lm.at[1], 0, w, w), heading: 0 }); }

  // ── roads: a ring round the venue (the hull of the track and its zones, pushed out: it never crosses the track), a
  // spur from it to each zone, and a tunnel where a spur must cross the track ──
  const venue = [...C.map((c) => [c.x, c.y]), ...zones.filter((z) => z.id !== 'landmark').flatMap((z) => z.poly)];
  const hull = convexHull(venue), hc = centroid(hull), margin = X.outer + 18;
  const ringPts = hull.map(([x, y]) => { const d = Math.hypot(x - hc[0], y - hc[1]) || 1; return [r2(x + ((x - hc[0]) / d) * margin), r2(y + ((y - hc[1]) / d) * margin)]; });
  roads.push({ id: 'ring', use: 'service road', pts: [...ringPts, ringPts[0]] });
  const onRing = (p) => { let best = ringPts[0], bd = Infinity; for (let i = 0; i < ringPts.length; i++) { const q = closestOnSeg(p, ringPts[i], ringPts[(i + 1) % ringPts.length]), d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q; } } return best.map(r2); };
  for (const z of zones) {
    const zc = centroid(z.poly), from = onRing(zc);
    // where the spur crosses the road's centreline: a tunnel there
    let cross = null;
    for (let i = 0; i < C.length - 1 && !cross; i++) if (segsCross(from, zc, [C[i].x, C[i].y], [C[i + 1].x, C[i + 1].y])) cross = C[i];
    roads.push({ id: `to-${z.id}`, use: cross ? 'tunnel road' : 'spur', pts: [from, zc.map(r2)], zone: z.id });
    if (cross) tunnels.push({ zone: z.id, s: r2(cross.s) });
  }
  const arena = { cls: plan.course.class, out, main: [r2(wrapS(sA)), r2(wrapS(sB))], zones, roads, tunnels, seed };
  return { ...arena, laws: arenaLaws(plan, arena, scape) };
}

/** The arena plan's laws (advisory). */
export function arenaLaws(plan, arena, scape = null) {
  const out = [], X = plan.X, a = plan.alignment, L = a.length, A = ARENA[plan.course.class] ?? ARENA.circuit;
  const C = Array.from({ length: Math.round(L / 2) + 1 }, (_, i) => a.at(Math.min(L, i * 2)));
  const dist = (x, y) => Math.min(...C.map((c) => Math.hypot(c.x - x, c.y - y)));
  for (const z of arena.zones) if (z.poly.some(([x, y]) => dist(x, y) < X.outer)) out.push({ law: 'off-the-road', detail: `${z.id} reaches the road` });
  for (let i = 0; i < arena.zones.length; i++) for (let j = i + 1; j < arena.zones.length; j++) {
    const p = arena.zones[i], q = arena.zones[j];
    if (['pit-lane', 'pit-building', 'paddock'].includes(p.id) && ['pit-lane', 'pit-building', 'paddock'].includes(q.id)) continue;   // the pits are one row
    if (polysOverlap(shrink(p.poly, 0.5), shrink(q.poly, 0.5))) out.push({ law: 'apart', detail: `${p.id} overlaps ${q.id}` });
  }
  for (const z of arena.zones) for (const k of scape?.keepClear ?? []) if (z.id !== 'landmark' && polyHitsSeg(z.poly, k.from, k.to)) out.push({ law: 'sight-line-clear', detail: `${z.id} stands in corner ${k.corner}'s sight line` });
  for (const z of arena.zones) if (!arena.roads.some((r) => r.zone === z.id)) out.push({ law: 'reached', detail: `nothing reaches ${z.id}` });
  const share = plan.course.class === 'kart' ? 0.3 : 0.15;
  for (const z of arena.zones.filter((x) => x.use === 'grandstand')) if (z.share < share) out.push({ law: 'stand-sees', detail: `${z.id} sees ${Math.round(z.share * 100)} % of the lap (at least ${share * 100} %)` });
  if (!arena.zones.some((z) => z.use === 'grandstand') && A.stands) out.push({ law: 'stand-sees', detail: 'no stand found a site' });
  return out;
}

/** The zone a point stands in, or null. */
export const zoneOf = (arena, p) => arena.zones.find((z) => inPoly(p, z.poly)) ?? null;

// ── geometry ──
function convexHull(points) {
  const P = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
function closestOnSeg(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2));
  return [a[0] + vx * t, a[1] + vy * t];
}
const centroid = (poly) => poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
const shrink = (poly, k) => { const c = centroid(poly); return poly.map(([x, y]) => [c[0] + (x - c[0]) * (1 - k / Math.max(1, Math.hypot(x - c[0], y - c[1]))), c[1] + (y - c[1]) * (1 - k / Math.max(1, Math.hypot(x - c[0], y - c[1])))]); };
export function inPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) inside = !inside; }
  return inside;
}
function segsCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
function polysOverlap(p, q) {
  if (p.some((v) => inPoly(v, q)) || q.some((v) => inPoly(v, p))) return true;
  for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) if (segsCross(p[i], p[(i + 1) % p.length], q[j], q[(j + 1) % q.length])) return true;
  return false;
}
function polyHitsSeg(poly, a, b) {
  if (inPoly(a, poly) || inPoly(b, poly)) return true;
  for (let i = 0; i < poly.length; i++) if (segsCross(poly[i], poly[(i + 1) % poly.length], a, b)) return true;
  return false;
}

// ── the plan sheet ──
const USE_FILL = { 'pit lane': '#9aa3ab', 'pit building': '#4f6d8f', paddock: '#c9cfd4', 'car park': '#d8d2c4', hospitality: '#b98a5e', grandstand: '#c0504d', 'landmark ground': '#8a6fb0' };
const BEAT_FILL = { braking: '#e0b030', focus: '#d9452b', reveal: '#3a7bd5', pocket: '#8e5bb5', span: '#e67e22', gantry: '#e67e22', landmark: '#7d3c98', rhythm: '#999999' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** The arena plan as a sheet: the track and its barriers, every zone in its use's colour and named, the roads, the
 *  trackscape's slots as dots, a scale bar, the legend, the laws. */
export function arenaSheetSvg(plan, arena, { scape = null, title = 'arena plan', width = 1200 } = {}) {
  const a = plan.alignment, X = plan.X, L = a.length;
  const C = Array.from({ length: Math.round(L / 4) + 1 }, (_, i) => a.at(Math.min(L, i * 4)));
  const pts = [...C.map((c) => [c.x, c.y]), ...arena.zones.flatMap((z) => z.poly), ...arena.roads.flatMap((r) => r.pts)];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), pad = 30;
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  const W = width, k = (W - 260) / (x1 - x0), H = Math.round((y1 - y0) * k + 120);
  const sx = (x) => r2((x - x0) * k + 20), sy = (y) => r2(H - 60 - (y - y0) * k);   // north up
  const path = (ps, close = false) => `M${ps.map(([x, y]) => `${sx(x)},${sy(y)}`).join('L')}${close ? 'Z' : ''}`;
  const P = (st, off) => [st.x - Math.sin(st.heading) * off, st.y + Math.cos(st.heading) * off];
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif">`, `<rect width="${W}" height="${H}" fill="#eef1e8"/>`];
  out.push(`<text x="20" y="28" font-size="18" font-weight="bold" fill="#222">${esc(title)}</text>`);
  for (const r of arena.roads) out.push(`<path d="${path(r.pts)}" fill="none" stroke="${r.use === 'tunnel road' ? '#a07850' : '#c8b48a'}" stroke-width="${r.use === 'service road' ? 5 : 3}" ${r.use === 'tunnel road' ? 'stroke-dasharray="6 4"' : ''} stroke-linecap="round"/>`);
  for (const z of arena.zones) {
    const c = centroid(z.poly);
    out.push(`<path d="${path(z.poly, true)}" fill="${USE_FILL[z.use] ?? '#bbb'}" fill-opacity="0.85" stroke="#333" stroke-width="0.8"/>`);
    out.push(`<text x="${sx(c[0])}" y="${sy(c[1])}" font-size="10" text-anchor="middle" fill="#111" stroke="#fff" stroke-width="2.5" paint-order="stroke">${esc(z.id)}${z.share !== undefined ? ` · ${Math.round(z.share * 100)}%` : ''}</text>`);
  }
  // the track: runoff band, road, the barrier lines, the start
  const band = (o0, o1, fill) => out.push(`<path d="${path([...C.map((c) => P(c, o0)), ...C.map((c) => P(c, o1)).reverse()], true)}" fill="${fill}"/>`);
  band(-X.outer, X.outer, '#d9ddd0'); band(-X.road, X.road, '#4a4d52');
  for (const s of [1, -1]) out.push(`<path d="${path(C.map((c) => P(c, s * X.outer)))}" fill="none" stroke="#777" stroke-width="1"/>`);
  const st = a.at(plan.lines?.start ?? 0), sA = P(st, X.road), sB = P(st, -X.road);
  out.push(`<line x1="${sx(sA[0])}" y1="${sy(sA[1])}" x2="${sx(sB[0])}" y2="${sy(sB[1])}" stroke="#fff" stroke-width="3"/>`);
  for (const t of arena.tunnels) { const q = a.at(t.s); out.push(`<circle cx="${sx(q.x)}" cy="${sy(q.y)}" r="5" fill="none" stroke="#a07850" stroke-width="2"/>`); }
  for (const s of scape?.slots ?? []) if (s.beat !== 'rhythm') out.push(`<circle cx="${sx(s.at[0])}" cy="${sy(s.at[1])}" r="${s.beat === 'landmark' ? 6 : 3}" fill="${BEAT_FILL[s.beat] ?? '#888'}" stroke="#fff" stroke-width="0.8"/>`);
  for (const kc of scape?.keepClear ?? []) out.push(`<line x1="${sx(kc.from[0])}" y1="${sy(kc.from[1])}" x2="${sx(kc.to[0])}" y2="${sy(kc.to[1])}" stroke="#e33" stroke-width="1" stroke-dasharray="3 3"/>`);
  // scale bar, legend, laws
  const bar = [50, 100, 200, 500].find((m) => m * k > 80) ?? 500;
  out.push(`<rect x="20" y="${H - 35}" width="${r2(bar * k)}" height="5" fill="#333"/><text x="20" y="${H - 42}" font-size="10" fill="#333">${bar} m</text>`);
  let ly = 50;
  const lx = W - 220;
  for (const [u, f] of Object.entries(USE_FILL)) { out.push(`<rect x="${lx}" y="${ly}" width="14" height="10" fill="${f}" stroke="#333" stroke-width="0.5"/><text x="${lx + 20}" y="${ly + 9}" font-size="11" fill="#222">${esc(u)}</text>`); ly += 16; }
  ly += 6;
  for (const [b, f] of Object.entries(BEAT_FILL)) { if (b === 'rhythm') continue; out.push(`<circle cx="${lx + 7}" cy="${ly + 5}" r="4" fill="${f}"/><text x="${lx + 20}" y="${ly + 9}" font-size="11" fill="#222">${esc(b)} slot</text>`); ly += 16; }
  ly += 10;
  out.push(`<text x="${lx}" y="${ly}" font-size="12" font-weight="bold" fill="#222">laws</text>`); ly += 16;
  for (const l of (arena.laws.length ? arena.laws : [{ law: 'none advised', detail: '' }]).slice(0, 12)) { out.push(`<text x="${lx}" y="${ly}" font-size="10" fill="${arena.laws.length ? '#a33' : '#363'}">${esc(l.law)}${l.detail ? `: ${esc(l.detail)}` : ''}</text>`); ly += 14; }
  out.push('</svg>');
  return out.join('\n');
}
