/**
 * THE PREMAP — the level as a guide before it is built: black and white, measured, every place it asks to have
 * joined named. What the landform board is for a trail (era/out-trail-board.js), this is for a local meru, and the
 * two read as one: the trail it follows is drawn on the same plan, and its heartbeat runs on into the climb.
 *
 *   1 PLAN        the mandala from above: the trail it follows, the seam, the mound's rings at each landing's height,
 *                 the spiral shelf with a tick at every riser, the landings, the summit, the tower and its climb
 *   2 MERU        a section through the axis: the named heights up the ruler, the mandala's radius at each (the mound's
 *                 flank, the shelf), the tower standing on the summit
 *   3 HEARTBEAT   height along the walk, from the followed trail's start, over the seam, round the spiral, up the climb
 *   4 TWO-POINT   the massing as the polygonizer draws it (pure-mandala.js projectTwoPoint, a level camera: verticals
 *                 stay vertical), lines only; the back of the mound dashed
 *   LAWS          the ledger (plan.js localMeruLaws), measured
 *   ANCHORS       what playscape answers (links.js answerAnchor): each with its way on, its ends and what it prefers
 *
 * `localMeruPremapHtml(recipe)` is pure; `localMeruPremapPng(recipe)` lays it out in a headless Chromium.
 */
import { planLocalMeru, localMeruLaws } from './plan.js';
import { projectTwoPoint } from '../polygonizer/pure-mandala.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const f2 = (v) => (Math.round(v * 100) / 100).toString();
const TAU = Math.PI * 2;
const bearing = (N) => `${Math.round(((Math.atan2(N[0], N[1]) * 180) / Math.PI + 360) % 360)}°`;
const pts = (a) => a.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');

// a point along the walked centreline at distance s (the path is sampled every quarter metre or so)
function along(path, s) {
  let i = 1; while (i < path.length - 1 && path[i].s < s) i++;
  const a = path[i - 1], b = path[i], f = b.s > a.s ? Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s))) : 0;
  return { at: [0, 1, 2].map((k) => a.at[k] + (b.at[k] - a.at[k]) * f), th: a.th + (b.th - a.th) * f };
}

// ── 1 · the plan ─────────────────────────────────────────────────────────────────────────────────────────────────
function planSvg(p, w) {
  const site = p.join.site, R = p.recipe, c = p.centre, foot = R.mound.foot + R.path.width + 2;
  // the frame: the followed trail's last stretch and the whole mound
  const tail = site ? Math.min(site.D, 34) : 0, trail = [];
  if (site) for (let y = site.D - tail; y <= site.D + 1e-9; y += 0.5) trail.push([site.trailX(y), y]);
  const xs = [c[0] - foot, c[0] + foot, ...trail.map((q) => q[0])], ys = [c[1] - foot, c[1] + foot, ...trail.map((q) => q[1])];
  const x0 = Math.min(...xs) - 3, x1 = Math.max(...xs) + 3, y0 = Math.min(...ys) - 3, y1 = Math.max(...ys) + 3;
  const k = w / (x1 - x0), h = Math.round((y1 - y0) * k), X = (x) => (x - x0) * k, Y = (y) => h - (y - y0) * k, XY = (q) => [X(q[0]), Y(q[1])];
  const o = [];
  const ring = (r) => Array.from({ length: 97 }, (_, i) => XY([c[0] + Math.cos((i / 96) * TAU) * r, c[1] + Math.sin((i / 96) * TAU) * r]));
  // the followed trail: its line, its beats, its stairs sites (with their way on), the seam
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
    o.push(`<line x1="${f1(X(J.at[0] - nx * sw))}" y1="${f1(Y(J.at[1] - ny * sw))}" x2="${f1(X(J.at[0] + nx * sw))}" y2="${f1(Y(J.at[1] + ny * sw))}" stroke="#000" stroke-width="2" stroke-dasharray="5 3"/>`);
    o.push(`<text x="${f1(X(J.at[0] + nx * sw) + 4)}" y="${f1(Y(J.at[1] + ny * sw) + 4)}" class="lbl">seam</text>`);
  }
  // the mound: its foot, a ring at each landing's height (the mandala at that meru mark), the summit
  o.push(`<polygon points="${pts(ring(R.mound.foot))}" fill="#f2f2f2" stroke="#000" stroke-width="2"/>`);
  for (const l of p.landings) o.push(`<polyline points="${pts(ring(p.mandala.radiusAt(l.z)))}" fill="none" stroke="#999" stroke-width=".8"/>`);
  o.push(`<polygon points="${pts(ring(p.summit.r))}" fill="#fff" stroke="#000" stroke-width="2"/>`);
  // the approach and the spiral shelf, white with a black edge; a tick across it at every riser
  const shelf = [XY(p.join.at), ...p.path.map((q) => XY(q.at))];
  o.push(`<polyline points="${pts(shelf)}" fill="none" stroke="#000" stroke-width="${f1(R.path.width * k + 3)}" stroke-linejoin="round"/>`);
  o.push(`<polyline points="${pts(shelf)}" fill="none" stroke="#fff" stroke-width="${f1(R.path.width * k)}" stroke-linejoin="round"/>`);
  for (const f of p.flights) {
    for (let i = 0; i < f.risers; i++) {
      const q = along(p.path, f.s0 + i * f.T), a = p.a0 + p.hand * q.th, ux = Math.cos(a), uy = Math.sin(a), hw = R.path.width / 2;
      o.push(`<line x1="${f1(X(q.at[0] - ux * hw))}" y1="${f1(Y(q.at[1] - uy * hw))}" x2="${f1(X(q.at[0] + ux * hw))}" y2="${f1(Y(q.at[1] + uy * hw))}" stroke="#000" stroke-width="1"/>`);
    }
  }
  for (const l of p.landings) o.push(`<circle cx="${f1(X(l.at[0]))}" cy="${f1(Y(l.at[1]))}" r="4.5" fill="#fff" stroke="#000" stroke-width="1.8"/><text x="${f1(X(l.at[0]) + 8)}" y="${f1(Y(l.at[1]) - 6)}" class="lbl">L${l.k}</text>`);
  // the tower: its square, the climb from the arrival side, the summit's arrival
  const T = p.tower;
  o.push(`<polygon points="${pts(T.corners.map(XY))}" fill="#000"/>`);
  o.push(`<line x1="${f1(X(p.climb.from[0]))}" y1="${f1(Y(p.climb.from[1]))}" x2="${f1(X(p.climb.to[0]))}" y2="${f1(Y(p.climb.to[1]))}" stroke="#000" stroke-width="3" marker-end="url(#arr)"/>`);
  o.push(`<text x="${f1(X(c[0]))}" y="${f1(Y(c[1]) - T.half * k - 8)}" text-anchor="middle" class="lbl">tower · climb-1</text>`);
  o.push(`<circle cx="${f1(X(p.summit.arrive[0]))}" cy="${f1(Y(p.summit.arrive[1]))}" r="5" fill="#000" stroke="#fff" stroke-width="1.5"/>`);
  o.push(`<text x="${f1(X(p.path[0].at[0]) + 10)}" y="${f1(Y(p.path[0].at[1]) + 14)}" class="lbl">foot</text>`);
  // a scale bar and the way +y runs
  o.push(`<line x1="10" y1="${h - 12}" x2="${f1(10 + 10 * k)}" y2="${h - 12}" stroke="#000" stroke-width="3"/><text x="10" y="${h - 18}" class="sm">10 m</text>`);
  o.push(`<line x1="${w - 16}" y1="${h - 12}" x2="${w - 16}" y2="${h - 36}" stroke="#000" stroke-width="1.5" marker-end="url(#arr)"/><text x="${w - 16}" y="${h - 40}" text-anchor="middle" class="sm">+y</text>`);
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#000"/></marker></defs>${o.join('')}</svg>`;
}

// ── 2 · the meru: a section through the axis ─────────────────────────────────────────────────────────────────────
function meruSvg(p, w) {
  const R = p.recipe, z0 = p.meru.base, z1 = p.meru.top, rMax = R.mound.foot + R.path.width + 0.5;
  // a half-section: the ruler on the left, the axis beside it, the mandala's radius running out to the right
  const padT = 14, padB = 12, ruler = 96, axisX = ruler + 26, k = (w - axisX - 8) / rMax, h = Math.round((z1 - z0) * k + padT + padB);
  const Y = (z) => h - padB - (z - z0) * k, X = (r) => axisX + r * k, o = [];
  // the mound's flank (the mandala's radius at each height); the shelf's centreline dashed
  const prof = []; for (let z = z0; z <= p.summit.z + 1e-9; z += 0.1) prof.push([p.mandala.radiusAt(z), z]);
  o.push(`<polygon points="${pts([[X(0), Y(z0)], ...prof.map(([r, z]) => [X(r), Y(z)]), [X(0), Y(p.summit.z)]])}" fill="#f2f2f2" stroke="#000" stroke-width="1.8"/>`);
  o.push(`<polyline points="${pts(prof.map(([, z]) => [X(p.mandala.shelfAt(z)), Y(z)]))}" fill="none" stroke="#000" stroke-width="1" stroke-dasharray="4 3"/>`);
  for (const l of p.landings) o.push(`<line x1="${f1(X(p.mandala.radiusAt(l.z)))}" x2="${f1(X(p.mandala.radiusAt(l.z) + R.path.width))}" y1="${f1(Y(l.z))}" y2="${f1(Y(l.z))}" stroke="#000" stroke-width="3"/>`);
  // the tower on the summit (its half): a post to the eave, the deck, the rail, the roof; the climb up its face
  const T = p.tower, hs = T.half;
  o.push(`<polyline points="${pts([[X(0), Y(T.eave)], [X(hs), Y(T.eave)], [X(hs), Y(p.summit.z)]])}" fill="none" stroke="#000" stroke-width="1.6"/>`);
  o.push(`<line x1="${f1(X(0))}" x2="${f1(X(hs + 0.2))}" y1="${f1(Y(T.deck))}" y2="${f1(Y(T.deck))}" stroke="#000" stroke-width="4"/>`);
  o.push(`<line x1="${f1(X(0))}" x2="${f1(X(hs))}" y1="${f1(Y(T.rail))}" y2="${f1(Y(T.rail))}" stroke="#000" stroke-width="1.2"/>`);
  o.push(`<polygon points="${pts([[X(0), Y(T.eave)], [X(hs + 0.4), Y(T.eave)], [X(0), Y(T.apex)]])}" fill="#000"/>`);
  o.push(`<line x1="${f1(X(hs + 0.3))}" x2="${f1(X(hs + 0.3))}" y1="${f1(Y(p.summit.z))}" y2="${f1(Y(T.deck))}" stroke="#000" stroke-width="3" stroke-dasharray="2 2"/>`);
  // the axis and its ruler: every named mark at its height, its mandala radius beside it
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

// ── 3 · the heartbeat: the trail followed, over the seam, round the spiral, up the climb ──────────────────────────
function heartbeatSvg(p, w, h) {
  const site = p.join.site, R = p.recipe, o = [];
  const tr = site ? site.out.plan : null, sSeam = tr ? tr.sOf(site.D) : 0, appr = R.path.approach;
  const line = [];
  if (tr) for (let s = 0; s <= sSeam + 1e-9; s += 0.5) line.push([s, tr.smoothAt(s)]);
  line.push([sSeam, p.join.at[2]], [sSeam + appr, p.join.at[2]]);
  for (const q of p.path) line.push([sSeam + appr + q.s, q.z]);
  const sEnd = sSeam + appr + p.length, sTot = sEnd + 6;
  const zs = line.map((q) => q[1]), lo = Math.min(...zs) - 0.5, hi = p.tower.deck + 0.5;
  const padL = 40, padB = 26, padT = 30, iw = w - padL - 10, ih = h - padB - padT;
  const X = (s) => padL + (s / sTot) * iw, Y = (z) => padT + ih - ((z - lo) / (hi - lo)) * ih;
  for (const f of p.flights) {
    const a = sSeam + appr + f.s0, b = sSeam + appr + f.s1;
    o.push(`<rect x="${f1(X(a))}" y="${padT}" width="${f1(X(b) - X(a))}" height="${ih}" fill="url(#hatch3)"/>`);
  }
  if (tr) for (const r of tr.stairs) o.push(`<rect x="${f1(X(r.s0))}" y="${padT}" width="${f1(Math.max(2, X(r.s1) - X(r.s0)))}" height="${ih}" fill="url(#hatch3)"/>`);
  for (let m = Math.ceil(lo); m <= hi; m += 2) o.push(`<line x1="${padL}" x2="${padL + iw}" y1="${f1(Y(m))}" y2="${f1(Y(m))}" stroke="#d9d9d9" stroke-width=".6"/><text x="4" y="${f1(Y(m) + 3)}" class="sm">${m} m</text>`);
  for (let s = 0; s <= sTot; s += 20) o.push(`<text x="${f1(X(s))}" y="${h - 4}" text-anchor="middle" class="sm">${s} m</text>`);
  o.push(`<polyline points="${pts(line.map(([s, z]) => [X(s), Y(z)]))}" fill="none" stroke="#000" stroke-width="2.4"/>`);
  o.push(`<line x1="${f1(X(sEnd))}" x2="${f1(X(sEnd))}" y1="${f1(Y(p.summit.z))}" y2="${f1(Y(p.tower.deck))}" stroke="#000" stroke-width="2.4" stroke-dasharray="4 3"/>`);
  const mark = (s, z, label, fill = '#fff') => o.push(`<line x1="${f1(X(s))}" x2="${f1(X(s))}" y1="22" y2="${f1(Y(z))}" stroke="#000" stroke-width=".8" stroke-dasharray="2 2"/><circle cx="${f1(X(s))}" cy="${f1(Y(z))}" r="4.5" fill="${fill}" stroke="#000" stroke-width="1.8"/><text x="${f1(X(s))}" y="16" text-anchor="middle" class="lbl2">${esc(label)}</text>`);
  if (tr) for (const b of tr.beats) if (b.kind !== 'exit') mark(b.s, tr.smoothAt(b.s), b.kind);
  mark(sSeam, p.join.at[2], 'seam', '#000');
  for (const l of p.landings) mark(sSeam + appr + (l.s0 + l.s1) / 2, l.z, `L${l.k}`);
  mark(sEnd, p.summit.z, 'summit');
  mark(sEnd, p.tower.deck, 'deck', '#000');
  o.push(`<text x="${f1(X(sEnd) + 8)}" y="${f1(Y((p.summit.z + p.tower.deck) / 2))}" class="lbl">climb-1 · ${f1(p.climb.rise)} m</text>`);
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="hatch3" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#bbb" stroke-width="2.5"/></pattern></defs>${o.join('')}</svg>`;
}

// ── 4 · two-point: the massing through the polygonizer's camera, lines only ─────────────────────────────────────────
function twoPointSvg(p, w, h) {
  const R = p.recipe, c = p.centre, z0 = p.meru.base, H = R.mound.height;
  // a level camera from beyond the seam, looking at the mound: forward level, so the verticals stay vertical
  const d0 = [c[0] - p.join.at[0], c[1] - p.join.at[1]], dl = Math.hypot(...d0) || 1, dir = [d0[0] / dl, d0[1] / dl];
  const dist = R.mound.foot * 3.2, eyeZ = z0 + H * 0.42, horizon = h * 0.58;
  const camAt = (fov) => ({ worldFraming: { cameraPosition: [c[0] - dir[0] * dist, c[1] - dir[1] * dist, eyeZ], lookAt: [c[0], c[1], eyeZ], horizontalFov: fov, pictureCenter: [w / 2, horizon] }, viewBox: { width: w, height: h } });
  // the narrowest lens that holds the whole level: the foot's ring, the seam and the tower's apex inside the frame
  const keys = [p.join.at, [c[0], c[1], p.tower.apex + 1], ...Array.from({ length: 24 }, (_, i) => [c[0] + Math.cos((i / 24) * TAU) * R.mound.foot, c[1] + Math.sin((i / 24) * TAU) * R.mound.foot, z0])];
  const fits = (cm) => keys.every((q) => { const s = projectTwoPoint(q, cm, {}); return s[0] > 12 && s[0] < w - 12 && s[1] > 12 && s[1] < h - 12; });
  let fov = 36; while (fov < 110 && !fits(camAt(fov))) fov += 2;
  const cam = camAt(fov);
  const V = (q) => { const s = projectTwoPoint(q, cam, {}); return [s[0], s[1]]; };
  const front = (q) => (q[0] - c[0]) * -dir[0] + (q[1] - c[1]) * -dir[1] >= -0.01;
  const o = [];
  // a polyline split into front (solid) and back (dashed, light) runs
  const split = (P3, wF, wB) => {
    let run = [], f = null;
    const flush = () => { if (run.length > 1) o.push(`<polyline points="${pts(run.map(V))}" fill="none" stroke="${f ? '#000' : '#aaa'}" stroke-width="${f ? wF : wB}"${f ? '' : ' stroke-dasharray="4 3"'}/>`); };
    for (const q of P3) { const fq = front(q); if (f !== null && fq !== f) { run.push(q); flush(); run = [run[run.length - 1]]; } f = fq; run.push(q); }
    flush();
  };
  const ring = (r, z) => Array.from({ length: 97 }, (_, i) => [c[0] + Math.cos((i / 96) * TAU) * r, c[1] + Math.sin((i / 96) * TAU) * r, z]);
  // the mound's outline: its silhouette edges either side, its foot, the rings at the landings, the summit
  const sil = (sg) => { const q = []; for (let z = z0; z <= p.summit.z + 1e-9; z += 0.25) { const r = p.mandala.radiusAt(z); q.push([c[0] - dir[1] * sg * r, c[1] + dir[0] * sg * r, z]); } return q; };
  for (const sg of [1, -1]) o.push(`<polyline points="${pts(sil(sg).map(V))}" fill="none" stroke="#000" stroke-width="1.8"/>`);
  split(ring(R.mound.foot, z0), 1.8, 0.8);
  for (const l of p.landings) split(ring(p.mandala.radiusAt(l.z), l.z), 0.7, 0.5);
  split(ring(p.summit.r, p.summit.z), 1.6, 0.8);
  // the shelf: its outer edge and its inner edge, front solid and back dashed
  const edge = (off) => p.path.map((q) => { const a = p.a0 + p.hand * q.th, r = p.mandala.shelfAt(q.z) + off; return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, q.z]; });
  split([p.join.at, ...edge(R.path.width / 2)], 2.2, 1);
  split(edge(-R.path.width / 2), 1.2, 0.7);
  // the tower: posts to the eave, the deck, the rail, the roof
  const T = p.tower, up = (q, z) => [q[0], q[1], z];
  for (const q of T.corners) o.push(`<line x1="${f1(V(q)[0])}" y1="${f1(V(q)[1])}" x2="${f1(V(up(q, T.eave))[0])}" y2="${f1(V(up(q, T.eave))[1])}" stroke="#000" stroke-width="1.6"/>`);
  for (const z of [T.deck, T.rail, T.eave]) o.push(`<polygon points="${pts(T.corners.map((q) => V(up(q, z))))}" fill="none" stroke="#000" stroke-width="${z === T.deck ? 2.6 : 1}"/>`);
  for (const q of T.corners) o.push(`<line x1="${f1(V(up(q, T.eave))[0])}" y1="${f1(V(up(q, T.eave))[1])}" x2="${f1(V([c[0], c[1], T.apex])[0])}" y2="${f1(V([c[0], c[1], T.apex])[1])}" stroke="#000" stroke-width="1.2"/>`);
  const cf = V(p.climb.from), ct = V(p.climb.to);
  o.push(`<line x1="${f1(cf[0])}" y1="${f1(cf[1])}" x2="${f1(ct[0])}" y2="${f1(ct[1])}" stroke="#000" stroke-width="3" stroke-dasharray="3 2"/>`);
  // the meru: the axis through it all, and the horizon the level camera sets
  const a0 = V([c[0], c[1], z0 - 1]), a1 = V([c[0], c[1], T.apex + 1.5]);
  o.push(`<line x1="${f1(a0[0])}" y1="${f1(a0[1])}" x2="${f1(a1[0])}" y2="${f1(a1[1])}" stroke="#000" stroke-width=".9" stroke-dasharray="8 3 2 3"/>`);
  o.push(`<line x1="0" x2="${w}" y1="${f1(horizon)}" y2="${f1(horizon)}" stroke="#bbb" stroke-width=".8"/><text x="6" y="${f1(horizon - 4)}" class="sm">horizon · eye ${f1(eyeZ - z0)} m · ${fov}° lens · ${f1(dist)} m back</text>`);
  for (const l of p.landings) { const q = V(l.at); if (front(l.at)) o.push(`<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="3.5" fill="#fff" stroke="#000" stroke-width="1.5"/><text x="${f1(q[0] + 6)}" y="${f1(q[1] - 5)}" class="lbl">L${l.k}</text>`); }
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
td.ok{font-weight:700}td.no{font-weight:700;background:#111;color:#fff}td.mono{font:11px Menlo,monospace}
svg{display:block;width:100%;height:auto}
`;

/** The premap for a local-meru recipe, as one self-contained HTML document. */
export function localMeruPremapHtml(recipe = {}, { status = 'proposed' } = {}) {
  const p = planLocalMeru(recipe), R = p.recipe, laws = localMeruLaws(p), J = p.join;
  const lawRows = laws.map((l) => `<tr><td>${esc(l.law)}</td><td class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'BROKEN'}</td><td>${esc(typeof l.value === 'number' ? f2(l.value) : l.value)}</td><td>${esc(l.want)}</td></tr>`).join('');
  const ends = (a) => (a.from ? `${f1(a.from[2] - J.at[2])} → ${f1(a.to[2] - J.at[2])} m` : '');
  const what = (a) => (a.kind === 'site' ? `${a.site}${a.going ? ` · ${a.going.risers} × ${f2(a.going.riser)} / ${f2(a.going.tread)}` : ''}${a.curve ? ` · on a ${f1(a.curve.radius)} m curve` : ''}` : a.kind === 'tier' ? `tier · ${a.tier}${a.length ? ` · ${f1(a.length)} m` : ''}${a.area ? ` · ${f1(a.area)} m²` : ''}` : a.kind === 'junction' ? `junction · ${esc(a.between[0])}` : `${a.kind} · ${a.beat || ''}`);
  const anchorRows = p.anchors.map((a) => `<tr><td><b>${esc(a.id)}</b></td><td>${esc(what(a))}</td><td>${a.N ? bearing(a.N) : ''}</td><td>${esc(ends(a))}</td><td>${a.link ? esc(Object.values(a.link).join(' · ')) : a.kind === 'site' ? 'walk first' : ''}</td></tr>`).join('');
  const tierRows = p.meru.stack.map((m) => `<tr><td><b>${esc(m.name)}</b></td><td>${f1(m.z - J.at[2])} m</td><td>${m.name.startsWith('landing') || m.name === 'summit' ? `r ${f1(p.mandala.radiusAt(m.z))} m` : ''}</td></tr>`).join('');
  const after = J.from ? `after ${esc(J.from)} (${esc(J.kit)} · seed ${J.seed})` : 'standing alone';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1240"><title>Premap · local-meru:${esc(R.id)}</title><style>${CSS}</style></head><body><div id="board">
<h1>PREMAP · local-meru:${esc(R.id)}</h1>
<p class="lede">${after} · mound ${f1(R.mound.height)} m high, ${f1(R.mound.foot)} m to ${f1(R.mound.summit)} m · ${p.flights.length} flights, ${p.going.risers} risers of ${f2(p.going.R)} m, ${p.landings.length} landings of ${f1(p.landing)} m · ${f1(p.length)} m of stair, ${f2(p.turns)} turns ${esc(R.path.hand)}-handed · tower ${f1(R.tower.side)} m, deck ${f1(R.tower.deck)} m · <span class="badge">${esc(status)}</span></p>
<div class="row r1">
<div class="card"><header><h2>1 · plan</h2><span class="note" style="margin:0">the mandala from above</span></header>${planSvg(p, 416)}<p class="note">white: the walk · ticks: a riser (the trail's stairs sites across their way on) · grey rings: the mound at each landing · ○ a landing · ■ the tower, ▶ its climb · ┄ the seam</p></div>
<div class="card"><header><h2>2 · meru</h2></header>${meruSvg(p, 336)}<p class="note">a half-section through the axis: the named heights up the ruler (metres over the seam), the mandala's radius out to the right (metres) · ━ a landing on the shelf · dashed: the shelf's centreline</p>
<table style="margin-top:8px">${tierRows}</table></div>
<div class="card"><header><h2>Laws</h2><span class="badge">machine gate</span></header><table>${lawRows}</table>
<p class="note">the steps' laws are the man-made index's own (era/out-made.js); the rest are the level's. All advise, none refuse.</p></div>
</div>
<div class="card" style="margin-bottom:12px"><header><h2>3 · heartbeat</h2><span class="note" style="margin:0">height along the walk, from the followed trail's start · hatched: steps (the trail's stairs sites, the spiral's flights) · dashed: the climb</span></header>${heartbeatSvg(p, 1156, 230)}</div>
<div class="row r3">
<div class="card"><header><h2>4 · two-point</h2><span class="note" style="margin:0">projectTwoPoint, a level camera: verticals stay vertical</span></header>${twoPointSvg(p, 576, 430)}<p class="note">solid: toward the camera · dashed: round the back · dash-dot: the meru's axis</p></div>
<div class="card"><header><h2>Anchors</h2><span class="note" style="margin:0">the place asks; playscape answers (links.js answerAnchor)</span></header>
<table><tr><th>id</th><th>what</th><th>way on</th><th>rise</th><th>link</th></tr>${anchorRows}</table>
<p class="note">every anchor carries its way on (N), and a connector its two ends (from, to): nothing that answers it assumes +y. A flight's curve rides along for a stair laid round the mound. The climb names what it prefers; any climbable look answers the same verb.</p></div>
</div>
</div></body></html>`;
}

/** The premap as a PNG, laid out by a headless Chromium (scene-png.js). Throws when no browser can be resolved. */
export async function localMeruPremapPng(recipe = {}, opts = {}) {
  const { renderPageToPng } = await import('../scene/scene-png.js');
  return renderPageToPng(localMeruPremapHtml(recipe, opts), { width: 1240, height: 1500, selector: '#board' });
}

