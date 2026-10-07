/**
 * THE PREMAP — the level as a guide before it is built: black and white, measured, every place it asks to have
 * joined named. What the landform board is for a trail (era/out-trail-board.js), this is for a local meru, and the
 * two read as one: the trail it follows is drawn on the same plan, and its heartbeat runs on into the climb.
 *
 *   1 PLAN        the mandala from above: the trail it follows, the seam, every mound's outline and its rings, the route
 *                 walked (a tick at every riser), the landings, the towers and their climbs
 *   2 MERU        a half-section through the axis: the named heights up the ruler, each tier stacked on the one below
 *   3 HEARTBEAT   height along the walk, from the followed trail's start, over the seam, up every way up
 *   4 TWO-POINT   the massing as the polygonizer draws it (pure-mandala.js projectTwoPoint, a level camera: verticals
 *                 stay vertical), lines only; the back dashed
 *   TIERS, LAWS, ANCHORS   the stack, the ledger (plan.js localMeruLaws), and what playscape answers (links.js)
 *
 * `localMeruPremapHtml(recipe)` is pure; `localMeruPremapPng(recipe)` lays it out in a headless Chromium.
 */
import { planLocalMeru, localMeruLaws, moundRadius, planFactor } from './plan.js';
import { projectTwoPoint } from '../polygonizer/pure-mandala.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const f2 = (v) => (Math.round(v * 100) / 100).toString();
const TAU = Math.PI * 2;
const bearing = (N) => `${Math.round(((Math.atan2(N[0], N[1]) * 180) / Math.PI + 360) % 360)}°`;
const pts = (a) => a.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');
const ARROW = '<marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#000"/></marker>';

// a mound's outline at apothem r (round, or its polygon) at height z
const outline = (t, r, z = 0) => Array.from({ length: 97 }, (_, i) => { const a = (i / 96) * TAU, f = planFactor(t.sides, t.turnAt, a); return [t.centre[0] + Math.cos(a) * r * f, t.centre[1] + Math.sin(a) * r * f, z]; });
// a point along a way up's path at distance s (from its foot), and the way it runs there
function along(path, s) {
  let i = 1; while (i < path.length - 1 && path[i].s < s) i++;
  const a = path[i - 1], b = path[i], f = b.s > a.s ? Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s))) : 0, d = [b.at[0] - a.at[0], b.at[1] - a.at[1]], l = Math.hypot(...d) || 1;
  return { at: [0, 1, 2].map((k) => a.at[k] + (b.at[k] - a.at[k]) * f), dir: [d[0] / l, d[1] / l] };
}
// the route's walked runs (split at the climbs)
const walkedRuns = (p) => { const runs = [[]]; for (const q of p.route) { if (q.kind === 'climb') { if (runs[runs.length - 1].length) runs.push([]); } else runs[runs.length - 1].push(q.at); } return runs.filter((r) => r.length > 1); };
const tierNo = (p, id) => p.tiers.findIndex((t) => t.id === id) + 1;
const peakOf = (t) => (t.form === 'tower' ? (t.roofed ? t.apexZ : t.railZ) : t.top);

// ── 1 · the plan ─────────────────────────────────────────────────────────────────────────────────────────────────
function planSvg(p, w) {
  const site = p.join.site, c = p.tiers[0].centre, reach = Math.max(...p.tiers.map((t) => (t.form === 'mound' ? t.foot * (t.sides >= 3 ? 1 / Math.cos(Math.PI / t.sides) : 1) + 2.5 : t.half * 1.6)));
  const tail = site ? Math.min(site.D, 34) : 0, trail = [];
  if (site) for (let y = site.D - tail; y <= site.D + 1e-9; y += 0.5) trail.push([site.trailX(y), y]);
  const xs = [c[0] - reach, c[0] + reach, p.join.at[0], ...trail.map((q) => q[0])], ys = [c[1] - reach, c[1] + reach, p.join.at[1], ...trail.map((q) => q[1])];
  const x0 = Math.min(...xs) - 3, x1 = Math.max(...xs) + 3, y0 = Math.min(...ys) - 3, y1 = Math.max(...ys) + 3;
  const k = w / (x1 - x0), h = Math.round((y1 - y0) * k), X = (x) => (x - x0) * k, Y = (y) => h - (y - y0) * k, XY = (q) => [X(q[0]), Y(q[1])];
  const o = [];
  if (site) {
    o.push(`<polyline points="${pts(trail.map(XY))}" fill="none" stroke="#000" stroke-width="${f1(site.halfW * 2 * k + 3)}" stroke-linejoin="round" opacity=".35"/>`);
    o.push(`<polyline points="${pts(trail.map(XY))}" fill="none" stroke="#fff" stroke-width="${f1(site.halfW * 2 * k)}" stroke-linejoin="round"/>`);
    for (const a of site.out.anchors) {
      if (a.at[1] < site.D - tail) continue;
      if (a.site === 'stairs' && a.N) {
        const nx = -a.N[1], ny = a.N[0];
        for (let s = a.s0; s <= a.s1; s += 1) { const q = [a.at[0] + a.N[0] * (s - (a.s0 + a.s1) / 2), a.at[1] + a.N[1] * (s - (a.s0 + a.s1) / 2)]; o.push(`<line x1="${f1(X(q[0] - nx))}" y1="${f1(Y(q[1] - ny))}" x2="${f1(X(q[0] + nx))}" y2="${f1(Y(q[1] + ny))}" stroke="#000" stroke-width="1.4"/>`); }
      }
      if (a.kind === 'beat') o.push(`<circle cx="${f1(X(a.at[0]))}" cy="${f1(Y(a.at[1]))}" r="4" fill="#000" stroke="#fff" stroke-width="1.5"/><text x="${f1(X(a.at[0]) + 8)}" y="${f1(Y(a.at[1]) + 4)}" class="lbl">${esc(a.id)}</text>`);
    }
    const J = p.join, nx = -J.N[1], ny = J.N[0], sw = site.halfW + 2;
    o.push(`<line x1="${f1(X(J.at[0] - nx * sw))}" y1="${f1(Y(J.at[1] - ny * sw))}" x2="${f1(X(J.at[0] + nx * sw))}" y2="${f1(Y(J.at[1] + ny * sw))}" stroke="#000" stroke-width="2" stroke-dasharray="5 3"/><text x="${f1(X(J.at[0] + nx * sw) + 4)}" y="${f1(Y(J.at[1] + ny * sw) + 4)}" class="lbl">seam</text>`);
  }
  // the mounds, bottom first: the foot, a ring at each landing (or each third), the summit
  for (const t of p.tiers.filter((q) => q.form === 'mound')) {
    const L = p.links.find((q) => q.tier === t.id), ringZ = L.landings.length ? L.landings.map((l) => l.z - t.base) : [t.height / 3, (2 * t.height) / 3];
    o.push(`<polygon points="${pts(outline(t, t.foot).map(XY))}" fill="#f2f2f2" stroke="#000" stroke-width="2"/>`);
    for (const z of ringZ) o.push(`<polyline points="${pts(outline(t, moundRadius(t, z)).map(XY))}" fill="none" stroke="#999" stroke-width=".8"/>`);
    o.push(`<polygon points="${pts(outline(t, t.summit).map(XY))}" fill="#fff" stroke="#000" stroke-width="2"/>`);
  }
  // the route walked, white with a black edge; a tick across it at every riser
  for (const run of walkedRuns(p)) {
    const W = Math.max(...p.links.map((L) => L.width || 1.6));
    o.push(`<polyline points="${pts(run.map(XY))}" fill="none" stroke="#000" stroke-width="${f1(W * k * 0.8 + 3)}" stroke-linejoin="round"/>`);
    o.push(`<polyline points="${pts(run.map(XY))}" fill="none" stroke="#fff" stroke-width="${f1(W * k * 0.8)}" stroke-linejoin="round"/>`);
  }
  for (const L of p.links.filter((q) => q.via !== 'climb')) {
    for (const f of L.flights) for (let i = 0; i < f.risers; i++) {
      const q = along(L.path, f.s0 + i * L.going.T), hw = L.width / 2, n = [-q.dir[1], q.dir[0]];
      o.push(`<line x1="${f1(X(q.at[0] - n[0] * hw))}" y1="${f1(Y(q.at[1] - n[1] * hw))}" x2="${f1(X(q.at[0] + n[0] * hw))}" y2="${f1(Y(q.at[1] + n[1] * hw))}" stroke="#000" stroke-width="1"/>`);
    }
    for (const l of L.landings) o.push(`<circle cx="${f1(X(l.mid[0]))}" cy="${f1(Y(l.mid[1]))}" r="4" fill="#fff" stroke="#000" stroke-width="1.8"/><text x="${f1(X(l.mid[0]) + 7)}" y="${f1(Y(l.mid[1]) - 5)}" class="lbl">${tierNo(p, L.tier)}·${l.k}</text>`);
  }
  // the towers and their climbs; each tier's arrival
  for (const t of p.tiers.filter((q) => q.form === 'tower')) o.push(`<polygon points="${pts(t.corners.map(XY))}" fill="${t.roofed ? '#000' : '#fff'}" stroke="#000" stroke-width="2"/>`);
  for (const L of p.links.filter((q) => q.via === 'climb')) o.push(`<line x1="${f1(X(L.climb.from[0]))}" y1="${f1(Y(L.climb.from[1]))}" x2="${f1(X(L.climb.to[0]))}" y2="${f1(Y(L.climb.to[1]))}" stroke="#000" stroke-width="3" marker-end="url(#arr)"/>`);
  for (const t of p.tiers) o.push(`<circle cx="${f1(X(t.arrive.at[0]))}" cy="${f1(Y(t.arrive.at[1]))}" r="4.5" fill="#000" stroke="#fff" stroke-width="1.5"/><text x="${f1(X(t.arrive.at[0]) + 8)}" y="${f1(Y(t.arrive.at[1]) + 4)}" class="lbl">${esc(t.id)}</text>`);
  o.push(`<line x1="10" y1="${h - 12}" x2="${f1(10 + 10 * k)}" y2="${h - 12}" stroke="#000" stroke-width="3"/><text x="10" y="${h - 18}" class="sm">10 m</text>`);
  o.push(`<line x1="${w - 16}" y1="${h - 12}" x2="${w - 16}" y2="${h - 36}" stroke="#000" stroke-width="1.5" marker-end="url(#arr)"/><text x="${w - 16}" y="${h - 40}" text-anchor="middle" class="sm">+y</text>`);
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs>${ARROW}</defs>${o.join('')}</svg>`;
}

// ── 2 · the meru: a half-section through the axis ────────────────────────────────────────────────────────────────
function meruSvg(p, w) {
  const z0 = p.meru.base, z1 = p.meru.top, rMax = Math.max(...p.tiers.map((t) => (t.form === 'mound' ? t.foot + (t.up.width || 0) : t.half + 0.5))) + 0.5;
  const padT = 14, padB = 12, ruler = 108, axisX = ruler + 24, k = Math.min((w - axisX - 8) / rMax, 24), h = Math.round((z1 - z0) * k + padT + padB);
  const Y = (z) => h - padB - (z - z0) * k, X = (r) => axisX + r * k, o = [];
  for (const t of p.tiers) {
    const L = p.links.find((q) => q.tier === t.id);
    if (t.form === 'mound') {
      const prof = []; for (let z = 0; z <= t.height + 1e-9; z += 0.1) prof.push([moundRadius(t, z), t.base + z]);
      o.push(`<polygon points="${pts([[X(0), Y(t.base)], ...prof.map(([r, z]) => [X(r), Y(z)]), [X(0), Y(t.top)]])}" fill="#f2f2f2" stroke="#000" stroke-width="1.8"/>`);
      if (L.via === 'spiral') {
        o.push(`<polyline points="${pts(prof.map(([r, z]) => [X(r + L.width / 2), Y(z)]))}" fill="none" stroke="#000" stroke-width="1" stroke-dasharray="4 3"/>`);
        for (const l of L.landings) { const r = moundRadius(t, l.z - t.base); o.push(`<line x1="${f1(X(r))}" x2="${f1(X(r + L.width))}" y1="${f1(Y(l.z))}" y2="${f1(Y(l.z))}" stroke="#000" stroke-width="3"/>`); }
      } else o.push(`<line x1="${f1(X(L.start))}" y1="${f1(Y(t.base))}" x2="${f1(X(t.summit))}" y2="${f1(Y(t.top))}" stroke="#000" stroke-width="3" stroke-dasharray="6 2"/>`);
    } else {
      const hs = t.half, top = t.roofed ? t.eaveZ : t.railZ;
      o.push(`<polyline points="${pts([[X(0), Y(top)], [X(hs), Y(top)], [X(hs), Y(t.base)]])}" fill="none" stroke="#000" stroke-width="1.6"/>`);
      o.push(`<line x1="${f1(X(0))}" x2="${f1(X(hs + 0.2))}" y1="${f1(Y(t.deckZ))}" y2="${f1(Y(t.deckZ))}" stroke="#000" stroke-width="4"/><line x1="${f1(X(0))}" x2="${f1(X(hs))}" y1="${f1(Y(t.railZ))}" y2="${f1(Y(t.railZ))}" stroke="#000" stroke-width="1.2"/>`);
      if (t.roofed) o.push(`<polygon points="${pts([[X(0), Y(t.eaveZ)], [X(hs + 0.4), Y(t.eaveZ)], [X(0), Y(t.apexZ)]])}" fill="#000"/>`);
      o.push(`<line x1="${f1(X(hs + 0.3))}" x2="${f1(X(hs + 0.3))}" y1="${f1(Y(t.base))}" y2="${f1(Y(t.deckZ))}" stroke="#000" stroke-width="3" stroke-dasharray="2 2"/>`);
    }
  }
  o.push(`<line x1="${f1(axisX)}" x2="${f1(axisX)}" y1="${f1(Y(z0) + 6)}" y2="${f1(Y(z1) - 8)}" stroke="#000" stroke-width="1" stroke-dasharray="8 3 2 3"/>`);
  o.push(`<line x1="${ruler}" x2="${ruler}" y1="${f1(Y(z0))}" y2="${f1(Y(z1))}" stroke="#000" stroke-width="2"/>`);
  let lastY = Infinity;
  for (const m of p.meru.stack) {
    const y = Y(m.z), ly = Math.min(y, lastY - 12); lastY = ly;
    o.push(`<line x1="${ruler}" x2="${f1(axisX)}" y1="${f1(y)}" y2="${f1(y)}" stroke="#000" stroke-width=".6" stroke-dasharray="1 3"/><line x1="${ruler - 5}" x2="${ruler + 5}" y1="${f1(y)}" y2="${f1(y)}" stroke="#000" stroke-width="2"/>`);
    o.push(`<text x="${ruler - 9}" y="${f1(ly + 3.5)}" text-anchor="end" class="lbl2">${esc(m.name)} <tspan class="sm">${f1(m.z - z0)}</tspan></text>`);
  }
  for (let r = 0; r <= rMax; r += 5) o.push(`<text x="${f1(X(r))}" y="${h - 1}" text-anchor="middle" class="sm">${r}</text>`);
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${o.join('')}</svg>`;
}

// ── 3 · the heartbeat: the trail followed, over the seam, up every way up ─────────────────────────────────────────
function heartbeatSvg(p, w, h) {
  const site = p.join.site, o = [], tr = site ? site.out.plan : null, sSeam = tr ? tr.sOf(site.D) : 0;
  const line = [], flights = [];
  if (tr) for (let s = 0; s <= sSeam + 1e-9; s += 0.5) line.push([s, tr.smoothAt(s), 'trail']);
  let s = sSeam;
  p.route.forEach((q, i) => {
    if (i) { const a = p.route[i - 1]; s += q.kind === 'climb' && a.kind === 'climb' ? 0 : Math.hypot(q.at[0] - a.at[0], q.at[1] - a.at[1]); }
    line.push([s, q.at[2], q.kind]);
  });
  for (let i = 1; i < line.length; i++) if (line[i][2] === 'flight' && line[i - 1][2] === 'flight') flights.push([line[i - 1][0], line[i][0]]);
  const sTot = s + 6, zs = line.map((q) => q[1]), lo = Math.min(...zs) - 0.5, hi = Math.max(...p.tiers.map(peakOf)) + 0.5;
  const padL = 40, padB = 26, padT = 30, iw = w - padL - 10, ih = h - padB - padT;
  const X = (v) => padL + (v / sTot) * iw, Y = (z) => padT + ih - ((z - lo) / (hi - lo)) * ih;
  for (const [a, b] of flights) o.push(`<rect x="${f1(X(a))}" y="${padT}" width="${f1(Math.max(0.6, X(b) - X(a)))}" height="${ih}" fill="url(#hatch3)"/>`);
  if (tr) for (const r of tr.stairs) o.push(`<rect x="${f1(X(r.s0))}" y="${padT}" width="${f1(Math.max(2, X(r.s1) - X(r.s0)))}" height="${ih}" fill="url(#hatch3)"/>`);
  for (let m = Math.ceil(lo); m <= hi; m += 2) o.push(`<line x1="${padL}" x2="${padL + iw}" y1="${f1(Y(m))}" y2="${f1(Y(m))}" stroke="#d9d9d9" stroke-width=".6"/><text x="4" y="${f1(Y(m) + 3)}" class="sm">${m} m</text>`);
  for (let v = 0; v <= sTot; v += 20) o.push(`<text x="${f1(X(v))}" y="${h - 4}" text-anchor="middle" class="sm">${v} m</text>`);
  o.push(`<polyline points="${pts(line.map(([v, z]) => [X(v), Y(z)]))}" fill="none" stroke="#000" stroke-width="2.4"/>`);
  const mark = (v, z, label, fill = '#fff') => o.push(`<line x1="${f1(X(v))}" x2="${f1(X(v))}" y1="22" y2="${f1(Y(z))}" stroke="#000" stroke-width=".8" stroke-dasharray="2 2"/><circle cx="${f1(X(v))}" cy="${f1(Y(z))}" r="4.5" fill="${fill}" stroke="#000" stroke-width="1.8"/><text x="${f1(X(v))}" y="16" text-anchor="middle" class="lbl2">${esc(label)}</text>`);
  if (tr) for (const b of tr.beats) if (b.kind !== 'exit') mark(b.s, tr.smoothAt(b.s), b.kind);
  mark(sSeam, p.join.at[2], 'seam', '#000');
  const near = (at) => line.reduce((b, q, i) => (i > (tr ? Math.round(sSeam / 0.5) : 0) && Math.abs(q[1] - at[2]) < 0.05 && Math.abs(q[0] - b[0]) >= 0 ? q : b), line[0]);
  for (const t of p.tiers) { const q = line.filter((v) => Math.abs(v[1] - t.top) < 0.02).pop() || near(t.arrive.at); mark(q[0], t.top, t.id, '#000'); }
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="hatch3" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#bbb" stroke-width="2.5"/></pattern></defs>${o.join('')}</svg>`;
}

// ── 4 · two-point: the massing through the polygonizer's camera, lines only ─────────────────────────────────────────
function twoPointSvg(p, w, h) {
  const t0 = p.tiers[0], c = t0.centre, z0 = p.meru.base, peak = Math.max(...p.tiers.map(peakOf)), rise = peak - z0;
  const foot = t0.form === 'mound' ? t0.foot : t0.half * 2;
  const d0 = [c[0] - p.join.at[0], c[1] - p.join.at[1]], dl = Math.hypot(...d0) || 1, dir = [d0[0] / dl, d0[1] / dl];
  const dist = Math.max(foot * 3.2, rise * 1.6), eyeZ = z0 + rise * 0.3, horizon = h * 0.6;
  const camAt = (fov) => ({ worldFraming: { cameraPosition: [c[0] - dir[0] * dist, c[1] - dir[1] * dist, eyeZ], lookAt: [c[0], c[1], eyeZ], horizontalFov: fov, pictureCenter: [w / 2, horizon] }, viewBox: { width: w, height: h } });
  const keys = [p.join.at, [c[0], c[1], peak + 1], ...outline(t0.form === 'mound' ? t0 : { ...t0, sides: 0 }, foot, z0).filter((_, i) => i % 4 === 0)];
  const fits = (cm) => keys.every((q) => { const s = projectTwoPoint(q, cm, {}); return s[0] > 12 && s[0] < w - 12 && s[1] > 12 && s[1] < h - 12; });
  let fov = 36; while (fov < 110 && !fits(camAt(fov))) fov += 2;
  const cam = camAt(fov), V = (q) => { const s = projectTwoPoint(q, cam, {}); return [s[0], s[1]]; };
  const front = (q) => (q[0] - c[0]) * -dir[0] + (q[1] - c[1]) * -dir[1] >= -0.01;
  const o = [];
  const split = (P3, wF, wB) => {
    let run = [], f = null;
    const flush = () => { if (run.length > 1) o.push(`<polyline points="${pts(run.map(V))}" fill="none" stroke="${f ? '#000' : '#aaa'}" stroke-width="${f ? wF : wB}"${f ? '' : ' stroke-dasharray="4 3"'}/>`); };
    for (const q of P3) { const fq = front(q); if (f !== null && fq !== f) { run.push(q); flush(); run = [run[run.length - 1]]; } f = fq; run.push(q); }
    flush();
  };
  const line = (a, b, wd = 1.4, dash = '') => { const A = V(a), B = V(b); o.push(`<line x1="${f1(A[0])}" y1="${f1(A[1])}" x2="${f1(B[0])}" y2="${f1(B[1])}" stroke="#000" stroke-width="${wd}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`); };
  for (const t of p.tiers) {
    if (t.form === 'mound') {
      const L = p.links.find((q) => q.tier === t.id), ringZ = L.landings.length ? L.landings.map((l) => l.z - t.base) : [t.height / 3, (2 * t.height) / 3];
      split(outline(t, t.foot, t.base), 1.8, 0.8);
      for (const z of ringZ) split(outline(t, moundRadius(t, z), t.base + z), 0.7, 0.5);
      split(outline(t, t.summit, t.top), 1.6, 0.8);
      // the flank's edges: a polygon's corners, a round mound's silhouette either side
      const edges = t.sides >= 3 ? Array.from({ length: t.sides }, (_, i) => t.turnAt + (i * TAU) / t.sides) : [Math.atan2(dir[0], -dir[1]), Math.atan2(-dir[0], dir[1])];
      for (const a of edges) {
        const q = []; for (let z = 0; z <= t.height + 1e-9; z += 0.25) { const r = moundRadius(t, z) * planFactor(t.sides, t.turnAt, a); q.push([t.centre[0] + Math.cos(a) * r, t.centre[1] + Math.sin(a) * r, t.base + z]); }
        if (t.sides >= 3) split(q, 1.4, 0.6); else o.push(`<polyline points="${pts(q.map(V))}" fill="none" stroke="#000" stroke-width="1.8"/>`);
      }
    } else {
      const up = (q, z) => [q[0], q[1], z], postTop = t.roofed ? t.eaveZ : t.railZ;
      for (const q of t.corners) line(q, up(q, postTop), 1.6);
      for (const z of [t.deckZ, t.railZ, ...(t.roofed ? [t.eaveZ] : [])]) o.push(`<polygon points="${pts(t.corners.map((q) => V(up(q, z))))}" fill="none" stroke="#000" stroke-width="${z === t.deckZ ? 2.6 : 1}"/>`);
      if (t.roofed) for (const q of t.corners) line(up(q, t.eaveZ), [t.centre[0], t.centre[1], t.apexZ], 1.2);
    }
  }
  for (const run of walkedRuns(p)) split(run, 2.2, 1);
  for (const L of p.links.filter((q) => q.via === 'climb')) line(L.climb.from, L.climb.to, 3, '3 2');
  const a0 = V([c[0], c[1], z0 - 1]), a1 = V([c[0], c[1], peak + 1.5]);
  o.push(`<line x1="${f1(a0[0])}" y1="${f1(a0[1])}" x2="${f1(a1[0])}" y2="${f1(a1[1])}" stroke="#000" stroke-width=".9" stroke-dasharray="8 3 2 3"/>`);
  o.push(`<line x1="0" x2="${w}" y1="${f1(horizon)}" y2="${f1(horizon)}" stroke="#bbb" stroke-width=".8"/><text x="6" y="${f1(horizon - 4)}" class="sm">horizon · eye ${f1(eyeZ - z0)} m · ${fov}° lens · ${f1(dist)} m back</text>`);
  const sm = V(p.join.at);
  o.push(`<circle cx="${f1(sm[0])}" cy="${f1(sm[1])}" r="4" fill="#000"/><text x="${f1(sm[0] + 7)}" y="${f1(sm[1] + 4)}" class="lbl">seam</text>`);
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${o.join('')}</svg>`;
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#111;font:13px/1.35 Helvetica,Arial,sans-serif}
#board{width:1200px;padding:18px 20px 20px}
h1{font-size:22px;margin:0;letter-spacing:.02em}
.lede{color:#555;font-size:12px;margin:3px 0 12px}
.row{display:grid;gap:12px;margin-bottom:12px;align-items:start}
.r1{grid-template-columns:440px 360px 1fr}.r3{grid-template-columns:600px 1fr}
.card{border:1.5px solid #111;border-radius:4px;padding:10px 12px;min-width:0}
.card header{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
.card h2{font-size:14px;margin:0;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.badge{border:1.5px solid #111;border-radius:10px;padding:1px 10px;font-size:11px;font-weight:700;text-transform:uppercase}
.note{color:#555;font-size:12px;margin:6px 0 0}
.lbl{font:700 11px Helvetica,Arial,sans-serif;fill:#000;paint-order:stroke;stroke:#fff;stroke-width:3px}
.lbl2{font:700 11px Helvetica,Arial,sans-serif;fill:#000}.sm{font:10px Helvetica,Arial,sans-serif;fill:#555}
table{border-collapse:collapse;width:100%}td,th{padding:3px 4px;border-bottom:1px solid #ddd;vertical-align:top;text-align:left}
th{font-size:11px;text-transform:uppercase;letter-spacing:.03em;border-bottom:1.5px solid #111}
td.ok{font-weight:700}td.no{font-weight:700;background:#111;color:#fff}
svg{display:block;width:100%;height:auto}
`;

const tierWords = (t) => (t.form === 'mound'
  ? `${t.sides >= 3 ? `${t.sides}-sided` : 'round'} mound, ${f1(t.height)} m, ${f1(t.foot)} → ${f1(t.summit)} m, up by ${t.up.via}${t.up.via === 'spiral' ? ` (${f2(t.up.turns)} turns, ${t.up.hand})` : ''}`
  : `tower, ${f1(t.side)} m, deck ${f1(t.deck)} m, up by climb (${esc(Object.values(t.up.link).join(' · '))})${t.roofed ? '' : ', open to the tier on it'}`);

/** The premap for a local-meru recipe, as one self-contained HTML document. */
export function localMeruPremapHtml(recipe = {}, { status = 'proposed', title } = {}) {
  const p = planLocalMeru(recipe), R = p.recipe, laws = localMeruLaws(p), J = p.join;
  const lawRows = laws.map((l) => `<tr><td>${esc(l.law)}</td><td class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'BROKEN'}</td><td>${esc(typeof l.value === 'number' ? f2(l.value) : l.value)}</td><td>${esc(l.want)}</td></tr>`).join('');
  const ends = (a) => (a.from ? `${f1(a.from[2] - J.at[2])} → ${f1(a.to[2] - J.at[2])} m` : '');
  const what = (a) => (a.kind === 'site' ? `${a.site}${a.going ? ` · ${a.going.risers} × ${f2(a.going.riser)} / ${f2(a.going.tread)}` : ''}${a.curve ? ` · on a ${f1(a.curve.radius)} m curve` : ''}` : a.kind === 'tier' ? `tier · ${a.tier}${a.length ? ` · ${f1(a.length)} m` : ''}${a.area ? ` · ${f1(a.area)} m²` : ''}` : a.kind === 'junction' ? `junction · ${esc(a.between[0])}` : `${a.kind} · ${a.beat || ''}`);
  const anchorRows = p.anchors.map((a) => `<tr><td><b>${esc(a.id)}</b></td><td>${esc(what(a))}</td><td>${a.N ? bearing(a.N) : ''}</td><td>${esc(ends(a))}</td><td>${a.link ? esc(Object.values(a.link).join(' · ')) : a.kind === 'site' ? 'walk first' : ''}</td></tr>`).join('');
  const markRows = p.meru.stack.map((m) => `<tr><td><b>${esc(m.name)}</b></td><td>${f1(m.z - J.at[2])} m</td></tr>`).join('');
  const tierRows = p.tiers.map((t, i) => `<tr><td><b>${i + 1} · ${esc(t.id)}</b></td><td>${tierWords(t)}</td><td>${f1(t.base - J.at[2])} → ${f1(t.top - J.at[2])} m</td></tr>`).join('');
  const after = J.from ? `after ${esc(J.from)} (${esc(J.kit)} · seed ${J.seed})` : 'standing alone';
  const walked = p.links.filter((L) => L.via !== 'climb'), climbs = p.links.filter((L) => L.via === 'climb');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1240"><title>Premap · local-meru:${esc(R.id)}</title><style>${CSS}</style></head><body><div id="board">
<h1>PREMAP · ${esc(title || `local-meru:${R.id}`)}</h1>
<p class="lede">${after} · ${p.tiers.length} tiers, ${f1(Math.max(...p.tiers.map(peakOf)) - J.at[2])} m to the top · ${walked.reduce((n, L) => n + L.flights.length, 0)} flights, ${walked.reduce((n, L) => n + L.landings.length, 0)} landings, ${climbs.length} climb${climbs.length === 1 ? '' : 's'} · ${f1(p.route[p.route.length - 1].s)} m walked · <span class="badge">${esc(status)}</span></p>
<div class="row r1">
<div class="card"><header><h2>1 · plan</h2><span class="note" style="margin:0">the mandala from above</span></header>${planSvg(p, 416)}<p class="note">white: the walk · ticks: a riser · grey rings: a mound at each landing · ○ a landing · ● a tier's top · ■ a tower (□ open), ▶ its climb · ┄ the seam</p></div>
<div class="card"><header><h2>2 · meru</h2></header>${meruSvg(p, 336)}<p class="note">a half-section through the axis: the named heights up the ruler (metres over the seam), each tier's half-width out to the right · ━ a landing · dashed: a spiral's shelf, a stair's line</p>
<table style="margin-top:8px">${markRows}</table></div>
<div class="card"><header><h2>Tiers</h2></header><table>${tierRows}</table>
<header style="margin-top:12px"><h2>Laws</h2><span class="badge">machine gate</span></header><table>${lawRows}</table>
<p class="note">the steps' laws are the man-made index's own (era/out-made.js); the rest are the level's. All advise, none refuse.</p></div>
</div>
<div class="card" style="margin-bottom:12px"><header><h2>3 · heartbeat</h2><span class="note" style="margin:0">height along the walk, from the followed trail's start · hatched: steps · vertical: a climb</span></header>${heartbeatSvg(p, 1156, 230)}</div>
<div class="row r3">
<div class="card"><header><h2>4 · two-point</h2><span class="note" style="margin:0">projectTwoPoint, a level camera: verticals stay vertical</span></header>${twoPointSvg(p, 576, 430)}<p class="note">solid: toward the camera · dashed: round the back · dash-dot: the meru's axis</p></div>
<div class="card"><header><h2>Anchors</h2><span class="note" style="margin:0">the place asks; playscape answers (links.js answerAnchor)</span></header>
<table><tr><th>id</th><th>what</th><th>way on</th><th>rise</th><th>link</th></tr>${anchorRows}</table>
<p class="note">every anchor carries its way on (N), and a connector its two ends (from, to). A spiral's flight carries its curve; a climb names the link it prefers.</p></div>
</div>
</div></body></html>`;
}

/** The premap as a PNG, laid out by a headless Chromium (scene-png.js). Throws when no browser can be resolved. */
export async function localMeruPremapPng(recipe = {}, opts = {}) {
  const { renderPageToPng } = await import('../scene/scene-png.js');
  return renderPageToPng(localMeruPremapHtml(recipe, opts), { width: 1240, height: 1500, selector: '#board' });
}
